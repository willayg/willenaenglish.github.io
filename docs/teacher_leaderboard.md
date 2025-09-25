# Teacher Leaderboard / Projector View

## Purpose
Provide a one-click path from the QR join screen to a fullscreen, projector-friendly leaderboard and an optional stats panel for teachers during a live game.

## Quick Use (Single Path)
1. Create / load a word list in the builder.
2. Click Create Game → Play Live → choose a mode.
3. (If Time Battle) set duration and launch.
4. When the QR modal appears, click **Leaderboard** (the ONLY leaderboard control). It opens `leaderboard.html?id=<sessionId>` in a new browser tab/window (projector friendly).
5. In that tab you can toggle Calm Mode (reduced motion) and view last update time.

## Implementation Outline
File: `Teachers/tools/game-builder/create-game-modal.js`
- After successful live game creation, the returned id is stored: `window.__lastLiveGameId`.
- `showQrForUrl()` injects a single `Leaderboard` button (opens new tab only).
- Clicking it opens `/Games/Word Arcade/leaderboard.html?id=<id>`.
- Polling every 3s: `/.netlify/functions/timer_score?session_id=<id>&best=1` (standalone view shows up to top 50 by default).
- Previous modal overlay implementation retained in source only if still present (candidate for removal to reduce dead code).

Standalone page: `Games/Word Arcade/leaderboard.html`
- Parses `?id=` query parameter; if missing shows a helpful message.
- FLIP diff algorithm (measure first/last DOM rects; transform then animate to neutral) prevents flashing.
- Calm Mode toggle (less highlight / movement) and Close button.
- Minimal name escaping (`<`).

## Data Contract
Timer score function (best mode) expected response:
```
{ success: true, leaderboard: [ { name: string, score: number }, ... ] }
```
Sorted descending by score (highest first). Names are HTML-escaped for `<` to avoid injection.

## Polling & Animation Details
- Recursive `setTimeout` (3s) instead of `setInterval` (simpler cancellation path).
- FLIP Technique:
  1. Measure FIRST positions for existing rows (before DOM reorder).
  2. Apply data changes (insert/move/update nodes in visual order).
  3. Measure LAST positions.
  4. For each moved row, set transform to the delta (FIRST→LAST) with no transition, then next frame animate transform back to `translate(0,0)`.
  5. Skip diff/render when snapshot key (concatenated name:score pairs) is unchanged.
- Score bump animation only triggers on actual score change, not on mere reordering.
- Calm Mode (standalone): suppresses promotion/demotion highlight classes; core position animation still plays so ranks stay clear.
- Failure handling: network errors keep last known frame; status text shows transient warning.

## Styling Notes
- Colors: cyan accent `#67e2e6`, deep backgrounds `#0f172a / #1e293b / #334155`.
- Ranked list rows use alternating subtle gradients; medals (🥇 🥈 🥉) for top 3.
- Responsive sizing via `clamp()` for large projector legibility.
- Calm Mode reduces motion (no promote/demote pulse) to mitigate motion sensitivity.

## Extensibility Ideas
| Feature | Approach |
|---------|----------|
| Round-based view | Add `round` param to query; backend filters scores. |
| Live (current) vs Best toggle | UI toggle sets `best=0/1` in polling URL. |
| Score deltas | Cache previous result; compare and display change (+/-). |
| Minimal projector mode | Provide alternate modal with only podium markup. |
| Export CSV | Add button that converts current rows to CSV and downloads. |
| Highlight new #1 | Track prev top player; animate change with CSS transition. |

## Failure Modes
| Scenario | Result |
|----------|--------|
| No session id | Page displays message; polling disabled. |
| No scores yet | List shows "Waiting for scores…" placeholder. |
| Network / server error | Last successful state persists; status shows transient warning; next poll retries. |

## Maintenance Pointers
- Global id usage keeps QR parsing simple; if you ever support multiple concurrent live games in one tab, switch to a scoped instance approach.
- Keep polling lightweight; if scaling becomes an issue, move to WebSocket or Supabase realtime channel.
- All injected DOM uses predictable ids to allow removal/replacement without memory leaks.

## Security
- Only basic name escaping (`<`). Enhance with a stricter sanitizer if user-supplied names might contain other HTML entities.
- If adding rich formatting or avatars, sanitize URLs and disallow inline event handlers.

---
## URL Pattern
`/Games/Word Arcade/leaderboard.html?id=<sessionId>`

## Changelog (Recent)
- Added standalone `leaderboard.html` new-tab projector view with Calm Mode.
- Replaced podium bars with FLIP-animated ranked list (smooth transitions).
- Simplified: single Leaderboard button now always opens new tab (removed modal choice).

Update this doc when adding new analytics (e.g., per-round, streaks, accuracy metrics) or if logic diverges between modal and standalone views.
