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

describe("contest lifecycle", () => {
  it("starts and finishes a contest", async () => {
    const dbDir = await makeTempDir("virtucontest-lifecycle-db-");
    const cacheDir = await makeTempDir("virtucontest-lifecycle-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);

    await agent.post("/api/auth/register").send({ username: "user123", password: "password123" });
    await agent.post("/api/cache/refresh").send({});

    const created = await agent.post("/api/contests").send({
      name: "c1",
      durationMinutes: 120,
      platforms: { codeforces: true, atcoder: false },
      count: 2,
      startImmediately: false,
    });
    expect(created.body.ok).toBe(true);
    expect(created.body.contest.status).toBe("created");

    const id = created.body.contest.id as string;

    const started = await agent.post(`/api/contests/${id}/start`).send({});
    expect(started.body.ok).toBe(true);
    expect(started.body.contest.status).toBe("running");
    expect(started.body.contest.startedAt).toBeGreaterThan(0);

    const finished = await agent.post(`/api/contests/${id}/finish`).send({});
    expect(finished.body.ok).toBe(true);
    expect(finished.body.contest.status).toBe("finished");
    expect(finished.body.contest.finishedAt).toBeGreaterThan(0);
  });
});

