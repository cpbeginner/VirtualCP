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

describe("excludeAlreadySolved", () => {
  it("reduces the candidate pool using solved sets (Codeforces)", async () => {
    const dbDir = await makeTempDir("virtucontest-excl-db-");
    const cacheDir = await makeTempDir("virtucontest-excl-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const contestService = createContestService({ fileDb, cacheService, logger });

    await cacheService.refreshAll();
    await fileDb.updateDb((db) => {
      db.users.push({
        id: "u1",
        username: "user1",
        passwordHash: "x",
        cfHandle: "any",
        createdAt: 0,
        stats: {
          xp: 0,
          totalSolved: 0,
          solvedByPlatform: { codeforces: 0, atcoder: 0 },
          streakDays: 0,
          achievements: {},
        },
        preferences: {
          theme: "aurora",
          motion: "system",
          effects: {
            particles: true,
            confetti: true,
            glowCursor: true,
            ambientGradient: true,
            sounds: false,
          },
        },
        favorites: [],
      });
    });

    await expect(
      contestService.createContest({
        ownerUserId: "u1",
        name: "c",
        durationMinutes: 120,
        platforms: { codeforces: true, atcoder: false },
        count: 10,
        excludeAlreadySolved: true,
        seed: "s",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("reduces the candidate pool using solved sets (AtCoder)", async () => {
    const dbDir = await makeTempDir("virtucontest-excl-db-");
    const cacheDir = await makeTempDir("virtucontest-excl-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const contestService = createContestService({ fileDb, cacheService, logger });

    await cacheService.refreshAll();
    await fileDb.updateDb((db) => {
      db.users.push({
        id: "u2",
        username: "user2",
        passwordHash: "x",
        atcoderUser: "any",
        createdAt: 0,
        stats: {
          xp: 0,
          totalSolved: 0,
          solvedByPlatform: { codeforces: 0, atcoder: 0 },
          streakDays: 0,
          achievements: {},
        },
        preferences: {
          theme: "aurora",
          motion: "system",
          effects: {
            particles: true,
            confetti: true,
            glowCursor: true,
            ambientGradient: true,
            sounds: false,
          },
        },
        favorites: [],
      });
    });

    await expect(
      contestService.createContest({
        ownerUserId: "u2",
        name: "c",
        durationMinutes: 120,
        platforms: { codeforces: false, atcoder: true },
        count: 6,
        excludeAlreadySolved: true,
        seed: "s",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});
