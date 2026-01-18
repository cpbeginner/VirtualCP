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

describe("ratings endpoint", () => {
  it("returns Codeforces and AtCoder rating series in MOCK_OJ mode", async () => {
    const dbDir = await makeTempDir("virtucontest-ratings-db-");
    const cacheDir = await makeTempDir("virtucontest-ratings-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);

    await agent.post("/api/auth/register").send({
      username: "ratingsuser",
      password: "password123",
      cfHandle: "any",
      atcoderUser: "any",
    });

    const res = await agent.get("/api/me/ratings");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.codeforces.handle).toBe("any");
    expect(res.body.codeforces.contests).toBe(3);
    expect(res.body.atcoder.user).toBe("any");
    expect(res.body.atcoder.contests).toBe(2);
  });
});

