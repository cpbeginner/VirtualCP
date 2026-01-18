import autocannon from "autocannon";
import fs from "fs/promises";
import path from "path";
import pino from "pino";

async function runAutocannon(opts: autocannon.Options): Promise<autocannon.Result> {
  return await new Promise((resolve, reject) => {
    autocannon(opts, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function getCookieFromSetCookie(setCookie: string | null): string {
  if (!setCookie) throw new Error("Missing set-cookie header");
  const m = setCookie.match(/vc_token=[^;]+/);
  if (!m) throw new Error("Missing vc_token in set-cookie");
  return m[0];
}

async function main() {
  process.env.MOCK_OJ = "1";
  process.env.JWT_SECRET ??= "stress_secret";
  process.env.POLL_INTERVAL_SECONDS ??= "9999";

  const { createApp } = await import("../src/app");

  const app = createApp({ logger: pino({ level: "silent" }) });
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Unexpected listen address");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const username = `stress_${Date.now()}`;

  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password: "password123",
      cfHandle: "any",
      atcoderUser: "any",
    }),
  });
  const regBody = await regRes.json();
  if (!regRes.ok || !regBody.ok) throw new Error(`Register failed: ${regBody?.error ?? regRes.status}`);
  const cookie = getCookieFromSetCookie(regRes.headers.get("set-cookie"));

  const authHeaders = {
    Cookie: cookie,
    "Content-Type": "application/json",
  };

  const cacheRes = await fetch(`${baseUrl}/api/cache/refresh`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({}),
  });
  const cacheBody = await cacheRes.json();
  if (!cacheRes.ok || !cacheBody.ok) {
    throw new Error(`Cache refresh failed: ${cacheBody?.error ?? cacheRes.status}`);
  }

  const contestRes = await fetch(`${baseUrl}/api/contests`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      name: "Stress contest",
      durationMinutes: 120,
      platforms: { codeforces: true, atcoder: true },
      count: 4,
      startImmediately: true,
    }),
  });
  const contestBody = await contestRes.json();
  if (!contestRes.ok || !contestBody.ok) {
    throw new Error(`Contest create failed: ${contestBody?.error ?? contestRes.status}`);
  }
  const contestId = contestBody.contest.id as string;

  console.log(`[stress] baseUrl=${baseUrl} user=${username} contest=${contestId}`);

  const durationSeconds = 15;
  const connections = 20;

  const results: autocannon.Result[] = [];

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/contests`,
      method: "GET",
      headers: { Cookie: cookie },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/contests/${contestId}`,
      method: "GET",
      headers: { Cookie: cookie },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/contests/${contestId}/refresh`,
      method: "POST",
      headers: authHeaders,
      body: "{}",
      connections,
      duration: durationSeconds,
    }),
  );

  server.close();

  for (const r of results) {
    console.log(
      `[stress] ${r.url} req/s=${Math.round(r.requests.average)} p99=${Math.round(r.latency.p99)}ms`,
    );
  }

  const dbPath = path.join(process.cwd(), "data", "db.json");
  const raw = await fs.readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw) as any;
  const contest = (parsed.contests as any[]).find((c) => c.id === contestId);
  if (!contest) throw new Error("Contest not found in db.json after stress");

  console.log("[stress] db.json valid and contest readable");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
