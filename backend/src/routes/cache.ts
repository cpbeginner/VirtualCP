import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { locals } from "../utils/locals";
import { newId } from "../utils/ids";
import { nowUnixSeconds } from "../utils/time";

export const cacheRouter = Router();

cacheRouter.use(requireAuth);

cacheRouter.get("/status", async (req, res) => {
  const meta = await locals(req).cacheService.getMeta();
  res.json({ ok: true, meta });
});

cacheRouter.post("/refresh", async (req, res) => {
  const result = await locals(req).cacheService.refreshAll();
  if (!result.ok) {
    res.json({ ok: false, error: result.error, meta: result.meta });
    return;
  }

  const userId = req.userId!;
  const now = nowUnixSeconds();
  await locals(req).fileDb.updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) return;
    locals(req).statsService.applyCacheRefreshed(user, now);
    db.activities.push({
      id: newId(),
      t: now,
      kind: "cache",
      actorUserId: userId,
      target: { type: "user", id: userId },
      message: "Refreshed problem cache",
      meta: { action: "refresh" },
    });
    if (db.activities.length > 5000) {
      db.activities.splice(0, db.activities.length - 5000);
    }
  });

  res.json({ ok: true, meta: result.meta });
});
