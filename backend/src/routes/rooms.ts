import { Router } from "express";
import { CreateRoomSchema, JoinRoomSchema, RoomMessageSchema } from "../domain/schemas";
import { requireAuth } from "../middleware/auth";
import { badRequest, forbidden, notFound } from "../middleware/errorHandler";
import { pollRoomById } from "../services/poller";
import { locals } from "../utils/locals";
import { newId } from "../utils/ids";
import { nowUnixSeconds } from "../utils/time";

export const roomsRouter = Router();

roomsRouter.use(requireAuth);

roomsRouter.post("/", async (req, res, next) => {
  const parsed = CreateRoomSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  try {
    const room = await locals(req).roomService.createRoom({
      ownerUserId: req.userId!,
      ...parsed.data,
    });
    res.json({ ok: true, room });
  } catch (err) {
    next(err);
  }
});

roomsRouter.get("/", async (req, res, next) => {
  try {
    const userId = req.userId!;
    const rooms = await locals(req).roomService.listRoomsForUser(userId);
    const summaries = rooms.map((r) => {
      const isHost = r.ownerUserId === userId;
      const summary: any = {
        id: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt,
        startedAt: r.startedAt,
        membersCount: r.members.length,
        isHost,
      };
      if (isHost) summary.inviteCode = r.inviteCode;
      return summary;
    });
    res.json({ ok: true, rooms: summaries });
  } catch (err) {
    next(err);
  }
});

roomsRouter.get("/:id", async (req, res, next) => {
  try {
    const room = await locals(req).roomService.getRoomForUser(req.userId!, req.params.id);
    const scoreboard = locals(req).roomService.computeScoreboard(room);
    res.json({ ok: true, room, scoreboard });
  } catch (err) {
    next(err);
  }
});

roomsRouter.get("/:id/messages", async (req, res, next) => {
  try {
    const roomId = req.params.id;
    const limitRaw = req.query.limit;
    const limitNum =
      typeof limitRaw === "string" && limitRaw.trim() !== "" ? Number(limitRaw) : 50;
    const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(200, Math.floor(limitNum))) : 50;

    const db = await locals(req).fileDb.readDb();
    const room = db.rooms.find((r) => r.id === roomId);
    if (!room) return next(notFound("Room not found"));
    const isMember = room.members.some((m) => m.userId === req.userId!);
    if (!isMember) return next(forbidden());

    const all = db.roomMessages
      .filter((m) => m.roomId === roomId)
      .sort((a, b) => a.t - b.t);
    const messages = all.slice(-limit);

    res.json({ ok: true, messages });
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/:id/messages", async (req, res, next) => {
  const parsed = RoomMessageSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  try {
    const roomId = req.params.id;
    const userId = req.userId!;
    const now = nowUnixSeconds();

    const result = await locals(req).fileDb.updateDb((db) => {
      const room = db.rooms.find((r) => r.id === roomId);
      if (!room) throw notFound("Room not found");
      const isMember = room.members.some((m) => m.userId === userId);
      if (!isMember) throw forbidden();

      const user = db.users.find((u) => u.id === userId);
      if (!user) throw notFound("User not found");

      const message = {
        id: newId(),
        roomId,
        userId,
        username: user.username,
        t: now,
        text: parsed.data.text,
      };

      db.roomMessages.push(message);
      db.activities.push({
        id: newId(),
        t: now,
        kind: "room",
        actorUserId: userId,
        target: { type: "room", id: roomId },
        message: `Message in room "${room.name}"`,
        meta: { action: "message", messageId: message.id },
      });
      if (db.activities.length > 5000) {
        db.activities.splice(0, db.activities.length - 5000);
      }
      const memberIds = room.members.map((m) => m.userId);
      return { message, memberIds };
    });

    locals(req).realtimeHub.publishToUsers(result.memberIds, "room_message", {
      roomId,
      message: result.message,
    });

    res.json({ ok: true, message: result.message });
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/:id/join", async (req, res, next) => {
  const parsed = JoinRoomSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  try {
    const room = await locals(req).roomService.joinRoom(req.userId!, req.params.id, parsed.data.inviteCode);
    res.json({ ok: true, room });
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/:id/leave", async (req, res, next) => {
  try {
    await locals(req).roomService.leaveRoom(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/:id/start", async (req, res, next) => {
  try {
    const room = await locals(req).roomService.startRoom(req.userId!, req.params.id);
    res.json({ ok: true, room });
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/:id/finish", async (req, res, next) => {
  try {
    const room = await locals(req).roomService.finishRoom(req.userId!, req.params.id);
    const scoreboard = locals(req).roomService.computeScoreboard(room);
    res.json({ ok: true, room, scoreboard });
  } catch (err) {
    next(err);
  }
});

roomsRouter.post("/:id/refresh", async (req, res, next) => {
  try {
    const result = await pollRoomById({
      fileDb: locals(req).fileDb,
      logger: locals(req).logger,
      statsService: locals(req).statsService,
      realtimeHub: locals(req).realtimeHub,
      requesterUserId: req.userId!,
      roomId: req.params.id,
    });
    const scoreboard = locals(req).roomService.computeScoreboard(result.room);
    res.json({ ok: true, room: result.room, scoreboard, polled: result.polled });
  } catch (err) {
    next(err);
  }
});
