# Vocabulary Study — Design & Architecture Spec

**App:** `students/vocab-study/`  
**Current staging version:** `0.050`  
**Status:** Active implementation  
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

Every meaningful attempt creates a canonical learning record.

### Pass 1 tracking contract — implemented in v0.036

At minimum, Vocabulary Study records:

- student
- lexical entry
- book
- unit
- study mode
- session source
- correct / incorrect
- student response
- correct answer
- response latency
- hints used
- support level where applicable
- retry count
- attempt number
- timestamp

The canonical `study_attempts` table already has first-class columns for:

- `attempt_number`
- `hints_used`
- `retry_count`
- `response_time_ms`

The server remains responsible for the canonical historical `attempt_number`. The app also sends a session-local attempt number in metadata so retries inside one activity can be reconstructed.

Vocabulary Study uses `session_source: "student"` by default. Future teacher-selected practice will use `session_source: "teacher"`. Recommended practice can later use `session_source: "adaptive"`.

Spelling Coach records its support level separately. Hint level and retry information must not be flattened into a simple correct/incorrect result.

Raw attempts are preserved. UI progress is derived from those records rather than replacing them.

## 7. Simple Progress Model

Vocabulary Study will deliberately use a simple progress model rather than a heavy spaced-repetition or Anki-style mastery system.

The goal is:

- give students useful practice
- bring back unfinished or weak words
- allow straightforward review
- show clear progress without repeatedly hounding students after they have demonstrated competence

### Clean-pass scoring — implemented in v0.042

Student-facing skill percentages are **clean-pass scores**, not eventual-completion scores.

A word counts as a clean pass when the student answers it correctly on a fresh attempt:

- `retry_count = 0`
- the answer is correct
- for Spelling Coach, no hint/support was required

A correction retry inside the same run is still useful and still completes the activity flow, but it **does not convert the word into a clean pass** for the skill card.

Example:

```text
9 spelling-test words
8 correct first try
1 wrong → corrected on retry

activity completion: 9 / 9
card score:          8 / 9 = 89%
stars:               ★★★☆☆
retry queue:          1 word
```

The word that needed a retry remains in `review_needed`. On a later session, that word is served again as a fresh attempt. If the student then gets it right cleanly, it becomes passed and leaves the retry queue.

This means correction retries help the student finish the current activity without falsely turning the visible score into 100%.

Progress is tracked separately by mode, for example:

```text
elephant

quiz             clean / retry needed
spelling coach   clean / retry needed
spelling test    clean / retry needed
speaking         clean / retry needed
```

For the main home cards:

- **Quiz** percentage = clean quiz passes ÷ eligible quiz words
- **Spelling** percentage = clean **Spelling Test** passes ÷ eligible spelling words
- **Speaking** percentage = clean speaking passes ÷ eligible speaking words
- Spelling Coach remains practice/support and does not inflate the main Spelling score.
- Each card shows its percentage and 0–5 stars using the normal Vocabulary Study star thresholds. Clean-pass and retry counts remain internal state and are not shown on the home cards.

Historical attempt data is retained because it is useful for teacher insight, future recommendations, streaks, badges, and fair rewards. Retaining the data does **not** mean the app must force a spaced-review schedule.

## 8. Progress Roll-Up

Progress rolls upward in a simple way:

```text
attempts
  ↓
word + mode pass state
  ↓
unit skill progress
  ↓
unit overall progress
  ↓
book completion view
```

The current progress rings and snapshots are the practical source for student-facing clean-pass scores and retry queues.

The per-word state keeps `passed` and `review_needed` separate from raw attempt history. Immediate correction retries do not clear `review_needed`; a later fresh clean attempt does.

A unit can display a simple percentage, clean-word count, stars, and words still needing retry. We do not need a hidden complex mastery score to justify that percentage.

## 9. What Counts as 100%

A unit reaches 100% when the configured required Vocabulary Study work for that unit is complete under the current progress rules.

The app should not require endless review cycles to preserve 100%.

The exact required modes can remain configurable as Vocabulary Study develops. The important product rule is that 100% should feel achievable and stable.

When a unit first reaches 100%, it earns a permanent **Golden Unit Badge**.

## 10. Golden Unit Badges and Achievements

Every unit that reaches 100% earns a permanent golden badge.

Example:

> 🏅 Unit Mastered — Unit 4

Important rules:

- one golden badge per unit
- award it the first time the unit reaches 100%
- once earned, do not remove it
- changing future progress rules must not erase a historical badge
- unit selectors should eventually show earned golden badges
- a book-level view can show the student's collection of golden units

A future Book Mastery badge may be awarded when all required units in a book have golden badges.

Suggested achievement data:

```text
student_achievements

student_id
achievement_type
book_id
unit_id
earned_at
```

## 11. Streaks

Streaks are a core motivational feature and remain separate from unit progress.

Use a **study-day streak** rather than an aggressive calendar-review streak.

A streak should increment from meaningful completed vocabulary study, not from opening the app or answering one token question.

Student UI should eventually show:

```text
🔥 5 study-day streak
Best: 17
```

Streaks must not inflate unit progress and should not force a student to repeat already-completed content simply to protect a streak.

### Pass 3 implementation note — v0.049

A meaningful Vocabulary Study day is any Korea-local calendar day with at least one completed scored Vocabulary Study reward session. Spelling Coach alone does not advance the streak because it is support/practice rather than a scored completion.

The current streak remains intact through the following day so a student does not lose the displayed streak before that day has finished; if no qualifying study occurs by the next calendar day, the current streak resets to zero. Best streak is retained from historical completed sessions.

Golden Unit awards use the existing clean-pass snapshot as the source of truth. The server refreshes the unit snapshot before deciding whether the unit qualifies and performs an idempotent insert into `student_achievements`.

## 12. Recommended for You — Later

A Recommended for You layer is still planned, but it is **not part of the current six-pass build**.

Useful future recommendations include:

- unfinished unit work
- weak quiz words
- spelling items that still need practice
- recent mistakes
- nearly complete units
- teacher-selected targets

Keep the first recommendation logic simple, deterministic, and inspectable.

Do not turn recommendations into an aggressive spaced-repetition scheduler.

## 13. Content Sources

The app should not need to know where vocabulary originally came from.

Current / planned sources include:

- normal `source_content_occurrences`
- Word Builder teacher collections
- teacher-selected current Word Test vocabulary
- past Word Test vocabulary for review
- test-prep lexical content
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

## 18. Current Six-Pass Build Order

### Pass 1 — Tracking foundation
- real `hints_used`
- support level
- retry count
- canonical attempt number
- session-local attempt number
- session source
- reliable response timing

### Pass 2 — Willena points + stars — implemented in v0.037

Vocabulary Study should award more points than the generic Study default because the activities require sustained effort.

#### Points per recorded attempt

- Multiple-choice vocabulary: **2 points**
- Spelling Test: **4 points**
- Speaking: **4 points**
- Spelling Coach uses support-sensitive points:
  - correct with **0 hints**: **3 points**
  - correct with **1 hint**: **2 points**
  - correct with **2+ hints**: **1 point**
  - incorrect Coach attempt: **0 points**

These rewards flow through the existing Willena points system rather than creating a Vocabulary Study-only balance. Visual point feedback is separate from scoring and appears immediately when a correct point-bearing answer is checked; canonical recording continues independently.

Retries, repeated practice, and assisted attempts remain fully tracked. Attempt points are awarded on every recorded attempt, including retries. Session-star percentages are calculated from the first attempt on each target, and persistent skill-card scores use the same clean-pass principle so forced correction retries do not inflate either result.

Spelling Coach is practice/support rather than a scored mode. It awards **points only** and does **not** create a star-bearing reward session.

### Shared point feedback — reimplemented in v0.046

The two v0.045 point-token experiments were removed. Vocabulary Study now has one shared visual service: `students/components/student-point-feedback.js`.

For a positive award, Vocabulary Study shows visual feedback immediately when the answer is checked; it does not wait for the network recorder. Pointer/touch coordinates from the Check Answer press are captured so the `+N` appears where the student touched. Keyboard submission falls back to the active answer field. The feedback is plain text rather than a pill: +1/+2 use cyan and +3/+4 use pink. It rises slowly about 80 px over roughly 1.4 seconds and fades away. The optimistic points event fires immediately while the canonical recorder continues independently.

Incorrect and zero-point attempts never create feedback. Spelling Coach keeps its 3 / 2 / 1 hint-sensitive values. Reduced-motion users receive the confirmed point update without the travel animation. The shared service owns all token CSS and animation behavior; Vocabulary Study contains only the scoring and confirmed-save wiring.

#### Stars per completed session

Stars are awarded from the student's final session percentage:

| Final result | Stars |
| --- | ---: |
| 100% | ⭐⭐⭐⭐⭐ **5** |
| 90–99% | ⭐⭐⭐⭐ **4** |
| 80–89% | ⭐⭐⭐ **3** |
| 70–79% | ⭐⭐ **2** |
| 60–69% | ⭐ **1** |
| Below 60% | **0** |

A result below 60% is not good enough for a star award.

Stars are awarded through the existing Willena `progress_sessions` stars system and shown on scored Vocabulary Study completion screens. Spelling Coach is excluded from star awards. Vocabulary Study finalizes reward sessions through the same authenticated Cloudflare Study progress path already used by its canonical attempt recorder. The deployed `progress_summary?section=study_attempt` endpoint passes a reward-only payload into `record_study_attempt_v1`, which writes the completed `progress_sessions` star row without creating a fake study attempt. The visual award uses the shared `students/components/student-reward-celebration.js` component so other student apps can reuse the same animated percentage / stars / points treatment. Repeating the same book/unit/mode can improve the recorded best star result, but it must not stack unlimited duplicate stars for the same list + mode.

The star result is a motivational session reward and does not alter unit progress, Golden Unit Badges, or streak calculations.

### Clean-pass cards + targeted retry — implemented in v0.042
- clean-pass percentage instead of eventual-pass percentage
- correction retries do not inflate the persistent card score
- later fresh attempts can clear `review_needed`
- completed words that still need a clean retry are served as targeted retry practice
- Quiz / Spelling / Speaking cards show stars; clean and retry counts remain hidden from the home card UI
- main Spelling score is based on Spelling Test; Spelling Coach remains practice

### Pass 3 — Streaks + Golden Unit Badges — implemented in v0.049
- Vocabulary Study uses a Korea-local study-day streak derived from completed scored Vocabulary Study sessions (Quiz, Spelling Test, or Speaking), not from individual answers or opening the app.
- The home screen shows the current streak, best streak, and Golden Unit count.
- A Golden Unit is awarded when all eligible Quiz words and Spelling Test words have clean passes, plus all eligible Speaking words when that unit has speakable targets.
- Golden Unit awards are stored permanently in `student_achievements`; later progress-rule changes do not remove an earned badge.
- Unit selectors show a reusable shared Golden Unit SVG on earned units.
- The home streak, best-streak, and Golden Unit indicators use reusable assets from `/shared/svgs/` rather than emoji.
- The first award produces a one-time completion-screen callout using the same shared Golden Unit SVG.
- Streaks and achievements are served through authenticated progress-summary Worker endpoints and remain separate from points/stars.

### Pass 4 — Teacher-selected Word Test practice
- teacher-selected targets
- `session_source: "teacher"`
- reuse the same Vocabulary Study engine and renderer

### Pass 5 — Past Word Tests
- stop filtering useful historical Word Test vocabulary
- expose past tests as review material
- preserve canonical lexical IDs and deduplicate appropriately

### Pass 6 — Major UI pass
- clearer current book and unit
- stronger Quiz / Spelling / Speaking cards
- visible streak, points, stars, and golden badges
- better word-list and completion screens
- clear areas for Current Study / Teacher Practice / Review
- better multiple-book handling
- mobile-first polish

### Later — Recommended for You
Build this after the tracking and content foundations have produced enough useful real-world data.

## 19. Product Rule Summary

- Teacher recommendations come first.
- Adaptive recommendations come second.
- Self-directed study is always available.
- All three use one study engine.
- Renderer handles **how**, planner handles **what**.
- Track performance at lexical-entry + mode level.
- Keep progress simple; do not force Anki-style spaced review.
- 100% unit progress earns a permanent Golden Unit Badge.
- Streaks motivate consistency but do not affect unit progress.
- Teacher worksheet vocab and canonical lexical content should be reusable across apps.
- Storage details should move out of the vocab UI layer over time.

---

## 20. Current Architecture Note

As of v0.002, Vocabulary Study is still a relatively small app, but data loading, session logic, rendering coordination, and source-specific logic are concentrated in `vocab-study.js`.

That is acceptable for the current prototype, but the planned UI redesign plus spelling helper, speaking, adaptive practice, tracking, mastery, medals, and streaks means the shared modules above should be introduced during the redesign rather than after all features have been added.
