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

### 1. `getLatestEvent` relies on `ORDER BY id DESC` — fragile

`src/db/index.ts:168` — Using `ORDER BY id DESC LIMIT 1` assumes the most recently inserted row is the "current" event. If you ever backfill historical data or re-scrape an older event, this will return the wrong event. Consider ordering by `scraped_at DESC` instead, or storing a separate "current event" marker.

### 2. `initialize()` called on every request

`src/web/app.ts:65`, `src/web/app.ts:76`, `src/web/app.ts:94` — Every API route calls `await database.initialize()` which runs `CREATE TABLE IF NOT EXISTS` on every single request. This is harmless but wasteful. Consider tracking initialization state with a boolean flag on the `VflDatabase` instance. (Pre-existing issue, not introduced by this change.)

### 3. No `event` field in the client `Standing` interface

`client/src/App.tsx:4-12` — The `Standing` interface is missing the `event` field that the API now returns. Not a runtime error since TS extra properties are fine from JSON, but it means the client can't display or use the event from individual standing rows if needed later.

### 4. No validation on the `event` query parameter

`src/web/app.ts:78`, `src/web/app.ts:97` — The `event` param from the query string is passed directly to SQL queries. While parameterized queries prevent SQL injection, there's no sanity check (e.g. max length, non-empty). A request like `?event=` (empty string) would silently return no results rather than an error.

### 5. `scrapeCurrentEvent` throws on failure — will abort the entire scrape

`src/scraper/index.ts:54` — If the leaderboard page changes layout or is temporarily down, the hard throw in `scrapeCurrentEvent` kills the whole `scrapeAll` run. The team pages might still be scrapeable. Consider whether this should be a fatal error or if there's a sensible fallback (e.g. reading the last known event from the DB).

## Nits

- `src/web/app.ts:63-71` — The `/api/standings/events` endpoint exists in the backend but isn't consumed by the frontend yet. The design doc mentions it's for future use — just flagging it's dead code for now.
- `client/src/App.tsx:112` — `currentEvent.toUpperCase()` — if the VFL page returns something like `"VCT 2026 : Masters Santiago"`, the colon/spaces are fine, but worth confirming the casing looks right with the actual scraped value.

## Verdict

Solid change overall. The main thing to address before merging is **#1** (`getLatestEvent` ordering) since it's a correctness issue that'll bite during the next event transition — the exact scenario this feature is designed to handle. The rest are minor or opportunistic improvements.
