# STOP — TEST PREP V2 SINGLE-SOURCE RULES

Read the repository-root `AGENTS.md` before changing Test Prep v2 or the renderer lab.

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

## TEST PREP V2 STATS

Do not make browser code read `test_prep_attempts` directly for Test Prep cards or graphs.

Student attempt history for Test Prep v2 comes from the existing authenticated Test Prep student backend (`test-prep-student-rev47e`, currently through its `me` response). `stats-client.js` may combine that backend history with the public curriculum/content pool to calculate current coverage and accuracy, but it must not create a second student-history access path.

Do not add a new stats endpoint, RLS workaround, direct raw-attempt query, Netlify function, or stats patch file to fix a card. Fix the existing Test Prep student backend or `stats-client.js`, whichever owns the broken responsibility.
