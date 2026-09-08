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

The lab also imports the canonical `question-model.js`. `passage-utils.js` remains the shared parser for passage-shaped assessment contexts. The textbook 본문 workflow does not split textbook prose in the browser; it consumes canonical passage-sentence occurrences from the content database.

## Module ownership

- `question-model.js` — standard question contract + source adaptation
- `question-renderer.js` — the only module allowed to create graded question answer UI
- `question-grader.js` — exact, structured, constraint and configured Luna grading
- `passage-utils.js` — passage/sentence parsing used by assessment-question contexts
- `passage-source.js` — canonical Test Prep textbook-passage content adapter; never creates identity by hashing browser text
- `passage-learning.js` — ordered/resumable textbook 본문 workflow; graded sentence-building uses the central renderer/grader/tracker
- `vocab-learning.js` — vocabulary stage workflow, lexical loading, card self-checks, unlock state and vocab progress only; graded Korean/English/spelling questions still call the central renderer
- content/source modules — question generation/loading only
- `tracking-client.js` — ALL Test Prep v2 attempt/session persistence and sync
- `students/shared/student-stats.js` — canonical browser gateway for student statistics; backend owns statistical truth
- `students/shared/student-review.js` — canonical browser gateway for 오답/review queues; backend owns review truth
- `stats-client.js` — temporary Test Prep compatibility shim delegating to shared student stats
- `navigation.js` — the only browser/history navigation owner
- `app.js` — student plan / lesson / practice route controller

## V2.18 textbook 본문 workflow

본문 is a workflow, not a second question engine.

Production rules:

- Content identity is a stored `source_content_occurrences.id` UUID for each passage sentence occurrence.
- The browser does not split passage text into sentences and does not synthesize/hash question IDs.
- Canonical sentence content is exposed through `test_prep_passage_sentences_v1` in the Content DB.
- The default learning order is textbook/passage order.
- The full passage can be read before practice, with sentence-level Korean shown or hidden when available.
- Ordered practice runs in manageable batches and resumes at the server-authoritative next sentence.
- Resume state is stored in Tracking DB `test_prep_passage_progress_v1`, not localStorage.
- The client has SELECT-only access to its own progress. Progress advances server-side from recorded Test Prep attempts.
- Wrong/skipped answers still advance the ordered reading cursor; correctness remains preserved in raw attempt history for later review/sequencing decisions.
- Graded sentence completion is represented as the normal `FORMS.chunks` question model and uses `question-renderer.js`, `question-grader.js`, and `tracking-client.js`.
- 본문 workflow progress does not inflate the canonical assessment-question denominator shown on Test Prep cards.
- A passage without complete sentence-level Korean can still be displayed, but Korean→English ordered practice is disabled rather than silently producing broken prompts.
- Random/spaced sentence practice is intentionally not implemented here. It should consume the future canonical sequencing service rather than introducing a passage-only scheduler.

## Canonical stats and review

Do not label lesson/skill card percentages as mastery.

Card metrics come from the canonical backend through `students/shared/student-stats.js`:

- **Questions complete** = unique current canonical questions attempted / current available questions.
- **Coverage** = questions complete / available questions.
- **Accuracy** = recent canonical item outcomes as defined by the backend contract.
- Retired/stale content must not inflate completion.
- Apps do not independently recalculate denominators, completion, accuracy, or review counts.

오답 queues come through `students/shared/student-review.js`. Test Prep V2 renders the canonical queue using the same question renderer/grader as ordinary practice.

## Vocabulary learning parity

The old vocabulary learning sequence is intentionally preserved:

1. Cards
2. Korean → English
3. English → Korean
4. Spelling

Preserved behavior includes card answer reveal, browser English TTS, `예 / 아니요` card self-checks, repeating unknown words, stage unlocks, persisted cleared lexical IDs, and resuming the first unfinished stage. Graded vocabulary interactions use the central renderer and tracking client.

## Tracking hardening retained

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
- app/renderer/source/mastery/grading metadata on attempts

There is no second tracker or tracking patch file.

## Remaining major work

- full authored written-response parity
- Ask Willi helper UI
- 수행평가 workflow
- 실전모의고사 workflow
- student question flags
- canonical smart question selection / balancing / sequencing

Those systems should be migrated as sources/workflows around the central renderer and shared backend contracts, not as new renderers or app-local truth engines.
