import { apiRequest } from "./client";

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
  achievements: Record<string, { unlockedAt: number }>;
};

export type LevelInfo = {
  level: number;
  levelStartXp: number;
  nextLevelXp: number;
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

export type ProfileResponse = {
  user: { id: string; username: string; cfHandle?: string; atcoderUser?: string };
  stats: UserStats;
  level: LevelInfo;
  preferences: UserPreferences;
  recentActivity: ActivityEvent[];
};

export type AchievementDefinition = {
  id: string;
  title: string;
  description: string;
  rarity: "common" | "rare" | "epic";
};

export async function apiProfile(): Promise<ProfileResponse> {
  const res = await apiRequest<{ ok: true } & ProfileResponse>("/me/profile");
  return {
    user: res.user,
    stats: res.stats,
    level: res.level,
    preferences: res.preferences,
    recentActivity: res.recentActivity ?? [],
  };
}

export async function apiPatchPreferences(input: Partial<{
  theme: UserPreferences["theme"];
  motion: UserPreferences["motion"];
  effects: Partial<UserPreferences["effects"]>;
}>): Promise<UserPreferences> {
  const res = await apiRequest<{ ok: true; preferences: UserPreferences }>("/me/preferences", {
    method: "PATCH",
    body: input,
  });
  return res.preferences;
}

export async function apiLeaderboard(limit = 20): Promise<
  Array<{ userId: string; username: string; xp: number; level: number; totalSolved: number }>
> {
  const res = await apiRequest<{
    ok: true;
    leaderboard: Array<{ userId: string; username: string; xp: number; level: number; totalSolved: number }>;
  }>(`/leaderboard?limit=${encodeURIComponent(String(limit))}`);
  return res.leaderboard;
}

export async function apiAchievements(): Promise<AchievementDefinition[]> {
  const res = await apiRequest<{ ok: true; achievements: AchievementDefinition[] }>("/achievements");
  return res.achievements;
}

