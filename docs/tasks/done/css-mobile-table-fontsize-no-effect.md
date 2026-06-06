# Mobile table `font-size` override has no effect

**Priority:** Bug
**Category:** CSS / Responsive

## What was found

The mobile breakpoint sets `font-size: 14px` on `.standings-table`, intending to shrink the table text on small screens:

```css
@media (max-width: 768px) {
  .standings-table {
    font-size: 14px;
  }
}
```

But the individual cell selectors set explicit `font-size` values that override the inherited value:

- `.standings-table td` — `font-size: 22px`
- `.rank-cell` — `font-size: 20px`
- `.points-cell` — `font-size: 20px`

Because these are more specific selectors, they win over the table-level rule. The table text does not actually shrink on mobile.

## Why it matters

This is a silent failure — the rule looks like it should work, but does nothing. If someone adds a new cell style without an explicit `font-size`, it will accidentally shrink on mobile while everything around it doesn't. The intent (smaller text on mobile) is also not achieved.

## Recommended course of action

The fix is to apply the reduced font-size to the cells directly in the breakpoint, not the table container. But before implementing: consider whether smaller table text is actually desirable now that the TEAM NAME column is hidden on mobile — the remaining three columns may have enough room at 22px.

Evaluate on a real device (or DevTools at 390px) before making changes.

## Verification

In DevTools with device toolbar at ≤768px: inspect a table `<td>`. The Computed font-size should match whatever is declared after the fix. Cross-check on `.rank-cell` and `.points-cell` too, as they have their own `font-size` rules and may need separate treatment.
