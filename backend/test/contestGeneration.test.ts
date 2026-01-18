import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createCacheService } from "../src/services/cacheService";
import { createContestService } from "../src/services/contestService";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("contest generation", () => {
  it("is deterministic for the same seed + pool order", async () => {
    const dbDir = await makeTempDir("virtucontest-contest-db-");
    const cacheDir = await makeTempDir("virtucontest-contest-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const contestService = createContestService({ fileDb, cacheService, logger });

    const refreshed = await cacheService.refreshAll();
    expect(refreshed.ok).toBe(true);

    const input = {
      ownerUserId: "u1",
      name: "c1",
      durationMinutes: 120,
      platforms: { codeforces: true, atcoder: false },
      count: 3,
      seed: "seed123",
      cfRatingMin: 800,
      cfRatingMax: 1200,
    };

    const c1 = await contestService.createContest(input);
    const c2 = await contestService.createContest({ ...input, name: "c2" });

    expect(c1.problems.map((p) => p.key)).toEqual(c2.problems.map((p) => p.key));
  });

  it("filters Codeforces by tags (OR)", async () => {
    const dbDir = await makeTempDir("virtucontest-contest-db-");
    const cacheDir = await makeTempDir("virtucontest-contest-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const contestService = createContestService({ fileDb, cacheService, logger });

    await cacheService.refreshAll();

    const contest = await contestService.createContest({
      ownerUserId: "u1",
      name: "tagged",
      durationMinutes: 120,
      platforms: { codeforces: true, atcoder: false },
      count: 1,
      seed: "seed_dp",
      cfTags: ["dp"],
    });

    expect(contest.problems).toHaveLength(1);
    expect(contest.problems[0].key).toBe("1995D");
  });
});

