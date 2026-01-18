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

export type ContestProgress = {
  solved: Record<string, SolvedInfo>;
  lastPoll: {
    cfFrom?: number;
    atFrom?: number;
  };
  lastSync?: {
    codeforces?: number;
    atcoder?: number;
  };
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
  progress: ContestProgress;
};

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  cfHandle?: string;
  atcoderUser?: string;
  createdAt: number;
};

export type Db = {
  users: User[];
  contests: Contest[];
};
