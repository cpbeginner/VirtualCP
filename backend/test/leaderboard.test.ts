import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createCacheService } from "../src/services/cacheService";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("leaderboard", () => {
  it("sorts users by xp desc and computes level", async () => {
    const dbDir = await makeTempDir("virtualcp-leaderboard-db-");
    const cacheDir = await makeTempDir("virtualcp-leaderboard-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const a1 = supertest.agent(app);
    const a2 = supertest.agent(app);

    const r1 = await a1.post("/api/auth/register").send({ username: "user111", password: "password123" });
    const r2 = await a2.post("/api/auth/register").send({ username: "user222", password: "password123" });
    expect(r1.body.ok).toBe(true);
    expect(r2.body.ok).toBe(true);

    const u1 = r1.body.user.id as string;
    const u2 = r2.body.user.id as string;

    await fileDb.updateDb((db) => {
      const one = db.users.find((u) => u.id === u1)!;
      const two = db.users.find((u) => u.id === u2)!;
      one.stats.xp = 500;
      two.stats.xp = 1000;
    });

    const lb = await a1.get("/api/leaderboard?limit=20");
    expect(lb.status).toBe(200);
    expect(lb.body.ok).toBe(true);
    expect(lb.body.leaderboard).toHaveLength(2);
    expect(lb.body.leaderboard[0].userId).toBe(u2);
    expect(lb.body.leaderboard[0].level).toBe(3);
    expect(lb.body.leaderboard[1].userId).toBe(u1);
    expect(lb.body.leaderboard[1].level).toBe(2);
  });
});

