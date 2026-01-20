import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import lockfile from "proper-lockfile";
import type { Logger } from "pino";
import type { Db, UserPreferences, UserStats } from "../domain/dbTypes";

type FileDbOptions = {
  filePath: string;
  logger: Logger;
};

type UpdateFn<T> = (db: Db) => Promise<T> | T;

const DefaultDb: Db = { users: [], contests: [], rooms: [], roomMessages: [], activities: [] };

function defaultUserStats(): UserStats {
  return {
    xp: 0,
    totalSolved: 0,
    solvedByPlatform: { codeforces: 0, atcoder: 0 },
    streakDays: 0,
    achievements: {},
  };
}

function defaultUserPreferences(): UserPreferences {
  return {
    theme: "aurora",
    motion: "system",
    effects: {
      particles: true,
      confetti: true,
      glowCursor: true,
      ambientGradient: true,
      sounds: false,
    },
  };
}

function normalizeDb(raw: any): Db {
  const db: any = raw && typeof raw === "object" ? raw : {};

  if (!Array.isArray(db.users)) db.users = [];
  if (!Array.isArray(db.contests)) db.contests = [];
  if (!Array.isArray(db.rooms)) db.rooms = [];
  if (!Array.isArray(db.roomMessages)) db.roomMessages = [];
  if (!Array.isArray(db.activities)) db.activities = [];

  for (const user of db.users) {
    if (!user || typeof user !== "object") continue;

    if (!user.stats || typeof user.stats !== "object") user.stats = defaultUserStats();
    if (!user.stats.solvedByPlatform || typeof user.stats.solvedByPlatform !== "object") {
      user.stats.solvedByPlatform = { codeforces: 0, atcoder: 0 };
    } else {
      if (typeof user.stats.solvedByPlatform.codeforces !== "number") {
        user.stats.solvedByPlatform.codeforces = 0;
      }
      if (typeof user.stats.solvedByPlatform.atcoder !== "number") {
        user.stats.solvedByPlatform.atcoder = 0;
      }
    }

    if (typeof user.stats.xp !== "number") user.stats.xp = 0;
    if (typeof user.stats.totalSolved !== "number") user.stats.totalSolved = 0;
    if (typeof user.stats.streakDays !== "number") user.stats.streakDays = 0;
    if (!user.stats.achievements || typeof user.stats.achievements !== "object") {
      user.stats.achievements = {};
    }

    if (!user.preferences || typeof user.preferences !== "object") {
      user.preferences = defaultUserPreferences();
    }
    if (!user.preferences.effects || typeof user.preferences.effects !== "object") {
      user.preferences.effects = defaultUserPreferences().effects;
    } else {
      const defaults = defaultUserPreferences().effects;
      for (const key of Object.keys(defaults) as Array<keyof typeof defaults>) {
        if (typeof user.preferences.effects[key] !== "boolean") {
          user.preferences.effects[key] = defaults[key];
        }
      }
    }

    if (user.preferences.theme !== "aurora" && user.preferences.theme !== "sunset" && user.preferences.theme !== "midnight") {
      user.preferences.theme = "aurora";
    }
    if (user.preferences.motion !== "system" && user.preferences.motion !== "on" && user.preferences.motion !== "off") {
      user.preferences.motion = "system";
    }

    if (!Array.isArray(user.favorites)) user.favorites = [];
  }

  return db as Db;
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
}

async function ensureDbFile(filePath: string): Promise<void> {
  await ensureParentDir(filePath);
  try {
    await fsp.access(filePath, fs.constants.F_OK);
  } catch {
    await fsp.writeFile(filePath, JSON.stringify(DefaultDb, null, 2) + "\n", "utf8");
  }
}

async function readJsonFile<T>(filePath: string): Promise<T> {
  const text = await fsp.readFile(filePath, "utf8");
  return JSON.parse(text) as T;
}

async function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  await ensureParentDir(filePath);

  const dir = path.dirname(filePath);
  const tmpPath = path.join(
    dir,
    `${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random()
      .toString(16)
      .slice(2)}.tmp`,
  );
  const payload = JSON.stringify(data, null, 2) + "\n";

  const handle = await fsp.open(tmpPath, "w");
  try {
    await handle.writeFile(payload, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }

  // Best-effort atomic replace across platforms.
  try {
    await fsp.rename(tmpPath, filePath);
  } catch {
    const backupPath = path.join(
      dir,
      `${path.basename(filePath)}.${process.pid}.${Date.now()}.bak`,
    );
    try {
      await fsp.rename(filePath, backupPath);
    } catch {
      // ignore if missing
    }
    await fsp.rename(tmpPath, filePath);
    try {
      await fsp.unlink(backupPath);
    } catch {
      // ignore
    }
  }
}

export function createFileDb({ filePath, logger }: FileDbOptions) {
  let initialized = false;

  const lockOptions = {
    retries: { retries: 100, factor: 1.2, minTimeout: 20, maxTimeout: 2000 },
  } as const;

  async function init(): Promise<void> {
    if (initialized) return;
    await ensureDbFile(filePath);
    initialized = true;
  }

  async function readDb(): Promise<Db> {
    await init();
    const release = await lockfile.lock(filePath, lockOptions);
    try {
      const raw = await readJsonFile<any>(filePath);
      return normalizeDb(raw);
    } finally {
      await release();
    }
  }

  async function updateDb<T>(fn: UpdateFn<T>): Promise<T> {
    await init();
    const release = await lockfile.lock(filePath, lockOptions);
    try {
      const raw = await readJsonFile<any>(filePath);
      const db = normalizeDb(raw);
      const result = await fn(db);
      await writeJsonAtomic(filePath, normalizeDb(db));
      return result;
    } catch (err) {
      logger.error({ err }, "fileDb update failed");
      throw err;
    } finally {
      await release();
    }
  }

  return { readDb, updateDb };
}
