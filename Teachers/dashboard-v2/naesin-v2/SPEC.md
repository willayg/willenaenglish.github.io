# Naesin V2 Module — Build Specification

## 1. Purpose

Naesin V2 is the replacement teacher-facing exam-prep module inside Teacher Dashboard V2.

The module should preserve the working data flows from the current Naesin implementation while replacing the existing patch-heavy UI with a clean, isolated V2 implementation.

The visual and interaction source of truth is `UX_UI_GUIDE.html`. That file is a UX/UI guide only. It contains fake data and prototype logic. Production code must not be copied as one monolithic file.

Naesin V2 must share the same canonical backend calculations as Student V2. Teacher and student surfaces should be different views over the same stats engine, not separate calculation systems.

See also `BUILD_ORDER.md` for the implementation sequence.

## 2. Core Product Principles

1. **Numbers first** — show real counts, percentages, dates, attempts, and wrong-answer data. Avoid interpretive labels such as “Needs attention” or “Strong”.
2. **Korean teacher UI** — teacher-facing skill labels should be Korean. Wrong-type views should show Korean + English where useful.
3. **Fast drill-down** — main page → student → lesson / wrong answers / grammar pattern, without unnecessary intermediate screens.
4. **Stable layout** — student detail modal uses a fixed viewport size. Switching tabs must not resize or jump the modal.
5. **No patch architecture** — do not monkey-patch `fetch`, depend on MutationObserver repair logic, or layer V2 on top of the V1 DOM. V2 should mount and own its UI cleanly.
6. **One calculation engine** — Student V2 and Teacher Naesin V2 use the same backend accuracy, recency, deduplication, lesson, and skill calculations.
7. **Client renders; backend calculates** — the browser should not download large attempt sets and recreate stats logic.

## 3. Module Structure

```text
Teachers/dashboard-v2/naesin-v2/
├── SPEC.md
├── BUILD_ORDER.md
├── UX_UI_GUIDE.html
├── naesin-v2.js
├── naesin-v2.css
├── naesin-v2-data.js
├── naesin-v2-editor.js
├── naesin-v2-student-detail.js
├── naesin-v2-lesson-journey.js
└── naesin-v2-print.js
```

### Responsibilities

**`naesin-v2.js`** — module mount, top-level state, event wiring, active test rendering, open/close lifecycle.

**`naesin-v2.css`** — all module styles and responsive rules. Avoid production dependence on inline layout styles.

**`naesin-v2-data.js`** — API access, request orchestration, client-side response cache, loading/error state. It must not own canonical accuracy or deduplication calculations.

**`naesin-v2-editor.js`** — add test, edit test, student picker, textbook selector, lesson/section scope editor, archive test.

**`naesin-v2-student-detail.js`** — fixed-size student modal, summary, wrong answers, activity, grammar patterns, tab state.

**`naesin-v2-lesson-journey.js`** — lesson overview rings, lesson click-through, V1-style activity journey, completion/recent/total rendering.

**`naesin-v2-print.js`** — bridge from student wrong answers to the existing wrong-print editor/direct-PDF flow.

## 4. Shared Backend Architecture

### Tracking Supabase

Project: `fiieuiktlsivwfgyivai`

The permanent source-of-truth path is:

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

### Canonical shared stats function

`public.test_prep_plan_stats_v1(plan_id)` is the shared calculation engine.

It must remain usable by both student and teacher surfaces. Do not clone its calculations into teacher-only or student-only functions.

Current shared outputs include:

- content snapshot status
- summary completion
- lesson completion
- lesson-practice completion
- lesson recent accuracy
- practice recent accuracy
- review/wrong-state bundle through `test_prep_plan_stats_bundle_v1`

As of 2026-09-12 the shared stats core has also been extended with:

### Summary fields

- `recent150_count`
- `recent150_accuracy`
- `unique_count`
- `unique_correct`
- `unique_accuracy`
- `last_activity`

### Whole-plan skill fields

`skills[]` now provides each practice type with:

- `total`
- `completed`
- `remaining`
- `recent_count` — latest 50 unique for that skill
- `recent_accuracy`
- `unique_count`
- `unique_correct`
- `unique_accuracy`
- `last_activity`

### Lesson / practice fields

Lesson and lesson-practice stats also expose final-state unique accuracy fields so Teacher V2 and Student V2 can display the same totals.

### Backward compatibility

Existing fields remain available for older consumers.

- legacy `summary.recent_count` / `summary.recent_accuracy` remain present
- V2 overall UI should use `summary.recent150_count` / `summary.recent150_accuracy`
- V2 skill recent values use latest 50 unique questions

Do not silently reinterpret the old summary fields in existing consumers.

## 5. Content Snapshot / Identity Layer

### Content Supabase

Project: `gxwfsqxyuufqtitspfqg`

Content is synchronized into tracking through `test_prep_content_snapshot_v1`.

The snapshot stores:

- unit identity
- book identity
- practice IDs
- totals
- lexical identity map
- content revision
- sync time
- unit type

Teacher V2 should not query the content project directly for normal dashboard rendering.

### Question identity

Canonical identity resolution belongs on the backend.

Current resolution path includes:

1. `attempt.canonical_id`
2. `test_prep_identity_aliases_v1`
3. lexical mapping where applicable
4. fallback `question_id`

The browser must not recreate alias resolution.

## 6. Accuracy / Deduplication Rules

These rules are backend rules shared by Student V2 and Teacher V2.

### Latest-answer rule

For a unique question:

1. collect all attempts for the scoped plan
2. resolve canonical identity
3. keep the newest attempt
4. use that final state for accuracy

So:

- wrong → later right = right
- right → later wrong = wrong

### Recent 50 by skill

For a given practice type:

1. resolve canonical identities
2. keep the newest attempt per unique question
3. sort those final states newest-first
4. take latest 50
5. calculate accuracy

### Recent overall

For the whole test-prep plan:

1. resolve canonical identity
2. dedupe globally by canonical question
3. keep newest final state
4. sort newest-first
5. take latest 150
6. calculate accuracy

This is not time-based recency.

### All-time unique accuracy

All-time accuracy uses one latest final state per unique canonical question.

The UI must not calculate this independently.

## 7. Existing Endpoints / Services

Reuse where suitable:

- `test-prep-groups`
- `test-prep-stats-v1`
- `test-prep-teacher-wrong-detail`
- `test-prep-grammar-tracking`
- `test_prep_plan_stats_v1`
- `test_prep_plan_stats_bundle_v1`
- `test_prep_review_stats_v1`

### Teacher matrix wrapper

Phase 3 added the thin teacher matrix path:

- RPC: `public.test_prep_group_matrix_v1(group_id)`
- Edge endpoint: `test-prep-teacher-matrix-v2?group_id=...`

The wrapper does not perform its own accuracy, recency, or deduplication calculations. For every active plan in the group it consumes the shared `test_prep_plan_stats_bundle_v1` result and returns matrix-ready fields.

Returned member data includes:

- student identity
- plan id
- `summary` including recent 150 and all-time unique accuracy
- `skills[]` including recent 50 and all-time unique skill accuracy
- canonical review counts
- last activity
- content snapshot state

`naesin-v2-data.js` calls this endpoint and may cache the response in memory for the current dashboard session.

`test-prep-teacher-insights` contains useful legacy behavior but should not remain the canonical calculation path for V2 because it performs live attempt/content aggregation that now overlaps the shared snapshot/RPC system.

### Students

Reuse the current authenticated student-list route where appropriate:

`/.netlify/functions/teacher_admin?action=list_students`

## 8. Loading / Data Ownership

### Main dashboard

Load in layers:

1. group/config/member data
2. render visible test shells
3. load matrix-ready stats per group through `test-prep-teacher-matrix-v2`
4. fill rows as group results arrive

### Student detail

Load heavy data on demand:

- 요약 — shared stats bundle
- 활동 — backend daily aggregate
- 레슨 진도 — shared lesson/practice stats
- 오답 — on-demand exact wrong details
- 문법 패턴 — on-demand grammar-target details

### Client cache

`naesin-v2-data.js` keeps an in-memory group-matrix cache and may later add caches for detail views.

Current matrix API:

- `NaesinV2Data.loadGroupMatrix(groupId)`
- `NaesinV2Data.refreshGroupMatrix(groupId)`
- `NaesinV2Data.getCachedGroupMatrix(groupId)`
- `NaesinV2Data.invalidateGroupMatrix(groupId)`

This cache is for avoiding repeat requests only. It is not a source of truth and must not contain duplicated stats logic.

## 9. Main Naesin Page

### Header

Show:

- `내신 V2`
- `진행 중인 시험`
- `+ 시험 대비 추가`

Add button style from UX guide: white fill, pink text, cyan border, strong rounded container.

### Active Test Sections

Each active exam is a full-width bordered section, not a floating card per student.

Header contains school, term, exam type, textbook, exam date, D-day, and a three-dot menu.

Three-dot menu contains only:

- `수정`
- `보관`

### Archive behavior

Archive removes the test from the active list but preserves all historical student data. Require confirmation.

## 10. Add / Edit Test Flow

Preserve the current Dashboard V2 flow.

Use the same modal for `새 시험 대비` and `시험 대비 수정`.

Fields:

1. 학교
2. 시험일
3. 학기 — 1학기 / 2학기
4. 시험 — 중간고사 / 기말고사
5. 학생 — searchable list with checkboxes
6. 교재
7. 시험 범위 — lesson rows with selectable section chips

Clicking a lesson heading toggles all available sections for that lesson. Only show sections actually available in the content database.

Edit mode preloads school, exam date, term, exam type, assigned students, textbook, and lesson/section scope.

Do not save unless school and date exist, at least one student is selected, and at least one lesson/section is selected.

## 11. Main Student Matrix

Columns:

- 학생
- 단어 학습
- 어휘 문제
- 문법
- 본문
- 의사소통
- 독해
- 서술형
- 전체 최근

Student name is the main drill-down target: white fill, thicker subtle border, rounded button, cyan chevron.

### Skill statistics

Each skill displays the shared backend `skills[].recent_accuracy` and `skills[].recent_count`, based on latest 50 unique questions.

### Overall recent accuracy

Display shared backend `summary.recent150_accuracy` and `summary.recent150_count`.

Do not calculate either value in the browser.

## 12. Student Detail Modal

The modal has a fixed footprint so tabs do not resize it.

Desktop target is around `1120px` wide and `88vh` tall; only the inner body scrolls.

Header shows student name, school, exam, textbook, and close button.

Tabs:

- 요약
- 오답
- 활동
- 레슨 진도
- 문법 패턴

## 13. 요약 Tab

Numeric KPI cards should include:

- recent 150 accuracy
- all-time unique accuracy
- wrong count
- active practice days in the last 10 days

First major chart is a line chart for the last 10 days, with x-axis labels like `Fri 9/11` and counts above non-zero points.

Skill comparison shows shared backend `최근 50` vs `전체` unique accuracy.

## 14. 오답 Tab

Top actions:

- `오답 프린트 편집`
- `PDF 만들기`

Production should connect these to the existing wrong-print flow instead of rebuilding PDF rendering in Naesin V2.

Wrong summary shows current wrong count, repeat-wrong count, and wrong-type count.

Wrong-type rows show Korean label, English/raw label beneath, count, and proportional bar.

Exact wrong questions show lesson/skill metadata, prompt, context when available, choices when applicable, student answer, correct answer, and wrong count.

Wrong-state logic should come from the canonical backend review/question-state layer, not inferred from client-side attempt arrays.

## 15. 활동 Tab

Show a 10-day line chart, total attempts, active days, and recent activity counts.

The backend should return daily aggregates. The client only renders the chart.

## 16. 레슨 진도 Tab

Each lesson is a horizontal row using a circular ring, lesson title, skill chips, 최근, 전체, and 오답.

All stats stay inline with the ring. Do not show `고유 문제` text. Use horizontal separators between lessons, not vertical connector lines, and allow generous vertical spacing.

Each lesson row is clickable and opens its lesson journey.

Lesson/practice calculations come from the shared stats bundle.

## 17. Lesson Journey

This intentionally follows the current V1 Naesin lesson journey because that interaction is already approved.

For each available practice type show, in order:

1. 단어 학습
2. 어휘 문제
3. 의사소통
4. 문법
5. 본문
6. 독해
7. 서술형

Only show practices actually available for the lesson.

Keep metrics inline:

- 완료
- 최근
- 전체

Completion includes numerator/denominator where available. Use the V1-style numbered circular journey inside the cleaner V2 visual system.

## 18. 문법 패턴 Tab

Show a table with 패턴, 최근, 전체, 오답.

Pattern rows are clickable. Clicking a grammar pattern reveals the student’s wrong questions for that exact pattern, including prompt, lesson, selected answer, correct answer, and repeat wrong count when available.

`test-prep-grammar-tracking` can be reused, but V2 should align its recency definitions with the shared canonical rules instead of the legacy 3-day definition.

## 19. Label Rules

| Internal key | UI label |
|---|---|
| `vocabulary` | 단어 학습 |
| `vocab_test` | 어휘 문제 |
| `grammar` | 문법 |
| `sentences` | 본문 |
| `communication` | 의사소통 |
| `reading` | 독해 |
| `constructed_response` | 서술형 |

`sentences` must display as `본문`. Avoid old `본문외우기` in the new main UI. Wrong-type names may show Korean + English.

## 20. Responsive Behavior

Desktop is primary, but mobile must remain usable.

- matrix horizontally scrolls rather than crushing columns
- student modal remains fixed to viewport
- lesson stats remain inline where practical
- lesson-journey metrics remain inline
- editor becomes one-column on narrow screens
- buttons retain touch-sized hit areas

## 21. Visual Rules

Use `UX_UI_GUIDE.html` as the visual source of truth.

Core visual language:

- white surfaces
- thicker cyan/light-cyan borders
- pink for recent/action emphasis
- purple for overall accuracy
- cyan for structure/progress
- rounded corners
- larger teacher-readable type
- restrained shadows
- avoid dense admin-dashboard styling

Containers should have visibly stronger borders than table separators.

## 22. Printing Integration

Naesin V2 should not create a second PDF engine.

Use the existing wrong-print editor/direct-PDF path.

The student 오답 tab should be able to pass student id, exam/group id, selected wrong questions or all current wrong questions, and lesson/skill filters where applicable.

## 23. Build / Migration Strategy

The authoritative sequence is maintained in `BUILD_ORDER.md`.

High-level order:

1. shared stats core — DONE
2. Student V2 parity check — DONE
3. teacher group matrix wrapper — DONE
4. real Naesin V2 main screen — NEXT
5. shared student overview
6. lesson progress
7. wrong answers
8. grammar patterns
9. simplify duplicated legacy teacher calculations
10. cross-surface parity test

Do not rewrite V1 in place. Existing Naesin remains available side by side while V2 is built and verified.

## 24. Non-Goals

Do not:

- build a second content database
- clone the canonical stats calculations for teachers
- clone the canonical stats calculations for students
- rebuild the wrong-print PDF engine
- add teacher interpretation labels
- add unnecessary test-menu options
- add fetch interception
- add mutation-observer repair scripts
- copy the prototype into production as one file
- calculate recent/all-time accuracy from raw attempts in the browser

## 25. Acceptance Criteria

Naesin V2 is ready when:

- active tests load from real data
- add test works
- edit test works
- archive works
- matrix shows real shared-backend recent skill stats
- overall recent uses shared-backend latest 150 unique questions
- Teacher V2 and Student V2 show the same values for the same plan
- clicking a student opens a fixed-size modal
- all five tabs render real student data
- wrong types show Korean + English
- exact wrong questions are viewable
- grammar patterns drill into matching wrong questions
- lesson overview uses ring rows
- lesson rows drill into V1-style journey
- wrong-answer print editor opens with correct student/test context
- direct PDF works
- no V1 patch scripts are required for V2 to function
- mobile remains usable
- UI matches `UX_UI_GUIDE.html` closely

## 26. Current Shared-Core Status

Phases 1–3 of `BUILD_ORDER.md` are complete.

Current verified shared path:

```text
Student / Teacher plan
  ↓
public.test_prep_plan_stats_v1
  ↓
public.test_prep_plan_stats_bundle_v1
  ↓
Student V2 shared adapter
  or
public.test_prep_group_matrix_v1
  ↓
test-prep-teacher-matrix-v2
  ↓
NaesinV2Data.loadGroupMatrix()
```

The teacher matrix wrapper was validated against a live active group containing multiple students and returned shared-backend skill, recent-150, unique-accuracy, wrong-count, and last-activity values.

The next build phase is the real Teacher Naesin V2 main screen.

## 27. UX/UI Reference

`UX_UI_GUIDE.html` is the approved visual prototype as of 2026-09-12.

It contains fake data and fake actions in places. Treat it as layout, interaction, spacing, typography, color, and border reference. Do not treat its fake data or one-file JavaScript structure as production architecture.
