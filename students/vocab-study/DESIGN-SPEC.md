# Vocabulary Study — Design & Architecture Spec

**App:** `students/vocab-study/`  
**Current staging version:** `0.002`  
**Status:** Active redesign / architecture definition  
**Purpose:** Define the product behavior, study flow, renderer responsibilities, tracking model, mastery model, and modular architecture for the next generation Vocabulary Study app.

---

## 1. Product Goal

Vocabulary Study should become the first fully structured implementation of a shared Willena study engine.

The app must support three ways into a study session:

1. **Teacher-selected study**
2. **App / AI recommended study**
3. **Student self-directed study**

These should appear in that priority order in the UI.

Teacher direction has highest priority. App recommendations come next. Self-directed study remains available at all times and may work together with adaptive recommendations.

The app should not become three separate systems. All three entry paths should create the same kind of study plan and then feed the same session engine, renderer, tracking system, and mastery system.

---

## 2. Core Design Principle

Separate:

### A. What should the student study?
Handled by the **study planner / recommendation layer**.

### B. How should the student study it?
Handled by the **activity builder + universal renderer**.

The renderer must not care whether a session came from a teacher, the adaptive system, or the student.

---

## 3. Session Sources

Every study session should have a source.

### 3.1 Teacher-selected

Teacher-selected study appears first and has the highest priority.

Examples:

- Practice Unit 4 spelling
- Review these 8 words
- Complete vocabulary for Unit 6
- Practice speaking for selected words

Teacher assignments should be clearly identified in the student UI.

Example study-plan shape:

```js
{
  source: "teacher",
  bookId: "...",
  unitId: "...",
  skill: "vocabulary",
  mode: "spelling",
  targetIds: ["..."],
  priority: 100
}
```

### 3.2 App / AI recommended

The app should recommend study based on actual student weakness and recent performance.

Examples:

- 8 words need spelling practice
- 5 words are repeatedly confused
- Review words missed yesterday
- Finish the weak words keeping Unit 3 below mastery

The recommendation logic should initially be deterministic and data-driven. An LLM is not required for the core recommendation logic.

Example:

```js
{
  source: "adaptive",
  reason: "weak_spelling",
  skill: "vocabulary",
  mode: "spelling_helper",
  targetIds: ["..."]
}
```

### 3.3 Student self-directed

Students should always be able to choose what to study.

Typical path:

```text
Book → Unit → Skill / Mode → Start
```

Self-directed study can still use adaptive information.

Example:

> You chose Unit 5. You have 7 weak words here. Start with those?

Example:

```js
{
  source: "student",
  bookId: "...",
  unitId: "...",
  skill: "vocabulary",
  mode: "mixed"
}
```

---

## 4. Proposed Home-Screen Hierarchy

The redesigned home screen should conceptually follow this order:

### 1. Teacher
High-priority teacher-assigned work.

### 2. Recommended for You
Adaptive practice based on weakness, recency, unfinished mastery, or review needs.

### 3. Your Books / Explore
Self-directed access to books, units, modes, progress, and mastery.

The UI can change completely, but this hierarchy should remain the product logic.

---

## 5. Universal Renderer

The universal renderer should own **interaction mode**, not study selection.

Planned / expected renderer modes include:

- Multiple choice
- Korean → English
- English → Korean
- Spelling
- **Spelling helper**
- **Speaking**
- Listening / recognition where useful
- Future study modes without requiring a new app-specific renderer

Example activity contract:

```js
{
  content: {
    lexicalEntryId: "...",
    english: "elephant",
    korean: "코끼리",
    audio: null,
    image: null
  },

  mode: "spelling_helper",

  grading: {
    type: "spelling",
    tolerance: "normal"
  },

  context: {
    bookId: "...",
    unitId: "..."
  }
}
```

Speaking should use the same content/session structure:

```js
{
  mode: "speaking"
}
```

The renderer should return a standardized result so tracking does not care which UI mode was used.

---

## 6. Tracking System

Every meaningful attempt should create a learning record.

At minimum, record:

- student
- lexical entry
- book
- unit
- study mode
- session source
- correct / incorrect
- response
- latency
- hints used
- attempt number
- timestamp

The system should preserve raw attempts and derive mastery from them.

Do **not** store only a single unit percentage as the source of truth.

---

## 7. Per-Word Mastery

Mastery should exist at the smallest useful learning unit.

For vocabulary, track separate dimensions rather than one vague score.

Example:

```text
elephant

recognition      0.95
meaning_en_ko    0.90
meaning_ko_en    0.72
spelling         0.41
speaking         0.65
```

Not every dimension needs to be visible to students.

Speaking may initially be optional for full unit completion until the mode is mature and universally available.

---

## 8. Mastery Roll-Up

Mastery should roll upward:

```text
attempts
  ↓
word + skill mastery
  ↓
word mastery
  ↓
unit mastery
  ↓
book mastery
```

The student-facing unit score can remain simple:

```text
Unit 1 — 78%
14 / 18 words mastered
```

Suggested simple status language:

```text
0–24    New
25–59   Learning
60–89   Practiced
90–99   Nearly mastered
100     Mastered
```

These labels are UI-level summaries. The underlying mastery calculation can be more detailed.

---

## 9. What Counts as 100%

A unit should **not** become 100% just because every word was answered correctly once.

A word should reach mastery only after enough evidence.

A first implementation might require successful evidence in:

- Recognition / meaning
- Korean → English
- Spelling
- Recent review

Speaking can be added to the rule later.

The exact formula should remain configurable.

---

## 10. Medals and Achievements

When a unit reaches 100% mastery, award a permanent achievement.

Example:

> 🏅 Unit Mastered — A Giant in the Forest

For a 16-unit book, the student can visually collect 16 unit medals.

Completing every unit can award a **Book Mastery badge**.

Important rule:

**Do not remove a medal after it has been earned.**

Mastery can later fall due to review decay or new evidence, but the achievement remains historical.

Example:

```text
🏅 Mastered Unit 4
Current mastery: 92%
3 words due for review
```

Suggested achievement data:

```text
student_achievements

student_id
achievement_type
book_id
unit_id
earned_at
```

---

## 11. Streaks

Streaks are motivational and must remain separate from mastery.

A streak should reward **meaningful completed study**, not opening the app or answering one question.

Possible student UI:

```text
🔥 5 study-day streak
Best: 17
```

A Willena-specific **study-day streak** may be better than a strict calendar-day streak because weekends, school schedules, hagwon attendance, and vacations matter.

Streaks should never inflate mastery scores.

---

## 12. Recommendation Logic

The recommendation engine should use tracking + mastery data.

Examples:

- weakest spelling items
- words repeatedly missed
- recently learned words due for review
- nearly complete units
- teacher-selected targets
- unfinished assigned sessions

The first version should prefer transparent deterministic scoring over opaque AI decisions.

AI may later help explain, summarize, or assemble recommendations, but the underlying evidence should stay inspectable.

---

## 13. Content Sources

The app should not need to know where vocabulary originally came from.

Current possible sources include:

- normal `source_content_occurrences`
- Word Builder teacher collections
- test-prep / 내신 lexical content
- publisher-derived vocabulary
- imported worksheet vocabulary

The app should eventually call one shared vocabulary service:

```js
const vocab = await loadVocabulary(bookId, unitId);
```

That service should:

- fetch all valid lexical content
- merge sources
- preserve preferred display English / Korean
- deduplicate
- return canonical lexical IDs
- hide storage-specific details from the app

---

## 14. Current Word Builder Relationship

Teacher Word Builder worksheets are already stored as:

```text
collections
  ↓
collection_items
  ↓
lexical_entries
```

Book-linked Word Builder lexical content is intended to be usable as study content.

The vocab app should consume the same lexical entries without breaking or replacing the Word Builder worksheet workflow.

Word Builder remains editable as a teacher tool.

---

## 15. Proposed Modular Architecture

The current `vocab-study.js` should gradually become orchestration only.

Suggested shared modules:

```text
students/vocab-study/
  index.html
  vocab-study.css
  vocab-study.js

shared/study/
  vocabulary-source.js
  study-planner.js
  study-session.js
  mastery.js
  tracking.js
  achievements.js
```

### vocabulary-source.js
Owns vocabulary retrieval, merging, source normalization, and deduplication.

### study-planner.js
Owns teacher / adaptive / self-directed study plans.

### study-session.js
Owns queue construction, retries, session progression, completion, and review behavior.

### mastery.js
Owns mastery calculations and roll-ups.

### tracking.js
Owns attempt recording and retrieval of learning history.

### achievements.js
Owns medals, book-completion badges, and streak-related achievement logic.

The universal question/activity renderer should remain separate from these systems.

---

## 16. Target Data Flow

```text
CONTENT
lexical entries / questions / passages
        ↓
STUDY PLANNER
teacher / adaptive / self
        ↓
SESSION ENGINE
queue / retry / progression
        ↓
ACTIVITY BUILDER
choice / spelling / speaking / etc.
        ↓
UNIVERSAL RENDERER
display + interaction
        ↓
ATTEMPT TRACKER
raw result history
        ↓
MASTERY ENGINE
word → unit → book
        ↓
RECOMMENDATIONS + ACHIEVEMENTS
```

---

## 17. UI Redesign Constraints

The UI can be redesigned completely.

The redesign should **not** directly encode business logic into UI components.

UI components should receive structured data for:

- teacher assignments
- recommended sessions
- books
- units
- mastery
- medals
- streaks

This allows the visual design to change without rewriting the study engine.

---

## 18. Near-Term Build Order

Recommended implementation order:

1. Finalize the redesigned home / session-selection UX.
2. Extract a shared vocabulary-source layer.
3. Define the common study-plan object.
4. Add spelling-helper mode to the universal renderer.
5. Add standardized attempt tracking.
6. Add simple per-mode mastery.
7. Add adaptive recommendations.
8. Add unit mastery percentages.
9. Add unit medals / book badges.
10. Add speaking mode.
11. Refine mastery and recommendation formulas from real student data.

---

## 19. Product Rule Summary

- Teacher recommendations come first.
- Adaptive recommendations come second.
- Self-directed study is always available.
- All three use one study engine.
- Renderer handles **how**, planner handles **what**.
- Track performance at lexical-entry + mode level.
- Derive unit and book mastery from lower-level evidence.
- 100% mastery earns a permanent medal.
- Streaks motivate consistency but do not affect mastery.
- Teacher worksheet vocab and canonical lexical content should be reusable across apps.
- Storage details should move out of the vocab UI layer over time.

---

## 20. Current Architecture Note

As of v0.002, Vocabulary Study is still a relatively small app, but data loading, session logic, rendering coordination, and source-specific logic are concentrated in `vocab-study.js`.

That is acceptable for the current prototype, but the planned UI redesign plus spelling helper, speaking, adaptive practice, tracking, mastery, medals, and streaks means the shared modules above should be introduced during the redesign rather than after all features have been added.
