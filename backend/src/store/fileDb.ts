import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import lockfile from "proper-lockfile";
import type { Logger } from "pino";
import type { Db } from "../domain/dbTypes";

type FileDbOptions = {
  filePath: string;
  logger: Logger;
};

type UpdateFn<T> = (db: Db) => Promise<T> | T;

const DefaultDb: Db = { users: [], contests: [] };

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
      const db = await readJsonFile<Db>(filePath);
      return db;
    } finally {
      await release();
    }
  }

  async function updateDb<T>(fn: UpdateFn<T>): Promise<T> {
    await init();
    const release = await lockfile.lock(filePath, lockOptions);
    try {
      const db = await readJsonFile<Db>(filePath);
      const result = await fn(db);
      await writeJsonAtomic(filePath, db);
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
