# Willena Level Test v2 — Build Order

Status: Active build checklist
Target: staging first
Related spec: `students/level-test-v2/SPEC.md`

Use this file as the canonical build sequence. Check items off as they are completed and validated on staging.

## Phase 1 — Shell and visual parity

- [x] Create `index.html` and the basic Level Test v2 app shell.
- [x] Reproduce the current visitor/free level test visual appearance as closely as practical.
- [x] Copy/recreate the effective current styles rather than redesigning the interface.
- [x] Split styles by responsibility from the start:
  - [x] `styles/base.css`
  - [x] `styles/setup.css`
  - [x] `styles/speaking.css`
  - [x] `styles/test.css`
  - [x] `styles/questions.css`
  - [x] `styles/results.css`
- [x] Match current typography, colors, cards, buttons, spacing, header/logo treatment, progress UI, question layouts, listening controls, reading layout, transitions, responsive behavior and completion screen.
- [x] Confirm V2 feels visually familiar before adding major new assessment behavior.

## Phase 2 — Visitor intake

- [x] Reproduce the current initial visitor/start experience.
- [x] Add required student/visitor identity fields.
- [x] Add parent phone number entry.
- [x] Normalize Korean phone numbers for storage.
- [x] Preserve a readable display format such as `010-1234-5678`.
- [x] Ensure phone number never influences scoring, level estimates or question selection.
- [x] Remove grade/years-study as calibration inputs.
- [x] Keep grade only if useful as administrative information.

## Phase 3 — Assessment session foundation

- [x] Create `assessment-session.js`.
- [x] Define one canonical assessment-session state shape.
- [x] Persist current phase and progress.
- [x] Support refresh/reload recovery.
- [x] Support teacher-to-student handoff without losing state.
- [x] Define session states such as created, speaking in progress, speaking complete, student test in progress, complete and abandoned.
- [x] Ensure session code does not calculate ability or choose questions.

## Phase 4 — Navigation owner

- [ ] Create `navigation.js`.
- [ ] Make it the only owner of browser history and Back behavior inside Level Test v2.
- [ ] Support resume-safe route/stage restoration.
- [ ] Prevent additional `popstate` listeners or private history stacks elsewhere.
- [ ] Validate browser/device Back behavior early.

## Phase 5 — Speaking assessment UI

- [ ] Create `speaking-assessment.js`.
- [ ] Display a bank of suggested teacher questions for the current level.
- [ ] Add swipe navigation between levels.
- [ ] Add visible Previous Level / Next Level buttons.
- [ ] Add a direct level jump selector.
- [ ] Allow the teacher to ask none, one, several or all questions.
- [ ] Allow optional scoring of individual responses.
- [ ] Add the 5-point rubric control.
- [ ] Allow revisiting questions and levels freely.
- [ ] Add optional recording controls/hooks.
- [ ] Add teacher overall impression level selector.
- [ ] Keep the workflow fast enough for a live consultation.

## Phase 6 — Speaking prompt bank

- [ ] Define the speaking prompt data model/table.
- [ ] Create enough prompts across levels to test the UI properly.
- [ ] Add optional teacher guidance and follow-up questions where useful.
- [ ] Add level/band and display order.
- [ ] Add active/archive handling.
- [ ] Do not automatically convert ordinary `question_response` assessment items into speaking prompts.

## Phase 7 — Speaking recommendation engine

- [ ] Create `speaking-recommendation.js`.
- [ ] Make recommendation logic independent from the UI.
- [ ] Use only actual saved teacher evidence.
- [ ] Do not treat skipped/unscored prompts as failures.
- [ ] Weight successful higher-level evidence more strongly than repeated easy successes.
- [ ] Detect likely ceilings from repeated difficulty at a higher level.
- [ ] Return recommendation plus confidence/evidence summary.
- [ ] Store app recommendation separately from teacher impression.
- [ ] Allow the teacher to override the recommended computerized-test start level.
- [ ] Persist both recommendation and final teacher-selected start level.

## Phase 8 — Canonical question model

- [ ] Create `question-model.js`.
- [ ] Define one canonical Level Test v2 question shape.
- [ ] Normalize database/source records at this boundary.
- [ ] Keep raw Supabase schema details out of renderer, grader and calculation modules.
- [ ] Document supported question forms.

## Phase 9 — Canonical question renderer

- [ ] Create `question-renderer.js`.
- [ ] Follow the same single-source architectural idea as Test Prep v2 / question render lab.
- [ ] Renderer receives only normalized questions.
- [ ] Renderer owns display and response capture only.
- [ ] Support choice questions.
- [ ] Support sentence/chunk ordering where required.
- [ ] Support written-entry forms where required.
- [ ] Support Reading passage presentation.
- [ ] Support Listening presentation/audio controls.
- [ ] Preserve the current level-test visual treatment for all rendered question forms.
- [ ] Do not put grading, adaptive movement or selection logic in the renderer.
- [ ] Do not create type-specific patch renderers later.

## Phase 10 — Level Test v2 render lab

- [ ] Create a Level Test v2 render-lab/test-harness page.
- [ ] Import the exact production `question-model.js`.
- [ ] Import the exact production `question-renderer.js`.
- [ ] Allow browsing/filtering representative assessment items.
- [ ] Allow testing all supported forms and levels.
- [ ] Ensure lab output and production output use the exact same renderer implementation.

## Phase 11 — Question grader

- [ ] Create `question-grader.js`.
- [ ] Centralize answer normalization and deterministic grading.
- [ ] Handle case/punctuation tolerance where appropriate.
- [ ] Handle ordered/chunk answers correctly.
- [ ] Support partial evidence only where the assessment model explicitly allows it.
- [ ] Keep final level calculations out of the grader.

## Phase 12 — Question source

- [ ] Create `question-source.js`.
- [ ] Make it the only owner for loading eligible computerized assessment content.
- [ ] Load all relevant rows beyond the 1,000-row Supabase limit.
- [ ] Respect published status.
- [ ] Exclude flagged items.
- [ ] Respect `exclude_level_test` / equivalent metadata.
- [ ] Classify items by skill, level, form and difficulty.
- [ ] Keep question-source loading separate from question selection.

## Phase 13 — Test configuration

- [ ] Create `test-config.js`.
- [ ] Centralize level definitions/display names.
- [ ] Centralize skill definitions.
- [ ] Centralize rubric definitions.
- [ ] Centralize adaptive thresholds and safety limits.
- [ ] Centralize minimum evidence requirements.
- [ ] Centralize question-form coverage/diversity rules.
- [ ] Centralize listening playback policy.
- [ ] Avoid assessment-policy magic numbers in UI/controller files.

## Phase 14 — Calculation engine

- [ ] Create `calculation-engine.js`.
- [ ] Make it the only public owner for assessment mathematics.
- [ ] Accept `teacher_selected_start_level` as initial calibration.
- [ ] Maintain skill-specific ability estimates.
- [ ] Maintain confidence/evidence state.
- [ ] Weight evidence by level/difficulty appropriately.
- [ ] Decide whether more evidence is needed.
- [ ] Provide movement guidance such as continue, move up, move down or stop.
- [ ] Ensure one lucky correct answer cannot create a huge jump.
- [ ] Ensure one mistake cannot collapse the estimate.
- [ ] Make the engine independently testable.

## Phase 15 — Question selection engine

- [ ] Create `question-selection.js`.
- [ ] Consume eligible items from `question-source.js`.
- [ ] Consume current ability/evidence state from `calculation-engine.js`.
- [ ] Select the best next unused question.
- [ ] Balance level, skill, difficulty, question form and content diversity.
- [ ] Avoid repetitive question families.
- [ ] Support efficient upward/downward probing.
- [ ] Return a human-readable selection reason in diagnostics mode.
- [ ] Do not calculate the final student level inside the selector.

## Phase 16 — Diagnostics mode

- [ ] Create `diagnostics.js` or an equivalent staging-only diagnostics layer.
- [ ] Show current skill.
- [ ] Show estimated ability before each question.
- [ ] Show confidence before each question.
- [ ] Show selected item id, level, difficulty, type and form.
- [ ] Show why the selector picked that item.
- [ ] Show student result.
- [ ] Show estimated ability after the answer.
- [ ] Show confidence after the answer.
- [ ] Show why the engine continued, moved up, moved down or stopped.
- [ ] Show why each skill/test eventually stopped.
- [ ] Ensure diagnostics observes canonical decisions and never changes them.

## Phase 17 — First end-to-end computerized loop

- [ ] Connect session → source → model → selector → renderer → grader → calculator.
- [ ] Start with the teacher-selected calibration level.
- [ ] Complete one full computerized question cycle.
- [ ] Persist the attempt.
- [ ] Select and render the next question correctly.
- [ ] Confirm refresh/recovery still works during the loop.
- [ ] Validate this architecture before expanding assessment content.

## Phase 18 — Grammar/Vocabulary end-to-end validation

- [ ] Get Grammar/Vocabulary assessment running through the full v2 pipeline first.
- [ ] Confirm item normalization.
- [ ] Confirm rendering.
- [ ] Confirm grading.
- [ ] Confirm adaptive movement.
- [ ] Confirm attempt persistence.
- [ ] Confirm skill scoring/calculation.
- [ ] Use this as the first stable computerized skill implementation.

## Phase 19 — Listening overhaul

- [ ] Audit existing Listening items used by the level test.
- [ ] Identify keyword-match / transcript-leak items.
- [ ] Re-level, improve, exclude or replace weak items.
- [ ] Strengthen distractors.
- [ ] Add more paraphrase-based comprehension.
- [ ] Add appropriate short dialogue/multi-sentence tasks by level.
- [ ] Ensure written choices do not turn Listening into Reading.
- [ ] Define playback limits by level/item type.
- [ ] Integrate Listening fully with the v2 renderer, grader, selector and calculator.
- [ ] Tune Listening using diagnostics.

## Phase 20 — Reading overhaul

- [ ] Audit existing Reading items used by the level test.
- [ ] Re-level, improve, exclude or replace weak items.
- [ ] Strengthen distractors.
- [ ] Reduce superficial keyword matching.
- [ ] Add level-appropriate literal comprehension.
- [ ] Add sequence/main idea/reference questions.
- [ ] Add paraphrase/context-meaning questions.
- [ ] Add cause/effect and purpose questions.
- [ ] Add inference and higher-level comprehension where appropriate.
- [ ] Improve passage difficulty progression by level.
- [ ] Integrate Reading fully with the v2 renderer, grader, selector and calculator.
- [ ] Tune Reading using diagnostics.

## Phase 21 — Skill-by-skill adaptive behavior

- [ ] Maintain separate Listening evidence/estimate.
- [ ] Maintain separate Reading evidence/estimate.
- [ ] Maintain separate Language Knowledge evidence/estimate.
- [ ] Keep Speaking as teacher-assessed evidence.
- [ ] Confirm skill weakness/strength does not get hidden by one global running ability number.
- [ ] Confirm each skill can stop independently when enough evidence exists.

## Phase 22 — Overall level calculation

- [ ] Finalize policy for combining skill results.
- [ ] Decide exact treatment of Speaking, Reading, Listening and Language Knowledge.
- [ ] Decide how large skill gaps affect the final level.
- [ ] Avoid blind arithmetic averaging unless explicitly justified.
- [ ] Preserve individual skill levels even when one overall Willena level is produced.
- [ ] Keep final combination policy inside the calculation engine/config, not the UI.

## Phase 23 — Results and completion

- [ ] Reproduce the current level-test completion look and feel where appropriate.
- [ ] Student/visitor device ends with a simple positive completion screen such as “Great job!”.
- [ ] Do not expose internal teacher notes or recommendation disagreements to the student.
- [ ] Build teacher/admin result view.
- [ ] Show app Speaking recommendation.
- [ ] Show teacher Speaking level.
- [ ] Show recommended start level.
- [ ] Show teacher-selected start level.
- [ ] Show each assessed skill result.
- [ ] Show final overall level.
- [ ] Show override history/evidence where useful.
- [ ] Link recordings/notes where saved.

## Phase 24 — Writing assessment

- [ ] Finalize Writing assessment model.
- [ ] Keep Writing as a separate workflow from ordinary multiple-choice rendering.
- [ ] Add level-appropriate writing task(s).
- [ ] Decide teacher and/or AI-assisted rubric behavior.
- [ ] Save original student writing.
- [ ] Feed Writing evidence into the calculation engine only after its assessment policy is defined.

## Phase 25 — Pilot testing and tuning

- [ ] Run representative students through V2.
- [ ] Where useful, compare V2 placement against the old visitor test.
- [ ] Compare teacher Speaking judgment with app recommendation.
- [ ] Compare teacher expectation with final Reading/Listening results.
- [ ] Review obviously too-easy or too-hard questions.
- [ ] Review adaptive paths in diagnostics.
- [ ] Tune thresholds and selection rules based on evidence.
- [ ] Check assessment length and student fatigue.
- [ ] Check whether the Speaking interface feels natural during real consultations.

## Phase 26 — Replacement readiness

- [ ] Confirm visual parity with the current visitor level test.
- [ ] Confirm session/resume reliability.
- [ ] Confirm teacher Speaking workflow is production-ready.
- [ ] Confirm Reading difficulty is trustworthy.
- [ ] Confirm Listening difficulty is trustworthy.
- [ ] Confirm final calculation policy is accepted.
- [ ] Confirm results save and are accessible to staff.
- [ ] Confirm no old grade/years calibration remains in face-to-face mode.
- [ ] Confirm no duplicate renderer/selector/calculation/navigation implementations exist.
- [ ] Only then consider replacing the current visitor test route.

---

## First milestone

The first major working milestone is:

- [x] Current-look V2 shell exists.
- [x] Visitor enters required details + parent phone.
- [ ] Teacher completes a usable Speaking interview.
- [ ] App recommends a starting level.
- [ ] Teacher can override it.
- [ ] Student begins at the teacher-selected level.
- [ ] One computerized question travels through the complete new modular pipeline.

Do not skip the architectural foundation just to make later phases appear finished sooner.
