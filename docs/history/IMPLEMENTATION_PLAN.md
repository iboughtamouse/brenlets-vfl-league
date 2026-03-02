# Implementation Plan

> **Historical document.** Build plan from initial development. All phases are complete. For current architecture, see [CLAUDE.md](../../CLAUDE.md).

Full build plan from initial development through production deployment. Phases are sequential — complete one before starting the next. Each phase has a clear "done when" gate.

---

## Phase 1 — Scraper & Data Layer ✅

Build the pipeline that fetches team data from VFL and persists it.

- [x] Fetch one team page, inspect rendered HTML, confirm DOM selectors
- [x] Build parser module (`parseGwLabel`) with unit tests
- [x] Build Playwright-based scraper that visits all team pages
- [x] Populate `teams.json` with full league roster
- [x] Design SQLite schema (`teams` + `scores` tables) → migrating to Postgres
- [x] Implement `VflDatabase` class with upsert semantics → rewriting for Postgres
- [x] Wire scraper output → database writes (`saveScrapeBatch`)
- [x] Integration tests for DB layer
- [x] Fixture-based test for scraper DOM extraction
- [x] Verify full pipeline: scrape all teams → save to DB

**Done when:** `npm run scrape` fetches every team page, parses game week + points, and writes to the database. All tests pass.

> **Note:** Phase 1 was built with SQLite. The Postgres migration (Phase 1.5) replaces the storage layer while preserving the same interface.

---

## Phase 1.5 — Postgres Migration ✅

Swap SQLite for Postgres. The web app deploys to Vercel (serverless — no persistent disk), so SQLite can't work in production. Postgres on Railway is accessible from both Vercel and GitHub Actions.

- [x] Spin up local Postgres via Docker for development
- [x] Install `pg` (node-postgres) and types
- [x] Rewrite `VflDatabase` class: same interface, async methods, Postgres queries
- [x] Update `scrape-all.ts` for async DB calls
- [x] Update `server.ts` for async DB calls
- [x] Migrate all DB integration tests to Postgres
- [x] Remove `better-sqlite3` dependency and `data/` directory
- [x] Verify full pipeline against local Postgres

**Done when:** All existing functionality works identically but backed by Postgres. Tests pass against a real local Postgres instance. No SQLite references remain.

---

## Phase 2 — Standings Web App ✅

Serve standings data through a web UI. Prove the full read path: Postgres → API → browser.

- [x] Choose web framework → Hono
- [x] Choose frontend approach → React (via Vite) → later migrated to Preact
- [x] Install dependencies (Hono, @hono/node-server)
- [x] Build Hono server with API routes (`/api/standings`, `/api/standings/weeks`)
- [x] Set up Vite for client build
- [x] Build standings table component (fetches from API, renders table)
- [x] Wire Hono to serve the built client app
- [x] Add `dev` scripts for both server and client
- [x] Verify end-to-end: real scraped data renders in browser

**Done when:** Running the dev server shows a standings table populated from Postgres.

---

## Phase 3 — Scheduled Scraping ✅

Automate the scraper so standings update without manual intervention.

- [x] Create GitHub Actions workflow for scheduled scraping
- [x] Configure cron schedule (daily at 10:00 UTC)
- [x] Store Railway Postgres connection string as a GitHub Actions secret (`DATABASE_URL` → public URL)
- [x] Scraper connects to Railway Postgres from CI and writes directly
- [ ] Add error reporting: surface failures visibly (GitHub Actions notifications, or a simple Discord webhook)
- [x] Test the workflow manually via `workflow_dispatch` before relying on the schedule

**Done when:** Standings update automatically on schedule without human intervention. Failures are visible.

> **Note:** Error reporting (Discord webhook or similar) deferred — GitHub Actions already emails on failure by default. Will revisit if silent failures become an issue.

---

## Phase 4 — Production Deployment & Hardening

Deploy the web app and make it reliable enough to run unattended.

- [x] Deploy Hono + Preact app to Vercel
- [x] Provision Postgres on Railway, configure connection string
- [x] Add global error handling to the Hono server (`app.onError`)
- [ ] Refactor server to accept injected DB (factory function) for testability
- [ ] Add route-level smoke tests for API endpoints
- [x] Configure production environment (env vars, connection strings)
- [x] Verify scraper → Postgres → Vercel pipeline works end-to-end in production
- [x] Basic health check (`/health` endpoint)

**Done when:** App is live on the internet, updates automatically, and recovers gracefully from transient failures.

---

## Resolved Decisions

Questions that were open and have been answered:

- **Hosting:** Vercel (web app) + Railway (Postgres). Both already on paid plans.
- **Database:** Postgres on Railway. SQLite was the original choice but doesn't work on Vercel's serverless model. Postgres is accessible from all three environments (local dev, GitHub Actions, Vercel).
- **Scraper-to-production DB flow:** GitHub Actions runs the scraper on a schedule and writes directly to Railway Postgres over the network. No file transfer, no binary commits.
- **Admin area:** Deferred. Team list managed via `teams.json` commits. Revisit if the league grows or the commissioner needs a UI.
