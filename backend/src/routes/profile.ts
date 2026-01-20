import { Router } from "express";
import { PatchPreferencesSchema } from "../domain/schemas";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../middleware/errorHandler";
import { locals } from "../utils/locals";

export const profileRouter = Router();

profileRouter.use(requireAuth);

profileRouter.get("/me/profile", async (req, res, next) => {
  try {
    const userId = req.userId!;
    const db = await locals(req).fileDb.readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return next(notFound("User not found"));

    const level = locals(req).statsService.levelForXp(user.stats.xp);

    const recentActivity = db.activities
      .filter((a) => a.actorUserId === userId || (a.target.type === "user" && a.target.id === userId))
      .sort((a, b) => b.t - a.t)
      .slice(0, 50);

    res.json({
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        cfHandle: user.cfHandle,
        atcoderUser: user.atcoderUser,
      },
      stats: user.stats,
      level,
      preferences: user.preferences,
      recentActivity,
    });
  } catch (err) {
    next(err);
  }
});

profileRouter.patch("/me/preferences", async (req, res, next) => {
  const parsed = PatchPreferencesSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  try {
    const userId = req.userId!;
    const updated = await locals(req).fileDb.updateDb((db) => {
      const user = db.users.find((u) => u.id === userId);
      if (!user) throw notFound("User not found");

      const { theme, motion, effects } = parsed.data;
      if (theme !== undefined) user.preferences.theme = theme;
      if (motion !== undefined) user.preferences.motion = motion;
      if (effects) {
        user.preferences.effects = {
          ...user.preferences.effects,
          ...effects,
        };
      }

      return user.preferences;
    });

    res.json({ ok: true, preferences: updated });
  } catch (err) {
    next(err);
  }
});

profileRouter.get("/leaderboard", async (req, res, next) => {
  try {
    const limitRaw = req.query.limit;
    const limitNum =
      typeof limitRaw === "string" && limitRaw.trim() !== "" ? Number(limitRaw) : 20;
    const limit = Number.isFinite(limitNum) ? Math.max(1, Math.min(200, Math.floor(limitNum))) : 20;

    const db = await locals(req).fileDb.readDb();
    const leaderboard = locals(req).statsService.computeLeaderboard(db, limit);
    res.json({ ok: true, leaderboard });
  } catch (err) {
    next(err);
  }
});

profileRouter.get("/achievements", async (_req, res) => {
  const achievements = locals(_req).statsService.getAchievementCatalog();
  res.json({ ok: true, achievements });
});

