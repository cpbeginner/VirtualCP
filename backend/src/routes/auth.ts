import type { CookieOptions } from "express";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { LoginSchema, RegisterSchema } from "../domain/schemas";
import type { User } from "../domain/dbTypes";
import { newId } from "../utils/ids";
import { locals } from "../utils/locals";
import { nowUnixSeconds } from "../utils/time";
import { badRequest, unauthorized } from "../middleware/errorHandler";

export const authRouter = Router();

function cookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function signToken(userId: string): string {
  return jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: "30d" });
}

function toUserResponse(user: {
  id: string;
  username: string;
  cfHandle?: string;
  atcoderUser?: string;
}) {
  return {
    id: user.id,
    username: user.username,
    cfHandle: user.cfHandle,
    atcoderUser: user.atcoderUser,
  };
}

authRouter.post("/register", async (req, res, next) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  const { username, password, cfHandle, atcoderUser } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await locals(req).fileDb.updateDb((db) => {
    const exists = db.users.some((u) => u.username === username);
    if (exists) throw badRequest("Username already exists");

    const newUser: User = {
      id: newId(),
      username,
      passwordHash,
      cfHandle,
      atcoderUser,
      createdAt: nowUnixSeconds(),
      stats: {
        xp: 0,
        totalSolved: 0,
        solvedByPlatform: { codeforces: 0, atcoder: 0 },
        streakDays: 0,
        achievements: {},
      },
      preferences: {
        theme: "aurora",
        motion: "system",
        effects: {
          particles: true,
          confetti: true,
          glowCursor: true,
          ambientGradient: true,
          sounds: false,
        },
      },
      favorites: [],
    };
    db.users.push(newUser);
    return newUser;
  });

  res.cookie("vc_token", signToken(user.id), cookieOptions());
  res.json({ ok: true, user: toUserResponse(user) });
});

authRouter.post("/login", async (req, res, next) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  const { username, password } = parsed.data;

  const db = await locals(req).fileDb.readDb();
  const user = db.users.find((u) => u.username === username);
  if (!user) return next(unauthorized("Invalid username or password"));

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) return next(unauthorized("Invalid username or password"));

  res.cookie("vc_token", signToken(user.id), cookieOptions());
  res.json({ ok: true, user: toUserResponse(user) });
});

authRouter.post("/logout", async (_req, res) => {
  res.clearCookie("vc_token", cookieOptions());
  res.json({ ok: true });
});
