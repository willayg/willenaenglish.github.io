# Live Play Responsive Notes (Spelling + Listen & Spell)

This document summarizes the adaptive layout logic added on 2025-09-20 for `spelling` and `listen_and_spell` modes when they are launched inside `play.html` ("live play" context).

## Detection
A helper `isLivePlayContext()` was added to both mode scripts. It returns true if:
- `window.location.pathname` ends with `play.html`, OR
- the URL has `?mode=spelling` or `?mode=listen_and_spell`, OR
- `window.__WORD_ARCADE_LIVE` is truthy (manual override / future hook).

## Style Injection
A single `<style id="wa-live-spell-styles">` element is injected once per page with rules that:
- Constrain content inside `.wa-live-wrap` (max-width 660px, horizontal padding)
- Force inner `.tap-spell` containers and `#letterTiles` to use 100% width
- Provide minor media query tweaks at 520px / 420px breakpoints

Listen & Spell reuses the same style id to avoid duplicate injectors.

## Structure Changes
When in live context the inner game HTML is wrapped:
```
<div class="wa-live-wrap"> ... existing tap-spell markup ... </div>
```
This wrapper is the observed element for width changes.

## Dynamic Slot Sizing
Slots were previously sized with fixed constants (e.g. 340px / 520px). Now when live:
```
dynamicContainerWidth = clamp(gameArea.clientWidth - 24, 280, 660)
```
Each word's slot size is recalculated:
```
slotSize = floor((containerWidth - gap * (letters - 1)) / letters)
```
with a minimum (`minSlotSize`) of 26 (or 32 in builder context).

## Resize Handling
A `ResizeObserver` watches `.wa-live-wrap` and re-renders ONLY the slot rows if width changes by ≥ 8px. After re-render:
- Previously chosen letters are re-populated
- Slot click (removal) handlers are rebound

This avoids rebuilding tiles or resetting game progress.

## Tunable Constants (Search in the two mode files)
| Constant | Current | Purpose | Safe Adjustment |
|----------|---------|---------|-----------------|
| Max wrap width | 660 | Upper responsive bound | 600–720 |
| Min wrap width clamp | 280 | Prevent unusably narrow slots | 260–320 |
| minSlotSize (live) | 26 | Minimum per-letter slot dimension | 22–30 |
| slotGap (live) | 8 | Gap between slots | 6–12 |
| Width change threshold | 8 | Debounce resize re-render | 4–16 |

## How To Adjust
1. Open the relevant mode file (`spelling.js` or `listen_and_spell.js`).
2. Locate the `live` block inside `renderQuestion()`.
3. Modify constant and test quickly inside `play.html?mode=spelling` (or `listen_and_spell`).
4. Verify:
   - Long words (≥ 12 chars) still fit one line (or remain readable if constrained)
   - Multi-word phrases maintain distinct slot rows
   - Tiles area wraps cleanly and doesn't overflow container edges

## Edge Cases Tested (Recommended)
- Narrow viewport ~360px (mobile portrait)
- Medium 768px (tablet)
- Long single word (e.g. "extraordinary")
- Multi-word phrase (e.g. "ice cream sandwich")
- Orientation rotation (phone landscape ↔ portrait)

## Adding Another Live Mode
If a new mode needs the same responsive slot logic:
- Import / copy the `isLivePlayContext` + `ensureLiveSpellStyles` helpers (or centralize them in a shared util later)
- Wrap its main markup with `.wa-live-wrap` conditionally
- Apply the same pattern for slots & `ResizeObserver`

## Fallback Behavior
Outside live context (original Word Arcade embedding) everything remains unchanged: original constants and layout logic still apply.

---
Last updated: 2025-09-20
