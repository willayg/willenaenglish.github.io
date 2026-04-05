# April 2026 Plan

## Purpose
This plan documents the full roadmap for Game Creator/Game Builder, English Arcade, Teacher tools, and Student Tracker alignment so future AI agents can execute work without re-discovery.

## Priority Key
- `[P1]` highest priority
- `[P2]` next priority
- Higher-numbered phases remain lower priority unless explicitly marked otherwise.

## Status Update (2026-03-29)
- Completed and scratched off: Phases 1 to 4 are done.
- Completed and scratched off: Game Builder `Save Sentences` now uses plain text link styling and removed the speaker emoji.
- Still open: the load file filtering system has a few persistent edge cases; that cleanup now lives in Phase 8.

## Product Flow Overview: Game Builder <-> English Arcade
1. Teacher builds or edits a game in `Teachers/tools/game-builder/`.
2. Save flow writes game payload (title, words, images, sentence metadata) through Netlify functions to Supabase.
3. Launch flow opens `Games/english_arcade/play.html?id=<gameId>&src=builder&mode=<mode>`.
4. English Arcade loads game data, normalizes word fields, resolves sentence audio, and runs selected mode.
5. Student progress/attempts flow into `progress_sessions` and `progress_attempts` and are used by student dashboard + teacher tracker.

## Phase 1: Fast UI/UX Changes

### Phase 1 Status: Done

### 1) Game Builder toolbar: make "Save Sentences" plain text
Goal: Make it visually consistent with Load/Save/Save As links.

Implementation:
- In `Teachers/tools/game-builder/index.html`:
  - Change `id="saveSentencesLink"` from `class="link accent"` to `class="link"`.
  - Change label text from `🔊 Save Sentences` to `Save Sentences`.
- In `Teachers/tools/game-builder/styles.css`:
  - Keep `.link` / `.link.primary` styles as-is.
  - Remove or stop using `.link.accent` for this element.

Acceptance criteria:
- Save Sentences appears as plain link text.
- No speaker emoji.
- Hover behavior matches other text links.

### 2) Teacher burger menu styling and label
Goal: Remove "Menu" text and use cyan-mint button tone.

Implementation:
- In `components/burger-menu.html` and fallback template in `components/burger-menu.js`:
  - Button text: `☰` only (no "Menu").
  - Button color: cyan-mint, blue-leaning (example base `#00c9db`, hover `#00b4c6`).

Acceptance criteria:
- Burger button text is icon-only.
- Button color is cyan-mint, readable, consistent across teacher pages.

### 3) Add Game Builder to burger dropdown
Goal: Ensure Game Builder is always reachable from teacher menu.

Implementation:
- Add menu link in both templates:
  - `/Teachers/tools/game-builder/index.html`

Acceptance criteria:
- Game Builder appears in dropdown on all teacher pages using shared burger component.

## Phase 2: Game Builder Save/Load Reliability

### Phase 2 Status (2026-03-29)
- 4) Fix save race conditions and duplicate saves: Solved.
- 5) Fix sentence fallback ID collision behavior: Solved.
- 6) Improve title conflict and save-as checks: Solved.
- 7) Sync uploaded image URLs back to canonical in-memory state: Solved.
- 7b) Fix Game Builder save ownership (`created_by`) so `My Games` is accurate: Open.
  - Temporary product decision: default Saved Games filter is now `All Users`.
  - Follow-up still needed: make `My Games` reliably show only the signed-in teacher's saved games.
  - Load file filtering still has a few persistent edge cases; move final cleanup to Phase 8.

### 4) Fix save race conditions and duplicate saves
Observed risk:
- Rapid save interactions can cause duplicate inserts or repeated save modal prompts.

Implementation:
- Add save mutex (`isSaving`) in quick save handlers.
- Debounce keyboard save trigger (`Ctrl+S`) while save is in-flight.
- Ensure first-save ID assignment is complete before allowing next save.

Primary files:
- `Teachers/tools/game-builder/ui/event-handlers.js`
- `Teachers/tools/game-builder/services/file-service.js`

Acceptance criteria:
- Repeated `Ctrl+S` during active save does not duplicate records.
- First save transitions cleanly to update flow.

### 5) Fix sentence fallback ID collision behavior
Observed risk:
- Fallback local IDs based only on deterministic hashing can collide across teachers/content.

Implementation:
- Add retry/backoff for sentence upsert before fallback.
- If fallback is required, add additional uniqueness suffix and clear warning state.
- Log fallback usage so it is diagnosable.

Primary files:
- `Teachers/tools/game-builder/services/file-service.js`

Acceptance criteria:
- Fallback collisions are prevented.
- Audio key generation remains deterministic when backend is healthy.

### 6) Improve title conflict and save-as checks
Observed risk:
- Title conflict checks can miss records if only first page is inspected.

Implementation:
- Move title uniqueness check to backend filtering or full pagination.
- Return explicit conflict metadata for UX decision (overwrite, save copy, cancel).

Primary files:
- `Teachers/tools/game-builder/services/file-service.js`
- Netlify listing function used by builder list/title check.

Acceptance criteria:
- Existing title conflicts are detected regardless of list size.

### 7) Sync uploaded image URLs back to canonical in-memory state
Observed risk:
- Payload updates can succeed while UI state remains stale.

Implementation:
- After upload result mapping, update the canonical `list` state immediately.
- Re-render from state to avoid preview-only correctness.

Primary files:
- `Teachers/tools/game-builder/services/file-service.js`
- `Teachers/tools/game-builder/state/game-state.js`

Acceptance criteria:
- Uploaded image URLs persist through save/load and immediate UI refresh.

### 7b) Fix Game Builder save ownership (`created_by`) so `My Games` is accurate
Observed risk:
- Some saved games are inserted without the correct `created_by`, so they appear under `All Users` and not reliably under `My Games`.

Status:
- Open.

Implementation:
- Ensure save flow resolves authenticated teacher id via cookie-based whoami fallback before insert.
- Prevent unauthenticated inserts from creating `created_by = NULL` rows in production paths.
- Keep local-dev fallback behavior explicit and isolated.
- Ensure client routing for auth-sensitive game-data saves stays same-origin so auth cookies are sent.

Primary files:
- `Teachers/tools/game-builder/services/file-service.js`
- `Teachers/tools/game-builder/main.js`
- `netlify/functions/supabase_proxy_fixed.js`

Acceptance criteria:
- New saves always store the signed-in teacher `created_by`.
- Newly saved games appear in `My Games` immediately.
- Production save attempts without auth fail with explicit error instead of creating orphan rows.

## Phase 3: Sentence Audio Naming and Default List Conflicts

### Phase 3 Status: Done

### 8) Standardize all sentence audio resolution on sentence IDs
Problem statement:
- Legacy `<name>_sentence` naming causes collisions and mismatch with default list behavior.
- Current canonical naming is `sent_<sentence_id>.mp3`.

Implementation:
- Treat JSON `sentence_id` as first-class for default lists (same as builder-created content).
- Ensure resolution order prioritizes `sent_<id>.mp3` before legacy fallback.
- Keep legacy lookup only as backward compatibility fallback, not default path.

Primary files:
- `Games/english_arcade/modes/word_sentence_mode.js`
- `Games/english_arcade/modes/sentence_mode.js`
- `Games/english_arcade/main.js` (preload path)
- Netlify sentence audio URL resolver functions.

Data source:
- JSON files in `Games/english_arcade/sample-wordlists*/`.

Acceptance criteria:
- Default lists resolve sentence audio by sentence ID.
- No new uploads rely on `<word>_sentence` naming.
- Conflict class from duplicate word names is eliminated.

## Phase 4: Sentence Pattern Generator Module + Grammar Unscramble Assignment Flow [P1]

### Phase 4 Status: Done

Goal:
- Add a dedicated sentence-pattern generator that builds sentence sets from teacher-provided grammar templates (example pattern: `I have ___`).
- Feed generated sets into a standalone grammar sentence unscramble game.
- Keep teacher workflow identical to vocab flow: save game -> assign homework -> student completion tracking.

Implementation scope:
- Teacher tool module (new): pattern input + generation controls + preview + edit.
- Reuse existing sentence tooling where possible:
  - Existing sentence-oriented modes and sentence audio pipelines.
  - Existing assignment architecture in homework API.
- Save payload should include:
  - `pattern_key`, `pattern_text`, sentence set, difficulty metadata, optional tags.
- Assignments should support grammar mode similarly to vocab mode:
  - `list_meta.forced_mode = grammar_unscramble_sentence` (new mode key)
  - assignment run token flow remains unchanged.

Primary files (expected):
- Teacher UI:
  - `Teachers/tools/game-builder/` (add grammar sentence builder panel) or new dedicated tool under `Teachers/tools/grammar_sentence_builder/`.
- Arcade mode:
  - New mode file in `Games/english_arcade/modes/`, e.g. `grammar_unscramble_sentence.js`.
  - Mode registration in `Games/english_arcade/core/mode-registry.js`.
- Homework:
  - `netlify/functions/homework_api.js` (allow grammar sentence list metadata where needed).

Acceptance criteria:
- Teacher can generate sentence set from a pattern and edit output.
- Teacher can save and assign as homework.
- Student can play standalone grammar unscramble and completion logs to existing homework progress views.

## Phase 5: Homework Completion Notifications (Teacher) [P2]

### 9) Persistent homework notification indicator near burger icon
Goal:
- Teachers always see homework completion alerts next to menu icon.

Feature design:
- Add a bell/dot/badge component adjacent to burger icon.
- Count reflects new homework completions since last seen timestamp.
- Clicking indicator opens notification panel or routes to Homework tab with filters.

Backend requirements:
- Extend homework API with teacher notification query endpoint.
- Compute completed submissions by assignment/student over time.
- Store per-teacher `last_seen` marker.

Frontend requirements:
- Poll endpoint (for example every 60s) and on tab focus.
- Render badge count and compact item list.
- Clear or decrement notifications on view acknowledgment.

Primary files:
- `components/burger-menu.html`
- `components/burger-menu.js`
- `netlify/functions/homework_api.js`
- Optional helper in `Teachers/tools/student_tracker/`.

Acceptance criteria:
- Badge is visible on teacher pages with burger menu.
- New student homework completions raise count without page reload.

## Phase 5.1: Randomized Word-Emoji Match Ladder [P4]

### 9a) Build 4x4 word-emoji matching mode with level-based random list rotation
Goal:
- Add a fast, kid-friendly matching game where students can tap either a word card or an emoji card first, then complete the pair.
- Keep content sourcing simple by reusing existing sample vocab JSON files that already contain `eng` and `emoji` fields.
- Make the mode feel fresh by drawing a random eligible list from the selected level pool each time the student launches it.

Product behavior:
- 16 cards total per board: 8 English word cards + 8 emoji cards.
- Students can start from either side: word -> emoji or emoji -> word.
- Correct pair stays revealed; wrong pair flips back after a short delay.
- Session tracks attempts, matched pairs, completion percent, and end-of-round score.
- Mode should support repeated play by rotating through different lists within the chosen level.

Level and list strategy:
- Reuse existing level pools already defined for arcade list selection:
  - Level 1 -> `LEVEL1_LISTS`
  - Level 2 -> `LEVEL2_LISTS`
  - Level 3 -> `LEVEL3_LISTS`
  - Level 4 -> `LEVEL4_LISTS`
- On launch, choose one random eligible list from that level, then choose 8 valid entries from that list.
- Eligible entries must have a non-empty English value and a usable emoji.
- If a chosen list does not contain at least 8 emoji-ready entries, skip it and draw another list from the same level.
- Keep the first release limited to sample lists only; do not couple this phase to builder-created lists yet.

Implementation architecture:
- Reuse the current matching foundation rather than building a separate mini-engine from scratch.
- Add a dedicated mode module, example: `Games/english_arcade/modes/emoji_match_4x4.js`.
- Keep matching-specific board logic isolated in the new mode so legacy English-Korean matching is not destabilized.
- Register the new mode in both runtime entry points:
  - `Games/english_arcade/core/mode-registry.js`
  - `Games/english_arcade/main.js` mode loader map.
- Add mode chooser visibility in:
  - `Games/english_arcade/ui/mode_selector.js`
  - `Games/english_arcade/ui/mode_modal.js`
- Add dedicated UI styles for card sizing, flip states, matched states, and mobile responsiveness.

Gameplay implementation outline:
- Build a normalized deck shape per entry, for example:
  - pair id
  - `eng`
  - `emoji`
  - `listName`
  - optional progress metadata
- Duplicate each selected vocab item into two cards:
  - `type = word`
  - `type = emoji`
- Shuffle the full 16-card deck before render.
- Maintain a small interaction state:
  - first selected card
  - second selected card
  - lock flag while mismatch animation resolves
  - matched pair count
  - attempts count
- Prevent double-tapping the same card from counting as a pair attempt.
- Consider playing the base word audio when a word card is tapped, if that can be reused cheaply from existing TTS helpers.

Progress and scoring plan:
- Reuse the existing student session hooks already used by other modes:
  - `startSession`
  - `logAttempt`
  - `endSession`
- Log one attempt per revealed pair.
- Score should reward completion plus efficiency, using a simple first-pass rule:
  - completion required for end-of-session success
  - fewer attempts yields higher score/star outcome
- Keep scoring formula simple in v1 so it aligns with existing stars/progress systems without needing backend changes.

UI and launch plan:
- Add this mode as a selectable word-game mode, labeled clearly for children, for example `Emoji Match`.
- For the first pass, launch from an already selected level/list context rather than adding a brand-new top-level menu.
- If student entered from a level card, use that level's list pool for random selection.
- If student already loaded a specific sample list, allow the mode to use that current list directly when it has enough emoji-ready entries.
- Fall back gracefully with a friendly message if no eligible emoji list is available.

Primary files:
- `Games/english_arcade/modes/emoji_match_4x4.js`
- `Games/english_arcade/main.js`
- `Games/english_arcade/core/mode-registry.js`
- `Games/english_arcade/ui/mode_selector.js`
- `Games/english_arcade/ui/mode_modal.js`
- `Games/english_arcade/utils/level-lists.js`
- Optional shared styles helper under `Games/english_arcade/ui/`

Acceptance criteria:
- Mode is selectable in English Arcade.
- Students can tap either card type first and complete matches on a 4x4 board.
- Launching from a level chooses a random emoji-ready sample list from that level.
- Lists with missing emoji entries are skipped or filtered without breaking the run.
- Works on desktop and mobile without cards overlapping or becoming unreadable.
- Progress logging works with existing session/attempt infrastructure.

## Phase 6: Leaderboard Number Alignment (Student Tracker vs Student Dashboard) (play.js) [P3]

### 10) Make Student Dashboard the source of truth
Problem statement:
- Student Tracker and Student Dashboard show different numbers for stars/points/super score.
- Student-facing dashboard must be authoritative.

Implementation strategy:
- Align Teacher Student Tracker aggregation path with student leaderboard logic.
- Remove or constrain stale pre-aggregated path when it diverges from live results.
- Ensure same formulas and timeframe windows are used in both systems.

Primary files:
- `Teachers/tools/student_tracker/` frontend render and API usage.
- `netlify/functions/progress_teacher_summary.js`
- `netlify/functions/progress_summary.js`
- Optional: `netlify/functions/populate_daily_stats.js` if still needed as cache-only optimization.

Acceptance criteria:
- Same class/timeframe returns matching stars, points, and super score in both views.
- Student leaderboard remains unchanged.

## Phase 7: Phonics Mode Difficulty Tuning [P5]

### 11) Reduce phonics list session size from 24 to 12 words
Goal:
- Make phonics spelling/listening rounds more manageable.

Implementation options:
- Preferred: code-side cap (keep JSON full lists intact).
- Add `MAX_PHONICS_WORDS = 12` in phonics mode and slice shuffled list.
- Optionally make cap configurable in builder settings later.

Primary files:
- `Games/english_arcade/modes/phonics_listening.js`
- Any related phonics mode files.

Acceptance criteria:
- Each phonics run serves 12 words max.
- Existing wordlist JSON files remain unchanged unless explicitly requested.

## Phase 8: Final Touches / Load File Filtering System [P6]

Goal:
- Finish the stubborn saved-game/load-file filtering edge cases.
- Tighten search/filter behavior so stale cards and mismatched filters don’t leak through.
- Treat this as the last cleanup phase while the roadmap keeps growing.

Implementation focus:
- Stabilize saved-games filtering across page load, pagination, and search.
- Remove any stale cache paths that can repopulate old rows after filtering changes.
- Verify the filter state always matches the currently selected scope.

Primary files:
- `Teachers/tools/game-builder/ui/file-list.js`
- `Teachers/tools/game-builder/main.js`
- `Teachers/tools/game-builder/services/file-service.js`

Acceptance criteria:
- Saved-games filtering is stable after reload and pagination.
- Load/search/filter controls never reintroduce stale rows.
- No regressions in create/save/open flows.

## Execution Order
1. Phase 5 homework notifications.
2. Phase 5.1 matching game.
3. Phase 6 leaderboard alignment.
4. Phase 7 phonics tuning.
5. Phase 8 final touches / load file filtering.

## Testing Checklist
- Game Builder save/load regression tests (new save, overwrite, save as, image upload, sentence save).
- Sentence audio tests on default lists and builder-created lists.
- Teacher menu regression across all pages using shared burger component.
- Homework completion end-to-end test (assign -> student completes -> teacher sees notification).
- Leaderboard parity checks for same class/timeframe in tracker vs dashboard.
- Phonics run count assertions (12 words max).
- New matching mode functional and responsive UI checks.

## Notes for Future AI Agents
- Preserve secure auth/storage patterns; do not introduce token storage anti-patterns.
- Maintain backward compatibility for legacy audio lookups during migration window.
- Treat student-facing leaderboard values as immutable product expectation unless explicitly approved.
- Prefer small, reversible changes with clear feature flags when touching cross-cutting score/audio logic.

## Addendum: New Items Requested (2026-03-27)

### 14) Version/Environment Badges: Staging-Only Visibility [P7]
Goal:
- Show environment/version badges only in staging contexts, not on production branches/domains.

Implementation approach:
- Centralize environment check in a shared utility (or reuse existing host checks):
  - staging allowed: `staging.willenaenglish.com`, `.pages.dev`, localhost.
  - production blocked: `students.willenaenglish.com`, `teachers.willenaenglish.com`, main production domains.
- Render badge UI only when `isStagingLikeHost === true`.
- Optional hard kill-switch:
  - `window.__SHOW_ENV_BADGES = false` default in prod templates.

Where to wire host checks:
- `students/api-gateway.js` and `students/scripts/api-base.js` already contain host routing logic and can be reused for consistent environment detection.

Acceptance criteria:
- Badges never appear on production domains.
- Badges continue to appear on staging and branch previews.

### 15) Spelling Homework Difficulty Tiers (Stars Target) [P8]
Goal:
- For spelling homework assignments, provide three selectable levels:
  - Easy -> 1 star target
  - Medium -> 3 stars target
  - Hard -> 4 stars target

Implementation approach:
- Extend homework assignment UI with a `spelling difficulty` selector when spelling mode is chosen.
- Persist to assignment metadata (example):
  - `list_meta.spelling_level = easy|medium|hard`
  - `goal_type = stars`
  - `goal_value = 1|3|4`
- Enforce in runtime display and completion summaries.

Primary files:
- `Teachers/tools/student_tracker/homework-modal.js`
- `Teachers/tools/shared/homework-assignment.js`
- `netlify/functions/homework_api.js`

Acceptance criteria:
- Teacher can assign spelling homework with tiered star goals.
- Student sees level label and required star target.
- Tracker progress aligns to assigned target.

### 16) Large List Management: Split Wizard + Warning Modal [P9]
Goal:
- Prevent sending oversized single assignments that reduce engagement.
- If list size > 20 words, prompt teacher to either continue or split into parts.

Implementation approach:
- Add pre-assignment guard modal:
  - Message example: `This list has 50 words. Send as one assignment, or split into 3 parts?`
- Add quick split options:
  - equal chunks (e.g. 20/20/10)
  - teacher-defined chunk size.
- Generate multiple assignments preserving naming:
  - `Title (Part 1/3)`, `Title (Part 2/3)`, `Title (Part 3/3)`.

Primary files:
- `Teachers/tools/student_tracker/homework-modal.js`
- `Teachers/tools/shared/homework-assignment.js`

Acceptance criteria:
- Modal appears automatically for >20 words.
- Teacher can split in one click.
- Resulting parts are independently assignable and trackable.

### 17) Difficult-Words Practice Loop (Research + Recommendation) [P10]
Research findings in current codebase:
- A challenging-words system already exists and is production-ready at API level:
  - `netlify/functions/progress_summary.js` sections `challenging` and `challenging_v2`.
  - `challenging_v2` uses SQL RPC `challenging_words_v2` for lightweight aggregation.
- Student profile already fetches challenging items:
  - `students/student_profile.js` calls `progress_summary?section=challenging`.
- UI section exists but is currently commented out in profile markup:
  - `students/profile.html` challenging section block is disabled.

Recommendation:
- Reuse this challenging-word pipeline as the source for spelling remediation.
- Add `Practice Difficult Words` action that launches spelling mode with only challenging words.
- Start with read-only integration before adding extra storage schema:
  - Fetch challenging list -> build temporary session list -> run spelling mode.
- Later enhancement:
  - Add teacher visibility for each student challenging pool and optional assignment from it.

Suggested MVP flow:
1. Student completes homework and accumulates incorrect attempts.
2. `challenging_v2` returns low-accuracy/high-miss words.
3. Student taps `Practice Difficult Words` from dashboard/profile.
4. Arcade launches spelling mode with this filtered list.
5. New attempts feed back into challenging ranking.

Acceptance criteria:
- Student can quickly retry hardest words from homework.
- Difficult-word list shrinks naturally as accuracy improves.

### 18) Real-Time Stars Update [P11]
Goal:
- Make stars update in real time during and immediately after game sessions (no stale delay).

Implementation approach:
- Emit a star/progress update event on each scored attempt and on session end.
- Refresh star UI counters optimistically first, then reconcile with server response.
- Keep Student Dashboard and Student Tracker star totals synchronized to the same aggregation rules.

Primary files:
- `students/dashboard.html`
- `students/scripts/points-client.js`
- `students/records.js`
- `Games/english_arcade/main.js`
- `netlify/functions/progress_summary.js`
- `netlify/functions/progress_teacher_summary.js`

Acceptance criteria:
- Student-visible stars increment without manual refresh.
- Teacher tracker and student dashboard show matching star totals shortly after each session.

### 19) Keep Watching: Homework Spelling Launch Bounce Regression [P12]
Status:
- Mitigation deployed on `staging` (2026-03-27), but issue is intermittent and should remain on active watch.

Observed behavior:
- In some homework launches with forced spelling mode, the game can briefly enter spelling and then return to mode selector.

What was changed:
- Added forced-autostart mode guards in arcade launch flow so delayed callbacks do not reopen mode selector during forced homework starts.
- Added short selector re-entry guard window after forced launch.

Primary file touched:
- `Games/english_arcade/main.js`

Watch checklist:
- Re-test homework autostart on mobile and desktop after cache clears.
- Verify both saved-game and sample-list homework flows with `mode=spelling`.
- Monitor console for unexpected `startModeSelector` calls during first 5 seconds after launch.

Escalation if it returns:
- Add call-site tracing around `startModeSelector()` and history restore handlers.
- Lock selector restoration when URL indicates active autostart + forced mode until first question render completes.

## Actionable One-Edit Roadmap (Fastest -> Slowest)

This queue is optimized for single-pass edits/commits where each item can be completed in one cohesive patch.

1. Add explicit watch-note timestamp + owner line in roadmap.
  - File: `Games/english_arcade/April 2026 plan.md`

2. Add lightweight autostart bounce debug-flag logs.
  - File: `Games/english_arcade/main.js`

3. Add selector re-entry tracing on popstate restores.
  - File: `Games/english_arcade/history-manager.js`

4. Enforce phonics max-12 word cap in runtime.
  - File: `Games/english_arcade/modes/phonics_listening.js`

5. Add staging-only gate for environment/version badges.
  - Files: `Games/english_arcade/main.js`, `students/api-gateway.js`

6. Burger menu quick UX bundle: icon-only label + cyan tone + Game Builder link.
  - Files: `components/burger-menu.html`, `components/burger-menu.js`

7. Homework card launch hardening for forced spelling metadata normalization.
  - File: `Games/english_arcade/index.html`

8. Add one-call guard around repeated save actions in builder UI handlers.
  - File: `Teachers/tools/game-builder/ui/event-handlers.js`

9. Add save mutex + first-save completion lock in builder file service.
  - File: `Teachers/tools/game-builder/services/file-service.js`

10. Improve title conflict reliability via full-pagination/backend-filter fallback.
  - File: `Teachers/tools/game-builder/services/file-service.js`

11. Spelling homework tier UI wiring (easy/medium/hard -> goal values).
  - Files: `Teachers/tools/shared/homework-assignment.js`, `Teachers/tools/student_tracker/homework-modal.js`

12. Large-list split warning modal + chunked assignment submit flow.
  - Files: `Teachers/tools/student_tracker/homework-modal.js`, `Teachers/tools/shared/homework-assignment.js`

13. Teacher homework completion badge near burger with polling + unread count.
  - Files: `components/burger-menu.html`, `components/burger-menu.js`, `Teachers/tools/student_tracker/manage_students.html` (or teacher home entry page)

14. Student/teacher leaderboard parity alignment pass.
  - Files: `netlify/functions/progress_summary.js`, `netlify/functions/progress_teacher_summary.js`, `students/dashboard.html`

15. Student Tracker month filter upgrade (month name + filter by month).
  - Files: `Teachers/tools/student_tracker/` UI page(s), `Teachers/tools/student_tracker/manage_students.js` (or equivalent controller), and related query helpers.
  - Edit scope:
    - Replace generic `This Month` label with explicit month name (example: `March 2026`).
    - Add month picker/filter so teacher can jump to any month quickly.
    - Keep current month as default selection.

16. Build dedicated student leaderboard area (healthy comparison mode).
  - Files: `students/dashboard.html`, `students/dashboard.css`, `students/language.js`, leaderboard data source hooks.
  - Edit scope:
    - Add a clear leaderboard section where students can compare stars/points/rank.
    - Include simple category views (class rank, monthly rank, improvement rank).
    - Add encouraging copy so competition stays positive and confidence-building.
