# Willena Test Prep v2

## V2.1 rule

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

## Current modules

- `question-model.js` — standard question contract + stored-question adapter
- `question-renderer.js` — the only module allowed to create question answer UI
- `question-grader.js` — exact, structured, constraint and configured Luna grading
- `passage-utils.js` — shared passage/sentence parsing used by diagnostics and future 본문 workflow
- `content-source.js` — current stored middle-school question source
- `tracking-client.js` — sessions and attempts using the existing Test Prep backend
- `stats-client.js` — the only UI-facing Test Prep stats interpretation layer
- `app.js` — student plan / lesson / practice controller

## V2.1 scope

Included:

- student auth and assigned plans
- lesson scope
- Communication multiple choice
- Grammar multiple choice
- Reading multiple choice
- stored authored written-response questions
- W / Z / B source badges
- central grading
- attempt/session tracking
- existing plan/lesson summary stats through one stats module

Not yet migrated:

- vocabulary lexical generator
- vocabulary learning workflow
- 본문 activity workflow
- 수행평가 workflow
- new 오답 state flow
- flags
- smart question selection / balancing
- offline attempt outbox

Those systems should be migrated as sources/workflows around the central renderer, not as new renderers.
