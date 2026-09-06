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
- `question-renderer.js` — the only module allowed to create graded question answer UI
- `question-grader.js` — exact, structured, constraint and configured Luna grading
- `passage-utils.js` — shared passage/sentence parsing
- `vocab-learning.js` — vocabulary stage workflow, lexical loading, card self-checks, unlock state and vocab progress only; graded Korean/English/spelling questions still call the central renderer
- content/source modules — question generation/loading only
- `tracking-client.js` — ALL Test Prep v2 attempt/session persistence and sync
- `stats-client.js` — the only UI-facing Test Prep stats interpretation layer
- `app.js` — student plan / lesson / practice controller

## V2.13 status

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
- hardened attempt/session tracking from V2.12
- existing plan/lesson summary stats through one stats module

### V2.13 vocabulary learning parity

The old vocabulary learning sequence is intentionally preserved:

1. Cards
2. Korean → English
3. English → Korean
4. Spelling

Preserved behavior:

- card answer reveal
- browser English TTS on cards
- `예 / 아니요` card self-check
- words marked `아니요` repeat until cleared
- Korean → English stays locked until cards are complete
- English → Korean stays locked until Korean → English is complete
- Spelling stays locked until English → Korean is complete
- non-card stages save correctly cleared lexical-entry IDs
- incorrect/uncleared words are the only words required on the next pass
- completed stages remain permanently unlocked
- returning to vocabulary resumes the first unfinished stage
- completing Spelling marks the Vocabulary workflow complete
- existing `test_prep_vocab_progress` and `test_prep_vocab_self_checks` data are reused rather than replaced
- Korean → English, English → Korean and Spelling attempts are recorded through the V2.12 tracking client
- graded vocabulary interactions use `question-renderer.js`; the old vocab choice/spelling renderer and MutationObserver patch stack were not carried over

The card view is workflow UI rather than a graded question. It is allowed to own its reveal/self-check controls, but it must not implement a second graded question renderer.

## V2.12 tracking hardening retained

`tracking-client.js` owns:

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

- vocabulary exam/test generator (V2.14)
- full authored written-response parity
- Ask Willi helper UI
- 본문 activity workflow
- 수행평가 workflow
- new 오답 state flow
- flags
- smart question selection / balancing

Those systems should be migrated as sources/workflows around the central renderer, not as new renderers.
