# Event Model Design

## Problem

VFL organizes the season into events (Kickoff, Masters Santiago, Stage 1, Masters London, Stage 2, Champs). Each event has its own set of game weeks that restart at GW 1. The current schema uses `(team_vfl_id, game_week)` as the unique key for scores — when a new event starts, GW 1 data overwrites the previous event's GW 1 data. History is silently destroyed.

## Current State (broken)

```
scores
  UNIQUE(team_vfl_id, game_week)
```

When Masters Santiago begins and the team page shows "GW 1: 50 PTS", the upsert matches the existing Kickoff GW 1 row and overwrites it.

## VFL Event Structure (VCT 2026)

Events happen sequentially — only one is active at a time:

| Event            | Game Weeks |
| ---------------- | ---------- |
| Kickoff          | GW 1       |
| Masters Santiago | GW 1–5     |
| Stage 1          | TBD        |
| Masters London   | TBD        |
| Stage 2          | TBD        |
| Champs           | TBD        |

Each team page shows points for the current game week of the current event. The event name is not displayed on individual team pages.

## Where the Event Name Is Available

- **Leaderboard page** (`/leaderboard`): "CURRENT EVENT" dropdown shows e.g. "VCT 2026 : Masters Santiago"
- **Fixtures page** (`/fixtures`): "Matches for VCT 2026 : Masters Santiago" label

Neither is on the team page itself. The scraper would need to visit one of these pages (once per scrape run) to determine the current event name.

## Proposed Fix

### Schema

Add an `event` column to `scores`. Change the unique constraint:

```sql
ALTER TABLE scores ADD COLUMN event TEXT NOT NULL DEFAULT 'VCT 2026: Kickoff';

-- Drop old constraint, add new one
ALTER TABLE scores DROP CONSTRAINT scores_team_vfl_id_game_week_key;
ALTER TABLE scores ADD CONSTRAINT scores_team_vfl_id_event_game_week_key
  UNIQUE(team_vfl_id, event, game_week);
```

Existing rows get backfilled with "VCT 2026: Kickoff" (the only event scraped so far).

### Scraper

1. Before scraping team pages, visit `/leaderboard` and read the "CURRENT EVENT" dropdown text.
2. Pass the event name through to `saveScrapeBatch`.
3. The upsert key becomes `(team_vfl_id, event, game_week)`.

### API

- `/api/standings/weeks` → scoped to a specific event (default: latest)
- `/api/standings` → include event name in response
- New: `/api/standings/events` → list available events (for future UI)

### UI (Phase 1 — simple)

- Display the current event name above the standings table (e.g. "VCT 2026 : Masters Santiago")
- Game week selector scoped to the current event
- No event switcher yet — past events preserved in DB but not browseable

### UI (Phase 2 — future, optional)

- Event selector dropdown
- Browse any event's game weeks
- "All-time" or cross-event views

## Decision

Proceed with the schema fix + scraper update + simple UI. The critical path is preventing data corruption on the next event transition. UI polish can follow.

## Open Questions

- **Selector stability:** Need to inspect the `/leaderboard` DOM to find a reliable selector for the current event name. This requires a Playwright visit to confirm.
- **Event name format:** The leaderboard shows "VCT 2026 : Masters Santiago" (with spaces around the colon). Should we normalize this or store as-is? Storing as-is is safer — no assumptions about format.
- **Migration timing:** Kickoff data already has `game_week = 1` in the DB with no event. The migration must backfill before Masters Santiago's GW 1 gets scraped, or the old data is lost.
