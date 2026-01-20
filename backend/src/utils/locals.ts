import type { Request } from "express";
import type { Logger } from "pino";
import { createCacheService } from "../services/cacheService";
import { createContestService } from "../services/contestService";
import { createProblemIndexService } from "../services/problemIndexService";
import { createRoomService } from "../services/roomService";
import { createRealtimeHub } from "../services/realtimeHub";
import { createStatsService } from "../services/statsService";
import { createWrappedService } from "../services/wrappedService";
import { createFileDb } from "../store/fileDb";

export type AppLocals = {
  logger: Logger;
  fileDb: ReturnType<typeof createFileDb>;
  cacheService: ReturnType<typeof createCacheService>;
  contestService: ReturnType<typeof createContestService>;
  wrappedService: ReturnType<typeof createWrappedService>;
  statsService: ReturnType<typeof createStatsService>;
  realtimeHub: ReturnType<typeof createRealtimeHub>;
  roomService: ReturnType<typeof createRoomService>;
  problemIndexService: ReturnType<typeof createProblemIndexService>;
};

export function locals(req: Request): AppLocals {
  return req.app.locals as AppLocals;
}
