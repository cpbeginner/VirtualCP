import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, message);
}

export function unauthorized(message = "Unauthorized"): HttpError {
  return new HttpError(401, message);
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError(404, message);
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    req.log?.warn({ err: err.flatten() }, "validation error");
    res.status(400).json({ ok: false, error: "Invalid request" });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, error: err.message });
    return;
  }

  req.log?.error({ err }, "unhandled error");
  res.status(500).json({ ok: false, error: "Internal server error" });
}
