# Homework Teacher Control Features - Implementation Ideas

## Current State

### API Structure (Cloudflare Worker)
- **Assignments table fields:**
  - `class`, `title`, `description`, `list_key`, `list_title`, `list_meta`
  - `start_at`, `due_at`
  - `goal_type` (currently hardcoded to `'stars'`)
  - `goal_value` (currently hardcoded to `5`)
  - `active`, `created_by`
  - `list_meta` - currently stores: `tags`, `level`, `type` (allows custom JSON)

### Modal Interface (Teacher Side)
- **homework-modal.js** - Creates assignments with:
  - Class selection
  - Wordlist/grammar selection
  - Title & description
  - Due date selector
  - `goal_type` and `goal_value` hardcoded in assignment creation (line 432-433)

### Progress Display (Student Tracker)
- **main.js** - Shows homework progress with:
  - Completion % (calculated as `modes_attempted / total_modes`)
  - Star count
  - Accuracy %
  - Mode breakdown
  - `total_modes` heuristically calculated or from `list_meta.modes_total`

---

## Feature Ideas (Easiest → Most Complex)

### 1. **Star Threshold Control** ⭐ EASY
**What:** Let teachers set required stars per mode or total stars needed
**Current:** `goal_value` field exists but always set to 5 total stars

**Implementation:**
- Add numeric input in homework creation modal for "required stars" (1-30)
- Store in assignment: `goal_type: 'stars'`, `goal_value: teacher_input`
- API already supports this - just needs UI
- Progress tracker already displays stars - just add visual indicator if "goal reached"

**Files to change:**
- `homework-modal.js` (add input field, pass to API)
- Progress display already supports it

**Effort:** 30 minutes

---

### 2. **Mode Requirement Checkboxes** ⭐⭐ EASY-MEDIUM
**What:** Teachers check which modes students MUST complete
**Example:** For vocab - require `match` and `spelling`, but make `level_up` optional

**Current:** All modes required equally

**Implementation:**
- Store in `list_meta.required_modes: ['match', 'spelling']`
- Add checkboxes in modal showing available modes for selected list
  - Vocab: match, listen, read, spell, test, level_up
  - Grammar L1: lesson, choose, fill, unscramble
  - Grammar L2+: sorting, choose, fill, unscramble, find_mistake, translation
  - Phonics: listen, read, spell, test
- Completion = `(student_modes_with_≥1_star ∩ required_modes) / required_modes.length`

**Files to change:**
- `homework-modal.js` (add mode selection UI, checkboxes)
- `cloudflare-workers/homework-api/src/index.js` (respect required_modes in progress calc)
- `main.js` (update completion percentage calculation)

**Effort:** 1-2 hours

---

### 3. **Per-Mode Star Requirements** ⭐⭐⭐ MEDIUM
**What:** Different star thresholds for different modes (e.g., "3 stars in listening, 2 in spelling")

**Current:** All modes use same threshold

**Implementation:**
- Store in `list_meta.mode_requirements: { 'match': 3, 'spelling': 2, 'listen': 2 }`
- Add table/input grid in modal showing each mode with star input
- Completion = all required modes meet their star threshold
- Progress display shows per-mode requirements

**Files to change:**
- `homework-modal.js` (add mode requirements table UI)
- `homework-api` (check each mode against its requirement)
- `main.js` (display mode-by-mode status)

**Effort:** 2-3 hours

---

### 4. **Percentage Completion Targets** ⭐⭐ EASY
**What:** Teacher sets "students must complete 70% of modes" instead of all

**Current:** Completion = modes_attempted / total_modes = 100%

**Implementation:**
- Add "completion requirement %" input in modal (50%, 75%, 100%)
- Store in assignment: `goal_type: 'completion_percent'`, `goal_value: 75`
- API calculates: `(modes_with_≥1_star / total_modes) >= threshold`
- Show status as "75/100 modes completed (75% of 75% required) ✅"

**Effort:** 45 minutes

---

### 5. **Accuracy/Performance Requirements** ⭐⭐⭐ MEDIUM
**What:** Require minimum accuracy per mode (e.g., "80% in all modes")

**Current:** Only star count tracked, not accuracy

**Implementation:**
- Add "minimum accuracy %" input in modal
- Store in assignment: `goal_type: 'accuracy'`, `goal_value: 80`
- Progress checks: `modes_with_≥1_star AND accuracy_in_that_mode >= threshold`
- API already fetches accuracy data

**Files to change:**
- `homework-modal.js` (add accuracy input)
- `homework-api` (filter by accuracy in progress calc)
- `main.js` (display accuracy requirement indicator)

**Effort:** 1.5 hours

---

### 6. **Mixed Goals (AND/OR Logic)** ⭐⭐⭐⭐ COMPLEX
**What:** "3 stars in any 5 modes" OR "complete all modes with 2+ stars"

**Implementation:**
- Store: `goal_type: 'custom'`, `goal_rules: [{ type: 'stars', value: 3, count: 5, logic: 'any' }]`
- More flexible but requires modal redesign

**Effort:** 4+ hours

---

## Recommended Quick Wins (Start Here)

1. **Star Threshold** (#1) - 30 min, very useful
2. **Mode Selection** (#2) - 1-2 hours, huge UX improvement
3. **Percentage Completion** (#4) - 45 min, simpler alternative to #2

These three would give teachers solid control without major refactoring.

---

## Data Storage Strategy

All new fields can live in `list_meta` (JSON object), which:
- ✅ Already exists and is flexible
- ✅ Is sent to the API
- ✅ Doesn't require database migrations
- ✅ Can be extended without breaking existing assignments

Example structure:
```javascript
list_meta: {
  tags: [],
  level: 2,
  type: 'wordlist',
  // New fields
  required_modes: ['match', 'spelling', 'test'],
  mode_requirements: { 'match': 3, 'spelling': 2 },
  min_accuracy_percent: 80,
  completion_target_percent: 75
}
```

---

## Estimated Total Effort

| Feature | Effort | Impact |
|---------|--------|--------|
| Star Threshold | 30 min | High |
| Mode Selection | 1-2 hrs | Very High |
| Percentage Completion | 45 min | Medium |
| Per-Mode Requirements | 2-3 hrs | Very High |
| Accuracy Requirements | 1.5 hrs | Medium |
| Mixed Goals | 4+ hrs | Low (complexity) |

**Quick implementation path:** #1 + #2 + #4 = ~3 hours total for maximum teacher control

