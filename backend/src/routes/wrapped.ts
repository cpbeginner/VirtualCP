import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { badRequest, notFound } from "../middleware/errorHandler";
import { locals } from "../utils/locals";

export const wrappedRouter = Router();

wrappedRouter.use(requireAuth);

wrappedRouter.get("/codeforces", async (req, res, next) => {
  try {
    const yearStr = typeof req.query.year === "string" ? req.query.year : undefined;
    if (yearStr !== "2023" && yearStr !== "2024" && yearStr !== "2025") {
      return next(badRequest("Invalid year"));
    }
    const year = Number(yearStr);

    const refresh = req.query.refresh === "1";

    const db = await locals(req).fileDb.readDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) return next(notFound("User not found"));
    if (!user.cfHandle) return next(badRequest("Set Codeforces handle in Settings"));

    const result = await locals(req).wrappedService.getCodeforcesWrappedYear({
      handle: user.cfHandle,
      year,
      refresh,
    });

    res.json({ ok: true, wrapped: result.wrapped, warnings: result.warnings });
  } catch (err) {
    next(err);
  }
});
