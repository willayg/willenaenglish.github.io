# PROGRESS_ARCHITECTURE.md — Canonical Study Progress Rules

## AI: read this before changing progress, scoring, study recording, teacher reports, or parent reports

This file is an architectural constraint, not a suggestion.

The central rule is:

> **Student, teacher, and parent apps must never calculate progress independently. They must all consume the same canonical scoring and progress results.**

If two Willena surfaces show different numbers for the same student and content, the implementation is wrong.

---

## 1. Required system shape

```text
Student answers activity
        ↓
Shared Activity Scorer
        ↓
Study Recording API
        ↓
Immutable Raw Attempt
        ↓
Shared Progress Engine
        ↓
Mastery / Unit / Skill summaries
        ↓
 ┌──────────┬──────────┬──────────┐
 Student    Teacher     Parent
 dashboard  report      report
```

There are two shared sources of truth:

1. **Canonical scoring** — one scorer determines correctness/score.
2. **Canonical progress calculation** — one progress engine determines mastery and summaries.

Client apps are presentation layers. They do not invent their own formulas.

---

## 2. Raw attempts are permanent evidence

Every submitted answer must create an immutable attempt record in the Operational / Game Scores database.

At minimum preserve:

- student ID
- session ID
- book ID
- unit ID
- skill
- response/activity type
- canonical content type
- canonical content ID
- source occurrence ID when available
- runtime activity ID
- prompt/stimulus snapshot
- student answer snapshot
- correct answer snapshot
- score
- is_correct
- response time
- attempt number
- hint/retry metadata
- created timestamp
- `scoring_version`
- `progress_version`

### Why snapshots matter

Content in the Content DB may be corrected later. Historical reports must still be able to answer:

> What did the student actually see and answer at that time?

Do not overwrite historical attempts when curriculum content changes.

---

## 3. Raw attempts are the rebuildable source of truth

Summary/mastery rows are derived data for fast reporting.

If summary data becomes corrupted or the algorithm changes, Willena must be able to rebuild it from raw attempts.

Therefore:

> **Never make mastery or progress-summary tables the only record of student performance.**

---

## 4. Required progress layers

### A. Content mastery

Mastery is specific to both content and skill.

Examples:

```text
"tortoise" + vocabulary = 100%
"tortoise" + spelling   = 80%
"be going to" + grammar = 65%
```

The same content item may have different mastery values for different skills.

### B. Skill × unit progress

Example:

```text
English Bus 6 · Unit 3
Vocabulary       92%
Spelling         76%
Grammar          68%
Sentence Builder 81%
Conversation     73%
Listening        87%
```

### C. Unit / book summaries

Example:

```text
Unit 3 overall: 79%
Practiced: 54 activities
Needs review: 6 content items
```

Student, teacher and parent apps must read these same canonical summaries.

---

## 5. Accuracy is not mastery

Do not use raw percentage correct as the mastery score.

Keep separate concepts such as:

```text
accuracy = correct attempts / total attempts
mastery  = evidence-based estimate of current command of the content
```

A student who gets an item wrong repeatedly and then answers it correctly once must not instantly become 100% mastered.

V1 mastery should remain simple, explainable and deterministic.

Desired properties:

- recent attempts matter more than old attempts;
- repeated correct performance raises mastery;
- repeated incorrect performance lowers mastery;
- one lucky answer cannot create full mastery;
- excessive repetition of one item must not dominate an entire unit;
- unattempted material is **Not studied**, not 0% mastery;
- calculations must be deterministic for the same input attempts and version.

Do not add opaque AI-generated mastery scores.

---

## 6. Version all calculations

Every recorded attempt must identify the scorer/progress formula versions used.

Initial names may be similar to:

```text
scoring_version = "activity-v1"
progress_version = "study-v1"
```

If the algorithm changes later, bump the version rather than silently changing the meaning of historical data.

Teacher/parent/student reports must be able to distinguish historical calculations if necessary.

---

## 7. Proposed operational tables

The Operational / Game Scores database should own student activity history and derived progress.

Expected conceptual tables:

### `study_sessions`

One practice session.

Likely fields:

- id
- student_id
- book_id
- unit_id
- started_at
- completed_at
- practice_mode / skill context
- summary metadata

### `study_attempts`

Immutable answer evidence.

Likely fields include all fields listed in section 2.

### `student_content_mastery`

Fast current-state lookup by student + content + skill.

Likely fields:

- student_id
- content_type
- content_id
- skill
- attempts
- correct_attempts
- accuracy
- mastery_score
- last_seen_at
- next_review_at
- progress_version

### `student_unit_progress`

Fast skill/unit summary.

Likely fields:

- student_id
- book_id
- unit_id
- skill
- attempted_content_count
- mastered_content_count
- accuracy
- mastery_score
- attempts
- last_practiced_at
- progress_version

Exact schema may evolve, but these ownership boundaries must remain.

---

## 8. Content DB vs Operational DB ownership

### Content DB owns

What can be learned/asked:

- books
- units
- lexical entries
- patterns
- sentences
- dialogues
- activities
- content metadata

### Operational DB owns

Who did what:

- study sessions
- attempts
- mastery
- unit summaries
- student/class assignment context

Do not copy whole curriculum rows into the Operational DB.

Use stable Content DB UUIDs as references, plus immutable prompt/answer snapshots on attempts for audit history.

---

## 9. Recording API rule

Student-facing recording must use the existing persistent Willena authenticated gateway/session architecture.

Do not create a new temporary-token-only recording path.

Do not require the Study app, teacher app and parent app to coordinate calculations in the browser.

The server-side recording/progress layer should own:

1. identity verification;
2. attempt persistence;
3. canonical score acceptance/verification where appropriate;
4. progress recalculation/update;
5. summary output.

---

## 10. Shared Activity Scorer rule

Study must continue using the shared Willena Activity Engine/scoring primitives.

Do not implement a second study-only answer scorer merely for progress recording.

Where assessment-specific rules differ from practice rules, keep orchestration separate while sharing the low-level normalization/scoring primitives whenever possible.

---

## 11. Preview/Admin override must never record progress

The staging Study app has an admin/QA book-preview override for testing different curriculum levels.

This mode must never mutate real student progress.

Required behavior:

```text
real assigned curriculum → recording ON
admin preview override   → recording OFF
```

The UI should clearly indicate when preview mode is active, for example:

```text
PREVIEW — progress not recorded
```

Do not allow preview activity attempts to enter `study_attempts`, mastery, streaks, parent reports, teacher reports, recommendations or spaced-review history.

This is a hard safety boundary.

---

## 12. Student view

The student-facing app may show simplified progress, but the numbers must come from canonical summaries.

Example:

```text
Unit 3 · Camping
Overall 81%

Vocabulary       91%
Spelling         74%
Grammar          67%

Needs practice
- sleeping bag
- simple past
```

The student app may use this same canonical data later for weak-item/spaced-review selection.

---

## 13. Teacher view

Teachers need the same underlying calculations with more detail.

Expected drilldown:

```text
Class
  ↓
Student
  ↓
Book
  ↓
Unit
  ↓
Skill / content item / attempt history
```

Useful fields:

- mastery
- accuracy
- attempts
- last practiced
- exact weak content
- recent attempts
- current progress version

The teacher application must not reimplement mastery calculations in JavaScript.

---

## 14. Parent view

Parent reports should consume the same summary data but present it more simply.

Example:

```text
English Bus 6 · Unit 3
Overall progress: 81%

Strong
✓ Vocabulary
✓ Listening

Keep practicing
• Grammar
• Spelling
```

Do not create a separate parent-specific progress formula.

---

## 15. Future adaptive study

Canonical mastery can later drive question selection.

A possible future mixture is:

```text
40% current-unit material
30% weak material
20% spaced review
10% challenge
```

This is selection/orchestration, not a different mastery system.

Any adaptive selector must consume canonical progress data rather than maintaining a private competing score.

---

## 16. Consistency requirements

For any given student/content/version:

- student-facing mastery must equal teacher-facing mastery;
- teacher-facing mastery must equal parent-facing mastery;
- accuracy must be computed from the same raw attempts;
- identical raw attempts + identical `progress_version` must produce identical summaries;
- client refresh/device/browser must not change calculated results;
- preview attempts must be excluded completely.

Prefer server-side/database calculation or a single shared progress module invoked by the server rather than duplicated browser formulas.

---

## 17. Implementation sequence

When implementing progress, do it in this order:

1. define immutable attempt schema;
2. define versioned canonical mastery formula;
3. create recording API using persistent auth;
4. wire Study `onAnswer` into recording;
5. explicitly block recording in preview mode;
6. update/rebuild mastery and unit summaries from attempts;
7. expose one canonical progress read API;
8. show progress in Student Study;
9. make teacher reporting consume the same API/data;
10. make parent reporting consume the same API/data.

Do not build teacher or parent progress calculations before the canonical attempt/progress layer exists.

---

## 18. Before changing this architecture

An AI or developer should not casually replace these rules for convenience.

Before changing the progress model, verify that the proposed change preserves:

- one canonical scorer;
- one canonical progress calculation;
- immutable raw evidence;
- rebuildable summaries;
- versioned formulas;
- identical student/teacher/parent numbers;
- Content DB / Operational DB ownership separation;
- no recording during admin preview.

If a proposed implementation violates one of those guarantees, redesign it before coding.
