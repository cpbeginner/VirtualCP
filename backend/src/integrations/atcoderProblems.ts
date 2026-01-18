export type AtMergedProblem = {
  id: string;
  contest_id: string;
  problem_index: string;
  name: string;
  title?: string;
};

export type AtProblemModels = Record<
  string,
  {
    difficulty?: number;
  }
>;

export type AtSubmission = {
  id: number;
  epoch_second: number;
  problem_id: string;
  result: string;
};

import fs from "fs/promises";
import path from "path";
import { env } from "../env";
import { Throttler } from "../utils/throttle";
import { fetchJson } from "../utils/http";

const atThrottle = new Throttler(env.MOCK_OJ ? 0 : 1100);

async function readFixtureJson<T>(fileName: string): Promise<T> {
  const p = path.join(env.FIXTURES_DIR, fileName);
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as T;
}

async function atGetJson<T>(url: string): Promise<T> {
  return await atThrottle.schedule(async () => {
    return await fetchJson<T>(url, {
      timeoutMs: 15000,
      headers: { "User-Agent": "VirtualCP/1.0" },
    });
  });
}

export async function fetchAtcoderMergedProblems(): Promise<AtMergedProblem[]> {
  return env.MOCK_OJ
    ? await readFixtureJson<AtMergedProblem[]>("atcoder_merged_problems.json")
    : await atGetJson<AtMergedProblem[]>(
        "https://kenkoooo.com/atcoder/resources/merged-problems.json",
      );
}

export async function fetchAtcoderProblemModels(): Promise<AtProblemModels> {
  return env.MOCK_OJ
    ? await readFixtureJson<AtProblemModels>("atcoder_problem_models.json")
    : await atGetJson<AtProblemModels>(
        "https://kenkoooo.com/atcoder/resources/problem-models.json",
      );
}

export async function fetchAtcoderUserSubmissions(
  userId: string,
  fromSecond: number,
): Promise<AtSubmission[]> {
  const url = `https://kenkoooo.com/atcoder/atcoder-api/v3/user/submissions?user=${encodeURIComponent(
    userId,
  )}&from_second=${encodeURIComponent(String(fromSecond))}`;

  return env.MOCK_OJ
    ? await readFixtureJson<AtSubmission[]>("atcoder_user_submissions.json")
    : await atGetJson<AtSubmission[]>(url);
}

export type AtUserHistoryEntry = {
  IsRated?: boolean;
  EndTime?: string | number;
  NewRating?: number;
  OldRating?: number;
  Performance?: number;
  ContestName?: string;
};

export async function fetchAtcoderUserHistory(userId: string): Promise<AtUserHistoryEntry[]> {
  const url = `https://atcoder.jp/users/${encodeURIComponent(userId)}/history/json`;
  return env.MOCK_OJ
    ? await readFixtureJson<AtUserHistoryEntry[]>("atcoder_user_history.json")
    : await atGetJson<AtUserHistoryEntry[]>(url);
}
