import type { Contest, SolvedInfo } from "../domain/dbTypes";
import type { AtSubmission } from "../integrations/atcoderProblems";
import type { CfUserStatusResponse } from "../integrations/codeforces";

export function matchCodeforcesSolved(params: {
  contest: Contest;
  startedAt: number;
  submissions: CfUserStatusResponse["result"];
}): Record<string, SolvedInfo> {
  const { contest, startedAt } = params;
  const keys = new Set(contest.problems.filter((p) => p.platform === "codeforces").map((p) => p.key));
  const existing = contest.progress.solved ?? {};

  const submissions = [...params.submissions].sort(
    (a, b) => a.creationTimeSeconds - b.creationTimeSeconds,
  );

  const additions: Record<string, SolvedInfo> = {};

  for (const s of submissions) {
    if (s.verdict !== "OK") continue;
    if (s.creationTimeSeconds < startedAt) continue;
    if (s.problem.contestId === undefined) continue;
    const key = `${s.problem.contestId}${s.problem.index}`;
    if (!keys.has(key)) continue;
    if (existing[key] || additions[key]) continue;

    const solvedAt = s.creationTimeSeconds;
    additions[key] = {
      solvedAt,
      solveTimeSeconds: solvedAt - startedAt,
      source: "codeforces",
      submissionId: s.id,
    };
  }

  return additions;
}

export function matchAtcoderSolved(params: {
  contest: Contest;
  startedAt: number;
  submissions: AtSubmission[];
}): Record<string, SolvedInfo> {
  const { contest, startedAt } = params;
  const keys = new Set(contest.problems.filter((p) => p.platform === "atcoder").map((p) => p.key));
  const existing = contest.progress.solved ?? {};

  const submissions = [...params.submissions].sort((a, b) => a.epoch_second - b.epoch_second);

  const additions: Record<string, SolvedInfo> = {};

  for (const s of submissions) {
    if (s.result !== "AC") continue;
    if (s.epoch_second < startedAt) continue;
    const key = s.problem_id;
    if (!keys.has(key)) continue;
    if (existing[key] || additions[key]) continue;

    const solvedAt = s.epoch_second;
    additions[key] = {
      solvedAt,
      solveTimeSeconds: solvedAt - startedAt,
      source: "atcoder",
      submissionId: s.id,
    };
  }

  return additions;
}
