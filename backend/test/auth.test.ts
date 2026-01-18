import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDbPath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "virtucontest-auth-"));
  return path.join(dir, "db.json");
}

describe("auth", () => {
  it("registers, sets cookie, and /me returns user", async () => {
    const dbPath = await makeTempDbPath();
    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const app = createApp({ logger, fileDb });

    const agent = supertest.agent(app);

    const reg = await agent.post("/api/auth/register").send({
      username: "alice",
      password: "password123",
      cfHandle: "alice_cf",
    });
    expect(reg.status).toBe(200);
    expect(reg.body.ok).toBe(true);
    expect(reg.body.user.username).toBe("alice");
    expect(reg.body.user.cfHandle).toBe("alice_cf");

    const me = await agent.get("/api/me");
    expect(me.status).toBe(200);
    expect(me.body.ok).toBe(true);
    expect(me.body.user.username).toBe("alice");
  });

  it("logout clears auth and login works", async () => {
    const dbPath = await makeTempDbPath();
    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const app = createApp({ logger, fileDb });

    const agent = supertest.agent(app);

    await agent.post("/api/auth/register").send({
      username: "bob",
      password: "password123",
    });

    await agent.post("/api/auth/logout").expect(200);
    const meAfterLogout = await agent.get("/api/me");
    expect(meAfterLogout.status).toBe(401);

    const badLogin = await agent.post("/api/auth/login").send({
      username: "bob",
      password: "wrongpass",
    });
    expect(badLogin.status).toBe(401);
    expect(badLogin.body.ok).toBe(false);

    const goodLogin = await agent.post("/api/auth/login").send({
      username: "bob",
      password: "password123",
    });
    expect(goodLogin.status).toBe(200);
    expect(goodLogin.body.ok).toBe(true);

    const me = await agent.get("/api/me");
    expect(me.status).toBe(200);
    expect(me.body.user.username).toBe("bob");
  });
});
