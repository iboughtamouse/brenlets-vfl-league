# Brenlets VFL Hub

Automated standings tracker for the [Brenlets VFL](https://www.valorantfantasyleague.net/) fantasy Valorant league. Fetches scores from the VFL JSON API on a schedule after matches conclude, stores them in Postgres, and serves a public standings page.

**Live at:** [brenlets-vfl-league.vercel.app](https://brenlets-vfl-league.vercel.app/)

## How It Works

The fetcher calls VFL's public JSON API to get the current event metadata and each team's scores per gameweek. It uses the `havePointsBeenAssigned` flag on matches to determine which gameweeks are ready, then fetches scores for all teams across those gameweeks. Results are saved to Postgres with upsert semantics (re-fetching the same event + game week updates rather than duplicates; all distinct event/game week combinations are preserved for history).

The fetcher runs every 15 minutes (6PM–10PM Eastern, after matches conclude) via GitHub Actions and writes directly to Railway Postgres. The web app (Hono + Preact on Vercel) reads from the same database and serves the standings page.

## Architecture

```
[ api.valorantfantasyleague.net ]
        |
        | JSON API (scheduled via GitHub Actions)
        v
[ Fetcher (GitHub Actions) ] --> [ Postgres (Railway) ] <-- [ Web App (Vercel) ] --> [ Browser ]
```

## Project Structure

```
config/teams.json       — League roster (manager name + VFL URL)
src/scraper/index.ts    — VFL API client (fetchAll, fetchCurrentEvent, scoreableGameweeks)
src/db/index.ts         — Postgres database layer (schema, queries, batch save)
src/web/app.ts          — Hono app with API routes (shared by dev + Vercel)
src/web/server.ts       — Local dev server (@hono/node-server + static files)
api/index.ts            — Vercel serverless entry point
client/                 — Preact frontend (Vite)
scripts/fetch-all.ts    — CLI entry point: fetch all teams → save to DB
tests/                  — Vitest unit + integration tests
.github/workflows/      — GitHub Actions (scheduled fetching)
```

## Setup

```bash
npm install
```

For local development with the full stack, you also need Docker for a local Postgres instance. See [docs/architecture.md](docs/architecture.md) for stack decisions and component details.

## Usage

```bash
# Run the fetcher against all teams and save to database
npm run fetch

# Start the dev server (API + client)
npm run dev:server

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

## Status

The app is live and updating automatically. The fetcher runs every 15 minutes after matches conclude via GitHub Actions, data is stored in Railway Postgres, and the standings page is served from Vercel.

**For AI agents:** Start with [CLAUDE.md](CLAUDE.md). For architecture details, see [docs/architecture.md](docs/architecture.md).
