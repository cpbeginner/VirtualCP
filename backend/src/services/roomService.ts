import crypto from "crypto";
import type { Logger } from "pino";
import type { AtMergedProblem, AtProblemModels } from "../integrations/atcoderProblems";
import type { CfProblem } from "../integrations/codeforces";
import type { ContestProgress, NormalizedProblem, Platform, Room } from "../domain/dbTypes";
import { fetchAtcoderUserSubmissions } from "../integrations/atcoderProblems";
import { fetchCodeforcesUserStatus } from "../integrations/codeforces";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import { newId } from "../utils/ids";
import { createSeededRng, seededShuffle } from "../utils/seededRng";
import { nowUnixSeconds } from "../utils/time";
import { createCacheService } from "./cacheService";
import { createFileDb } from "../store/fileDb";

type FileDb = ReturnType<typeof createFileDb>;
type CacheService = ReturnType<typeof createCacheService>;

export type ProblemSpec = {
  platform: Platform;
  min?: number;
  max?: number;
};

export type CreateRoomInput = {
  ownerUserId: string;
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
};

const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (const b of bytes) out += INVITE_ALPHABET[b & 31];
  return out;
}

function emptyProgress(): ContestProgress {
  return { solved: {}, lastPoll: {}, lastSync: {} };
}

export function createRoomService(opts: { fileDb: FileDb; cacheService: CacheService; logger: Logger }) {
  const { fileDb, cacheService } = opts;

  async function fetchAtcoderSolvedSet(userId: string): Promise<Set<string>> {
    const solved = new Set<string>();
    let fromSecond = 0;
    let pages = 0;

    while (pages < 30) {
      const subs = await fetchAtcoderUserSubmissions(userId, fromSecond);
      if (subs.length === 0) break;

      let maxEpoch = 0;
      for (const s of subs) {
        if (s.result === "AC") solved.add(s.problem_id);
        if (s.epoch_second > maxEpoch) maxEpoch = s.epoch_second;
      }

      if (subs.length < 500) break;
      if (maxEpoch <= fromSecond) break;
      fromSecond = maxEpoch + 1;
      pages += 1;
    }

    return solved;
  }

  async function buildBasePool(params: {
    includeCodeforces: boolean;
    includeAtcoder: boolean;
    cfTags?: string[];
  }): Promise<NormalizedProblem[]> {
    const candidates: NormalizedProblem[] = [];

    if (params.includeCodeforces) {
      const cfProblems = await cacheService.loadCodeforcesProblemset<CfProblem[]>();
      const tags = (params.cfTags ?? []).map((t) => t.trim()).filter(Boolean);
      const tagsSet = new Set(tags);

      for (const p of cfProblems) {
        if (tagsSet.size > 0 && !(p.tags ?? []).some((t) => tagsSet.has(t))) continue;

        const key = `${p.contestId}${p.index}`;
        candidates.push({
          platform: "codeforces",
          key,
          name: p.name,
          url: `https://codeforces.com/contest/${p.contestId}/problem/${p.index}`,
          difficulty: p.rating,
          tags: p.tags ?? [],
        });
      }
    }

    if (params.includeAtcoder) {
      const merged = await cacheService.loadAtcoderMergedProblems<AtMergedProblem[]>();
      const models = await cacheService.loadAtcoderProblemModels<AtProblemModels>();

      for (const p of merged) {
        const model = models[p.id];
        const difficulty = model?.difficulty;

        candidates.push({
          platform: "atcoder",
          key: p.id,
          name: p.title ?? p.name,
          url: `https://atcoder.jp/contests/${p.contest_id}/tasks/${p.id}`,
          difficulty,
        });
      }
    }

    return candidates.sort((a, b) => a.key.localeCompare(b.key));
  }

  function filterByLegacyRanges(pool: NormalizedProblem[], input: CreateRoomInput): NormalizedProblem[] {
    return pool.filter((p) => {
      if (p.platform === "codeforces") {
        const min = input.cfRatingMin;
        const max = input.cfRatingMax;
        if (min !== undefined || max !== undefined) {
          if (p.difficulty === undefined) return false;
          if (min !== undefined && p.difficulty < min) return false;
          if (max !== undefined && p.difficulty > max) return false;
        }
        return true;
      }

      if (p.platform === "atcoder") {
        const min = input.atDifficultyMin;
        const max = input.atDifficultyMax;
        if (min !== undefined || max !== undefined) {
          if (p.difficulty === undefined) return false;
          if (min !== undefined && p.difficulty < min) return false;
          if (max !== undefined && p.difficulty > max) return false;
        }
        return true;
      }

      return true;
    });
  }

  function matchesSpec(problem: NormalizedProblem, spec: ProblemSpec): boolean {
    if (problem.platform !== spec.platform) return false;
    if (spec.min !== undefined || spec.max !== undefined) {
      if (problem.difficulty === undefined) return false;
      if (spec.min !== undefined && problem.difficulty < spec.min) return false;
      if (spec.max !== undefined && problem.difficulty > spec.max) return false;
    }
    return true;
  }

  async function createRoom(input: CreateRoomInput): Promise<Room> {
    if (input.durationMinutes <= 0) throw badRequest("Invalid durationMinutes");

    const seed = input.seed ?? newId();
    const specs = input.problemSpecs?.length ? input.problemSpecs : null;

    const includeCodeforces = specs
      ? specs.some((s) => s.platform === "codeforces")
      : !!input.platforms?.codeforces;
    const includeAtcoder = specs ? specs.some((s) => s.platform === "atcoder") : !!input.platforms?.atcoder;

    if (!includeCodeforces && !includeAtcoder) {
      throw badRequest("Select at least one platform");
    }

    const desiredCount = specs ? specs.length : input.count ?? 0;
    if (desiredCount <= 0) throw badRequest("Invalid count");

    let pool = await buildBasePool({ includeCodeforces, includeAtcoder, cfTags: input.cfTags });
    if (!specs) {
      pool = filterByLegacyRanges(pool, input);
    }

    if (input.excludeAlreadySolved) {
      const db = await fileDb.readDb();
      const user = db.users.find((u) => u.id === input.ownerUserId);
      if (!user) throw notFound("User not found");

      const cfSolved = new Set<string>();
      const atSolved = new Set<string>();

      if (includeCodeforces && user.cfHandle) {
        try {
          const subs = await fetchCodeforcesUserStatus(user.cfHandle);
          for (const s of subs) {
            if (s.verdict !== "OK") continue;
            if (s.problem.contestId === undefined) continue;
            cfSolved.add(`${s.problem.contestId}${s.problem.index}`);
          }
        } catch {
          throw badRequest("Failed to fetch Codeforces solved set (check handle)");
        }
      }

      if (includeAtcoder && user.atcoderUser) {
        try {
          const solved = await fetchAtcoderSolvedSet(user.atcoderUser);
          for (const k of solved) atSolved.add(k);
        } catch {
          throw badRequest("Failed to fetch AtCoder solved set (check user id)");
        }
      }

      pool = pool.filter((p) => {
        if (p.platform === "codeforces") return !cfSolved.has(p.key);
        if (p.platform === "atcoder") return !atSolved.has(p.key);
        return true;
      });
    }

    const selected: NormalizedProblem[] = [];

    if (!specs) {
      if (pool.length < desiredCount) {
        throw badRequest(`Not enough candidate problems (needed ${desiredCount}, got ${pool.length})`);
      }
      selected.push(...seededShuffle(pool, seed).slice(0, desiredCount));
    } else {
      const rng = createSeededRng(seed);
      let remainingPool = pool;

      for (let i = 0; i < specs.length; i++) {
        const spec = specs[i];
        const eligible = remainingPool.filter((p) => matchesSpec(p, spec));
        if (eligible.length === 0) {
          throw badRequest(`Not enough candidate problems for problem ${i + 1}`);
        }
        const idx = Math.floor(rng() * eligible.length);
        const picked = eligible[idx];
        selected.push(picked);
        remainingPool = remainingPool.filter(
          (p) => !(p.platform === picked.platform && p.key === picked.key),
        );
      }
    }

    const now = nowUnixSeconds();

    const db = await fileDb.readDb();
    const owner = db.users.find((u) => u.id === input.ownerUserId);
    if (!owner) throw notFound("User not found");

    const room: Room = {
      id: newId(),
      name: input.name,
      ownerUserId: input.ownerUserId,
      inviteCode: generateInviteCode(),
      status: input.startImmediately ? "running" : "lobby",
      createdAt: now,
      startedAt: input.startImmediately ? now : undefined,
      durationSeconds: input.durationMinutes * 60,
      seed,
      problems: selected,
      members: [{ userId: owner.id, username: owner.username, role: "host", joinedAt: now }],
      progressByUserId: { [owner.id]: emptyProgress() },
    };

    await fileDb.updateDb((db2) => {
      db2.rooms.push(room);
      db2.activities.push({
        id: newId(),
        t: now,
        kind: "room",
        actorUserId: input.ownerUserId,
        target: { type: "room", id: room.id },
        message: `Created room "${room.name}"`,
        meta: { action: "create" },
      });
      if (db2.activities.length > 5000) {
        db2.activities.splice(0, db2.activities.length - 5000);
      }
    });

    return room;
  }

  async function listRoomsForUser(userId: string): Promise<Room[]> {
    const db = await fileDb.readDb();
    return db.rooms
      .filter((r) => r.members.some((m) => m.userId === userId))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async function getRoomForUser(userId: string, roomId: string): Promise<Room> {
    const db = await fileDb.readDb();
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) throw notFound("Room not found");
    const isMember = room.members.some((m) => m.userId === userId);
    if (!isMember) throw forbidden();
    return room;
  }

  async function joinRoom(userId: string, roomId: string, inviteCode: string): Promise<Room> {
    const now = nowUnixSeconds();
    return await fileDb.updateDb((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room) throw notFound("Room not found");
      if (room.status !== "lobby") throw badRequest("Room cannot be joined");
      if (room.inviteCode !== inviteCode) throw forbidden("Invalid invite code");

      const alreadyMember = room.members.some((m) => m.userId === userId);
      if (alreadyMember) return room;

      const user = db.users.find((u) => u.id === userId);
      if (!user) throw notFound("User not found");

      room.members.push({ userId, username: user.username, role: "member", joinedAt: now });
      room.progressByUserId[userId] = emptyProgress();
      db.activities.push({
        id: newId(),
        t: now,
        kind: "room",
        actorUserId: userId,
        target: { type: "room", id: room.id },
        message: `Joined room "${room.name}"`,
        meta: { action: "join" },
      });
      if (db.activities.length > 5000) {
        db.activities.splice(0, db.activities.length - 5000);
      }
      return room;
    });
  }

  async function leaveRoom(userId: string, roomId: string): Promise<void> {
    await fileDb.updateDb((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room) throw notFound("Room not found");
      if (room.status !== "lobby") throw badRequest("Room cannot be left");
      if (room.ownerUserId === userId) throw forbidden("Host cannot leave room");

      const idx = room.members.findIndex((m) => m.userId === userId);
      if (idx === -1) throw forbidden();
      room.members.splice(idx, 1);
      delete room.progressByUserId[userId];
    });
  }

  async function startRoom(hostUserId: string, roomId: string): Promise<Room> {
    const now = nowUnixSeconds();
    return await fileDb.updateDb((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room) throw notFound("Room not found");
      if (room.ownerUserId !== hostUserId) throw forbidden("Only host can start the room");
      if (room.status !== "lobby") throw badRequest("Room cannot be started");

      room.status = "running";
      room.startedAt = now;
      room.finishedAt = undefined;
      for (const member of room.members) {
        room.progressByUserId[member.userId] = emptyProgress();
      }
      db.activities.push({
        id: newId(),
        t: now,
        kind: "room",
        actorUserId: hostUserId,
        target: { type: "room", id: room.id },
        message: `Started room "${room.name}"`,
        meta: { action: "start" },
      });
      if (db.activities.length > 5000) {
        db.activities.splice(0, db.activities.length - 5000);
      }
      return room;
    });
  }

  async function finishRoom(hostUserId: string, roomId: string): Promise<Room> {
    const now = nowUnixSeconds();
    return await fileDb.updateDb((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room) throw notFound("Room not found");
      if (room.ownerUserId !== hostUserId) throw forbidden("Only host can finish the room");
      if (room.status !== "running") throw badRequest("Room cannot be finished");
      room.status = "finished";
      room.finishedAt = now;
      db.activities.push({
        id: newId(),
        t: now,
        kind: "room",
        actorUserId: hostUserId,
        target: { type: "room", id: room.id },
        message: `Finished room "${room.name}"`,
        meta: { action: "finish" },
      });
      if (db.activities.length > 5000) {
        db.activities.splice(0, db.activities.length - 5000);
      }
      return room;
    });
  }

  function computeScoreboard(room: Room): Array<{
    rank: number;
    userId: string;
    username: string;
    solvedCount: number;
    penaltySeconds: number;
    lastSolvedAt?: number;
  }> {
    const entries = room.members.map((m) => {
      const progress = room.progressByUserId[m.userId] ?? emptyProgress();
      const solved = Object.values(progress.solved ?? {});
      const solvedCount = solved.length;
      const penaltySeconds = solved.reduce((sum, s) => sum + (s.solveTimeSeconds ?? 0), 0);
      const lastSolvedAt =
        solvedCount > 0 ? Math.max(...solved.map((s) => s.solvedAt ?? 0)) : undefined;
      return { userId: m.userId, username: m.username, solvedCount, penaltySeconds, lastSolvedAt };
    });

    entries.sort((a, b) => {
      const aLast = a.lastSolvedAt ?? Number.POSITIVE_INFINITY;
      const bLast = b.lastSolvedAt ?? Number.POSITIVE_INFINITY;
      return (
        b.solvedCount - a.solvedCount ||
        a.penaltySeconds - b.penaltySeconds ||
        aLast - bLast ||
        a.username.localeCompare(b.username)
      );
    });

    return entries.map((e, i) => ({ rank: i + 1, ...e }));
  }

  return {
    createRoom,
    listRoomsForUser,
    getRoomForUser,
    joinRoom,
    leaveRoom,
    startRoom,
    finishRoom,
    computeScoreboard,
  };
}
