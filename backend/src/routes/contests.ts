import { Router } from "express";
import { CreateContestSchema } from "../domain/schemas";
import { requireAuth } from "../middleware/auth";
import { badRequest } from "../middleware/errorHandler";
import { pollContestById } from "../services/poller";
import { locals } from "../utils/locals";

export const contestsRouter = Router();

contestsRouter.use(requireAuth);

contestsRouter.post("/", async (req, res, next) => {
  const parsed = CreateContestSchema.safeParse(req.body);
  if (!parsed.success) return next(badRequest("Invalid request"));

  try {
    const contest = await locals(req).contestService.createContest({
      ownerUserId: req.userId!,
      ...parsed.data,
    });
    res.json({ ok: true, contest });
  } catch (err) {
    next(err);
  }
});

contestsRouter.get("/", async (req, res) => {
  const contests = await locals(req).contestService.listContests(req.userId!);
  res.json({ ok: true, contests });
});

contestsRouter.get("/:id", async (req, res, next) => {
  try {
    const contest = await locals(req).contestService.getContest(req.userId!, req.params.id);
    res.json({ ok: true, contest });
  } catch (err) {
    next(err);
  }
});

contestsRouter.delete("/:id", async (req, res, next) => {
  try {
    await locals(req).contestService.deleteContest(req.userId!, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

contestsRouter.post("/:id/start", async (req, res, next) => {
  try {
    const contest = await locals(req).contestService.startContest(req.userId!, req.params.id);
    res.json({ ok: true, contest });
  } catch (err) {
    next(err);
  }
});

contestsRouter.post("/:id/finish", async (req, res, next) => {
  try {
    const contest = await locals(req).contestService.finishContest(req.userId!, req.params.id);
    res.json({ ok: true, contest });
  } catch (err) {
    next(err);
  }
});

contestsRouter.post("/:id/refresh", async (req, res, next) => {
  try {
    const result = await pollContestById({
      fileDb: locals(req).fileDb,
      logger: locals(req).logger,
      ownerUserId: req.userId!,
      contestId: req.params.id,
    });
    res.json({ ok: true, contest: result.contest, polled: result.polled });
  } catch (err) {
    next(err);
  }
});
