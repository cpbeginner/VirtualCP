import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "./env";
import { createFileDb } from "./store/fileDb";
import { createCacheService } from "./services/cacheService";
import { createContestService } from "./services/contestService";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { cacheRouter } from "./routes/cache";
import { contestsRouter } from "./routes/contests";

export function createApp(overrides?: {
  logger?: pino.Logger;
  fileDb?: ReturnType<typeof createFileDb>;
  cacheService?: ReturnType<typeof createCacheService>;
  contestService?: ReturnType<typeof createContestService>;
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
  app.use("/api/cache", cacheRouter);
  app.use("/api/contests", contestsRouter);

  app.use(errorHandler);

  return app;
}

export const app = createApp();
