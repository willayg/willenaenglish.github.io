# Sentence Genius (students branch)

Student app at `/students/sentence-genius/`. This is **not** the discarded single-file MVP on `main`.

## Modules

| Module | Single responsibility |
|---|---|
| `index.html` | Word Genius study shell, book menu, skill cards, fullscreen session |
| `styles.css` | Only Sentence Genius-specific rules; imports original Word Genius CSS |
| `content.js` | Authenticated student identity, assigned textbook access, book/unit sentence loading |
| `scoring.js` | Word Genius percent-to-stars rule and correct-until-passed state |
| `tracking.js` | Canonical study attempt recorder and authenticated server mastery reload |
| `speech.js` | Word Genius voice cache, browser mic, strict full-sentence matching and AI fallback |
| `rewards.js` | First-attempt session stars and existing progress-summary reward-only API |
| `app.js` | Screen state and session orchestration; imports canonical history and QuestionRenderer |

## Reused canonical modules

- `/students/vocab-study/vocab-study.css`, `/students/vocab-study/theme-pips.css`, `theme-pips.js`
- `/shared/questions/question-renderer.js` (order and speaking forms; mic is canonical SVG)
- `/students/vocab-study/vocab-progress-snapshot.js` (0–5 stars)
- `/students/vocab-study/vocab-pass-flow.js` (retry policy)
- `/students/vocab-study/navigation-history.js` (home/back without history stacking)
- `/students/vocab-study/vocab-listening-cache.js` (silent short look-ahead)
- `/students/vocab-study/vocab-ai-speech-ui.js` (optional AI fallback after misses)
- `/students/vocab-study/speaking-match.js` (normalizer and STT, **no loose phonetic matches** on full sentences)
- `/students/study/study-progress.js` (authenticated study attempts, offline queue, server mastery)
- Student header, SFX, point feedback, reward celebration components

## Pedagogy

- Coach: Korean + English; listen and say the sentence. Optional for gold.
- Unscramble: Korean; move English words into the correct order. A wrong answer reappears.
- Speaking: Korean; speak the sentence from memory; model Listen unlocks after two actual browser mic starts.
- Each successfully completed item is worth 4 points in Unscramble or Speaking, or up to 3 points in Coach. Previously passed items do not farm points.
- Five star thresholds: 100, 90, 80, 70, and 60 percent. Both required modes at 100% => Golden Unit. Coach is excluded.
- Retry items stay in the session until correct, and correct retry answers can finish the unit; first-attempt success separately determines session reward stars.
- Golden Unit is derived from per-sentence mastery; not currently inserted as a standalone badge award in Word Genius's existing achievement table.

## Content and progress

Only translated, complete sentence pairs linked to the student's assigned textbook and unit are displayed. No generated/invented sentence examples. Content comes from Willena Content Database's `source_content_occurrences`, `sentences`, `content_units`. Textbook assignments use the same `get_study_assignment_for_class` RPC as Word Genius.

Attempts and rewards use existing authenticated Cloudflare progress routes, without new Workers or direct public student-attempt access. `sentence_coach`, `sentence_unscramble`, `sentence_speaking` are separate backend skill identifiers. Mastery state is reloaded from the server with `getContentMastery`. Local storage is only an optimistic cache if network is unavailable.

## Still pending before classroom release

- Add dedicated teacher Assignment creation/management UI for this new app.
- Decide whether Sentence Genius Golden Unit awards should appear in the global badge count and teacher progress snapshots.
- Run a logged-in student/browser test on the deployed students branch, including recording, AI audio fallback, server attempt persistence, device switching and phone UI. Repository/static checks alone cannot prove those paths.
- Decide whether to limit usable items to `sentence_patterns` mappings or include every translated textbook sentence in a unit. Currently includes all sourced translated sentences.
