# Shared Question Sequencer

`students/shared/question-sequencer.js` is the single queue-selection service for ordinary Test Prep practice.

## Ownership

The sequencer owns final selection and ordering for candidate pools used by Grammar, Communication, Reading, Vocab Test and authored Constructed Response practice.

Content-source modules own candidate discovery/generation only. `app.js` requests a queue and does not shuffle/slice candidate pools itself.

The sequencer reads canonical per-question student history through `test-prep-sequencer-state-v1`, which returns `test_prep_question_state` rows for the authorized plan/student.

## V1 rules

- Prefer unseen canonical targets until current candidate coverage is exhausted.
- Never select the same canonical target twice in one queue.
- Once unseen targets are exhausted, favor historically weaker questions.
- Strongly suppress very recently attempted seen questions when alternatives exist.
- Balance question types, forms and targets to avoid repetitive runs.
- Vocab Test keeps a soft stored/generated/base mix where those candidate categories are available.
- Selection is deterministic enough to debug; seeded tie-breaking is used instead of opaque AI choice.
- If history loading fails, practice fails open to a deterministic balanced queue rather than blocking the lesson.

## Deliberate exceptions

- Ordered textbook passage learning remains textbook-order/resumable and does not use the sequencer.
- Vocabulary learning keeps its Cards → Korean→English → English→Korean → Spelling pedagogy and cleared-item progression.
- 오답/review remains backend-authoritative through `student-review.js` and `test-prep-review-v1`.

## Debugging

On staging, append `?seqdebug=1` to the Test Prep V2 URL. After entering a sequenced practice, the debug panel shows whether history loaded, candidate/selected counts, unseen/seen counts, bucket/type mix, and the reason each selected target entered the queue.
