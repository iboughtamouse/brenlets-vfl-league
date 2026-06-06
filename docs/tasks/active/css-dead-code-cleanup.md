# Remove dead CSS: `.event-label`, `.stat-box-top`, `.stat-box-bottom`, redundant `body` reset

**Priority:** Code quality
**Category:** CSS cleanup

## What was found

Four dead CSS entries were identified during a code review:

### 1. `.event-label`

A full styled block exists in the CSS but the class is not used anywhere in the JSX. It appears to be a leftover from before the event dropdown was built (when the current event may have been displayed as a static label). Styles include border, background gradient, text-shadow, and box-shadow — none of which render anywhere.

### 2. `.stat-box-top` and `.stat-box-bottom`

The inverse problem: both classes are applied in the JSX (`className="stat-box stat-box-top"` and `className="stat-box stat-box-bottom"`) but neither is defined in the CSS. They're applied to elements but do nothing. This is not a visual bug today (`.stat-box` styles the elements correctly), but if a future developer sees `.stat-box-top` in the JSX they'll expect to find a corresponding CSS rule.

### 3. `body { margin: 0; padding: 0 }`

The `*` reset at the top of the file already sets `margin: 0; padding: 0` on all elements, including `body`. The explicit `body` block is redundant. The `overflow-x: hidden` and `cursor` declarations in the same block are meaningful and should be kept.

## Why it matters

Dead code creates confusion about what is and isn't intentional. `.event-label` wastes reader attention on styles that do nothing. The `.stat-box-top` / `.stat-box-bottom` mismatch will mislead future contributors. The redundant `body` reset is minor but adds noise.

## Recommended course of action

- Delete the entire `.event-label` block (confirm it has no JSX usage first).
- Either: define `.stat-box-top` / `.stat-box-bottom` in CSS if there's a desire to style them differently in the future, or remove the classes from the JSX if they serve no purpose. The latter is cleaner.
- Collapse the `body` block to only its non-redundant declarations: `overflow-x: hidden` and `cursor`.

## Verification

After changes: visually confirm the stats boxes (Top Scorer, Biggest L) still render correctly. Confirm no event label appears anywhere on the page. Run `npm run lint` and `npm test` to catch any regressions.
