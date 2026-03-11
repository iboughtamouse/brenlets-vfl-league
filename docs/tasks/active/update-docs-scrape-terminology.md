# Update stale "scrape" terminology in living docs

**Priority:** Code quality
**Category:** Documentation accuracy
**Commit message:** `docs: update scrape→fetch terminology in living docs`

## Context

After the Playwright→API migration, several living documents still use "scrape/scraper/scraping" to describe the current fetching behavior. These are not code identifiers (handled in a separate task) — these are prose descriptions in docs that should accurately reflect the current architecture.

**Important:** Do NOT modify anything in `docs/history/` or `docs/decisions/` — those are historical records and should preserve the original language.

## Steps

### 1. Update `CLAUDE.md`

The file references real code paths/identifiers (`src/scraper/`, `scrape-all.ts`, `scraped_at`, `saveScrapeBatch`, `npm run scrape`) which are still the actual names in code. Leave those as-is — they'll be updated when the code identifiers change. Only update **prose descriptions** that use "scrape" language.

**Line 56** — Data Model section, the paragraph:

```
Upsert semantics: re-scraping the same event + game week updates the existing row rather than duplicating. All distinct event + game week combinations are preserved for history. Team names are re-fetched on every scrape (they change between game weeks).
```

Change to:

```
Upsert semantics: re-fetching the same event + game week updates the existing row rather than duplicating. All distinct event + game week combinations are preserved for history. Team names are re-fetched on every run (they change between game weeks).
```

**Line 78** — Commands section:

```
npm run scrape        # Run scraper, save to DB
```

Change to:

```
npm run scrape        # Run fetcher, save to DB
```

(The `npm run scrape` command name stays — that's the actual npm script name.)

### 2. Update `README.md`

**Line 50** — Usage section, the comment on the `npm run scrape` line:

```
npm run scrape
```

This one has no trailing comment, so no change needed. Verify and skip.

### 3. Update `docs/architecture.md`

**Line 32** — "no scraping a dropdown" phrase:

```
**Event detection:** `fetchCurrentEvent()` calls `/api/event/currentevent`. The response includes the event name and ID directly — no scraping a dropdown or normalizing suffixes.
```

Change to:

```
**Event detection:** `fetchCurrentEvent()` calls `/api/event/currentevent`. The response includes the event name and ID directly — no parsing a dropdown or normalizing suffixes.
```

**Line 32 and line 46** reference `saveScrapeBatch` by name — leave as-is (that's the actual function name, not prose).

**Line 59** — workflow filename reference:

```
GitHub Actions workflow (`.github/workflows/scrape.yml`) with three triggers:
```

Leave as-is — that's the actual filename.

### 4. Update `.github/workflows/scrape.yml`

**Line 15** — job name:

```yaml
jobs:
  scrape:
```

Change to:

```yaml
jobs:
  fetch:
```

**Line 32** — step name:

```yaml
- name: Run scraper
```

Change to:

```yaml
- name: Run fetcher
```

(Leave the `run: npm run scrape` command as-is — that's the actual npm script.)

## Verification

```bash
npm test          # All 30 tests pass
npm run lint      # No lint errors
```

Run `grep -rn 'scraper\b' CLAUDE.md README.md docs/architecture.md .github/workflows/` and confirm only references to actual code identifiers remain (paths like `src/scraper/`, `scripts/scrape-all.ts`, function names like `saveScrapeBatch`, or the `npm run scrape` command).
