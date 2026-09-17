# Naesin V2 Build Order

This file defines the implementation order for Naesin V2. The goal is to keep Teacher V2 and Student V2 on the same backend calculations so both surfaces update together.

## Phase 1 — Shared stats core

Status: **DONE**

Shared backend function:

- `public.test_prep_plan_stats_v1(plan_id)`

Keep this as the canonical calculation engine rather than cloning teacher-only and student-only stats logic.

Completed additions:

- preserve existing fields for backward compatibility
- canonical latest-answer-wins deduplication
- overall latest 150 unique questions
  - `summary.recent150_count`
  - `summary.recent150_accuracy`
- all-time unique final-state accuracy
  - `summary.unique_count`
  - `summary.unique_correct`
  - `summary.unique_accuracy`
- `summary.last_activity`
- whole-plan `skills[]` aggregation
  - latest 50 unique per skill
  - all-time unique accuracy per skill
  - completed / total / remaining
  - last activity per skill
- lesson and lesson-practice all-time unique accuracy fields

Validation completed against all 16 currently active plans.

Important compatibility rule:

- existing `summary.recent_count` / `summary.recent_accuracy` remain available for older consumers
- V2 overall UI should use `recent150_count` / `recent150_accuracy`
- skill recent values remain latest 50 unique questions

## Phase 2 — Student V2 parity check

Status: **DONE**

Student V2 already routes canonical stats through:

- `/students/shared/student-stats.js`
- `test-prep-stats-v1`
- `public.test_prep_plan_stats_v1(plan_id)`

The shared Student stats adapter now exposes the Phase 1 fields without creating a second calculation engine:

- overall recent 150
- all-time unique accuracy
- recent 50 per skill
- all-time unique skill accuracy
- last activity
- lesson / lesson-practice unique accuracy

Existing Student V2 display fields remain backward compatible.

## Phase 3 — Teacher group matrix backend

Status: **DONE**

Shared wrapper added:

- `public.test_prep_group_matrix_v1(group_id)`

Teacher edge endpoint added:

- `test-prep-teacher-matrix-v2?group_id=...`

The wrapper does **not** recalculate attempts. It calls the shared canonical plan bundle for each active plan in the group.

Matrix result per student includes:

- student identity
- plan id
- `skills[]` with recent 50 + all-time unique stats
- overall recent 150 + all-time unique stats
- current wrong counts
- last activity
- content snapshot status

The V2 browser adapter now exposes:

- `NaesinV2Data.loadGroupMatrix(groupId)`
- `NaesinV2Data.refreshGroupMatrix(groupId)`
- `NaesinV2Data.getCachedGroupMatrix(groupId)`
- `NaesinV2Data.invalidateGroupMatrix(groupId)`

Validation completed against a live active group with multiple students.

Rules retained:

- no raw attempt scan in the browser
- no duplicated dedupe logic
- group wrapper consumes the canonical shared stats engine

## Phase 4 — Teacher Naesin V2 main screen

Status: **DONE**

The skeleton has been replaced with the real active-test screen.

Implemented load sequence:

1. load active group/config/member shells from `test-prep-groups`
2. render test sections immediately
3. load the shared matrix bundle independently for each visible group
4. fill student rows as each group result arrives

Implemented UI:

- full-width active test sections
- school / term / exam / book / date / D-day header
- three-dot menu with `수정` / `보관` only
- student matrix with Korean skill labels
- recent 50 accuracy + sample count per skill
- recent 150 accuracy + sample count for overall
- large student-name drill-down button
- horizontal matrix scrolling on narrow screens
- per-group loading, retry, empty and error states
- dashboard-session group/matrix cache in `naesin-v2-data.js`

Teacher V2 only renders values from the shared backend. It does not derive accuracy from raw attempts.

The old Naesin V1 remains available side by side.

## Phase 5 — Shared student overview

Status: **DONE**

Shared overview wrapper added:

- `public.test_prep_student_overview_v1(plan_id)`

Teacher edge endpoint added:

- `test-prep-teacher-student-overview-v2?plan_id=...`

The wrapper reuses `test_prep_plan_stats_bundle_v1(plan_id)` for all accuracy, completion, lesson and wrong-count calculations. It adds only a backend 10-day activity count aggregate.

Implemented client flow:

- clicking a matrix student opens the fixed-size V2 detail modal
- modal remains the same size while tabs switch
- `요약` is live
- `활동` is live
- other tabs remain mounted as placeholders for their later phases
- student overview responses are cached per plan for the dashboard session

`요약` now shows:

- recent 150 accuracy + count
- all-time unique accuracy + count
- current wrong count
- active study days in the last 10 days
- recent 50 vs all-time accuracy for every skill
- completion counts per skill
- lesson recent vs all-time summary
- last activity

`활동` now shows:

- last 10 calendar days
- attempts per day
- total attempts
- active days
- line chart rendered client-side from backend counts

The client does not calculate accuracy or dedupe attempts.

## Phase 6 — 레슨 진도

Status: **DONE**

Uses the existing shared student overview / canonical stats bundle directly. No additional raw-attempt or content database call was added.

Implemented:

- lesson overview rows with completion ring graphs
- lesson title + available skill chips + inline metrics
- 완료 / 최근 / 전체 / 오답 shown on each lesson row
- clickable lesson rows
- expandable V1-style numbered practice journey
- practice-level completion bar
- practice-level 완료 / 최근 / 전체 metrics inline
- practice-level current wrong count when present
- mobile layout for lesson rows and expanded practice journey

Source data remains:

- `stats.lessons[]`
- `stats.lessons[].practices[]`
- `stats.review.lessons[]`

Snapshot totals and canonical accuracy calculations remain backend-owned.

## Phase 7 — 오답

Status: **DONE**

Reuses the existing canonical wrong-detail path on demand:

- `test_prep_question_state`
- `test_prep_review_stats_v1`
- `test-prep-teacher-wrong-detail`

Implemented in the student detail modal:

- current unresolved wrong-answer count and exact list
- question type distribution
- Korean + English question-type labels
- repeat-wrong count when historical repeat fields are available from the backend
- lesson / type metadata
- exact prompt and available context
- selected student answer
- correct answer
- session cache per student + plan

Print integration:

- `오답 프린트 편집` opens the existing standalone wrong-print editor with the current student and plan
- `PDF 만들기` uses the same existing wrong-print editor/PDF engine through an auto-PDF launch mode
- no second PDF engine was created in Naesin V2

The V2 browser does not recalculate wrong-state identity; it consumes the existing wrong-detail endpoint.

## Phase 8 — 문법 패턴

Status: **DONE**

`test-prep-grammar-tracking` was upgraded for V2 so grammar-target metrics follow the same recent/final-state interpretation as the canonical stats system instead of the old 3-day window.

Implemented metric rules:

- latest answer wins for the same question
- recent = latest 50 unique questions within that grammar target
- all-time = final state per unique question within that grammar target
- current wrong count comes from unresolved question state
- repeat wrong count comes from question-state wrong history

Implemented UI:

- target/pattern rows grouped by lesson
- recent unique accuracy + count
- all-time unique accuracy + count
- current wrong count
- repeat wrong count
- green / amber / pink accuracy colors
- pattern rows are clickable
- clicking a pattern reveals exact currently unresolved matching wrong questions
- grammar response cached per group + student for the dashboard session

The browser only renders the backend result. It does not scan attempts or calculate target accuracy locally.

## Phase 8.5 — V2 test management editor

Status: **DONE**

The create/edit/archive flow is deliberately isolated from the stats/rendering modules.

Current architecture after the R11.5 cleanup:

```text
Naesin V2 main screen
  ↓ only calls openCreate / openEdit / archive
naesin-v2-editor.js
  ↓ owns modal state, validation, student/book/scope UI
naesin-v2-editor-api.js
  ↓ owns network/catalog access only
  ├── teacher_admin → student roster
  ├── Content DB → books / lessons / available sections
  └── test-prep-groups-v2 → one save_group request
                         ↓
              public.test_prep_save_group_v2(...)
                         ↓ one PostgreSQL transaction
                 ├── test_prep_groups.scope
                 │    ├── lessons[]
                 │    └── external_passages[]
                 ├── upsert active student plans
                 └── deactivate removed student plans
```

Save rules:

- create and edit use the same `save_group` endpoint
- the browser sends textbook lessons and external passages together in one payload
- there is no second `set_external_passages` write in the V2 editor path
- the Edge Function performs authentication / teacher ownership checks and remains a thin wrapper
- `public.test_prep_save_group_v2(...)` is service-role only and owns normalization + the atomic group/plan mutation
- `(group_id, student_id)` is unique for grouped test-prep plans, enabling deterministic plan upsert
- if any plan write fails, the group/scope mutation rolls back with it
- the browser only checks the returned saved scope; verification never performs another write
- assignments remain separate in `test-prep-assignments-v2` because homework/task delivery is a different domain

Validation:

- live save verified with an attached Mars 외부지문
- the same external passage is present in `test_prep_groups.scope.external_passages`
- all active member plans include the external passage in their `units`
- a forced foreign-key failure was tested and the group/scope change rolled back successfully

Styling remains isolated in:

- `naesin-v2-editor.css`

The editor does **not** know how stats are calculated and the matrix does **not** know how forms are saved.

Implemented UI/functionality:

- `+ 시험 대비 추가` opens the real V2 editor
- `수정` opens the same editor with school/date/term/exam/book/student/scope values prefilled
- student roster stays hidden until the teacher types in the search field
- book picker from the content catalog
- lesson + section scope controls based on actual usable question coverage
- optional external passages alongside the main textbook
- archive confirmation
- archiving preserves historical records while deactivating the group, active plans, and active tasks
- save/archive invalidates V2 caches and refreshes the matrix
- no inline styling in the editor

Legacy note:

- the older `test-prep-groups` endpoint remains available for V1 / rollback compatibility until Phase 9
- Naesin V2 editor mutations no longer use its `create_group`, `update_group`, or `set_external_passages` paths

## Phase 9 — Simplify old teacher endpoints

Status: **NEXT**

Only after V2 is verified:

- remove raw-attempt aggregation from the Teacher V2 path
- make `teacher_groups` configuration-focused
- stop using `test-prep-teacher-insights` for calculations already supplied by the shared stats core

Do not remove V1 dependencies until rollback is no longer needed.

## Phase 10 — Cross-surface parity test

For the same student + plan, Teacher V2 and Student V2 must show identical values for:

- recent 150 overall
- all-time unique accuracy
- recent 50 per skill
- all-time skill accuracy
- lesson progress
- practice progress
- canonical wrong counts

If they disagree, fix the backend source of truth. Do not patch either UI with local calculation logic.

## Later feature notes — print + AI

Keep these out of the core metric phases until the shared data paths are stable, but leave room in the UI/modules for them.

### More print options

Potential later additions:

- print only selected wrong-answer types
- print only selected lessons / grammar patterns
- choose number of questions
- choose worksheet difficulty / amount of writing space
- include or exclude answers, metadata, Korean support, and explanations
- combine unresolved wrong questions with fresh similar practice
- teacher presets for common print formats
- direct PDF should continue to reuse the standalone print engine rather than creating a second renderer

### AI-assisted teacher options

Potential later additions:

- explain why a student is repeatedly missing a grammar pattern
- summarize the most important weaknesses from actual tracked evidence
- suggest a short targeted lesson / homework set
- generate fresh practice based on selected wrong questions or grammar targets
- generate parent-facing summaries from the same numbers
- AI output must remain advisory and must not silently change stored scores, canonical stats, or wrong-state data

## Architecture rule

The permanent direction is:

```text
Content DB
  ↓
test_prep_content_snapshot_v1
  ↓
canonical identity / aliases
  ↓
test_prep_plan_stats_v1
  ↓
shared thin wrappers
  ├── Student V2
  └── Teacher Naesin V2
```

One calculation engine. Multiple views.
