import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import supertest from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import type { Room } from "../src/domain/dbTypes";
import { createCacheService } from "../src/services/cacheService";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("room poller manual refresh", () => {
  it("updates room progress for all members and increments stats", async () => {
    const dbDir = await makeTempDir("virtualcp-roompoll-db-");
    const cacheDir = await makeTempDir("virtualcp-roompoll-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const host = supertest.agent(app);
    const member = supertest.agent(app);

    const reg1 = await host.post("/api/auth/register").send({
      username: "user1",
      password: "password123",
      cfHandle: "any",
      atcoderUser: "any",
    });
    expect(reg1.body.ok).toBe(true);
    const user1Id = reg1.body.user.id as string;

    const reg2 = await member.post("/api/auth/register").send({
      username: "user2",
      password: "password123",
      cfHandle: "any",
      atcoderUser: "any",
    });
    expect(reg2.body.ok).toBe(true);
    const user2Id = reg2.body.user.id as string;

    const startedAt = 1700000000;

    const room: Room = {
      id: "room1",
      name: "r",
      ownerUserId: user1Id,
      inviteCode: "INVITECODE",
      status: "running",
      createdAt: startedAt,
      startedAt,
      durationSeconds: 7200,
      seed: "seed",
      problems: [
        {
          platform: "codeforces",
          key: "1995A",
          name: "Problem A",
          url: "https://codeforces.com/contest/1995/problem/A",
          difficulty: 800,
          tags: ["implementation"],
        },
        {
          platform: "atcoder",
          key: "abc301_a",
          name: "Overall Winner",
          url: "https://atcoder.jp/contests/abc301/tasks/abc301_a",
          difficulty: 200,
        },
      ],
      members: [
        { userId: user1Id, username: "user1", role: "host", joinedAt: startedAt },
        { userId: user2Id, username: "user2", role: "member", joinedAt: startedAt },
      ],
      progressByUserId: {
        [user1Id]: { solved: {}, lastPoll: {}, lastSync: {} },
        [user2Id]: { solved: {}, lastPoll: {}, lastSync: {} },
      },
    };

    await fileDb.updateDb((db) => {
      db.rooms.push(room);
    });

    const refreshed = await host.post("/api/rooms/room1/refresh").send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.ok).toBe(true);
    expect(refreshed.body.polled.codeforces).toBe(true);
    expect(refreshed.body.polled.atcoder).toBe(true);

    const progress = refreshed.body.room.progressByUserId as Record<string, any>;
    const solved1 = progress[user1Id].solved as Record<string, any>;
    const solved2 = progress[user2Id].solved as Record<string, any>;

    expect(Object.keys(solved1).sort()).toEqual(["1995A", "abc301_a"]);
    expect(Object.keys(solved2).sort()).toEqual(["1995A", "abc301_a"]);

    const dbAfter = await fileDb.readDb();
    const u1 = dbAfter.users.find((u) => u.id === user1Id)!;
    const u2 = dbAfter.users.find((u) => u.id === user2Id)!;
    expect(u1.stats.totalSolved).toBe(2);
    expect(u2.stats.totalSolved).toBe(2);
    expect(u1.stats.xp).toBeGreaterThan(0);
    expect(u2.stats.xp).toBeGreaterThan(0);

    expect(Array.isArray(refreshed.body.scoreboard)).toBe(true);
    expect(refreshed.body.scoreboard).toHaveLength(2);
    expect(refreshed.body.scoreboard[0].rank).toBe(1);
    expect(refreshed.body.scoreboard[1].rank).toBe(2);
  });
});
