# STOP — STUDENT APP SINGLE-SOURCE RULES

Read the repository-root `AGENTS.md` before changing student apps.

## SHARED STUDENT PLATFORM LAYER

`students/shared/` is the cross-app student platform layer.

It is NOT specific to 내신/Test Prep. It exists for responsibilities that must behave the same across multiple student-facing apps, and it may expand over time as more truly shared student concerns are identified.

Before adding app-local logic for a cross-app concern, check `students/shared/` first.

### ALL STUDENT STATS GO THROUGH ONE OWNER

The canonical browser-side owner for student statistics is:

`students/shared/student-stats.js`

All student-facing apps must use that shared module for stats instead of calculating their own competing version of the truth.

This includes, where applicable:

- Test Prep / 내신
- student dashboard
- 오답 / review
- Daily Study
- progress screens
- lesson completion
- accuracy
- attempts/completion summaries
- future student apps that need the same statistics

The backend/database remains the authoritative source of the numbers. `student-stats.js` is the one canonical frontend gateway that calls, caches, normalizes, and exposes those numbers to student apps.

Do NOT create a second app-specific stats engine, denominator calculation, accuracy calculation, completion calculation, or review-count calculation.

If a new student stats domain is needed, extend the shared stats service/API in `students/shared/` rather than creating `dashboard-stats.js`, `daily-study-stats.js`, `review-stats.js`, another `stats-client.js`, or equivalent duplicated logic inside an app.

Compatibility shims are allowed temporarily while migrating an older app, but they must delegate to `students/shared/student-stats.js` and must not become a second implementation.

If a stats rule is wrong, fix the shared owner/backend once so every app receives the same result.

Read `students/shared/AGENTS.md` before changing anything inside `students/shared/`.

---

# TEST PREP V2 SINGLE-SOURCE RULES

For these paths:

- `students/test-prep-v2/`
- `students/question-render-lab/`

there is exactly ONE question renderer implementation:

`students/test-prep-v2/question-renderer.js`

`students/question-render-lab/` MUST import that exact module. It must never contain, copy, fork, inline, or reimplement question rendering code.

If rendering is wrong, fix the canonical renderer. If normalization is wrong, fix the canonical model/source adapter. Do not add a patch renderer.

Do not create another renderer file for vocab, 서술형, 본문, 수행평가, 오답, grammar, communication, or reading.

There is also exactly ONE browser/history navigation owner for Test Prep v2:

`students/test-prep-v2/navigation.js`

Only that file may call `history.pushState`, `history.replaceState`, or listen to `popstate`.

Do not add workflow-specific Back handlers, history stacks, `navigation-fix.js`, `back-fix.js`, or another `popstate` listener. UI Back controls must request the canonical navigator's `back()` behavior. If device/browser Back is wrong, fix `navigation.js` or the single route renderer in `app.js`.
