import type { Logger } from "pino";
import type { Contest, SolvedInfo, User } from "../domain/dbTypes";
import { fetchAtcoderUserSubmissions } from "../integrations/atcoderProblems";
import { fetchCodeforcesUserStatus } from "../integrations/codeforces";
import { badRequest, notFound } from "../middleware/errorHandler";
import { nowUnixSeconds } from "../utils/time";
import type { createFileDb } from "../store/fileDb";
import { matchAtcoderSolved, matchCodeforcesSolved } from "./submissionMatcher";

type FileDb = ReturnType<typeof createFileDb>;

function contestHasPlatform(contest: Contest, platform: "codeforces" | "atcoder"): boolean {
  return contest.problems.some((p) => p.platform === platform);
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

export function createPoller(params: {
  logger: Logger;
  fileDb: FileDb;
  intervalSeconds: number;
}) {
  const { logger, fileDb, intervalSeconds } = params;
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
