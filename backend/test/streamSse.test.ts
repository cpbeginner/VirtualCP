import fs from "fs/promises";
import os from "os";
import path from "path";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { createCacheService } from "../src/services/cacheService";
import { createFileDb } from "../src/store/fileDb";

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function getCookieFromSetCookie(setCookie: string | null): string {
  if (!setCookie) throw new Error("Missing set-cookie header");
  const m = setCookie.match(/vc_token=[^;]+/);
  if (!m) throw new Error("Missing vc_token in set-cookie");
  return m[0];
}

describe("SSE stream", () => {
  const servers: Array<{ close: () => void }> = [];

  afterEach(() => {
    for (const s of servers) s.close();
    servers.length = 0;
  });

  it("sends an initial hello event", async () => {
    const dbDir = await makeTempDir("virtualcp-stream-db-");
    const cacheDir = await makeTempDir("virtualcp-stream-cache-");
    const dbPath = path.join(dbDir, "db.json");

    const logger = pino({ level: "silent" });
    const fileDb = createFileDb({ filePath: dbPath, logger });
    const cacheService = createCacheService({ cacheDir, logger });
    const app = createApp({ logger, fileDb, cacheService });

    const server = app.listen(0);
    servers.push({ close: () => server.close() });

    await new Promise<void>((resolve) => server.once("listening", resolve));

    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Unexpected listen address");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "streamuser", password: "password123" }),
    });
    const regBody = await regRes.json();
    expect(regRes.ok).toBe(true);
    expect(regBody.ok).toBe(true);
    const cookie = getCookieFromSetCookie(regRes.headers.get("set-cookie"));

    const streamRes = await fetch(`${baseUrl}/api/stream`, {
      method: "GET",
      headers: { Cookie: cookie },
    });
    expect(streamRes.ok).toBe(true);
    expect(streamRes.headers.get("content-type") ?? "").toContain("text/event-stream");

    const reader = streamRes.body!.getReader();
    const { value } = await reader.read();
    await reader.cancel();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: hello");
  });
});

