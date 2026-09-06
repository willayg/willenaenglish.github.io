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
- `stats-client.js` — the only owner of Test Prep card metrics
- `app.js` — student plan / lesson / practice controller

## V2.13a card metrics

Do not label lesson/skill card percentages as mastery.

Card metrics are:

- **Questions complete** = unique current questions attempted / current available questions.
- **Coverage** = questions complete / available questions. Rings and progress bars show coverage.
- **Accuracy** = each unique question contributes only its latest answer.
- A later right answer overwrites an earlier wrong answer for card accuracy.
- A later wrong answer overwrites an earlier right answer for card accuracy.
- If 40 or fewer unique questions have been attempted, accuracy uses all of them.
- If more than 40 unique questions have been attempted, accuracy uses the 40 unique questions with the most recent latest-attempt timestamps.
- Repeated raw attempts on one question must never give that question extra weight.
- Attempts for questions that are no longer in the current available lesson pool must not inflate questions-complete counts.

`stats-client.js` owns this calculation. Do not recalculate these metrics independently in cards, teacher pages, or future widgets.

For the vocabulary learning section, current lexical entries are the available-question identities. Flashcard reveal/self-check steps are learning workflow and do not count as graded questions; Korean→English, English→Korean, and Spelling responses do.

## V2.13 vocabulary learning parity

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
