# Grammar Find-The-Mistake Mode (O / X)

This document describes how the **Grammar Find-The-Mistake** mode works in `Games/english_arcade/modes/grammar_find_mistake.js`, and how to author lists that behave well with it.

It is aimed at:
- Engineers extending the find-the-mistake engine.
- Content authors creating Level 2 JSON lists that should generate **good vs bad** sentences automatically.

The goal: from a single **correct sentence list**, the engine builds a half-good / half-wrong deck and lets students decide if a sentence is correct (`O`) or has a mistake (`X`).

---

## 1. Overview

- **Mode file:** `Games/english_arcade/modes/grammar_find_mistake.js`
- **Entry point:** `runGrammarFindMistakeMode({ grammarFile, grammarName, grammarConfig })`
- **UI behavior:**
  - Shows one sentence at a time.
  - Student clicks `O` (correct) or `X` (wrong).
  - For wrong sentences, the engine highlights the mistake and then shows the full corrected sentence.
  - Session is short: up to 14 sentences, roughly **half correct / half incorrect**.
- **Logging & summary:**
  - Uses `startSession`, `logAttempt`, `endSession` from `students/records.js`.
  - Shows a shared summary view via `renderGrammarSummary` when the game ends.

---

## 2. Data Model (List Shape)

### 2.1 Required fields

Each item in the JSON list should have at least one English sentence field:

- `en` — preferred field for the English sentence.
- `exampleSentence` — used as fallback if `en` is missing.

The engine filters the loaded JSON to build `base`:

```js
const base = (Array.isArray(data) ? data : []).filter(it => (
  it && (it.en || it.exampleSentence)
));
```

If `base` is empty, the mode shows "No sentences." and exits.

### 2.2 Optional but recommended

- `word` — a key or label for the item (used in `wordList` for session logging).

No other fields are required for this mode. It **does not** use `article`, `contraction`, `answerChoices`, etc. Instead, it works entirely off the sentence text and the **type of list** (derived from filename / grammarName).

---

## 3. List-Type Detection

The mode chooses corruption patterns by detecting the list type from `grammarFile` and `grammarName`.

Flags computed at startup:

- `isSomeAnyList`
  - `grammarFile` ends with `some_vs_any.json`, **or**
  - `grammarName` contains `some vs any` (case-insensitive, flexible spaces).

- `isPresentSimpleList`
  - `grammarFile` ends with `present_simple_sentences.json`, **or**
  - `grammarName` contains `present simple sentences`.

- `isPresentSimpleNegativeList`
  - `grammarFile` ends with `present_simple_negative.json`, **or**
  - `grammarName` contains `present simple negative`.

- `isPresentSimpleYesNoList`
  - `grammarFile` ends with `present_simple_questions_yesno.json`, **or**
  - `grammarName` contains `present simple yes / question / yes / no`.

- `isPresentSimpleWhList`
  - `grammarFile` ends with `present_simple_questions_wh.json`, **or**
  - `grammarName` contains `present simple WH` or `WH questions`.

- `isThereIsAreList`
  - `grammarFile` ends with `there_is_vs_there_are.json`, **or**
  - `grammarName` contains `there is vs there are`.

Everything else falls back to **generic** corruption logic (see Section 5).

---

## 4. Deck Construction (Good vs Bad Rounds)

Once data is loaded and filtered, the mode builds a short mixed deck:

1. Compute `total` and `half`:
   - `total = Math.min(14, base.length)`.
   - `half = Math.floor(total / 2)`.
2. Shuffle and slice:
   - `shuffled = base.sort(() => Math.random() - 0.5).slice(0, total)`.
3. Build **good** rounds:
   - `good = shuffled.slice(0, half).map(it => ({ type: 'good', en: makeSentence(it), src: it }))`.
   - `makeSentence(it) = (it.en || it.exampleSentence || '').trim()`.
4. Build **bad** rounds:
   - `bad = shuffled.slice(half).map(it => {
       const en = makeSentence(it);
       const c = corruptSentence(en);
       return {
         type: 'bad',
         enBad: c.bad,
         enCorrect: en,
         wrongToken: c.wrongToken,
         correctToken: c.correctToken,
         src: it,
       };
     })`.
5. Merge and reshuffle:
   - `rounds = [...good, ...bad].sort(() => Math.random() - 0.5)`.

Each round has:

- `type`: `'good'` or `'bad'`.
- For good: `en` (correct sentence).
- For bad: `enBad` (corrupted), `enCorrect` (original), `wrongToken`, `correctToken`.

---

## 5. Corruption Engine (`corruptSentence`)

The heart of this mode is `corruptSentence(en)`, which returns:

- `bad`: the **wrong** version of the sentence.
- `wrongToken`: the token to be highlighted/struck-through in the wrong sentence.
- `correctToken`: the corresponding correct token (used for reference).

The function chooses a corruption strategy based on the detection flags. Rough order:

1. **Some vs Any (`isSomeAnyList`)**

   ```js
   function corruptSomeAny(en) { /* ... */ }
   ```

   - If the sentence contains `some` (case-insensitive), replace it with `any` (respecting capitalization).
   - If it contains `any`, replace it with `some`.
   - Returns `{ bad, wrongToken: 'any' | 'some', correctToken: 'some' | 'any' }`.

   **Authoring guidance:**
   - Use `some_vs_any.json` with clear `some` or `any` in each sentence.
   - Only one `some`/`any` per sentence where you want the mistake to appear.

2. **Present Simple Negative (`isPresentSimpleNegativeList`)**

   - Finds `doesn't` or `don't` and **flips them**, regardless of subject:
     - `doesn't` → `don't`
     - `don't` → `doesn't`
   - Capitalization is preserved.

   **Authoring guidance:**
   - Each sentence should contain either `don't` or `doesn't` exactly once.
   - Subject should still agree with the original correct form; the mode will corrupt it.

3. **Present Simple Sentences (`isPresentSimpleList`)**

   - Splits sentence into tokens, tries to identify **subject** and **first verb**.
   - Uses a helper to compute **base** and **3rd-person `-s` form** of the verb.
   - Decides which verb is correct based on subject:
     - Third singular subjects (`he`, `she`, `it`, or special-case `sun`) → `sForm` is correct.
     - Others → `baseForm` is correct.
   - Corrupts by replacing the verb with the **wrong** form.

   **Authoring guidance:**
   - Use simple present sentences like `He plays soccer.` / `They play soccer.`.
   - Subject should be first token (or `The Noun` type pattern) to match heuristics.

4. **There is vs There are (`isThereIsAreList`)**

   - If sentence starts with `There is`, change to `There are`.
   - If it starts with `There are`, change to `There is`.

   **Authoring guidance:**
   - Every sentence should start with `There is` or `There are`.
   - Follow with a noun phrase that clearly indicates singular vs plural.

5. **Present Simple Yes/No and WH Questions**

   Triggered when `isPresentSimpleYesNoList` or `isPresentSimpleWhList` is true.

   - Handles patterns:
     - `WH Do/Does subject verb rest` (e.g., `Where do they play soccer?`).
     - `Do/Does subject verb rest` (no WH).
   - Extracts:
     - `aux` (Do/Does)
     - `subj` (subject string)
     - `verb` (main verb)
   - Heuristically determines if subject is third singular.
   - Builds:
     - `correctAux` vs `wrongAux` (Do/Does).
     - `baseForm` vs `sForm` of the verb.
   - Creates up to three candidate wrong patterns:
     1. **Wrong auxiliary** (Does they / Do she).
     2. **Wrong verb form** (`Does she plays…` / `Do they plays…`).
     3. **Wrong aux + wrong verb form**.
   - Picks one pattern at random.

   **Authoring guidance:**
   - Yes/No questions: use `Do/Does + subject + verb + rest`.
   - WH questions: `WH + Do/Does + subject + verb + rest`.
   - Put the main verb once, right after the subject.

6. **Generic auxiliary swap**

   - For questions starting with `Do/Does/Is/Are/Can`, swaps the auxiliary:
     - `Do` ↔ `Does`
     - `Is` ↔ `Are`

7. **Subject-pronoun replacement**

   - If sentence starts with `He`, `She`, or `It`, replace with `They` / `We` / `You`.
   - Creates a subject-verb agreement mistake (assuming verb is 3rd singular in the original).

8. **Generic verb `+s` / `-s` tweak**

   - Looks at the third token (if it’s not an adverb/preposition/etc.).
   - If it ends with `s`, removes `s`; otherwise adds `s`.
   - Intended to create a plausible verb-form error.

9. **Fallback**

   - If no pattern fits, appends `!` to the sentence.
   - Marks `wrongToken = '!'` so it can still highlight something.

---

## 6. UI Flow & Student Experience

For each round:

1. Header shows:
   - List name (`grammarName` or `Grammar`).
   - Progress: `Q {current}/{total}`.
2. Sentence card displays:
   - Correct sentence (`r.en`) if `type === 'good'`.
   - Wrong sentence (`r.enBad`) if `type === 'bad'`.
3. Buttons:
   - `O` (Correct sentence)
   - `X` (Wrong sentence)

When the student clicks a button:

- `isCorrect` is true if:
  - `type === 'good'` and choice is `'O'`, or
  - `type === 'bad'` and choice is `'X'`.
- Plays SFX: `correct` or `wrong` via `playSFX`.
- Calls `reveal(round, isCorrect)`.
- Logs attempt via `logAttempt`.

### Reveal behavior

- Disables O/X buttons.
- Shows feedback:
  - For `good` rounds:
    - "Correct sentence ✔" message.
  - For `bad` rounds:
    - Shows "There is a mistake ✖".
    - Renders `r.enBad` but wraps `wrongToken` in a `<span>` with red color, bold font, and strikethrough.
    - Below that, shows the **full correct sentence** (`r.enCorrect`) inside a green-highlight box that slides up via a small animation.
- Adds extra vertical space and a `Next` / `Finish` button.
- Adds a global quit button (`wa-quit-btn`) near the bottom-right, consistent with other grammar modes.

---

## 7. Logging & Summary

### 7.1 Session logging

- Start:

```js
const sessionId = startSession({
  mode: 'grammar_find_mistake',
  listName: grammarName,
  wordList: rounds.map((r, i) => r.src?.word || `s${i}`),
  meta: { grammarFile }
});
```

- Per attempt (`decide(choice)`):

```js
logAttempt({
  session_id: sessionId,
  mode: 'grammar_find_mistake',
  word: r.src?.word || `s${idx}`,
  is_correct: isCorrect,
  answer: choice,          // 'O' or 'X'
  correct_answer: r.type === 'good' ? 'O' : 'X',
  extra: { type: r.type }  // 'good' or 'bad'
});
```

### 7.2 End of game

When all rounds are done:

```js
endSession(sessionId, {
  mode: 'grammar_find_mistake',
  summary: {
    score: correct,
    total: rounds.length,
    correct,
    wrong,
    points: correct,
    pct: Math.round((correct / (rounds.length || 1)) * 100),
    category: 'grammar',
    context: 'game',
    grammarName,
    grammarFile,
  },
  listName: grammarName,
  wordList: rounds.map((r, i) => r.src?.word || `s${i}`),
  meta: { grammarFile, grammarName }
});
```

Then it plays `end` SFX and uses `renderGrammarSummary` to show the standard grammar summary screen.

---

## 8. Author Checklist (Find-The-Mistake Lists)

Use this checklist when creating or editing lists for this mode.

### 8.1 Basic structure

- [ ] Each item has a clear English sentence in `en` (preferred) or `exampleSentence`.
- [ ] Only one **target grammar feature** per sentence (e.g., a single `some`/`any`, a single DO/DOES question pattern).

### 8.2 File naming & grammarName

- [ ] The filename matches one of the supported patterns if you want special behavior:
  - `some_vs_any.json`
  - `present_simple_sentences.json`
  - `present_simple_negative.json`
  - `present_simple_questions_yesno.json`
  - `present_simple_questions_wh.json`
  - `there_is_vs_there_are.json`
- [ ] Or `grammarName` clearly contains phrases like `Present Simple Negative`, `WH questions`, `There is vs There are`, etc.

### 8.3 List-specific rules

- **Some vs Any list**
  - [ ] Each sentence contains exactly one `some` or `any` in the spot you want to test.

- **Present Simple sentences list**
  - [ ] Sentences are simple subject + verb structure (e.g., `He plays games.`).
  - [ ] Subject is at the start; verb is the next meaningful word (so heuristics can find it).

- **Present Simple negative list**
  - [ ] Each sentence contains `don't` or `doesn't` exactly once.
  - [ ] Subject and verb agree with the original form.

- **Present Simple yes/no questions list**
  - [ ] Questions follow `Do/Does + subject + verb + rest`.
  - [ ] Main verb appears only once, right after the subject.

- **Present Simple WH questions list**
  - [ ] Questions start with a WH word (`Who/What/When/Where/Why/How/Which`).
  - [ ] Prefer `WH + Do/Does + subject + verb + rest` patterns.

- **There is vs There are list**
  - [ ] Each sentence starts with `There is` or `There are`.
  - [ ] Noun phrase clearly indicates singular or plural.

### 8.4 Logging & analytics

- [ ] `word` is set to something stable (e.g., an ID or key) so logs are easier to interpret.

### 8.5 Testing

- [ ] Play through the Find-The-Mistake mode for this list.
- [ ] For each sentence:
  - Correct ones are truly correct.
  - Wrong ones are obviously wrong in the intended way (agreement, some/any, DO/DOES, etc.).
  - The highlighted `wrongToken` aligns with the actual error.

With these guidelines, future authors can safely create and maintain lists that produce clear, pedagogically useful O/X mistake questions using `grammar_find_mistake.js`.