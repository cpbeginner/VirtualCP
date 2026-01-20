import type { Logger } from "pino";
import type { AchievementDefinition, AchievementId, Db, Platform, User } from "../domain/dbTypes";

type LevelInfo = { level: number; levelStartXp: number; nextLevelXp: number };

type ApplySolveParams = {
  user: User;
  source: Platform;
  solvedAt: number;
  solveTimeSeconds: number;
  difficulty?: number;
};

type ApplyResult = { xpDelta: number; unlocked: AchievementId[] };

function utcDayId(unixSeconds: number): number {
  return Math.floor(unixSeconds / 86400);
}

export function createStatsService(opts: { logger: Logger }) {
  const { logger } = opts;

  function levelForXp(xp: number): LevelInfo {
    const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
    const level = Math.floor(Math.sqrt(safeXp / 250)) + 1;
    const levelStartXp = (level - 1) * (level - 1) * 250;
    const nextLevelXp = level * level * 250;
    return { level, levelStartXp, nextLevelXp };
  }

  function getAchievementCatalog(): AchievementDefinition[] {
    return [
      {
        id: "first_solve",
        title: "First Solve",
        description: "Solve your first problem",
        rarity: "common",
      },
      {
        id: "ten_solves",
        title: "Ten Solves",
        description: "Solve 10 problems",
        rarity: "common",
      },
      {
        id: "fifty_solves",
        title: "Fifty Solves",
        description: "Solve 50 problems",
        rarity: "rare",
      },
      {
        id: "dual_platform",
        title: "Dual Platform",
        description: "Solve problems on both Codeforces and AtCoder",
        rarity: "rare",
      },
      {
        id: "streak_3",
        title: "3-Day Streak",
        description: "Be active 3 days in a row",
        rarity: "common",
      },
      {
        id: "streak_7",
        title: "7-Day Streak",
        description: "Be active 7 days in a row",
        rarity: "epic",
      },
      {
        id: "speedrunner",
        title: "Speedrunner",
        description: "Solve a problem in 3 minutes or less",
        rarity: "rare",
      },
      {
        id: "room_champion",
        title: "Room Champion",
        description: "Finish 1st on a room scoreboard",
        rarity: "epic",
      },
      {
        id: "collector",
        title: "Collector",
        description: "Save 20 problems to favorites",
        rarity: "rare",
      },
      {
        id: "cache_refresher",
        title: "Cache Refresher",
        description: "Refresh the problem cache",
        rarity: "common",
      },
    ];
  }

  function unlockAchievement(
    user: User,
    id: AchievementId,
    unlockedAt: number,
  ): boolean {
    if (!user.stats.achievements) user.stats.achievements = {};
    if (user.stats.achievements[id]) return false;
    user.stats.achievements[id] = { unlockedAt };
    return true;
  }

  function applySolve(params: ApplySolveParams): ApplyResult {
    const { user, source, solvedAt, solveTimeSeconds, difficulty } = params;

    const base = 10;
    const difficultyBonus = typeof difficulty === "number" ? Math.round(difficulty / 100) : 0;
    const speedBonus = solveTimeSeconds <= 180 ? 15 : solveTimeSeconds <= 600 ? 5 : 0;
    const xpDelta = base + difficultyBonus + speedBonus;

    user.stats.xp += xpDelta;
    user.stats.totalSolved += 1;
    if (source === "codeforces") user.stats.solvedByPlatform.codeforces += 1;
    if (source === "atcoder") user.stats.solvedByPlatform.atcoder += 1;

    const dayId = utcDayId(solvedAt);
    if (user.stats.lastActiveDay === undefined) {
      user.stats.lastActiveDay = dayId;
      user.stats.streakDays = 1;
    } else if (dayId > user.stats.lastActiveDay) {
      const diff = dayId - user.stats.lastActiveDay;
      user.stats.lastActiveDay = dayId;
      if (diff === 1) user.stats.streakDays += 1;
      else user.stats.streakDays = 1;
    }

    const unlocked: AchievementId[] = [];

    try {
      if (user.stats.totalSolved === 1) {
        if (unlockAchievement(user, "first_solve", solvedAt)) unlocked.push("first_solve");
      }
      if (user.stats.totalSolved >= 10) {
        if (unlockAchievement(user, "ten_solves", solvedAt)) unlocked.push("ten_solves");
      }
      if (user.stats.totalSolved >= 50) {
        if (unlockAchievement(user, "fifty_solves", solvedAt)) unlocked.push("fifty_solves");
      }
      if (user.stats.solvedByPlatform.codeforces > 0 && user.stats.solvedByPlatform.atcoder > 0) {
        if (unlockAchievement(user, "dual_platform", solvedAt)) unlocked.push("dual_platform");
      }
      if (user.stats.streakDays >= 3) {
        if (unlockAchievement(user, "streak_3", solvedAt)) unlocked.push("streak_3");
      }
      if (user.stats.streakDays >= 7) {
        if (unlockAchievement(user, "streak_7", solvedAt)) unlocked.push("streak_7");
      }
      if (solveTimeSeconds <= 180) {
        if (unlockAchievement(user, "speedrunner", solvedAt)) unlocked.push("speedrunner");
      }
    } catch (err) {
      logger.warn({ err }, "statsService applySolve achievement check failed");
    }

    return { xpDelta, unlocked };
  }

  function applyFavoriteAdded(user: User, unlockedAt: number): AchievementId[] {
    if (user.favorites.length < 20) return [];
    const unlocked: AchievementId[] = [];
    if (unlockAchievement(user, "collector", unlockedAt)) unlocked.push("collector");
    return unlocked;
  }

  function applyCacheRefreshed(user: User, unlockedAt: number): AchievementId[] {
    const unlocked: AchievementId[] = [];
    if (unlockAchievement(user, "cache_refresher", unlockedAt)) unlocked.push("cache_refresher");
    return unlocked;
  }

  function computeLeaderboard(db: Db, limit: number): Array<{
    userId: string;
    username: string;
    xp: number;
    level: number;
    totalSolved: number;
  }> {
    const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
    return [...db.users]
      .map((u) => {
        const xp = u.stats?.xp ?? 0;
        const level = levelForXp(xp).level;
        return {
          userId: u.id,
          username: u.username,
          xp,
          level,
          totalSolved: u.stats?.totalSolved ?? 0,
        };
      })
      .sort((a, b) => b.xp - a.xp || a.username.localeCompare(b.username) || a.userId.localeCompare(b.userId))
      .slice(0, safeLimit);
  }

  return {
    levelForXp,
    getAchievementCatalog,
    applySolve,
    applyFavoriteAdded,
    applyCacheRefreshed,
    computeLeaderboard,
  };
}

