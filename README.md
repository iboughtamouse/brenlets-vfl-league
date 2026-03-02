# Brenlets VFL Hub

Automated standings tracker for the [Brenlets VFL](https://www.valorantfantasyleague.net/) fantasy Valorant league. Scrapes team pages hourly during match hours, stores scores in Postgres, and serves a public standings page.

**Live at:** [brenlets-vfl-league.vercel.app](https://brenlets-vfl-league.vercel.app/)

## How It Works

VFL is a Next.js app — team data is rendered client-side. A Playwright-based scraper visits each team page, waits for the JavaScript to render, and reads the team name, game week, and points from the DOM. Results are saved to Postgres with upsert semantics (re-scraping the same event + game week updates rather than duplicates; all distinct event/game week combinations are preserved for history).

The scraper runs hourly (during match hours) via GitHub Actions and writes directly to Railway Postgres. The web app (Hono + React on Vercel) reads from the same database and serves the standings page.

## Architecture

```
[ valorantfantasyleague.net ]
        |
        | Playwright (headless Chromium, scheduled via GitHub Actions)
        v
[ Scraper (GitHub Actions) ] --> [ Postgres (Railway) ] <-- [ Web App (Vercel) ] --> [ Browser ]
```

## Project Structure

```
config/teams.json       — League roster (manager name + VFL URL)
src/scraper/parser.ts   — Pure parsing functions (GW labels + event name normalization)
src/scraper/index.ts    — Playwright scraper (visits pages, extracts data)
src/db/index.ts         — Postgres database layer (schema, queries, batch save)
src/web/app.ts          — Hono app with API routes (shared by dev + Vercel)
src/web/server.ts       — Local dev server (@hono/node-server + static files)
api/index.ts            — Vercel serverless entry point
client/                 — React frontend (Vite)
scripts/scrape-all.ts   — CLI entry point: scrape all teams → save to DB
fixtures/               — Saved HTML fixture for testing
tests/                  — Vitest unit + integration tests
.github/workflows/      — GitHub Actions (scheduled scraping)
```

## Setup

```bash
npm install
npx playwright install chromium
```

For local development with the full stack, you also need Docker for a local Postgres instance. See [docs/architecture.md](docs/architecture.md) for stack decisions and component details.

## Usage

```bash
# Run the scraper against all teams and save to database
npm run scrape

# Start the dev server (API + client)
npm run dev:server

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

## Status

The app is live and updating automatically. Scraper runs hourly during match hours via GitHub Actions, data is stored in Railway Postgres, and the standings page is served from Vercel.

**For AI agents:** Start with [CLAUDE.md](CLAUDE.md). For architecture details, see [docs/architecture.md](docs/architecture.md).
