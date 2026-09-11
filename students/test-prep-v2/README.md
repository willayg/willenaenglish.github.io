# Willena Test Prep v2

## Non-negotiable architecture rules

Test Prep V2 is a hard-cutover architecture. Do not reintroduce old Test Prep engines as fallbacks, compatibility implementations, DOM patches, or skill-specific copies.

### Renderer

`students/test-prep-v2/question-renderer.js` is the ONLY graded question renderer implementation.

If a normal question form renders incorrectly:

1. Fix `question-renderer.js` when the canonical form itself is wrong.
2. Fix the source/model adapter when source data is not being converted into the canonical form correctly.
3. Do not add grammar-, reading-, vocab-, review-, passage-, or 서술형-specific renderers for an interaction that already exists centrally.

`students/question-render-lab/` imports the exact same renderer and canonical question model. The lab is a test harness only.

### Grading

There is ONE grading policy and ONE grader:

- `students/shared/question-grading-policy.js` — sole authority for deterministic vs semantic grading policy and canonical grading constraints.
- `students/shared/question-grader.js` — sole grader implementation: hard constraints -> deterministic equivalence -> strict Luna adjudication when policy permits semantic equivalence.

There is no V2-local grader implementation or compatibility grader file.

The old `metadata.ai_allowed` and `metadata.grading_mode` fields are legacy content metadata and are NOT grading-policy authority in V2. The canonical policy is derived from question form/type and structured task constraints. A future exceptional row can use `metadata.grading_policy_override`, but ordinary content must not require per-row AI switches.

The shared grader currently treats genuinely open answer families such as translation, open reading answers, open dialogue responses, summaries, and supported composition tasks as semantic where multiple correct wordings can exist. Exact-form families such as spelling, word forms, blanks, ordering, and structured corrections remain deterministic.

Hard constraints are enforced before semantic AI where they can be proved locally, including:

- whole-answer and per-part word counts
- contraction required / contraction forbidden
- explicit required words
- explicit required expressions such as `context.use`
- correction identity and numbered/lettered item identity

Deterministic normalization also accepts ordinary contraction equivalence such as `isn't` / `is not` unless the task explicitly requires or forbids a contraction.

Correction grading remains deterministic. A student may enter a larger corrected phrase only when the stored wrong span is correctly replaced and all surrounding words remain unchanged. Identified corrections must also identify the correct numbered/lettered item.

Semantic grading uses GPT-5.6 Luna through the shared grader and fails closed. The model answer is a reference answer, not automatically the only legal wording when the canonical grading policy permits semantic equivalence.

### Canonical grading flow

`Content source -> Question model -> Shared grading policy -> Renderer -> Shared grader -> Tracker`

The renderer displays and collects answers. It does not decide correctness. The grading policy decides how a question should be judged. The grader performs the judgment. The tracker records the result.

## Module ownership

- `question-model.js` — canonical question contract + source adaptation; applies the shared grading policy to stored questions
- `question-renderer.js` — only graded answer UI renderer
- `students/shared/question-grading-policy.js` — only grading-policy authority
- `students/shared/question-grader.js` — only grader implementation
- `passage-utils.js` — passage/sentence parsing used by assessment contexts
- `passage-source.js` — canonical textbook passage adapter; never creates identity by hashing browser text
- `passage-learning.js` — ordered/resumable textbook 본문 workflow; graded sentence work uses central renderer/grader/tracker
- `vocab-learning.js` — vocabulary workflow/stage state; graded vocab uses central renderer/grader/tracker
- content/source modules — candidate content loading/generation only
- `students/shared/question-sequencer.js` — canonical smart question queue selection for ordinary practice
- `tracking-client.js` — ALL Test Prep V2 attempt/session persistence and sync
- `students/shared/student-stats.js` — canonical student statistics gateway; backend owns statistical truth
- `students/shared/student-review.js` — canonical 오답/review gateway; backend owns review truth
- `students/shared/willena-keyboard.js` — single shared Willena text-entry keyboard
- `students/shared/question-flags.js` — single shared student question-reporting module
- `navigation.js` — only browser/history navigation owner
- `app.js` — plan / lesson / practice route controller

## V2.24 authored 서술형 workflow

Authored written responses are canonical questions, not a second 서술형 engine.

- Stored authored text questions adapt into `write`, `multipart`, `correction`, or `identified_correction` forms.
- Packed answers such as `read / to` become multiple required inputs only when stored context proves the same number of answer slots.
- Multi-part questions require every required field before submission.
- Ordinary corrections render `wrong -> right` fields.
- Questions that require the student to identify the wrong numbered/lettered item use `identified_correction`; the renderer never pre-fills the correct item number.
- English, Korean, symbol-only and mixed answer controls carry input-language metadata for the shared keyboard.
- Translation/open-response questions are graded according to the shared type-aware grading policy, not per-row legacy AI flags.
- Structured model answers are displayed by the central renderer after an incorrect response.
- Attempts and later 오답 review use the canonical tracker/review backend. There is no 서술형-only review queue.

The old `students/test-prep-app/seosul-engine.js`, `seosul-authored.js`, `semantic-grader-v1.js`, `seosul-ai-feedback.js`, `seosul-ai-responses-fix.js`, and related files are part of the isolated old Test Prep A application only. Test Prep V2 does not import, call, wrap, fall back to, or depend on them.

## Shared keyboard

`students/shared/willena-keyboard.js` is the only Willena on-screen keyboard module.

It consumes renderer text-entry metadata and owns keyboard UI behavior only. It does not grade or track answers. No workflow-specific spelling/서술형/review keyboard should be added.

## Shared question flags

`students/shared/question-flags.js` owns the flag button, modal, reason list, optional note, persistence, duplicate guard and submitted state.

Test Prep installs it once around the canonical renderer. It does not scrape app-specific DOM shapes. “Report + replace question” is not owned by the flagger; replacement belongs to the canonical sequencer.

## Canonical question sequencing

Ordinary random practice uses `students/shared/question-sequencer.js`.

Content modules provide candidate pools; they do not choose the final practice queue. The sequencer prefers unseen material, suppresses recent repeats, then favors historically weaker material and balances available forms/targets.

Ordered textbook 본문 and backend-authoritative 오답 scheduling remain deliberate exceptions because they are not ordinary random-practice selection problems.

## Textbook 본문 workflow

본문 is a workflow, not a second question engine.

- Sentence identity is the stored `source_content_occurrences.id` UUID.
- Browser code does not synthesize/hash textbook sentence IDs.
- Canonical sentences come from `test_prep_passage_sentences_v1`.
- Ordered practice follows textbook order and resumes from server-authoritative progress.
- Progress is stored in Tracking DB `test_prep_passage_progress_v1`.
- Wrong/skipped answers advance the ordered cursor while correctness remains recorded for later review/sequencing.
- Graded sentence completion uses the central renderer/shared grader/tracker.
- A passage without complete Korean may be displayed, but Korean->English ordered practice is disabled rather than fabricated.

## Canonical stats and review

Do not label lesson/skill card percentages as mastery.

Card metrics come from `students/shared/student-stats.js`:

- Questions complete = unique current canonical questions attempted / current available questions
- Coverage = completed / available
- Accuracy = recent canonical item outcomes according to the backend contract
- retired/stale content is excluded

Apps do not independently recalculate denominators, completion, accuracy, review stages, or review counts.

오답 queues come through `students/shared/student-review.js` and are rendered/graded with the same canonical renderer and shared grader as ordinary practice.

## Vocabulary learning parity

The old vocabulary learning sequence is intentionally preserved as a workflow:

1. Cards
2. Korean -> English
3. English -> Korean
4. Spelling

Preserved behavior includes answer reveal, English TTS, yes/no card self-checks, repeating unknown words, stage unlocks, persisted cleared lexical IDs, and resuming the first unfinished stage. Graded interactions still use the central renderer/shared grader/tracker.

## Tracking hardening retained

`tracking-client.js` owns:

- persistent attempt outbox
- batched upload and retry
- recovery after reload
- active-time measurement that pauses while hidden/unfocused
- persistent active session identity
- failed session-close retry
- flush before close
- stable `client_attempt_id`
- auth refresh/retry
- app/renderer/source/mastery/grading metadata on attempts

There is no second tracker or tracking patch file.

## Remaining major migrations

- 수행평가 workflow
- Ask Willi helper UI
- 실전모의고사 workflow
- final production migration / retirement of obsolete old-app code when Test Prep A is no longer needed

New work must be implemented as shared services, canonical sources, or workflows around the central renderer/grader/tracker contracts. Do not revive old Test Prep engines as fallback code.
