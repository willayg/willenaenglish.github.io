# Sentence Genius — students branch

Student-facing app: `/students/sentence-genius/` on the `students` branch. Changes to Word Genius, GitHub Pages `main`, and worker deployment configuration are outside this app.

## Design

The **page HTML and CSS** reuse the actual Word Genius student UI, including book cards, unit pills, three connected skill cards with completion rings, mobile fullscreen practice, themes, SVG mic, sentence-list modal, progress bar, and reward celebration. A sentence-specific stylesheet only styles the Korean/English model and Word Genius's original word-arrangement renderer.

The same existing `QuestionRenderer` implements word-order tiles and microphone transcription. Speech reuses Word Genius's listening cache, AI fallback and conservative target matching. Streak/achievement data from Word Genius is **not** rewritten.

## Module boundaries

- `index.html`: original Word Genius visual shell adapted to Sentence Genius.
- `styles.css`: a small set of sentence-only overrides.
- `app.js`: starts the app, loads the student's assigned book and unit, and composes services.
- `content.js`: authenticated student identity, class-assigned books, source-backed English/Korean sentence pairs; linked textbook patterns are preferred.
- `screens.js`: Word Genius book cards, unit strip, gold badge, completion rings, and sentence-list modal.
- `session.js`: one exercise at a time, retry queue, microphone, feedback, next, skip, finish.
- `navigation.js`: isolated home/book/activity history (no retry-back-stack growth).
- `scoring.js`: the **canonical Word Genius** percent and 0–5 stars functions, repeat-until-correct, and per-student optimistic cache.
- `tracking.js`: the existing study recorder and server mastery readback; no public writing of student progress.
- `speech.js`: Word Genius audio/AI mic support with conservative whole-sentence checking.
- `rewards.js`: one session reward summary via the existing progress API.

## Exercise contract

1. **Practice Coach**: show Korean and English, model listen and speak. Optional for gold.
2. **Unscramble**: show Korean, arrange scrambled English words.
3. **Speaking**: show Korean, say English; listen is unlocked after repeated microphone starts.

Unscramble and Speaking require passing **every eligible sentence** for a Golden Unit. Coach does not count. Incorrect answers reappear later in the same session; retries do not count as first-attempt successes for session star calculation. Successful answers are recorded with separate `sentence_unscramble`, `sentence_speaking` and `sentence_coach` skills.

A Gold indicator is derived from per-sentence mastery in these two required stages. This **does not** write into Word Genius's global Golden Unit badge table.

## Verification and known boundaries

Code is on the `students` branch and Cloudflare's built-in Git deployment handles preview publication. Static module syntax, DOM-ID references, and isolated scoring behaviors were checked. A logged-in student **end-to-end microphone, progress save and teacher homework acceptance test has not been completed**. Teacher → Assignments creation UI for Sentence Genius is not included in this student app build.

The `main` / GitHub Pages MVP is unchanged by this work.
