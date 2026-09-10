# Willena Daily Journal — Product, Technical Spec & Build Plan

Status: Draft v0.2  
Target: Staging first  
App path: `/students/daily-journal/`

## 1. Purpose

Build a daily journaling app that helps Willena students become better writers without replacing their own voice.

The student writes an authentic diary about today or anything they choose, reaches a required sentence target, receives restrained AI correction, reviews the corrected English, then reads every corrected sentence aloud using STT. Both the exact original and corrected writing are saved for teacher viewing.

The app should feel like a daily mission, not a test.

---

## 2. Core Product Rules

### Preserve the student's voice

AI correction must make the smallest reasonable changes needed for clear, correct English.

It must:

- preserve factual details
- preserve opinions and feelings
- preserve intended meaning
- preserve age-appropriate/simple vocabulary when it works
- fix grammar, spelling, capitalization, punctuation, word form, tense, articles, prepositions, and clearly unnatural English
- avoid rewriting child English into polished adult prose
- never invent events, feelings, reasons, people, or details

### Writing comes before correction

Students finish their own writing before correction appears. No live grammar warnings while composing.

### Original writing is never destroyed

Save the exact original submission separately from every corrected/reviewed representation.

### Completion matters more than scoring

No daily numeric AI writing score in v1. The emphasis is writing, improvement, speaking, and completion.

---

## 3. Student Flow

### Step 1 — Daily Mission

Default mission:

> Write about your day.

Optional idea prompts can include what happened, how the student felt, who they spent time with, and what they want to remember.

Always provide:

> Write about anything

The prompts help students start; they do not constrain the diary topic.

### Step 2 — Sentence Target

Each session requires between 6 and 20 sentences.

Suggested starting defaults:

- Beginner: 6
- Elementary: 8
- Lower-intermediate: 10
- Intermediate: 12
- Stronger writers: 15–20

The target must be configurable rather than hard-coded.

Show live progress such as `5 / 8 sentences`. Sentence counting must be tolerant of children's punctuation and must not rely only on full stops.

### Step 3 — Free Writing

Requirements:

- large comfortable writing area
- automatic draft saving
- sentence progress indicator
- no live AI correction
- no red grammar marks while composing
- refresh/navigation recovery where practical
- submit enabled when target is reached
- student may exceed the target

### Step 4 — AI Correction

Submitting sends the student's writing to Luna through Willena's existing OpenAI pathway.

The AI returns structured data, not HTML.

Conceptual response:

```json
{
  "sentences": [
    {
      "order": 1,
      "original": "Today I go school and I was very tired.",
      "corrected": "Today I went to school and I was very tired.",
      "changes": [
        {
          "type": "grammar",
          "original": "go",
          "corrected": "went",
          "reason": "Past tense"
        }
      ]
    }
  ]
}
```

The client validates the expected shape before using/saving the result. A malformed AI response must fail safely without losing the original diary.

### Step 5 — Correction Review

Review one sentence at a time.

Show:

- **Your sentence** — the exact original
- **Better English** — corrected version
- changed word/phrase emphasis
- a short child-friendly explanation when useful

Avoid an aggressive red/error-heavy interface. If a sentence needs no correction, say so rather than manufacturing a change.

At the end show the complete corrected diary.

### Step 6 — Speak the Corrected Diary

The student must read each corrected sentence aloud.

STT validation should tolerate:

- punctuation/capitalization differences
- contractions
- minor STT mistakes
- harmless filler
- common child-pronunciation/STT variation

Initial experiment: roughly 80–85% normalized similarity with extra importance given to content words. This must remain configurable after real student testing.

If accepted, advance. If not, ask for another attempt. After repeated difficulty provide support such as TTS and never trap a student indefinitely because recognition fails.

### Step 7 — Completion

Example:

> Diary Complete  
> 10 sentences written  
> 7 sentences improved  
> 10 sentences spoken

Points/streaks may be added later but are not required for v1.

---

## 4. AI Correction Contract

The journal correction prompt must explicitly require:

1. Keep the student's meaning.
2. Keep the student's feelings and opinions.
3. Do not add facts.
4. Do not remove meaningful facts unless required for intelligibility.
5. Prefer the smallest possible correction.
6. Keep vocabulary near the student's demonstrated level.
7. Keep simple sentences simple when they are valid.
8. Fix genuine English errors.
9. Improve clearly unnatural wording only when needed.
10. Do not turn the diary into native-level creative writing.
11. Keep sentence order unless a small structural repair is necessary.
12. Return machine-readable structured output only.

Example good correction:

> Today I went to school and I was very tired. My friend made me angry because he took my pencil. But lunch was delicious.

Example bad correction:

> I attended school today despite feeling rather exhausted. I became frustrated when a classmate unexpectedly took my pencil, although lunchtime improved my mood.

The second version changes the child's voice and must be avoided.

---

## 5. Existing OpenAI Pathway — Reuse, Do Not Rebuild

Staging already has the shared OpenAI proxy:

```text
/.netlify/functions/openai_proxy
```

Implementation file:

```text
netlify/functions/openai_proxy.js
```

Existing Willena tools call this through:

```js
WillenaAPI.fetch('/.netlify/functions/openai_proxy', ...)
```

The proxy already holds the server-side OpenAI credential (`OPENAI_API`) and forwards requests to the OpenAI API. It supports a generic request shape using `endpoint` plus `payload` as well as older convenience behavior.

### Journal decision

**Do not build another OpenAI proxy, Edge Function, API-key system, or browser-side OpenAI client for Daily Journal.**

Daily Journal will reuse the existing shared proxy through `WillenaAPI.fetch`.

The old convenience request shape that sends only `{ prompt }` currently builds its own `chat/completions` payload and hard-codes `gpt-3.5-turbo`. Daily Journal should therefore **not use the legacy prompt shortcut**.

Instead, Daily Journal should call the existing proxy's generic `endpoint + payload` pathway so the journal request can explicitly use Luna and the required structured correction messages/options.

Conceptually:

```js
WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: 'chat/completions',
    payload: {
      model: LUNA_MODEL,
      messages: JOURNAL_MESSAGES,
      // structured-output configuration used by the selected model/API
    }
  })
});
```

`LUNA_MODEL` should use the actual model identifier/configuration available to the existing Willena OpenAI account at build time. We do not need a new infrastructure pathway merely to select it.

The new journal-specific code is limited to:

- journal correction instructions
- request payload
- structured response contract
- validation/error handling

Existing proxy, API-key handling, CORS/API routing, and `WillenaAPI.fetch` infrastructure remain shared.

---

## 6. Persistence and Resume

Persist enough state to restore an interrupted activity:

- student
- mission/prompt
- target
- current original draft
- corrected result after correction
- correction-review position
- speaking progress
- timestamps/status

Completed original writing is historical data and must never be overwritten by AI output or later teacher metadata.

---

## 7. Initial Data Model

Exact columns should be reconciled with the current Supabase schema during the database step.

### `journal_entries`

- `id`
- `student_id`
- `mission_id` nullable
- `prompt_text`
- `target_sentences`
- `original_text`
- `corrected_text`
- `original_sentence_count`
- `status`: `draft | correcting | review | speaking | completed`
- `ai_model`
- `ai_metadata` jsonb
- `started_at`
- `submitted_at`
- `completed_at`
- `created_at`
- `updated_at`

### `journal_sentences`

- `id`
- `journal_entry_id`
- `sentence_order`
- `original_sentence`
- `corrected_sentence`
- `changes` jsonb
- `speech_completed`
- `speech_attempts`
- `speech_best_score`
- `created_at`
- `updated_at`

### `journal_speech_attempts`

- `id`
- `journal_sentence_id`
- `student_id`
- `transcript`
- `normalized_transcript`
- `match_score`
- `accepted`
- `created_at`

Raw audio is not part of v1 unless a separate educational/privacy decision is made.

---

## 8. Teacher View

Teacher overview should show, at minimum:

| Student | Today | Sentences | Corrections | Speaking |
|---|---|---:|---:|---|
| Bruno | Complete | 8 / 8 | 5 | Complete |
| Liam | Writing | 4 / 8 | — | — |
| Jenny | Not started | — | — | — |

Opening an entry shows:

- date
- mission/prompt
- exact original diary
- corrected diary
- sentence-by-sentence changes
- speaking completion
- timestamps/status

Future aggregate grammar analytics can come later after the correction categories prove reliable.

---

## 9. Privacy and Access

Student journals may contain personal information and feelings.

Requirements:

- send only correction-relevant content to the AI
- use existing server-side OpenAI proxy; never expose the API key in browser code
- authenticate student identity using existing Willena patterns
- appropriate Supabase RLS/access rules
- student can access only their own journal data
- authorized teacher can view the appropriate students
- AI correction focuses on English and does not invent psychological interpretations

A separate safeguarding/escalation system is outside v1 and must not be silently delegated to the language model.

---

## 10. App Structure

Initial folder:

```text
students/daily-journal/
├── SPEC.md
├── index.html
├── journal.css
├── journal.js
├── modules/
│   ├── session.js
│   ├── sentence-counter.js
│   ├── correction-review.js
│   ├── speech-practice.js
│   └── journal-api.js
└── README.md
```

Where practical reuse existing Willena modules/patterns for student auth, shared student header/navigation, styling/theme, Supabase access, STT/TTS, and teacher authorization.

---

# 11. BUILD PLAN

The first objective is a complete vertical slice on **staging**. Do not add secondary features before the write → correct → review → speak → teacher-view loop works reliably.

## Phase 1 — Inspect and Lock Reusable Pieces

No feature implementation yet.

Identify the exact staging files/modules to reuse for:

- student authentication/current student ID
- shared student header/navigation
- Supabase client/data access
- STT
- TTS
- `WillenaAPI.fetch`
- teacher authentication/student visibility

OpenAI is already resolved: reuse `/.netlify/functions/openai_proxy` through `WillenaAPI.fetch` using its generic endpoint/payload mode.

**Output:** short implementation map in this spec/README with exact file names and dependencies.

## Phase 2 — Database Foundation

Create the journal persistence layer and access rules.

Build:

- `journal_entries`
- `journal_sentences`
- `journal_speech_attempts`
- indexes/relationships required for student/date lookups
- RLS/access policies following existing Willena conventions

Test independently:

- student can create/update own draft
- another student cannot read it
- authorized teacher can read it
- original submission is not overwritten by correction

**Milestone:** journal data can safely survive reload before any AI UI exists.

## Phase 3 — Writing Mission + Editor

Build the first student-facing vertical slice:

- Daily Journal page using the shared student shell/header
- “Write about your day” mission
- “Write about anything” option
- optional idea prompts
- target between 6 and 20
- large writing editor
- robust sentence counter
- autosave
- resume unfinished draft
- submit when target reached

Do not add correction UI yet.

**Milestone:** student can start a diary, write it, refresh/leave/reopen, and get the same draft back.

## Phase 4 — Luna Correction Through Existing Proxy

Add `journal-api.js` around the **existing** OpenAI proxy.

Build only the journal-specific layer:

- correction system/developer instructions
- Luna payload through generic `endpoint + payload`
- structured sentence response
- response validation
- retry/error state
- persistence of exact original + corrected output

Test especially for over-rewriting. Use deliberately messy real child-style English and verify that facts, feelings, vocabulary level, and sentence personality remain intact.

**Milestone:** submitting a diary reliably produces a minimally corrected structured version without creating new AI infrastructure.

## Phase 5 — Correction Review Experience

Build:

- sentence-by-sentence review
- original sentence
- corrected sentence
- changed text emphasis
- brief explanation
- “no change needed” state
- forward/back navigation
- final complete corrected diary
- persisted review position

**Milestone:** a student can understand what was fixed without feeling that AI rewrote their diary.

## Phase 6 — STT Read-Back

Reuse the existing Willena STT/TTS pathway rather than making another speech system.

Build:

- one corrected sentence at a time
- microphone interaction
- transcript normalization
- configurable approximate matching
- content-word-aware acceptance
- retry state
- TTS listen support where available
- sensible fallback after repeated recognition failure
- speaking progress persistence

The activity cannot be marked fully completed until the speaking stage has been completed/fallback-resolved.

**Milestone:** a student can read the corrected diary aloud from beginning to end without STT becoming punitive.

## Phase 7 — Completion + History

Build:

- completion screen
- sentences written
- sentences corrected/improved
- sentences spoken
- save final completion timestamp
- student recent-journal/history entry if appropriate to the current student UX

Do not add scores, streak economy, or detailed analytics yet.

## Phase 8 — Teacher View

Add a simple teacher-facing view using the existing teacher auth/navigation patterns.

Build:

- recent/today journal list by student
- not started / writing / correction / speaking / complete status
- target vs written count
- original diary
- corrected diary
- sentence-level changes
- speech completion
- date/history navigation

Teacher must always be able to see the child's authentic original writing.

**Milestone:** teacher can immediately tell who wrote, what they originally wrote, how it was corrected, and whether they spoke it.

## Phase 9 — Staging Hardening

Test the complete journey on actual staging, especially mobile/tablet.

Cases:

- refresh during writing
- leave and return
- refresh during correction/review
- slow/failed AI request
- malformed AI response
- double-tap submit
- diary longer than target
- weak/missing punctuation
- zero corrections needed
- microphone permission denied
- STT false negatives
- reload halfway through speaking
- student isolation/RLS
- teacher visibility
- duplicate diary/session prevention

Then test correction quality across multiple Willena levels.

**Milestone:** full journey is reliable enough for a small real-student trial.

## Phase 10 — Small Student Trial, Then Tune

Trial with a small group before production rollout.

Tune from evidence:

- sentence counting
- target defaults
- correction prompt strictness
- Luna output consistency
- correction explanation length
- STT similarity threshold
- retry/fallback behavior
- mobile spacing/text size

Only after this should we consider production deployment or secondary features.

---

## 12. Explicitly Out of Scope for the First Build

- new OpenAI proxy/API infrastructure
- numeric AI writing score
- leaderboards
- detailed grammar trend analytics
- parent reports
- streak economy
- raw audio storage
- AI-generated diary content
- live correction while the child is writing
- production deployment before staging validation

---

## 13. Definition of Done for v1

v1 is done when, on staging:

1. An authenticated student can open Daily Journal.
2. They receive a mission and sentence target between 6 and 20.
3. Their draft autosaves and survives reload/navigation.
4. They can submit authentic writing after meeting the target.
5. Luna corrects it through the existing `openai_proxy` pathway.
6. Correction preserves the student's facts, feelings, meaning, and approximate voice.
7. The exact original remains stored separately.
8. Student can review every corrected sentence.
9. Student can read every corrected sentence through STT with tolerant matching.
10. The activity records completion.
11. An authorized teacher can see the original, correction, and speaking/completion state.
12. Other students cannot access the entry.
13. The complete flow survives normal refresh/error conditions without losing the diary.

The AI's role is to improve the student's English — not replace the student's writing.
