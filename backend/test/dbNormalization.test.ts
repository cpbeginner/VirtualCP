import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "virtualcp-db-normalize-"));
}

describe("fileDb normalizeDb", () => {
  it("persists new top-level keys for legacy db files", async () => {
    const dir = await makeTempDir();
    const dbPath = path.join(dir, "db.json");
    await fs.writeFile(dbPath, JSON.stringify({ users: [], contests: [] }, null, 2) + "\n", "utf8");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });

    const db = await fileDb.readDb();
    expect(Array.isArray(db.rooms)).toBe(true);
    expect(Array.isArray(db.roomMessages)).toBe(true);
    expect(Array.isArray(db.activities)).toBe(true);

    await fileDb.updateDb(() => {});

    const rawText = await fs.readFile(dbPath, "utf8");
    const parsed = JSON.parse(rawText) as Record<string, unknown>;
    expect(Array.isArray(parsed.rooms)).toBe(true);
    expect(Array.isArray(parsed.roomMessages)).toBe(true);
    expect(Array.isArray(parsed.activities)).toBe(true);
  });
});

