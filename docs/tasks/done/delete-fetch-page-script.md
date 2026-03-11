# Delete `scripts/fetch-page.ts`

**Priority:** Must fix
**Category:** Dead code removal
**Commit message:** `chore: remove dead fetch-page Playwright script`

## Context

`scripts/fetch-page.ts` is a leftover Playwright inspection script from before the API migration (commit `cbbf1e4`). It imports `@playwright/test`, which was removed as a dependency. Running `npm run fetch-page` will crash with a module-not-found error.

## Steps

### 1. Delete the dead script

Delete `scripts/fetch-page.ts` entirely.

### 2. Remove the npm script from `package.json`

In `package.json`, remove this line from the `"scripts"` block:

```
"fetch-page": "tsx scripts/fetch-page.ts",
```

Leave surrounding scripts intact. The resulting `"scripts"` block should still contain `test`, `test:watch`, `scrape`, `dev:server`, `lint`, `format`, `format:check`, and `prepare`.

### 3. Verify nothing else references the file

Run `grep -r "fetch-page" .` (excluding `node_modules` and `.git`). The only expected hit after this change is this task file itself (in `docs/tasks/`). If anything else references `fetch-page`, investigate before committing.

## Verification

```bash
npm test          # All 30 tests pass
npm run lint      # No lint errors
```

Confirm `npm run fetch-page` is no longer a valid command (npm will print an error about missing script).
