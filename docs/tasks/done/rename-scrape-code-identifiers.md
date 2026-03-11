# Rename stale "scrape" code identifiers to "fetch"

**Priority:** Code quality
**Category:** Naming consistency
**Commit message:** `refactor: rename scrape→fetch in code identifiers`

## Context

After the Playwright→API migration, many code identifiers still use "scrape" terminology (`saveScrapeBatch`, `scrapedAt`, `src/scraper/`, etc.) even though the system now uses `fetch()` against a JSON API. This task renames the code-level identifiers to match reality.

**This task depends on:**

- "Clean up transitional Playwright references in comments" (to avoid merge conflicts)
- "Consolidate duplicate URL parsers" (to avoid editing code that's about to change)

**Execute those tasks first.**

## Scope & Tradeoffs

### What this task renames

| Current                                | New                                    | Location                                                             |
| -------------------------------------- | -------------------------------------- | -------------------------------------------------------------------- |
| `saveScrapeBatch`                      | `saveFetchBatch`                       | `src/db/index.ts`, `scripts/scrape-all.ts`, `tests/db/index.test.ts` |
| `scrapedAt` (TS identifier)            | `fetchedAt`                            | `src/scraper/index.ts`, `src/db/index.ts`, `tests/db/index.test.ts`  |
| `// Bulk operations (used by scraper)` | `// Bulk operations (used by fetcher)` | `src/db/index.ts`                                                    |
| `Save a batch of scrape results`       | `Save a batch of fetch results`        | `src/db/index.ts` JSDoc                                              |

### What this task does NOT rename (and why)

- **`scraped_at` (DB column):** This is a production Postgres column. Renaming requires a schema migration on the live Railway database (`ALTER TABLE scores RENAME COLUMN scraped_at TO fetched_at`), plus updating every SQL query, type interface, and the frontend `Standing` interface. It's high risk for low payoff — the column works fine. **Document this as accepted debt.**
- **`src/scraper/` directory:** Renaming to `src/fetcher/` touches every import across the codebase (scraper/index.ts, all tests, scripts, etc.) plus test file paths. High churn. **Defer to a separate task if desired.**
- **`scripts/scrape-all.ts` filename:** Renaming means updating `package.json` npm scripts and CI workflow. Moderate churn. **Defer to a separate task if desired.**
- **`npm run scrape` script name:** Could break developer muscle memory and CI. **Leave as-is or handle in a dedicated task.**
- **`.github/workflows/scrape.yml` filename:** Renaming a workflow file on GitHub doesn't truly "rename" it — GitHub shows both old and new. Low value. **Leave as-is.**

## Steps

### 1. Rename `saveScrapeBatch` → `saveFetchBatch` in `src/db/index.ts`

Three changes in this file:

**a)** The section comment (around line 212):

```ts
// Bulk operations (used by scraper)
```

→

```ts
// Bulk operations (used by fetcher)
```

**b)** The JSDoc (around line 216):

```ts
   * Save a batch of scrape results. Runs inside a transaction for atomicity.
```

→

```ts
   * Save a batch of fetch results. Runs inside a transaction for atomicity.
```

**c)** The method name (around line 221):

```ts
  async saveScrapeBatch(
```

→

```ts
  async saveFetchBatch(
```

### 2. Rename `scrapedAt` → `fetchedAt` in `src/db/index.ts`

Three occurrences of the TypeScript identifier `scrapedAt` (NOT the SQL column `scraped_at` — leave all SQL strings unchanged):

**a)** Method parameter in `upsertScore` (around line 142):

```ts
    scrapedAt: string,
```

→

```ts
    fetchedAt: string,
```

**b)** The corresponding usage in the query parameter array (around line 150):

```ts
      [teamVflId, event, gameWeek, points, scrapedAt],
```

→

```ts
      [teamVflId, event, gameWeek, points, fetchedAt],
```

**c)** In the `saveFetchBatch` parameter type (around line 229):

```ts
scrapedAt: string;
```

→

```ts
fetchedAt: string;
```

**d)** In the `saveFetchBatch` body where it reads `r.scrapedAt` (around line 262):

```ts
          [vflId, event, r.gameWeek, r.points, r.scrapedAt],
```

→

```ts
          [vflId, event, r.gameWeek, r.points, r.fetchedAt],
```

**e)** The JSDoc on `upsertScore` (around line 136):

```ts
/** Upsert a score — insert or update points/scraped_at for (team, event, game_week). */
```

→

```ts
/** Upsert a score — insert or update points/fetched_at for (team, event, game_week). */
```

### 3. Rename `scrapedAt` → `fetchedAt` in `src/scraper/index.ts`

**a)** In the `TeamScore` interface (around line 49):

```ts
scrapedAt: string;
```

→

```ts
fetchedAt: string;
```

**b)** The local variable in `fetchAll` (around line 131):

```ts
const scrapedAt = new Date().toISOString();
```

→

```ts
const fetchedAt = new Date().toISOString();
```

**c)** Two usages in `fetchAll` where results are pushed (around lines 145 and 156):

```ts
          scrapedAt,
```

→

```ts
          fetchedAt,
```

(Both the success path and the error path set this field.)

### 4. Update `scripts/scrape-all.ts`

The call to `saveScrapeBatch` (around line 33):

```ts
const saved = await db.saveScrapeBatch(event, results);
```

→

```ts
const saved = await db.saveFetchBatch(event, results);
```

### 5. Update `tests/db/index.test.ts`

**a)** All `describe` and calls to `saveScrapeBatch`:

- Line ~244 comment: `// saveScrapeBatch` → `// saveFetchBatch`
- Line ~247: `describe('saveScrapeBatch', () => {` → `describe('saveFetchBatch', () => {`
- Line ~277: `await db.saveScrapeBatch(EVENT, results)` → `await db.saveFetchBatch(EVENT, results)`
- Line ~307: `await db.saveScrapeBatch(EVENT, results)` → `await db.saveFetchBatch(EVENT, results)`
- Line ~313: `await db.saveScrapeBatch(EVENT, [` → `await db.saveFetchBatch(EVENT, [`
- Line ~346: `await expect(db.saveScrapeBatch(EVENT, badBatch)).rejects.toThrow(...)` → `await expect(db.saveFetchBatch(EVENT, badBatch)).rejects.toThrow(...)`

**b)** All `scrapedAt` property names in test data objects:

- Lines ~256, ~264, ~273, ~295, ~303, ~320, ~334, ~342: `scrapedAt:` → `fetchedAt:`

### 6. Do NOT change these (intentionally leaving as accepted debt)

- `scraped_at` in SQL strings, DDL, type interfaces (`ScoreRow.scraped_at`, `StandingsRow.scraped_at`) — these mirror the actual DB column name
- `client/src/App.tsx` `Standing.scraped_at` — mirrors the API response which mirrors the DB column
- `tests/db/index.test.ts` line ~129: `expect(standings[0]!.scraped_at).toBe(...)` — tests the actual DB column value
- `src/scraper/` directory path
- `scripts/scrape-all.ts` filename
- `npm run scrape` script
- `.github/workflows/scrape.yml` filename

## Verification

```bash
npm test          # All tests pass (same count, just renamed identifiers)
npm run lint      # No lint errors
npm run scrape    # Should still work (the npm script name hasn't changed)
```

Run `grep -rn 'saveScrapeBatch\|scrapedAt' src/ tests/ scripts/` — should return zero hits. All remaining `scraped_at` references should be in SQL strings or type interfaces that mirror the DB column.
