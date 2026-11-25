# Grammar Ten 완성 2 — expansion review (2026-11-05)

## Verified existing implementation
- 11 chapters × 3 activities (choose, check, hunt) × 8 questions = **264 questions**.
- Every question has four options, a valid zero-based answer index, and an explanation.
- 88 questions use the whole-sentence options display; 176 use the default mode-specific display.
- 81 raw question prompts contain no Korean wording; the runtime adds Korean instructions to some of these.
- Chapter 2–11 mastery uses the revision-2 `-r2` question IDs; chapter 1 keeps its existing IDs.
- Saved attempts, mastery, homework, and gold units must not be reset or rekeyed as part of UI improvements.

## Exam-style changes to evaluate
1. Five-option sentence selection (Korean school exams).
2. Multiple-correct selection rendered as one of five combinations, or a separately graded multi-select form.
3. Dialogue-based grammar judgments with one consistent conversational context.
4. Underlined-part error hunts where the selected span maps unambiguously to the source sentence.
5. Korean-guided sentence transformations / typed answers, requiring a distinct grader and acceptable-alternative policy.
6. Korean explanations shown after every answer, not merely stored as unused metadata.

## Current change boundary
The three new coursebook packs introduce **5 questions per mode** for each of eight units in Oxford Buzz 6, Everybody Up 5, and Everybody Up 6. Grammar Ten retains its existing **8 per mode**. The new books use separate saved-progress IDs, keys and an authenticated progress RPC.

## Follow-up before changing Grammar Ten
Run a student-facing content review and migrate question styles without changing established question IDs. Confirm that any expanded question set respects current mastered IDs, homework eligibility, retry behavior, gold medals and assignment progress.