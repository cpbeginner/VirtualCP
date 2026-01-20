# VirtualCP - Documentation

## Requirements

- Node.js 20+
- npm 9+

## Install

```bash
npm install
```

## Dev

1) Configure env files:

- Backend: copy `backend/.env.example` -> `backend/.env` and set `JWT_SECRET`.
- Frontend: copy `frontend/.env.example` -> `frontend/.env` (optional; defaults are OK).

2) Start both apps:

```bash
npm run dev
```

## Env vars

Backend: `backend/.env` (see `backend/.env.example`)

- `PORT` (default `3001`)
- `JWT_SECRET` (required)
- `MOCK_OJ=0|1` (use fixtures instead of real OJ network calls)
- `POLL_INTERVAL_SECONDS` (default `30`)

Frontend: `frontend/.env` (see `frontend/.env.example`)

- `VITE_API_BASE` (default `http://localhost:3001/api`)

## API endpoints

All endpoints are under `/api`. All except `/api/auth/*` require the `vc_token` auth cookie.

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`

User:
- `GET /api/me`
- `PATCH /api/me/handles`
- `GET /api/me/ratings`
- `GET /api/me/profile`
- `PATCH /api/me/preferences`

Stats:
- `GET /api/leaderboard?limit=20`
- `GET /api/achievements`

Cache:
- `GET /api/cache/status`
- `POST /api/cache/refresh`

Contests:
- `POST /api/contests`
- `GET /api/contests`
- `GET /api/contests/:id`
- `DELETE /api/contests/:id`
- `POST /api/contests/:id/start`
- `POST /api/contests/:id/finish`
- `POST /api/contests/:id/refresh`

Rooms:
- `POST /api/rooms`
- `GET /api/rooms`
- `GET /api/rooms/:id`
- `POST /api/rooms/:id/join`
- `POST /api/rooms/:id/leave`
- `POST /api/rooms/:id/start`
- `POST /api/rooms/:id/finish`
- `POST /api/rooms/:id/refresh`
- `GET /api/rooms/:id/messages?limit=50`
- `POST /api/rooms/:id/messages`

Stream (SSE):
- `GET /api/stream`

Problems:
- `GET /api/problems/search`

Favorites:
- `GET /api/me/favorites`
- `POST /api/me/favorites`
- `DELETE /api/me/favorites/:platform/:key`

Wrapped:
- `GET /api/wrapped/codeforces?year=2023|2024|2025[&refresh=1]`

## Data storage (no DB)

- Persistent state: `backend/data/db.json`
- `db.json` top-level keys: `users`, `contests`, `rooms`, `roomMessages`, `activities`
- Writes are protected with `proper-lockfile` and atomic temp-file writes to stay safe under concurrent HTTP + poller writes.
- Cache files:
  - `backend/data/cache/codeforces_problemset.json`
  - `backend/data/cache/atcoder_merged_problems.json`
  - `backend/data/cache/atcoder_problem_models.json`
  - `backend/data/cache/meta.json`

## Cache refresh

- Codeforces uses `problemset.problems` with strict throttling (<= 1 request / 2s).
- AtCoder Problems datasets are fetched from `kenkoooo.com` with strict throttling (sleep > 1s).
- If caches are missing, contest generation returns a clear error prompting you to refresh.
- `/api/problems/search` also depends on caches (refresh in Settings first).

## MOCK_OJ mode

When `MOCK_OJ=1`, the backend integrations read local fixtures instead of making network requests. Fixtures live in `backend/test/fixtures/`.

This mode is used by automated tests and by `npm run stress` to avoid hammering real Codeforces/AtCoder.

## Contest generation notes

- `cfTags` filtering is OR (any matching tag).
- `excludeAlreadySolved` removes problems already solved by the user (best-effort for AtCoder via pagination).
- `POST /api/contests` supports two modes:
  - Legacy: `platforms` + `count` + global ranges (`cfRatingMin/Max`, `atDifficultyMin/Max`).
  - Per-problem: `problemSpecs: [{ platform, min?, max? }]` (min/max apply to Codeforces rating or AtCoder difficulty for that slot).

## Ratings

- Codeforces ratings use `user.rating`.
- AtCoder ratings use the public user history JSON (`/users/{user}/history/json`).
- The Settings page renders a simple rating graph and basic stats (current, max, contests). Failures are shown as warnings.

## Wrapped (Codeforces)

- Endpoint: `GET /api/wrapped/codeforces?year=2023|2024|2025` (auth required).
- If you add `&refresh=1`, the backend bypasses its in-memory cache and recomputes.
- Responses include `warnings` (e.g., if Codeforces history is unavailable or truncated).
- UI: open `/wrapped`, pick a year chip, then click "Play story".

## Preferences / Motion

- Preferences are stored per-user in `db.json` under `user.preferences`.
- Motion has three modes:
  - `system`: respects `prefers-reduced-motion`
  - `on`: enable motion
  - `off`: disable motion (animations/effects)
- UI: open `/effects` to preview effects and quickly toggle preferences.

## Poller behavior and rate limits

- Backend periodically checks real submissions and updates contest progress.
- Codeforces: `user.status` throttled to <= 1 request / 2s.
- AtCoder submissions: `user/submissions` throttled to > 1s between requests.
- Polling only runs for contests in `running` status. Manual refresh (`POST /api/contests/:id/refresh`) polls a single contest.
- AtCoder polling uses a small overlap window and does not advance `from_second` on empty results to avoid missing delayed submissions.

## Stress test (MOCK_OJ=1)

```bash
npm run stress
```

Runs a safe stress test that does not call real Codeforces/AtCoder by enabling `MOCK_OJ=1`. It:

- Creates two test users
- Refreshes caches once and validates `GET /api/me/profile` (includes `cache_refresher` achievement)
- Creates a contest and a room (join/start/refresh) and posts room chat messages
- Exercises problem search + favorite/unfavorite flow
- Warms the wrapped endpoint once (`GET /api/wrapped/codeforces?year=2023`)
- Runs `autocannon` against key endpoints (contests, rooms, refresh, wrapped, leaderboard, problems search)
- Verifies `backend/data/db.json` remains valid JSON and contains the expected top-level keys afterward

## Limitations

- AtCoder Problems is an unofficial third-party API; availability may vary.
- `excludeAlreadySolved` may be slower for large AtCoder accounts (it paginates submissions in batches of 500 with throttling).
