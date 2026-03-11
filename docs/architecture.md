# Architecture

Detailed architecture, stack decisions, and design rationale for the Brenlets VFL Hub. For the high-level overview, see [CLAUDE.md](../CLAUDE.md).

---

## Stack Decisions

| Layer    | Decision                                        | Rationale                                                                                                                               |
| -------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Language | TypeScript throughout                           | Type safety, modern tooling                                                                                                             |
| Fetcher  | Node.js + VFL JSON API (`fetch`)                | VFL exposes public endpoints for event metadata and team scores — no browser needed                                                     |
| Database | Postgres on Railway                             | Vercel serverless has no persistent disk — SQLite can't work in production                                                              |
| Web App  | Hono (server/API) + Preact (frontend) on Vercel | Hono is Web Standards-compatible (works in both Node.js and serverless). Preact supports week-over-week navigation without page reload. |
| Cron     | GitHub Actions scheduled workflow               | No separate infrastructure needed, integrates with the repo                                                                             |

**What changed during development:** The scraper originally used Cheerio (plain HTTP), then Playwright (headless Chromium) when we discovered VFL renders client-side. In March 2026, we replaced Playwright entirely with direct JSON API calls after discovering VFL's public API endpoints — no browser, no DOM parsing, just `fetch`. SQLite was initially chosen for simplicity but replaced by Postgres — Vercel's serverless model has no persistent disk. Express was considered but Hono was chosen for Web Standards compatibility. Plain HTML was considered for the frontend but React was chosen to support game week navigation — later migrated to Preact for a smaller bundle (~3KB vs ~45KB gzipped) with an identical API.

---

## Component Details

### Fetcher (API Client)

Calls the VFL JSON API to fetch event metadata and team scores. No browser, no DOM parsing — just HTTP requests and JSON responses.

**Two VFL endpoints:**

- `GET /api/event/currentevent` — returns the current event's metadata: name, ID, gameweek periods (with start/end timestamps), and all event matches (with `isComplete` and `havePointsBeenAssigned` flags)
- `GET /api/fantasyteam/team?userId=N&eventId=N&gameweek=N` — returns an individual team's name, gameweek points, and player breakdown

**Event detection:** `fetchCurrentEvent()` calls `/api/event/currentevent`. The response includes the event name and ID directly — no parsing a dropdown or normalizing suffixes. The endpoint is assumed to auto-transition between events as VFL progresses through the season.

**Scoreable gameweek filtering:** `scoreableGameweeks(event)` examines the `eventMatches` array and collects gameweeks where at least one match has `havePointsBeenAssigned: true`. This prevents writing 0-point rows for gameweeks that haven't been played yet, and supports mid-gameweek daily updates (e.g. Day 1 of a 3-day GW has partial scores).

**Team fetching:** `fetchAll(teams)` iterates all scoreable gameweeks × all teams from `config/teams.json`, calling `/api/fantasyteam/team` for each combination. One team's failure doesn't stop others — errors are captured and the team is skipped during the batch save.

### Database

Postgres on Railway, accessed via `node-postgres` (`pg`). The `VflDatabase` class manages a connection pool.

**Lazy initialization:** The pool is created on first request and reused across subsequent requests. In Vercel serverless, warm invocations reuse the pool; cold starts create a new one. Schema migrations (`CREATE TABLE IF NOT EXISTS`) are idempotent.

**Upsert mechanics:** Both `upsertTeam` and `upsertScore` use Postgres `ON CONFLICT ... DO UPDATE`. Re-fetching the same event + game week updates the existing row. This makes fetching idempotent — safe to re-run at any time.

**Batch saves:** `saveScrapeBatch` runs inside a transaction. It skips entries with errors or missing data, then upserts teams and scores for the valid entries. If any insert fails (e.g. invalid URL), the entire transaction rolls back — no partial writes.

### Web App

The Hono app definition (`src/web/app.ts`) is separated from the server entry point. This lets the same app be used by:

- `src/web/server.ts` — local dev via `@hono/node-server`, also serves static Preact build
- `api/index.ts` — Vercel serverless function (single re-export)

The DB is lazily initialized via a module-level `getDb()` function. A global error handler (`app.onError`) catches unhandled errors, logs them, and returns a generic 500 to the client.

### Cron / Scheduler

GitHub Actions workflow (`.github/workflows/scrape.yml`) with three triggers:

- **Schedule:** Every 15 minutes from 22:00–03:00 UTC (6PM–10PM Eastern, covers both EST and EDT). Matches end by ~7PM ET; frequent runs catch scores as soon as VFL updates.
- **Push:** When `config/teams.json` changes
- **Manual:** `workflow_dispatch` from the GitHub Actions UI

The workflow runs the fetcher and writes directly to Railway Postgres via the `DATABASE_URL` secret. No file artifacts or "commit data to repo" patterns. No browser installation required.

---

## VFL API

VFL exposes a public JSON API at `api.valorantfantasyleague.net`. Two endpoints are used:

| Endpoint                                                  | Purpose                                        | Auth |
| --------------------------------------------------------- | ---------------------------------------------- | ---- |
| `GET /api/event/currentevent`                             | Event metadata, gameweek periods, match status | None |
| `GET /api/fantasyteam/team?userId=N&eventId=N&gameweek=N` | Individual team scores per gameweek            | None |

The API is undocumented and could change without notice. Key behaviors discovered through testing:

- Omitting the `gameweek` param returns null fields (not an error)
- Requesting a gameweek that doesn't exist returns null fields
- Requesting a gameweek with no matches played yet returns 0 points
- `havePointsBeenAssigned` on each match is the reliable signal for whether scores are final

**History:** The API was originally investigated and rejected (Feb 2026) because game week metadata appeared to require authentication. The `/api/event/currentevent` endpoint was discovered later (March 2026) and provides all needed metadata without auth. This made Playwright unnecessary. See [decisions/api-migration.md](decisions/api-migration.md).

---

## Testing Philosophy

**Unit tests for pure functions** (`extractUserId`, `scoreableGameweeks`) cover URL parsing edge cases and the gameweek filtering logic that determines which weeks get written to the database. These are the critical decision points — getting them wrong means writing garbage data or missing real scores.

**DB integration tests** run against a dedicated `vfl_test` database in the local Docker Postgres container, isolated from dev data. Each test drops and recreates tables for a clean slate. Tests cover upsert semantics, transaction rollback, standings ordering, event isolation, and batch save edge cases.

**No snapshot tests.** Evaluated and rejected — see the reasoning in the Playwright-era version of this doc (git history). The conclusion still holds: snapshot tests for external data sources train you to ignore failures.

---

## Access Model

- **Standings page:** Fully public, no authentication, read-only
- **Team roster:** Managed via `config/teams.json` in the repo. The commissioner edits the JSON file and commits. Pushing the change triggers an automatic fetch.
- **User accounts / membership:** Deferred
- **Admin UI for roster management:** Deferred
- **Discord bot:** Deferred

---

## Known Risks

**VFL could change or remove their API.** The API is undocumented and we have no relationship with VFL. If endpoints change shape or disappear, the fetcher breaks. Mitigation: the fetcher is simple enough to adapt quickly, and the unit tests validate the contract we depend on.

**`/api/event/currentevent` may not auto-transition between events.** We assume this endpoint returns the active event and will switch when VFL moves to the next event (e.g. Stage 1 → Masters London). If it doesn't, we'd need to discover event IDs another way. Low risk — VFL's own site presumably uses this endpoint.

**Team names are volatile.** Team IDs (e.g. `/team/22832`) don't change, but team names change frequently. The fetcher re-fetches the name on every run and updates the `teams` row — always reflecting the current name. Historical names are not tracked.

**The team URL list needs manual maintenance.** If a manager joins or leaves, someone edits `config/teams.json` and commits. Pushing the change triggers an automatic fetch.
