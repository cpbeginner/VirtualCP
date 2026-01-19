import { apiRequest } from "./client";

export type CfWrappedYear = {
  platform: "codeforces";
  year: number;
  handle: string;
  generatedAt: number;
  range: { start: number; end: number };
  problems: {
    uniqueSolved: number;
    acSubmissions: number;
    activeDays: number;
    longestStreakDays: number;
    firstSolvedAt?: number;
    lastSolvedAt?: number;
    topTags: Array<{ tag: string; count: number }>;
    difficultyCounts: Array<{ rating: number; count: number }>;
    difficultySummary: { min?: number; max?: number; median?: number };
    monthlySolved: Array<{ month: string; count: number }>;
  };
  rating: {
    contests: number;
    start?: number;
    end?: number;
    delta?: number;
    maxGain?: { contestId: number; contestName: string; delta: number; t: number };
    maxDrop?: { contestId: number; contestName: string; delta: number; t: number };
    changes: Array<{
      contestId: number;
      contestName: string;
      t: number;
      oldRating: number;
      newRating: number;
      delta: number;
    }>;
  };
};

export async function apiCfWrapped(
  year: number,
  refresh?: boolean,
): Promise<{ wrapped: CfWrappedYear; warnings: string[] }> {
  const qs = `year=${encodeURIComponent(String(year))}${refresh ? "&refresh=1" : ""}`;
  const res = await apiRequest<{
    ok: true;
    wrapped: CfWrappedYear;
    warnings?: string[];
  }>(`/wrapped/codeforces?${qs}`);
  return { wrapped: res.wrapped, warnings: res.warnings ?? [] };
}

