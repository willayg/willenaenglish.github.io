# Willena Student Study App — Build Plan

## Core decision

The study app must NOT create a second exercise/rendering system.

The long-term architecture is one shared Willena activity bank plus one shared Willena Activity Engine used by all compatible apps.

```text
Willena Content Database
        |
        |-- canonical curriculum content
        |   words / lexical forms / sentences / patterns / dialogues / passages / audio
        |
        `-- authored activities/questions
                |
                v
        WILLENA ACTIVITY ENGINE
                |
      +---------+----------+----------------+
      |                    |                |
  Level tests          Study app      Future apps
  - adaptive           - practice      - quizzes
  - no hints           - hints/retry   - homework
  - ability score      - mastery       - teacher tests
  - assessment record  - study record  - games/tools
```

The apps should differ mainly in **selection rules, session rules, feedback, recording and reporting**. They should not each invent their own multiple-choice renderer, sentence builder, audio control, scorer, etc.

---

# One shared activity bank

The goal is a single content/activity ecosystem that can feed different applications.

An activity must be able to declare where it is eligible to appear. Do not duplicate the same question simply because two apps use it.

Suggested usage model:

```text
practice
level_test
teacher_quiz
homework
placement_test
```

An activity can support one or several usages.

Examples:

```text
Activity A
practice: yes
level_test: yes
teacher_quiz: yes
homework: yes

Activity B
practice: yes
level_test: no
teacher_quiz: yes
homework: yes
```

Assessment eligibility must be stricter than general publication. A useful practice activity is not automatically a good calibrated level-test item.

Eventually assessment metadata may include fields such as:

- assessment eligible
- calibrated internal level
- difficulty
- approved/reviewed status
- item quality/reliability metadata

Do not make `assessment=true/false` the only long-term distinction.

---

# Canonical content and authored activities

The shared bank has two sources.

## 1. Canonical curriculum content

Existing Content Database structures include:

```text
content_series
content_books
content_units
content_sections
source_content_occurrences
lexical_entries
lexical_forms
sentences
patterns
source_dialogues
passages
```

This content can generate predictable practice without manually storing every permutation.

Example lexical entry:

```text
apple
사과
```

can automatically support compatible activities such as:

- English -> Korean choice
- Korean -> English choice
- typed English recall
- spelling
- letter ordering
- audio -> word when audio exists

Do not store every mechanically generated variant as a separate permanent activity unless there is a real reason to do so.

## 2. Authored activities

Store activities/questions where authorship adds value, for example:

- carefully designed distractors
- grammar error questions
- reading comprehension
- listening comprehension
- inference
- speaking prompts
- writing prompts
- teacher-curated exercises
- assessment-quality questions

The existing generic `activities` table should be evaluated and refined for this role instead of making the study app depend exclusively on level-test `assessment_items`.

Existing `assessment_items` can continue to work during migration and should be normalized into the common runtime activity format.

---

# The current level-test engine is the starting point

`free-level-test/js/app-classic.js` is already shared by the two level-test apps and contains useful rendering/interaction behavior.

Do not throw it away and build a parallel study renderer.

Instead, gradually separate it into:

```text
A. generic activity behavior
B. level-test orchestration
```

Generic behavior includes:

- multiple-choice rendering
- answer selection
- sentence/token ordering
- listening controls
- reading presentation
- scoring/answer normalization
- question navigation primitives
- bilingual/common UI behavior where appropriate

Level-test-only behavior includes:

- starting ability calculation
- adaptive selection
- difficulty adjustment
- question type balancing/limits
- test length
- full-test sections/calibration
- final level calculation
- assessment completion
- level-test attempt recording
- level result display/mapping

The level tests should eventually become consumers of the shared activity engine rather than owners of the renderer implementation.

---

# Important migration rule

Do not perform a large rewrite of the working level tests.

Refactor incrementally.

For every extraction:

1. identify one generic behavior currently used by `app-classic.js`;
2. move/refactor it into a neutral shared module;
3. keep the level-test output/behavior the same;
4. verify both level-test apps still work;
5. let the study app consume that same shared module;
6. only then move to the next component.

Existing level tests must remain functional throughout this project.

---

# Target shared engine

Likely direction:

```text
shared/learning-engine/
    engine.js
    activity-schema.js
    answer-normalizer.js
    scoring.js

    stimuli/
        text.js
        image.js
        audio.js
        passage.js
        dialogue.js

    responses/
        multiple-choice.js
        typed-answer.js
        token-order.js
        gap-fill.js
        speaking.js
        writing.js

    feedback/
        feedback.js
```

Exact filenames are not sacred. The architectural separation is.

A particularly important design improvement is to separate **stimulus** from **response type** instead of treating every combination as a completely separate question type.

Example:

```js
{
  skill: "listening",
  stimulus: {
    type: "audio",
    text: "She wants to be a nurse."
  },
  response: {
    type: "multiple_choice",
    choices: ["...", "...", "...", "..."]
  },
  answer: "..."
}
```

The same stimulus could instead use:

```js
response: {
  type: "typed_answer"
}
```

This prevents the engine from growing dozens of monolithic types such as `listening_multiple_choice`, `listening_dictation`, `reading_multiple_choice`, etc.

---

# New engine capabilities required for study

The current level-test renderer is useful but insufficient for the full study app. Add capabilities to the shared engine rather than implementing them only inside `students/study/`.

## Typed answer

Required early.

Supports:

- vocabulary recall
- spelling
- Korean -> English
- short grammar responses
- dictation
- sentence completion

## Gap fill

Support at least:

```text
gap fill with choices
gap fill with typed response
```

Most of the surrounding renderer can be shared.

## Generic token ordering

Generalize the current sentence unscrambler into a reusable ordering response.

It should support tokens such as:

```text
words
letters
phrases
```

This can power:

- sentence unscramble
- spelling scramble
- phrase ordering

Do not build independent near-duplicate ordering systems.

## Flexible sentence production

A canonical sentence should be usable at different practice difficulties.

Example source sentence:

```text
She wants to be a nurse.
```

Possible modes:

- all English tokens supplied
- Korean prompt + English tokens
- partial-gap support
- full typed translation

These do not necessarily need four unrelated database question records.

## Feedback

Shared engine must support configurable feedback rules.

Level test example:

```text
feedback: none
retries: 0
hints: false
```

Study example:

```text
feedback: immediate
retries: allowed
hints: allowed
show explanation: allowed
```

Feedback/session policy belongs to the calling app, while the reusable feedback component belongs to the shared engine.

## Audio/listening

Do not make listening a single rigid question type.

Use reusable audio stimulus plus response modes such as:

- choose picture
- choose word
- choose meaning
- choose sentence
- type word
- dictation
- comprehension

Current hard-coded dialogue-TTS behavior should eventually become explicit reusable audio/dialogue helpers driven by database content.

## Speaking

Eventually support reusable speaking responses such as:

```text
speaking_repeat
speaking_response
```

Study can permit repeats/practice; assessment can allow one captured response. Recording/session policy remains app-specific.

## Reading

Use passage stimulus plus compatible response renderers rather than making reading presentation a DOM repair layered on top of a generic text prompt.

## Writing

Start with short constructed responses, then support longer responses/rubrics as content matures.

---

# Runtime activity contract

All source formats should eventually normalize into one runtime contract before reaching the renderer.

Conceptual shape:

```js
{
  id,
  sourceType,
  sourceId,

  bookId,
  unitId,
  sectionId,

  skill,
  usage,

  stimulus: {
    type,
    text,
    image,
    audio,
    passage,
    dialogue
  },

  response: {
    type,
    choices,
    tokens,
    settings
  },

  answer,
  acceptedAnswers,
  explanation,
  metadata
}
```

This is conceptual, not a final schema. Define the exact contract before implementing significant new renderers.

The engine should not care whether an activity came from:

- `assessment_items`
- `activities`
- a lexical entry generator
- a sentence generator
- a grammar pattern generator
- a teacher-authored quiz

The loader/adapter normalizes source data first.

---

# What each app owns

## Shared Activity Engine owns

- common activity contract
- common stimuli
- common response renderers
- answer normalization
- scoring primitives
- common audio/TTS helpers
- generic feedback UI
- interaction behavior

## Level test owns

- assessment bank filter
- assessment eligibility rules
- adaptive selector
- ability calculation
- test configuration/length
- question balancing
- no-hint/no-retry policy
- level-test recording
- final level/report

## Study app owns

- current book/unit navigation
- practice skill/mode selection
- practice eligibility rules
- hints/retries policy
- weak-item selection
- spaced review
- study recording
- mastery/progress
- student progress UI

## Future teacher quiz/homework apps own

- teacher-selected scope
- assignment/session rules
- due/completion rules
- quiz/homework recording/reporting

They should still use the shared activity contract and engine.

---

# Existing implementation problems not to copy

The current level-test system includes compatibility patches that were useful for stabilizing a working app but should not become the architecture of the new shared engine.

Avoid introducing new dependencies on:

- global `fetch` monkey-patching to redirect engine files;
- downloading `app-classic.js` and replacing exact source strings;
- post-render DOM repair with MutationObservers when the renderer itself can produce the correct markup;
- global overrides of browser APIs such as `speechSynthesis.speak`;
- hard-coded dialogue content inside renderer code;
- direct cross-project Supabase coordination in the browser.

Preserve behavior; replace the ownership pattern gradually.

See `AUDIT.md` for the current level-test audit.

---

# Content eligibility and publication

Keep these concepts separate:

```text
content exists
activity exists/generated
activity published
activity allowed for practice
activity allowed for teacher quiz/homework
activity assessment eligible
activity calibrated/approved for level test
```

This is important because one bank serves multiple use cases with different quality requirements.

---

# Two-database ownership

Keep the current conceptual split.

## Willena Content Database

Owns **what is taught and what can be asked**:

- series/books/units/sections
- canonical words/forms
- sentences
- grammar patterns
- dialogues
- passages
- audio references
- authored activities/questions
- usage/eligibility metadata
- assessment calibration metadata where appropriate

## Operational / Game Scores database

Owns **who did what and how they are progressing**:

- students
- classes/enrollments
- class book assignments
- current curriculum position
- study sessions
- study attempts
- mastery
- level-test attempts
- quiz/homework attempts
- teacher-facing progress data

Do not duplicate full curriculum content into the operational database.

Cross-project references should use stable Content Database UUIDs.

---

# Student curriculum resolution

Current operational data already provides:

```text
student
 -> active class enrollment
 -> class_book_assignments
 -> Content DB book_id
```

Add stable unit references when implementation reaches this stage:

```text
starting_unit_id
current_unit_id
```

Keep old text fields during migration for compatibility.

Default study startup should be:

```text
student login
 -> active class
 -> assigned book
 -> current unit
 -> available activities/content
 -> practice
```

Students may later browse previous units or teacher-approved extra content.

---

# Study progress model

Do not reuse the old word/game `progress_attempts` unchanged.

Likely operational tables:

```text
study_sessions
study_attempts
student_content_mastery
```

Each attempt should retain stable curriculum/activity references so teachers can report not just "grammar 70%" but which unit, pattern, sentence or word is weak.

Target reporting hierarchy:

```text
Class
 -> Student
   -> Book
     -> Unit
       -> Skill
         -> Content / activity / pattern / word
```

---

# API/session architecture

The browser should not coordinate the two Supabase projects itself.

Use the Willena API/gateway pattern with the existing persistent student login/session architecture.

Do not reintroduce temporary direct `workers.dev` authentication dependencies for study recording.

The existing `students/api-gateway.js` and persistent-cookie flow are relevant patterns.

Important existing constraint: do not edit `cloudflare-workers/supabase-auth/src/index.js` unless explicitly requested.

---

# V1 implementation scope

Prove the architecture with the strongest existing curriculum content first.

Order:

1. Vocabulary
2. Spelling
3. Grammar
4. Sentence building
5. Teacher progress report V1
6. Listening
7. Speaking
8. Reading
9. Writing

The first complete milestone is:

```text
logged-in student
 -> assigned book
 -> current unit
 -> shared bank/content
 -> shared activity engine
 -> vocabulary activity
 -> answer/scoring/feedback
 -> attempt recording
 -> mastery
 -> teacher report
```

Do not build eight superficial modes before this pipeline works end-to-end.

---

# Current content gaps

Vocabulary, grammar and sentence coverage are currently much stronger than reading/listening assets.

Before later modes are considered complete:

- populate passages;
- link passages to books/units/sections;
- add reading comprehension activities;
- establish audio storage/reference conventions;
- add word/sentence/dialogue audio;
- add listening comprehension activities;
- add speaking prompts/expected response metadata;
- add writing prompts/rubrics.

Create a content coverage/admin view showing per book/unit readiness for each skill.

---

# Updated build phases

## Phase 0 — Architecture contracts

- keep `AUDIT.md` as the current engine audit;
- define final runtime Activity contract;
- define source adapters (`assessment_items`, `activities`, generated curriculum content);
- define usage/eligibility model;
- define feedback/session policy interface;
- define progress/mastery rules;
- verify student -> class -> book -> unit resolution;
- verify API/session routing.

## Phase 1 — Shared engine foundation

Extract/refactor the safest generic pieces first:

- answer normalization
- scoring primitives
- activity contract/validation

Do not alter level-test behavior.

## Phase 2 — First shared renderer extraction

Move/refactor current multiple-choice behavior into shared engine and make the level tests continue using it.

Then make a minimal study harness use the same renderer.

This proves real renderer sharing before adding new exercise types.

## Phase 3 — Add missing shared study capabilities

Add to the shared engine, not just to study:

- typed answer
- generic token ordering
- gap fill
- configurable feedback

Existing sentence unscramble should migrate toward generic token ordering.

## Phase 4 — Study API/app shell

Create/use:

```text
students/study/index.html
students/study/study.css
students/study/study.js
```

Resolve logged-in student, assigned book and unit through the server-side API/gateway.

## Phase 5 — Vocabulary vertical slice

Use canonical lexical content plus authored activities where appropriate.

Support:

- multiple choice
- typed recall
- basic spelling where suitable
- immediate feedback
- attempt recording
- mastery

## Phase 6 — Teacher report V1

Build reporting from real recorded study attempts before broadening the system too far.

## Phase 7 — Spelling / grammar / sentence building

Expand shared engine usage and content generators.

## Phase 8+ — Listening / speaking / reading / writing

Add content assets and shared stimuli/response capabilities systematically.

## Later — More consumers

Teacher quizzes, homework, games and other apps should use the same activity bank and engine rather than creating independent question systems.

---

# Non-negotiable design rules

1. **One activity/question ecosystem.** Do not create a separate study question bank if the same content can belong to the shared bank.
2. **One shared renderer/interaction engine.** Do not build parallel multiple-choice, sentence-order, audio, scoring, etc. implementations per app.
3. **Apps own orchestration, not basic exercise mechanics.**
4. **Practice eligibility and assessment eligibility are different.**
5. **Generated practice and authored activities may coexist.**
6. **Do not store every mechanical activity permutation unnecessarily.**
7. **Normalize all source data before it reaches renderers.**
8. **Separate stimulus from response type where practical.**
9. **Refactor the working level tests incrementally; do not rewrite them wholesale.**
10. **Existing level-test behavior must remain stable while shared pieces are extracted.**
11. **New exercise types that are generally useful belong in the shared engine, even if first requested by the study app.**
12. **Content DB owns curriculum/activity definitions; operational DB owns learner history.**
13. **Use the existing persistent same-domain/gateway auth model for student-facing recording.**
14. **Do not edit `cloudflare-workers/supabase-auth/src/index.js` unless explicitly authorized.**

---

# Immediate next task

Before building the study UI, define the exact shared runtime Activity contract and map the current `assessment_items`/`app-classic.js` question object into it.

Then identify the smallest safe piece of `app-classic.js` to extract first. The preferred first extraction is answer normalization/scoring, followed by multiple-choice rendering.

The study app should begin consuming the same engine immediately after that first renderer extraction, so sharing is proven in practice rather than merely planned.
