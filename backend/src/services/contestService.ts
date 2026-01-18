import type { Logger } from "pino";
import type { AtMergedProblem, AtProblemModels } from "../integrations/atcoderProblems";
import type { CfProblem } from "../integrations/codeforces";
import type { Contest, NormalizedProblem, Platform } from "../domain/dbTypes";
import { fetchAtcoderUserSubmissions } from "../integrations/atcoderProblems";
import { fetchCodeforcesUserStatus } from "../integrations/codeforces";
import { newId } from "../utils/ids";
import { createSeededRng, seededShuffle } from "../utils/seededRng";
import { nowUnixSeconds } from "../utils/time";
import { badRequest, notFound } from "../middleware/errorHandler";
import { createCacheService } from "./cacheService";
import { createFileDb } from "../store/fileDb";

type FileDb = ReturnType<typeof createFileDb>;
type CacheService = ReturnType<typeof createCacheService>;

export type ProblemSpec = {
  platform: Platform;
  min?: number;
  max?: number;
};

export type CreateContestInput = {
  ownerUserId: string;
  name: string;
  durationMinutes: number;
  platforms?: { codeforces: boolean; atcoder: boolean };
  count?: number;
  problemSpecs?: ProblemSpec[];
  cfRatingMin?: number;
  cfRatingMax?: number;
  atDifficultyMin?: number;
  atDifficultyMax?: number;
  cfTags?: string[];
  excludeAlreadySolved?: boolean;
  seed?: string;
  startImmediately?: boolean;
};

export function createContestService(opts: { fileDb: FileDb; cacheService: CacheService; logger: Logger }) {
  const { fileDb, cacheService } = opts;

  async function fetchAtcoderSolvedSet(userId: string): Promise<Set<string>> {
    const solved = new Set<string>();
    let fromSecond = 0;
    let pages = 0;

    while (pages < 30) {
      const subs = await fetchAtcoderUserSubmissions(userId, fromSecond);
      if (subs.length === 0) break;

      let maxEpoch = 0;
      for (const s of subs) {
        if (s.result === "AC") solved.add(s.problem_id);
        if (s.epoch_second > maxEpoch) maxEpoch = s.epoch_second;
      }

      if (subs.length < 500) break;
      if (maxEpoch <= fromSecond) break;
      fromSecond = maxEpoch + 1;
      pages += 1;
    }

    return solved;
  }

  async function buildBasePool(params: {
    includeCodeforces: boolean;
    includeAtcoder: boolean;
    cfTags?: string[];
  }): Promise<NormalizedProblem[]> {
    const candidates: NormalizedProblem[] = [];

    if (params.includeCodeforces) {
      const cfProblems = await cacheService.loadCodeforcesProblemset<CfProblem[]>();
      const tags = (params.cfTags ?? []).map((t) => t.trim()).filter(Boolean);
      const tagsSet = new Set(tags);

      for (const p of cfProblems) {
        if (tagsSet.size > 0 && !(p.tags ?? []).some((t) => tagsSet.has(t))) continue;

        const key = `${p.contestId}${p.index}`;
        candidates.push({
          platform: "codeforces",
          key,
          name: p.name,
          url: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`,
          difficulty: p.rating,
          tags: p.tags ?? [],
        });
      }
    }

    if (params.includeAtcoder) {
      const merged = await cacheService.loadAtcoderMergedProblems<AtMergedProblem[]>();
      const models = await cacheService.loadAtcoderProblemModels<AtProblemModels>();

      for (const p of merged) {
        const model = models[p.id];
        const difficulty = model?.difficulty;

        candidates.push({
          platform: "atcoder",
          key: p.id,
          name: p.title ?? p.name,
          url: `https://atcoder.jp/contests/${p.contest_id}/tasks/${p.id}`,
          difficulty,
        });
      }
    }

    return candidates.sort((a, b) => a.key.localeCompare(b.key));
  }

  function filterByLegacyRanges(pool: NormalizedProblem[], input: CreateContestInput): NormalizedProblem[] {
    return pool.filter((p) => {
      if (p.platform === "codeforces") {
        const min = input.cfRatingMin;
        const max = input.cfRatingMax;
        if (min !== undefined || max !== undefined) {
          if (p.difficulty === undefined) return false;
          if (min !== undefined && p.difficulty < min) return false;
          if (max !== undefined && p.difficulty > max) return false;
        }
        return true;
      }

      if (p.platform === "atcoder") {
        const min = input.atDifficultyMin;
        const max = input.atDifficultyMax;
        if (min !== undefined || max !== undefined) {
          if (p.difficulty === undefined) return false;
          if (min !== undefined && p.difficulty < min) return false;
          if (max !== undefined && p.difficulty > max) return false;
        }
        return true;
      }

      return true;
    });
  }

  function matchesSpec(problem: NormalizedProblem, spec: ProblemSpec): boolean {
    if (problem.platform !== spec.platform) return false;
    if (spec.min !== undefined || spec.max !== undefined) {
      if (problem.difficulty === undefined) return false;
      if (spec.min !== undefined && problem.difficulty < spec.min) return false;
      if (spec.max !== undefined && problem.difficulty > spec.max) return false;
    }
    return true;
  }

  async function createContest(input: CreateContestInput): Promise<Contest> {
    if (input.durationMinutes <= 0) throw badRequest("Invalid durationMinutes");

    const seed = input.seed ?? newId();
    const specs = input.problemSpecs?.length ? input.problemSpecs : null;

    const includeCodeforces = specs
      ? specs.some((s) => s.platform === "codeforces")
      : !!input.platforms?.codeforces;
    const includeAtcoder = specs ? specs.some((s) => s.platform === "atcoder") : !!input.platforms?.atcoder;

    if (!includeCodeforces && !includeAtcoder) {
      throw badRequest("Select at least one platform");
    }

    const desiredCount = specs ? specs.length : input.count ?? 0;
    if (desiredCount <= 0) throw badRequest("Invalid count");

    let pool = await buildBasePool({ includeCodeforces, includeAtcoder, cfTags: input.cfTags });
    if (!specs) {
      pool = filterByLegacyRanges(pool, input);
    }

    if (input.excludeAlreadySolved) {
      const db = await fileDb.readDb();
      const user = db.users.find((u) => u.id === input.ownerUserId);
      if (!user) throw notFound("User not found");

      const cfSolved = new Set<string>();
      const atSolved = new Set<string>();

      if (includeCodeforces && user.cfHandle) {
        try {
          const subs = await fetchCodeforcesUserStatus(user.cfHandle);
          for (const s of subs) {
            if (s.verdict !== "OK") continue;
            if (s.problem.contestId === undefined) continue;
            cfSolved.add(`${s.problem.contestId}${s.problem.index}`);
          }
        } catch {
          throw badRequest("Failed to fetch Codeforces solved set (check handle)");
        }
      }

      if (includeAtcoder && user.atcoderUser) {
        try {
          const solved = await fetchAtcoderSolvedSet(user.atcoderUser);
          for (const k of solved) atSolved.add(k);
        } catch {
          throw badRequest("Failed to fetch AtCoder solved set (check user id)");
        }
      }

      pool = pool.filter((p) => {
        if (p.platform === "codeforces") return !cfSolved.has(p.key);
        if (p.platform === "atcoder") return !atSolved.has(p.key);
        return true;
      });
    }

    let selected: NormalizedProblem[] = [];

    if (!specs) {
      if (pool.length < desiredCount) {
        throw badRequest(`Not enough candidate problems (needed ${desiredCount}, got ${pool.length})`);
      }
      selected = seededShuffle(pool, seed).slice(0, desiredCount);
    } else {
      const rng = createSeededRng(seed);
      let remainingPool = pool;

      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const eligible = remainingPool.filter((p) => matchesSpec(p, spec));
        if (eligible.length === 0) {
          throw badRequest(`Not enough candidate problems for problem ${i + 1}`);
        }
        const idx = Math.floor(rng() * eligible.length);
        const picked = eligible[idx];
        selected.push(picked);
        remainingPool = remainingPool.filter(
          (p) => !(p.platform === picked.platform && p.key === picked.key),
        );
      }
    }

    const now = nowUnixSeconds();
    const contest: Contest = {
      id: newId(),
      ownerUserId: input.ownerUserId,
      name: input.name,
      status: input.startImmediately ? "running" : "created",
      createdAt: now,
      startedAt: input.startImmediately ? now : undefined,
      durationSeconds: input.durationMinutes * 60,
      seed,
      problems: selected,
      progress: {
        solved: {},
        lastPoll: {},
        lastSync: {},
      },
    };

    await fileDb.updateDb((db) => {
      db.contests.push(contest);
    });

    return contest;
  }

  async function listContests(ownerUserId: string): Promise<Contest[]> {
    const db = await fileDb.readDb();
    return db.contests
      .filter((c) => c.ownerUserId === ownerUserId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async function getContest(ownerUserId: string, id: string): Promise<Contest> {
    const db = await fileDb.readDb();
    const contest = db.contests.find((c) => c.id === id && c.ownerUserId === ownerUserId);
    if (!contest) throw notFound("Contest not found");
    return contest;
  }

  async function startContest(ownerUserId: string, id: string): Promise<Contest> {
    const now = nowUnixSeconds();
    return await fileDb.updateDb((db) => {
      const contest = db.contests.find((c) => c.id === id && c.ownerUserId === ownerUserId);
      if (!contest) throw notFound("Contest not found");
      if (contest.status !== "created") throw badRequest("Contest cannot be started");
      contest.status = "running";
      contest.startedAt = now;
      contest.finishedAt = undefined;
      contest.progress.lastPoll = {};
      contest.progress.solved = {};
      contest.progress.lastSync = {};
      return contest;
    });
  }

  async function finishContest(ownerUserId: string, id: string): Promise<Contest> {
    const now = nowUnixSeconds();
    return await fileDb.updateDb((db) => {
      const contest = db.contests.find((c) => c.id === id && c.ownerUserId === ownerUserId);
      if (!contest) throw notFound("Contest not found");
      if (contest.status !== "running") throw badRequest("Contest cannot be finished");
      contest.status = "finished";
      contest.finishedAt = now;
      return contest;
    });
  }

  async function deleteContest(ownerUserId: string, id: string): Promise<void> {
    await fileDb.updateDb((db) => {
      const idx = db.contests.findIndex((c) => c.id === id && c.ownerUserId === ownerUserId);
      if (idx === -1) throw notFound("Contest not found");
      db.contests.splice(idx, 1);
    });
  }

  return { createContest, listContests, getContest, startContest, finishContest, deleteContest };
}
