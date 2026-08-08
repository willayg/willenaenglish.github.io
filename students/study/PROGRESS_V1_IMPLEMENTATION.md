# Study Progress V1 — Implemented Contract

Read `PROGRESS_ARCHITECTURE.md` first. This file records the concrete V1 implementation so future apps and coding agents do not recreate the calculations differently.

## Canonical versions

```text
scoring_version  = activity-v1
progress_version = study-v1
```

Do not change the meaning of either version in place. A formula/scoring change requires a new version.

## Operational DB tables

The Operational / Game Scores DB owns:

- `study_sessions`
- `study_attempts`
- `student_content_mastery`
- `student_unit_progress`

`study_attempts` is immutable evidence. The mastery/progress tables are derived current-state summaries and must remain rebuildable from attempts.

## Canonical write function

```text
record_study_attempt_v1(student_id, payload)
```

The function:

1. verifies the authenticated caller may only write their own student ID;
2. rejects `preview_mode=true`;
3. idempotently rejects duplicate `client_attempt_id` writes;
4. creates/updates the study session;
5. writes the immutable attempt snapshot;
6. recalculates content mastery;
7. recalculates the unit × skill summary;
8. returns the same canonical result all clients can consume.

The student browser must not directly write the four progress tables.

## Canonical read function

```text
get_study_progress_v1(student_id, book_id?, unit_id?)
```

This returns canonical `unit_skills` and `needs_review` data. Student, teacher and parent surfaces must consume these canonical summaries rather than recalculate them in JavaScript.

## V1 content mastery formula

Mastery is not raw accuracy.

For one student + book + unit + content type + content ID + skill:

1. take the **five most recent attempts** for `study-v1`;
2. weight them newest-first as **5, 4, 3, 2, 1**;
3. compute weighted recent accuracy;
4. multiply by an evidence factor:

```text
evidence_factor = min(1, total_attempts / 3)
```

5. convert to 0–100:

```text
mastery = 100 × weighted_recent_accuracy × evidence_factor
```

Examples if all answers are correct:

```text
1 attempt  -> 33.33 mastery
2 attempts -> 66.67 mastery
3+ attempts -> up to 100 mastery
```

A recent error can reduce mastery because newer evidence carries more weight.

## Unit × skill mastery

Unit mastery is the mean of the current **distinct content mastery rows** for that unit and skill.

This is deliberate: repeatedly drilling one easy item cannot dominate the entire unit mastery score.

The unit summary separately stores raw:

- attempts
- correct attempts
- accuracy
- attempted content count
- mastered content count
- mastery score
- last practiced timestamp

A content item is counted as `mastered` in V1 at mastery >= 80.

## Review timing V1

```text
mastery >= 80 -> review in 7 days
mastery >= 60 -> review in 3 days
mastery < 60  -> review in 1 day
```

This is deterministic scaffolding for future spaced review, not a separate mastery formula.

## Shared engine integration

`shared/learning-engine/engine.js` emits:

```text
willena:activity-answer
```

after the shared scorer has determined correctness. The event includes the normalized activity, score result and response time.

`students/study/study-progress.js` listens for that event and records it. The Study UI does not calculate mastery.

## Attempt snapshots

Each attempt preserves:

- student/session/book/unit IDs
- skill and response type
- content type/content ID/occurrence ID
- runtime activity ID
- stimulus snapshot
- selected answer
- correct answer
- score/correctness
- response time
- attempt number
- hints/retries
- metadata
- scoring/progress versions
- timestamp

## Network failure behavior

Practice must continue even when recording temporarily fails.

`study-progress.js` keeps a bounded local retry queue and retries after connectivity/auth recovery. `client_attempt_id` makes retries idempotent.

Do not make a recording outage block answering activities.

## Preview safety

The staging Preview Book tool must never create real progress.

`study-progress.js` checks the preview session state before recording, and preview attempts are skipped entirely. The canonical DB function also refuses payloads explicitly marked as preview.

Any future preview/test mechanism must preserve this boundary.

## Future teacher / parent work

Do **not** implement new formulas in those clients.

Teacher and parent reporting should obtain the same `study-v1` summaries (or a server-side authorized wrapper around them), then only change presentation and access scope.
