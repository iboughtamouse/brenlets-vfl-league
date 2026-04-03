# API Migration: Playwright → VFL JSON API

**Date:** 2026-03-11
**Status:** Implemented

## Problem

The Playwright scraper was the most fragile and expensive part of the system:

- **Fragile:** DOM selectors (`[data-testid="team-page"]`, `.text-5xl`, `.text-2xl`) broke whenever VFL changed their markup. We had to maintain fixture HTML and happy-dom tests just to detect breakage.
- **Expensive:** Every GitHub Actions run installed headless Chromium (~400MB), adding minutes to each run. Sequential page visits (one per team × 26 teams) meant slow fetches.
- **Unreliable:** VFL outages that returned partial HTML caused garbage data. Two separate production DB fixes were needed (GW1 backfill on March 5, GW2/GW3 correction on March 11) to clean up bad scraper output.
- **Limited:** The scraper could only see the _current_ gameweek on each team page. No way to fetch historical gameweeks or detect which gameweeks had been scored.

## Discovery

VFL exposes a public JSON API at `api.valorantfantasyleague.net`. Two endpoints provide everything we need:

| Endpoint                                                  | Returns                                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/event/currentevent`                             | Event metadata: name, ID, gameweek periods (start/end timestamps), all matches with `isComplete` and `havePointsBeenAssigned` flags |
| `GET /api/fantasyteam/team?userId=N&eventId=N&gameweek=N` | Team name, gameweek points, player breakdown                                                                                        |

Both work without authentication. The API was initially investigated in February 2026 and rejected because game week metadata appeared to require auth. The `/api/event/currentevent` endpoint was discovered on March 11 and provides all needed metadata publicly.

## Decision

Replace the Playwright scraper entirely with direct VFL API calls.

### Considered and rejected

- **Keep Playwright as fallback.** Added complexity for a fallback we'd never want to exercise — if the API works, the scraper is strictly worse.
- **Gradual migration (API for metadata, Playwright for scores).** Half-measures with two data sources. The team score endpoint works fine without auth.
- **Wait and validate longer.** The API has been stable across all testing. The scraper had already caused two production data incidents. The risk of staying on Playwright was higher than the risk of switching.

## What Changed

### Deleted

- `src/scraper/parser.ts` — DOM parsing functions (`parseGwLabel`, `normalizeEventName`)
- `tests/scraper/fixture.test.ts` — DOM fixture test
- `fixtures/team-page-22832.html` — saved HTML fixture
- `scripts/fix-prod-scores.ts` — one-off DB fix script
- `@playwright/test` dependency

### Rewritten

- `src/scraper/index.ts` — now exports `fetchAll`, `fetchCurrentEvent`, `scoreableGameweeks`, `extractUserId` (pure `fetch` calls, no browser)
- `scripts/scrape-all.ts` — imports `fetchAll` instead of `scrapeAll`
- `tests/scraper/parser.test.ts` — tests for `extractUserId` and `scoreableGameweeks`
- `.github/workflows/scrape.yml` — removed Playwright install step

### Unchanged

- Database schema and queries (same `teams` + `scores` tables, same upsert semantics)
- Web app (Hono API + Preact frontend)
- `config/teams.json` format

## Key Design Decisions

**Use `havePointsBeenAssigned` to determine scoreable gameweeks.** The `eventMatches` array includes a boolean for each match. A gameweek is scoreable if _any_ match in that gameweek has points assigned. This handles:

- Unplayed gameweeks (no matches scored → skip, preventing 0-point garbage rows)
- Mid-gameweek updates (Day 1 of a 3-day GW → partial scores written, updated on subsequent runs)

**Fetch all scoreable gameweeks on every run, not just the "current" one.** The old scraper only saw the latest GW on each team page. The API lets us fetch any GW. This means:

- New teams added mid-event get backfilled for earlier GWs automatically
- If a run fails for one GW, the next run corrects it

**Assume `/api/event/currentevent` auto-transitions between events.** VFL's own site presumably uses this endpoint to show the active event. When VFL advances to the next event (e.g. Masters Santiago → Stage 1), we expect this endpoint to return the new event. If it doesn't, we'll need to discover event IDs another way.

## Risks

- **API is undocumented.** VFL could change response shapes or remove endpoints without notice. Mitigated by compact code that's easy to update, and unit tests that validate the contract.
- **Event transition is untested.** We haven't observed an event change yet. The first transition will be the real test.
- **No rate limiting observed, but none guaranteed.** 26 teams × N gameweeks = dozens of requests per active run. The fetcher now runs every 15 minutes all day. Off-peak runs call only `/event/currentevent` (1 request) and exit early if no gameweeks are scoreable, so the all-day schedule does not significantly increase API load compared to the windowed schedule. If VFL adds rate limiting, delays between requests would be the first mitigation.
