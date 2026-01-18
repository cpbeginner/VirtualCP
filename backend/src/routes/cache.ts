import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { locals } from "../utils/locals";

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
  res.json({ ok: true, meta: result.meta });
});
