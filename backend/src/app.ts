import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./env";
import { createFileDb } from "./store/fileDb";
import { createCacheService } from "./services/cacheService";
import { createContestService } from "./services/contestService";
import { createRealtimeHub } from "./services/realtimeHub";
import { createProblemIndexService } from "./services/problemIndexService";
import { createRoomService } from "./services/roomService";
import { createStatsService } from "./services/statsService";
import { createWrappedService } from "./services/wrappedService";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { profileRouter } from "./routes/profile";
import { cacheRouter } from "./routes/cache";
import { contestsRouter } from "./routes/contests";
import { problemsRouter } from "./routes/problems";
import { roomsRouter } from "./routes/rooms";
import { streamRouter } from "./routes/stream";
import { wrappedRouter } from "./routes/wrapped";

export function createApp(overrides?: {
  logger?: pino.Logger;
  fileDb?: ReturnType<typeof createFileDb>;
  cacheService?: ReturnType<typeof createCacheService>;
  contestService?: ReturnType<typeof createContestService>;
  wrappedService?: ReturnType<typeof createWrappedService>;
  statsService?: ReturnType<typeof createStatsService>;
  realtimeHub?: ReturnType<typeof createRealtimeHub>;
  roomService?: ReturnType<typeof createRoomService>;
  problemIndexService?: ReturnType<typeof createProblemIndexService>;
}) {
  const app = express();

  const logger =
    overrides?.logger ??
    pino({
      level: process.env.LOG_LEVEL ?? "info",
    });

  app.locals.logger = logger;
  app.locals.fileDb =
    overrides?.fileDb ??
    createFileDb({
      filePath: env.DB_FILE_PATH,
      logger,
    });
  app.locals.cacheService =
    overrides?.cacheService ?? createCacheService({ cacheDir: env.CACHE_DIR, logger });
  app.locals.contestService =
    overrides?.contestService ??
    createContestService({ fileDb: app.locals.fileDb, cacheService: app.locals.cacheService, logger });
  app.locals.wrappedService =
    overrides?.wrappedService ?? createWrappedService({ logger });
  app.locals.statsService =
    overrides?.statsService ?? createStatsService({ logger });
  app.locals.realtimeHub =
    overrides?.realtimeHub ?? createRealtimeHub();
  app.locals.roomService =
    overrides?.roomService ??
    createRoomService({ fileDb: app.locals.fileDb, cacheService: app.locals.cacheService, logger });
  app.locals.problemIndexService =
    overrides?.problemIndexService ??
    createProblemIndexService({ cacheService: app.locals.cacheService, logger });

  app.use(
    pinoHttp({
      logger,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api", profileRouter);
  app.use("/api/cache", cacheRouter);
  app.use("/api/contests", contestsRouter);
  app.use("/api/problems", problemsRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/stream", streamRouter);
  app.use("/api/wrapped", wrappedRouter);

  app.use(errorHandler);

  return app;
}

export const app = createApp();
