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

describe("problems search", () => {
  it("filters and paginates results using MOCK caches", async () => {
    const dbDir = await makeTempDir("virtualcp-problems-db-");
    const cacheDir = await makeTempDir("virtualcp-problems-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);
    await agent.post("/api/auth/register").send({ username: "user123", password: "password123" });
    await agent.post("/api/cache/refresh").send({});

    const first = await agent.get("/api/problems/search").query({
      platform: "codeforces",
      tags: "math",
      limit: "1",
    });
    expect(first.status).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(first.body.results).toHaveLength(1);
    expect(typeof first.body.nextCursor).toBe("string");

    const second = await agent.get("/api/problems/search").query({
      platform: "codeforces",
      tags: "math",
      limit: "1",
      cursor: first.body.nextCursor,
    });
    expect(second.status).toBe(200);
    expect(second.body.ok).toBe(true);
    expect(second.body.results).toHaveLength(1);
  });
});

