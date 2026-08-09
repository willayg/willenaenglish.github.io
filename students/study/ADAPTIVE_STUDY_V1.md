# ADAPTIVE_STUDY_V1.md — Smart Study + Spaced Review

Read `PROGRESS_ARCHITECTURE.md` first. This document adds selection/scheduling rules on top of canonical `study-v1` progress. It does **not** replace the canonical scorer or mastery formula.

## Core rule

> Mastery answers **how well the student appears to know something**. The review scheduler answers **when it is useful to test that knowledge again**.

Do not merge those into a browser-only score.

## System shape

```text
Canonical curriculum / reusable practice content
                ↓
Shared practice-pool builder
                ↓
Canonical study-v1 mastery + adaptive-v1 review state
                ↓
Shared adaptive selector
                ↓
Smart Study | Focused weak-skill practice
                ↓
Shared Activity Engine / scorer
                ↓
Immutable study attempt
                ↓
Canonical progress + review state update
```

## Sources of truth

- Scoring: shared Activity Engine / `activity-v1` scorer.
- Mastery: Operational DB `study-v1` calculations from immutable attempts.
- Review schedule: Operational DB `adaptive-v1` fields on `student_content_mastery`.
- Curriculum/activity source: Content DB.
- Clients select and present; they do not invent mastery or persistent scheduler state.

## Review state is content × skill

The same canonical content can have different evidence and review schedules by skill.

Example:

```text
September + vocabulary = Strong, next review 21 days
September + spelling   = Needs work, next review tomorrow
```

This distinction must be preserved in Smart Study, study cards, teacher views, and future reporting.

## V1 review intervals

The initial deterministic interval policy is approximately:

```text
lapse / wrong review   → 1 day
1 successful review    → 7 days
2 successful reviews   → 21 days
3 successful reviews   → 45 days
4 successful reviews   → 90 days
5+ successful reviews  → 180 days, then grow up to 365 days
```

A lapse collapses the interval. These values may be tuned later, but the change must remain server-side/versioned and rebuildable from immutable attempt history where possible.

## Smart Study selection priorities

Normal Smart Study should rank useful candidates rather than randomly drawing a fixed unit pool.

Sources may include:

1. due review items from any previously studied book/unit;
2. current assigned unit material;
3. weak/lapsed content when due;
4. new material from the current curriculum;
5. a small amount of canonical content from another book at the same **internal level**;
6. future practice-eligible authored questions at the same level.

The current unit is important but is not the entire queue.

### Same-level rule

Use Content DB `internal_level_id` / canonical level fields. Do not infer level from a title such as `English Bus 6` unless no canonical level exists.

### Assessment-item rule

`assessment_items` are not automatically practice eligible. `published` does not mean `practice`.

Do not pull assessment-only questions into Smart Study until they carry an explicit practice/reuse eligibility signal or are normalized into an approved shared practice source.

## Due dates matter

Normal Smart Study must respect `next_review_at`.

If an item is strong and not due, it should normally disappear from Smart Study even if it was recently practised.

Explicit focused practice is different: when a student deliberately taps a weak skill/unit, the app may practise weak content before its scheduled review date.

## Anti-repetition rules

A base Smart Study session should:

- avoid duplicate canonical content in the initial queue;
- avoid one skill dominating the session when alternatives exist;
- avoid immediate repetition of a wrong item;
- reinsert a wrong item several questions later;
- prefer a different legitimate activity form for the same content when available in future versions;
- never manufacture repeated copies merely to reach a target count.

A session target is a goal, not permission to create junk repetition.

## Shared practice pool

Generic generated practice belongs in `shared/learning-engine/practice-pool.js`, not in Smart Study itself.

The pool may generate valid variants from canonical content, including:

- vocabulary meaning / reverse meaning;
- spelling;
- grammar gap / choice / ordering;
- sentence building;
- conversation;
- listening.

Smart Study chooses from this pool. Focused practice uses the same pool and selector with constraints.

## Focused practice

Clicking a unit skill stat launches the same adaptive selector constrained to:

```text
selected book + selected unit + selected skill
```

It should prioritise weak, lapsed, and low-mastery content. This is not a second practice algorithm.

## Study-card progress

Study content cards may display canonical per-item progress such as:

```text
Meaning  Strong · 92%
Spelling Needs work · 48%
```

The UI must read canonical item mastery. It must not calculate these percentages from DOM state or localStorage.

Unattempted content is `Not studied`, never `0%`.

## Daily goal vs mastery

The Smart Study daily ring is a completion/motivation counter. It is not mastery.

Keep these concepts separate:

- Daily Smart Study completion: did the student do today's useful work?
- Mastery: current evidence-based command.
- Review interval/state: how long that knowledge has survived / when to test again.

## Preview safety

Admin Preview never records attempts, mastery, review history, due dates, or recommendations.

## Versioning

Current names:

```text
scoring_version   = activity-v1
progress_version  = study-v1
scheduler_version = adaptive-v1
practice pool     = shared-practice-v1
```

If scheduler semantics materially change, create a new scheduler version rather than silently changing historical meaning.
