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