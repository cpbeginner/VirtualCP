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

describe("favorites", () => {
  it("adds and removes favorites from the problem index", async () => {
    const dbDir = await makeTempDir("virtualcp-fav-db-");
    const cacheDir = await makeTempDir("virtualcp-fav-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);
    await agent.post("/api/auth/register").send({ username: "user123", password: "password123" });
    await agent.post("/api/cache/refresh").send({});

    const added = await agent.post("/api/me/favorites").send({ platform: "codeforces", key: "1995A" });
    expect(added.status).toBe(200);
    expect(added.body.ok).toBe(true);
    expect(added.body.favorites).toHaveLength(1);
    expect(added.body.favorites[0].name).toBe("Problem A");

    const listed = await agent.get("/api/me/favorites");
    expect(listed.status).toBe(200);
    expect(listed.body.ok).toBe(true);
    expect(listed.body.favorites).toHaveLength(1);

    const removed = await agent.delete("/api/me/favorites/codeforces/1995A");
    expect(removed.status).toBe(200);
    expect(removed.body.ok).toBe(true);

    const listed2 = await agent.get("/api/me/favorites");
    expect(listed2.body.favorites).toHaveLength(0);
  });
});

