# Student Tracker – Homework Mode Design

_Last updated: 2025-11-21_

## 1. Goals and Scope

This document describes the design for **Homework Mode** managed entirely from the **Student Tracker** teacher tool.

### High‑level goals

- Give teachers a **homework tracker** that shows:
  - Which students have **completed** homework for a given class.
  - Per‑student **completion level** (stars‑based), plus **accuracy** for insight.
  - A simple **history** of past homework per student.
- Let teachers **assign homework** to whole classes:
  - Based on **existing English Arcade wordlists/files**.
  - With a flexible **deadline**.
  - With a clear **completion goal** based on **stars**, not attempts.
- Make homework **visible to students**:
  - Appears in the **Student Dashboard – "Your Work"** card.
  - Clicking homework launches the **correct English Arcade level/list**.
- Integrate cleanly with the existing stack:
  - Supabase (tables + migrations).
  - Netlify functions.
  - Existing English Arcade wordlist ecosystem.
  - Student Tracker app (teacher‑side) with minimal impact on `main.js` size.

### Out of scope for v1 (future work)

- Teacher‑built custom files / lists as a first‑class homework source.
- Per‑assignment restrictions on **specific modes only** (e.g. only Listening & Spelling).
- Complex completion goals (e.g. "80% of maximum stars across all modes with at least 3 sessions").
- Bonus rewards UI (bonus stars/points) – data is pre‑planned but UI/APIs are v2.


## 2. Core Concepts

### 2.1 Entities

**Homework Assignment**
- Created by a teacher for **one class**.
- Targets a specific **English Arcade wordlist** (using a file path key) and a soft display name.
- Has:
  - Class
  - Title and description
  - Wordlist key + soft title + metadata
  - Start and due dates
  - Completion goal (stars‑based), with accuracy shown but **not used** for "doneness".
  - Status: `active`, `ended`, or `archived`.

**Homework Progress**
- Aggregated metrics for a **student for a given assignment**.
- Contains:
  - Attempts and accuracy (for insight only).
  - Stars earned and a stars‑based completion ratio.
  - Completion status derived from stars + teacher overrides.
  - Optional "flag topics" with weak areas.
  - Optional bonus rewards (future).

**Wordlist Registry Entry** (conceptual)
- A logical description of an **English Arcade list** available to assign.
- Contains:
  - `file_path` (canonical key) – e.g. `Games/english_arcade/sample-wordlists-level3/Activities1.json`.
  - `title` (soft name) – e.g. `Level 3 • Activities 1`.
  - `tags` (topics) – e.g. `["present", "daily routines", "verbs"]`.
  - `level`, optional description, etc.
- Teachers search over **title + metadata + raw filename**.


## 3. UX Design – Teacher (Student Tracker)

Homework Mode lives entirely inside the existing **Student Tracker tool** at:
`Teachers/tools/student_tracker/`.

### 3.1 Navigation

The top navigation already has a **Homework** tab:

- `Student Tracker` tab – existing leaderboard + per‑student charts.
- `Class Tracker` tab – existing per‑class top‑3 students view.
- **`Homework` tab – new**: the main hub for assigning and tracking homework.

Clicking `Homework` switches to `#homework-content`.

### 3.2 Layout

Target layout mirrors the **Class Tracker** split‑panel layout:

- **Left column (card): Classes & Assign Button**
  - Scrollable list of classes the teacher can see.
  - Each item shows the **display class name** (e.g. `New York` instead of `NY`).
  - Active class is highlighted.
  - Top toolbar on this card includes an **`Assign Homework`** button.

- **Right column (card): Current Assignment + Students + History**
  - **Section A – Current Assignment summary**
    - Title and class.
    - Due date (`Due: Nov 30`).
    - Status: `Active` or `Ended`.
    - Quick stats:
      - `N / M students complete`.
      - Average completion percentage (stars‑based).
      - Optional average accuracy.
    - Buttons:
      - `End assignment` (if status = `active`).
      - `Assign new homework` (shortcut to modal, same as left‑side button).

  - **Section B – Student list for this class**
    - Table columns:
      - English Name
      - Korean Name
      - Status (`Not started / In progress / Complete`)
      - Completion % (stars‑based)
      - Accuracy % (for teacher insight only)
    - Clicking a row selects that student and populates Section C.

  - **Section C – Student details & History**
    - For the selected student + current assignment:
      - Assignment title.
      - Completion % (stars‑based).
      - Accuracy %.
    - `View history` button toggles a small history list:
      - Table columns:
        - Homework Title
        - Date finished
        - Completion % (stars‑based)
      - Shows past assignments for this student in this class.

  - **Per‑student controls (future)**
    - For v1, a teacher action to **"Mark complete"** may be exposed either in:
      - A per‑row action (icon in Status column), or
      - Within Section C ("Mark this student complete").

### 3.3 Assign Homework Modal

The Homework tab exposes a modal launched by:

- `Assign Homework` button in the left column, or
- `Assign new homework` button in the right column.

**Modal content (v1)**

- **Class** (read‑only or dropdown):
  - Pre‑filled with the currently selected class.

- **Search for list** (text input):
  - Teachers type queries like `present`, `verbs`, `animals`, etc.
  - Debounced search calls a **wordlist search API**.
  - Search matches **title + tags/metadata + raw file names**.

- **Search results list**
  - Each result row shows:
    - Soft title (e.g. `L3 • Present Simple 1`).
    - Short snippet or tags (e.g. `present tense, daily routines`).
    - Raw file path (small, for power users).
  - Teacher chooses one; selected row is highlighted.

- **Assignment fields**
  - `Assignment title` – defaults to the wordlist title; editable.
  - `Description` – optional notes to teachers/students.
  - `Start date/time` – defaults to "now"; can be left as is in v1.
  - `Due date` – required; date (and optionally time) picker.
  - **Completion goal (v1)** – simple, stars‑based:
    - For v1, we can hide the UI and use a sensible default, or show a basic control:
      - e.g. "Target stars: 5" for that list.
      - Internally stored as `goal_type = 'stars'` and `goal_value`.

- **Actions**
  - `Assign` – calls Homework API to create a new assignment.
  - `Cancel` – closes modal.

Success path:

- New assignment is created for that class.
- Homework tab refreshes current class view:
  - Shows the new assignment in Section A.
  - Resets per‑student status (likely `Not started`).


## 4. UX Design – Student

Homework is surfaced to students via existing Student‑facing surfaces.

### 4.1 Student Dashboard – "Your Work"

File: `students/dashboard.html` and `students/dashboard.css`

Existing card:

- Title: `Your Work`.
- Subtitle: `Class`.
- Content currently shows a `Coming soon` placeholder inside `.homework-scroll`.

Planned behaviour:

- Replace placeholder with a **table of current or recent homework**:

  - Columns:
    - Title
    - Class
    - Due date
    - Status (`Not started / In progress / Complete / Ended`)
    - Completion % (stars‑based)

  - Each row is clickable:
    - Clicking opens English Arcade at the correct list and mode for that assignment.

- Under the hood, this table is populated via a Student‑scoped Homework API endpoint (e.g. `list_for_student`).

### 4.2 English Arcade – Launching an Assignment

File: `Games/english_arcade/index.html` & `main.js`

- When a student selects homework from the dashboard, they are redirected to English Arcade with a query string, e.g.:
  - `/Games/english_arcade/index.html?homework_id=UUID`

Homework launch behaviour (conceptual):

- On load, English Arcade main script:
  - Detects `homework_id` in the URL.
  - Calls a Student‑scoped Homework API endpoint to:
    - Validate access.
    - Resolve `list_key` (file path) and some metadata.
  - Preloads and starts the game in **homework mode**:
    - Uses `list_key` to load the correct wordlist.
    - May restrict UI (e.g. show a "Homework" badge, or limit which modes are available in v1 or v2).
  - For every session started while in homework mode:
    - Pass `assignment_id` into `startSession` so Supabase can tie sessions to that assignment.


## 5. Data Model (Supabase SQL)

> NOTE: Actual SQL migration text will be written separately and can be placed in `supabase/migrations/YYYYMMDD_homework.sql`.

### 5.1 `homework_assignments` table

**Purpose**: one row per assignment created by a teacher for a single class.

Key fields (planned):

- `id uuid primary key default gen_random_uuid()`
- `created_at timestamptz not null default now()`
- `created_by uuid not null references profiles(id)`
  - Teacher/admin who created this assignment.

- `class text not null`
  - Must match `profiles.class` for students.

- `title text not null`
  - Teacher/student‑visible title; may differ from list title.

- `description text`
  - Optional notes.

- **Wordlist linkage**:
  - `source_type text not null default 'wordlist'` check `source_type in ('wordlist')` (extensible later).
  - `list_key text not null`
    - Canonical identifier, e.g. `Games/english_arcade/sample-wordlists-level3/Activities1.json`.
  - `list_title text not null`
    - Soft display name (e.g. `Level 3 • Activities 1`).
  - `list_meta jsonb`
    - Optional metadata: tags, level, description.

- **Scheduling**:
  - `start_at timestamptz not null default now()`
  - `due_at timestamptz` – optional but strongly recommended.

- **Assignment status**:
  - `status text not null default 'active'` with check on `('active','ended','archived')`.
  - `ended_at timestamptz` – when teacher explicitly ends the assignment.

- **Completion goal (stars‑based)**:
  - `goal_type text` – v1: `'stars'` (nullable if default used).
  - `goal_value numeric(5,2)` – semantics depend on `goal_type`:
    - For `stars`, can be interpreted as "target number of stars" or a ratio; see API contract.
  - `allow_manual_complete boolean not null default true`.

Indexes:

- `idx_homework_assignments_class` on `(class)`.
- `idx_homework_assignments_created_by` on `(created_by)`.
- `idx_homework_assignments_status` on `(status)`.

### 5.2 `homework_progress` table

**Purpose**: aggregated status per student per homework assignment.

Key fields (planned):

- `id uuid primary key default gen_random_uuid()`
- `assignment_id uuid not null references homework_assignments(id) on delete cascade`
- `student_id uuid not null references profiles(id) on delete cascade`
- `class text not null`
  - Copied from assignment / student profile for easier filtering.

- **Timeline**:
  - `first_started_at timestamptz`
  - `last_updated_at timestamptz`
  - `completed_at timestamptz`

- **Performance metrics** (for insight only, not main completion rule):
  - `sessions_count integer not null default 0`
  - `attempts integer not null default 0`
  - `correct integer not null default 0`
  - `accuracy numeric(5,2)` – 0–100.

- **Completion metrics (stars‑based)**:
  - `stars_earned integer` – effective star total from relevant sessions.
  - `stars_goal numeric(5,2)` – copy/derivative of assignment goal.
  - `completion_ratio numeric(5,2)` – 0–100, e.g. `(stars_earned / stars_goal) * 100` with clamp.

- **Teacher overrides and rewards**:
  - `manual_complete boolean not null default false`
  - `bonus_stars integer not null default 0`
  - `bonus_points integer not null default 0`

- **Weak areas**:
  - `flag_topics jsonb`
    - Example shape: `[ { word: 'do homework', accuracy: 45 }, { grammar_bucket: 'present_simple', accuracy: 52 } ]`.

Uniqueness and indexes:

- Unique constraint: `(assignment_id, student_id)`.
- Index on `(assignment_id, class)`.
- Index on `(student_id)`.

### 5.3 Derived status logic

Derived (non‑stored) status categories per student:

- `not_started`:
  - `sessions_count = 0` AND `stars_earned IS NULL OR stars_earned = 0`.

- `complete` if any of:
  - `manual_complete = true`, OR
  - `goal_type = 'stars'` and `stars_goal IS NOT NULL` and `stars_earned >= goal_value`.

- `in_progress` otherwise (at least one session / some stars but not meeting goal and not manually complete).

**Important**: accuracy is shown but **does not influence** `complete` vs `in_progress`.


## 6. Backend APIs (Netlify Functions)

A new Netlify function is introduced, e.g.: `netlify/functions/homework_api.js`.

### 6.1 Auth & roles

- Uses the same cookie/session pattern as:
  - `progress_teacher_summary.js` (teacher side).
  - `teacher_admin.js` (for admin/teacher role checking).

- Roles:
  - **Teacher/Admin** – can:
    - Create assignments for their classes.
    - View tracker data.
    - End assignments.
    - Manually mark students complete.
  - **Student** – can:
    - List their visible assignments (`list_for_student`).
    - Resolve an assignment for play (`get_assignment_for_play`).

### 6.2 Planned endpoints

All endpoints share the same handler with `action` query parameter, similar to existing functions.

#### 6.2.1 Teacher endpoints

1. `GET homework_api?action=list_assignments_for_teacher&class=CLASS`

- **Purpose**: List assignments for a given class for the logged‑in teacher.
- Response shape (example):

  ```json
  {
    "success": true,
    "assignments": [
      {
        "id": "uuid",
        "class": "NY",
        "title": "Level 3 • Activities 1",
        "list_title": "Level 3 • Activities 1",
        "list_key": "Games/english_arcade/sample-wordlists-level3/Activities1.json",
        "status": "active",
        "start_at": "...",
        "due_at": "...",
        "goal_type": "stars",
        "goal_value": 5
      }
    ]
  }
  ```

2. `POST homework_api?action=create_assignment`

- **Body** (JSON):

  ```json
  {
    "class": "NY",
    "title": "Present Simple – Daily Routines",
    "description": "Complete this before Friday.",
    "list_key": "Games/english_arcade/sample-wordlists-level3/Activities1.json",
    "list_title": "Level 3 • Activities 1",
    "list_meta": { "tags": ["present", "routines"], "level": 3 },
    "start_at": "2025-11-21T00:00:00Z",
    "due_at": "2025-11-25T23:59:00Z",
    "goal_type": "stars",
    "goal_value": 5
  }
  ```

- **Response**: `{ success, assignment }`.

3. `GET homework_api?action=tracker&class=CLASS`

- **Purpose**: For the **current assignment** of the given class (e.g. latest active), return per‑student progress.
- **Response**:

  ```json
  {
    "success": true,
    "class": "NY",
    "assignment": {
      "id": "uuid",
      "title": "Level 3 • Activities 1",
      "status": "active",
      "start_at": "...",
      "due_at": "...",
      "goal_type": "stars",
      "goal_value": 5
    },
    "students": [
      {
        "student_id": "uuid",
        "name": "Alice Kim",
        "korean_name": "\uAE40\uC54C\uB9AC\uC2A4",
        "status": "complete",
        "completion_ratio": 100.0,
        "accuracy": 72.5,
        "sessions_count": 4,
        "last_updated_at": "..."
      },
      {
        "student_id": "uuid2",
        "name": "Bob",
        "korean_name": "\uBC15\uBCF4\uBE0C",
        "status": "in_progress",
        "completion_ratio": 60.0,
        "accuracy": 50.0,
        "sessions_count": 2,
        "last_updated_at": "..."
      }
    ],
    "weak_topics": [
      { "word": "do homework", "accuracy": 45 },
      { "grammar_bucket": "present_simple", "accuracy": 52 }
    ]
  }
  ```

4. `GET homework_api?action=student_history&class=CLASS&student_id=UUID`

- Response: list of past assignments for that student in that class.

  ```json
  {
    "success": true,
    "history": [
      {
        "assignment_id": "uuid",
        "title": "L3 • Animals 1",
        "completed_at": "2025-11-15T12:00:00Z",
        "completion_ratio": 100.0
      }
    ]
  }
  ```

5. `POST homework_api?action=end_assignment`

- Body: `{ "assignment_id": "uuid" }`.
- Sets `status = 'ended'` and `ended_at = now()`.

6. `POST homework_api?action=manual_complete_student`

- Body: `{ "assignment_id": "uuid", "student_id": "uuid" }`.
- Sets `manual_complete = true` and `completed_at = now()` in `homework_progress`.

#### 6.2.2 Student endpoints

1. `GET homework_api?action=list_for_student`

- Uses cookie auth to resolve `student_id` and `class`.
- Returns list of current and maybe recent assignments with progress.

  ```json
  {
    "success": true,
    "assignments": [
      {
        "id": "uuid",
        "class": "NY",
        "title": "L3 • Activities 1",
        "due_at": "2025-11-25T23:59:00Z",
        "status": "active",          // assignment status
        "student_status": "in_progress", // per-student derived status
        "completion_ratio": 60.0,
        "accuracy": 50.0
      }
    ]
  }
  ```

2. `GET homework_api?action=get_assignment_for_play&id=UUID`

- Validates that the assignment is visible to this student.
- Returns the minimal data needed for English Arcade to start the correct list:

  ```json
  {
    "success": true,
    "assignment": {
      "id": "uuid",
      "class": "NY",
      "list_key": "Games/english_arcade/sample-wordlists-level3/Activities1.json",
      "list_title": "L3 • Activities 1",
      "goal_type": "stars",
      "goal_value": 5
    }
  }
  ```


## 7. Frontend Modules – Teacher (Student Tracker)

To keep `main.js` from growing further, homework logic will live in new modules within `Teachers/tools/student_tracker/`.

### 7.1 New JS files

1. `homework-api.js`

- Encapsulates all network calls related to homework.
- Example API:

  ```js
  // homework-api.js
  import { FN, fetchJSON } from './tracker-shared.js';

  const HW_FN = () => FN('homework_api');

  export const HomeworkAPI = {
    listAssignmentsForClass(cls) {
      const url = `${HW_FN()}?action=list_assignments_for_teacher&class=${encodeURIComponent(cls)}`;
      return fetchJSON(url, { credentials: 'include' });
    },
    createAssignment(payload) {
      const url = `${HW_FN()}?action=create_assignment`;
      return fetchJSON(url, {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    },
    trackerForClass(cls) {
      const url = `${HW_FN()}?action=tracker&class=${encodeURIComponent(cls)}`;
      return fetchJSON(url, { credentials: 'include' });
    },
    studentHistory(cls, studentId) {
      const url = `${HW_FN()}?action=student_history&class=${encodeURIComponent(cls)}&student_id=${encodeURIComponent(studentId)}`;
      return fetchJSON(url, { credentials: 'include' });
    },
    endAssignment(assignmentId) {
      const url = `${HW_FN()}?action=end_assignment`;
      return fetchJSON(url, {
        method: 'POST',
        body: JSON.stringify({ assignment_id: assignmentId }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    },
    manualCompleteStudent(assignmentId, studentId) {
      const url = `${HW_FN()}?action=manual_complete_student`;
      return fetchJSON(url, {
        method: 'POST',
        body: JSON.stringify({ assignment_id: assignmentId, student_id: studentId }),
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
    }
  };
  ```

2. `homework-ui.js`

- Responsible for wiring up the Homework tab DOM and rendering data.
- Responsibilities:
  - Initialize Homework tab once when first shown.
  - Load classes (reuse existing class list from `progress_teacher_summary` where possible).
  - For selected class:
    - Call `HomeworkAPI.trackerForClass`.
    - Render assignment header, student table, weak topics.
  - Handle student row click → calls `HomeworkAPI.studentHistory` and updates detail panel.
  - Wire `Assign Homework` and `End assignment` buttons → open modal / call API.

- Exposed API:

  ```js
  // homework-ui.js
  import { HomeworkAPI } from './homework-api.js';

  let homeworkInitialized = false;

  export function initHomeworkTab(context) {
    if (homeworkInitialized) return;
    homeworkInitialized = true;
    // context may include: userRole, classSource, etc.
    // Wire DOM query selectors and events here.
  }

  export function refreshHomeworkForClass(cls) {
    // Re-fetch tracker data and re-render right panel.
  }
  ```

3. `tracker-shared.js` (optional)

- Small helper module to avoid duplication between `main.js`, future modules, and homework modules:
  - `FN(name)` – builds Netlify function URL.
  - `fetchJSON(url, opts)` – wraps `fetch` with JSON/error handling.
  - Formatting helpers: `fmtDate`, `fmtPct`, etc.

### 7.2 Integration with `main.js`

- `student_tracker.html` already loads `main.js` as a module.
- In `main.js`:

  ```js
  import { initHomeworkTab } from './homework-ui.js';

  document.addEventListener('DOMContentLoaded', () => {
    // ...existing Student Tracker setup...

    // Navigation tab switching
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = tab.dataset.tab;

        // ...existing active tab/content logic...

        if (tabName === 'homework') {
          initHomeworkTab({ /* pass any needed context */ });
        }
      });
    });
  });
  ```

- Homework modules do not modify Student Tracker’s existing behaviour; they only operate within `#homework-content`.


## 8. Wordlist Search Design

Teacher wordlist search should:

- Search over:
  - `title`
  - `tags` / metadata
  - `description`
  - **AND raw `file_path`**

- Return enough info to:
  - Show a friendly title to the teacher.
  - Persist a stable file path.
  - Optionally display tags/level.

### 8.1 Expected response shape (conceptual)

Wordlist search API (Netlify function or static JSON wrapper) returns:

```json
{
  "success": true,
  "results": [
    {
      "file_path": "Games/english_arcade/sample-wordlists-level3/Activities1.json",
      "title": "Level 3 • Activities 1",
      "tags": ["present", "daily routines", "verbs"],
      "level": 3,
      "description": "Present simple daily routines."
    }
  ]
}
```

The Homework Assign modal uses `file_path` as `list_key` and `title` as `list_title`.


## 9. Completion Semantics

Key rules based on conversation:

- **Completion is stars‑based, not accuracy‑based.**
  - A student who eventually earns **all available stars** is treated as 100% complete, regardless of how many attempts it took.
  - Accuracy is still shown as an informational metric for teachers, but **does not define "doneness"**.

- **Simple v1 rule**:
  - Use stars metrics from game sessions to compute `stars_earned` and `completion_ratio`.
  - Completion status per student is:
    - `complete` if `manual_complete = true` OR `stars_earned >= goal_value` (for goal_type `stars`).
    - `not_started` if `stars_earned = 0` and no sessions.
    - `in_progress` otherwise.

- **Teacher control**:
  - Teachers can **end assignments** globally (status = `ended`), which tells students they are finished even if not all goals met.
  - Teachers can **manually mark individual students complete** (sets `manual_complete = true`).


## 10. Future Enhancements (beyond v1)

- **Custom teacher files** as homework sources (`source_type = 'builder'`).
- **Mode‑scoped homework** (e.g. only Listening and Spelling modes for a given list).
- **Richer goals**:
  - Minimum number of sessions.
  - Mode‑specific star goals.
  - Combined goals (e.g. "at least 3 sessions and 4/5 stars").
- **Bonus rewards UI**:
  - UI in Homework tab to award `bonus_stars` / `bonus_points`.
  - Display of combined stars (earned + bonus) in Student and Teacher views.
- **More nuanced weak‑area flags**:
  - Use grammar buckets (`identifyGrammarBucket`) and word‑level accuracy.
  - Show recommendations: e.g. "Review L3 • Present Simple – Daily Routines".

---

This design document should be treated as the source of truth while implementing Homework Mode in the Student Tracker and related frontends/backend services.
