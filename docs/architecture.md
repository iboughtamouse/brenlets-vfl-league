# Architecture

Detailed architecture, stack decisions, and design rationale for the Brenlets VFL Hub. For the high-level overview, see [CLAUDE.md](../CLAUDE.md).

---

## Stack Decisions

| Layer    | Decision                                        | Rationale                                                                                                                               |
| -------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Language | TypeScript throughout                           | Type safety, modern tooling                                                                                                             |
| Scraper  | Node.js + Playwright (headless Chromium)        | VFL renders client-side; plain HTTP returns "Loading team data..."                                                                      |
| Database | Postgres on Railway                             | Vercel serverless has no persistent disk — SQLite can't work in production                                                              |
| Web App  | Hono (server/API) + Preact (frontend) on Vercel | Hono is Web Standards-compatible (works in both Node.js and serverless). Preact supports week-over-week navigation without page reload. |
| Cron     | GitHub Actions scheduled workflow               | No separate infrastructure needed, integrates with the repo                                                                             |

**What changed during development:** Cheerio was the original choice for scraping but was replaced by Playwright when we discovered VFL requires JavaScript rendering. SQLite was initially chosen for simplicity but replaced by Postgres — Vercel's serverless model has no persistent disk. Express was considered but Hono was chosen for Web Standards compatibility. Plain HTML was considered for the frontend but React was chosen to support game week navigation — later migrated to Preact for a smaller bundle (~3KB vs ~45KB gzipped) with an identical API.

---

## Component Details

### Scraper

Uses Playwright to launch headless Chromium and visit each team page. The VFL site is a Next.js app that renders all team data client-side — a plain HTTP GET returns only a loading placeholder.

**Event detection:** Before scraping team pages, the scraper visits `/leaderboard` and reads the "Current Event" dropdown. The selector strategy: find `<label>` with text "Current Event" → parent `<div>` → first `<button>` → textContent. The raw name is then normalized by `normalizeEventName` (strips trailing ": Week N" suffixes that VFL appends once matches begin). This ensures a stable event identifier across the entire event — the game week is already captured separately from each team page.

**Team scraping:** For each team in `config/teams.json`, the scraper navigates to the team URL, waits for `[data-testid="team-page"]` (15s timeout), then extracts:

- Team name from `.text-5xl` (uses DOM cloning + child removal to isolate the text node)
- GW label from `.text-5xl .text-2xl` (e.g. "GW 1: 457 PTS") — the color class varies by score, so we match on size class instead

Teams are scraped sequentially using a single browser instance. One team's failure doesn't stop others — errors are captured and the team is skipped during the batch save.

### Database

Postgres on Railway, accessed via `node-postgres` (`pg`). The `VflDatabase` class manages a connection pool.

**Lazy initialization:** The pool is created on first request and reused across subsequent requests. In Vercel serverless, warm invocations reuse the pool; cold starts create a new one. Schema migrations (`CREATE TABLE IF NOT EXISTS`) are idempotent.

**Upsert mechanics:** Both `upsertTeam` and `upsertScore` use Postgres `ON CONFLICT ... DO UPDATE`. Re-scraping the same event + game week updates the existing row. This makes scraping idempotent — safe to re-run at any time.

**Batch saves:** `saveScrapeBatch` runs inside a transaction. It skips entries with errors or missing data, then upserts teams and scores for the valid entries. If any insert fails (e.g. invalid URL), the entire transaction rolls back — no partial writes.

### Web App

The Hono app definition (`src/web/app.ts`) is separated from the server entry point. This lets the same app be used by:

- `src/web/server.ts` — local dev via `@hono/node-server`, also serves static Preact build
- `api/index.ts` — Vercel serverless function (single re-export)

The DB is lazily initialized via a module-level `getDb()` function. A global error handler (`app.onError`) catches unhandled errors, logs them, and returns a generic 500 to the client.

### Cron / Scheduler

GitHub Actions workflow (`.github/workflows/scrape.yml`) with three triggers:

- **Schedule:** Hourly from 23:00–15:00 UTC (7PM–10AM Eastern, covers both EST and EDT). Matches run ~12PM–7PM Eastern; the schedule starts after the last match concludes and runs through the night to capture final scores.
- **Push:** When `config/teams.json` changes
- **Manual:** `workflow_dispatch` from the GitHub Actions UI

The workflow installs Playwright Chromium, runs the scraper, and writes directly to Railway Postgres via the `DATABASE_URL` secret. No file artifacts or "commit data to repo" patterns.

---

## VFL API Investigation

`api.valorantfantasyleague.net` was investigated as an alternative to scraping. Team data endpoints work without auth, but game week metadata requires authentication — and VFL auth expires randomly and requires Discord-based registration. The API is undocumented and could change without notice. We chose to read the rendered page instead: more stable, no auth dependency, and we see exactly what users see.

---

## Testing Philosophy

**Fixture-based scraper tests** over snapshot tests. VFL pages contain too much noise (scripts, ads, player rosters, Next.js hydration data) for snapshots to be useful — they'd trip on every irrelevant change and train us to ignore them. Instead, a saved HTML fixture (`fixtures/team-page-22832.html`) is loaded into happy-dom and tested with explicit assertions against the specific selectors the scraper uses. When VFL changes their markup, the test fails and shows exactly which field broke.

**DB integration tests** run against a dedicated `vfl_test` database in the local Docker Postgres container, isolated from dev data. Each test drops and recreates tables for a clean slate. Tests cover upsert semantics, transaction rollback, standings ordering, event isolation, and batch save edge cases.

**No E2E browser tests for v1.** The web app is a thin read-only layer over the database — the risk is in the scraper and data layer, which are well-tested.

---

## Access Model

- **Standings page:** Fully public, no authentication, read-only
- **Team roster:** Managed via `config/teams.json` in the repo. The commissioner edits the JSON file and commits. Pushing the change triggers an automatic scrape.
- **User accounts / membership:** Deferred
- **Admin UI for roster management:** Deferred
- **Discord bot:** Deferred

---

## Known Risks

**VFL could change their HTML structure.** If they redesign the site, the scraper's selectors break. The fixture-based test catches this quickly — it runs the same selectors against saved markup.

**VFL could add bot detection.** Currently there is none. Playwright handles JavaScript execution, so basic JS challenges wouldn't be a problem. CAPTCHAs or IP blocking would require a different approach. Low likelihood for a small fan site.

**Team names are volatile.** Team IDs (e.g. `/team/22832`) don't change, but team names change frequently. The scraper re-fetches the name on every scrape and updates the `teams` row — always reflecting the current name. Historical names are not tracked.

**The team URL list needs manual maintenance.** If a manager joins or leaves, someone edits `config/teams.json` and commits. Pushing the change triggers an automatic scrape.

---

## Proof of Concept

Before implementation, the scraping approach was validated manually. All team pages were fetched with no authentication required and no rate limiting observed. Page structure was consistent across all teams.

The initial PoC used plain HTTP (Cheerio), which appeared to work because the browser had already rendered the page. VFL is actually a Next.js app that renders all team data client-side — a plain HTTP GET returns only "Loading team data...". The scraper was switched to Playwright (headless Chromium) to handle client-side rendering.
