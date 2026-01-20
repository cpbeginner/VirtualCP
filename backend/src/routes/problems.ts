import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { badRequest } from "../middleware/errorHandler";
import { locals } from "../utils/locals";

export const problemsRouter = Router();

problemsRouter.use(requireAuth);

function decodeCursor(cursor: string | undefined): { offset: number } {
  if (!cursor) return { offset: 0 };
  try {
    const raw = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(raw) as any;
    const offset = typeof parsed?.offset === "number" ? Math.max(0, Math.floor(parsed.offset)) : 0;
    return { offset };
  } catch {
    return { offset: 0 };
  }
}

function encodeCursor(obj: { offset: number }): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64");
}

problemsRouter.get("/search", async (req, res, next) => {
  try {
    const platformRaw = typeof req.query.platform === "string" ? req.query.platform : "all";
    const platform =
      platformRaw === "codeforces" || platformRaw === "atcoder" ? platformRaw : "all";

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const qLower = q.toLowerCase();

    const tagsRaw = typeof req.query.tags === "string" ? req.query.tags : "";
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const tagSet = new Set(tags);

    const min = typeof req.query.min === "string" && req.query.min.trim() !== "" ? Number(req.query.min) : undefined;
    const max = typeof req.query.max === "string" && req.query.max.trim() !== "" ? Number(req.query.max) : undefined;
    if (min !== undefined && !Number.isFinite(min)) return next(badRequest("Invalid min"));
    if (max !== undefined && !Number.isFinite(max)) return next(badRequest("Invalid max"));

    const limitRaw = typeof req.query.limit === "string" ? Number(req.query.limit) : 50;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(200, Math.floor(limitRaw))) : 50;

    const { offset } = decodeCursor(typeof req.query.cursor === "string" ? req.query.cursor : undefined);

    const index = await locals(req).problemIndexService.getNormalizedIndex();

    let filtered = index.filter((p) => {
      if (platform !== "all" && p.platform !== platform) return false;

      if (qLower && !p.name.toLowerCase().includes(qLower)) return false;

      if (tagSet.size > 0 && p.platform === "codeforces") {
        const tags = p.tags ?? [];
        if (!tags.some((t) => tagSet.has(t))) return false;
      }

      if (min !== undefined || max !== undefined) {
        if (p.difficulty === undefined) return false;
        if (min !== undefined && p.difficulty < min) return false;
        if (max !== undefined && p.difficulty > max) return false;
      }

      return true;
    });

    filtered = filtered.sort((a, b) => {
      const ad = a.difficulty ?? Number.POSITIVE_INFINITY;
      const bd = b.difficulty ?? Number.POSITIVE_INFINITY;
      return ad - bd || a.key.localeCompare(b.key);
    });

    const results = filtered.slice(offset, offset + limit);
    const nextOffset = offset + results.length;
    const nextCursor = nextOffset < filtered.length ? encodeCursor({ offset: nextOffset }) : undefined;

    res.json({ ok: true, results, nextCursor });
  } catch (err) {
    next(err);
  }
});

