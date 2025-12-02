# Grammar Fill-The-Gap Mode (Level 2)

---

## [2025-11-18] Present Progressive – Negative & Yes/No Added

- New sub-modes for present progressive fill-gap:
  - Negative (`present_progressive_negative.json`): blanks the BE-negative chunk (e.g., `He ___ running...`) and offers `am not`, `isn't`, `aren't`.
  - Yes/No (`present_progressive_questions_yesno.json`): blanks the leading BE (e.g., `___ she playing...?`) and offers `AM`, `IS`, `ARE`.
- WH questions are unchanged (already implemented separately in sorting/choose). No fill-gap change needed.
- Detection: filename or `grammarName`; generic present progressive detection excludes Negative/Yes‑No/WH by name.
- Answer checking normalizes `is not/are not` to `isn't/aren't` internally so either authoring form works.

---

This document describes how the **Grammar Fill-The-Gap** mode works in `Games/english_arcade/modes/grammar_fill_gap.js`, and how to author new lists or extend the mode with new sub-modes.

It is aimed at:
- Future engineers adding new grammar micro-modes.
- Content authors creating new Level 2 grammar JSON lists that plug into this engine.

The goal is to be predictable: **same data files** can be reused across Sorting, Choose, and Fill-Gap where it makes sense, with clear rules for how each mode interprets the JSON.

---

## 1. Overview

- Runtime entry point: `runGrammarFillGapMode(ctx)` in `Games/english_arcade/modes/grammar_fill_gap.js`.
- Mode focus: one **sentence with a gap**, 2–4 **clickable options**, instant feedback, then auto-advance.
- Shared infrastructure:
  - Sessions and logging via `startSession`, `logAttempt`, `endSession` from `students/records.js`.
  - Summary card via `renderGrammarSummary` from `Games/english_arcade/modes/grammar_summary.js`.
  - Audio lookup via `hydrateGrammarAudio` (Netlify function `get_audio_urls`).
- Visual layout:
  - Emoji or scene at the top (plain emoji, proximity scene, or in/on/under scene).
  - Cyan "word" line (may be hidden for some modes).
  - Sentence card with one blank, rendered as `<strong>___</strong>` (or `_________`).
  - Row of option chips.
  - Hint line (usually Korean translation or extra clue).

Each sub-mode is detected from **filename**, **grammarName**, **answerChoices** (from config), or the **shape/fields** of items.

---

## 2. Data Model Expectations

### 2.1. Shared item fields

Fill-gap accepts a wide range of item shapes. An item is considered usable if any of these are present:

- Classic grammar items:
  - `word` — subject, noun, or encoded pattern (e.g., `i_walk`, `there_is`).
  - `article` — overloaded field:
    - Article/determiner: `a`, `an`, `the`, `this`, `that`, `these`, `those`.
    - Plural variant: may hold plural form for plural lists.
    - Countability tag: `countable` / `uncountable`.
    - Preposition: `in`, `on`, `under`.
  - `contraction` — contracted form for BE/subject (e.g., `I'm`, `you're`, `we're`).

- Sentence text (any one of these):
  - `exampleSentence`
  - `example`
  - `sentence`
  - `en` (often the English sentence in Level 2 lists)
  - `sentences` (array; presence counts as "has a sentence", even if fill-gap uses only one string field).

- Short questions items:
  - `answer_positive`, `answer_negative` — for Short Questions mode (`Yes, I do.` / `No, I don't.` etc.).

- Hints / translations:
  - `exampleSentenceKo`, `sentence_kor`, `kor`, `ko` — any one of these is used as the hint line.

- Misc / visuals / audio:
  - `emoji` — for standard or proximity/preposition scenes.
  - `id` — used to build audio lookup keys and log `word` for the session.
  - `sentenceAudioUrl`, `audio_key` — hydrated at runtime when audio is available.

Helper functions:
- `getSentenceText(item)` reads the best-available sentence string from the fields above.
- `hydrateGrammarAudio(items)` builds candidate keys (from `word`, `article`, `id`, and a hash of the sentence) and calls the `get_audio_urls` function.

### 2.2. Which items are included in the deck

Inside `runGrammarFillGapMode`:

- The JSON file from `grammarFile` is fetched and parsed.
- `usable` is built by filtering items that satisfy at least one of:
  - `item.word` and (`item.article` or `item.contraction` or `item.ending`).
  - `item.word` and (`item.answer_positive` or `item.answer_negative`).
  - Any of `item.en`, `item.example`, `item.exampleSentence`, `item.sentence`, or a non-empty `item.sentences` array.
- The final `deck` is `shuffle(usable).slice(0, 15)`.
- A session is started with:
  - `mode: 'grammar_fill_gap'`.
  - `wordList`: each item’s `word` / `en` / `example` / `id`.
  - `listName`: `grammarName` (if provided).
  - `meta`: `{ category: 'grammar', file: grammarFile }`.

Authors should make sure:
- Every item intended for fill-gap has **clear sentence text** in one of the known fields.
- Classic grammar lists keep using `word` + `article`/`contraction` so Sorting/Choose/Fill-Gap can all share them.

---

## 3. Mode Detection Overview

`runGrammarFillGapMode` derives a series of boolean flags that determine which sub-mode runs.

Key inputs:
- `grammarFile` (string path to the JSON file; used for regex detection).
- `grammarName` (UI name; also used in regex detection).
- `grammarConfig.answerChoices` (array of strings that often encode the target contrast, e.g. `['a','an']`, `['this','that']`, `['there is','there are']`).
- Shape of `usable` items (e.g. presence of `answer_positive`/`answer_negative`).

The important detection flags are:

- **Preposition / proximity / this/that / these/those:**
  - `isThisThatMode` — `answerChoices` includes `'this'` and `'that'`.
  - `isTheseThooseMode` — `answerChoices` includes `'these'` and `'those'`.
  - `inOnUnderMode` — from `isInOnUnderMode(answerChoices)`.
  - `hasProximityMode` — true if `isThisThatMode` or `isTheseThooseMode`.

- **Core grammar mode switches:**
  - `isContractionMode` — `answerChoices` exactly `[''m', ''re', ''s']`.
  - `isPluralMode` — either:
    - `grammarConfig.isPluralMode === true`, or
    - `answerChoices` includes `'singular'` and `'plural'`, or
    - `grammarFile` matches `/plurals?_/.`.
  - `isCountableMode` — `answerChoices` includes `'countable'` and `'uncountable'`.
  - `isSomeAnyMode` — `answerChoices` includes `'some'` and `'any'`.

- **"There" modes:**
  - `isThereStatementsMode` — `answerChoices` (lowercased) includes `'there is'` and `'there are'`.
  - `isThereQuestionsMode` — includes `'is there'` and `'are there'`.

- **Present Simple (verb/negative/questions):**
  - `isPresentSimpleNegative`
    - `grammarFile` matches `present_simple_negative.json`.
    - or `grammarName` matches `present simple negative`.
  - `isPresentSimpleYesNoFillGap`
    - `grammarFile` matches `present_simple_questions_yesno.json`.
    - or `grammarName` contains `present simple` and `yes / no`.
  - `isPresentSimpleWhFillGap`
    - `grammarFile` matches `present_simple_questions_wh.json`.
    - or `grammarName` contains `present simple WH` or `wh questions`.
  - `isPresentSimpleMode`
    - from `isPresentSimpleVerbMode(grammarFile, usable)`:
      - if filename hints at `present_simple_sentences`.
      - or any `item.word` matches patterns like `_walk`, `_walks`, `_play`, `_plays`, etc.

- **Present Progressive:**
  - `isPresentProgressiveFillGap`
    - `grammarFile` matches `present_progressive.json`.
    - or `grammarName` matches `present progressive`.
  - `isPresentProgressiveWeMathFillGap`
    - `grammarConfig.mode === 'present_progressive_we_math_fillgap'`.
    - or `grammarFile` matches `present_progressive_we_math_fillgap.json`.

- **Short Questions & generic sentence modes:**
  - `isShortQuestionsMode`
    - first usable item has `answer_positive` and `answer_negative`.
  - `isGenericSentenceMode`
    - no contractions/plurals/countable/short questions/present simple verb mode.
    - `answerChoices` is an empty array.

The **rendering order** in `renderQuestion()` is important:

1. Short questions
2. Present Simple WH
3. Present Simple Yes/No
4. Present Progressive We-math micro-mode
5. Present Progressive general
6. Present Simple verb
7. Present Simple negative
8. There statements/questions
9. Generic sentence
10. Plurals/countable
11. Default article/contraction mode

When you add a new mode, you must insert its branch in a place that does not conflict with existing detection.

---

## 4. Per-Mode Behavior & Authoring Guidelines

This section explains **what the student sees** and **how to author data** for each sub-mode.

### 4.1. Default article / classic grammar mode

Used when no other more specific mode applies, but items look like classic article or contraction entries.

- **Detection:**
  - Item has `word` plus `article` or `contraction`, but no `isPluralMode`, `isCountableMode`, `isShortQuestionsMode`, `isPresentSimpleMode`, etc.
- **UI:**
  - Emoji: plain emoji from `item.emoji` or `🧠` fallback.
  - Cyan word line: shows `item.word` (unless Some/Any or other special modes hide it).
  - Sentence: `buildSentenceWithBlank(item, isPluralMode, isCountableMode)`:
    - For standard article lists, tries to replace `article + word` with `___ word`.
    - Otherwise replaces bare article with `___`.
    - Renders blank as `<strong>___</strong>`.
  - Hint: `item.exampleSentenceKo` (or any of the KO fields) unless in proximity/preposition mode.
  - Options row: static `answerChoices` from `grammarConfig` (e.g., `['a','an']`).

- **Correctness:**
  - `correctAnswerSource = item.article` (or `item.contraction` if `isContractionMode`).
  - User guess is `btn.dataset.value` lowercased.
  - `correct` if guess equals lowercased `correctAnswerSource`.

- **Author checklist for this mode:**
  - `word` is the target noun/subject.
  - `article` is the correct article or determiner.
  - Sentence places article (or article+word) exactly once.
  - `grammarConfig.answerChoices` contains all possible articles/determiners you want to show.

---

### 4.2. Plurals & Countable/Uncountable

These modes quiz **word forms** (singular vs plural, or countable vs uncountable) rather than articles.

- **Detection:**
  - `isPluralMode === true` (see Section 3 for specific rules).
  - `isCountableMode === true` when `answerChoices` includes `'countable'` and `'uncountable'`.

- **UI:**
  - Cyan word line: hidden (answer is the word itself).
  - Sentence: `buildSentenceWithBlank(item, isPluralMode, isCountableMode)`:
    - For countable mode: tries to blank out `word` or its plural forms (`-s`, `-es`, `-ies`).
    - For plurals mode: may blank either `word` or `article` if `article` contains plural form.
    - Displayed with `<strong>___</strong>`.
  - Hint: KO fields unless preposition/proximity.
  - Options: `buildPluralOptions(item, usable, isCountableMode)`:
    - Collects all word forms from `word` and `article` across the list.
    - Generates **1 correct + up to 3 distractors**, then shuffles.

- **Correctness:**
  - If `item.article` is a *concrete word* (not `'singular'`, `'plural'`, `'countable'`, `'uncountable'`), correct answer is `article`.
  - Otherwise correct answer is `item.word`.

- **Author checklist:**
  - For plural lists:
    - Decide whether plural is in `word` or `article`, and keep that consistent.
    - Provide a clear sentence in `exampleSentence`/`en` containing the target word once.
  - For countable/uncountable lists:
    - `article` must be exactly `'countable'` or `'uncountable'`.
    - `word` is the noun.

---

### 4.3. Contractions (BE)

Students choose the correct contraction for a given subject.

- **Detection:**
  - `isContractionMode` when `answerChoices` is exactly `[''m',''re',''s']`.

- **UI:**
  - Cyan word line: shows `item.word` (subject: `I`, `we`, `he`, `she`, etc.).
  - Sentence: `buildSentenceWithBlank` blanks the contraction string if present.
  - Options: `buildContractionOptions(item, answerChoices)`:
    - Builds `subject + ending` for each ending.

- **Correctness:**
  - `correctAnswerSource = item.contraction || item.article`.
  - Compare lowercased full contraction string, e.g. `"I'm"`.

- **Author checklist:**
  - `word` is the subject.
  - `contraction` is the correct combined form (`I'm`, `you're`, `he's`, etc.).
  - Sentence includes the contraction (or its expanded form) exactly once.

---

### 4.4. This/That, These/Those, In/On/Under (Proximity & Prepositions)

These modes reuse classic data but change the **scene** and some UI behavior.

- **Detection:**
  - `isThisThatMode`: `answerChoices` contains `'this'` and `'that'`.
  - `isTheseThooseMode`: `answerChoices` contains `'these'` and `'those'`.
  - `inOnUnderMode`: detected by `isInOnUnderMode(answerChoices)`.

- **UI:**
  - Emoji:
    - `hasProximityMode` — uses `buildProximityScene(item.article, item.emoji)`.
    - `inOnUnderMode` — uses `buildPrepositionScene(item.article, item.emoji, item.word)`.
  - Cyan word line:
    - For proximity, may still show word or be hidden depending on list design.
  - Sentence: standard `buildSentenceWithBlank` behavior.
  - Options: static list from `answerChoices`.

- **Correctness:**
  - `correctAnswerSource = item.article` (the determiner or preposition).

- **Author checklist:**
  - `article` is the determiner (`this`, `that`, `these`, `those`) or the preposition (`in`, `on`, `under`).
  - `emoji` (and sometimes `word`) drive the scene visuals.
  - Sentence text should match the quantifier/proximity pattern you are targeting.

---

### 4.5. Some / Any

Typically used together with Short Questions lists or article-like examples.

- **Detection:**
  - `isSomeAnyMode`: `answerChoices` includes `'some'` and `'any'`.

- **UI (Short Questions case):**
  - When `isShortQuestionsMode` is also true, see Section 4.8 (Short Questions).
  - Cyan word line is hidden to remove extra gap.

- **Correctness:**
  - In Short Questions mode, correctness is based on the chosen answer polarity (positive vs negative), not directly on `some` vs `any`.

- **Author checklist:**
  - Use Short Questions lists where positive/negative final words differ in a meaningful way.
  - Set `answerChoices` to `['some','any']` in `grammarConfig` when using this contrast.

---

### 4.6. There is/are – Statements & Questions

These modes target the **"There is/are"** chunk at the start of sentences.

- **Detection:**
  - `isThereStatementsMode`: `answerChoices` contains `'there is'` and `'there are'` (plus negative forms).
  - `isThereQuestionsMode`: `answerChoices` contains `'is there'` and `'are there'`.

- **UI (Statements):**
  - Cyan word line: hidden.
  - Sentence: `getSentenceText(item)` with starting `there is/are/isn't/aren't` replaced by `<strong>___</strong>`.
  - Options: chips for `"there is"`, `"there are"`, `"there isn't"`, `"there aren't"`.

- **UI (Questions):**
  - Cyan word line: hidden.
  - Sentence: `getSentenceText(item)` with `Is there` / `Are there` replaced by `<strong>___</strong>`.
  - Options: `"Is there"` and `"Are there"`.

- **Correctness:**
  - `thereCorrectAnswerLabel` is computed before options:
    - For statements: from `item.word` (contains `there_is`, `there_are`, `there_isn_t`, `there_aren_t`), or by analyzing the noun phrase with `extractThereNounPhrase` to decide singular vs plural.
    - For questions: similarly, using word hints or noun phrase plurality.
  - `correctAnswerSource = thereCorrectAnswerLabel`.

- **Author checklist:**
  - Sentence starts with `There is/are` or `Is there/Are there` (or their negatives).
  - `word` may encode tags like `there_is` or `there_are` to support detection.
  - Noun phrase after BE should clearly show singular vs plural.

---

### 4.7. Present Simple – Verb Contrast (Subject vs Verb Form)

Students choose between base and 3rd-person verb forms inside a sentence.

- **Detection:**
  - `isPresentSimpleMode = isPresentSimpleVerbMode(grammarFile, usable)`.
  - Detects when `grammarFile` hints at `present_simple_sentences` or `item.word` contains patterns like `_walk/_walks`.

- **UI:**
  - Cyan word line: empty (word is not shown separately).
  - Sentence: `buildPresentSimpleVerbQuestion(item)`:
    - Heuristically finds subject and verb from the sentence tokens.
    - Replaces the verb token with `<strong>_____</strong>`.
  - Hint: KO fields.
  - Options: base and 3rd-person forms (e.g., `eat` vs `eats`).

- **Correctness:**
  - `presentSimpleData.correctAnswer` is chosen by subject heuristics:
    - Third person singular subjects (`he`, `she`, `it`, special-case `sun`) → `sForm`.
    - Others → base.

- **Author checklist:**
  - `en` / `exampleSentence` should be simple present sentences where
    - Subject appears at the start.
    - Verb is the first non-function word after subject/determiners.
  - `word` may encode subject+verb but is not required for fill-gap logic.

---

### 4.8. Present Simple – Negative (don’t/doesn’t)

Students decide whether to use `don't` or `doesn't` in negative sentences.

- **Detection:**
  - `isPresentSimpleNegative` from filename/grammarName.

- **UI:**
  - Cyan word line: hidden.
  - Sentence: `getSentenceText(item)` with `don't` or `doesn't` replaced by `<strong>___</strong>`.
  - Options: exactly two chips: `"don't"` and `"doesn't"`.

- **Correctness:**
  - If the original sentence contains `doesn't` → `correctAnswerSource = "doesn't"`.
  - Else if `don't` is present → `correctAnswerSource = "don't"`.
  - Otherwise, fallback heuristic based on subject and noun plurality.

- **Author checklist:**
  - Sentence must contain either `don't` or `doesn't` in the spot you want blanked.
  - Subject should clearly indicate singular vs plural if fallback heuristics are needed.

---

### 4.9. Present Simple – Yes/No Questions (Verb Gap)

Students choose the correct main verb in DO/DOES questions.

- **Detection:**
  - `isPresentSimpleYesNoFillGap` from filename/grammarName.

- **UI:**
  - Cyan word line: hidden.
  - Sentence: `buildPresentSimpleYesNoFillGap(item)`:
    - Uses `item.en || item.word` as the question.
    - Matches `Do/Does + subject + verb + rest`.
    - Replaces the verb with `<strong>_____</strong>`.
  - Hint: KO fields.
  - Options (3):
    - Base verb form (correct).
    - 3rd person `-s` form (wrong conjugation).
    - Random unrelated verb from a fixed pool (wrong meaning).

- **Correctness:**
  - `correctAnswerSource = baseForm`.

- **Author checklist:**
  - Use `en` as a DO/DOES question that matches the regex pattern described in code.
  - Place the main verb once, after the subject.

---

### 4.10. Present Simple – WH Questions (WH Gap)

Students choose the correct WH word (who/what/where/etc.) for a question.

- **Detection:**
  - `isPresentSimpleWhFillGap` from filename/grammarName.

- **UI:**
  - Cyan word line: hidden.
  - Sentence: `buildPresentSimpleWhFillGap(item)`:
    - Preferred pattern: `WH + do/does + subject + verb + rest` → blanks WH.
    - Fallback: any `WH + rest` → blanks WH.
    - Displays `_________` or `_________ do they go to school?` etc.
  - Hint: KO fields.
  - Options: 3 WH words (correct + 2 distractors) from a standard WH list.

- **Correctness:**
  - `correctAnswerSource = whWord` from the question.

- **Author checklist:**
  - Ensure questions start with the WH word you intend to test.
  - For best behavior, stick to `WH + do/does + subject + verb + rest`.

---

### 4.11. Short Questions Mode

Used for lists where each item has both positive and negative short answers.

- **Detection:**
  - `isShortQuestionsMode` when `usable[0]` has `answer_positive` and `answer_negative`.

- **UI:**
  - Cyan word line:
    - Hidden when also in Some/Any or There modes.
    - Otherwise may show `item.en`.
  - Sentence: `buildShortQuestionsSentenceAndOptions(item)`:
    - Randomly choose positive or negative answer.
    - Extract last word from each (`yes/no` or auxiliary).
    - Remove last word and put `<strong>_____</strong>` at the end.
  - Options:
    - Last word from positive answer.
    - Last word from negative answer.
    - One additional common auxiliary as distractor.

- **Correctness:**
  - `correctAnswerSource = shortQuestionsData.correctAnswerLastWord`.

- **Author checklist:**
  - Provide `answer_positive` and `answer_negative` short answers.
  - Each should end with the key auxiliary you want to test (`do`, `don't`, `can`, `can't`, etc.).

---

### 4.12. Present Progressive – General (BE + V-ing)

This is the **general present progressive fill-gap** for all `present_progressive` lists.

- **Detection:**
  - `isPresentProgressiveFillGap` when filename or `grammarName` indicates `present_progressive`.

- **UI:**
  - Cyan word line: hidden.
  - Sentence: `buildPresentProgressiveGapQuestion(item)`:
    - Uses `getSentenceText(item) || item.en`.
    - Matches the first `am/is/are + verb-ing` chunk.
    - Replaces it with `<strong>_____</strong>`.
  - Hint: KO fields.
  - Options (3):
    - Correct BE+V-ing.
    - Wrong BE + same V-ing.
    - Correct BE + base form (no `-ing`).

- **Correctness:**
  - `correctAnswerSource = presentProgressiveData.correctAnswer` (the BE+V-ing chunk).

- **Author checklist:**
  - Each sentence must contain exactly one clear `am/is/are + verb-ing` sequence.
  - Avoid multiple progressive verbs that might confuse the regex.

---

### 4.13. Present Progressive – We ___ math Micro-Mode

Hard-coded mini-game: `We ___ math.` with three options.

- **Detection:**
  - `isPresentProgressiveWeMathFillGap` via `grammarConfig.mode` or specific filename.

- **UI:**
  - Cyan word line: hidden.
  - Sentence: always `We _____ math.`.
  - Hint: KO fields.
  - Options (hard-coded):
    - `is studying`
    - `are study`
    - `are studying` (correct)

- **Correctness:**
  - `correctAnswerSource = 'are studying'`.

- **Author checklist:**
  - This is primarily for a specific instructional micro-mode.
  - Items in the JSON are used mainly for hints and audio.

---

### 4.14. Generic Sentence Last-Word Mode

Fallback when no other mode applies and `answerChoices` is empty.

- **Detection:**
  - `isGenericSentenceMode` when:
    - Not in contractions/plurals/countable/short-questions/present-simple-verb modes.
    - `answerChoices` is an empty array.

- **UI:**
  - Cyan word line: hidden.
  - Sentence: `buildGenericLastWordQuestion(item, usable)`:
    - Splits sentence.
    - Replaces the **final word** with `<strong>_____</strong>`.
  - Hint: KO fields.
  - Options:
    - Correct last word.
    - Two distractors drawn from last words of other sentences in the same list.

- **Correctness:**
  - `correctAnswerSource = genericSentenceData.correctAnswerLastWord` (lowercased).

- **Author checklist:**
  - Provide natural sentences where the last word is suitable as a target.
  - Avoid punctuation-heavy or multi-clause sentences where the last word is not meaningful.

---

## 5. Option Generation & Correctness Summary

This section summarizes how options and correctness are determined, which is important when extending the mode.

- **Static options from `answerChoices`:**
  - Articles/determiners: `['a','an']`, `['this','that']`, `['these','those']`.
  - Some/Any: `['some','any']`.
  - There statements/questions: `['there is','there are',"there isn't","there aren't"]`, `['Is there','Are there']`.
  - Present Simple negative: `['don't','doesn't']`.

- **Dynamic options from builder functions:**
  - `buildPluralOptions`: collects forms across items; correct + 3 distractors.
  - `buildContractionOptions`: `subject + ending` for each contraction ending.
  - `buildShortQuestionsSentenceAndOptions`: last words of positive/negative answers + one auxiliary distractor.
  - `buildPresentSimpleVerbQuestion`: base vs `-s`/`-es`/`-ies` forms.
  - `buildPresentSimpleYesNoFillGap`: base vs `-s` form + random verb from pool.
  - `buildPresentSimpleWhFillGap`: correct WH + 2 other WH words.
  - `buildPresentProgressiveGapQuestion`: correct BE+V-ing + wrong BE + BE+base.
  - `buildGenericLastWordQuestion`: last word of sentence + two last words from other items.

- **Correctness source (`correctAnswerSource`) per mode:**
  - Articles/determiners: `item.article`.
  - Contractions: `item.contraction`.
  - Plurals/countable: plural word (from `article` or `word`).
  - Present Simple verb: `presentSimpleData.correctAnswer`.
  - Present Simple negative: text-based or heuristic choice between `"don't"` and `"doesn't"`.
  - Present Simple yes/no: base verb.
  - Present Simple WH: WH word.
  - Short questions: final word of chosen polarity answer.
  - There statements/questions: `thereCorrectAnswerLabel` from tags or noun phrase.
  - Present Progressive modes: BE+V-ing or `'are studying'`.
  - Generic sentence: last word.

All comparisons use **lowercased strings** for both `correctAnswerSource` and the selected `choice`.

`logAttempt` is called with:
- `mode: 'grammar_fill_gap'`.
- `word`: `item.id || item.word`.
- `is_correct`: boolean.
- `answer`: the guessed string.
- `correct_answer`: `correctAnswerSource`.
- `points`: `1` if correct; otherwise `0`.
- `extra`: `{ word, article, contraction, sentence: item.exampleSentence, category: 'grammar' }`.

---

## 6. Extensibility: Adding a New Fill-Gap Sub-Mode

When you add a new grammar list or micro-mode, follow these guidelines.

### 6.1. Detection

- Prefer a **clear detection signal** so it doesn’t collide with existing modes:
  - A filename pattern: e.g., `present_perfect_fillgap.json`.
  - A `grammarName` pattern: e.g., `"Present Perfect (have/has) – Fill-Gap"`.
  - A `grammarConfig.mode` string: e.g., `'present_perfect_have_has_fillgap'`.
- Avoid overloading `answerChoices` values that are already in use (e.g., `a/an`, `this/that`, `some/any`) unless you truly intend to reuse that behavior.

### 6.2. Data model

- Decide where the **correct answer** lives:
  - In a dedicated field (`article`, `contraction`, `ending`, custom field).
  - Or derived from the sentence (e.g., WH word, verb form, BE+V-ing).
- Ensure your items pass the `usable` filter:
  - Either include `word` + (`article`/`contraction`/`ending`),
  - Or give them a clear sentence in `en`/`exampleSentence`/`sentence`.
- If you need extra fields (e.g., `patternTag`), keep them optional so other modes using the same lists don’t break.

### 6.3. UI and rendering

- In `renderQuestion()`:
  - Add a **dedicated branch** for your new mode, near related ones.
  - Set `wordEl.textContent` and `wordEl.style.display` explicitly:
    - Hide the cyan word line for sentence-only modes.
    - Show it when it helps (e.g., when the word is part of the prompt).
  - Build the sentence string with a **single gap marker**:
    - Use `<strong>_____</strong>` or `<strong>___</strong>` for clarity.
  - Set `hintEl.textContent` from KO fields.

- In the options section:
  - Populate `optionsRow.innerHTML` with `<button class="fg-chip" data-value="...">Label</button>`.
  - Make sure you refresh `optionButtons` after injecting HTML.

### 6.4. Correctness and logging

- In `handleSelection`:
  - Add a new `else if` branch to compute `correctAnswerSource` for your mode.
  - Set it to a **lowercase** string that matches the `data-value` of the correct button.
- Do not change how `logAttempt` is called unless you need extra metadata:
  - If you add fields to `extra`, keep them small and text-only.

### 6.5. Compatibility with Sorting & Choose

- Many lists are shared across:
  - Sorting mode (order words into groups).
  - Choose mode (multiple-choice question).
  - Fill-Gap mode (sentence with blank).
- When you change data:
  - Do not remove fields that other modes rely on (`word`, `article`, `contraction`, `en`, etc.).
  - Try to add new fields instead of overloading existing ones.

---

## 7. Author Checklist (For New Fill-Gap Lists)

Before you add or change a list for Fill-The-Gap, run through this checklist:

1. **Basic shape**
   - [ ] Each item has a clear English sentence (`en`, `exampleSentence`, `example`, or `sentence`).
   - [ ] The sentence contains exactly one target chunk to be blanked.

2. **Mode identification**
   - [ ] The filename and/or `grammarName` clearly indicate the intended mode (e.g., `present_simple_questions_yesno.json`).
   - [ ] If needed, `grammarConfig.mode` is set to a unique string.
   - [ ] `answerChoices` are correctly configured for this list (articles, WH words, there is/are, etc.).

3. **Correct answer placement**
   - [ ] The correct chunk (article, contraction, verb form, WH word, BE+V-ing, etc.) appears in a predictable position.
   - [ ] It is stored in the correct field (`article`, `contraction`, or derivable from the sentence) according to this spec.

4. **Distractor quality**
   - [ ] For lists with dynamic distractors, other items in the list provide reasonable alternative words.
   - [ ] No item uses an extremely rare or malformed word as the last word (for generic last-word mode).

5. **Cross-mode compatibility**
   - [ ] If the list is also used in Sorting or Choose mode, fields they rely on are unchanged.
   - [ ] Any new fields you add are optional and do not break older code.

6. **Testing**
   - [ ] You can play through at least one run of the new Fill-Gap game in the browser without errors.
   - [ ] The blank appears in the correct place in every sentence.
   - [ ] The correct option is always grammatically appropriate and consistently recognized as correct.

This spec should give future agents and authors enough context to safely extend `grammar_fill_gap.js` and to create new, consistent Level 2 Fill-The-Gap lists without surprises.