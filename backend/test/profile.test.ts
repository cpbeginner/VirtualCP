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

describe("profile + preferences", () => {
  it("returns profile and applies preference updates", async () => {
    const dbDir = await makeTempDir("virtualcp-profile-db-");
    const cacheDir = await makeTempDir("virtualcp-profile-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const agent = supertest.agent(app);

    await agent.post("/api/auth/register").send({ username: "user123", password: "password123" });
    await agent.post("/api/cache/refresh").send({});

    const profile1 = await agent.get("/api/me/profile");
    expect(profile1.status).toBe(200);
    expect(profile1.body.ok).toBe(true);
    expect(profile1.body.stats.xp).toBe(0);
    expect(profile1.body.level.level).toBe(1);
    expect(profile1.body.preferences.theme).toBe("aurora");
    expect(profile1.body.stats.achievements.cache_refresher).toBeTruthy();

    const patched = await agent.patch("/api/me/preferences").send({
      theme: "midnight",
      motion: "off",
      effects: { sounds: true, particles: false },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.ok).toBe(true);
    expect(patched.body.preferences.theme).toBe("midnight");
    expect(patched.body.preferences.motion).toBe("off");
    expect(patched.body.preferences.effects.sounds).toBe(true);
    expect(patched.body.preferences.effects.particles).toBe(false);

    const profile2 = await agent.get("/api/me/profile");
    expect(profile2.body.ok).toBe(true);
    expect(profile2.body.preferences.theme).toBe("midnight");
    expect(profile2.body.preferences.motion).toBe("off");

    const ach = await agent.get("/api/achievements");
    expect(ach.status).toBe(200);
    expect(ach.body.ok).toBe(true);
    expect(Array.isArray(ach.body.achievements)).toBe(true);
    expect(ach.body.achievements.some((a: any) => a.id === "first_solve")).toBe(true);
  });
});

