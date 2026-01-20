import { apiRequest } from "./client";
import type { NormalizedProblem, Platform, ProblemSpec, SolvedInfo } from "./contests";

export type RoomStatus = "lobby" | "running" | "finished";

export type ContestProgress = {
  solved: Record<string, SolvedInfo>;
  lastPoll: { cfFrom?: number; atFrom?: number };
  lastSync?: { codeforces?: number; atcoder?: number };
};

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

export type RoomSummary = {
  id: string;
  name: string;
  status: RoomStatus;
  createdAt: number;
  startedAt?: number;
  membersCount: number;
  isHost: boolean;
  inviteCode?: string;
};

export type RoomMessage = {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  t: number;
  text: string;
};

export type RoomScoreEntry = {
  rank: number;
  userId: string;
  username: string;
  solvedCount: number;
  penaltySeconds: number;
  lastSolvedAt?: number;
};

export async function apiCreateRoom(input: {
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
}): Promise<Room> {
  const res = await apiRequest<{ ok: true; room: Room }>("/rooms", { method: "POST", body: input });
  return res.room;
}

export async function apiListRooms(): Promise<RoomSummary[]> {
  const res = await apiRequest<{ ok: true; rooms: RoomSummary[] }>("/rooms");
  return res.rooms;
}

export async function apiGetRoom(id: string): Promise<{ room: Room; scoreboard: RoomScoreEntry[] }> {
  const res = await apiRequest<{ ok: true; room: Room; scoreboard: RoomScoreEntry[] }>(
    `/rooms/${encodeURIComponent(id)}`,
  );
  return { room: res.room, scoreboard: res.scoreboard };
}

export async function apiJoinRoom(roomId: string, inviteCode: string): Promise<Room> {
  const res = await apiRequest<{ ok: true; room: Room }>(`/rooms/${encodeURIComponent(roomId)}/join`, {
    method: "POST",
    body: { inviteCode },
  });
  return res.room;
}

export async function apiLeaveRoom(roomId: string): Promise<void> {
  await apiRequest<{ ok: true }>(`/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST", body: {} });
}

export async function apiStartRoom(roomId: string): Promise<Room> {
  const res = await apiRequest<{ ok: true; room: Room }>(`/rooms/${encodeURIComponent(roomId)}/start`, {
    method: "POST",
    body: {},
  });
  return res.room;
}

export async function apiFinishRoom(roomId: string): Promise<{ room: Room; scoreboard: RoomScoreEntry[] }> {
  const res = await apiRequest<{ ok: true; room: Room; scoreboard: RoomScoreEntry[] }>(
    `/rooms/${encodeURIComponent(roomId)}/finish`,
    { method: "POST", body: {} },
  );
  return { room: res.room, scoreboard: res.scoreboard };
}

export async function apiRefreshRoom(
  roomId: string,
): Promise<{ room: Room; scoreboard: RoomScoreEntry[]; polled: { codeforces: boolean; atcoder: boolean } }> {
  const res = await apiRequest<{
    ok: true;
    room: Room;
    scoreboard: RoomScoreEntry[];
    polled: { codeforces: boolean; atcoder: boolean };
  }>(`/rooms/${encodeURIComponent(roomId)}/refresh`, { method: "POST", body: {} });
  return { room: res.room, scoreboard: res.scoreboard, polled: res.polled };
}

export async function apiGetRoomMessages(roomId: string, limit?: number): Promise<RoomMessage[]> {
  const qs = typeof limit === "number" ? `?limit=${encodeURIComponent(String(limit))}` : "";
  const res = await apiRequest<{ ok: true; messages: RoomMessage[] }>(
    `/rooms/${encodeURIComponent(roomId)}/messages${qs}`,
  );
  return res.messages;
}

export async function apiPostRoomMessage(roomId: string, text: string): Promise<RoomMessage> {
  const res = await apiRequest<{ ok: true; message: RoomMessage }>(
    `/rooms/${encodeURIComponent(roomId)}/messages`,
    { method: "POST", body: { text } },
  );
  return res.message;
}

export function roomHasPlatform(room: Room, platform: Platform): boolean {
  return room.problems.some((p) => p.platform === platform);
}

