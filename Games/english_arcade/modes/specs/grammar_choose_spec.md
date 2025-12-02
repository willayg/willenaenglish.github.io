# Grammar Choose Mode – Authoring & Coding Spec

This spec explains how to design and wire grammar lists for the **Grammar Choose Mode** implemented in `Games/english_arcade/modes/grammar_mode.js`.

Use this whenever you add or modify a grammar choose list (articles, some/any, demonstratives, there is/are, present simple, WH, short questions, prepositions, plurals, etc.).

Core engine files:

- Mode logic: `Games/english_arcade/modes/grammar_mode.js`
- Shared summary: `Games/english_arcade/modes/grammar_summary.js`
- Preposition visuals: `Games/english_arcade/modes/grammar_prepositions_data.js`
- Data: `Games/english_arcade/data/grammar/<level>/<list_name>.json`

---

## 1. Concept: What Grammar Choose Mode Does

- Loads a grammar JSON list (`grammarFile`), shuffles items, and limits to **15 questions per session**.
- Shows a **progress bar** and `Question X of Y` at the top of the screen.
- For each item:
  - Builds a **prompt** (text and/or visual cue).
  - Displays **2–4 answer buttons** based on `grammarConfig.answerChoices` or the active sub-mode.
  - Immediately marks the chosen answer **correct/incorrect** and logs the attempt.
- Tracks:
  - `score`, `totalAnswered`, session time, and `wordList`.
- On completion:
  - Calls `endSession` with a summary.
  - Shows a shared grammar summary (`renderGrammarSummary`).
- Always shows a **Quit** button that returns to the grammar mode selector or opening screen.

---

## 2. How Sub-Modes Are Selected

`grammar_mode.js` runs through a series of **detection flags** to decide which “sub-mode” to use. These are based on:

- `grammarFile` pattern (filename regex).
- `grammarName` pattern (title regex).
- `grammarConfig` flags (e.g., `answerChoices`, `isPluralMode`, `mode`).

Key detection booleans:

- `isShortQuestions` – `short_questions_1.json` or `short_questions_2.json`.
- `isPresentSimpleList` – `present_simple_sentences.json`.
- `isPresentSimpleNegative` – filename or name contains `present simple negative`.
- `isPresentSimpleYesNo` – filename or name contains `present simple yes/no`.
- `isPresentSimpleWhQuestions` – filename/name contains `present simple WH` or `WH questions`.
- `isPluralsMode` – `grammarConfig.isPluralMode === true`.
- `isSomeAnyMode` – `answerChoices` includes both `'some'` and `'any'`.
- `isThisThatMode` – `answerChoices` includes `'this'` and `'that'`.
- `isTheseThooseMode` – `answerChoices` includes `'these'` and `'those'`.
- `inOnUnderMode` – detected via `isInOnUnderMode(answerChoices)`.
- `isThereStatementsMode` – `answerChoices` contains `'there is'` and `'there are'`.
- `isThereQuestionsMode` – `answerChoices` contains `'is there'` and `'are there'`.

If none of these special flags apply, the engine falls back to the **generic article/ending choose** mode (e.g., `a/an`).

---

## 3. Sub-Modes: Behavior & Authoring Rules

For each sub-mode, this section tells you:

- Detection rule.
- What the learner sees (prompt + visuals + choices).
- How to author JSON and `grammarConfig`.
- How the correct answer is computed.

### 3.1 Generic Article / Ending Choose (Default)

**Detection**

- Used whenever **no other sub-mode** matches.
- `grammarConfig.answerChoices` is a small set of options (e.g., `['a','an']`, or other endings).
- Each item should supply `article` or `ending` as the correct choice.

**Learner View**

- Top: `Question X of Y` + progress bar.
- Middle:
  - Emoji if `item.emoji` exists.
  - Cyan answer box (`grammarArticleBox`), initially empty.
  - Cyan prompt text:
    - Uses `item.prompt` or `item.word`, with `___` turned cyan if present.
- Bottom:
  - One button per `answerChoices` (lowercase chips).
  - Quit button.

**Authoring**

- JSON:

  - `word`: base word or prompt label.
  - `prompt`: full sentence with `___` where the article/ending goes (optional but recommended).
  - `article` or `ending`: the correct choice (matches one of `answerChoices`).
  - `emoji`: optional visual cue.

- `grammarConfig`:

  - `answerChoices`: e.g., `['a','an']` or other set.

**Correct Answer**

- On click, in default branch:
  - `correctAnswer = item.article || item.ending;`
  - User’s `data-answer` is compared to this.

---

### 3.2 Some vs Any

**Detection**

- `answerChoices` includes both `'some'` and `'any'`.

**Learner View**

- Visual:
  - Emoji (`item.emoji`) plus a small overlay:
    - `?` (pink) for questions.
    - `✓` (green) for affirmative.
    - `✗` (red) for negatives.
- Text:
  - Only shows the **prefix before “some/any”** from `item.en`: e.g., `We have …`, `Do you have …`.
  - The quantifier itself is **not** shown in the prompt.
- Buttons:
  - Two buttons: `some` + noun, `any` + noun.
  - Noun comes from `item.word` (after stripping `some_`/`any_` and replacing `_` with spaces).

**Authoring**

- JSON item (typical):

  - `en`: full sentence with some/any (`We have some apples.`, `Do you have any pencils?`).
  - `word`: a noun key like `some_apples`, `any_apples`, `apples`.
  - `emoji`: context picture.

- `grammarConfig`:

  - `answerChoices: ['some', 'any']`.

**Correct Answer Logic**

- Compute `autoCorrectAnswer` from `item.en`:

  - Affirmative:
    - `there is/are`, `I/we/you/they have/need`, `he/she/it has/needs` → `'some'`.
  - Questions:
    - `Is/Are there…?`, `Do/Does + have/need…?` → `'any'`.
  - Negatives:
    - `There isn’t/aren’t…`, `don’t/doesn’t have/need` → `'any'`.

- `correctAnswer = 'some'` for affirmative; `'any'` otherwise.

---

### 3.3 This / That (Singular Demonstratives)

**Detection**

- `answerChoices` (`['this','that']`) with length 2.

**Learner View**

- Visual: `buildProximityScene(article, emoji)`:
  - “Near” scene for `this`.
  - “Far” scene for `that`.
- Text:
  - Cyan text shows `item.word` (e.g., `apple`, `bag`), not a full sentence.
- Buttons:
  - Two buttons: `'this'` and `'that'`.

**Authoring**

- JSON:

  - `word`: noun (`bag`, `apple`, etc.).
  - `article`: `'this'` or `'that'` (correct choice).
  - `emoji`: object.

- `grammarConfig`:

  - `answerChoices: ['this','that']`.

**Correct Answer**

- As generic mode: `correctAnswer = item.article`.

---

### 3.4 These / Those (Plural Demonstratives)

**Detection**

- `answerChoices` includes `'these'` and `'those'`.

**Learner View & Authoring**

- Same visual as this/that (near vs far), but for plural nouns.
- `word`: plural noun (`apples`, `books`).
- `article`: `'these'` or `'those'`.
- `grammarConfig.answerChoices: ['these','those']`.

**Correct Answer**

- `correctAnswer = item.article`.

---

### 3.5 Preposition Scenes (In / On / Under, etc.)

**Detection**

- `inOnUnderMode = isInOnUnderMode(answerChoices)`.

**Learner View**

- Visual:
  - `buildPrepositionScene(item.article, item.emoji, item.word)` draws a scene with object positions.
- Text:
  - Cyan answer box and text are suppressed; picture is the main cue.
- Buttons:
  - One button per `answerChoices` (e.g., `['in','on','under']`).

**Authoring**

- JSON:

  - `word`: object label.
  - `article`: the correct preposition (`'in'`, `'on'`, `'under'`, etc.).
  - `emoji`: scene hint.

- `grammarConfig`:

  - `answerChoices: ['in','on','under']` (or subset).

**Correct Answer**

- `correctAnswer = item.article` (the author-specified preposition).

---

### 3.6 Plurals Mode (Singular vs Plural Forms)

**Detection**

- `grammarConfig.isPluralMode === true`.

**Learner View**

- Visual:
  - Big emoji; no word text.
- Buttons:
  - Two buttons with **word forms**:
    - `singularWord` vs `pluralWord` (not “singular/plural” text).
  - Internally, `data-answer` is `'singular'` or `'plural'`.

**Authoring**

- JSON: items in **pairs**:

  - Singular item:
    - `id`: includes `_singular`.
    - `word`: singular form (e.g., `dog`).
    - `emoji`: picture.
  - Plural item:
    - `id`: includes `_plural`.
    - `word`: plural form (e.g., `dogs`).

- `grammarConfig`:

  - `isPluralMode: true`.
  - `answerChoices: ['singular','plural']` (used for internal tags).

**Correct Answer**

- If `item.id` includes `_singular` → correct `'singular'`.
- If `_plural` → `'plural'`.

---

### 3.7 Present Simple: Verb Choose (Affirmative)

**Detection**

- `isPresentSimpleList` and `grammarConfig.mode === 'present_simple_verb_choose'`.
- L2 file: `present_simple_sentences.json`.

**Learner View**

- Visual:
  - Emoji for action (e.g., 🏃, 🎮).
- Text:
  - Cyan subject only (e.g., `I`, `He`, `The kids`) extracted from `item.en`.
- Buttons:
  - Two verb forms: base vs 3rd-person-s (e.g., `walk` vs `walks`).

**Authoring**

- JSON:

  - `en`: full sentence (present simple).
  - `word`: subject+verb key like `i_walk`, `he_walks`.
  - `emoji`: context.

- `grammarConfig`:

  - `mode: 'present_simple_verb_choose'`.

**Correct Answer**

- Extract subject from `en` (first token or `The + noun`).
- Decide if subject is third-person singular (using a small whitelist: `he`, `she`, `it`, `the dog`, `the sun`, etc.).
- Extract/normalize base verb from `word` or `en`.
- Build 3rd-person form (s/es/ies).
- `correctAnswer = thirdForm` if subject is 3rd singular; else base form.

---

### 3.8 Present Simple: Yes/No (DO vs DOES)

**Detection**

- `isPresentSimpleYesNo` via `grammarFile` / `grammarName`.

**Learner View**

- Visual: emoji.
- Text:
  - Subject only (e.g., `you`, `she`, `the shop`) after stripping `Do/Does`.
- Buttons:
  - Chips: `DO` and `DOES` (capital letters).

**Authoring**

- JSON:

  - `en`: yes/no question (`Do you like…?`, `Does she play…?`).
  - `emoji`: optional.

- `grammarConfig`:

  - `answerChoices` not critical; DO/DOES pair is hard-coded in sub-mode.

**Correct Answer**

- Extract subject as first word(s) after do/does.
- If 3rd-person singular (he, she, it, singular `The + noun`) → `DOES`, else `DO`.

---

### 3.9 Present Simple: Negative (Don’t / Doesn’t)

**Detection**

- `isPresentSimpleNegative` via `grammarFile` / `grammarName`.

**Learner View**

- Visual: emoji.
- Text:
  - Subject only (`I`, `he`, `They`, `The shop`).
- Buttons:
  - Two chips: `"don't"` and `"doesn't"`.

**Authoring**

- JSON:

  - `en`: negative sentence (`I don't like…`, `He doesn't play…`).
  - `emoji`: optional.

- `grammarConfig`:

  - `answerChoices: ["don't","doesn't"]`.

**Correct Answer**

- Preferred: read actual negative from `en`:
  - Contains `doesn't/doesnt` → `"doesn't"`.
  - Contains `don't/dont` → `"don't"`.
- Fallback: subject → he/she/it → `"doesn't"`, others → `"don't"`.

---

### 3.10 Present Simple: WH Questions

**Detection**

- `isPresentSimpleWhQuestions` via file/name.

**Learner View**

- Visual: emoji.
- Text:
  - Big cyan **Korean** prompt (`item.ko`), not the English question.
- Buttons:
  - Four WH options (from `['who','what','when','where','why','how','which']`), one correct, three distractors.

**Authoring**

- JSON:

  - `en`: English WH question (`Where do you live?`).
  - `ko`: Korean translation / prompt.
  - `emoji`: context.

- `grammarConfig`:

  - `answerChoices` not used directly; WH pool is built in code.

**Correct Answer**

- Extract WH word from `en` (first token).
- Normalize to lowercase; default to `'what'` if unknown.
- Correct = that WH word.
- Distractors: 3 others chosen from WH pool; order is shuffled.

---

### 3.11 Short Questions 1 & 2 (Yes/No Short Answers)

**Detection**

- `isShortQuestions` via `short_questions_1.json` or `short_questions_2.json`.

**Learner View**

- Visual: emoji.
- Text:
  - Full English short question.
- Buttons:
  - Two full short-answer sentences (e.g., `Yes, I can.` vs `Yes, I am.`).

**Authoring**

- JSON:

  - `en`: short question (`Can you swim?`, `Is he from Korea?`, `Do they like pizza?`).
  - `emoji`: optional.

- List choice:

  - Set 1 (`short_questions_1`) = affirmative answers.
  - Set 2 (`short_questions_2`) = negative answers.

**Correct Answer**

- A pattern table in code inspects `en`:

  - Detects leading auxiliary (`Can`, `Is`, `Are`, `Do`, `Does`) and subject.
  - For each pattern, defines `correctAnswer` and `incorrectAnswer` strings.
  - Example: `Can you swim?` → `Yes, I can.` (correct) vs `Yes, I am.` (wrong).

---

### 3.12 There Is / Are – Statements & Questions

**Detection**

- `isThereStatementsMode` or `isThereQuestionsMode` via `answerChoices`.

**Learner View**

- Visual:
  - Emoji.
  - Pink noun phrase: extracted from `item.en` (after `there is/are/isn't/aren't` or `is/are there…`), stripped of extra location/time phrases.
- Buttons:
  - Statements:
    - Positive rounds: `"there is"` vs `"there are"`.
    - Negative-capable lists use `"there isn't"` vs `"there aren't"` in some rounds.
  - Questions:
    - `"Is there"` vs `"Are there"`.

**Authoring**

- JSON:

  - `en`: full statement or question involving `there is/are/isn't/aren't`.
  - `word`: hint like `there_is` / `there_are` / `there_isnt` / `there_arent` (optional but helps).
  - `emoji`: optional.

- `grammarConfig`:

  - Statements:
    - `answerChoices` contains `"there is"`, `"there are"`, optionally `"there isn't"`, `"there aren't"`.
  - Questions:
    - `answerChoices` contains `"Is there"` and `"Are there"`.

**Correct Answer**

- Determine noun phrase and plurality (quantifiers, -s/-es).
- Use `item.word` hints if present (`there_are`, `there_is`, `are_there`, `is_there`).
- Statements:
  - Positive → `"there are"` for plural, `"there is"` for singular.
  - Negative → `"there aren't"` for plural, `"there isn't"` for singular.
- Questions:
  - `"Are there"` for plural, `"Is there"` for singular.

---

### 3.13 Present Progressive – Choose Modes

These mirror the present simple sub-modes but target **BE + V‑ing**.

#### 3.13.1 Present Progressive BE Choose (Affirmative)

Already implemented:

- **Detection**
  - `present_progressive.json` or `grammarName` contains `present progressive` (and not `negative`, `yes/no`, or `WH`).

- **Learner View**
  - Full English sentence with the **BE chunk blanked**: e.g. `She ___ playing soccer.`
  - Three buttons: `am`, `is`, `are`.

- **Authoring**
  - JSON: `en` is a present progressive sentence, `emoji` optional.
  - No special `grammarConfig` keys required.

- **Correct Answer**
  - Read from `en`: detects which BE (`am/is/are`) appears with the subject and uses that as `correct_answer`.

#### 3.13.2 Present Progressive Negative (am not / isn’t / aren’t)

- **Detection**
  - Filename: `present_progressive_negative.json`, or
  - `grammarName` contains `present progressive: negative` (case-insensitive).

- **Learner View**
  - Shows **subject only** in cyan (`I`, `she`, `the kids`, etc.) with emoji.
  - Three buttons: `am not`, `isn't`, `aren't`.

- **Authoring**
  - JSON:
    - `en`: full negative progressive sentence (`I am not playing.`, `She isn't studying.`, `They aren't working.`).
    - `emoji`: optional context.
  - `grammarConfig`:
    - No special keys required; detection is by file/name.

- **Correct Answer**
  - Prefer to read the BE negative from `en`:
    - Contains `am not` → correct `"am not"`.
    - Contains `isn't`/`is not` → `"isn't"`.
    - Contains `aren't`/`are not` → `"aren't"`.
  - Fallback: infer from subject (`I` → `am not`; he/she/it/singular noun → `isn't`; others → `aren't`).

#### 3.13.3 Present Progressive Yes/No Questions (AM / IS / ARE)

- **Detection**
  - Filename: `present_progressive_questions_yesno.json`, or
  - `grammarName` contains `present progressive yes/no`.

- **Learner View**
  - English question in the data: `Is she playing soccer?`, `Are they studying?`, `Am I running?`.
  - UI shows **subject only** in cyan (after stripping `Am/Is/Are`) plus emoji.
  - Three buttons: `AM`, `IS`, `ARE`.

- **Authoring**
  - JSON:
    - `en`: yes/no question in present progressive.
    - `emoji`: optional.
  - `grammarConfig`: none required.

- **Correct Answer**
  - If `en` starts with `Am/Is/Are`, that form (uppercased) is `correct_answer`.
  - Fallback: derive from subject (I → `AM`; he/she/it/singular noun → `IS`; others → `ARE`).

#### 3.13.4 Present Progressive WH Questions (WH Choose)

- **Detection**
  - Filename: `present_progressive_questions_wh.json`, or
  - `grammarName` contains `present progressive WH`.

- **Learner View**
  - Same UI as **Present Simple WH Questions**:
    - Big **Korean prompt** from `item.ko`.
    - Emoji (optional).
    - Four WH buttons, one correct (`who/what/when/where/why/how/which`), three distractors.

- **Authoring**
  - JSON:
    - `en`: WH question in present progressive (`What is she doing?`, `Where are they going?`).
    - `ko`: Korean prompt.
    - `emoji`: optional.

- **Correct Answer**
  - Extracts WH word from `en` (first token), normalizes to lowercase.
  - Uses the same pool and distractor logic as present simple WH; logs type as `present_progressive_wh_choose`.

---

## 4. Session, Logging, and Summary

- **Session Start**: `startSession` called with:

  - `mode: 'grammar_mode'`.
  - `wordList`: up to 15 `word` values from the shuffled list.
  - `listName`: from `getListName()` or `grammarName`.
  - `meta`: `{ category: 'grammar', file: grammarFile }`.

- **Per-Attempt Logging** (`logAttempt`):

  - `session_id`, `mode: 'grammar_mode'`.
  - `word`: `item.id` or `item.word` or `item.en`.
  - `is_correct`, `answer`, `correct_answer`.
  - `points: 1` if correct.
  - `attempt_index`, `round`.
  - `extra` with `{ category: 'grammar', file: grammarFile, list: grammarName, ... }` and sometimes specific `type` (e.g., `present_simple_wh_choose`, `short_questions`).

- **End Session** (`endSession`):

  - Summary: `{ score, total, correct: score, points: score, pct: accuracy, category: 'grammar', context: 'game', duration_s, grammarName, grammarFile }`.
  - `renderGrammarSummary` shows score/total and uses `ctx` to allow returning to selector.

---

## 5. Authoring Checklist for a New Choose-Mode List

1. **Decide Sub-Mode & Grammar Decision**

   - Example: `Choose DON'T vs DOESN'T for subject` (present simple negative), `Choose the right WH word`, `Choose THERE IS vs THERE ARE`.

2. **Pick JSON Structure**

   - Minimal fields: `en`, `word`, `emoji`, `article`/`ending` as needed.
   - For WH lists: add `ko`.
   - For there is/are: ensure `en` fits there-pattern and `word` encodes `there_is` / `there_are` where possible.

3. **Set `grammarConfig`**

   - `answerChoices` to trigger mode:
     - `['a','an']`, `['some','any']`, `['this','that']`, `['these','those']`, `['there is','there are']`, `['Is there','Are there']`, etc.
   - `isPluralMode: true` for plurals.
   - `mode: 'present_simple_verb_choose'` for subject+verb form lists.

4. **Name / File Pattern**

   - Use filenames that match detection rules:
     - `present_simple_sentences.json`, `present_simple_negative.json`, `present_simple_questions_yesno.json`, `present_simple_questions_wh.json`, `short_questions_1.json`, `short_questions_2.json`, etc.
   - Or set `grammarName` to contain key phrases (`present simple: negative`, `present simple WH`).

5. **Educational Sanity Check**

   - Each item should clearly demonstrate the target structure.
   - Vocab should be simple; the learner’s decision should be mainly about the **grammar choice**.
   - Provide enough items per bucket (balance DO vs DOES, some vs any, etc.).

---

This spec is designed so that a future GPT (or developer) can read it and:

1. Decide which sub-mode applies to a new list.
2. Shape the JSON data and `grammarConfig` accordingly.
3. Wire the list in via filename/`grammarName` and `answerChoices`.
4. Ensure the learner sees the right prompt, visuals, and choices to practice the target grammar decision.
