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

describe("cache", () => {
  it("refreshes caches in MOCK_OJ mode", async () => {
    const dbDir = await makeTempDir("virtucontest-cache-db-");
    const cacheDir = await makeTempDir("virtucontest-cache-dir-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);

    await agent.post("/api/auth/register").send({ username: "user1", password: "password123" });

    const before = await agent.get("/api/cache/status");
    expect(before.status).toBe(200);
    expect(before.body.ok).toBe(true);

    const refreshed = await agent.post("/api/cache/refresh").send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.ok).toBe(true);
    expect(refreshed.body.meta.updatedAt).toBeGreaterThan(0);
    expect(refreshed.body.meta.codeforcesUpdatedAt).toBeGreaterThan(0);
    expect(refreshed.body.meta.atcoderUpdatedAt).toBeGreaterThan(0);

    const cf = await fs.readFile(path.join(cacheDir, "codeforces_problemset.json"), "utf8");
    expect(() => JSON.parse(cf)).not.toThrow();
  });
});
