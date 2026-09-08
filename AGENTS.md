# Willena architecture rules

## Never use Netlify

DO NOT USE NETLIFY FOR WILLENA.

- Do not create files under `netlify/functions/`.
- Do not propose or implement Netlify Functions.
- Do not route Willena APIs through Netlify.
- Do not assume a Netlify deployment exists.
- Do not use Netlify as a fallback or temporary backend.

## Approved architecture

Willena uses:

- Cloudflare Pages for hosted web apps.
- Cloudflare Workers / the existing Cloudflare API gateway for server-side API logic when needed.
- Supabase for authentication, database, storage, RLS, and direct data operations where appropriate.

For new backend work, first determine whether it belongs in an existing Cloudflare Worker/API route or can be done safely through Supabase with RLS. Do not introduce another backend platform.

## Existing legacy paths

Some existing frontend code may still contain historical `/.netlify/functions/...`-shaped paths because the Cloudflare gateway maps legacy route names. Do not interpret those strings as permission to create or depend on Netlify infrastructure. Prefer migrating new work to explicit Cloudflare/Supabase architecture when practical.

---

# STUDENT SHARED PLATFORM

For any work under `students/`, read `students/AGENTS.md`.

`students/shared/` is the cross-app student platform layer, not a Test Prep/내신-only folder.

The canonical browser-side owner for student statistics is:

`students/shared/student-stats.js`

All student apps must use that shared stats owner instead of creating app-specific totals, completion, accuracy, progress, or review calculations. The backend/database owns the actual numerical truth; the shared module is the single frontend gateway for those numbers.

If a new student stats domain is needed, extend the shared stats contract/backend and expose it through `students/shared/`. Do not create competing stats engines in individual apps.

Read `students/shared/AGENTS.md` before changing shared student platform code.

---

# READ THIS BEFORE TOUCHING TEST PREP V2 OR THE RENDER LAB

If you duplicate the question renderer, you have broken the architecture.

This rule is non-negotiable.

## SINGLE SOURCE OF TRUTH

The only question rendering implementation for Test Prep v2 is:

`students/test-prep-v2/question-renderer.js`

The canonical question adapter/model is:

`students/test-prep-v2/question-model.js`

The renderer lab at:

`students/question-render-lab/`

MUST import those exact files. The lab is a test harness, not a second renderer.

## ABSOLUTELY FORBIDDEN

Do NOT:

- copy `question-renderer.js` into the lab
- paste renderer functions into `question-render-lab/index.html`
- create a lab-only `renderChoice`, `renderWrite`, `renderOrder`, etc.
- create a vocab renderer, grammar renderer, reading renderer, seosul renderer, review renderer, or performance renderer
- patch rendered question DOM after the canonical renderer runs
- add `*-render-fix.js`, `*-layout-fix.js`, MutationObserver renderer patches, or equivalent workaround files
- fork the renderer because one screen needs a slightly different layout

If a question renders incorrectly, fix `students/test-prep-v2/question-renderer.js`.

If source data cannot be converted into the canonical question shape, fix the source adapter/model. Do NOT fix the renderer by teaching it random database schemas.

## THE LAB MUST MATCH PRODUCTION RENDERING

The purpose of `students/question-render-lab/` is to reproduce rendering problems safely.

Therefore a question shown in the lab and the same normalized question shown in Test Prep v2 MUST pass through the exact same renderer module. "Similar", "copied from", and "kept in sync" are not acceptable.

Different lab navigation, filters, fixture selection, and diagnostic styling are allowed. A different rendering implementation is not.

## SHARED PREPROCESSING

When preprocessing changes what the renderer receives, share that logic too.

Example: textbook passage sentence splitting must use the shared Test Prep v2 passage utility. Do not create a second sentence splitter in the lab. This specifically protects abbreviations such as `Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Prof.`, `St.`, `a.m.`, `p.m.`, `e.g.`, `i.e.`, `U.S.`, and `U.K.` from drifting into different behavior.

---

# TEST PREP V2 NAVIGATION IS ALSO SINGLE-SOURCE

The only browser/history navigation owner for Test Prep v2 is:

`students/test-prep-v2/navigation.js`

This rule is non-negotiable too.

Only `navigation.js` may:

- call `history.pushState()`
- call `history.replaceState()`
- listen to `popstate`
- decide how Test Prep history routes are encoded/restored

`app.js`, vocabulary, 수행평가, 오답, Ask Willi, modals, and future workflows may request navigation or provide leave/cleanup hooks. They may NOT create their own browser-history implementation.

UI back buttons must go through the canonical navigator (`back()` / browser history). Do not manually call an older screen renderer as a substitute for Back.

A `popstate` render must NEVER push a new history entry. If Back causes a screen to reopen, fix the route/render ownership or stale async work; do not add a Back-button patch script.

Do NOT add:

- another `popstate` listener in Test Prep v2
- `navigation-fix.js`, `back-fix.js`, `history-patch.js`, or equivalent workaround files
- direct `pushState` / `replaceState` calls outside `navigation.js`
- workflow-specific history stacks

If navigation is wrong, fix `students/test-prep-v2/navigation.js` or the single route renderer in `app.js`.

## BEFORE ADDING A FILE

Ask:

1. Does an existing module already own this responsibility?
2. Can I subtract/replace old code instead of adding another layer?
3. Would this create a second implementation of rendering, navigation, grading, tracking, stats, source loading, or review state?

If yes, stop and use the existing owner.

## TEST PREP V2 MODULE OWNERSHIP

- `question-model.js` — canonical question shape / adaptation
- `question-renderer.js` — ALL question answer UI / DOM
- `question-grader.js` — grading only
- `navigation.js` — ALL browser/device history ownership and route transitions
- `app.js` — the single route-to-screen renderer/controller; it requests navigation but does not own browser history
- content/source modules — question generation/loading only
- `tracking-client.js` — attempts/sessions only
- `students/shared/student-stats.js` — canonical frontend gateway for ALL student stats; Test Prep must consume it rather than owning stats logic
- review workflow/UI — may consume canonical review stats/state but must not invent a second statistical truth

A module may call another owner. It may not reimplement that owner's job.

## RULE FOR FUTURE AGENTS

If a requested fix seems easiest by adding one more patch file, that is a warning sign. Investigate the owning module and fix the root cause there.
