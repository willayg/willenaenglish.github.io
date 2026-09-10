# Willena Level Test v2 — Functional and Architecture Specification

Status: Draft v1
Target: staging first
Primary use case: face-to-face/visitor placement assessment at Willena

## 1. Purpose

Level Test v2 replaces the current visitor level-test flow with a cleaner assessment architecture and a more valid placement process.

The central change is that the test no longer estimates a starting level from school grade or years of English study. A teacher-led speaking interview becomes the first assessed skill and the primary calibration signal for where the computerized assessment should begin.

The test must measure actual English ability across skills, avoid wasting time on questions far below the student's level, and allow the teacher to use professional judgment at every important placement decision.

## 2. Core principles

1. Speaking is a real assessed skill, not a setup questionnaire.
2. Teacher judgment is authoritative. The app may recommend, but the teacher can override.
3. The speaking interview is flexible. Teachers do not need to ask every prompt or score every prompt.
4. The computerized assessment is adaptive and starts from the teacher-selected starting level.
5. Reading and Listening must measure comprehension, not superficial word matching.
6. Skill levels may differ. A student may be Level 6 in Speaking and Level 4 in Reading, for example.
7. The final result should preserve raw evidence, app recommendations, and teacher overrides rather than collapsing everything into one unexplained number.
8. New code should have clear ownership. Do not recreate the patch-heavy architecture of the old free level test.
9. Existing assessment content may be reused where it is good enough, but the old application architecture is not the foundation of v2.
10. Face-to-face mode should feel fast and natural on a tablet in a real consultation.
11. Renderer renders. Grader grades. Selector selects. Calculator calculates. Session stores. App orchestrates. No module may silently become a second owner of another module's responsibility.
12. Level Test v2 must look and feel like the current visitor level test. The rebuild is architectural and assessment-focused, not a visual redesign.

## 3. Test modes

The architecture should support multiple modes without forking the assessment engine.

### 3.1 Face-to-face / visitor mode

Primary v2 use case.

A teacher conducts the Speaking assessment, chooses the starting level, and then hands the device to the student for the computerized portion.

The student should not be shown a detailed final score/report during the assessment. The student-facing ending can simply show a positive completion message such as "Great job!" while the staff-side result retains full assessment detail.

### 3.2 Signed-in student mode

Uses the same computerized assessment engine and scoring rules.

Student identity comes from authentication rather than visitor entry. The Speaking section may be teacher-entered before the student begins or added separately according to the future staff workflow.

### 3.3 Future public/free mode

If Willena keeps a public self-service level test, it should use the same assessment engine but a different calibration strategy because a teacher is not present. This is not the first implementation priority for v2.

## 4. Overall assessment flow

The intended face-to-face flow is:

1. Show the same initial visitor/start experience as the current visitor level test unless deliberately redesigned later.
2. Enter/create the visitor/student identity details needed for the assessment session.
3. Enter the parent phone number.
4. Create or resume the assessment session.
5. Teacher opens Speaking Assessment.
6. Teacher navigates freely between speaking levels.
7. Teacher asks any useful prompts from those levels.
8. Teacher may optionally score individual answers with the 5-point rubric.
9. Teacher may optionally record individual spoken answers.
10. The app calculates a recommended speaking/starting level from available evidence.
11. Teacher gives an overall teacher-impression Speaking level.
12. App displays its recommended computerized-test starting level.
13. Teacher accepts or overrides that starting level.
14. Student begins the computerized adaptive assessment at the teacher-selected starting level.
15. Reading, Listening and language-knowledge sections adapt independently enough to locate the student's ceiling/floor efficiently.
16. Any Writing assessment is handled according to the writing model defined later in this spec/project.
17. Assessment finishes and saves all skill results, teacher judgments, recommendations and overrides.
18. Student sees a simple completion screen; teacher/admin can access the detailed result.

## 5. Speaking Assessment

### 5.1 Purpose

The Speaking Assessment has two jobs:

- measure the student's speaking ability;
- provide the best initial calibration signal for the rest of the level test.

It is not merely a warm-up or background-information interview.

### 5.2 Speaking prompt bank

Speaking prompts should be authored specifically for teacher-led assessment.

Each prompt belongs to a Willena internal level or assessment band and may include:

- prompt text shown to the teacher;
- optional Korean teacher note;
- optional follow-up prompt(s);
- what the prompt is intended to elicit;
- level/band;
- optional scoring guidance/examples;
- active/archive status;
- optional age suitability if needed later.

Existing `question_response` items can inspire content but should not automatically become speaking prompts. Many existing items are textbook-answer exercises rather than good spontaneous-speaking probes.

### 5.3 Level navigation

The teacher must be able to move freely between levels.

Required controls:

- swipe left/right on touch devices;
- visible Previous Level and Next Level controls;
- direct level selector/jump control;
- current level clearly displayed at all times.

Navigation must not require finishing the current level.

The teacher may begin at a very basic level, jump upward quickly, move back down, or revisit a level at any time before finalizing the Speaking section.

### 5.4 Prompt usage

At each level the teacher sees a list of suggested questions.

The teacher:

- may ask none, one, several, or all prompts;
- does not have to follow the displayed order;
- does not have to record or score every answer;
- may revisit a prompt;
- may move levels whenever enough evidence has been gathered.

The UI should support real conversation rather than turn the teacher into a data-entry clerk.

### 5.5 Five-point response rubric

If the teacher chooses to score a response, use a simple five-point rubric based on how independently and completely the student understands and answers the question.

Proposed rubric:

1. **Does not understand / cannot answer**
   - Student does not understand the question even with reasonable repetition or gives no meaningful response.

2. **Understands with substantial help / minimal response**
   - Needs translation, strong prompting, gestures, examples or major reformulation; may answer with a single word or fragment.

3. **Basic understandable answer**
   - Understands the main question and gives an appropriate but limited answer; may contain noticeable errors or require some prompting.

4. **Clear complete answer**
   - Understands independently and gives a complete, relevant answer with adequate grammar and vocabulary for the level; minor errors do not prevent communication.

5. **Full, natural, extended answer**
   - Understands readily and answers independently with detail, extension, appropriate language range and natural interaction for the level.

The labels shown in the UI should be concise, while expanded descriptions can be available through an info/help control.

### 5.6 Optional response recording

The teacher may record spoken answers.

Recording is optional per prompt. A teacher should be able to assess the whole interview without recording anything.

If recorded, store the recording against:

- assessment session;
- student/visitor;
- speaking prompt;
- level;
- teacher score if one exists;
- timestamp.

Recordings must not be required for the recommendation algorithm unless explicitly changed later.

### 5.7 App speaking recommendation

The app should calculate a recommended Speaking level from the evidence the teacher actually records.

Important rules:

- do not average all rubric scores blindly;
- success on harder levels is more informative than perfect scores on easy levels;
- repeated failure at a higher level is evidence of a ceiling;
- sparse data should produce a lower-confidence recommendation, not a fake high-confidence result;
- the recommendation must tolerate skipped levels and partially scored interviews;
- unscored questions should not be treated as successes or failures;
- the algorithm should be explainable enough that staff can understand why a level was suggested.

Initial conceptual approach:

- find the highest level with credible successful evidence;
- check whether evidence at the next level supports progression or shows a ceiling;
- use rubric strength and number of sampled prompts as confidence signals;
- return a recommended level plus confidence/evidence summary.

The precise formula should be implemented and tested separately rather than hard-coded casually in the UI.

### 5.8 Teacher overall impression

The Speaking section must include a separate overall teacher-impression level.

This is not the same field as the app recommendation.

The teacher can choose the Speaking level they believe best represents the student after the interview, whether or not every response was scored.

Save both:

- `app_speaking_recommendation`
- `teacher_speaking_level`

The teacher's level is the authoritative reported Speaking level unless future policy explicitly changes this.

### 5.9 Computerized-test starting level

After Speaking is complete, the app recommends a starting level for the computerized assessment.

Default recommendation will normally be derived primarily from the Speaking assessment.

Display:

- app recommended starting level;
- teacher speaking/impression level;
- chosen test starting level.

The teacher may accept or override the app recommendation.

Save both:

- `recommended_start_level`
- `teacher_selected_start_level`

The computerized test must use `teacher_selected_start_level`.

School grade and years of study must not determine this starting level in face-to-face mode.

## 6. Student and parent information

The initial visitor process should remain visually and behaviorally familiar to the current visitor level test unless deliberately redesigned later. The key change is that the old grade/years-study calibration questions are no longer used to calculate ability.

The intake must collect a parent phone number before the Speaking Assessment begins.

Parent phone requirements:

- parent phone is required for face-to-face visitor sessions unless staff intentionally provide a future bypass;
- Korean mobile numbers should display in a familiar readable format such as `010-1234-5678`;
- store a normalized canonical phone value in addition to any formatted display value where useful;
- the phone number belongs to the visitor/prospective-student identity and assessment session so staff can find the assessment later;
- duplicate phone matches should not automatically merge students without an explicit identity rule;
- phone data must never influence ability, scoring or question selection.

Grade or school year may still be recorded because it can be useful administratively, for parent reports or for interpreting unusual results.

However, in face-to-face mode:

- grade does not set ability;
- years studied does not set ability;
- neither should be required merely to start the assessment unless needed for student identity/admin records;
- they must not silently bias adaptive scoring.

## 7. Computerized adaptive assessment

### 7.1 Starting state

The adaptive engine receives `teacher_selected_start_level` as its initial ability estimate.

It must not call an equivalent of the old `startAbility(years, grade)` logic in face-to-face mode.

### 7.2 Adaptive objective

The purpose is not to ask a fixed number of random questions near one level. The engine should efficiently establish each skill's approximate floor, comfortable range and ceiling.

A strong student should move upward quickly.

A struggling student should move downward quickly enough to find material they can demonstrate successfully.

The engine should avoid making a student answer many clearly inappropriate questions simply to reach a fixed question count.

### 7.3 Skill evidence

The engine should maintain skill-specific evidence rather than assuming one universal ability number is sufficient.

At minimum:

- Speaking — teacher assessed;
- Listening — computerized adaptive;
- Reading — computerized adaptive;
- Language knowledge — vocabulary/grammar evidence, exact reporting structure to be finalized;
- Writing — teacher/AI or other workflow to be finalized.

The overall Willena level is calculated after individual skill evidence exists.

### 7.4 Adaptive movement

Exact thresholds are to be tuned, but intended behavior is:

- strong success at current level → test higher level quickly;
- mixed performance → gather confirming evidence near current level;
- clear failure → step down;
- high-level success should carry more information than repeated low-level success;
- do not allow one lucky multiple-choice answer to cause a large jump;
- do not allow one mistake to collapse the estimate;
- stop a skill when sufficient evidence exists to locate its level with acceptable confidence.

The engine should support variable question counts rather than forcing every student through exactly 20/30/40 questions.

## 8. Reading assessment overhaul

Reading is a major v2 priority because parts of the current test are too easy and can be solved through superficial matching.

### 8.1 What Reading should measure

Difficulty must increase through comprehension demands as well as vocabulary and passage length.

Depending on level, evidence should include:

- direct literal comprehension;
- identifying details;
- sequence;
- main idea;
- reference/pronoun understanding;
- paraphrase recognition;
- vocabulary/meaning from context;
- cause/effect;
- purpose;
- inference;
- attitude/tone where appropriate;
- integrating information across multiple sentences;
- understanding increasingly authentic-style passages at higher levels.

### 8.2 Distractors

Distractors must be plausible.

Avoid questions where:

- the correct answer simply repeats an obvious word from the passage while distractors are unrelated;
- visual word matching gives away the answer;
- the student can succeed without understanding the sentence/passage;
- one answer is grammatically or semantically obviously different from all others.

### 8.3 Reading item audit

Before v2 is considered valid, existing published Reading items used by the level test should be audited for:

- assigned level;
- comprehension demand;
- distractor quality;
- passage difficulty;
- answer ambiguity;
- overreliance on keyword matching.

Items should be re-leveled, improved, excluded or replaced where necessary.

## 9. Listening assessment overhaul

Listening is also a major v2 priority.

### 9.1 What Listening should measure

Listening should increasingly require comprehension rather than hearing a target word and selecting the same written word.

Useful item families include:

- listen and choose picture/meaning;
- identify what happened;
- choose a paraphrase;
- understand a short instruction;
- understand a short dialogue;
- infer place/situation/speaker intention;
- follow sequence or details;
- understand two- or three-sentence chunks at appropriate levels;
- infer meaning from context at higher levels.

### 9.2 Reading contamination

Listening questions must not become covert reading questions.

Written choices should not make the task substantially easier than the audio itself. At higher levels, paraphrased choices are preferable to verbatim transcript matching.

### 9.3 Audio playback

Playback limits may vary by level/item type. The system should store how many times audio was played when useful for analysis, but repeated playback should not automatically equal failure.

The exact playback policy should be defined after the item-bank audit.

### 9.4 Listening item audit

Existing Listening items should be audited for:

- actual listening comprehension demand;
- transcript/choice leakage;
- item level;
- distractor quality;
- audio length;
- linguistic complexity;
- whether the student can answer from one keyword alone.

## 10. Vocabulary and grammar / language knowledge

The current database contains substantial vocabulary and grammar content. V2 should reuse good items but should not let sheer volume of easy grammar/vocabulary questions dominate the placement outcome.

Language-knowledge evidence should complement Reading, Listening and Speaking rather than substitute for them.

Questions flagged or marked `exclude_level_test` must remain excluded from level-test selection.

The reporting model for Vocabulary and Grammar as separate skills versus a combined Language Knowledge score should be finalized before the report UI is built.

## 11. Writing

Writing remains a required assessment domain in the broader Willena level model, but its exact v2 workflow is not yet fixed in this document.

Potential model:

- age/level-appropriate short writing task;
- teacher and/or AI-assisted rubric assessment;
- preserve teacher authority;
- save original student writing and any derived assessment evidence.

Writing architecture must be separable from the computerized multiple-choice engine.

## 12. Final skill results

A completed assessment should be able to store, at minimum:

- Speaking level;
- Listening level;
- Reading level;
- Vocabulary/Grammar or Language Knowledge level(s);
- Writing level when assessed;
- overall Willena level;
- confidence/evidence metadata where available.

Speaking should reflect the teacher's assessed level, not a fabricated automated score from unrelated multiple-choice items.

## 13. Overall Willena level

The overall level should combine skill evidence according to an explicit policy.

It should not simply average every numeric skill result without thought.

The combination rule should account for meaningful imbalances and should be documented/tested separately.

Teacher/admin users should be able to see the individual skill profile even when a single public/parent-facing Willena level is reported.

## 14. Teacher override philosophy

Teacher override is a first-class feature, not an error condition.

Whenever the app makes a consequential placement recommendation, preserve:

- what the app recommended;
- what the teacher chose;
- who made the override;
- when it happened;
- optional note/reason if the teacher wishes to add one.

Do not force a reason for normal overrides unless policy changes later.

## 15. Session persistence

The test should be built around an explicit assessment session.

A session should survive accidental refresh/navigation where practical and should not require the teacher/student to restart because a page reload occurred.

Core session states may include:

- created;
- speaking_in_progress;
- speaking_complete;
- student_test_in_progress;
- assessment_complete;
- abandoned/cancelled.

The persisted session should know enough to resume at the correct stage.

## 16. Suggested data model

Exact schema names may change after reviewing existing assessment/report tables, but conceptually v2 needs the following domains.

### 16.1 Speaking prompt bank

Suggested table/domain: `assessment_speaking_prompts`

Possible fields:

- id
- level_id
- prompt_text
- teacher_note
- elicitation_goal
- follow_up_prompts
- active
- display_order
- metadata
- created_at
- updated_at

### 16.2 Assessment sessions

One canonical assessment-session record should own the overall workflow.

Possible fields:

- id
- student_id nullable for visitor
- visitor/student identifying fields as appropriate
- parent_phone_normalized
- parent_phone_display nullable
- mode
- status
- teacher_id
- app_speaking_recommendation
- teacher_speaking_level
- recommended_start_level
- teacher_selected_start_level
- final_overall_level
- started_at
- completed_at
- metadata

### 16.3 Speaking evidence

Possible table/domain: `assessment_speaking_responses`

Possible fields:

- id
- session_id
- prompt_id
- prompt_level
- rubric_score nullable
- recording reference nullable
- teacher note nullable
- asked_at

Only create a response/evidence row when the teacher actually chooses to save evidence; viewing a prompt is not the same as asking/scoring it.

### 16.4 Computerized item attempts

Each scored computerized answer should be associated with the assessment session and retain enough data for later audit/recalculation.

At minimum:

- session id;
- assessment item id;
- skill;
- level/difficulty presented;
- answer/result;
- timestamp;
- relevant interaction metadata such as listening plays where useful.

Do not store only final percentages and discard the assessment evidence.

## 17. Architecture

Create Level Test v2 as a clean modular application rather than extending the old free-level-test patch stack.

Initial location:

`students/level-test-v2/`

The architecture must follow a single-owner model. Each subsystem has one canonical implementation and other modules call it rather than duplicating its logic.

### `app.js`

Top-level workflow/controller. It owns orchestration and route-to-screen composition only. It may ask other modules to load, render, grade, select, calculate or persist, but must not reproduce their algorithms.

### `assessment-session.js`

Canonical assessment session state and persistence contract. Owns session lifecycle, resume state, current phase, saved evidence references and persistence coordination. It does not calculate student ability.

### `speaking-assessment.js`

Teacher-facing Speaking workflow: prompt navigation, rubric evidence, recordings, teacher impression and completion.

### `speaking-recommendation.js`

Pure recommendation/scoring logic for Speaking evidence. Keep this separate enough to test without the UI.

### `question-source.js`

The only owner for loading/filtering eligible level-test assessment content from Supabase/backend. It answers questions such as what items are available and eligible. It does not decide which eligible question is pedagogically best to show next.

This separation is deliberate: source loading and adaptive selection are different responsibilities.

### `question-model.js`

The only owner for converting database/source records into one canonical Level Test v2 question shape. The renderer and grader consume the canonical model rather than learning arbitrary database schemas.

### `question-renderer.js`

The only computerized question rendering engine.

It must follow the same architectural idea as the Test Prep v2 renderer/render lab: a normalized question enters the renderer; the renderer displays it and captures the student's response.

The renderer must not:

- choose the next question;
- alter ability estimates;
- calculate the student's level;
- query the assessment bank directly;
- contain adaptive rules;
- duplicate grading rules that belong to the grader.

All supported computerized question forms must flow through this canonical renderer. Do not create `reading-renderer.js`, `listening-render-fix.js`, `grammar-renderer.js` or DOM patch layers later.

A Level Test v2 render lab/test harness should eventually be able to load the exact same `question-model.js` and `question-renderer.js` modules so that a question inspected in the lab is rendered by the production implementation, not a copy.

### `question-grader.js`

The only owner for deterministic computerized grading rules where applicable. It takes the canonical question plus student response and returns grading evidence. It does not select the next question or calculate the final skill level.

### `question-selection.js`

The only owner for deciding which eligible computerized question should be shown next.

Inputs may include:

- current skill being assessed;
- current estimated ability for that skill;
- confidence/evidence state;
- prior attempts;
- levels already sampled;
- question forms/types already sampled;
- unused eligible items from `question-source.js`;
- coverage/diversity requirements;
- configured difficulty/jump rules.

It returns a question selection decision plus, in diagnostics mode, the reason for that choice.

It must not calculate the final level itself. It consumes the current state provided by the calculation engine.

### `calculation-engine.js`

The only owner for assessment mathematics and placement calculations.

It owns:

- ability estimates;
- skill-level estimates;
- evidence weighting;
- confidence;
- movement recommendations between difficulty bands;
- stopping/continuation decisions based on evidence;
- incorporating the teacher-selected starting level as initial calibration;
- combining skill evidence into final results according to the explicitly configured policy.

It must be testable independently from the UI and question renderer.

The question selection engine may ask it for the current estimate and whether more evidence is needed, but selection logic must not create a competing calculation formula.

### `skill-scoring.js`

If retained as a separate module, it must be a clear subcomponent/dependency of the calculation engine rather than a second calculation owner. It may provide pure skill-scoring helpers, but the calculation engine remains the canonical public owner of assessment calculations.

### `navigation.js`

The only owner for browser/device navigation and resume-safe route state inside Level Test v2.

It owns:

- browser history interaction;
- back behavior;
- route/stage restoration;
- safe handoff between teacher and student phases where navigation state is involved.

Other modules request navigation; they must not add independent `popstate` listeners, private history stacks or back-button fixes.

### `test-config.js`

The canonical configuration owner for assessment constants and policy values that should not be scattered through application code.

Examples:

- level definitions and display names;
- skill definitions;
- rubric definitions;
- minimum evidence requirements;
- maximum safety limits;
- confidence thresholds;
- jump/step constraints;
- question-form coverage rules;
- listening playback policy;
- adaptive stopping thresholds;
- final-level policy values.

No magic numbers for core assessment policy should be hidden in UI/controller files.

### `diagnostics.js`

Development/staging diagnostics for understanding the adaptive path. This is not a second engine and must only observe/explain canonical engine decisions.

For each computerized question it should be possible in staging/debug mode to inspect:

- skill;
- estimated ability before the question;
- confidence before;
- selected item id;
- item level/difficulty/type/form;
- why the selector chose it;
- student result;
- estimated ability after;
- confidence after;
- whether the engine chose to continue, move up, move down or stop;
- why the skill/test eventually stopped.

This is essential for tuning Reading and Listening and identifying bad assessment items.

## 18. Styling and CSS architecture

CSS must be separated by real responsibility from the beginning. Do not create a growing stack of overrides and patch stylesheets.

Proposed structure:

- `styles/base.css` — design tokens, typography, resets, global shell primitives;
- `styles/setup.css` — initial visitor/intake screens including parent phone entry;
- `styles/speaking.css` — teacher Speaking workspace and rubric controls;
- `styles/test.css` — computerized assessment shell, progress, section transitions;
- `styles/questions.css` — canonical question-renderer presentation styles;
- `styles/results.css` — teacher/admin result and completion presentation.

Additional files are allowed when they represent a genuinely distinct responsibility. Files named around fixes/overrides such as `question-fix.css`, `mobile-overrides.css`, `listening-fix.css` should be treated as an architectural warning sign. Fix the owning stylesheet/component instead.

Visual design and assessment logic must remain separate. CSS classes must not encode scoring/calculation behavior.

### 18.1 Visual parity with the current level test

Level Test v2 is **not** a visual redesign. Its default appearance and interaction feel must deliberately match the current visitor/free level test as closely as practical.

Before building new v2 styling, the implementation must inspect and copy the current level-test styling that produces the existing look. This includes all styles that materially affect the user-visible experience, including styles currently split across the old level-test CSS files and override files. The fact that the old application accumulated styles in multiple files does not mean v2 should import that patch stack forever; instead, the effective styles should be copied/consolidated into the clean v2 responsibility-based CSS structure.

The visual-parity requirement includes, where applicable:

- page background and overall spacing;
- Willena logo size/placement and branding treatment;
- header appearance;
- typography, font sizes, weights and line heights;
- card shapes, borders, radii and shadows;
- pink/cyan/white color treatment;
- setup/welcome screen appearance;
- button sizes, shapes, states and spacing;
- question-card layout;
- answer-choice presentation and selected states;
- progress indicators;
- listening/audio controls;
- reading passage layout;
- loading and screen-transition feel;
- language controls;
- mobile/tablet responsive behavior;
- completion-screen styling;
- other visible details that make the current test feel like the current Willena level test.

The new Speaking Assessment and parent-phone screen should use the same visual language so that they feel like native parts of the existing level test rather than a separate admin application.

Where v2 introduces a genuinely new interaction with no old equivalent, use the current level test's existing design language to extend it. Do not introduce a new design system merely because the architecture is new.

Visual parity should be checked side-by-side during implementation. Obvious differences in spacing, typography, colors, controls, card treatment or overall feel should be treated as regressions unless the difference is required by a new v2 function.

### 18.2 Copy styles, not architectural debt

The goal is to preserve the current rendered appearance while cleaning up ownership.

Therefore:

- copy/reproduce the effective current styles into v2;
- preserve the current visual output;
- reorganize those styles into the v2 CSS ownership structure;
- do not keep a dependency on the old app's entire CSS patch chain merely to achieve parity;
- do not redesign components during the migration unless explicitly requested;
- do not make aesthetic "improvements" by default;
- if an old override is necessary to reproduce the current appearance, fold its effective rule into the appropriate v2 stylesheet rather than creating another override file.

In short: **new architecture underneath, same Level Test look and feel on top.**

## 19. Shared platform integration

Before implementing cross-app concerns, check `students/shared/` and the repository architecture rules.

Do not create duplicate implementations for concerns already owned by the shared student platform.

Level Test v2 may have assessment-specific session/scoring logic, but generic student identity, shared header/platform behavior or general student statistics should use canonical shared owners where appropriate.

## 20. Backend architecture

Follow repository rules:

- Cloudflare Pages for hosted web apps;
- existing Cloudflare Worker/API gateway for server-side API logic when required;
- Supabase for database, auth, storage, RLS and safe direct operations;
- do not introduce Netlify infrastructure.

Existing legacy `/.netlify/functions/...`-shaped frontend routes are historical gateway mappings and are not a model for new backend work.

## 21. UI requirements — teacher Speaking stage

Optimized for tablet/mobile landscape or portrait use during an interview.

Required elements:

- clear current level;
- swipe navigation;
- previous/next level buttons;
- direct level jump;
- list/cards of speaking prompts;
- quick optional 1–5 rubric control per selected prompt;
- optional record control;
- visible but unobtrusive evidence summary;
- app recommendation once enough evidence exists;
- teacher overall-impression selector;
- teacher-selected computerized starting level;
- clear handoff/start-student-test action.

The screen should not pressure the teacher to complete every row or prompt.

The Speaking stage must visually inherit the same typography, colors, card treatment, button language, spacing and overall visual tone as the current level test.

## 22. UI requirements — computerized stage

Student-facing UI should preserve the current level test's look and feel while using the new v2 renderer and adaptive architecture.

Requirements:

- minimal setup after teacher handoff;
- large readable question content;
- clear audio controls;
- consistent interaction patterns;
- visible progress without implying an inaccurate fixed-length test if the assessment is variable-length;
- clean section/skill transitions where helpful;
- safe refresh/resume behavior;
- deliberate exit protection during an active assessment;
- no teacher-only scoring/recommendation controls visible to the student;
- question presentation should visually match the current level test unless a specific question type requires a new layout.

## 23. Completion behavior

Face-to-face student view:

- simple positive completion message;
- no need to expose raw scores, teacher notes, recommendation disagreements or internal levels on the student's device.

Teacher/admin result:

- Speaking recommendation;
- teacher Speaking level;
- recommended start level;
- teacher-selected start level;
- each assessed skill result;
- overall level;
- enough evidence/detail to understand unusual results;
- recordings/notes where saved;
- indication of overrides.

## 24. Relationship to the old level test

The existing free/visitor level test should remain intact while v2 is developed and tested.

V2 may reuse:

- good assessment items;
- useful shared assessment utilities after review;
- proven audio/TTS techniques;
- reporting concepts worth preserving;
- existing Supabase content;
- useful interaction behavior from the current visitor intake/start experience where it remains appropriate;
- the complete effective visual styling and interaction language of the current level test.

V2 should not inherit by default:

- grade/years-based starting ability;
- the old fixed setup wizard as the assessment architecture;
- patch-file architecture;
- hidden monkeypatch/interception patterns;
- assumptions that every skill fits one generic multiple-choice item model;
- fixed question counts as the primary stopping mechanism;
- weak Reading/Listening item-selection behavior.

The old app is the visual reference and a source of proven behavior/content, not the architectural chassis.

## 25. Validation plan

Before replacing the old visitor flow, compare v2 with real or representative students.

For each pilot assessment, review:

- teacher Speaking level;
- app Speaking recommendation;
- teacher-selected start level;
- adaptive path taken by skill;
- final Reading and Listening levels;
- obvious too-easy or too-hard items;
- number of questions required;
- whether the teacher felt constrained by the Speaking interface;
- whether the final placement matches teacher judgment after seeing the student perform;
- side-by-side visual parity with the current visitor level test on phone and tablet layouts.

The diagnostics mode should make it possible to inspect these disagreements and the exact adaptive path rather than hiding them.

## 26. Current decisions locked for v2

The following are considered agreed requirements unless deliberately changed later:

- build a clean Level Test v2 rather than bolt major new behavior onto the old visitor test;
- keep the initial visitor/start experience familiar to the current visitor level test;
- Level Test v2 must visually look and feel like the current visitor/free level test rather than introducing a redesign;
- current effective level-test styles are to be copied/reproduced in v2 and reorganized into clean responsibility-based CSS files;
- new v2 screens such as parent phone and teacher Speaking assessment must extend the same visual language;
- visual parity should be checked side-by-side and unrequested aesthetic changes are not part of the rebuild;
- collect a parent phone number during visitor intake;
- phone/grade/background data never influences ability unless a future policy explicitly changes this;
- Speaking interview is an assessed skill;
- Speaking interview also calibrates the starting point for the computerized assessment;
- teachers see level-based banks of possible speaking questions;
- teachers do not need to ask or score all questions;
- five-point rubric ranges conceptually from no understanding/no meaningful answer to a full, complete, natural answer;
- teachers navigate freely between speaking levels using swipes and buttons;
- optional answer recording is supported;
- app recommends a Speaking/starting level from available evidence;
- teacher gives an overall impression level;
- teacher may override the app's recommended computerized starting level;
- the teacher-selected level is the actual starting level used by the adaptive engine;
- grade and years studied do not calibrate face-to-face testing;
- Reading and Listening require a substantive difficulty/content overhaul;
- final reporting preserves individual skill results and teacher/app decisions;
- Level Test v2 is modular and uses one canonical owner for rendering, grading, question loading, question selection, calculations, navigation, session state and configuration;
- question rendering is a proper standalone engine based on a canonical question model, following the same single-source principle used by the Test Prep v2 render lab;
- source loading and question selection are separate modules;
- the calculation engine is separate from the question-selection engine;
- CSS is separated by responsibility rather than accumulated through fix/override files;
- staging diagnostics must expose enough of the adaptive decision path to tune the assessment intelligently.

## 27. Items still to finalize

These do not block creation of the v2 architecture but should be confirmed before their specific feature is implemented:

- exact number/names of Willena levels exposed to teachers in the Speaking UI;
- exact wording of the five rubric labels in Korean/English;
- exact recommendation algorithm and confidence thresholds;
- whether teacher Speaking level and test starting level default to the same value or are deliberately presented as separate decisions every time;
- exact Reading/Listening adaptive stopping rules;
- whether Grammar and Vocabulary remain separate reported skills or become one Language Knowledge result;
- Writing assessment workflow;
- final overall-level combination policy;
- recording retention/storage policy and whether recordings are enabled by default;
- exact staff result/report UI;
- exact visitor identity fields retained from the old initial process besides parent phone number;
- exact duplicate/prospective-student matching policy for parent phone numbers.

## 28. Architectural invariants

These rules are intended to stop Level Test v2 from degrading into another patch stack.

1. There is exactly one canonical question model.
2. There is exactly one canonical computerized question renderer.
3. There is exactly one computerized grader.
4. There is exactly one question-source/data-loading owner.
5. There is exactly one adaptive question-selection owner.
6. There is exactly one public calculation/ability engine.
7. There is exactly one assessment-session owner.
8. There is exactly one browser/history navigation owner.
9. Core policy values come from canonical configuration, not scattered magic numbers.
10. Render/test labs import the production renderer/model rather than copying them.
11. No DOM-after-render patches are allowed as a substitute for fixing the canonical renderer.
12. No `*-fix.js`, `*-patch.js`, `*-override.js` or equivalent compatibility layers should be added without first determining why the owning module cannot be fixed directly.
13. Debug/diagnostic code observes canonical decisions; it never changes scoring or selection behavior.
14. Database schema details terminate at source/model boundaries and do not leak throughout the renderer/calculation/UI.
15. Assessment calculations terminate at the calculation engine and do not leak into screen controllers or CSS.
16. Visual parity with the current level test is a product requirement; architecture cleanup must not be used as an excuse to redesign the interface.

Short form: **Renderer renders. Grader grades. Selector selects. Calculator calculates. Session stores. App orchestrates.**

## 29. Definition of success

Level Test v2 succeeds when a teacher can quickly identify a visitor, capture the parent's phone number, interview an unfamiliar student, use flexible professional judgment, hand the device to the student at an appropriate difficulty, and receive a trustworthy skill profile without forcing the student through large amounts of obviously easy or irrelevant material.

The system should feel like an assessment tool built around a teacher's expertise, with adaptive software extending that expertise rather than replacing it. Its codebase should also remain understandable enough that changing question rendering, selection rules, calculation rules or styling later does not require editing unrelated systems.

Visually, a student or parent familiar with the current level test should immediately recognize v2 as the same Willena level-test experience. The major differences should be better assessment behavior and the new teacher-led Speaking workflow, not a new aesthetic.
