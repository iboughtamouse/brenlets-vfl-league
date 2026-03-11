# Fix React→Preact comment in `server.ts`

**Priority:** Cosmetic
**Category:** Comment accuracy
**Commit message:** `fix: correct React→Preact in server.ts comment`

## Context

`src/web/server.ts` has a JSDoc block at the top. Line 7 says:

```
 *   - Static file serving for the built React client
```

The frontend was migrated from React to Preact earlier in development. This comment was never updated.

## Steps

### 1. Fix the comment

In `src/web/server.ts`, in the opening JSDoc block, change:

```
 *   - Static file serving for the built React client
```

to:

```
 *   - Static file serving for the built Preact client
```

Only this one word changes. Do not modify anything else in the file.

## Verification

```bash
npm test          # All 30 tests pass
npm run lint      # No lint errors
```
