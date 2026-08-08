# Willena Study App — Level Test Engine Audit

## Purpose

Audit the current student level-test stack before extracting reusable pieces for `students/study/`.

The goal is not to make the study app depend on the level-test app. The goal is to preserve useful behavior while moving generic learning behavior into clean shared modules.

---

# Executive conclusion

The current student level test contains several genuinely reusable capabilities, but the implementation is tightly coupled in places.

The strongest reusable ideas are:

- answer normalization and scoring;
- question/activity normalization;
- multiple-choice rendering;
- sentence/token ordering;
- reading layout;
- listening controls and TTS helpers;
- student auth/session handling patterns;
- offline/retry concepts for recording attempts;
- common loading/transition UI.

The parts that should remain assessment-only are:

- starting ability calculation;
- adaptive question selection;
- question-type balancing/limits;
- full-test section calibration;
- level recommendation;
- level result consistency/display mapping;
- level-test attempt recording and completion flow;
- assessment question review/flagging tools.

The main technical problem is that several features are currently added by monkey-patching `fetch`, rewriting the source text of `app-classic.js`, or using `MutationObserver` to patch rendered DOM. We should preserve the behavior, but not copy this architecture into the study app.

---

# Current student level-test stack

`students/level-test/index.html` currently loads the following relevant JavaScript:

- `students/level-test/level-test.js`
- `free-level-test/js/assessment-loader-classic.js`
- `free-level-test/js/question-type-limits.js`
- `free-level-test/js/dialogue-tts.js`
- `free-level-test/js/adaptive-calibration-loader.js`
- `free-level-test/js/level-result-consistency.js`
- `free-level-test/js/canonical-answer-scoring.js`
- `free-level-test/js/test-recording.js`
- `students/level-test/recorder-begin-guard.js`
- `free-level-test/js/scramble-token-letter-fix.js`
- `free-level-test/js/loading-transitions.js`
- `free-level-test/js/reading-layout.js`
- `free-level-test/js/listening-compact.js`
- `free-level-test/js/question-review-flag.js`
- `free-level-test/js/question-feedback-header.js`

`students/level-test/level-test.js` also intercepts requests for `./js/app-classic.js` and redirects them to the free level-test engine.

---

# Classification

## SHARE / REBUILD AS SHARED MODULES

These capabilities belong in a neutral `shared/learning-engine/` layer.

### 1. Canonical answer normalization and scoring

Current source:

- `free-level-test/js/canonical-answer-scoring.js`

Useful behavior:

- Unicode normalization;
- whitespace cleanup;
- case-insensitive sentence comparison;
- trailing punctuation tolerance for sentence building;
- array/token comparison;
- consistent scoring of sentence unscramble answers.

Recommendation:

Create:

```text
shared/learning-engine/answer-normalizer.js
shared/learning-engine/scoring.js
```

Do not copy the current fetch-response interception that repairs prospective level-test payloads. That part is assessment-specific.

Shared API should look more like:

```js
normalizeAnswer(value, options)
scoreAnswer(activity, studentAnswer)
```

The scorer should receive an activity explicitly rather than inspecting arbitrary network responses.

---

### 2. Activity/question normalization

Current source:

- `free-level-test/js/assessment-loader-classic.js`

Useful behavior:

- converts database rows into a simple frontend question object;
- validates required prompt/correct answer;
- sorts options;
- validates unique choices;
- converts sentence-unscramble metadata into tokens;
- converts listening metadata into usable transcript data.

Problem:

It is hard-coded directly to:

- the Content Database Supabase URL;
- `assessment_items`;
- exactly four choices;
- level-test item types.

Recommendation:

Split into:

```text
shared/learning-engine/activity-schema.js
shared/learning-engine/activity-normalizer.js
```

The study API should return normalized activity data. The browser should not directly query the Content Database to build activities.

Suggested normalized shape:

```js
{
  id,
  sourceType,
  sourceId,
  bookId,
  unitId,
  sectionId,
  skill,
  type,
  prompt,
  context,
  choices,
  answer,
  acceptedAnswers,
  tokens,
  audio,
  metadata
}
```

The level test can later adapt its `assessment_items` into the same shape.

---

### 3. Multiple-choice renderer

Current source:

- core behavior lives inside `free-level-test/js/app-classic.js`

Useful behavior:

- choice rendering;
- selected state;
- shuffled choices;
- enabling/disabling submit/next controls.

Recommendation:

Extract a proper renderer:

```text
shared/learning-engine/renderers/multiple-choice.js
```

It should render a supplied normalized activity and emit an answer event. It must not know about ability levels or test length.

---

### 4. Sentence-order renderer

Current sources:

- `free-level-test/js/app-classic.js`
- `free-level-test/js/scramble-token-letter-fix.js`
- `free-level-test/js/canonical-answer-scoring.js`

Useful behavior:

- shuffled token bank;
- tap to place token;
- tap placed token to return it;
- canonical sentence scoring;
- punctuation/case cleanup.

Problem:

The current `scramble-token-letter-fix.js` repairs the DOM after rendering by reloading the question bank and matching displayed tokens. This should not be necessary in a clean renderer.

Recommendation:

Create:

```text
shared/learning-engine/renderers/sentence-order.js
shared/learning-engine/tokenizer.js
```

The renderer should own token display from the beginning and preserve canonical token identity internally.

---

### 5. Reading renderer/layout

Current source:

- `free-level-test/js/reading-layout.js`

Useful behavior:

- separates passage/context from the question;
- supports emoji-only passage content;
- provides distinct passage/question layout.

Problem:

It currently infers structure by taking the final newline from already-rendered prompt text and patches the DOM with a `MutationObserver`.

Recommendation:

Create:

```text
shared/learning-engine/renderers/reading.js
```

The normalized activity should already contain:

```js
context: passage
prompt: question
```

No text splitting or post-render DOM patch should be required.

---

### 6. Listening controls

Current sources:

- listening logic in `app-classic.js`
- `free-level-test/js/listening-compact.js`

Useful behavior:

- play button;
- remaining-play counter;
- compact headphone UI;
- first-time listening help;
- disabling playback while speaking.

Recommendation:

Create:

```text
shared/learning-engine/audio.js
shared/learning-engine/renderers/listening.js
```

The listening renderer should support both recorded audio URLs and browser TTS fallback.

Do not hard-code a two-play limit globally. The activity should specify playback rules.

---

### 7. TTS helper concepts

Current source:

- `free-level-test/js/dialogue-tts.js`

Useful behavior:

- English voice selection;
- alternating voices for dialogue;
- sequencing multiple utterances.

Problem:

The current module contains a hard-coded map of level-test sentences and monkey-patches `speechSynthesis.speak()` globally.

Recommendation:

Create:

```text
shared/learning-engine/tts.js
```

Provide explicit functions such as:

```js
speakText(text, options)
speakDialogue(turns, options)
```

Dialogue data should come from the DB/API rather than a hard-coded sentence map.

---

### 8. Loading/transition UI

Current source:

- `free-level-test/js/loading-transitions.js`

Useful behavior:

- consistent transition overlay;
- accessible status messaging;
- visual protection while larger state changes happen.

Problem:

It currently identifies specific level-test buttons and intercepts clicks.

Recommendation:

Create a generic UI helper:

```text
shared/learning-engine/ui/loading.js
```

with explicit methods such as:

```js
showLoading(message)
hideLoading()
withLoading(action, message)
```

---

### 9. Student session/auth pattern

Current source:

- `students/level-test/level-test.js`
- `students/api-gateway.js`

Useful behavior:

- `whoami` identity check;
- one refresh attempt when session is stale;
- `get_profile` enrichment;
- same-domain cookie credentials;
- periodic/focus session refresh;
- gateway routing through Willena infrastructure.

Recommendation:

Do not copy this block into each student app.

Create a shared student session module, for example:

```text
students/shared/student-session.js
```

Potential API:

```js
await StudentSession.requireUser()
await StudentSession.getProfile()
await StudentSession.refresh()
```

The study app and level test should eventually share this.

Do not edit `cloudflare-workers/supabase-auth/src/index.js` as part of this extraction.

---

### 10. Attempt/offline queue concepts

Current source:

- `free-level-test/js/test-recording.js`

Useful concepts:

- one session/attempt object;
- individual answer capture;
- response timing;
- local persistence if save fails;
- reconnect retry;
- duplicate-answer protection;
- final session completion;
- stale-attempt recovery.

Recommendation:

Do not share this file directly.

Create a generic study recorder later:

```text
shared/learning-engine/attempt-recorder.js
```

or a study-specific implementation built to a common interface:

```js
startSession(context)
recordAttempt(attempt)
completeSession(summary)
retryPending()
```

The level-test recorder must remain separate because it records assessment-specific fields such as recommended level, ability, assessment item snapshots, and level-test attempt state.

---

# KEEP LEVEL-TEST ONLY

These should not be used by the study app.

### `adaptive-calibration-loader.js`

Assessment only.

Contains:

- starting ability matrix;
- calibration targets;
- adaptive ability movement;
- anti-stall behavior;
- full-test sections;
- section transitions;
- level ceiling;
- assessment-specific question selection.

It currently works by downloading `app-classic.js` as text and replacing exact source fragments before executing it. This is fragile and should eventually be refactored inside the level-test project, but it is not required to build the study app.

### `question-type-limits.js`

Assessment only.

Contains level-test balancing rules such as limiting grammar-error questions and remapping grammar-application questions.

The study app should deliberately allow concentrated practice in one type, so these limits would be counterproductive.

### `level-result-consistency.js`

Assessment only.

Maps internal assessment level numbers to public result labels and keeps rendered level results consistent.

No equivalent is needed for study practice.

### `test-recording.js`

Level-test implementation remains assessment-only.

Reuse the recording concepts, not this endpoint/payload implementation.

### `recorder-begin-guard.js`

Level-test workaround.

It prevents duplicate begin calls caused by current event/load behavior. A clean study session manager should not require polling for a global recorder object and wrapping it after load.

### `question-review-flag.js`

Content QA / level-test staging tool.

Useful as an admin/editor idea, but it should not ship as normal student study functionality.

### `question-feedback-header.js`

Staging-only positioning patch for question QA controls. Keep out of study runtime.

### Level-test setup and result screens in `app-classic.js`

Keep:

- grade selection;
- years-studied selection;
- listening inclusion setting;
- test length selection;
- adaptive result report;
- recommended level description.

These are assessment concerns, not study concerns.

---

# REPLACE / DO NOT CARRY FORWARD

### Global `window.fetch` interception

`students/level-test/level-test.js` replaces `window.fetch` so a request for a local `app-classic.js` resolves to the free level-test engine.

Do not use this architecture in the study app.

Shared modules should be imported directly from known shared paths.

### Source-code string replacement

`adaptive-calibration-loader.js` patches `app-classic.js` using exact string replacement.

This makes unrelated changes to `app-classic.js` capable of breaking calibration patches.

Do not reproduce this pattern.

### MutationObserver as the primary component system

Several current modules wait for arbitrary DOM to appear and then patch it:

- reading layout;
- question review controls;
- header feedback controls;
- student result completion detection;
- scramble display repair.

MutationObserver is fine for isolated compatibility shims, but the new engine should call renderers explicitly.

### Hard-coded dialogue map

Move dialogue turns into DB/API data.

### Direct Content DB querying from frontend loaders

The study app should use the Willena study API. The frontend should not coordinate Content DB and operational DB itself.

---

# CSS audit

The active student level test does **not** currently load `students/level-test/level-test.css`.

Instead, it loads styling from `free-level-test/styles/` plus inline student-specific completion/auth styles.

Therefore `students/level-test/level-test.css` appears to be legacy/orphaned relative to the current page and should not be treated as the design foundation for the study app.

For study, create a clean stylesheet and selectively reuse visual rules/components from the active free-level-test styles rather than importing the entire assessment theme stack.

Recommended future split:

```text
shared/learning-engine/styles/
    activity.css
    choices.css
    sentence-order.css
    listening.css
    reading.css
    feedback.css

students/study/study.css
students/level-test/level-test-theme.css
```

---

# Proposed shared module target

Do not create all of this immediately. This is the intended destination.

```text
shared/learning-engine/
    activity-schema.js
    activity-normalizer.js
    scoring.js
    answer-normalizer.js
    tokenizer.js
    audio.js
    tts.js

    renderers/
        multiple-choice.js
        typed-answer.js
        sentence-order.js
        listening.js
        reading.js
        speaking.js
        writing.js

    ui/
        loading.js
        feedback.js

students/shared/
    student-session.js
```

Study-specific modules:

```text
students/study/
    index.html
    study.css
    study.js
    study-api.js
    practice-controller.js
    mastery-ui.js
```

Level-test-specific modules remain under the level-test project.

---

# Extraction order

The extraction must be incremental. Do not move the whole level test at once.

## Extraction 1 — scoring

First create the generic answer normalizer/scorer and make the study prototype use it.

Then optionally migrate the level test to use it after tests confirm equivalent behavior.

Risk: low.

## Extraction 2 — normalized activity contract

Define `StudyActivity` and build adapters for:

- generated lexical activities;
- generated sentence activities;
- authored `activities` rows;
- later, level-test `assessment_items`.

Risk: low/medium.

## Extraction 3 — multiple-choice renderer

Build a new renderer using the normalized contract.

Use it first in study vocabulary practice.

Do not immediately replace level-test UI.

Risk: low.

## Extraction 4 — sentence-order renderer

Build clean token identity and scoring without DOM repair.

Risk: medium.

## Extraction 5 — audio/TTS/listening

Build explicit audio/TTS APIs.

Risk: medium because browser voice/audio behavior differs across devices.

## Extraction 6 — reading renderer

Use explicit passage/context fields.

Risk: low.

## Extraction 7 — student session helper

Centralize the existing reliable auth pattern after the study app proves it can consume the same gateway/session behavior.

Risk: medium because auth changes can affect existing student apps.

## Extraction 8 — generic attempt recorder interface

Only after study progress tables/API exist.

Risk: medium/high.

---

# What to build next

The audit supports the original build plan.

The next development task should be **the normalized StudyActivity contract plus the first shared scorer**.

Do not change the existing level-test engine yet.

Build the new pieces alongside it first:

```text
shared/learning-engine/activity-schema.js
shared/learning-engine/answer-normalizer.js
shared/learning-engine/scoring.js
```

Then create a tiny study test harness that can render one hard-coded vocabulary activity and score it.

After that, connect the activity loader to the real book/unit API.

This keeps the existing level test stable while establishing the clean architecture for everything new.
