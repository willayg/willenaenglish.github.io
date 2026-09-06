# Willena Test Prep v2

## Non-negotiable renderer rule

No renderer patch files.

If a question does not render correctly:

1. Fix `question-renderer.js` if the standard question form is rendered incorrectly.
2. Fix the source adapter if source data is not being converted into the standard question shape correctly.
3. Do not add a skill-specific renderer for an interaction that already exists centrally.

## Renderer single source of truth

`students/test-prep-v2/question-renderer.js` is the ONLY question renderer implementation.

The renderer lab at `students/question-render-lab/` imports that exact file. The lab is only a test harness for selecting/loading questions and applying diagnostic styles.

Do not copy or reimplement renderer functions in the lab. A rendering fix made in `question-renderer.js` must affect both Test Prep v2 and the lab automatically.

The lab also imports the canonical `question-model.js`. Passage sentence preprocessing lives in `passage-utils.js` so abbreviation handling such as `Dr.` cannot drift between the lab and the app.

## Module ownership

- `question-model.js` — standard question contract + source adaptation
- `question-renderer.js` — the only module allowed to create question answer UI
- `question-grader.js` — exact, structured, constraint and configured Luna grading
- `passage-utils.js` — shared passage/sentence parsing
- content/source modules — question generation/loading only
- `tracking-client.js` — ALL Test Prep v2 attempt/session persistence and sync
- `stats-client.js` — the only UI-facing Test Prep stats interpretation layer
- `app.js` — student plan / lesson / practice controller

## V2.12 status

Included:

- student auth and assigned plans
- Test Prep visual shell / curved header
- exam and lesson cards
- lesson journey presentation
- responsive/mobile layout
- source badges and central question styling
- Communication multiple choice
- Grammar multiple choice
- Reading multiple choice
- stored authored written-response questions
- central grading
- existing plan/lesson summary stats through one stats module

### V2.12 tracking hardening

`tracking-client.js` now owns:

- local persistent attempt outbox
- batched attempt upload
- timer and size-triggered flushing
- retry when connectivity returns
- recovery of unsent attempts after reload
- active-time measurement that pauses when the page is hidden/unfocused
- persisted active session identity for abrupt reload recovery
- pending session-close persistence so a failed final network request is retried later
- attempt flushing before a session is closed
- stable `client_attempt_id` values so backend duplicate protection can work
- one automatic token refresh/retry after an unauthorized API response
- `app_rev`, central renderer revision, source, mastery key and grading method in attempt metadata

There is no second tracker or tracking patch file.

Not yet migrated:

- vocabulary lexical generator
- vocabulary learning workflow
- 본문 activity workflow
- 수행평가 workflow
- new 오답 state flow
- flags
- smart question selection / balancing

Those systems should be migrated as sources/workflows around the central renderer, not as new renderers.
