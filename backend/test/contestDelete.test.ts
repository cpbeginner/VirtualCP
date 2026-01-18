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

describe("contest deletion", () => {
  it("deletes a contest by id", async () => {
    const dbDir = await makeTempDir("virtucontest-delete-db-");
    const cacheDir = await makeTempDir("virtucontest-delete-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);

    await agent.post("/api/auth/register").send({ username: "deleter", password: "password123" });
    await agent.post("/api/cache/refresh").send({});

    const created = await agent.post("/api/contests").send({
      name: "c1",
      durationMinutes: 120,
      platforms: { codeforces: true, atcoder: false },
      count: 2,
      startImmediately: false,
    });
    expect(created.body.ok).toBe(true);
    const id = created.body.contest.id as string;

    const list1 = await agent.get("/api/contests");
    expect(list1.body.ok).toBe(true);
    expect(list1.body.contests).toHaveLength(1);

    const deleted = await agent.delete(`/api/contests/${id}`).send({});
    expect(deleted.body.ok).toBe(true);

    const list2 = await agent.get("/api/contests");
    expect(list2.body.ok).toBe(true);
    expect(list2.body.contests).toHaveLength(0);
  }, 20000);
});
