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

## BEFORE ADDING A FILE

Ask:

1. Does an existing module already own this responsibility?
2. Can I subtract/replace old code instead of adding another layer?
3. Would this create a second implementation of rendering, grading, tracking, stats, source loading, or review state?

If yes, stop and use the existing owner.

## TEST PREP V2 MODULE OWNERSHIP

- `question-model.js` — canonical question shape / adaptation
- `question-renderer.js` — ALL question answer UI / DOM
- `question-grader.js` — grading only
- content/source modules — question generation/loading only
- `tracking-client.js` — attempts/sessions only
- stats module/service — Test Prep metrics only
- review service — wrong-answer state/queue only

A module may call another owner. It may not reimplement that owner's job.

## RULE FOR FUTURE AGENTS

If a requested fix seems easiest by adding one more patch file, that is a warning sign. Investigate the owning module and fix the root cause there.
