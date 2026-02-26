# Technical Overview

> **Note:** This document was written before implementation began and has been updated to reflect what was actually built. The current source of truth for architecture and stack decisions is [.github/copilot-instructions.md](.github/copilot-instructions.md).

## Proof of Concept

Before implementation, the scraping approach was validated manually. All team pages were fetched with no authentication required and no rate limiting observed. Page structure was consistent across all teams.

**What changed:** The initial PoC used plain HTTP, which appeared to work because the browser had already rendered the page. VFL is actually a Next.js app that renders all team data client-side — a plain HTTP GET returns only "Loading team data...". The scraper was switched from Cheerio to Playwright (headless Chromium) to handle client-side rendering.

---

## Architecture

```
[ valorantfantasyleague.net ]
        |
        | Playwright (headless Chromium, nightly cron via GitHub Actions)
        v
[ Scraper (GitHub Actions) ] --> [ Postgres (Railway) ] <-- [ Web App (Vercel) ] --> [ Browser ]
```

### Components

**Scraper**

- Uses Playwright to launch headless Chromium and visit each team page
- Waits for the page to fully render (`[data-testid="team-page"]` selector), then reads the team name and game week label from the DOM
- Game week label (e.g. "GW 1: 0 PTS") is parsed by a dedicated parser function
- Writes results to the database with upsert semantics
- Runs nightly via GitHub Actions, on push to `config/teams.json`, or on-demand via `npm run scrape`

**Database**

- Postgres on Railway (accessed via node-postgres `pg`)
- `teams` table: `vfl_id` (integer PK from URL), `manager`, `url`, `team_name`
- `scores` table: `team_vfl_id` (FK), `game_week`, `points`, `scraped_at`, with a unique constraint on `(team_vfl_id, game_week)`
- Upsert on re-scrape; all distinct game weeks preserved for history
- Local dev uses Docker (postgres:17-alpine)

**Web App**

- Hono (API routes) + React (frontend) on Vercel
- API: `/api/standings`, `/api/standings/weeks`, `/health`
- Hono app definition separated from server entry point — shared by local dev (`@hono/node-server`) and production (`api/index.ts` serverless function)
- Global error handler (`app.onError`) catches unhandled errors
- Fully public, read-only — no user accounts

**Cron / Scheduler**

- GitHub Actions scheduled workflow (daily at 10:00 UTC)
- Also triggers on push when `config/teams.json` changes
- Manual trigger via `workflow_dispatch`

---

## Stack

| Layer    | Decision                                       |
| -------- | ---------------------------------------------- |
| Language | TypeScript throughout                          |
| Scraper  | Node.js + Playwright (headless Chromium)       |
| Database | Postgres on Railway                            |
| Web App  | Hono (server/API) + React (frontend) on Vercel |
| Hosting  | Vercel (web app) + Railway (database)          |
| Cron     | GitHub Actions scheduled workflow              |

**What changed from the original plan:** Cheerio was replaced by Playwright because VFL requires JavaScript rendering. SQLite was initially chosen for simplicity but replaced by Postgres — Vercel's serverless model has no persistent disk, so SQLite can't work in production. Express was considered but Hono was chosen for its Web Standards compatibility (works in both Node.js and serverless). Plain HTML was considered for the frontend but React was chosen to support week-over-week navigation.

---

## Known Risks and Constraints

**VFL could change their HTML structure.**
If they redesign the site, the scraper's selectors break. The parser unit tests against a saved HTML fixture will catch this quickly.

**VFL could add bot detection.**
Currently there is none. Playwright already handles JavaScript execution, so basic JS challenges wouldn't be a problem. CAPTCHAs or IP blocking would require a different approach. Low likelihood for a small fan site.

**A VFL API exists but is unreliable.**
`api.valorantfantasyleague.net` was investigated. Team data endpoints work without auth, but game week metadata requires authentication — and VFL auth expires randomly and requires Discord-based registration. We chose to read the rendered page instead: more stable, no auth dependency, and we see exactly what users see.

**Team URLs are static but team names are not.**
Team IDs (e.g. `/team/22832`) don't change, but team names change frequently. The scraper re-fetches the name on every scrape and updates the `teams` row.

**The team URL list needs manual maintenance.**
Stored in `config/teams.json`. If a manager joins or leaves, someone edits the JSON file and commits. Pushing the change triggers an automatic scrape.

---

## Resolved Questions

All open questions from the planning phase have been answered:

- **Team URL list:** JSON config file committed to the repo.
- **Game week identification:** Parsed from the rendered page. The VFL team page displays "GW 1: 0 PTS" directly below the team name.
- **Site access:** Public standings, no admin UI. Team list managed via `teams.json` commits.
- **Discord bot:** Deferred to v2. Website is the source of truth.
