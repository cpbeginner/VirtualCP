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

## Feature 22 - alternate UI redesign

- Changes:
  - Switched to a new layout with a left sidebar, updated color palette, and a geometric grid backdrop.
  - Added page entrance and stagger animations for a more dynamic UX.
  - Updated UI components to match the new visual language (rounded pill buttons, higher-contrast accents, softer cards).
- Commands run:
  - `npm -w frontend run build`
- Result / issues:
  - Frontend builds with the new layout and motion.

## Feature 22 - Codeforces Wrapped (backend)

- Changes:
  - Added `yearRangeUtcSeconds(year)` UTC helper in `backend/src/utils/time.ts`.
  - Extended Codeforces `user.status` integration with paging params + MOCK slicing and richer problem fields.
  - Implemented `backend/src/services/wrappedService.ts` with 12h in-memory cache and required stats computations.
  - Added `GET /api/wrapped/codeforces?year=2023|2024|2025[&refresh=1]` via `backend/src/routes/wrapped.ts` and mounted it in `backend/src/app.ts`.
  - Updated `backend/test/fixtures/codeforces_user.status.json` and added `backend/test/wrappedCodeforces.test.ts`.
- Decisions:
  - Keep cache in-memory only (TTL 12h) and return warnings on partial/unavailable data instead of failing the endpoint.
- Commands run:
  - `npm -w backend test`
  - `npm -w backend run build`
- Result / issues:
  - Backend tests pass and TypeScript build succeeds.

## Feature 23 - Codeforces Wrapped (frontend story UI)

- Changes:
  - Added `/wrapped` protected route and nav link.
  - Implemented Wrapped page (`frontend/src/pages/WrappedPage.tsx`) with year chips, warnings, and “Play story”.
  - Added StoryPlayer overlay + slides (intro/solved/tags/difficulty/rating/outro) under `frontend/src/components/wrapped/*`.
  - Added story-specific CSS animations and reduced-motion handling in `frontend/src/index.css`.
- Decisions:
  - Keep story UI dependency-free (no charting/animation libraries) and respect `prefers-reduced-motion`.
- Commands run:
  - `npm -w frontend run build`
- Result / issues:
  - Frontend build succeeds; story overlay works with keyboard + tap navigation.

## Feature 24 - Wrapped stress + docs

- Changes:
  - Extended stress test to warm and load-test `GET /api/wrapped/codeforces?year=2023` in `MOCK_OJ=1`.
  - Updated `DOCUMENTATION.md` with the wrapped endpoint, UI usage notes, and stress coverage.
  - Reset `backend/data/db.json` back to an empty baseline after running stress.
- Decisions:
  - Keep stress safe by staying in `MOCK_OJ=1` and using fixtures only (no external traffic).
- Commands run:
  - `npm run test`
  - `npm run build`
  - `npm run stress`
  - `npm -w backend test`
- Result / issues:
  - Tests pass; builds succeed; stress completes and db.json remains valid.

## Feature 25 - DB + stats/realtime foundation

- Changes:
  - Extended backend domain models with user `stats/preferences/favorites` and new top-level DB arrays (`rooms`, `roomMessages`, `activities`) in `backend/src/domain/dbTypes.ts`.
  - Added DB normalization so legacy `db.json` files get missing keys and user defaults persisted in `backend/src/store/fileDb.ts`.
  - Updated registration to initialize stats/preferences/favorites defaults in `backend/src/routes/auth.ts`.
  - Added `forbidden()` (403) helper in `backend/src/middleware/errorHandler.ts`.
  - Added scaffolding services:
    - `backend/src/services/statsService.ts` (XP/levels + achievements + leaderboard helpers)
    - `backend/src/services/realtimeHub.ts` (in-memory SSE publish/subscribe)
  - Wired `statsService` + `realtimeHub` into `backend/src/utils/locals.ts` and `backend/src/app.ts`.
  - Reset tracked `backend/data/db.json` to an empty baseline with the new keys.
  - Added `backend/test/dbNormalization.test.ts`.
- Decisions:
  - Use `normalizeDb` in both `readDb()` and `updateDb()` so older DB shapes don’t crash and missing keys are persisted on the next write.
  - Model `stats.achievements` as a sparse map (`Partial<Record<...>>`) to represent “unlocked only” without inventing placeholder values.
- Commands run:
  - `npm -w backend test`
  - `npm -w backend run build`
- Result / issues:
  - Backend tests pass and the backend TypeScript build succeeds.

## Feature 26 - Rooms API (backend)

- Changes:
  - Added room request schemas (`CreateRoomSchema`, `JoinRoomSchema`, `RoomMessageSchema`) in `backend/src/domain/schemas.ts`.
  - Implemented `backend/src/services/roomService.ts` (invite codes, deterministic problem selection, membership rules, scoreboard).
  - Added `backend/src/routes/rooms.ts` with create/list/get/join/leave/start/finish endpoints.
  - Wired `roomService` into `backend/src/utils/locals.ts` and mounted `/api/rooms` in `backend/src/app.ts`.
  - Added lifecycle test `backend/test/roomsLifecycle.test.ts`.
- Decisions:
  - Generate invite codes from the specified 32-char alphabet using `crypto.randomBytes` with unbiased `byte & 31`.
  - Enforce lobby-only join/leave and host-only start/finish; non-membership/role violations return 403 via `forbidden()`.
- Commands run:
  - `npm -w backend test`
- Result / issues:
  - Room lifecycle passes in MOCK mode and existing backend tests remain green.

## Feature 27 - Rooms polling + stats on solves (backend)

- Changes:
  - Refactored submission matching into reusable helpers in `backend/src/services/submissionMatcher.ts` and kept contest behavior unchanged.
  - Extended `backend/src/services/poller.ts` to:
    - poll running rooms on the interval tick (after contests, still serialized via the existing `inFlight` guard)
    - add `pollRoomById` for manual refresh with stats updates per newly-detected solve
  - Added `POST /api/rooms/:id/refresh` in `backend/src/routes/rooms.ts`.
  - Updated `backend/src/index.ts` to pass `statsService` into the poller.
  - Added test `backend/test/roomPollerRefresh.test.ts`.
- Decisions:
  - Track AtCoder room polling per-user via `progressByUserId[userId].lastPoll.atFrom` with the same overlap window used for contests to avoid missing delayed results.
  - Grant XP per newly-added solve event via `statsService.applySolve` (including speed/difficulty bonuses and achievement checks).
- Commands run:
  - `npm -w backend test`
  - `npm -w backend run build`
- Result / issues:
  - Manual room refresh updates progress for all members in MOCK mode and backend tests/build pass.

## Feature 28 - Realtime SSE + room chat (backend+frontend)

- Changes:
  - Added SSE endpoint `GET /api/stream` in `backend/src/routes/stream.ts` (auth required, hello event, keepalive ping) and mounted it in `backend/src/app.ts`.
  - Extended rooms API with chat/message endpoints in `backend/src/routes/rooms.ts`:
    - `GET /api/rooms/:id/messages?limit=`
    - `POST /api/rooms/:id/messages` (stores in `db.roomMessages` and publishes `room_message` to members)
  - Published realtime events from `backend/src/services/poller.ts`:
    - `room_update` to room members when new solves are detected
    - `achievement` to the user when `statsService.applySolve` unlocks achievements
  - Frontend realtime wiring:
    - `frontend/src/components/ui/ToastProvider.tsx` (toasts with reduced-motion + motion-off gating)
    - `frontend/src/hooks/useRealtimeStream.ts` (EventSource + backoff + query invalidation)
    - hooked into `frontend/src/components/layout/AppShell.tsx` and wrapped app in `ToastProvider` via `frontend/src/main.tsx`
    - added `vc-toast-in` animation (and motion gating) in `frontend/src/index.css`
  - Added backend test `backend/test/streamSse.test.ts`.
- Decisions:
  - Keep SSE hub in-memory only (no persistence) and rely on react-query invalidations to refresh UI state.
  - Disable toast/story/page animations when either system reduced-motion is on or `data-motion="off"` is set.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Backend tests pass and frontend builds; SSE handshake is verified by test.

## Feature 29 - Rooms UI + chat (frontend)

- Changes:
  - Added `frontend/src/api/rooms.ts` covering rooms lifecycle, refresh, and chat message APIs.
  - Added routes and pages:
    - `frontend/src/pages/RoomsPage.tsx` (`/rooms`) create/join + rooms list
    - `frontend/src/pages/RoomPage.tsx` (`/rooms/:id`) room detail + scoreboard + problems + chat
  - Wired routes in `frontend/src/App.tsx` and added a “Rooms” nav link in `frontend/src/components/layout/AppShell.tsx`.
  - Added lightweight motion effects for rooms:
    - scoreboard row flash (`vc-score-flash`)
    - start countdown overlay (`vc-countdown-pop`)
    - message pop-in (`vc-chat-in`)
    - all gated by system reduced-motion and `data-motion="off"` in `frontend/src/index.css`.
- Decisions:
  - Rely on SSE-driven react-query invalidations (from `useRealtimeStream`) to keep room state/messages fresh without polling intervals.
  - Keep animations CSS-only and avoid additional dependencies.
- Commands run:
  - `npm -w frontend run build`
- Result / issues:
  - Frontend build succeeds with rooms pages and realtime updates via SSE.

## Feature 30 - Profile/Achievements/Leaderboard + preferences (backend+frontend)

- Changes:
  - Backend:
    - Added `backend/src/routes/profile.ts` with:
      - `GET /api/me/profile`
      - `PATCH /api/me/preferences`
      - `GET /api/leaderboard?limit=20`
      - `GET /api/achievements`
    - Mounted the router in `backend/src/app.ts`.
    - Added `PatchPreferencesSchema` in `backend/src/domain/schemas.ts`.
    - Added activity writes (bounded to 5000) for room create/join/start/finish in `backend/src/services/roomService.ts` and room messages/cache refresh in `backend/src/routes/rooms.ts` and `backend/src/routes/cache.ts`.
    - Cache refresh now unlocks the `cache_refresher` achievement via `statsService.applyCacheRefreshed`.
    - Added tests: `backend/test/profile.test.ts`, `backend/test/leaderboard.test.ts`.
  - Frontend:
    - Added `frontend/src/api/profile.ts`.
    - Added `frontend/src/pages/ProfilePage.tsx` and route `/profile` + nav link.
    - Extended `frontend/src/pages/SettingsPage.tsx` with an “Experience” section (theme/motion/effects) saving via `PATCH /api/me/preferences`.
    - Applied preferences globally in `frontend/src/components/layout/AppShell.tsx` by setting `document.documentElement.dataset.theme` and resolved `data-motion`.
- Decisions:
  - Keep preferences application DOM-only (dataset attributes) so CSS can gate animations/effects without extra dependencies.
  - Store recent activity as a simple bounded append-only list in `db.activities` (no DB, no indexing).
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Backend tests pass; frontend builds; profile/leaderboard/preferences endpoints are covered by tests in MOCK mode.

## Feature 31 - Problem explorer + favorites (backend+frontend)

- Changes:
  - Backend:
    - Added `backend/src/services/problemIndexService.ts` to build a cached `NormalizedProblem[]` index from cache files (invalidates on `meta.updatedAt` change).
    - Added `backend/src/routes/problems.ts` with `GET /api/problems/search` (cursor pagination).
    - Added favorites endpoints in `backend/src/routes/me.ts`:
      - `GET /api/me/favorites`
      - `POST /api/me/favorites`
      - `DELETE /api/me/favorites/:platform/:key`
    - Wired `problemIndexService` into `backend/src/utils/locals.ts` and `backend/src/app.ts`, and mounted `/api/problems`.
    - Added tests: `backend/test/problemsSearch.test.ts`, `backend/test/favorites.test.ts`.
  - Frontend:
    - Added `frontend/src/api/problems.ts` and `frontend/src/pages/ProblemsPage.tsx` (`/problems`) with search + pagination + favorite toggles and a favorites panel.
    - Added “Problems” nav link and route.
    - Added a small favorite pulse animation (`vc-fav-pulse`) with reduced-motion + motion-off gating in `frontend/src/index.css`.
- Decisions:
  - Keep search fully cache-backed (no live OJ calls) and paginate with a simple base64 cursor `{ offset }`.
  - Store favorites as snapshots (name/url/difficulty/tags) so they remain usable even if caches change later.
- Commands run:
  - `npm -w backend test`
  - `npm -w frontend run build`
- Result / issues:
  - Backend tests pass and frontend builds; problem search and favorites work in MOCK mode without external traffic.

## Feature 32 - Effects Lab + motion pack (frontend)

- Changes:
  - Added `frontend/src/pages/EffectsLabPage.tsx` and route `/effects` for previewing motion/effects.
  - Added theme overrides (`aurora`/`sunset`/`midnight`) and effect animation CSS (shimmer, float, neonPulse) with reduced-motion + `data-motion="off"` gating in `frontend/src/index.css`.
  - Wired global optional effects in `frontend/src/components/layout/AppShell.tsx`:
    - particles backdrop
    - ambient gradient overlay
    - glow cursor
- Decisions:
  - Keep all effects opt-in via `user.preferences.effects` and disable canvas/animations when either system reduced-motion is enabled or user motion is off.
- Commands run:
  - `npm -w frontend run build`
- Result / issues:
  - Frontend build succeeds; effects are gated by reduced-motion and motion preferences.

## Feature 33 - Stress extension + docs + db baseline reset

- Changes:
  - Extended `backend/scripts/stress.ts` (MOCK-only) to cover:
    - two users + `/api/me/profile` validation (`cache_refresher`)
    - room create/join/start/refresh + chat messages
    - problem search + favorite/unfavorite flow
    - added autocannon coverage for rooms/leaderboard/problems endpoints (kept existing contests + wrapped coverage)
  - Updated `DOCUMENTATION.md` stress notes to match the expanded coverage and added a short `/effects` usage note.
  - Reset `backend/data/db.json` back to the empty baseline after the stress run.
- Decisions:
  - Keep stress safe by forcing `MOCK_OJ=1` and avoiding any external OJ traffic while still exercising the new APIs under load.
- Commands run:
  - `npm run test`
  - `npm run build`
  - `npm run stress`
- Result / issues:
  - Tests pass; build succeeds; stress completes and `db.json` is restored to a clean baseline.
