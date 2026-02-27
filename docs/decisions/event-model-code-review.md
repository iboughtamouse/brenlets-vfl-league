# Code Review: Event Model Support

**Date:** 2026-02-26
**Scope:** All uncommitted changes on `main` (event dimension added to scores)

## Summary

This changeset adds an `event` dimension to the scores table so the app can track standings across multiple VCT events (e.g. Kickoff vs Masters Santiago) without data collisions on `game_week`. Clean, well-scoped change that touches all the right layers: schema, DB methods, scraper, API, and frontend.

## Looks Good

- **Schema design is sound.** The `UNIQUE(team_vfl_id, event, game_week)` constraint is the right approach — it prevents data loss when a new event reuses game week numbers.
- **API is backwards-compatible.** The `event` query param is optional everywhere, falling back to `getLatestEvent()`. Existing clients/bookmarks without `?event=` will still work.
- **Scraper architecture.** Scraping the event name from the leaderboard as step 1, then threading it through `saveScrapeBatch`, keeps the source of truth in VFL itself rather than hardcoded config.
- **Test coverage is thorough.** New tests for cross-event isolation, `getLatestEvent`, `getEvents`, and `getGameWeeksForEvent` — plus existing tests updated to pass the event param.
- **Transaction safety preserved.** `saveScrapeBatch` still runs in a transaction with proper rollback.

## Issues

### 1. ~~`getLatestEvent` relies on `ORDER BY id DESC` — fragile~~ RESOLVED

Fixed. `getLatestEvent` now uses `ORDER BY scraped_at DESC LIMIT 1`.

### 2. ~~`initialize()` called on every request~~ NOT AN ISSUE

`VflDatabase` already tracks initialization with a `private initialized = false` flag. After the first call, `initialize()` short-circuits with `if (this.initialized) return;` — a boolean check, essentially free. No change needed.

### 3. ~~No `event` field in the client `Standing` interface~~ RESOLVED

Fixed. The client `Standing` interface now includes `event: string`.

### 4. ~~No validation on the `event` query parameter~~ NOT AN ISSUE

Queries are parameterized (no injection risk). An empty or nonexistent event returns an empty result set, which is correct behavior for a public read-only API. Adding validation would be writing code for a scenario that doesn't cause problems.

### 5. ~~`scrapeCurrentEvent` throws on failure — will abort the entire scrape~~ CORRECT BEHAVIOR

The `event` column is `NOT NULL` and part of the unique constraint `UNIQUE(team_vfl_id, event, game_week)`. Without knowing the event name, scores can't be saved correctly. Falling back to the last known event from the DB would risk saving scores under the wrong event during a VFL event transition — the exact data corruption the event model was built to prevent. Failing loudly is the right choice. GitHub Actions emails on failure, so it won't go unnoticed.

## Nits

- `src/web/app.ts` — The `/api/standings/events` endpoint isn't consumed by the frontend yet. For future use (event selector).

## Verdict

All issues resolved or determined to be non-issues. The change is solid as shipped.
