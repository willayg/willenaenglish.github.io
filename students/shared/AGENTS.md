# STUDENTS/SHARED — CROSS-APP PLATFORM RULES

This folder is for student-facing behavior that must be shared across multiple apps.

It is deliberately broader than Test Prep / 내신. Do not encode assumptions here that only make sense for one student app unless they are isolated behind a clearly named domain API.

## STUDENT STATS: ONE CANONICAL FRONTEND OWNER

The canonical browser-side student statistics client is:

`students/shared/student-stats.js`

All student apps that need shared statistics must call this module rather than calculating their own version of totals, completion, accuracy, progress, attempts, or review counts.

The backend/database owns the actual statistical truth. This file owns the common frontend access contract: authentication/token handling, requests, caching, normalization, and stable helper functions exposed to apps.

### NEVER DUPLICATE STATS LOGIC IN AN APP

Do NOT add app-local implementations such as:

- independent question/lesson denominators
- independent completion intersections
- independent accuracy windows/calculations
- independent unresolved/wrong/review counts
- independent cached copies with different semantics
- another canonical `stats-client.js`

If Test Prep, Dashboard, Daily Study, 오답, or another student app needs a statistic that does not exist yet, add it to the shared stats contract/backend and expose it here.

A temporary compatibility shim may exist inside an older app, but it must delegate to `students/shared/student-stats.js`. It must not contain a second implementation.

## STUDENT REVIEW / 오답: ONE CANONICAL QUEUE OWNER

The canonical browser-side review queue client is:

`students/shared/student-review.js`

It is the only student-app client that should request and normalize canonical wrong-answer/review queues.

The backend owns review truth: current exam scope, canonical identity, due-now vs later timing, cleared state, and which canonical mastery/question is due. Apps must not reconstruct those rules from local attempts or the legacy `test_prep_question_state` table.

Do NOT create app-local review queue builders, due-date calculations, legacy-ID dedupers, or competing 오답 state engines. Test Prep V2 may render the queue through its own route/controller and canonical question renderer, but it must receive the queue from `students/shared/student-review.js`.

If another student app later needs 오답/review, extend the shared review contract rather than copying Test Prep V2's flow.

## DESIGN FOR MORE THAN 내신

This folder may grow into a broader student platform layer.

Good candidates are concerns that genuinely need one implementation across multiple student apps. Examples may include shared data clients, common progress/state contracts, or other cross-app services.

Do not move code here merely because it is reusable once. Move it here when central ownership prevents drift between student apps.

Before creating a new shared module:

1. Identify the responsibility it owns.
2. Confirm at least two student apps need the same behavior or that the behavior is intentionally platform-wide.
3. Give it one clear canonical owner.
4. Remove or delegate competing implementations rather than keeping them "in sync".

## CURRENT CONTRACT

`student-stats.js` provides the canonical frontend gateway for student statistics.

`student-review.js` provides the canonical frontend gateway for review queues and review timing/state.

Test Prep V2 consumes these shared owners while keeping rendering and route control in its existing canonical V2 modules.

If a statistical or review-state rule changes, fix the shared backend/client once. Do not patch each consuming app separately.
