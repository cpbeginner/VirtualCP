import type { Logger } from "pino";
import type { AchievementId, Contest, ContestProgress, Room, SolvedInfo, User } from "../domain/dbTypes";
import { fetchAtcoderUserSubmissions } from "../integrations/atcoderProblems";
import { fetchCodeforcesUserStatus } from "../integrations/codeforces";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import { nowUnixSeconds } from "../utils/time";
import type { createFileDb } from "../store/fileDb";
import { createRealtimeHub } from "./realtimeHub";
import { createStatsService } from "./statsService";
import {
  matchAtcoderSolved,
  matchAtcoderSolvedForProblems,
  matchCodeforcesSolved,
  matchCodeforcesSolvedForProblems,
} from "./submissionMatcher";

type FileDb = ReturnType<typeof createFileDb>;
type StatsService = ReturnType<typeof createStatsService>;
type RealtimeHub = ReturnType<typeof createRealtimeHub>;

function contestHasPlatform(contest: Contest, platform: "codeforces" | "atcoder"): boolean {
  return contest.problems.some((p) => p.platform === platform);
}

function roomHasPlatform(room: Room, platform: "codeforces" | "atcoder"): boolean {
  return room.problems.some((p) => p.platform === platform);
}

function emptyProgress(): ContestProgress {
  return { solved: {}, lastPoll: {}, lastSync: {} };
}

async function pollContestCore(params: {
  contest: Contest;
  user: User;
  logger: Logger;
}): Promise<{
  additions: Record<string, SolvedInfo>;
  polled: { codeforces: boolean; atcoder: boolean };
  lastPollUpdate: { cfFrom?: number; atFrom?: number };
  lastSyncUpdate: { codeforces?: number; atcoder?: number };
}> {
  const { contest, user, logger } = params;

  if (!contest.startedAt) {
    return {
      additions: {},
      polled: { codeforces: false, atcoder: false },
      lastPollUpdate: {},
      lastSyncUpdate: {},
    };
  }

  const startedAt = contest.startedAt;
  const now = nowUnixSeconds();

  const polled = { codeforces: false, atcoder: false };
  const lastPollUpdate: { cfFrom?: number; atFrom?: number } = {};
  const lastSyncUpdate: { codeforces?: number; atcoder?: number } = {};
  const additions: Record<string, SolvedInfo> = {};

  if (contestHasPlatform(contest, "codeforces") && user.cfHandle) {
    try {
      const submissions = await fetchCodeforcesUserStatus(user.cfHandle);
      Object.assign(
        additions,
        matchCodeforcesSolved({ contest, startedAt, submissions }),
      );
      polled.codeforces = true;
      lastPollUpdate.cfFrom = now;
      lastSyncUpdate.codeforces = now;
    } catch (err) {
      logger.warn({ err, contestId: contest.id }, "codeforces poll failed");
    }
  }

  if (contestHasPlatform(contest, "atcoder") && user.atcoderUser) {
    try {
      const requestFrom = contest.progress.lastPoll.atFrom ?? startedAt;
      const overlapSeconds = 120;
      const fromSecond = Math.max(startedAt, requestFrom - overlapSeconds);

      const submissions = await fetchAtcoderUserSubmissions(user.atcoderUser, fromSecond);
      Object.assign(
        additions,
        matchAtcoderSolved({ contest, startedAt, submissions }),
      );
      polled.atcoder = true;
      const maxEpoch = submissions.reduce((m, s) => Math.max(m, s.epoch_second), 0);
      if (submissions.length > 0 && maxEpoch > 0) {
        lastPollUpdate.atFrom = Math.max(requestFrom, maxEpoch + 1);
      } else {
        // Do not advance when empty; AtCoder Problems can lag and later return older submissions.
        lastPollUpdate.atFrom = requestFrom;
      }
      lastSyncUpdate.atcoder = now;
    } catch (err) {
      logger.warn({ err, contestId: contest.id }, "atcoder poll failed");
    }
  }

  return { additions, polled, lastPollUpdate, lastSyncUpdate };
}

async function pollRoomCore(params: {
  room: Room;
  usersById: Record<string, User>;
  logger: Logger;
}): Promise<{
  additionsByUserId: Record<string, Record<string, SolvedInfo>>;
  polled: { codeforces: boolean; atcoder: boolean };
  lastPollUpdateByUserId: Record<string, { cfFrom?: number; atFrom?: number }>;
  lastSyncUpdateByUserId: Record<string, { codeforces?: number; atcoder?: number }>;
}> {
  const { room, usersById, logger } = params;

  if (!room.startedAt) {
    return {
      additionsByUserId: {},
      polled: { codeforces: false, atcoder: false },
      lastPollUpdateByUserId: {},
      lastSyncUpdateByUserId: {},
    };
  }

  const startedAt = room.startedAt;
  const now = nowUnixSeconds();

  const polled = { codeforces: false, atcoder: false };
  const additionsByUserId: Record<string, Record<string, SolvedInfo>> = {};
  const lastPollUpdateByUserId: Record<string, { cfFrom?: number; atFrom?: number }> = {};
  const lastSyncUpdateByUserId: Record<string, { codeforces?: number; atcoder?: number }> = {};

  for (const member of room.members) {
    const user = usersById[member.userId];
    if (!user) continue;

    const progress = room.progressByUserId[member.userId] ?? emptyProgress();
    const existingSolved = progress.solved ?? {};

    const additions: Record<string, SolvedInfo> = {};
    const lastPollUpdate: { cfFrom?: number; atFrom?: number } = {};
    const lastSyncUpdate: { codeforces?: number; atcoder?: number } = {};

    if (roomHasPlatform(room, "codeforces") && user.cfHandle) {
      try {
        const submissions = await fetchCodeforcesUserStatus(user.cfHandle);
        Object.assign(
          additions,
          matchCodeforcesSolvedForProblems({
            problems: room.problems,
            startedAt,
            existingSolved,
            submissions,
          }),
        );
        polled.codeforces = true;
        lastPollUpdate.cfFrom = now;
        lastSyncUpdate.codeforces = now;
      } catch (err) {
        logger.warn({ err, roomId: room.id, userId: user.id }, "codeforces room poll failed");
      }
    }

    if (roomHasPlatform(room, "atcoder") && user.atcoderUser) {
      try {
        const requestFrom = progress.lastPoll.atFrom ?? startedAt;
        const overlapSeconds = 120;
        const fromSecond = Math.max(startedAt, requestFrom - overlapSeconds);

        const submissions = await fetchAtcoderUserSubmissions(user.atcoderUser, fromSecond);
        Object.assign(
          additions,
          matchAtcoderSolvedForProblems({
            problems: room.problems,
            startedAt,
            existingSolved,
            submissions,
          }),
        );
        polled.atcoder = true;
        const maxEpoch = submissions.reduce((m, s) => Math.max(m, s.epoch_second), 0);
        if (submissions.length > 0 && maxEpoch > 0) {
          lastPollUpdate.atFrom = Math.max(requestFrom, maxEpoch + 1);
        } else {
          lastPollUpdate.atFrom = requestFrom;
        }
        lastSyncUpdate.atcoder = now;
      } catch (err) {
        logger.warn({ err, roomId: room.id, userId: user.id }, "atcoder room poll failed");
      }
    }

    additionsByUserId[member.userId] = additions;
    lastPollUpdateByUserId[member.userId] = lastPollUpdate;
    lastSyncUpdateByUserId[member.userId] = lastSyncUpdate;
  }

  return { additionsByUserId, polled, lastPollUpdateByUserId, lastSyncUpdateByUserId };
}

export async function pollContestById(params: {
  fileDb: FileDb;
  logger: Logger;
  ownerUserId: string;
  contestId: string;
}): Promise<{ contest: Contest; polled: { codeforces: boolean; atcoder: boolean } }> {
  const { fileDb, logger, ownerUserId, contestId } = params;

  const snapshot = await fileDb.readDb();
  const contest = snapshot.contests.find((c) => c.id === contestId && c.ownerUserId === ownerUserId);
  if (!contest) throw notFound("Contest not found");
  const user = snapshot.users.find((u) => u.id === contest.ownerUserId);
  if (!user) throw notFound("User not found");
  if (!contest.startedAt) throw badRequest("Contest has not been started");

  const polledResult = await pollContestCore({ contest, user, logger });

  const updated = await fileDb.updateDb((db) => {
    const c = db.contests.find((cc) => cc.id === contestId && cc.ownerUserId === ownerUserId);
    if (!c) throw notFound("Contest not found");
    if (!c.startedAt) throw badRequest("Contest has not been started");

    for (const [key, solved] of Object.entries(polledResult.additions)) {
      if (!c.progress.solved[key]) c.progress.solved[key] = solved;
    }

    if (polledResult.polled.codeforces && polledResult.lastPollUpdate.cfFrom) {
      c.progress.lastPoll.cfFrom = polledResult.lastPollUpdate.cfFrom;
    }
    if (polledResult.polled.atcoder && polledResult.lastPollUpdate.atFrom) {
      c.progress.lastPoll.atFrom = polledResult.lastPollUpdate.atFrom;
    }
    if (polledResult.lastSyncUpdate.codeforces) {
      c.progress.lastSync = c.progress.lastSync ?? {};
      c.progress.lastSync.codeforces = polledResult.lastSyncUpdate.codeforces;
    }
    if (polledResult.lastSyncUpdate.atcoder) {
      c.progress.lastSync = c.progress.lastSync ?? {};
      c.progress.lastSync.atcoder = polledResult.lastSyncUpdate.atcoder;
    }

    return c;
  });

  return { contest: updated, polled: polledResult.polled };
}

export async function pollRoomById(params: {
  fileDb: FileDb;
  logger: Logger;
  statsService: StatsService;
  realtimeHub: RealtimeHub;
  requesterUserId: string;
  roomId: string;
}): Promise<{ room: Room; polled: { codeforces: boolean; atcoder: boolean } }> {
  const { fileDb, logger, statsService, realtimeHub, requesterUserId, roomId } = params;

  const snapshot = await fileDb.readDb();
  const room = snapshot.rooms.find((r) => r.id === roomId);
  if (!room) throw notFound("Room not found");

  const isMember = room.members.some((m) => m.userId === requesterUserId);
  if (!isMember) throw forbidden();
  if (room.status !== "running" || !room.startedAt) throw badRequest("Room is not running");

  const usersById: Record<string, User> = {};
  for (const u of snapshot.users) usersById[u.id] = u;

  const polledResult = await pollRoomCore({ room, usersById, logger });

  const updateResult = await fileDb.updateDb((db) => {
    const r = db.rooms.find((rr) => rr.id === roomId);
    if (!r) throw notFound("Room not found");
    if (r.status !== "running" || !r.startedAt) throw badRequest("Room is not running");

    const problemByKey = new Map(r.problems.map((p) => [p.key, p]));
    const achievementEvents: Array<{
      userId: string;
      achievementId: AchievementId;
      unlockedAt: number;
      xpDelta: number;
      newXp: number;
    }> = [];
    let anyNewSolve = false;

    for (const member of r.members) {
      const userId = member.userId;
      const additions = polledResult.additionsByUserId[userId] ?? {};
      const progress = r.progressByUserId[userId] ?? (r.progressByUserId[userId] = emptyProgress());

      for (const [key, solved] of Object.entries(additions)) {
        if (progress.solved[key]) continue;
        progress.solved[key] = solved;
        anyNewSolve = true;

        const user = db.users.find((u) => u.id === userId);
        if (!user) continue;
        const problem = problemByKey.get(key);
        const result = statsService.applySolve({
          user,
          source: solved.source,
          solvedAt: solved.solvedAt,
          solveTimeSeconds: solved.solveTimeSeconds,
          difficulty: problem?.difficulty,
        });
        for (const achievementId of result.unlocked) {
          achievementEvents.push({
            userId,
            achievementId,
            unlockedAt: user.stats.achievements[achievementId]?.unlockedAt ?? solved.solvedAt,
            xpDelta: result.xpDelta,
            newXp: user.stats.xp,
          });
        }
      }

      const lp = polledResult.lastPollUpdateByUserId[userId];
      if (lp) {
        if (polledResult.polled.codeforces && lp.cfFrom) progress.lastPoll.cfFrom = lp.cfFrom;
        if (polledResult.polled.atcoder && lp.atFrom !== undefined) progress.lastPoll.atFrom = lp.atFrom;
      }

      const ls = polledResult.lastSyncUpdateByUserId[userId];
      if (ls) {
        progress.lastSync = progress.lastSync ?? {};
        if (ls.codeforces) progress.lastSync.codeforces = ls.codeforces;
        if (ls.atcoder) progress.lastSync.atcoder = ls.atcoder;
      }
    }

    return { room: r, memberIds: r.members.map((m) => m.userId), anyNewSolve, achievementEvents };
  });

  if (updateResult.anyNewSolve) {
    realtimeHub.publishToUsers(updateResult.memberIds, "room_update", { roomId, reason: "progress" });
  }
  for (const e of updateResult.achievementEvents) {
    realtimeHub.publishToUser(e.userId, "achievement", {
      achievementId: e.achievementId,
      unlockedAt: e.unlockedAt,
      xpDelta: e.xpDelta,
      newXp: e.newXp,
    });
  }

  return { room: updateResult.room, polled: polledResult.polled };
}

export function createPoller(params: {
  logger: Logger;
  fileDb: FileDb;
  intervalSeconds: number;
  statsService: StatsService;
  realtimeHub: RealtimeHub;
}) {
  const { logger, fileDb, intervalSeconds, statsService, realtimeHub } = params;
  let timer: NodeJS.Timeout | null = null;
  let inFlight = false;

  async function pollAllRunning(): Promise<void> {
    const snapshot = await fileDb.readDb();
    const running = snapshot.contests.filter((c) => c.status === "running" && c.startedAt);

    for (const contest of running) {
      const user = snapshot.users.find((u) => u.id === contest.ownerUserId);
      if (!user) continue;
      try {
        const polledResult = await pollContestCore({ contest, user, logger });
        if (!polledResult.polled.codeforces && !polledResult.polled.atcoder) continue;

        await fileDb.updateDb((db) => {
          const c = db.contests.find((cc) => cc.id === contest.id);
          if (!c) return;
          if (c.status !== "running" || !c.startedAt) return;

          for (const [key, solved] of Object.entries(polledResult.additions)) {
            if (!c.progress.solved[key]) c.progress.solved[key] = solved;
          }
          if (polledResult.polled.codeforces && polledResult.lastPollUpdate.cfFrom) {
            c.progress.lastPoll.cfFrom = polledResult.lastPollUpdate.cfFrom;
          }
          if (polledResult.polled.atcoder && polledResult.lastPollUpdate.atFrom) {
            c.progress.lastPoll.atFrom = polledResult.lastPollUpdate.atFrom;
          }
          if (polledResult.lastSyncUpdate.codeforces) {
            c.progress.lastSync = c.progress.lastSync ?? {};
            c.progress.lastSync.codeforces = polledResult.lastSyncUpdate.codeforces;
          }
          if (polledResult.lastSyncUpdate.atcoder) {
            c.progress.lastSync = c.progress.lastSync ?? {};
            c.progress.lastSync.atcoder = polledResult.lastSyncUpdate.atcoder;
          }
        });
      } catch (err) {
        logger.warn({ err, contestId: contest.id }, "poller tick failed");
      }
    }

    const usersById: Record<string, User> = {};
    for (const u of snapshot.users) usersById[u.id] = u;

    const runningRooms = snapshot.rooms.filter((r) => r.status === "running" && r.startedAt);
    for (const room of runningRooms) {
      try {
        const polledResult = await pollRoomCore({ room, usersById, logger });
        if (!polledResult.polled.codeforces && !polledResult.polled.atcoder) continue;

        const updateResult = await fileDb.updateDb((db) => {
          const r = db.rooms.find((rr) => rr.id === room.id);
          if (!r) return;
          if (r.status !== "running" || !r.startedAt) return;

          const problemByKey = new Map(r.problems.map((p) => [p.key, p]));
          const achievementEvents: Array<{
            userId: string;
            achievementId: AchievementId;
            unlockedAt: number;
            xpDelta: number;
            newXp: number;
          }> = [];
          let anyNewSolve = false;

          for (const member of r.members) {
            const userId = member.userId;
            const additions = polledResult.additionsByUserId[userId] ?? {};
            const progress =
              r.progressByUserId[userId] ?? (r.progressByUserId[userId] = emptyProgress());

            for (const [key, solved] of Object.entries(additions)) {
              if (progress.solved[key]) continue;
              progress.solved[key] = solved;
              anyNewSolve = true;

              const user = db.users.find((u) => u.id === userId);
              if (!user) continue;
              const problem = problemByKey.get(key);
              const result = statsService.applySolve({
                user,
                source: solved.source,
                solvedAt: solved.solvedAt,
                solveTimeSeconds: solved.solveTimeSeconds,
                difficulty: problem?.difficulty,
              });
              for (const achievementId of result.unlocked) {
                achievementEvents.push({
                  userId,
                  achievementId,
                  unlockedAt: user.stats.achievements[achievementId]?.unlockedAt ?? solved.solvedAt,
                  xpDelta: result.xpDelta,
                  newXp: user.stats.xp,
                });
              }
            }

            const lp = polledResult.lastPollUpdateByUserId[userId];
            if (lp) {
              if (polledResult.polled.codeforces && lp.cfFrom) progress.lastPoll.cfFrom = lp.cfFrom;
              if (polledResult.polled.atcoder && lp.atFrom !== undefined) progress.lastPoll.atFrom = lp.atFrom;
            }

            const ls = polledResult.lastSyncUpdateByUserId[userId];
            if (ls) {
              progress.lastSync = progress.lastSync ?? {};
              if (ls.codeforces) progress.lastSync.codeforces = ls.codeforces;
              if (ls.atcoder) progress.lastSync.atcoder = ls.atcoder;
            }
          }

          return { anyNewSolve, memberIds: r.members.map((m) => m.userId), achievementEvents };
        });

        if (updateResult?.anyNewSolve) {
          realtimeHub.publishToUsers(updateResult.memberIds, "room_update", {
            roomId: room.id,
            reason: "progress",
          });
        }
        for (const e of updateResult?.achievementEvents ?? []) {
          realtimeHub.publishToUser(e.userId, "achievement", {
            achievementId: e.achievementId,
            unlockedAt: e.unlockedAt,
            xpDelta: e.xpDelta,
            newXp: e.newXp,
          });
        }
      } catch (err) {
        logger.warn({ err, roomId: room.id }, "poller room tick failed");
      }
    }
  }

  async function tick(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    try {
      await pollAllRunning();
    } finally {
      inFlight = false;
    }
  }

  function start() {
    if (timer) return;
    timer = setInterval(() => {
      void tick();
    }, Math.max(1, intervalSeconds) * 1000);
    void tick();
  }

  function stop() {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  }

  return { start, stop };
}
