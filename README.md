# Brenlets VFL Hub

Automated standings tracker for the [Brenlets VFL](https://www.valorantfantasyleague.net/) fantasy Valorant league. Scrapes team pages nightly, stores scores in SQLite, and serves a public standings page.

## How It Works

VFL is a Next.js app — team data is rendered client-side. A Playwright-based scraper visits each team page, waits for the JavaScript to render, and reads the team name, game week, and points from the DOM. Results are saved to a SQLite database with upsert semantics (re-scraping the same game week updates rather than duplicates; all distinct game weeks are preserved).

## Project Structure

```
config/teams.json      — 17-team roster (manager name + VFL URL)
src/scraper/parser.ts  — Pure parsing function for GW labels
src/scraper/index.ts   — Playwright scraper (visits pages, extracts data)
src/db/index.ts        — SQLite database layer (schema, queries, batch save)
src/web/index.ts       — Web app (not yet implemented)
scripts/scrape-all.ts  — CLI entry point: scrape all teams → save to DB
fixtures/              — Saved HTML fixture for testing
tests/                 — Vitest unit + integration tests
```

## Setup

```bash
npm install
npx playwright install chromium
```

## Usage

```bash
# Run the scraper against all 17 teams and save to database
npm run scrape

# Run tests
npm test

# Lint and format
npm run lint
npm run format
```

## Status

The scraper and database layer are implemented and tested. Next up: standings web page, then GitHub Actions cron job.

See [CURRENT_PROCESS.md](CURRENT_PROCESS.md) for what the manual workflow looks like today, [IDEAL_PROCESS.md](IDEAL_PROCESS.md) for what this project aims to replace it with, and [TECHNICAL_OVERVIEW.md](TECHNICAL_OVERVIEW.md) for early architecture notes.
