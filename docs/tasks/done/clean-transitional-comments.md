# Clean up transitional Playwright references in comments

**Priority:** Code quality
**Category:** Comment hygiene
**Commit message:** `chore: remove transitional Playwright references from comments`

## Context

Several code comments still reference Playwright as a comparison point. These were useful during the migration but are now noise. The git history and `docs/decisions/api-migration.md` preserve the full migration context.

## Steps

### 1. Fix `src/scraper/index.ts` top JSDoc (lines 1–8)

Current opening block:

```ts
/**
 * VFL API client — fetches event metadata and team scores from the
 * VFL JSON API, replacing the Playwright-based scraper.
 *
 * Two endpoints:
```

Change to:

```ts
/**
 * VFL API client — fetches event metadata and team scores from the
 * VFL JSON API.
 *
 * Two endpoints:
```

Remove only ", replacing the Playwright-based scraper". Do not change anything else.

### 2. Fix `src/scraper/index.ts` `fetchAll` JSDoc (around line 120)

Current:

```ts
/**
 * Fetch scores for all teams across all scoreable gameweeks.
 *
 * This is the main entry point — replaces the old Playwright `scrapeAll`.
 */
```

Change to:

```ts
/**
 * Fetch scores for all teams across all scoreable gameweeks.
 */
```

Remove the blank line + transitional sentence. Keep the first line.

### 3. Fix `src/db/index.ts` top JSDoc (line 6)

Current:

```
 *   scores — one row per team per event per game week (upserted on re-scrape)
```

Change to:

```
 *   scores — one row per team per event per game week (upserted on re-fetch)
```

Only "re-scrape" → "re-fetch". Nothing else changes.

## Verification

```bash
npm test          # All 30 tests pass
npm run lint      # No lint errors
```

Check that no comments mention "Playwright" or "scraper" in `src/scraper/index.ts` or `src/db/index.ts`. Run: `grep -n 'Playwright\|scraper' src/scraper/index.ts src/db/index.ts` — should return zero hits in comments (function names like `src/scraper/` path are addressed in a separate task).
