import type { Logger } from "pino";
import type { AtMergedProblem, AtProblemModels } from "../integrations/atcoderProblems";
import type { CfProblem } from "../integrations/codeforces";
import type { NormalizedProblem } from "../domain/dbTypes";
import { createCacheService } from "./cacheService";

type CacheService = ReturnType<typeof createCacheService>;

export function createProblemIndexService(opts: { cacheService: CacheService; logger: Logger }) {
  const { cacheService, logger } = opts;

  let cachedUpdatedAt: number | null = null;
  let cachedIndex: NormalizedProblem[] | null = null;

  async function rebuildIndex(): Promise<NormalizedProblem[]> {
    const index: NormalizedProblem[] = [];

    const cfProblems = await cacheService.loadCodeforcesProblemset<CfProblem[]>();
    for (const p of cfProblems) {
      index.push({
        platform: "codeforces",
        key: `${p.contestId}${p.index}`,
        name: p.name,
        url: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`,
        difficulty: p.rating,
        tags: p.tags ?? [],
      });
    }

    const merged = await cacheService.loadAtcoderMergedProblems<AtMergedProblem[]>();
    const models = await cacheService.loadAtcoderProblemModels<AtProblemModels>();
    for (const p of merged) {
      const model = models[p.id];
      index.push({
        platform: "atcoder",
        key: p.id,
        name: p.title ?? p.name,
        url: `https://atcoder.jp/contests/${p.contest_id}/tasks/${p.id}`,
        difficulty: model?.difficulty,
      });
    }

    return index.sort((a, b) => a.key.localeCompare(b.key));
  }

  async function getNormalizedIndex(): Promise<NormalizedProblem[]> {
    const meta = await cacheService.getMeta();
    const updatedAt = meta.updatedAt ?? 0;
    if (cachedIndex && cachedUpdatedAt === updatedAt) return cachedIndex;

    try {
      cachedIndex = await rebuildIndex();
      cachedUpdatedAt = updatedAt;
      return cachedIndex;
    } catch (err) {
      logger.warn({ err }, "problemIndex rebuild failed");
      throw err;
    }
  }

  return { getNormalizedIndex };
}

