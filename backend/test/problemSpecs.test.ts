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

describe("problemSpecs contest creation", () => {
  it("selects one problem per spec with per-problem ranges", async () => {
    const dbDir = await makeTempDir("virtucontest-specs-db-");
    const cacheDir = await makeTempDir("virtucontest-specs-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const contestService = createContestService({ fileDb, cacheService, logger });

    const refreshed = await cacheService.refreshAll();
    expect(refreshed.ok).toBe(true);

    const contest = await contestService.createContest({
      ownerUserId: "u1",
      name: "specs",
      durationMinutes: 120,
      seed: "seed_specs",
      problemSpecs: [
        { platform: "codeforces", min: 1200, max: 1200 },
        { platform: "atcoder", min: 900, max: 900 },
      ],
    });

    expect(contest.problems).toHaveLength(2);
    expect(contest.problems[0].platform).toBe("codeforces");
    expect(contest.problems[0].key).toBe("1960B");
    expect(contest.problems[1].platform).toBe("atcoder");
    expect(contest.problems[1].key).toBe("abc301_c");
  });
});

