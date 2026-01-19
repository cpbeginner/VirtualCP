import type { Request } from "express";
import type { Logger } from "pino";
import { createCacheService } from "../services/cacheService";
import { createContestService } from "../services/contestService";
import { createWrappedService } from "../services/wrappedService";
import { createFileDb } from "../store/fileDb";

export type AppLocals = {
  logger: Logger;
  fileDb: ReturnType<typeof createFileDb>;
  cacheService: ReturnType<typeof createCacheService>;
  contestService: ReturnType<typeof createContestService>;
  wrappedService: ReturnType<typeof createWrappedService>;
};

export function locals(req: Request): AppLocals {
  return req.app.locals as AppLocals;
}
