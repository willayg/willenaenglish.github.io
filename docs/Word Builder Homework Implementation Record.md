# Word Builder Homework Implementation Record

Date: 2026-03-20
Branch updated: staging

## Scope

Applied homework-related Cloudflare Worker improvements from the `students` branch into `staging`.

Explicitly not included in this change set:

- legacy Netlify function updates in `netlify/functions/homework_api.js`
- the `link_sessions` feature
- teacher UI branch regressions unrelated to the Cloudflare Worker

## Files Changed

- `cloudflare-workers/homework-api/src/index.js`
- `docs/Word Builder Homework Implementation Record.md`

## Additional 2026-03-20 Changes

### 3. Added custom saved-game homework support

Implemented a path for homework assignments that point to existing `game_data` records instead of static JSON files.

Applied changes to:

- `cloudflare-workers/homework-api/src/index.js`
- `students/dashboard.html`
- `students/records.js`
- `Games/english_arcade/main.js`
- `Teachers/tools/game-builder/create-game-modal.js`
- `Teachers/tools/game-builder/main.js`
- `Teachers/tools/wordtest/wordtest2.html`

Key behavior:

- homework assignments can now reference `saved_game` content through `list_meta.source_type = saved_game`
- custom assignments use `list_meta.game_id` to identify the saved `game_data` record
- new assignments now receive an auto-generated run token in the Cloudflare Worker
- student homework launch opens English Arcade directly into a saved custom game when the assignment is custom
- student session tracking now requests homework run tokens by assignment id when a homework id is present in the URL

### 4. Converted Game Builder homework into real homework assignment creation

Updated the existing Game Builder "Assign Homework" path so it:

- saves or updates the custom `game_data` record first
- then creates a real homework assignment through `homework_api`

This replaces the previous misleading behavior where the action only saved custom game data without creating homework.

### 5. Added Word Builder homework handoff

Added an `Assign Homework` action to Word Builder that:

- packages the current worksheet payload
- opens Game Builder
- auto-opens the Game Builder homework panel for assignment creation

### 6. Removed red logout button patterns

Removed or neutralized the red logout UI treatment in the shared app surfaces.

Updated files:

- `components/burger-menu.js`
- `components/burger-menu.html`
- `Teachers/tools/wordtest/wordtest2.html`
- `Teachers/tools/reading/reading.html`
- `Teachers/tools/Grammar/grammar2.html`
- `Teachers/profile.html`
- `students/components/student-header.js`

Changes made:

- removed temporary red floating logout pills from teacher tools
- added neutral logout handling to the shared teacher burger menu
- changed remaining logout controls away from red emphasis styling

### 7. Began Game Builder shell alignment with Word Builder

Updated Game Builder to use the same shared navigation pattern as Word Builder.

Updated files:

- `Teachers/tools/game-builder/index.html`

Changes made:

- added API gateway and API config bootstrapping
- replaced the custom in-page burger list with the shared burger menu mount

This aligns the outer app shell with the current Word Builder setup and removes the older separate logout/menu treatment.

## Changes Made

### 1. Expanded homework session matching in the Cloudflare Worker

Updated the assignment progress matching logic so `progress_sessions.list_name` can match assignment data through more than just the raw filename.

Added matching for:

- full `assignment.list_key`
- `assignment.list_key` without the `Games/english_arcade/` prefix
- core filename with underscores converted to spaces
- assignment title text
- assignment list title text
- normalized underscore/space/hyphen variants
- majority token matching across significant filename tokens

Purpose:

- reduce false negatives when homework assignments and recorded game sessions use different path or display-name formats
- improve progress attribution for grammar and word-list homework items

### 2. Added special grammar mode totals

Updated grammar homework mode counting to support list-specific totals instead of only the generic level-based defaults.

Added these rules:

- `prepositions_*` level 2 lists use `4` modes
- `wh_who_what`, `wh_where_when_whattime`, and `wh_how_why_which` use `4` modes
- `present_simple_questions_wh` uses `5` modes

Purpose:

- make completion percentages accurate for grammar lists that do not expose the standard full set of grammar modes

## Notes

No changes were made to the current teacher-facing homework UI in this step.

No changes were made to the old Netlify homework function in this step.
