# Vocabulary Study — Design & Architecture Spec

**App:** `students/vocab-study/`  
**Current staging version:** `0.055`  
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

#### P4A — Assignment foundation — implemented
- Reuse `homework_assignments` as the generic assignment envelope rather than creating a second assignment system.
- `homework_assignments.source_type` is authoritative and now supports `wordlist`, `saved_game`, and `vocab_study`.
- Vocabulary Study assignments store canonical lexical targets in `study_assignment_targets` with stable English/Korean snapshots.
- `study_attempts.assignment_id` is a first-class indexed field. The canonical recorder continues to receive the assignment id in activity metadata; a database trigger promotes it into the first-class column.
- Teacher-selected practice will record `session_source: "teacher"` while reusing the existing Vocabulary Study engine and renderer.
- `get_vocab_assignment_progress_v1` reports assignment progress from canonical clean-pass evidence: correct fresh attempts with `retry_count = 0`, separated by Quiz, Spelling Test, and Speaking.
- Homework API can create Vocabulary Study assignments with targets, replace their targets, and return Vocabulary Study progress.
- The generic `assignment_progress` endpoint dispatches `vocab_study` assignments to the clean-pass progress engine instead of the legacy English Arcade stars evaluator.
- Teacher-mode assignment listing now requires authenticated approved teacher/admin access.
- Students requesting assignment progress only receive their own progress row; teacher/admin requests can receive the class view.
- Vocabulary Study assignments do not create English Arcade run tokens.

#### P4B — Word Builder assignment controls — implemented
- Word Builder keeps Save as the primary workflow. A successful Word Builder save returns the exact canonical lexical targets that were persisted.
- The Worksheet Manager save popup calls `window.opener.onWordBuilderSaved(...)` after a successful Word Builder save and closes without an extra saved-alert step.
- Word Builder then opens an optional **Assign for Vocabulary Study?** modal. **Not now** leaves the worksheet saved and creates no assignment.
- The assignment modal loads the same authenticated teacher class list used by Teacher Dashboard.
- Teachers choose class, due date, and required Quiz / Spelling / Speaking modes.
- Assignment creation writes `source_type: "vocab_study"`, the saved Word Builder collection id, required modes, and the exact canonical lexical targets returned by save.
- Saving an existing worksheet never silently edits or replaces an existing homework assignment; clicking Assign explicitly creates a new assignment.
- The old standalone **Assign Homework** → Game Builder handoff has been removed. **Build a Game** remains a separate tool flow.
- Individual-student targeting remains available in the P4A schema/API but is deferred from this first save modal; P4B starts with whole-class assignment as requested.

#### P4C — Student Teacher Practice — implemented in v0.055
- Vocabulary Study loads the signed-in student's active `vocab_study` assignments from the Homework API.
- A **Teacher Practice** block appears above self-study with title, due date, overall completion, and the required Quiz / Spelling / Speaking modes.
- The assignment uses the exact canonical lexical targets saved by Word Builder.
- Teacher Quiz, Spelling Test, and Speaking reuse the existing Vocabulary Study flows and universal renderer.
- Teacher answers use the **same canonical `WillenaStudyProgress → record_study_attempt_v1` recorder as normal Vocabulary Study**. There is no separate homework-attempt endpoint or recorder.
- Every teacher attempt carries `session_source: "teacher"` plus a first-class `assignment_id`.
- Assignment-only attempts may have no single book/unit. The canonical recorder accepts `assignment_id` as the study context, records points/evidence, and deliberately skips unit-scoped mastery when book/unit are absent.
- The unit-scoped vocabulary-state trigger ignores assignment-only attempts with no single unit; assignment progress is derived directly from `study_attempts.assignment_id`.
- Server-side recording verifies the signed-in student belongs to the assignment class / optional target list and that the lexical entry belongs to the assignment.
- The existing canonical queue/retry/offline behavior also applies to homework attempts.
- On leaving Teacher Practice, pending canonical saves are awaited and assignment progress reloads before clearing teacher context.
- Normal self-study continues to require book + unit and uses the existing mastery path unchanged.
- Audit fix in v0.055 removed the dead `vocab_assignment_attempt` Worker endpoint, deleted the dedicated assignment recorder RPC, and reverted the temporary global API bearer-auth workaround.

#### P4D — Teacher Dashboard tracking — implemented
- Teacher Dashboard V2 now has a dedicated **Assignments** view on desktop and mobile.
- Current / History filters separate live homework from ended or expired assignments.
- Class filter narrows Vocabulary Study homework without affecting Students / Classes views.
- Opening an assignment loads the canonical `assignment_progress` result and shows class overall completion, complete/in-progress counts, and average Quiz / Spelling / Speaking completion.
- The student matrix shows each student's clean-pass percentage per required mode plus overall assignment status.
- Clicking a student loads only that student's word-level detail through `get_vocab_assignment_student_detail_v1`, avoiding a large class-wide target payload.
- Per-word detail shows Clean / Review / not-started state for each required mode plus wrong-attempt and total-attempt counts where review is needed.
- Dashboard tracking reads the same `study_attempts.assignment_id` evidence used by the student Teacher Practice cards; there is no separate teacher progress store.
- Dashboard shell revision: `v14.11`.

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

## 19. Challenge Mode — Planned

Challenge Mode is a future self-directed vocabulary feature designed as a short, repeatable progression loop rather than another book/unit workflow.

It should reuse the existing Vocabulary Study renderer, word modal, spelling keyboard, speaking matcher, reward feedback, tracking, and mastery evidence wherever possible.

### 19.1 Home-screen placement

On the front page, Challenge Mode should appear:

```text
Word Test
Books
──────── subtle divider
Challenge Mode card
──────── subtle divider
Achievements / streak / gold units
```

The Challenge Mode card should be visually distinct enough to feel like a separate activity, but it should remain consistent with the cyan / pink Vocabulary Study card system.

### 19.2 Difficulty choice

Opening Challenge Mode presents two choices:

#### NORMAL
Serve vocabulary appropriate to the student's canonical Willena level.

The level source must be the student's actual stored level, not the currently selected book and not whichever book the student studied most recently.

Before implementation, audit where the canonical student level is currently stored and exposed to the student app.

#### CHALLENGE
Serve vocabulary from the existing middle-school vocabulary pool.

Do not create a second manually maintained Challenge vocabulary list if the canonical lexical/content system already contains a suitable middle-school pool.

Before implementation, audit the existing content database and vocabulary sources to identify the cleanest reusable middle-school lexical pool.

### 19.3 Batch size and selection

Each Challenge Mode run uses exactly **6 words**.

The six words are selected once at the beginning of the run and remain fixed for the whole run.

Selection flow:

```text
eligible pool
  ↓
remove fully mastered Challenge Mode words
  ↓
avoid recently served words where possible
  ↓
randomly choose 6
```

Suggested recent-word behavior:

- avoid approximately the last 12 served words when enough alternatives exist
- relax the cooldown automatically when the remaining eligible pool is small
- do not permanently exclude failed words; they should return in future runs
- do not immediately force a failed word into the very next batch unless the pool is too small to avoid it

### 19.4 Student flow

A Challenge Mode run follows this sequence:

```text
Choose NORMAL / CHALLENGE
        ↓
6-word preview
        ↓
STEP 1 · Quiz
        ↓
STEP 2 · Spelling
        ↓
STEP 3 · Speaking
        ↓
Results
```

The six-word preview should reuse the current word modal / word-card design:

- English
- Korean
- shared headphone SVG / audio button
- clear start action

The preview should make the selected six words explicit before testing begins.

### 19.5 Activity size

Each word receives one activity in each scored section:

- 6 Quiz items
- 6 Spelling items
- 6 Speaking items

A normal complete run therefore contains **18 scored answers** before any correction retries.

The goal is a short challenge session, not a full unit-length study session.

### 19.6 Clean mastery rule

Challenge Mode mastery is intentionally stricter than eventual completion.

A word is retired from future Challenge Mode selection only when the student gets that word **cleanly correct in all three sections**:

```text
Quiz clean
+ Spelling clean
+ Speaking clean
= Challenge word mastered
```

"Clean" means the first fresh attempt for that section is correct under the normal Vocabulary Study clean-pass rules.

Correction retries are still useful for finishing the current activity, but they **must not** convert the word into a Challenge mastery pass.

Examples:

```text
dog
Quiz      correct first try
Spelling  correct first try
Speaking  correct first try
→ MASTERED → remove from future Challenge Mode batches
```

```text
telescope
Quiz      correct first try
Spelling  wrong → corrected on retry
Speaking  correct first try
→ NOT MASTERED → remains eligible for a future batch
```

Once a word is fully mastered for Challenge Mode, it should not be served again in that same Challenge pool unless a future product rule explicitly introduces a reset/review mechanism.

### 19.7 Normal and Challenge mastery pools

NORMAL and CHALLENGE should be treated as distinct selection contexts.

At minimum, Challenge progress needs to know:

```text
student
lexical entry
pool / difficulty
quiz_clean
spelling_clean
speaking_clean
mastered_at
last_served_at
```

Before creating a new database table, audit whether the existing canonical `study_attempts`, per-word progress snapshots, and mastery evidence can derive this state reliably.

Prefer deriving Challenge mastery from existing canonical attempts if that remains simple and performant.

Create dedicated persisted Challenge state only if the current evidence model cannot support:

- fast exclusion of mastered words
- recent-word cooldown
- distinction between NORMAL and CHALLENGE pools
- stable cross-device progress

Do **not** rely on `localStorage` for mastery. Challenge progress must survive browser/device changes.

### 19.8 Reuse existing systems

Challenge Mode should not introduce parallel implementations of systems already present.

Reuse:

- universal question renderer
- Vocabulary Study Quiz flow
- Spelling Test flow
- shared Willena keyboard
- Speaking flow
- phonetic STT matcher
- word modal / headphone cards
- canonical attempt recorder
- points / reward feedback
- history navigation
- clean-pass logic

Suggested module boundaries:

```text
students/vocab-study/
  challenge-mode.js       selection + six-word session orchestration
  challenge-progress.js   mastery / recent-word state if a dedicated layer is needed
```

The main `vocab-study.js` should only orchestrate entry/exit and connect Challenge Mode to the existing systems.

### 19.9 Navigation

Challenge Mode should participate in the same device/browser history model as the rest of Vocabulary Study.

Expected behavior:

```text
Home
 → Challenge level select
 → 6-word preview
 → Quiz / Spelling / Speaking
```

Device Back should step out of the current activity cleanly without dumping the student out of the app.

Avoid creating history entries for every individual word.

### 19.10 Results

The completion screen should show:

- six selected words
- which words became fully mastered this run
- which words remain eligible for a future run
- section results for Quiz / Spelling / Speaking
- normal points / reward feedback where appropriate

Do not imply that a word is mastered merely because the student eventually corrected it during the run.

### 19.11 Open implementation questions

Resolve these before building:

1. Where is the student's canonical Willena level stored and how should Vocabulary Study read it?
2. Which existing lexical/content source should define the NORMAL level pool?
3. Which existing lexical/content source should define the middle-school CHALLENGE pool?
4. Can current `study_attempts` / snapshot evidence derive Challenge mastery efficiently, or is a compact persisted Challenge progress table justified?
5. Should NORMAL and CHALLENGE mastery be independent if the same lexical entry appears in both pools?
6. What reward/star treatment should Challenge Mode use? Do not decide this implicitly while building the first UI.

Challenge Mode is **planned only**. Do not start implementation until the content-pool and student-level sources have been audited.

---

## 20. Product Rule Summary

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

## 21. Current Architecture Note

As of v0.002, Vocabulary Study is still a relatively small app, but data loading, session logic, rendering coordination, and source-specific logic are concentrated in `vocab-study.js`.

That is acceptable for the current prototype, but the planned UI redesign plus spelling helper, speaking, adaptive practice, tracking, mastery, medals, and streaks means the shared modules above should be introduced during the redesign rather than after all features have been added.

### Word Test Study rewards
- Assigned Vocabulary Study homework is presented to students as **Word Test Study**.
- Each required section (Quiz, Spelling, Speaking) can earn **up to 10 stars** based on the completed section score: 100%=10, 90–99%=9, 80–89%=8, etc.
- Stars are best-score-per-assignment-per-mode, so repeating a section can improve its award but cannot farm duplicate stars.
- Normal independent Vocabulary Study keeps the existing 5-star session scale.
- Word Test Study mode cards show both clean-pass progress in the ring and the best earned star award as `★ n/10`.
- Global/header star totals interpret assignment reward sessions on the 10-star scale; older assignment sessions are derived from their saved accuracy without inserting duplicate reward rows.
