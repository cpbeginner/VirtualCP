export type CfProblem = {
  contestId: number;
  index: string;
  name: string;
  rating?: number;
  tags: string[];
};

export type CfProblemsetResponse = {
  status: string;
  result: {
    problems: Array<{
      contestId?: number;
      index: string;
      name: string;
      rating?: number;
      tags: string[];
    }>;
  };
};

export type CfUserStatusResponse = {
  status: string;
  result: Array<{
    id: number;
    creationTimeSeconds: number;
    verdict?: string;
    problem: {
      contestId?: number;
      index: string;
    };
  }>;
};

import fs from "fs/promises";
import path from "path";
import { env } from "../env";
import { Throttler } from "../utils/throttle";
import { fetchJson } from "../utils/http";

const CF_BASE = "https://codeforces.com/api";
const cfThrottle = new Throttler(env.MOCK_OJ ? 0 : 2100);

async function readFixtureJson<T>(fileName: string): Promise<T> {
  const p = path.join(env.FIXTURES_DIR, fileName);
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as T;
}

async function cfGetJson<T>(url: string): Promise<T> {
  return await cfThrottle.schedule(async () => {
    return await fetchJson<T>(url, {
      timeoutMs: 15000,
      headers: { "User-Agent": "VirtualCP/1.0" },
    });
  });
}

export async function fetchCodeforcesProblemset(): Promise<CfProblem[]> {
  const data = env.MOCK_OJ
    ? await readFixtureJson<CfProblemsetResponse>("codeforces_problemset.problems.json")
    : await cfGetJson<CfProblemsetResponse>(`${CF_BASE}/problemset.problems`);

  if (data.status !== "OK") throw new Error("Codeforces problemset.problems failed");

  return data.result.problems
    .filter((p) => typeof p.contestId === "number")
    .map((p) => ({
      contestId: p.contestId as number,
      index: p.index,
      name: p.name,
      rating: p.rating,
      tags: p.tags ?? [],
    }));
}

export async function fetchCodeforcesUserStatus(handle: string): Promise<CfUserStatusResponse["result"]> {
  const data = env.MOCK_OJ
    ? await readFixtureJson<CfUserStatusResponse>("codeforces_user.status.json")
    : await cfGetJson<CfUserStatusResponse>(
        `${CF_BASE}/user.status?handle=${encodeURIComponent(handle)}`,
      );

  if (data.status !== "OK") throw new Error("Codeforces user.status failed");
  return data.result;
}

export type CfUserRatingResponse = {
  status: string;
  result: Array<{
    contestId: number;
    contestName: string;
    handle: string;
    rank: number;
    ratingUpdateTimeSeconds: number;
    oldRating: number;
    newRating: number;
  }>;
};

export async function fetchCodeforcesUserRating(
  handle: string,
): Promise<CfUserRatingResponse["result"]> {
  const data = env.MOCK_OJ
    ? await readFixtureJson<CfUserRatingResponse>("codeforces_user.rating.json")
    : await cfGetJson<CfUserRatingResponse>(
        `${CF_BASE}/user.rating?handle=${encodeURIComponent(handle)}`,
      );

  if (data.status !== "OK") throw new Error("Codeforces user.rating failed");
  return data.result;
}
