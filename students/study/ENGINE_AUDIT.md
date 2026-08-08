# Willena Study App — Level-Test Engine Audit

## Purpose

Audit the existing logged-in student level-test implementation and decide what should be shared with the new study app, what must remain assessment-specific, and what should be rebuilt cleanly for study.

This is an architecture audit only. It does **not** move or modify the current level-test engine.

---

# Current student level-test structure

Entry point:

- `students/level-test/index.html`

Student-specific wrapper:

- `students/level-test/level-test.js`
- `students/level-test/recorder-begin-guard.js`

The student page then loads most of its actual test implementation from `free-level-test/`, including:

- `free-level-test/js/assessment-loader-classic.js`
- `free-level-test/js/question-type-limits.js`
- `free-level-test/js/dialogue-tts.js`
- `free-level-test/js/adaptive-calibration-loader.js`
- `free-level-test/js/level-result-consistency.js`
- `free-level-test/js/canonical-answer-scoring.js`
- `free-level-test/js/test-recording.js`
- `free-level-test/js/scramble-token-letter-fix.js`
- `free-level-test/js/loading-transitions.js`
- `free-level-test/js/reading-layout.js`
- `free-level-test/js/listening-compact.js`
- `free-level-test/js/question-review-flag.js`
- `free-level-test/js/question-feedback-header.js`

The base test engine is `free-level-test/js/app-classic.js`.

The student wrapper currently intercepts requests for a local `students/level-test/js/app-classic.js` and redirects them to the free-level-test engine. This means the student test is already sharing an engine, but through a patching/wrapper architecture rather than a neutral reusable library.

---

# Main finding

Do **not** copy the current level-test folder as the study engine.

The level test contains useful reusable behavior, but the current implementation has grown through a series of wrappers, DOM observers, fetch interception and source-code patches around `app-classic.js`. That is appropriate to preserve the working assessment, but it would create unnecessary coupling if the study app were built the same way.

Instead:

1. leave the current level test working;
2. extract reusable behavior into a new neutral `shared/learning-engine/` layer;
3. migrate the level test to those shared pieces gradually, only after the shared versions are proven in study;
4. build study-specific orchestration separately.

---

# Component classification

## A. SHARE — extract/rebuild as neutral learning-engine components

### 1. Answer normalization and canonical scoring

Current file:

- `free-level-test/js/canonical-answer-scoring.js`

Reusable parts:

- Unicode normalization;
- whitespace cleanup;
- case-insensitive sentence comparison;
- punctuation-tolerant sentence comparison;
- array/token comparison;
- generic `isCorrect(type, selected, correct)` concept.

Do **not** share the file unchanged. Its second half intercepts `fetch()` and repairs level-test response payloads for the prospective level-test API. That behavior is assessment-specific.

Recommended new module:

- `shared/learning-engine/scoring/answer-normalizer.js`
- `shared/learning-engine/scoring/scoring.js`

Study will need additional scoring policies later, including:

- spelling normalization;
- contractions;
- accepted-answer lists;
- partial credit;
- speaking similarity;
- writing/manual-review states.

### 2. Sentence-building / token-order renderer

Current implementation exists mainly inside:

- `free-level-test/js/app-classic.js`

Useful pieces:

- shuffled token bank;
- chosen-token area;
- undo by tapping a chosen token;
- completion validation;
- canonical sentence scoring.

This should become a real renderer rather than remain embedded in the assessment app.

Recommended module:

- `shared/learning-engine/renderers/sentence-order.js`

This renderer will be useful for:

- sentence building;
- grammar practice;
- Korean-to-English reconstruction;
- dialogue reconstruction.

### 3. Multiple-choice renderer

Current implementation:

- embedded in `app-classic.js`

Reusable behavior:

- shuffled choices;
- selection state;
- next/submit enablement;
- answer feedback hook.

Recommended module:

- `shared/learning-engine/renderers/multiple-choice.js`

It should accept a neutral activity object rather than a level-test question row.

### 4. Listening controls / presentation

Current files:

- listening code inside `app-classic.js`
- `free-level-test/js/listening-compact.js`

Reusable ideas:

- play button;
- plays remaining;
- SpeechSynthesis fallback;
- first-use listening help;
- compact headphone-button UI.

Recommended modules:

- `shared/learning-engine/audio/player.js`
- `shared/learning-engine/renderers/listening.js`

Study requirements differ from testing: practice may allow unlimited playback or configurable playback limits, slower playback, repeat mode and model-answer replay. Therefore the current fixed “maximum two plays” test behavior should not be hard-coded into the shared renderer.

### 5. Reading layout

Current file:

- `free-level-test/js/reading-layout.js`

The visual idea is reusable, but the implementation currently parses a single prompt by splitting on its last newline and then rewrites the DOM after rendering.

Recommended module:

- `shared/learning-engine/renderers/reading.js`

The shared activity contract should provide explicit fields such as:

- `passage`;
- `prompt`;
- `choices`;
- `media`.

Do not make the study renderer infer passage/question structure from newline formatting.

### 6. TTS / dialogue voice utilities

Current file:

- `free-level-test/js/dialogue-tts.js`

Reusable concept:

- English voice selection;
- alternating speaker voices;
- sequential utterances;
- dialogue playback.

Do not share its hard-coded map of level-test transcripts. In study, dialogue turns should come from the content database (`source_dialogues` / `source_dialogue_turns`).

Recommended modules:

- `shared/learning-engine/audio/tts.js`
- `shared/learning-engine/audio/dialogue-player.js`

### 7. Generic screen/loading transitions

Current file:

- `free-level-test/js/loading-transitions.js`

The current implementation is specifically triggered by test-length selection and the final test question, so the file itself is not generic. The visual loading overlay/pattern can be reused.

Recommended module:

- `shared/learning-engine/ui/loading-overlay.js`

### 8. Student authentication/session helper

Current student-specific behavior:

- `students/level-test/level-test.js`

Useful behavior:

- `whoami` check;
- one refresh-and-retry path;
- profile lookup;
- persistent session refresh while a long activity is open;
- `credentials: include` through the Willena API gateway.

This is not really a learning-engine feature; it should be a shared **student platform** component because dashboard, study, level test and future student apps all need it.

Recommended location:

- `students/shared/student-session.js`

This should eventually eliminate each student app implementing its own auth/session refresh loop.

---

# B. KEEP LEVEL-TEST ONLY

## 1. Assessment bank loader

Current file:

- `free-level-test/js/assessment-loader-classic.js`

Why it stays assessment-only:

- hard-coded to the Content Database Supabase project;
- hard-coded to `assessment_items`;
- maps assessment-specific fields (`level_id`, `difficulty_rating`, `assessment_item_options`);
- requires exactly four unique choices for normal items;
- assumes authored assessment-bank semantics.

The study app needs a completely different loader based on:

- assigned book;
- unit;
- source occurrences;
- canonical words/sentences/patterns;
- authored `activities` where applicable;
- student mastery.

## 2. Question type limits

Current file:

- `free-level-test/js/question-type-limits.js`

Assessment-only behavior:

- permits only two grammar-error questions;
- rewrites `grammar_application` to `grammar`;
- exists to balance a finite diagnostic test.

Study should not use these limits.

## 3. Adaptive ability/calibration

Current file:

- `free-level-test/js/adaptive-calibration-loader.js`

Assessment-only behavior:

- calculates starting ability from grade/years studied;
- dynamically chooses question difficulty;
- adjusts ability after answers;
- controls diagnostic sections;
- calculates final test level.

The study app may later have adaptive **practice selection**, but that is a different algorithm based on mastery, spaced repetition, assigned curriculum and weak areas. Do not reuse diagnostic ability code for it.

## 4. Level result consistency

Current file:

- `free-level-test/js/level-result-consistency.js`

Purely assessment-specific. It translates internal diagnostic level numbers to public level display and keeps the rendered report consistent.

No role in study.

## 5. Level-test recorder

Current file:

- `free-level-test/js/test-recording.js`

Useful design ideas:

- session + individual response recording;
- offline state persistence;
- reconnect synchronization;
- retry after authentication refresh;
- stale-attempt recovery;
- immutable prompt/answer snapshots.

But the implementation itself must remain level-test-only because it is coupled to:

- `student_level_test` endpoint;
- `student_assessment_attempts` semantics;
- recommended/final level;
- expected total question count;
- assessment item IDs;
- prospective test mode.

Study should build a new recorder following the same reliability principles.

Recommended study component:

- `students/study/services/study-recorder.js`

It should write `study_sessions` and `study_attempts` and update mastery.

## 6. Recorder begin guard

Current file:

- `students/level-test/recorder-begin-guard.js`

This is a race-condition patch around the level-test recorder. Do not carry it into study. The study recorder should be designed with idempotent session start behavior from the beginning.

## 7. Question flag/like tools and header relocation

Current files:

- `free-level-test/js/question-review-flag.js`
- `free-level-test/js/question-feedback-header.js`

These are staging/content-QA tools for the assessment bank. They are useful operationally but should not be part of the student study engine.

A future teacher/content-studio QA tool may reuse the concept.

---

# C. BUILD NEW FOR STUDY

## 1. Study activity contract

Every renderer should receive one neutral object.

Proposed initial shape:

```js
{
  id: "stable-activity-id",
  sourceType: "generated" | "authored",
  activityType: "vocab_choice",
  skill: "vocabulary",

  bookId: "uuid",
  unitId: "uuid",
  sectionId: "uuid|null",

  contentType: "lexical_entry",
  contentId: "uuid",

  prompt: "사과",
  context: null,
  choices: ["apple", "orange", "pear", "banana"],
  correctAnswer: "apple",
  acceptedAnswers: ["apple"],

  media: {
    audio: null,
    image: null,
    ttsText: "apple"
  },

  settings: {
    shuffleChoices: true,
    allowRetry: true,
    maxPlays: null
  }
}
```

The renderers should know nothing about Supabase table names.

## 2. Study content loader

Responsibilities:

- load student's active class/book assignment;
- resolve current book and unit;
- fetch unit source occurrences from Content Database;
- fetch linked lexical entries / sentences / patterns;
- fetch authored `activities` when available;
- generate eligible practice activities from canonical content;
- return neutral `StudyActivity` objects.

Recommended:

- `students/study/services/study-api.js`
- server/API endpoint does cross-database resolution where possible.

## 3. Activity generators

V1:

- `vocab-choice.js`
- `vocab-recall.js`
- `spelling.js`
- `grammar-choice.js`
- `sentence-order.js` generator (renderer remains shared)

Generators should use canonical DB content and produce neutral activity objects.

## 4. Study session controller

Responsibilities:

- select activities;
- maintain session state;
- pass activities to renderers;
- handle retry/hints;
- request next activity;
- end/resume sessions;
- emit progress events.

Recommended:

- `students/study/study-session.js`

## 5. Study recorder

Responsibilities:

- idempotent session creation;
- record individual attempts;
- persist unsent attempts locally;
- retry on reconnect;
- recover from stale login/session state;
- never lose a student's completed answer merely because the network failed;
- update/trigger mastery calculations.

## 6. Mastery/adaptive practice selector

Do not use the level-test ability algorithm.

Study selection should eventually consider:

- assigned current unit;
- whether content is new or previously seen;
- success rate;
- recency;
- number of attempts;
- response time;
- teacher assignments/priorities;
- spaced repetition due date;
- skill balance.

V1 can be simpler: mix unseen items with recently incorrect items.

## 7. Book/unit navigation

New study UI:

- My Book;
- Current Unit;
- Previous Units;
- skill picker;
- continue practice;
- needs-practice section.

Default book should come from class assignment rather than asking the student to browse all books.

## 8. Teacher reporting

Build after vocabulary recording works end-to-end.

Initial report dimensions:

- student;
- class;
- book;
- unit;
- skill;
- canonical content item;
- attempts;
- correct rate;
- mastery;
- last practiced.

---

# Existing files: final classification

| Existing component | Decision | Notes |
|---|---|---|
| `students/level-test/index.html` | KEEP | Assessment shell only |
| `students/level-test/level-test.js` | SPLIT IDEAS | Keep test wrapper; extract generic student-session behavior separately |
| `students/level-test/recorder-begin-guard.js` | KEEP | Race patch; do not reuse |
| `free-level-test/js/app-classic.js` | DO NOT SHARE WHOLE | Contains UI plus adaptive assessment state; extract renderer concepts |
| `assessment-loader-classic.js` | KEEP | Assessment DB adapter |
| `question-type-limits.js` | KEEP | Diagnostic balancing |
| `adaptive-calibration-loader.js` | KEEP | Diagnostic algorithm and source patching |
| `level-result-consistency.js` | KEEP | Diagnostic results only |
| `canonical-answer-scoring.js` | SPLIT | Core normalization/scoring is reusable; fetch repair is not |
| `test-recording.js` | KEEP / COPY DESIGN ONLY | Reliability concepts are valuable; endpoint/data model is assessment-specific |
| `dialogue-tts.js` | REBUILD SHARED | Generic TTS/dialogue player; remove hard-coded test transcript map |
| `listening-compact.js` | REBUILD SHARED | UI pattern reusable; playback policy must be configurable |
| `reading-layout.js` | REBUILD SHARED | Explicit passage/prompt fields instead of newline DOM parsing |
| `loading-transitions.js` | REBUILD SHARED | Generic loading overlay only |
| `question-review-flag.js` | KEEP | Assessment staging QA |
| `question-feedback-header.js` | KEEP | Assessment staging QA layout |

---

# Proposed shared folders

Do not create these until implementation starts; this is the target layout.

```text
shared/
  learning-engine/
    scoring/
      answer-normalizer.js
      scoring.js

    renderers/
      multiple-choice.js
      typed-answer.js
      sentence-order.js
      listening.js
      reading.js
      speaking.js

    audio/
      player.js
      tts.js
      dialogue-player.js

    ui/
      loading-overlay.js
      feedback.js

students/
  shared/
    student-session.js

  study/
    index.html
    study.css
    study.js
    study-session.js

    services/
      study-api.js
      study-recorder.js

    generators/
      vocab-choice.js
      vocab-recall.js
      spelling.js
      grammar-choice.js
      sentence-order.js
```

---

# Important migration rule

**Do not refactor the working level test first.**

Build and test the neutral shared modules against the new study app. Once a shared module is proven, the level test can optionally adopt it later.

This avoids breaking the live assessment while we design the new engine.

---

# First implementation slice

The best first end-to-end slice is **Vocabulary Choice**.

It should prove this chain:

```text
student login
  -> active class enrollment
  -> class book assignment
  -> Content DB book
  -> current unit
  -> unit lexical entries
  -> generated vocab-choice StudyActivity
  -> shared multiple-choice renderer
  -> shared canonical scoring
  -> study session + attempt saved
  -> mastery updated
  -> teacher can see result
```

If that works, the architecture is sound.

Then add, in this order:

1. vocabulary recall / typed answer;
2. spelling;
3. sentence ordering;
4. grammar choice;
5. teacher vocabulary/unit report;
6. listening;
7. reading;
8. speaking;
9. writing.

---

# Immediate next steps

1. Define the V1 `StudyActivity` contract exactly.
2. Define the study progress DB tables and RLS.
3. Decide how `current_unit_id` is stored/resolved in `class_book_assignments`.
4. Define the study API contract.
5. Create the first neutral shared modules: answer normalization, scoring and multiple-choice renderer.
6. Build a minimal `students/study/` app shell.
7. Implement one real English Bus / Let's Go unit as the vocabulary end-to-end proof.
