# Fix duplicate `sans-serif` in font stacks

**Priority:** Bug
**Category:** CSS

## What was found

Five `font-family` declarations end with `sans-serif, sans-serif`. This happened when the `cursive` fallback was removed via `sed` — the replacement inserted `, sans-serif,` but the stacks already ended in `sans-serif`, resulting in the generic appearing twice.

Affected selectors:

- `.retro-page`
- `.event-dropdown`
- `.event-dropdown option`
- `.week-dropdown`
- `.week-dropdown option`

## Why it matters

Duplicate generic families are harmless to rendering but indicate the font stack is malformed. If these stacks are edited again, the duplication is likely to compound. It's also misleading — a reader scanning the CSS would assume the duplication is intentional.

## Recommended course of action

Remove the trailing duplicate `sans-serif` from each affected declaration, leaving a single `sans-serif` at the end of the stack.

## Verification

Inspect each selector in browser DevTools → Computed → font-family. Each should show a clean, non-repeated stack. No visual change expected.
