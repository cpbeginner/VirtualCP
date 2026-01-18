import { apiRequest } from "./client";

export type Platform = "codeforces" | "atcoder";
export type ContestStatus = "created" | "running" | "finished";

export type NormalizedProblem = {
  platform: Platform;
  key: string;
  name: string;
  url: string;
  difficulty?: number;
  tags?: string[];
};

export type SolvedInfo = {
  solvedAt: number;
  solveTimeSeconds: number;
  source: Platform;
  submissionId: string | number;
};

export type Contest = {
  id: string;
  ownerUserId: string;
  name: string;
  status: ContestStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationSeconds: number;
  seed: string;
  problems: NormalizedProblem[];
  progress: {
    solved: Record<string, SolvedInfo>;
    lastPoll: { cfFrom?: number; atFrom?: number };
    lastSync?: { codeforces?: number; atcoder?: number };
  };
};

export type ProblemSpec = {
  platform: Platform;
  min?: number;
  max?: number;
};

export async function apiCreateContest(input: {
  name: string;
  durationMinutes: number;
  platforms?: { codeforces: boolean; atcoder: boolean };
  count?: number;
  problemSpecs?: ProblemSpec[];
  cfRatingMin?: number;
  cfRatingMax?: number;
  atDifficultyMin?: number;
  atDifficultyMax?: number;
  cfTags?: string[];
  excludeAlreadySolved?: boolean;
  seed?: string;
  startImmediately?: boolean;
}): Promise<Contest> {
  const res = await apiRequest<{ ok: true; contest: Contest }>("/contests", {
    method: "POST",
    body: input,
  });
  return res.contest;
}

export async function apiListContests(): Promise<Contest[]> {
  const res = await apiRequest<{ ok: true; contests: Contest[] }>("/contests");
  return res.contests;
}

export async function apiGetContest(id: string): Promise<Contest> {
  const res = await apiRequest<{ ok: true; contest: Contest }>(`/contests/${encodeURIComponent(id)}`);
  return res.contest;
}

export async function apiStartContest(id: string): Promise<Contest> {
  const res = await apiRequest<{ ok: true; contest: Contest }>(
    `/contests/${encodeURIComponent(id)}/start`,
    { method: "POST", body: {} },
  );
  return res.contest;
}

export async function apiFinishContest(id: string): Promise<Contest> {
  const res = await apiRequest<{ ok: true; contest: Contest }>(
    `/contests/${encodeURIComponent(id)}/finish`,
    { method: "POST", body: {} },
  );
  return res.contest;
}

export async function apiRefreshContest(
  id: string,
): Promise<{ contest: Contest; polled: { codeforces: boolean; atcoder: boolean } }> {
  const res = await apiRequest<{
    ok: true;
    contest: Contest;
    polled: { codeforces: boolean; atcoder: boolean };
  }>(`/contests/${encodeURIComponent(id)}/refresh`, { method: "POST", body: {} });
  return { contest: res.contest, polled: res.polled };
}

export async function apiDeleteContest(id: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/contests/${encodeURIComponent(id)}`, { method: "DELETE", body: {} });
}
