import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "virtucontest-filedb-"));
}

describe("fileDb", () => {
  it("serializes concurrent updates without corrupting JSON", async () => {
    const dir = await makeTempDir();
    const dbPath = path.join(dir, "db.json");
    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });

    const updates = Array.from({ length: 10 }, (_, i) =>
      fileDb.updateDb((db) => {
        db.users.push({
          id: String(i),
          username: `u${i}`,
          passwordHash: "x",
          createdAt: i,
        });
      }),
    );

    await Promise.all(updates);

    const raw = await fs.readFile(dbPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();

    const parsed = JSON.parse(raw) as { users: Array<{ id: string }> };
    expect(parsed.users).toHaveLength(10);
  }, 20000);
});
