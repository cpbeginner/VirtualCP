import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Contest } from "../src/domain/dbTypes";
import { createCacheService } from "../src/services/cacheService";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("poller manual refresh", () => {
  it("marks contest problems solved from MOCK_OJ submissions", async () => {
    const dbDir = await makeTempDir("virtucontest-poller-db-");
    const cacheDir = await makeTempDir("virtucontest-poller-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);

    const reg = await agent.post("/api/auth/register").send({
      username: "polluser",
      password: "password123",
      cfHandle: "any",
      atcoderUser: "any",
    });
    expect(reg.body.ok).toBe(true);
    const userId = reg.body.user.id as string;

    const contest: Contest = {
      id: "contest1",
      ownerUserId: userId,
      name: "c",
      status: "running",
      createdAt: 1700000000,
      startedAt: 1700000000,
      durationSeconds: 7200,
      seed: "seed",
      problems: [
        {
          platform: "codeforces",
          key: "1995A",
          name: "Problem A",
          url: "https://codeforces.com/contest/1995/problem/A",
          difficulty: 800,
          tags: ["implementation"],
        },
        {
          platform: "atcoder",
          key: "abc301_a",
          name: "Overall Winner",
          url: "https://atcoder.jp/contests/abc301/tasks/abc301_a",
          difficulty: 200,
        },
      ],
      progress: { solved: {}, lastPoll: {} },
    };

    await fileDb.updateDb((db) => {
      db.contests.push(contest);
    });

    const refreshed = await agent.post("/api/contests/contest1/refresh").send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.ok).toBe(true);
    expect(refreshed.body.polled.codeforces).toBe(true);
    expect(refreshed.body.polled.atcoder).toBe(true);

    const solved = refreshed.body.contest.progress.solved as Record<string, any>;
    expect(Object.keys(solved).sort()).toEqual(["1995A", "abc301_a"]);
    expect(solved["1995A"].solveTimeSeconds).toBe(100);
    expect(solved["abc301_a"].solveTimeSeconds).toBe(150);
  });
});

