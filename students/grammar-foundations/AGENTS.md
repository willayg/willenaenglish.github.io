# GRAMMAR FOUNDATIONS

This is a sister app to Test Prep. It teaches prerequisite middle-school grammar in short stages.

## Shared platform rule

Do not create a second question renderer, grader, keyboard, AI tutor, or student identity layer here.

Use the canonical shared entry points:

- `../shared/student-question-renderer.js` — forwards to the same battle-tested renderer used by Test Prep.
- `../shared/question-grader.js` — canonical question grading.
- `../shared/ai-willi.js` — AI Willi grading/helper UI.
- `../shared/willena-keyboard.js` — typed-answer keyboard behavior.
- `../shared/student-header-data.js` — student identity/points/stars.
- `../shared/student-accessibility.js` — shared large-text setting when needed.

The app intentionally reuses Test Prep CSS for the existing renderer/header visual language. App-local `styles.css` should contain only Grammar Foundations shell/layout styles.

## P2 scope

The first vertical slice is `be_present` only:

1. subject → am/is/are
2. positive sentences
3. negatives
4. questions
5. mixed school style

Each stage has 10 questions. 8/10 passes. P2 is intentionally not persistent: stage mastery/database tracking belongs to P3.
