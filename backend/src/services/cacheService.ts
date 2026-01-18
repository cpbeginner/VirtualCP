import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import lockfile from "proper-lockfile";
import type { Logger } from "pino";
import { fetchAtcoderMergedProblems, fetchAtcoderProblemModels } from "../integrations/atcoderProblems";
import { fetchCodeforcesProblemset } from "../integrations/codeforces";
import { badRequest } from "../middleware/errorHandler";
import { nowUnixSeconds } from "../utils/time";

export type CacheMeta = {
  updatedAt: number;
  codeforcesUpdatedAt?: number;
  atcoderUpdatedAt?: number;
};

type CacheServiceOptions = {
  cacheDir: string;
  logger: Logger;
};

async function ensureDir(dir: string): Promise<void> {
  await fsp.mkdir(dir, { recursive: true });
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const payload = JSON.stringify(data, null, 2) + "\n";

  const handle = await fsp.open(tmpPath, "w");
  try {
    await handle.writeFile(payload, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  try {
    await fsp.rename(tmpPath, filePath);
  } catch {
    try {
      await fsp.unlink(filePath);
    } catch {
      // ignore
    }
    await fsp.rename(tmpPath, filePath);
  }
}

export function createCacheService({ cacheDir, logger }: CacheServiceOptions) {
  const metaPath = path.join(cacheDir, "meta.json");
  const cfPath = path.join(cacheDir, "codeforces_problemset.json");
  const atMergedPath = path.join(cacheDir, "atcoder_merged_problems.json");
  const atModelsPath = path.join(cacheDir, "atcoder_problem_models.json");

  async function init(): Promise<void> {
    await ensureDir(cacheDir);
    try {
      await fsp.access(metaPath, fs.constants.F_OK);
    } catch {
      await writeJsonAtomic(metaPath, { updatedAt: 0 } satisfies CacheMeta);
    }
  }

  async function getMeta(): Promise<CacheMeta> {
    await init();
    return (await readJsonIfExists<CacheMeta>(metaPath)) ?? { updatedAt: 0 };
  }

  async function refreshAll(): Promise<{ ok: true; meta: CacheMeta } | { ok: false; error: string; meta: CacheMeta }> {
    await init();

    const release = await lockfile.lock(metaPath, {
      retries: { retries: 10, factor: 1.3, minTimeout: 50, maxTimeout: 1000 },
    });

    try {
      const errors: string[] = [];
      const meta = await getMeta();

      // Codeforces cache
      try {
        const problems = await fetchCodeforcesProblemset();
        await writeJsonAtomic(cfPath, problems);
        meta.codeforcesUpdatedAt = nowUnixSeconds();
      } catch (err) {
        logger.warn({ err }, "codeforces cache refresh failed");
        errors.push("Codeforces cache refresh failed");
      }

      // AtCoder Problems cache (unofficial; be graceful)
      try {
        const merged = await fetchAtcoderMergedProblems();
        const models = await fetchAtcoderProblemModels();
        await writeJsonAtomic(atMergedPath, merged);
        await writeJsonAtomic(atModelsPath, models);
        meta.atcoderUpdatedAt = nowUnixSeconds();
      } catch (err) {
        logger.warn({ err }, "atcoder cache refresh failed");
        errors.push("AtCoder Problems cache refresh failed");
      }

      meta.updatedAt = nowUnixSeconds();
      await writeJsonAtomic(metaPath, meta);

      if (errors.length > 0) {
        return { ok: false, error: errors.join("; "), meta };
      }
      return { ok: true, meta };
    } finally {
      await release();
    }
  }

  async function loadCodeforcesProblemset<T>(): Promise<T> {
    const data = await readJsonIfExists<T>(cfPath);
    if (!data) throw badRequest("Missing Codeforces cache. Refresh cache in Settings.");
    return data;
  }

  async function loadAtcoderMergedProblems<T>(): Promise<T> {
    const data = await readJsonIfExists<T>(atMergedPath);
    if (!data) throw badRequest("Missing AtCoder cache. Refresh cache in Settings.");
    return data;
  }

  async function loadAtcoderProblemModels<T>(): Promise<T> {
    const data = await readJsonIfExists<T>(atModelsPath);
    if (!data) throw badRequest("Missing AtCoder cache. Refresh cache in Settings.");
    return data;
  }

  return {
    getMeta,
    refreshAll,
    loadCodeforcesProblemset,
    loadAtcoderMergedProblems,
    loadAtcoderProblemModels,
  };
}
