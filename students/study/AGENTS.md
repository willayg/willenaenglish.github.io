# AGENTS.md — Willena Study / Shared Activity System

## Read this first

This directory is part of a larger Willena learning-platform refactor.

Before changing code here, read:

1. `BUILD_PLAN.md`
2. `AUDIT.md`
3. `PROGRESS_ARCHITECTURE.md` — **required before touching study recording, mastery, scoring, student progress, teacher reports, parent reports, or adaptive review**

These documents define the intended architecture and the current level-test constraints.

`PROGRESS_ARCHITECTURE.md` is a hard architectural constraint. In particular, do not create separate student/teacher/parent progress calculations, do not discard immutable raw attempts, and never record admin preview activity into real student progress.

---

# Primary architectural rule

**Do not build an independent study exercise engine.**

The goal is:

```text
ONE shared content/activity bank
+
ONE shared Willena Activity Engine
+
multiple apps with different orchestration rules
```

The same underlying activities/renderers should be reusable by:

- both level-test apps;
- the student study app;
- future teacher quizzes;
- homework;
- future placement/assessment tools;
- other compatible Willena learning apps.

If an exercise type is generally useful, implement it in the shared engine even if the study app is the first consumer.

---

# Existing level-test code is important

`free-level-test/js/app-classic.js` is already shared by two level-test apps.

Treat it as the starting point for the shared engine, not as disposable legacy code.

Do not create duplicate implementations of behavior that already exists there unless the duplicate is a temporary migration step with an explicit removal plan.

The desired refactor is to separate:

```text
shared activity mechanics
from
level-test orchestration
```

Shared mechanics include rendering, input, ordering, audio primitives, normalization and scoring.

Level-test orchestration includes adaptive selection, ability calculations, test length, assessment balancing and final level calculation.

---

# Do not rewrite the level tests wholesale

The level tests are working production/staging systems and must remain stable.

Use incremental extraction:

1. identify one generic behavior;
2. extract/refactor it into a neutral shared module;
3. keep existing level-test behavior identical;
4. verify both level-test consumers still work;
5. use the same shared module in the study app;
6. continue to the next component.

Do not introduce a large-bang rewrite merely to make the architecture cleaner.

---

# One bank, multiple usages

Activities/questions should carry usage/eligibility metadata rather than being copied into separate banks for each app.

The eventual usage model should support concepts such as:

```text
practice
level_test
teacher_quiz
homework
placement_test
```

An activity may support multiple usages.

Do not assume that `published` means `level-test eligible`.

Keep these concepts distinct:

```text
content exists
activity exists/generated
published
practice eligible
quiz/homework eligible
assessment eligible
level-test calibrated/approved
```

Practice quality requirements and assessment quality requirements are not identical.

---

# Canonical content vs authored activities

Do not manually store every possible drill as a separate database row.

Canonical curriculum content can generate predictable exercises.

Examples:

- lexical entry -> vocabulary choice / typed recall / spelling;
- sentence -> token order / translation / gap fill;
- pattern + linked sentences -> grammar practice;
- audio-backed content -> listening/dictation.

Use authored activities when authorship adds value, such as:

- careful distractors;
- grammar errors;
- reading/listening comprehension;
- inference;
- speaking/writing prompts;
- assessment-quality questions;
- teacher-curated activities.

---

# Shared runtime activity contract

All activity sources should eventually normalize into one runtime shape before entering the engine.

The final contract is still to be defined, but it should conceptually separate:

- source/curriculum identity;
- skill;
- usage/eligibility;
- stimulus;
- response type;
- answer/scoring data;
- explanation/feedback data;
- metadata.

Prefer separating **stimulus** from **response type**.

For example, audio is a stimulus. Multiple choice or typed dictation are response types.

Avoid an explosion of monolithic types such as:

```text
listening_multiple_choice
listening_typed
reading_multiple_choice
reading_typed
```

when composition can represent them cleanly.

---

# Shared engine capabilities

Existing capabilities worth extracting/reusing:

- multiple choice;
- sentence/token ordering;
- answer normalization/scoring;
- reading presentation concepts;
- listening/audio controls;
- bilingual/common UI behavior.

New capabilities needed by the study app should normally be added to the shared engine:

- typed answer;
- gap fill (choice and typed);
- generic token ordering for words/letters/phrases;
- configurable feedback;
- reusable audio stimulus;
- speaking response/recording UI;
- passage stimulus;
- writing response.

Do not create study-only versions of these if they could reasonably serve other apps.

---

# App ownership boundaries

## Shared engine owns

- runtime activity contract;
- stimuli;
- response renderers;
- answer normalization;
- scoring primitives;
- common TTS/audio helpers;
- generic feedback components;
- core interaction mechanics.

## Level test owns

- assessment filtering/eligibility;
- adaptive selector;
- ability calculations;
- question balancing;
- test length/configuration;
- no-hint/no-retry policy;
- level-test recording;
- result/level calculation.

## Study app owns

- assigned book/current unit;
- skill/mode selection;
- practice eligibility;
- hints/retries policy;
- mastery;
- weak-item/spaced-review selection;
- study recording;
- student progress views.

Do not move app-specific orchestration into the shared renderer layer.

---

# Known implementation patterns to avoid extending

The current level-test stack contains compatibility patches that should not become the design pattern for new shared code.

Do not add new architecture based on:

- global `fetch` monkey-patching;
- fetching JavaScript source and doing exact string replacement;
- MutationObserver-based DOM repairs when a renderer can emit correct markup directly;
- global overrides of browser APIs such as `speechSynthesis.speak`;
- hard-coded activity/dialogue content inside renderer code;
- direct browser coordination of both Supabase projects.

Existing patches may need to remain temporarily. Preserve behavior while replacing ownership incrementally.

---

# Database ownership

There are two conceptual database roles.

## Willena Content Database

Owns what is taught / what can be asked:

- books, units, sections;
- lexical content;
- sentences;
- patterns;
- dialogues;
- passages;
- audio references;
- activities/questions;
- usage/eligibility/calibration metadata.

## Operational / Game Scores database

Owns who did what:

- students/classes/enrollments;
- book assignments/current curriculum position;
- study sessions/attempts/mastery;
- assessment attempts/results;
- future quiz/homework attempts.

Do not duplicate whole curriculum records into the operational DB.

Use stable Content Database UUIDs as cross-system references.

---

# Authentication/API constraints

Student-facing study recording should use the existing persistent same-domain/API-gateway session architecture.

Do not reintroduce direct temporary-token dependencies to separate `workers.dev` domains for study recording.

Relevant existing patterns include:

- `students/api-gateway.js`
- student persistent cookie/session flow

**Do not edit `cloudflare-workers/supabase-auth/src/index.js` unless the user explicitly authorizes it.**

---

# Current V1 priority

Do not build all skills at once.

Prove this complete chain first:

```text
logged-in student
-> active class
-> assigned book
-> current unit
-> shared content/activity source
-> shared engine
-> vocabulary activity
-> score/feedback
-> recorded attempt
-> mastery
-> teacher report
```

Then expand to:

1. spelling;
2. grammar;
3. sentence building;
4. listening;
5. speaking;
6. reading;
7. writing.

---

# First engineering task

The next architectural work should be:

1. define the exact normalized runtime Activity contract;
2. map current `assessment_items` / `app-classic.js` question objects into it;
3. define usage/eligibility representation;
4. extract answer normalization/scoring safely;
5. extract or refactor multiple-choice rendering;
6. prove both level tests still work;
7. make the study harness consume that exact same renderer.

Do not start by building a separate full study UI or parallel renderer stack.

---

# When uncertain

Favor solutions that reduce duplication across apps while preserving existing behavior.

Before introducing a new renderer, scorer, activity schema or content bank, ask:

> Can this become part of the shared Willena Activity Engine or shared activity bank instead?

If yes, it should normally be shared.
