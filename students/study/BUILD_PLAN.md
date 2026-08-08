# Willena Student Study App — Build Plan

## Goal

Build a logged-in student study app under `students/study/` that reuses the strongest parts of the existing student level-test framework while remaining a separate product.

The study app should:

- automatically identify the student's current class, assigned book and current unit where possible;
- load curriculum content from the Willena Content Database;
- support vocabulary, spelling, grammar, sentence building, listening, reading, speaking and writing;
- record every meaningful practice attempt;
- maintain student progress/mastery over time;
- provide teacher-side progress reports;
- reuse shared renderers, scoring, answer normalization, TTS/listening and session components where sensible;
- avoid coupling study behavior to level-test-specific adaptive logic;
- automatically gain practice content when new books, units, words, sentences, patterns, passages or authored activities are added to the content database.

---

# Existing systems to reuse

## Student level test

Current staging app:

- `students/level-test/index.html`
- `students/level-test/level-test.js`
- `students/level-test/level-test.css`
- `students/level-test/recorder-begin-guard.js`

The student level test already reuses much of the free level-test implementation, including:

- assessment loading;
- canonical answer scoring;
- sentence/token ordering;
- listening UI;
- dialogue TTS;
- reading layouts;
- loading transitions;
- response recording;
- student authentication/session handling.

These useful pieces should gradually move into a neutral shared learning layer rather than making the new study app import increasingly more level-test-specific files.

## Content Database

The Willena Content Database already provides the correct curriculum hierarchy:

`content_series -> content_books -> content_units -> content_sections -> source_content_occurrences`

The source occurrences connect textbook locations to reusable curriculum objects such as:

- `lexical_entries`
- `sentences`
- `patterns`
- dialogues
- future passages/audio

The database also contains `assessment_items` for the level test and a currently empty generic `activities` table.

The study system should use canonical content as its source of truth and use `activities` for authored/reusable practice where necessary.

## Operational / student database

The existing operational database already contains:

- `profiles`
- `classes`
- `class_enrollments`
- `class_book_assignments`
- existing progress/session tables
- level-test attempt/response/result tables

`class_book_assignments.book_id` already links a class to the UUID of a book in the content catalog. This should be the main bridge between student identity and curriculum content.

---

# Core architecture

```text
Student login
    ↓
Current class enrollment
    ↓
Class book assignment
    ↓
Content DB book / current unit
    ↓
Study API
    ↓
Practice selector
    ↓
Shared learning engine
    ↓
Question/activity renderer
    ↓
Answer scoring + feedback
    ↓
Study attempt recording
    ↓
Mastery / progress updates
    ↓
Teacher reports
```

Keep the two Supabase databases conceptually separate:

### Content Database
Owns **what is taught**.

- books
- units
- sections
- words
- lexical forms
- sentences
- grammar patterns
- dialogues
- passages
- audio references
- authored activities/questions

### Operational Database
Owns **who learned what**.

- students
- classes
- enrollments
- class/book assignment
- current curriculum position
- study sessions
- individual attempts
- mastery
- teacher reports

Do not duplicate entire textbook records into the operational DB. Store stable content IDs as references.

---

# Shared learning engine

Create a neutral shared module area, likely:

```text
shared/learning-engine/
    engine.js
    scoring.js
    answer-normalizer.js
    session.js
    activity-loader.js

    renderers/
        multiple-choice.js
        typed-answer.js
        sentence-order.js
        listening.js
        reading.js
        speaking.js
        writing.js

    generators/
        vocabulary.js
        spelling.js
        grammar.js
        sentence.js
        listening.js
```

Do not move everything at once.

First identify code that is genuinely generic, copy/refactor it into shared modules, verify the level test still behaves identically, and only then have the study app consume it.

Level-test-only behavior should remain in the level test, including:

- adaptive ability estimation;
- level recommendation;
- test-length/setup logic;
- test completion reporting;
- assessment-specific question balancing.

Study-only behavior should live in the study app, including:

- book/unit navigation;
- hints;
- retry behavior;
- practice modes;
- spaced review;
- mastery;
- weak-item selection;
- student progress views.

---

# Practice content model

The study app should use a hybrid approach.

## Generated activities

Generate predictable exercises from canonical content whenever possible.

Examples:

### Vocabulary

From a lexical entry:

- English -> Korean choice
- Korean -> English choice
- type the English word
- matching
- picture/emoji -> word where visual data exists

### Spelling

From a lexical entry / lexical form:

- type word
- scrambled letters
- missing letters
- hear word -> type word when audio is available

### Grammar

From patterns and linked sentences:

- multiple choice
- gap fill
- error recognition
- transformation
- choose correct response

### Sentence building

From canonical sentences:

- token unscramble
- Korean -> English build
- missing word
- sentence completion

### Listening

From audio-backed words/sentences/dialogues/passages:

- hear -> choose text
- hear -> choose meaning
- dictation
- comprehension

## Authored activities

Use database-authored activities for exercises that should not be generated mechanically, particularly:

- reading comprehension;
- listening comprehension;
- nuanced grammar errors;
- inference;
- writing prompts;
- speaking prompts;
- custom teacher-curated tasks.

Use the existing `activities` table as the generic practice layer rather than forcing everything into level-test `assessment_items`.

---

# Proposed operational progress tables

Do not simply reuse `progress_attempts` because it is too word/game-oriented.

Add study-specific structures.

## `study_sessions`

Suggested fields:

- `id uuid`
- `student_id uuid`
- `book_id uuid`
- `unit_id uuid`
- `section_id uuid nullable`
- `practice_mode text`
- `skill text nullable`
- `started_at timestamptz`
- `completed_at timestamptz nullable`
- `summary jsonb`

## `study_attempts`

Suggested fields:

- `id uuid`
- `session_id uuid`
- `student_id uuid`
- `book_id uuid`
- `unit_id uuid`
- `section_id uuid nullable`
- `activity_type text`
- `skill text`
- `content_type text`
- `content_id uuid`
- `activity_id uuid nullable`
- `answer jsonb`
- `correct_answer jsonb nullable`
- `is_correct boolean nullable`
- `score numeric nullable`
- `response_time_ms integer nullable`
- `hints_used integer default 0`
- `attempt_number integer default 1`
- `metadata jsonb`
- `created_at timestamptz`

## `student_content_mastery`

Suggested fields:

- `student_id uuid`
- `content_type text`
- `content_id uuid`
- `skill text`
- `attempts integer`
- `correct integer`
- `mastery_score numeric`
- `last_seen timestamptz`
- `next_review_at timestamptz nullable`
- `updated_at timestamptz`

Unique key should include student + content + skill.

## Optional `student_unit_progress`

This can be stored or derived later depending on performance requirements.

Useful values:

- student
- book
- unit
- skill
- items_available
- items_seen
- mastery average
- last practiced

Prefer deriving aggregates from attempts/mastery until there is a demonstrated need for cached summaries.

---

# Curriculum position

`class_book_assignments` currently stores `starting_unit` and `current_unit` as text.

Add stable unit UUID references when the study system is implemented:

- `starting_unit_id uuid`
- `current_unit_id uuid`

Keep the old text columns during migration for compatibility.

Student startup flow should be:

1. authenticate student;
2. find active class enrollment;
3. find active class book assignment;
4. resolve assigned `book_id`;
5. resolve `current_unit_id`;
6. load available practice for that unit;
7. optionally allow previous-unit review and teacher-approved extra practice.

---

# Study API

The browser should not directly coordinate two independent Supabase projects.

Create a server-side study API/gateway that knows both systems.

Initial API contract:

```text
GET  /study/me
GET  /study/current
GET  /study/books/:bookId/units
GET  /study/units/:unitId
GET  /study/practice?unit_id=...&skill=...&mode=...
POST /study/sessions
POST /study/attempts
POST /study/sessions/:id/complete
GET  /study/progress
```

Teacher endpoints later:

```text
GET /study/teacher/classes/:classId/progress
GET /study/teacher/students/:studentId/progress
GET /study/teacher/students/:studentId/units/:unitId
```

The API should enforce identity and authorization and should return only the curriculum/practice data needed for the current request.

---

# V1 scope

Build the vertical slice using the content that is already strongest.

## V1 skills

1. Vocabulary
2. Spelling
3. Grammar
4. Sentence building

Do **not** begin by implementing every skill.

The first milestone is proving the entire chain:

```text
student -> assigned book -> unit -> content -> practice -> answer -> recording -> mastery -> teacher report
```

Once that is reliable, add:

5. Listening
6. Speaking
7. Reading
8. Writing

---

# Content work required

The current database has strong vocabulary/grammar/sentence coverage, but reading and listening need enrichment.

Before those modes are considered complete:

- populate `passages`;
- link reading passages to book/unit/section;
- add reading comprehension activities;
- populate sentence/word/dialogue audio references;
- establish audio storage convention;
- add listening comprehension activities;
- add speaking prompts and expected response metadata;
- add writing prompts/rubrics where appropriate.

Create a curriculum coverage report/admin view that can show, by book and unit:

- vocabulary count;
- grammar pattern count;
- sentence count;
- listening assets;
- reading passages;
- speaking activities;
- writing activities;
- practice readiness percentage.

This should become the quality-control tool used whenever new books are imported.

---

# Future-proof content ingestion

New content should become usable through data, not code changes.

Expected flow:

```text
new book imported
    ↓
units / sections created
    ↓
source occurrences created
    ↓
canonical words / sentences / patterns / dialogues / passages linked
    ↓
practice engine detects compatible content
    ↓
generated practice automatically available
    ↓
authored activities supplement generated practice where required
```

Examples:

- a new lexical entry automatically enables compatible vocabulary/spelling templates;
- a new canonical sentence automatically enables sentence building;
- a sentence linked to a grammar pattern enables appropriate grammar practice;
- adding an audio reference enables compatible listening/dictation modes;
- adding a passage plus authored questions enables reading comprehension.

---

# Teacher reporting

Teacher reports should be curriculum-aware, not just total percentages.

Required drill-down:

```text
Class
  -> Student
      -> Book
          -> Unit
              -> Skill
                  -> Content / pattern / word
```

Useful teacher views:

- class overview by current unit;
- students who have not practiced;
- students struggling with a specific unit;
- vocabulary mastery;
- spelling mastery;
- grammar pattern mastery;
- sentence-building accuracy;
- attempts/time/recent activity;
- weak content needing review;
- improvement over time.

A teacher should eventually be able to see something like:

```text
English Bus 4 — Unit 3
Vocabulary        91%
Spelling          76%
Grammar           62%
Sentence Building 67%

Weak grammar:
- want to + verb       4 / 8
- third-person -s      3 / 7
```

---

# Security

All new exposed operational tables must have RLS enabled.

Students must only be able to read/write their own study sessions, attempts and mastery.

Teachers must only be able to read students/classes they are authorized to teach.

Do not expose service-role keys to the browser.

Prefer routing cross-database operations through the existing Willena API/gateway model.

---

# Build phases

## Phase 0 — Audit and contracts

- inspect level-test modules and mark each as shared, level-test-only or obsolete;
- document the study activity object shape;
- document the content API response shape;
- document progress/mastery rules;
- verify the exact class -> student -> book resolution path;
- verify current auth/session gateway behavior.

Deliverable: agreed contracts before significant UI work.

## Phase 1 — App shell

Create:

```text
students/study/index.html
students/study/study.css
students/study/study.js
```

Features:

- use existing student auth/session system;
- show student identity;
- resolve current book;
- show current unit;
- show skill tiles;
- no attempt recording yet beyond test instrumentation.

## Phase 2 — Study API

Implement the API needed to:

- resolve current book/unit;
- query unit curriculum;
- return normalized practice payloads;
- create sessions;
- save attempts.

## Phase 3 — Shared engine extraction

Extract generic level-test pieces in small, verified steps:

- answer normalization/scoring;
- multiple choice renderer;
- typed-answer renderer;
- sentence-order renderer;
- common feedback UI;
- TTS/listening helpers where generic.

After every extraction, verify the existing student level test still behaves correctly.

## Phase 4 — Vocabulary vertical slice

Implement:

- load vocabulary from current unit;
- multiple choice;
- typed recall;
- result feedback;
- study sessions;
- attempt recording;
- basic mastery.

This is the first complete end-to-end milestone.

## Phase 5 — Spelling

Add:

- typed spelling;
- scramble;
- missing letters;
- retry behavior;
- mastery integration.

## Phase 6 — Grammar + sentence building

Add:

- grammar choices;
- gap fill where content permits;
- error recognition using authored/generated items;
- sentence unscramble;
- Korean -> English sentence build where translations exist.

## Phase 7 — Teacher report V1

Create teacher-side class/student progress views for the first four skills.

Do this before expanding to all skills so the progress model is proven early.

## Phase 8 — Listening

First complete audio ingestion/storage conventions, then add:

- word listening;
- sentence listening;
- dictation;
- authored comprehension.

## Phase 9 — Reading

Populate passages and reading activities, then add reading mode and reporting.

## Phase 10 — Speaking

Reuse the level-test/audio recording architecture where appropriate, but store practice attempts separately from assessment attempts.

Add teacher review only for tasks that genuinely need human review.

## Phase 11 — Writing

Add short constructed responses first, followed later by longer writing and rubrics.

## Phase 12 — Adaptive review / spaced practice

Once enough attempt history exists, choose practice based on mastery:

- unseen content;
- weak content;
- overdue review;
- current unit priority;
- previous-unit maintenance.

Do not build a sophisticated adaptive system before enough real student data exists.

---

# Immediate next actions

1. Create the study app shell under `students/study/`.
2. Audit all current level-test JavaScript modules and classify what can become shared.
3. Define a single normalized `StudyActivity` object used by every renderer.
4. Define study DB tables and RLS policies.
5. Add stable `current_unit_id` support to class book assignments.
6. Build a read-only study API endpoint that returns the logged-in student's assigned book/current unit.
7. Build a unit-content endpoint using the Content Database.
8. Implement vocabulary practice as the first vertical slice.
9. Record vocabulary attempts and calculate basic mastery.
10. Build the first teacher report from those real attempts.
11. Only then add spelling, grammar and sentence building.
12. Perform a dedicated content-enrichment phase before listening/reading/speaking/writing.

---

# Important design rules

1. **Content IDs must be stable.** Progress must attach to IDs, not display text.
2. **Do not make the study app a fork of the level test.** Both should consume shared modules.
3. **Do not create thousands of static questions unnecessarily.** Generate deterministic drills from canonical content and author only what benefits from authorship.
4. **Do not mix assessment attempts with study attempts.** They answer different questions.
5. **Do not duplicate the Content Database into the student database.** Reference it through stable IDs.
6. **Every new book should work through the same pipeline.** New curriculum should not require app code changes.
7. **Teacher reporting is part of V1 architecture, not an afterthought.**
8. **Add skills incrementally.** Prove the full data loop before expanding breadth.
9. **Keep current production/staging level-test behavior stable while extracting shared code.**
10. **Prefer simple mastery rules initially.** Improve adaptivity after collecting real usage data.

---

# Definition of V1 complete

V1 is complete when a logged-in student can:

1. open `/students/study/`;
2. automatically see the book assigned to their active class;
3. open the current unit;
4. practice vocabulary, spelling, grammar and sentence building using real content from the Content Database;
5. receive immediate feedback;
6. leave and return without losing recorded progress;
7. see basic progress for the unit;

and a teacher can:

8. open the teacher side;
9. select the class/student;
10. see unit-level and skill-level progress based on real recorded attempts.

New compatible content added to an existing or new book should appear in study practice without requiring new frontend code.
