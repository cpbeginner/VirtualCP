import type { Logger } from "pino";
import { fetchCodeforcesUserRating, fetchCodeforcesUserStatus } from "../integrations/codeforces";
import { nowUnixSeconds, yearRangeUtcSeconds } from "../utils/time";

export type CfWrappedYear = {
  platform: "codeforces";
  year: number;
  handle: string;
  generatedAt: number;
  range: { start: number; end: number };
  problems: {
    uniqueSolved: number;
    acSubmissions: number;
    activeDays: number;
    longestStreakDays: number;
    firstSolvedAt?: number;
    lastSolvedAt?: number;
    topTags: Array<{ tag: string; count: number }>;
    difficultyCounts: Array<{ rating: number; count: number }>;
    difficultySummary: { min?: number; max?: number; median?: number };
    monthlySolved: Array<{ month: string; count: number }>;
  };
  rating: {
    contests: number;
    start?: number;
    end?: number;
    delta?: number;
    maxGain?: { contestId: number; contestName: string; delta: number; t: number };
    maxDrop?: { contestId: number; contestName: string; delta: number; t: number };
    changes: Array<{
      contestId: number;
      contestName: string;
      t: number;
      oldRating: number;
      newRating: number;
      delta: number;
    }>;
  };
};

type CacheEntry = { generatedAt: number; wrapped: CfWrappedYear; warnings: string[] };

function utcMonthString(ts: number): string {
  const d = new Date(ts * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function longestConsecutiveStreakDays(dayIds: number[]): number {
  if (dayIds.length === 0) return 0;
  const sorted = [...dayIds].sort((a, b) => a - b);
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      cur += 1;
    } else {
      cur = 1;
    }
    if (cur > best) best = cur;
  }
  return best;
}

function medianFromCounts(counts: Array<{ rating: number; count: number }>): number | undefined {
  const sorted = [...counts].filter((c) => c.count > 0).sort((a, b) => a.rating - b.rating);
  const total = sorted.reduce((sum, c) => sum + c.count, 0);
  if (total <= 0) return undefined;

  const k1 = Math.floor((total - 1) / 2);
  const k2 = Math.floor(total / 2);

  const at = (k: number): number => {
    let seen = 0;
    for (const c of sorted) {
      const next = seen + c.count;
      if (k < next) return c.rating;
      seen = next;
    }
    return sorted[sorted.length - 1].rating;
  };

  const a = at(k1);
  const b = at(k2);
  return (a + b) / 2;
}

export function createWrappedService(opts: { logger: Logger }) {
  const { logger } = opts;

  const cache = new Map<string, CacheEntry>();
  const ttlSeconds = 43200;

  async function getCodeforcesWrappedYear(params: {
    handle: string;
    year: number;
    refresh?: boolean;
  }): Promise<{ wrapped: CfWrappedYear; warnings: string[] }> {
    const { handle, year, refresh } = params;
    const cacheKey = `${handle}:${year}`;

    const now = nowUnixSeconds();
    const cached = cache.get(cacheKey);
    if (!refresh && cached && now - cached.generatedAt < ttlSeconds) {
      return { wrapped: cached.wrapped, warnings: cached.warnings };
    }

    const range = yearRangeUtcSeconds(year);
    const warnings: string[] = [];

    let submissions:
      | Awaited<ReturnType<typeof fetchCodeforcesUserStatus>>
      | null = null;

    try {
      const pageSize = 10000;
      const maxPages = 5;
      let from = 1;
      let pages = 0;
      let stopMet = false;
      const all: Awaited<ReturnType<typeof fetchCodeforcesUserStatus>> = [];

      while (pages < maxPages) {
        const page = await fetchCodeforcesUserStatus(handle, { from, count: pageSize });
        if (page.length === 0) {
          stopMet = true;
          break;
        }
        all.push(...page);

        const oldest = page.reduce(
          (m, s) => Math.min(m, s.creationTimeSeconds),
          Number.POSITIVE_INFINITY,
        );
        if (oldest < range.start) {
          stopMet = true;
          break;
        }

        from += pageSize;
        pages += 1;
      }

      if (!stopMet) warnings.push("Submission history truncated; results may be incomplete");
      submissions = all;
    } catch (err) {
      logger.warn({ err }, "codeforces submissions fetch failed");
      warnings.push("Codeforces submissions unavailable");
      submissions = null;
    }

    let ratingChanges: Awaited<ReturnType<typeof fetchCodeforcesUserRating>> | null = null;
    try {
      ratingChanges = await fetchCodeforcesUserRating(handle);
    } catch (err) {
      logger.warn({ err }, "codeforces rating history fetch failed");
      warnings.push("Codeforces rating history unavailable");
      ratingChanges = null;
    }

    const problemsEmpty: CfWrappedYear["problems"] = {
      uniqueSolved: 0,
      acSubmissions: 0,
      activeDays: 0,
      longestStreakDays: 0,
      topTags: [],
      difficultyCounts: [],
      difficultySummary: {},
      monthlySolved: [],
    };

    const ratingEmpty: CfWrappedYear["rating"] = {
      contests: 0,
      changes: [],
    };

    const problems: CfWrappedYear["problems"] = submissions
      ? (() => {
          const earliest = new Map<
            string,
            { ts: number; submission: (typeof submissions)[number] }
          >();

          let acSubmissions = 0;

          for (const s of submissions) {
            if (s.verdict !== "OK") continue;
            const ts = s.creationTimeSeconds;
            if (ts < range.start || ts >= range.end) continue;
            if (typeof s.problem.contestId !== "number") continue;

            acSubmissions += 1;
            const key = `${s.problem.contestId}${s.problem.index}`;
            const prev = earliest.get(key);
            if (!prev || ts < prev.ts) {
              earliest.set(key, { ts, submission: s });
            }
          }

          const uniqueSolved = earliest.size;
          const earliestList = [...earliest.values()];

          let firstSolvedAt: number | undefined;
          let lastSolvedAt: number | undefined;
          if (earliestList.length > 0) {
            firstSolvedAt = Math.min(...earliestList.map((e) => e.ts));
            lastSolvedAt = Math.max(...earliestList.map((e) => e.ts));
          }

          const dayIds = new Set<number>();
          for (const e of earliestList) {
            dayIds.add(Math.floor(e.ts / 86400));
          }
          const activeDays = dayIds.size;
          const longestStreakDays = longestConsecutiveStreakDays([...dayIds]);

          const tagCounts = new Map<string, number>();
          for (const e of earliestList) {
            for (const tag of e.submission.problem.tags ?? []) {
              tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
            }
          }
          const topTags = [...tagCounts.entries()]
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => {
              if (b.count !== a.count) return b.count - a.count;
              return a.tag.localeCompare(b.tag);
            })
            .slice(0, 10);

          const ratingCountsMap = new Map<number, number>();
          for (const e of earliestList) {
            const r = e.submission.problem.rating;
            if (typeof r === "number") {
              ratingCountsMap.set(r, (ratingCountsMap.get(r) ?? 0) + 1);
            }
          }
          const difficultyCounts = [...ratingCountsMap.entries()]
            .map(([rating, count]) => ({ rating, count }))
            .sort((a, b) => a.rating - b.rating);

          const summary =
            difficultyCounts.length > 0
              ? {
                  min: difficultyCounts[0].rating,
                  max: difficultyCounts[difficultyCounts.length - 1].rating,
                  median: medianFromCounts(difficultyCounts),
                }
              : {};

          const monthMap = new Map<string, number>();
          for (const e of earliestList) {
            const month = utcMonthString(e.ts);
            monthMap.set(month, (monthMap.get(month) ?? 0) + 1);
          }
          const monthlySolved = [...monthMap.entries()]
            .filter(([, count]) => count > 0)
            .map(([month, count]) => ({ month, count }))
            .sort((a, b) => a.month.localeCompare(b.month));

          return {
            uniqueSolved,
            acSubmissions,
            activeDays,
            longestStreakDays,
            firstSolvedAt,
            lastSolvedAt,
            topTags,
            difficultyCounts,
            difficultySummary: summary,
            monthlySolved,
          };
        })()
      : problemsEmpty;

    const rating: CfWrappedYear["rating"] = ratingChanges
      ? (() => {
          const sorted = [...ratingChanges].sort(
            (a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds,
          );

          const inYear = sorted.filter(
            (c) => c.ratingUpdateTimeSeconds >= range.start && c.ratingUpdateTimeSeconds < range.end,
          );

          const changes = inYear.map((c) => ({
            contestId: c.contestId,
            contestName: c.contestName,
            t: c.ratingUpdateTimeSeconds,
            oldRating: c.oldRating,
            newRating: c.newRating,
            delta: c.newRating - c.oldRating,
          }));

          const contests = changes.length;

          const beforeStart = sorted.filter((c) => c.ratingUpdateTimeSeconds < range.start);
          const start =
            beforeStart.length > 0
              ? beforeStart[beforeStart.length - 1].newRating
              : contests > 0
                ? changes[0].oldRating
                : undefined;

          const beforeEnd = sorted.filter((c) => c.ratingUpdateTimeSeconds < range.end);
          let end =
            beforeEnd.length > 0 ? beforeEnd[beforeEnd.length - 1].newRating : undefined;
          if (end === undefined && start !== undefined) end = start;

          const delta = start !== undefined && end !== undefined ? end - start : undefined;

          let maxGain: CfWrappedYear["rating"]["maxGain"];
          let maxDrop: CfWrappedYear["rating"]["maxDrop"];

          for (const c of changes) {
            if (!maxGain || c.delta > maxGain.delta || (c.delta === maxGain.delta && c.t < maxGain.t)) {
              maxGain = { contestId: c.contestId, contestName: c.contestName, delta: c.delta, t: c.t };
            }
            if (!maxDrop || c.delta < maxDrop.delta || (c.delta === maxDrop.delta && c.t < maxDrop.t)) {
              maxDrop = { contestId: c.contestId, contestName: c.contestName, delta: c.delta, t: c.t };
            }
          }

          return { contests, start, end, delta, maxGain, maxDrop, changes };
        })()
      : ratingEmpty;

    const wrapped: CfWrappedYear = {
      platform: "codeforces",
      year,
      handle,
      generatedAt: now,
      range,
      problems,
      rating,
    };

    cache.set(cacheKey, { generatedAt: now, wrapped, warnings });
    return { wrapped, warnings };
  }

  return { getCodeforcesWrappedYear };
}

