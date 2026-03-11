# Remove `happy-dom` dependency

**Priority:** Must fix
**Category:** Dependency cleanup
**Commit message:** `chore: remove orphaned happy-dom dependency`

## Context

`happy-dom` in `package.json` devDependencies was only used by the deleted fixture test (`tests/scraper/fixture.test.ts`), which loaded saved HTML into a DOM environment. That test was removed during the API migration. Nothing imports `happy-dom`.

## Steps

### 1. Verify nothing uses happy-dom

Run `grep -r "happy-dom" . --include='*.ts' --include='*.json'` (excluding `node_modules` and `.git`). The only hit should be the `"happy-dom"` line in `package.json`. If anything imports it, do not remove — investigate first.

### 2. Remove from `package.json`

In `package.json`, remove this line from `"devDependencies"`:

```
"happy-dom": "^20.7.0",
```

Leave surrounding dependencies intact.

### 3. Update lockfile

Run `npm install` to regenerate `package-lock.json` without `happy-dom`.

## Verification

```bash
npm test          # All 30 tests pass
npm run lint      # No lint errors
```
