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

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
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

  const username1 = `stress_u1_${Date.now()}`;
  const username2 = `stress_u2_${Date.now()}`;

  async function register(username: string): Promise<string> {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password: "password123",
        cfHandle: "any",
        atcoderUser: "any",
      }),
    });
    const body = await readJson(res);
    if (!res.ok || !body?.ok) {
      throw new Error(`Register failed: ${body?.error ?? res.status}`);
    }
    return getCookieFromSetCookie(res.headers.get("set-cookie"));
  }

  const cookie1 = await register(username1);
  const cookie2 = await register(username2);

  const headers1 = { Cookie: cookie1, "Content-Type": "application/json" };
  const headers2 = { Cookie: cookie2, "Content-Type": "application/json" };

  const wrappedWarmRes = await fetch(`${baseUrl}/api/wrapped/codeforces?year=2023`, {
    method: "GET",
    headers: { Cookie: cookie1 },
  });
  const wrappedWarmBody = await readJson(wrappedWarmRes);
  if (!wrappedWarmRes.ok || !wrappedWarmBody?.ok) {
    throw new Error(`Wrapped warm failed: ${wrappedWarmBody?.error ?? wrappedWarmRes.status}`);
  }

  const cacheRes = await fetch(`${baseUrl}/api/cache/refresh`, {
    method: "POST",
    headers: headers1,
    body: JSON.stringify({}),
  });
  const cacheBody = await readJson(cacheRes);
  if (!cacheRes.ok || !cacheBody?.ok) {
    throw new Error(`Cache refresh failed: ${cacheBody?.error ?? cacheRes.status}`);
  }

  const profileRes = await fetch(`${baseUrl}/api/me/profile`, {
    method: "GET",
    headers: { Cookie: cookie1 },
  });
  const profileBody = await readJson(profileRes);
  if (!profileRes.ok || !profileBody?.ok) {
    throw new Error(`Profile failed: ${profileBody?.error ?? profileRes.status}`);
  }
  if (!profileBody?.stats?.achievements?.cache_refresher) {
    throw new Error("Expected cache_refresher achievement for user1");
  }

  const leaderboardCheckRes = await fetch(`${baseUrl}/api/leaderboard?limit=20`, {
    method: "GET",
    headers: { Cookie: cookie1 },
  });
  const leaderboardCheckBody = await readJson(leaderboardCheckRes);
  if (!leaderboardCheckRes.ok || !leaderboardCheckBody?.ok) {
    throw new Error(
      `Leaderboard failed: ${leaderboardCheckBody?.error ?? leaderboardCheckRes.status}`,
    );
  }

  const contestRes = await fetch(`${baseUrl}/api/contests`, {
    method: "POST",
    headers: headers1,
    body: JSON.stringify({
      name: "Stress contest",
      durationMinutes: 120,
      platforms: { codeforces: true, atcoder: true },
      count: 4,
      startImmediately: true,
    }),
  });
  const contestBody = await readJson(contestRes);
  if (!contestRes.ok || !contestBody?.ok) {
    throw new Error(`Contest create failed: ${contestBody?.error ?? contestRes.status}`);
  }
  const contestId = contestBody.contest.id as string;

  const roomRes = await fetch(`${baseUrl}/api/rooms`, {
    method: "POST",
    headers: headers1,
    body: JSON.stringify({
      name: "Stress room",
      durationMinutes: 90,
      platforms: { codeforces: true, atcoder: true },
      count: 3,
      startImmediately: false,
    }),
  });
  const roomBody = await readJson(roomRes);
  if (!roomRes.ok || !roomBody?.ok) {
    throw new Error(`Room create failed: ${roomBody?.error ?? roomRes.status}`);
  }
  const roomId = roomBody.room.id as string;
  const inviteCode = roomBody.room.inviteCode as string;
  if (!inviteCode) throw new Error("Missing inviteCode for created room");

  const joinRes = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    headers: headers2,
    body: JSON.stringify({ inviteCode }),
  });
  const joinBody = await readJson(joinRes);
  if (!joinRes.ok || !joinBody?.ok) {
    throw new Error(`Room join failed: ${joinBody?.error ?? joinRes.status}`);
  }

  const startRoomRes = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/start`, {
    method: "POST",
    headers: headers1,
    body: "{}",
  });
  const startRoomBody = await readJson(startRoomRes);
  if (!startRoomRes.ok || !startRoomBody?.ok) {
    throw new Error(`Room start failed: ${startRoomBody?.error ?? startRoomRes.status}`);
  }

  const refreshRoomRes = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/refresh`, {
    method: "POST",
    headers: headers1,
    body: "{}",
  });
  const refreshRoomBody = await readJson(refreshRoomRes);
  if (!refreshRoomRes.ok || !refreshRoomBody?.ok) {
    throw new Error(`Room refresh failed: ${refreshRoomBody?.error ?? refreshRoomRes.status}`);
  }

  const msg1Res = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "POST",
    headers: headers1,
    body: JSON.stringify({ text: "hello from user1" }),
  });
  const msg1Body = await readJson(msg1Res);
  if (!msg1Res.ok || !msg1Body?.ok) {
    throw new Error(`Room message (user1) failed: ${msg1Body?.error ?? msg1Res.status}`);
  }

  const msg2Res = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "POST",
    headers: headers2,
    body: JSON.stringify({ text: "hello from user2" }),
  });
  const msg2Body = await readJson(msg2Res);
  if (!msg2Res.ok || !msg2Body?.ok) {
    throw new Error(`Room message (user2) failed: ${msg2Body?.error ?? msg2Res.status}`);
  }

  const searchRes = await fetch(
    `${baseUrl}/api/problems/search?platform=codeforces&limit=5`,
    { method: "GET", headers: { Cookie: cookie1 } },
  );
  const searchBody = await readJson(searchRes);
  if (!searchRes.ok || !searchBody?.ok) {
    throw new Error(`Problems search failed: ${searchBody?.error ?? searchRes.status}`);
  }
  const firstProblem = (searchBody.results as any[])?.[0];
  if (!firstProblem?.platform || !firstProblem?.key) {
    throw new Error("No problems returned by search for favorites test");
  }

  const favAddRes = await fetch(`${baseUrl}/api/me/favorites`, {
    method: "POST",
    headers: headers1,
    body: JSON.stringify({ platform: firstProblem.platform, key: firstProblem.key }),
  });
  const favAddBody = await readJson(favAddRes);
  if (!favAddRes.ok || !favAddBody?.ok) {
    throw new Error(`Favorite add failed: ${favAddBody?.error ?? favAddRes.status}`);
  }

  const favListRes = await fetch(`${baseUrl}/api/me/favorites`, {
    method: "GET",
    headers: { Cookie: cookie1 },
  });
  const favListBody = await readJson(favListRes);
  if (!favListRes.ok || !favListBody?.ok) {
    throw new Error(`Favorites list failed: ${favListBody?.error ?? favListRes.status}`);
  }

  const favDelRes = await fetch(
    `${baseUrl}/api/me/favorites/${encodeURIComponent(firstProblem.platform)}/${encodeURIComponent(
      firstProblem.key,
    )}`,
    { method: "DELETE", headers: { Cookie: cookie1 } },
  );
  const favDelBody = await readJson(favDelRes);
  if (!favDelRes.ok || !favDelBody?.ok) {
    throw new Error(`Favorite delete failed: ${favDelBody?.error ?? favDelRes.status}`);
  }

  console.log(
    `[stress] baseUrl=${baseUrl} users=${username1},${username2} contest=${contestId} room=${roomId}`,
  );

  const durationSeconds = 12;
  const connections = 18;

  const results: autocannon.Result[] = [];

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/contests`,
      method: "GET",
      headers: { Cookie: cookie1 },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/contests/${contestId}`,
      method: "GET",
      headers: { Cookie: cookie1 },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/contests/${contestId}/refresh`,
      method: "POST",
      headers: headers1,
      body: "{}",
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/wrapped/codeforces?year=2023`,
      method: "GET",
      headers: { Cookie: cookie1 },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/rooms`,
      method: "GET",
      headers: { Cookie: cookie1 },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/rooms/${roomId}`,
      method: "GET",
      headers: { Cookie: cookie1 },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/rooms/${roomId}/refresh`,
      method: "POST",
      headers: headers1,
      body: "{}",
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/leaderboard?limit=20`,
      method: "GET",
      headers: { Cookie: cookie1 },
      connections,
      duration: durationSeconds,
    }),
  );

  results.push(
    await runAutocannon({
      url: `${baseUrl}/api/problems/search?platform=codeforces&limit=20`,
      method: "GET",
      headers: { Cookie: cookie1 },
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

  for (const k of ["users", "contests", "rooms", "roomMessages", "activities"]) {
    if (!Array.isArray(parsed[k])) throw new Error(`db.json missing array key: ${k}`);
  }

  const contest = (parsed.contests as any[]).find((c) => c.id === contestId);
  if (!contest) throw new Error("Contest not found in db.json after stress");
  const room = (parsed.rooms as any[]).find((r) => r.id === roomId);
  if (!room) throw new Error("Room not found in db.json after stress");

  console.log("[stress] db.json valid and contest/room readable");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
