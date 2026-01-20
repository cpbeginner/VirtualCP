export type Platform = "codeforces" | "atcoder";
export type ContestStatus = "created" | "running" | "finished";

export type AchievementId =
  | "first_solve"
  | "ten_solves"
  | "fifty_solves"
  | "dual_platform"
  | "streak_3"
  | "streak_7"
  | "speedrunner"
  | "room_champion"
  | "collector"
  | "cache_refresher";

export type AchievementDefinition = {
  id: AchievementId;
  title: string;
  description: string;
  rarity: "common" | "rare" | "epic";
};

export type UserPreferences = {
  theme: "aurora" | "sunset" | "midnight";
  motion: "system" | "on" | "off";
  effects: {
    particles: boolean;
    confetti: boolean;
    glowCursor: boolean;
    ambientGradient: boolean;
    sounds: boolean;
  };
};

export type UserStats = {
  xp: number;
  totalSolved: number;
  solvedByPlatform: { codeforces: number; atcoder: number };
  streakDays: number;
  lastActiveDay?: number;
  achievements: Partial<Record<AchievementId, { unlockedAt: number }>>;
};

export type NormalizedProblem = {
  platform: Platform;
  key: string;
  name: string;
  url: string;
  difficulty?: number;
  tags?: string[];
};

export type FavoriteProblem = {
  platform: Platform;
  key: string;
  name: string;
  url: string;
  difficulty?: number;
  tags?: string[];
  savedAt: number;
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

export type RoomStatus = "lobby" | "running" | "finished";

export type RoomMember = {
  userId: string;
  username: string;
  role: "host" | "member";
  joinedAt: number;
};

export type Room = {
  id: string;
  name: string;
  ownerUserId: string;
  inviteCode: string;
  status: RoomStatus;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  durationSeconds: number;
  seed: string;
  problems: NormalizedProblem[];
  members: RoomMember[];
  progressByUserId: Record<string, ContestProgress>;
};

export type RoomMessage = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  t: number;
  text: string;
};

export type ActivityEvent = {
  id: string;
  t: number;
  kind: "contest" | "room" | "solve" | "achievement" | "favorite" | "cache";
  actorUserId: string;
  target: { type: "user" | "contest" | "room"; id: string };
  message: string;
  meta?: any;
};

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  cfHandle?: string;
  atcoderUser?: string;
  createdAt: number;
  stats: UserStats;
  preferences: UserPreferences;
  favorites: FavoriteProblem[];
};

export type Db = {
  users: User[];
  contests: Contest[];
  rooms: Room[];
  roomMessages: RoomMessage[];
  activities: ActivityEvent[];
};
