# VirtualCP - Agent Log

This file is an implementation log maintained by Codex per project requirements.

## Feature 0 - Repo scaffold

- Changes:
  - Initialized npm workspaces monorepo with `/backend` and `/frontend`.
  - Added root scripts: `dev`, `build`, `test`, `stress`.
  - Added skeleton `AGENTS.md` and `DOCUMENTATION.md`.
  - Added initial backend + frontend scaffolds.
- Decisions:
  - Use `concurrently` at repo root to run backend + frontend in dev.
- Commands run:
  - (none - initial scaffold created via patches)
- Result / issues:
  - Repo structure created.

## Feature 1 - fileDb (safe JSON storage)

- Changes:
  - Implemented JSON file storage with `proper-lockfile` + atomic temp-file writes in `backend/src/store/fileDb.ts`.
  - Added a concurrency-focused test in `backend/test/fileDb.test.ts`.
- Decisions:
  - Acquire the file lock for the full read-modify-write cycle to prevent concurrent writers.
- Commands run:
  - `npm install`
  - `npm -w backend test`
- Result / issues:
  - Test passes; file remains valid JSON under concurrent updates.

## Feature 2 - auth

- Changes:
  - Backend auth endpoints in `backend/src/routes/auth.ts` and `backend/src/routes/me.ts`.
  - JWT cookie auth middleware in `backend/src/middleware/auth.ts` (`vc_token`, HttpOnly).
  - Added auth tests in `backend/test/auth.test.ts` (+ vitest setup in `backend/test/setup.ts`).
  - Frontend login/register pages + protected routing.
- Decisions:
  - Use a single `me` query (`@tanstack/react-query`) as frontend auth source of truth.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Backend tests pass; frontend builds.

## Feature 3 - cache layer (Codeforces + AtCoder Problems)

- Changes:
  - Added throttled OJ integrations + MOCK fixtures:
    - `backend/src/integrations/codeforces.ts`
    - `backend/src/integrations/atcoderProblems.ts`
  - Implemented cache refresh + status in `backend/src/services/cacheService.ts` and `backend/src/routes/cache.ts`.
  - Added fixtures in `backend/test/fixtures/*` and a refresh test in `backend/test/cache.test.ts`.
  - Implemented Settings UI cache refresh in `frontend/src/pages/SettingsPage.tsx`.
- Decisions:
  - Refresh both platforms best-effort; return `{ ok:false }` if any platform fails.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Cache refresh works in MOCK mode; UI warns if AtCoder Problems is unavailable.

## Feature 4 - contest generation + listing + detail

- Changes:
  - Implemented seeded RNG utilities in `backend/src/utils/seededRng.ts`.
  - Added contest service in `backend/src/services/contestService.ts`.
  - Added contest endpoints in `backend/src/routes/contests.ts`.
  - Implemented Dashboard UI (create + list) in `frontend/src/pages/DashboardPage.tsx`.
  - Added deterministic generation tests in `backend/test/contestGeneration.test.ts`.
- Decisions:
  - Sort candidate pool by `problem.key` before shuffling to keep determinism stable for the same cache contents.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Deterministic generation verified in MOCK mode.

## Feature 5 - start/finish contest + timer UI

- Changes:
  - Added start/finish logic in `backend/src/services/contestService.ts` + endpoints in `backend/src/routes/contests.ts`.
  - Implemented Contest page timer UI in `frontend/src/pages/ContestPage.tsx`.
  - Added lifecycle test in `backend/test/contestLifecycle.test.ts`.
- Decisions:
  - Starting a contest resets `progress.solved` and poll markers.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Start/finish works; timer derives from `startedAt`.

## Feature 6 - submission tracking (poller + manual refresh)

- Changes:
  - Implemented matcher in `backend/src/services/submissionMatcher.ts`.
  - Implemented poller + manual refresh helper in `backend/src/services/poller.ts`.
  - Added `POST /api/contests/:id/refresh`.
  - Updated Contest UI with "Refresh now" + warnings.
  - Added MOCK refresh test in `backend/test/pollerRefresh.test.ts`.
- Decisions:
  - Keep poller resilient: errors log and do not stop the loop.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Manual refresh marks solves using fixtures.

## Feature 7 - exclude already solved

- Changes:
  - Implemented `excludeAlreadySolved` in `backend/src/services/contestService.ts` (CF user.status OK, AtCoder pagination).
  - Added tests in `backend/test/excludeSolved.test.ts`.
- Decisions:
  - Cap AtCoder pagination (30 pages) to avoid excessive requests.
- Commands run:
  - `npm -w backend test`
- Result / issues:
  - Verified in MOCK mode.

## Feature 8 - stress testing + reliability

- Changes:
  - Implemented safe MOCK stress test in `backend/scripts/stress.ts` (autocannon + db.json validation).
  - Fixed backend `tsc` build via typed app locals and local `bcryptjs` module declaration.
- Commands run:
  - `npm install`
  - `npm run test`
  - `npm run build`
  - `npm run stress`
- Result / issues:
  - Stress test completes in MOCK_OJ mode without external traffic.

## Feature 9 - AtCoder tracking fix

- Changes:
  - Fixed AtCoder polling to avoid missing delayed submissions by not advancing `from_second` on empty pages and adding a small overlap window.
  - Added `progress.lastSync` timestamps and updated UI staleness checks to use real last-sync times.
- Decisions:
  - Treat AtCoder `lastPoll.atFrom` as an incremental cursor, and store last successful sync time separately.
- Commands run:
  - `npm -w backend test`
- Result / issues:
  - Tracking becomes more reliable under AtCoder Problems API lag.

## Feature 10 - per-problem contest builder

- Changes:
  - Added `problemSpecs` support in `POST /api/contests` (per-problem platform + min/max range).
  - Updated dashboard form to use an "Add problem" button and per-problem platform/range selectors.
  - Added test `backend/test/problemSpecs.test.ts`.
- Decisions:
  - Keep legacy `platforms`+`count` mode for compatibility (stress test and existing flows).
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Contest generation supports mixed/custom per-problem selection.

## Feature 11 - contest deletion

- Changes:
  - Added `DELETE /api/contests/:id` and service method `deleteContest`.
  - Added "Delete contest" button on the contest page.
  - Added test `backend/test/contestDelete.test.ts`.
- Commands run:
  - `npm -w backend test`
- Result / issues:
  - Users can delete their contests.

## Feature 12 - ratings graph + stats

- Changes:
  - Added `GET /api/me/ratings` (Codeforces `user.rating`, AtCoder user history JSON).
  - Added MOCK fixtures + test `backend/test/ratings.test.ts`.
  - Updated Settings page to render simple SVG rating graphs + basic stats.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Ratings load when handles are set; failures show warnings.

## Feature 13 - docs + validation

- Changes:
  - Rewrote `DOCUMENTATION.md` to include new endpoints and updated contest creation modes.
  - Restored committed `backend/data/db.json` baseline to an empty DB after running stress.
- Commands run:
  - `npm -w backend run build`
  - `npm -w frontend run build`
  - `npm run stress`
- Result / issues:
  - Builds succeed; stress remains safe in MOCK mode.

## Feature 14 - validation rerun + db baseline reset

- Changes:
  - Re-ran repo validation (`test`, `build`, `stress`) after recent feature additions.
  - Reset `backend/data/db.json` back to an empty baseline after the stress run populated it with a temporary user/contest.
- Decisions:
  - Keep the tracked `db.json` clean so the repo starts from an empty state.
- Commands run:
  - `npm run test`
  - `npm run build`
  - `npm run stress`
  - `npm run test`
- Result / issues:
  - Tests pass; build succeeds; stress completes safely in `MOCK_OJ=1`.

## Feature 15 - UI encoding cleanup

- Changes:
  - Replaced the non-ASCII delimiter used to join rating warnings so it renders consistently on Windows terminals.
- Commands run:
  - `npm -w frontend run build`
- Result / issues:
  - Frontend builds; warnings display without garbled characters.

## Feature 16 - db.json cleanup

- Changes:
  - Reset `backend/data/db.json` back to an empty baseline after local/dev user data was written to the tracked file.
- Commands run:
  - (none)
- Result / issues:
  - Repo starts clean without personal/dev state in `db.json`.

## Feature 17 - project rename + git init

- Changes:
  - Renamed project branding from VirtuContest to VirtualCP across docs and UI.
  - Initialized a local git repository and set local git user config.
- Commands run:
  - `git init`
  - `git config user.name "cpbeginner"`
  - `git config user.email "vuquoclam117@gmail.com"`
- Result / issues:
  - Local repo initialized; awaiting remote URL/credentials to push.

## Feature 18 - initial commit + remote setup

- Changes:
  - Committed the project state under the VirtualCP name and set the GitHub remote URL.
- Commands run:
  - `git add .`
  - `git commit -m "Rename project to VirtualCP"`
  - `git remote add origin https://github.com/cpbeginner/VirtualCP.git`
- Result / issues:
  - Ready to push once a GitHub repo exists and credentials/token are provided.

## Feature 19 - branch rename

- Changes:
  - Renamed the default branch to `main` to match GitHub defaults.
- Commands run:
  - `git branch -M main`
- Result / issues:
  - Local branch is now `main`.

## Feature 20 - GitHub publish

- Changes:
  - Created the public GitHub repo `cpbeginner/VirtualCP` and pushed `main`.
- Commands run:
  - `Invoke-RestMethod -Method Post https://api.github.com/user/repos ...`
  - `git -c http.extraheader="AUTHORIZATION: basic <redacted>" push -u origin main`
- Result / issues:
  - Repo is live at https://github.com/cpbeginner/VirtualCP

## Feature 21 - UI redesign + robustness tweaks

- Changes:
  - Introduced a modern, warm-toned visual system (new fonts, gradient background, updated cards/buttons/inputs/badges/tables).
  - Refined page layouts for dashboard, contest, login/register, and settings to match the new theme.
  - Added shared HTTP JSON fetch with timeouts + user-agent headers for external integrations.
- Commands run:
  - `npm -w backend run build`
  - `npm -w frontend run build`
- Result / issues:
  - Builds succeed with the refreshed UI and integration hardening.
