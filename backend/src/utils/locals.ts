import type { Request } from "express";
import type { Logger } from "pino";
import { createCacheService } from "../services/cacheService";
import { createContestService } from "../services/contestService";
import { createFileDb } from "../store/fileDb";

export type AppLocals = {
  logger: Logger;
  fileDb: ReturnType<typeof createFileDb>;
  cacheService: ReturnType<typeof createCacheService>;
  contestService: ReturnType<typeof createContestService>;
};

export function locals(req: Request): AppLocals {
  return req.app.locals as AppLocals;
}

