# `loading-text` yellow color is overridden by animation before rendering

**Priority:** Bug
**Category:** CSS

## What was found

`.loading-text` declares `color: #ffff00` (yellow), but immediately applies the `color-pulse` animation. The animation keyframes start at `color: #00ffff` (cyan) — so the yellow is replaced before the element is painted. The loading text will always appear cyan (or magenta at the animation's midpoint), never yellow.

```css
.loading-text {
  color: #ffff00; /* never seen */
  animation: color-pulse 2s ease-in-out infinite;
}

@keyframes color-pulse {
  0%,
  100% {
    color: #00ffff;
  } /* overrides yellow immediately */
  50% {
    color: #ff00ff;
  }
}
```

## Why it matters

The `color` declaration is dead — it cannot take effect. The loading state is meant to draw attention, and the actual rendered colour is determined entirely by the animation. The `color` property is misleading and should either match the animation's start colour or be removed.

## Recommended course of action

Decide on intent: is `color-pulse` the right animation for the loading text, or was yellow the intended colour? If the animation stays, remove the `color` property (it does nothing) and document that the animation controls the colour. If yellow was the intent, either change the animation start colour to yellow or remove the animation.

No obviously right answer — depends on what you want the loading state to look like.

## Verification

With the app running locally and a slow/offline DB, open the page and observe the loading text colour. It should match the declared intent. If the animation is kept, confirm no yellow flash occurs on load.
