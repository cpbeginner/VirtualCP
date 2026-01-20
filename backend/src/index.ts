import { createServer } from "http";
import { app } from "./app";
import { env } from "./env";
import { createPoller } from "./services/poller";

const server = createServer(app);

server.listen(env.PORT, () => {
  app.locals.logger.info({ port: env.PORT }, "backend listening");
});

createPoller({
  logger: app.locals.logger,
  fileDb: app.locals.fileDb,
  intervalSeconds: env.POLL_INTERVAL_SECONDS,
  statsService: app.locals.statsService,
  realtimeHub: app.locals.realtimeHub,
}).start();
