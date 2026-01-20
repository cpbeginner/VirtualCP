import type { Contest, NormalizedProblem, SolvedInfo } from "../domain/dbTypes";
import type { AtSubmission } from "../integrations/atcoderProblems";
import type { CfUserStatusResponse } from "../integrations/codeforces";

export function matchCodeforcesSolvedForProblems(params: {
  problems: NormalizedProblem[];
  startedAt: number;
  existingSolved: Record<string, SolvedInfo>;
  submissions: CfUserStatusResponse["result"];
}): Record<string, SolvedInfo> {
  const { startedAt } = params;
  const keys = new Set(params.problems.filter((p) => p.platform === "codeforces").map((p) => p.key));
  const existing = params.existingSolved ?? {};

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

export function matchAtcoderSolvedForProblems(params: {
  problems: NormalizedProblem[];
  startedAt: number;
  existingSolved: Record<string, SolvedInfo>;
  submissions: AtSubmission[];
}): Record<string, SolvedInfo> {
  const { startedAt } = params;
  const keys = new Set(params.problems.filter((p) => p.platform === "atcoder").map((p) => p.key));
  const existing = params.existingSolved ?? {};

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

export function matchCodeforcesSolved(params: {
  contest: Contest;
  startedAt: number;
  submissions: CfUserStatusResponse["result"];
}): Record<string, SolvedInfo> {
  return matchCodeforcesSolvedForProblems({
    problems: params.contest.problems,
    startedAt: params.startedAt,
    existingSolved: params.contest.progress.solved ?? {},
    submissions: params.submissions,
  });
}

export function matchAtcoderSolved(params: {
  contest: Contest;
  startedAt: number;
  submissions: AtSubmission[];
}): Record<string, SolvedInfo> {
  return matchAtcoderSolvedForProblems({
    problems: params.contest.problems,
    startedAt: params.startedAt,
    existingSolved: params.contest.progress.solved ?? {},
    submissions: params.submissions,
  });
}
