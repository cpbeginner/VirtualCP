import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { locals } from "../utils/locals";

export const streamRouter = Router();

streamRouter.use(requireAuth);

streamRouter.get("/", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Flush headers + send an initial hello.
  res.write(`event: hello\n`);
  res.write(`data: ${JSON.stringify({ ok: true, userId: req.userId! })}\n\n`);

  const unsubscribe = locals(req).realtimeHub.subscribeUser(req.userId!, res);

  const keepalive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      // ignore; close handler will clean up
    }
  }, 20_000);

  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
});

