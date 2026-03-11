# Consolidate duplicate URL parsers

**Priority:** Code quality
**Category:** DRY / deduplication
**Commit message:** `refactor: consolidate extractVflId and extractUserId`

## Context

Two functions do the exact same thing — extract a numeric ID from a VFL team URL via `/team/(\d+)` regex:

- `extractVflId(url)` in `src/db/index.ts` line ~73 — used by `saveScrapeBatch`
- `extractUserId(url)` in `src/scraper/index.ts` line ~101 — used by `fetchAll`

Both have identical logic, identical regex, identical error behavior. The DB test file (`tests/db/index.test.ts`) tests `extractVflId` (3 tests). The scraper test file (`tests/scraper/parser.test.ts`) tests `extractUserId` (4 tests, including empty string edge case).

## Decision

Keep `extractVflId` in `src/db/index.ts` as the single source of truth — it's the older, established name and lives in the data layer where it's most used. Remove `extractUserId` from the scraper module. Update all callers and tests to use `extractVflId`.

## Steps

### 1. Remove `extractUserId` from `src/scraper/index.ts`

Delete the `extractUserId` function (around lines 101–104):

```ts
/** Extract the numeric user ID from a VFL team URL like ".../team/22832". */
export function extractUserId(url: string): number {
  const match = url.match(/\/team\/(\d+)/);
  if (!match) throw new Error(`Cannot extract user ID from URL: ${url}`);
  return Number(match[1]);
}
```

### 2. Import `extractVflId` in `src/scraper/index.ts`

Add at the top of `src/scraper/index.ts`:

```ts
import { extractVflId } from '../db/index.js';
```

Then in `fetchAll`, replace the call to `extractUserId(team.url)` with `extractVflId(team.url)`. The call site is inside the gameweek loop in `fetchAll`.

### 3. Update `tests/scraper/parser.test.ts`

Change the import:

```ts
import { scoreableGameweeks, type CurrentEvent } from '../../src/scraper/index.js';
```

Remove the entire `describe('extractUserId', ...)` block (4 tests). The DB test file already covers `extractVflId` with 3 tests, plus the scraper's 4th case (empty string) can be moved to the DB tests if desired.

Update the test filename's `describe` blocks as needed. The file now only tests `scoreableGameweeks`.

### 4. Optionally add the empty-string edge case to DB tests

The scraper tests have an extra case (`it('throws for an empty string', ...)`). If being thorough, add it to `tests/db/index.test.ts` inside the `describe('extractVflId', ...)` block:

```ts
it('throws on empty string', () => {
  expect(() => extractVflId('')).toThrow('Cannot extract VFL ID');
});
```

### 5. Verify `extractUserId` is fully removed

Run `grep -r "extractUserId" src/ tests/`. Should return zero hits.

## Verification

```bash
npm test          # All tests pass (count may drop by 3-4 due to deduplicated tests)
npm run lint      # No lint errors
```

## Risks

- `extractUserId` is exported from `src/scraper/index.ts`, so it's part of the module's public API. Grep `config/`, `scripts/`, `api/`, and `client/` to confirm no external consumers. As of this writing, only `fetchAll` (internal) and `tests/scraper/parser.test.ts` use it.
- The scraper module will gain a dependency on the DB module. This is acceptable — the DB module exports a pure function (`extractVflId`) with no side effects or DB dependency.
