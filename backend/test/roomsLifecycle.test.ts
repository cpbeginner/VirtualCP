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

describe("rooms lifecycle", () => {
  it("creates, joins, starts, and finishes a room", async () => {
    const dbDir = await makeTempDir("virtualcp-rooms-db-");
    const cacheDir = await makeTempDir("virtualcp-rooms-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const host = supertest.agent(app);
    const member = supertest.agent(app);

    await host.post("/api/auth/register").send({ username: "host1", password: "password123" });
    await member.post("/api/auth/register").send({ username: "member1", password: "password123" });

    await host.post("/api/cache/refresh").send({});

    const created = await host.post("/api/rooms").send({
      name: "Room 1",
      durationMinutes: 90,
      platforms: { codeforces: true, atcoder: false },
      count: 2,
      startImmediately: false,
    });
    expect(created.body.ok).toBe(true);
    expect(created.body.room.status).toBe("lobby");
    expect(typeof created.body.room.inviteCode).toBe("string");

    const roomId = created.body.room.id as string;
    const inviteCode = created.body.room.inviteCode as string;

    const joined = await member.post(`/api/rooms/${roomId}/join`).send({ inviteCode });
    expect(joined.body.ok).toBe(true);

    const memberStart = await member.post(`/api/rooms/${roomId}/start`).send({});
    expect(memberStart.status).toBe(403);
    expect(memberStart.body.ok).toBe(false);

    const started = await host.post(`/api/rooms/${roomId}/start`).send({});
    expect(started.body.ok).toBe(true);
    expect(started.body.room.status).toBe("running");

    const memberLeave = await member.post(`/api/rooms/${roomId}/leave`).send({});
    expect(memberLeave.status).toBe(400);
    expect(memberLeave.body.ok).toBe(false);

    const finished = await host.post(`/api/rooms/${roomId}/finish`).send({});
    expect(finished.body.ok).toBe(true);
    expect(finished.body.room.status).toBe("finished");
    expect(Array.isArray(finished.body.scoreboard)).toBe(true);
  });
});

