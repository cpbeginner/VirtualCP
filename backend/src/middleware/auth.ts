import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { unauthorized } from "./errorHandler";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

type TokenPayload = {
  userId: string;
};

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.vc_token;
  if (!token) return next(unauthorized());

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    if (!payload?.userId) return next(unauthorized());
    req.userId = payload.userId;
    return next();
  } catch {
    return next(unauthorized());
  }
}

export function getAuthedUserId(req: Request): string {
  if (!req.userId) throw unauthorized();
  return req.userId;
}
