# Willena Daily Journal — Product & Technical Spec

Status: Draft v0.1  
Target: Staging first  
App path: `/students/daily-journal/`

## 1. Purpose

Build a daily journaling app that helps Willena students become better writers without replacing their own voice.

The app should encourage students to write regularly about their real day, thoughts, feelings, interests, or anything they choose. AI should correct the English while preserving the student's original meaning, emotional tone, vocabulary level, and personal style as much as possible.

The finished activity combines:

1. Free writing
2. AI-assisted correction
3. Student review of corrections
4. Speaking the corrected version aloud using STT
5. Saving both the original and corrected diary for teacher viewing

The app should feel like a daily mission rather than a test.

---

## 2. Core Principles

### Preserve the student's voice

AI correction must make the smallest reasonable changes needed for clear, correct English.

It should:

- preserve factual details
- preserve opinions and feelings
- preserve the student's intended meaning
- preserve age-appropriate/simple vocabulary when it works
- fix grammar, spelling, capitalization, punctuation, word form, tense, articles, prepositions, and clearly unnatural English
- avoid rewriting simple child English into polished adult prose
- never invent new events, feelings, reasons, people, or details

### Writing comes before correction

Students should finish their own writing before AI correction is shown. The app must not interrupt free writing with live grammar warnings.

### Original writing is never destroyed

Always save the exact original submission as well as the corrected version.

### Completion matters more than scoring

Do not give students a daily numeric AI writing score in the first version. Reward completion, consistency, improvement, and speaking practice instead.

---

## 3. Student Flow

### Step 1 — Daily Mission

Landing screen presents a writing mission.

Default mission:

> Write about your day.

Optional supporting prompts may include:

- What happened today?
- What made you happy, annoyed, excited, surprised, or tired?
- Who did you spend time with?
- What do you want to remember about today?

Students should also have:

> Write about anything

The mission should encourage ideas without forcing a topic.

### Step 2 — Sentence Target

Each journal session has a required sentence target between 6 and 20 sentences.

The target should be configurable by student, class, level, or teacher assignment rather than hard-coded into the writing engine.

Suggested defaults:

- Beginner: 6 sentences
- Elementary: 8 sentences
- Lower-intermediate: 10 sentences
- Intermediate: 12 sentences
- Stronger writers: 15–20 sentences

UI should clearly show progress, for example:

> 5 / 8 sentences

Sentence counting should be tolerant of children's punctuation and should not depend only on periods.

### Step 3 — Free Writing

Student writes the full diary before correction.

Requirements:

- large comfortable writing area
- automatic draft saving
- sentence progress indicator
- no live AI correction
- no red grammar marks while composing
- session survives ordinary refresh/navigation where possible
- clear submit action once the sentence target is reached

The student may write more than the target.

### Step 4 — AI Correction

When the student submits the diary, the app sends the writing to the AI correction service.

Target model: Luna through the OpenAI API, subject to the API/model configuration used by Willena at implementation time.

The AI response should be structured data, not generated HTML.

Expected output concept:

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
        },
        {
          "type": "grammar",
          "original": "go school",
          "corrected": "go to school",
          "reason": "Use 'to' before school here"
        }
      ]
    }
  ]
}
```

The server must validate AI output before saving/displaying it.

### Step 5 — Correction Review

Show corrections sentence by sentence.

Example presentation:

**Your sentence**  
Today I go school and I was very tired.

**Better English**  
Today I **went to** school and I was very tired.

Small explanation:

> `go → went` because you are talking about something that already happened.

Requirements:

- visually emphasize changed words/phrases
- avoid overwhelming red/error-heavy styling
- retain access to the original sentence
- use concise explanations a student can understand
- allow moving through corrections one sentence at a time
- if a sentence needs no changes, explicitly celebrate that rather than fabricating a correction

At the end, show the complete corrected diary.

---

## 4. AI Correction Rules

The correction prompt/service must explicitly instruct the model to follow these rules.

### Required behavior

1. Keep the student's meaning.
2. Keep the student's feelings and opinions.
3. Do not add facts.
4. Do not remove meaningful facts unless necessary for intelligibility.
5. Prefer the smallest possible correction.
6. Keep vocabulary near the student's demonstrated level.
7. Keep simple sentences simple when they are valid.
8. Fix genuine English errors.
9. Improve clearly unnatural wording only when needed.
10. Do not turn the diary into native-level creative writing.
11. Keep sentence order unless a small structural repair is necessary.
12. Return machine-readable structured output only.

### Example

Student:

> Today I go school and I was very tired. My friend make me angry because he take my pencil. But lunch was delicious.

Good correction:

> Today I went to school and I was very tired. My friend made me angry because he took my pencil. But lunch was delicious.

Bad correction:

> I attended school today despite feeling rather exhausted. I became frustrated when a classmate unexpectedly took my pencil, although lunchtime improved my mood.

The bad version changes the student's voice and should be prevented by prompt design and validation.

---

## 5. Speaking / STT Stage

After correction review, students must read the corrected diary aloud.

The speaking stage uses one corrected sentence at a time.

Example:

> Sentence 3 of 8
>
> My friend made me angry because he took my pencil.
>
> 🎙 Speak this sentence

The student speaks and STT returns a transcript.

### Matching behavior

Do not require perfect transcript equality.

Speech validation should tolerate:

- minor STT mistakes
- punctuation differences
- contractions
- harmless filler
- common child pronunciation variation
- capitalization differences

It should primarily determine whether the student attempted and substantially reproduced the corrected sentence.

Initial target for experimentation: approximately 80–85% normalized similarity, with extra weight on meaningful/content words.

This threshold must be configurable after testing with actual Willena students.

### Retry behavior

If accepted:

> ✓ Nice!

Advance to the next sentence.

If not accepted:

> Try that sentence one more time.

After repeated difficulty, allow support such as:

- TTS listen button
- slower playback if supported
- another attempt

Do not trap a student forever because STT cannot understand them. A teacher-configurable or sensible fallback must exist.

---

## 6. Completion Screen

Example:

> Diary Complete
>
> 10 sentences written  
> 7 sentences improved  
> 10 sentences spoken

Future integration may award Willena points and streaks, but the journal data model should not depend on the points system.

Potential later features:

- daily streak
- weekly writing goal
- personal diary history
- favorite entry
- teacher encouragement
- monthly improvement summary

---

## 7. Persistence and Resume

Journal sessions should persist during the activity.

Draft/session state should include at minimum:

- student
- mission/prompt
- sentence target
- current original draft
- corrected result once generated
- correction-review position
- speaking progress
- timestamps

If the student accidentally refreshes or returns to the dashboard, the app should restore the unfinished session where practical.

A completed diary must remain immutable as the historical original submission. Later teacher notes or AI metadata should not overwrite the original student text.

---

## 8. Data Model — Initial Proposal

Exact naming should be reconciled with the existing Supabase schema before implementation.

### `journal_entries`

- `id`
- `student_id`
- `mission_id` nullable
- `prompt_text`
- `target_sentences`
- `original_text`
- `corrected_text`
- `original_sentence_count`
- `status`
  - `draft`
  - `correcting`
  - `review`
  - `speaking`
  - `completed`
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

Potential raw audio storage should NOT be assumed. Only store audio if there is a clear educational requirement, privacy policy, retention rule, and implementation decision to do so.

---

## 9. Teacher View

Teachers need a simple journal dashboard.

Initial overview should show recent completion status, for example:

| Student | Today | Sentences | Corrections | Speaking |
|---|---|---:|---:|---|
| Bruno | Complete | 8 / 8 | 5 | Complete |
| Liam | Writing | 4 / 8 | — | — |
| Jenny | Not started | — | — | — |

Selecting a completed entry should show:

- date
- mission/prompt
- exact original diary
- corrected diary
- sentence-by-sentence changes
- speaking completion
- relevant AI correction categories
- timestamps

Teachers should be able to see the student's authentic original English at all times.

### Future teacher analytics

Later versions may aggregate recurring patterns such as:

- past tense
- articles
- subject/verb agreement
- capitalization
- spelling
- prepositions
- sentence fragments

Example future insight:

> Past-tense errors: September 34% → October 18% → November 9%

Do not build analytics before the underlying correction categories are reliable.

---

## 10. Student Safety / Privacy / AI Handling

Because student writing may contain personal information or feelings:

- send only data required for correction
- do not expose API keys in client-side JavaScript
- AI calls must go through a protected server-side endpoint / Edge Function
- enforce authenticated student identity server-side
- use row-level security appropriate to students and teachers
- students should only access their own journal entries
- teachers should only access students they are authorized to view
- AI must not invent psychological interpretations of diary content
- correction feedback should focus on English, not judge the student's emotions or personal life

A separate safeguarding/escalation policy can be designed if journals are ever intentionally monitored for safety concerns. That is outside the v1 writing-correction scope and should not be silently delegated to the language model.

---

## 11. Technical Architecture — Proposed

```text
Student Journal UI
        ↓
Supabase draft persistence
        ↓
Protected correction endpoint / Edge Function
        ↓
OpenAI Luna
        ↓
Structured correction validation
        ↓
Supabase journal + sentence records
        ↓
Student correction review
        ↓
STT sentence practice
        ↓
Completion saved
        ↓
Teacher journal dashboard
```

The browser must never contain the OpenAI secret key.

Where possible, reuse existing Willena modules for:

- student authentication
- student header / navigation
- session persistence patterns
- shared styling / theme
- TTS/STT utilities already proven in other student apps
- Supabase client helpers
- teacher authorization

Do not duplicate those systems inside the journal app unnecessarily.

---

## 12. Suggested Folder Structure

Initial target:

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

Server-side correction logic should live with the project's existing server/Edge Function architecture rather than under the public student folder.

This structure is provisional until the existing staging architecture is inspected before implementation.

---

## 13. MVP Scope

The first working staging version should include:

- authenticated student opens Daily Journal
- daily/default mission plus “write about anything”
- configurable sentence target from 6–20
- writing editor
- reliable sentence progress count
- autosaved draft
- submit for correction
- Luna correction with strict voice-preservation rules
- structured original/corrected sentence data
- sentence-by-sentence correction review
- complete corrected diary
- STT reading of every corrected sentence
- tolerant speech matching
- completion state
- Supabase persistence
- teacher can view original + corrected submission and speaking completion
- refresh/resume behavior

Not required for first MVP:

- sophisticated writing scores
- leaderboards
- detailed analytics
- streak economy
- parent reports
- raw audio storage
- AI-generated diary content
- AI rewriting before the student has written

---

## 14. Decisions to Resolve During Build

These should be answered by inspecting current staging patterns and testing rather than guessed in advance:

- exact existing student header/navigation module to reuse
- exact Supabase tables/RLS conventions
- whether an existing Edge Function/OpenAI proxy should be extended
- exact Luna API model identifier/configuration
- existing STT/TTS module that should be reused
- how sentence targets are assigned: student profile, class, level, teacher assignment, or default
- exact teacher dashboard integration point
- best normalized speech-matching algorithm and threshold for Korean ESL learners
- whether students can edit their original diary after seeing corrections (default recommendation: no; create a separate revision field if revision becomes a learning step)

---

## 15. Definition of Success for v1

A student can open the app, write an authentic diary of the required length, receive restrained and useful English corrections, understand what changed, successfully read the corrected sentences aloud, finish the mission, leave/reopen without losing work, and have both their original and corrected writing available to an authorized teacher.

The AI's role is to improve the student's English — not replace the student's writing.
