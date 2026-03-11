# Delete `src/web/index.ts` barrel file

**Priority:** Must fix
**Category:** Dead code removal
**Commit message:** `chore: remove empty web/index.ts barrel file`

## Context

`src/web/index.ts` contains a single comment (`// Web app entry point — see server.ts for the Hono server.`). It exports nothing and nothing imports it. It's a leftover barrel file with no purpose.

## Steps

### 1. Verify nothing imports this file

Run `grep -r "web/index" src/ tests/ scripts/ api/` (excluding `node_modules`). There should be **zero** hits. If anything imports it, do not delete — investigate first.

### 2. Delete the file

Delete `src/web/index.ts`.

## Verification

```bash
npm test          # All 30 tests pass
npm run lint      # No lint errors
```
