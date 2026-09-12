# Naesin V2 Module — Build Specification

## 1. Purpose

Naesin V2 is the replacement teacher-facing exam-prep module inside Teacher Dashboard V2.

The module should preserve the working data flows from the current Naesin implementation while replacing the existing patch-heavy UI with a clean, isolated V2 implementation.

The visual and interaction source of truth is `UX_UI_GUIDE.html`. That file is a UX/UI guide only. It contains fake data and prototype logic. Production code must not be copied as one monolithic file.

## 2. Core Product Principles

1. **Numbers first** — show real counts, percentages, dates, attempts, and wrong-answer data. Avoid interpretive labels such as “Needs attention” or “Strong”.
2. **Korean teacher UI** — teacher-facing skill labels should be Korean. Wrong-type views should show Korean + English where useful.
3. **Fast drill-down** — main page → student → lesson / wrong answers / grammar pattern, without unnecessary intermediate screens.
4. **Stable layout** — student detail modal uses a fixed viewport size. Switching tabs must not resize or jump the modal.
5. **No patch architecture** — do not monkey-patch `fetch`, depend on MutationObserver repair logic, or layer V2 on top of the V1 DOM. V2 should mount and own its UI cleanly.

## 3. Module Structure

```text
Teachers/dashboard-v2/naesin-v2/
├── SPEC.md
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

**`naesin-v2-data.js`** — API access, data normalization, recent-question calculations, canonical question deduplication, lesson/skill aggregates.

**`naesin-v2-editor.js`** — add test, edit test, student picker, textbook selector, lesson/section scope editor, archive test.

**`naesin-v2-student-detail.js`** — fixed-size student modal, summary, wrong answers, activity, grammar patterns, tab state.

**`naesin-v2-lesson-journey.js`** — lesson overview rings, lesson click-through, V1-style activity journey, completion/recent/total metrics.

**`naesin-v2-print.js`** — bridge from student wrong answers to the existing wrong-print editor/direct-PDF flow.

## 4. Existing Backend / Data Sources

### Tracking Supabase

Project: `fiieuiktlsivwfgyivai`

Reuse current Dashboard V2 endpoints where possible:

- `test-prep-groups`
- `test-prep-teacher-insights`
- `test-prep-teacher-wrong-detail`

### Content Supabase

Project: `gxwfsqxyuufqtitspfqg`

Used for books, units/lessons, test prep questions, source content occurrences, section availability, and lesson totals.

### Students

Reuse the current authenticated student-list route:

`/.netlify/functions/teacher_admin?action=list_students`

## 5. Main Naesin Page

### Header

Show:

- `내신`
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

## 6. Add / Edit Test Flow

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

## 7. Main Student Matrix

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

For each skill use the latest **50 unique questions**. Repeated attempts on the same question collapse to one, with the newest attempt winning.

Question identity:

1. `canonical_id`
2. fallback `question_id`

So wrong → later right counts right only, and right → later wrong counts wrong only.

### Overall recent accuracy

Use the latest **150 unique questions globally**, with the same newest-attempt-wins deduplication rule. This is not time-based recency.

## 8. Student Detail Modal

The modal has a fixed footprint so tabs do not resize it.

Desktop target is around `1120px` wide and `88vh` tall; only the inner body scrolls.

Header shows student name, school, exam, textbook, and close button.

Tabs:

- 요약
- 오답
- 활동
- 레슨 진도
- 문법 패턴

## 9. 요약 Tab

Numeric KPI cards should include recent accuracy, total accuracy, wrong count, and active practice days in the last 10 days.

First major chart is a line chart for the last 10 days, with x-axis labels like `Fri 9/11` and counts above non-zero points.

Skill comparison shows `최근 50` vs `전체`.

## 10. 오답 Tab

Top actions:

- `오답 프린트 편집`
- `PDF 만들기`

Production should connect these to the existing wrong-print flow instead of rebuilding PDF rendering in Naesin V2.

Wrong summary shows current wrong count, repeat-wrong count, and wrong-type count.

Wrong-type rows show Korean label, English/raw label beneath, count, and proportional bar.

Exact wrong questions show lesson/skill metadata, prompt, context when available, choices when applicable, student answer, correct answer, and wrong count.

## 11. 활동 Tab

Show a 10-day line chart, total attempts, active days, and recent activity counts. Avoid unnecessary decorative charts.

## 12. 레슨 진도 Tab

Each lesson is a horizontal row using a circular ring, lesson title, skill chips, 최근, 전체, and 오답.

All stats stay inline with the ring. Do not show `고유 문제` text. Use horizontal separators between lessons, not vertical connector lines, and allow generous vertical spacing.

Each lesson row is clickable and opens its lesson journey.

## 13. Lesson Journey

This intentionally follows the current V1 Naesin lesson journey because that interaction is already approved.

For each available practice type show, in order:

1. 단어 학습
2. 어휘 문제
3. 의사소통
4. 문법
5. 독해
6. 서술형

Only show practices actually available for the lesson.

Keep metrics inline:

- 완료
- 최근
- 전체

Completion includes numerator/denominator where available. Use the V1-style numbered circular journey inside the cleaner V2 visual system.

## 14. 문법 패턴 Tab

Show a table with 패턴, 최근, 전체, 오답.

Pattern rows are clickable. Clicking a grammar pattern reveals the student’s wrong questions for that exact pattern, including prompt, lesson, selected answer, correct answer, and repeat wrong count when available.

## 15. Label Rules

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

## 16. Accuracy / Deduplication Rules

Centralize this logic in `naesin-v2-data.js`.

Unique question key:

```js
canonical_id || question_id
```

Latest-answer rule:

1. group by unique question key
2. keep newest attempt only
3. calculate accuracy from those final states

Recent 50 by skill:

1. dedupe by question
2. sort latest unique states newest-first
3. take latest 50
4. calculate accuracy

Recent overall:

1. dedupe globally by question
2. sort newest-first
3. take latest 150
4. calculate accuracy

All-time accuracy should also use one final state per unique question unless a view explicitly states otherwise.

## 17. Responsive Behavior

Desktop is primary, but mobile must remain usable.

- matrix horizontally scrolls rather than crushing columns
- student modal remains fixed to viewport
- lesson stats remain inline where practical
- lesson-journey metrics remain inline
- editor becomes one-column on narrow screens
- buttons retain touch-sized hit areas

## 18. Visual Rules

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

## 19. Printing Integration

Naesin V2 should not create a second PDF engine.

Use the existing wrong-print editor/direct-PDF path.

The student 오답 tab should be able to pass student id, exam/group id, selected wrong questions or all current wrong questions, and lesson/skill filters where applicable.

## 20. Migration Strategy

Do not rewrite V1 in place.

Recommended sequence:

1. build V2 in isolated folder
2. reuse current API endpoints
3. reproduce add/edit flow
4. build active test matrix
5. build student detail shell
6. add summary/activity
7. add wrong answers
8. add lesson progress
9. copy approved V1 lesson-journey behavior into the clean V2 module
10. add grammar-pattern drill-down
11. wire print actions
12. switch Dashboard V2 navigation to V2
13. leave old Naesin code temporarily for rollback
14. remove patch modules only after V2 is verified

## 21. Non-Goals

Do not build a second content database, rebuild the wrong-print PDF engine, add teacher interpretation labels, add unnecessary test-menu options, add fetch interception, add mutation-observer repair scripts, or copy the prototype into production as one file.

## 22. Acceptance Criteria

Naesin V2 is ready when:

- active tests load from real data
- add test works
- edit test works
- archive works
- matrix shows real recent skill stats
- overall recent uses latest 150 unique questions
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

## 23. UX/UI Reference

`UX_UI_GUIDE.html` is the approved visual prototype as of 2026-09-12.

It contains fake data and fake actions in places. Treat it as layout, interaction, spacing, typography, color, and border reference. Do not treat its fake data or one-file JavaScript structure as production architecture.
