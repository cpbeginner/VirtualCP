import { Router } from "express";
import { PatchHandlesSchema } from "../domain/schemas";
import { fetchAtcoderUserHistory } from "../integrations/atcoderProblems";
import { fetchCodeforcesUserRating } from "../integrations/codeforces";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../middleware/errorHandler";
import { locals } from "../utils/locals";
import { nowUnixSeconds } from "../utils/time";

export const meRouter = Router();

meRouter.use(requireAuth);

meRouter.get("/", async (req, res, next) => {
  const userId = req.userId!;
  const db = await locals(req).fileDb.readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return next(notFound("User not found"));
  res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      cfHandle: user.cfHandle,
      atcoderUser: user.atcoderUser,
    },
  });
});

meRouter.patch("/handles", async (req, res, next) => {
  const parsed = PatchHandlesSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  const { cfHandle, atcoderUser } = parsed.data;
  const userId = req.userId!;

  const updated = await locals(req).fileDb.updateDb((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw notFound("User not found");
    if (cfHandle !== undefined) user.cfHandle = cfHandle || undefined;
    if (atcoderUser !== undefined) user.atcoderUser = atcoderUser || undefined;
    return user;
  });

  res.json({
    ok: true,
    user: {
      id: updated.id,
      username: updated.username,
      cfHandle: updated.cfHandle,
      atcoderUser: updated.atcoderUser,
    },
  });
});

function parseUnixSeconds(value: unknown): number | null {
  if (typeof value === "number") {
    // Heuristic: treat large values as ms.
    return value > 1_000_000_000_000 ? Math.floor(value / 1000) : Math.floor(value);
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return null;
    return Math.floor(ms / 1000);
  }
  return null;
}

meRouter.get("/ratings", async (req, res, next) => {
  try {
    const userId = req.userId!;
    const db = await locals(req).fileDb.readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return next(notFound("User not found"));

    const warnings: string[] = [];
    const fetchedAt = nowUnixSeconds();

    let codeforces:
      | {
          handle: string;
          contests: number;
          current?: number;
          max?: number;
          points: Array<{ t: number; rating: number }>;
        }
      | undefined;

    let atcoder:
      | {
          user: string;
          contests: number;
          current?: number;
          max?: number;
          points: Array<{ t: number; rating: number }>;
        }
      | undefined;

    if (user.cfHandle) {
      try {
        const changes = await fetchCodeforcesUserRating(user.cfHandle);
        const points = [...changes]
          .sort((a, b) => a.ratingUpdateTimeSeconds - b.ratingUpdateTimeSeconds)
          .map((c) => ({ t: c.ratingUpdateTimeSeconds, rating: c.newRating }));
        const current = points.length > 0 ? points[points.length - 1].rating : undefined;
        const max = points.length > 0 ? Math.max(...points.map((p) => p.rating)) : undefined;
        codeforces = { handle: user.cfHandle, contests: points.length, current, max, points };
      } catch (err) {
        locals(req).logger.warn({ err }, "codeforces ratings fetch failed");
        warnings.push("Codeforces ratings unavailable");
      }
    }

    if (user.atcoderUser) {
      try {
        const history = await fetchAtcoderUserHistory(user.atcoderUser);
        const rated = history
          .filter((h) => h.IsRated === true && typeof h.NewRating === "number")
          .map((h) => ({
            t: parseUnixSeconds(h.EndTime) ?? 0,
            rating: h.NewRating as number,
          }))
          .filter((p) => p.t > 0)
          .sort((a, b) => a.t - b.t);

        const current = rated.length > 0 ? rated[rated.length - 1].rating : undefined;
        const max = rated.length > 0 ? Math.max(...rated.map((p) => p.rating)) : undefined;
        atcoder = { user: user.atcoderUser, contests: rated.length, current, max, points: rated };
      } catch (err) {
        locals(req).logger.warn({ err }, "atcoder ratings fetch failed");
        warnings.push("AtCoder ratings unavailable");
      }
    }

    res.json({ ok: true, fetchedAt, codeforces, atcoder, warnings });
  } catch (err) {
    next(err);
  }
});
