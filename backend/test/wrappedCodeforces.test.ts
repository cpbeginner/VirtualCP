import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDbPath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "virtualcp-wrapped-cf-"));
  return path.join(dir, "db.json");
}

describe("codeforces wrapped", () => {
  it("returns wrapped stats for 2023", async () => {
    const dbPath = await makeTempDbPath();
    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const app = createApp({ logger, fileDb });
    const agent = supertest.agent(app);

    const reg = await agent.post("/api/auth/register").send({
      username: "wrapuser",
      password: "password123",
      cfHandle: "any",
    });
    expect(reg.status).toBe(200);
    expect(reg.body.ok).toBe(true);

    const res = await agent.get("/api/wrapped/codeforces?year=2023");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.wrapped.platform).toBe("codeforces");
    expect(res.body.wrapped.year).toBe(2023);
    expect(res.body.wrapped.handle).toBe("any");

    expect(res.body.wrapped.problems.uniqueSolved).toBe(4);
    expect(res.body.wrapped.problems.topTags[0]).toEqual({ tag: "implementation", count: 3 });
    expect(res.body.wrapped.rating.contests).toBe(3);
    expect(Array.isArray(res.body.warnings)).toBe(true);
  });

  it("rejects invalid or missing year", async () => {
    const dbPath = await makeTempDbPath();
    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const app = createApp({ logger, fileDb });
    const agent = supertest.agent(app);

    await agent.post("/api/auth/register").send({
      username: "wrapuser2",
      password: "password123",
      cfHandle: "any",
    });

    const bad = await agent.get("/api/wrapped/codeforces?year=2022");
    expect(bad.status).toBe(400);

    const missing = await agent.get("/api/wrapped/codeforces");
    expect(missing.status).toBe(400);
  });
});

