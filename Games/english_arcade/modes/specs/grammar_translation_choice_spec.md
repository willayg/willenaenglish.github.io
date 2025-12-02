# Grammar Translation Choice Mode (KO → EN)

This document describes how the **Grammar Translation Choice** mode works in `Games/english_arcade/modes/grammar_translation_choice.js`, and how to author lists that behave well with it.

It is aimed at:
- Engineers extending the translation-choice engine.
- Content authors creating Level 2 JSON lists that should generate **KO→EN multiple-choice** questions with good grammar-focused distractors.

The goal: from a list of **Korean–English sentence pairs**, build questions where the student sees a Korean prompt and chooses the correct English sentence from **three options**:

1. Correct answer (right meaning and grammatically correct).
2. Grammar-wrong version of the correct answer (same meaning, grammar error).
3. Meaning-wrong sentence (grammatically fine, but different meaning).

---

## 1. Overview

- **Mode file:** `Games/english_arcade/modes/grammar_translation_choice.js`
- **Entry point:** `runGrammarTranslationChoiceMode({ grammarFile, grammarName, grammarConfig })`
- **Direction:** Always **Korean → English**.
- **UI behavior:**
  - Loads the JSON list from `grammarFile`.
  - Filters to items that have both `en` (English) and `ko` (Korean).
  - Randomly selects up to **15 items** for a session.
  - For each item:
    - Shows an emoji and the Korean sentence.
    - Shows 3 English options (one correct, two distractors).
    - Student clicks an option → instant feedback + SFX → "Next Question" / "Finish" button.
  - At the end, logs summary via `endSession` and uses `renderGrammarSummary` for the result card.

---

## 2. Data Model (List Shape)

### 2.1 Required fields per item

Each item is a **sentence pair**:

- `ko` — Korean prompt shown on the card.
- `en` — target English sentence (the correct answer).

Filtering to valid items:

```js
const validItems = grammarData.filter(item => item && item.en && item.ko);
```

If there are no valid items, the mode shows "No translation items available." and exits.

### 2.2 Optional but recommended fields

- `emoji` — optional emoji icon displayed above the Korean sentence.
- `word` — stable key/ID used for logging and session word list.
- `id` — fallback ID if `word` is missing.

These do **not** affect distractor logic; they are for presentation and analytics.

---

## 3. List-Type Detection

The mode matches **list types** using `grammarFile` and `grammarName`, in order to attach specialized grammar logic for some lists:

In `renderQuestion()`:

```js
const isSomeAny = /some\s*vs\s*any/i.test(String(grammarName||''))
  || /some_vs_any\.json$/i.test(String(grammarFile||''));

const isThereIsAreList = /there_is_vs_there_are\.json$/i.test(String(grammarFile||''))
  || /there\s+is\s+vs\s+there\s+are/i.test(String(grammarName||''));

const isPresentSimpleNegative = /present_simple_negative\.json$/i.test(String(grammarFile||''))
  || /present\s*simple[\s:\-]*negative/i.test(String(grammarName||''));

const isPresentSimple = /present_simple_sentences\.json$/i.test(String(grammarFile||''))
  || (/\bpresent\s*simple\b/i.test(String(grammarName||'')) && !isPresentSimpleNegative);
// Present Progressive variants (specific first)
const isPPNegative = /present_progressive_negative\.json$/i.test(String(grammarFile||''))
  || /present\s*progressive[\s:\-]*negative/i.test(String(grammarName||''));
const isPPYesNo = /present_progressive_questions_yesno\.json$/i.test(String(grammarFile||''))
  || /present\s*progressive.*yes\s*\/\s*no/i.test(String(grammarName||''));
const isPPWh = /present_progressive_questions_wh\.json$/i.test(String(grammarFile||''))
  || /present\s*progressive[\s:\-]*wh/i.test(String(grammarName||''));
const isPresentProgressive = (!isPPNegative && !isPPYesNo && !isPPWh) && (
  /present_progressive\.json$/i.test(String(grammarFile||'')) || /present\s*progressive/i.test(String(grammarName||''))
);
```

Flags:

- `isSomeAny` — Some vs Any lists.
- `isThereIsAreList` — There is / There are lists.
- `isPresentSimpleNegative` — Present Simple negative lists.
- `isPresentSimple` — Present Simple affirmative lists.

Other lists fall back to **generic** auxiliary-based distractors.

New present progressive specializations:
- `isPPNegative`: progressive negatives.
- `isPPYesNo`: progressive yes/no questions.
- `isPPWh`: progressive WH questions (supports omitted-subject like “Who is singing?”).

---

## 4. Deck Construction & Session Setup

After loading `grammarData` and building `validItems`:

1. **Shuffle and limit**:

```js
const shuffled = validItems.sort(() => Math.random() - 0.5);
const items = shuffled.slice(0, Math.min(15, shuffled.length));
```

2. **Session state:**

- `currentIndex = 0`.
- `correctCount = 0`.
- `wrongCount = 0`.

3. **Start session:**

```js
const sessionId = startSession({
  mode: 'grammar_translation_choice',
  listName: grammarName,
  wordList: items.map(it => it.word || it.id),
  meta: { grammarFile, direction: 'KO→EN', input_type: 'mc' }
});
```

The `wordList` is for analytics; `word` or `id` is used.

---

## 5. Per-Question Flow & UI

On each question (`renderQuestion()`):

1. **End check:**

```js
if (currentIndex >= items.length) {
  endGame();
  return;
}
```

2. **Current item:**

```js
const item = items[currentIndex];
const correctEn = item.en.trim();
const ko = item.ko.trim();
const emoji = item.emoji || '📖';
```

3. **Build pool of other sentences:**

```js
const pool = validItems.filter(v => v.en && v.en !== correctEn);
```

4. **Select distractor builder:**

- If `isThereIsAreList` → `buildThereIsAreOptions(correctEn, pool)`.
- Else if `isPresentSimpleNegative` → `buildPresentSimpleNegativeOptions(correctEn, pool)`.
- Else if `isPresentSimple` → `buildPresentSimpleOptions(correctEn, pool)`.
- Else if `isSomeAny`:
  - Call `generateSomeAnyDistractors(correctEn, pool)`.
  - Treat first as **grammar-wrong** and second as **meaning-wrong**.
- Else → `buildGenericTranslationOptions(correctEn, pool)`.

Each builder returns or defines:

- `grammarWrong` — grammar-wrong version of `correctEn`.
- `meaningWrong` — meaning-wrong sentence, typically pulled from `pool`.

5. **Bake options array:**

```js
const options = [correctEn, grammarWrong, meaningWrong]
  .filter((v, idx, arr) => typeof v === 'string' && v && arr.indexOf(v) === idx)
  .slice(0, 3);

while (options.length < 3 && pool.length) {
  const candidate = pool.shift().en;
  if (candidate && !options.includes(candidate)) options.push(candidate);
}

const shuffledOptions = options.sort(() => Math.random() - 0.5);
```

There will always be up to 3 unique options; if one of the builder outputs duplicates, extra options come from `pool`.

6. **Rendering UI**

- Root:
  - `container.innerHTML = '';`
  - `container.classList.add('translation-mode-root');`

- Header (`.translation-header`):
  - Shows **score**: `correctCount / wrongCount`.
  - Shows **progress**: `Question X of N`.
  - Exit button (`#translationExitBtn`) with hover effects and logic:
    - Tries `window.WordArcade.startGrammarModeSelector()`.
    - Or `window.WordArcade.quitToOpening(true)`.
    - Else `history.back()` (fallback to `location.reload()` on error).

- Prompt card (`.translation-prompt`):
  - Emoji: `emoji`.
  - Korean text: `ko`.
  - For long Korean (`ko.length > 28` / `> 40`), font size / line height is reduced.

- Instructions (`.translation-instructions`):
  - Text: `"Choose the correct English translation:"`.
  - Carries `data-translate-key="grammar_translation_choice_instruction"` for localization.

- Options grid (`.translation-options`):
  - For each `opt` in `shuffledOptions`, create `.option-btn`:
    - `btn.textContent = opt`.
    - Hover: change border color / box shadow / slight lift.
    - Click handler: `handleAnswer(opt, correctEn, btn, optionsGrid)`.

- After building DOM, it calls `StudentLang.applyTranslations()` if available.

7. **Styles & responsiveness**

`injectTranslationResponsiveStyles()` injects a `<style>` block into `<head>`:

- `.translation-mode-root`: flex column, full-height, responsive padding.
- `.translation-header`: score, progress, exit layout.
- `.translation-prompt`: card with border, emoji, Korean text.
- `.translation-options .option-btn`: button styling with `clamp()` font sizes and heights.
- `.translation-next-btn`, `.translation-result-card` (for summary), `.translation-back-btn`.
- Media queries for small viewport heights to compress spacing and padding.

---

## 6. Distractor Builders (Per Mode)

### 6.1 Generic builder (`buildGenericTranslationOptions`)

Used when no more-specific list type is detected.

```js
function buildGenericTranslationOptions(correctEn, pool){
  const grammarDistractors = generateDistractors(correctEn, pool.slice());
  const grammarWrong = grammarDistractors[0] || correctEn;

  let meaningWrong = null;
  if (pool && pool.length) {
    const pick = pool[Math.floor(Math.random() * pool.length)];
    meaningWrong = pick?.en || null;
  }

  if (!meaningWrong) {
    const m = correctEn.match(/^(There\s+(?:is|are)\s+)(.+)$/i);
    if (m && pool.length) {
      const other = pool.find(p => p.en && p.en !== correctEn);
      if (other) {
        const om = other.en.match(/^(There\s+(?:is|are)\s+)(.+)$/i);
        if (om) meaningWrong = m[1] + om[2];
      }
    }
  }

  if (!meaningWrong) meaningWrong = grammarDistractors[1] || grammarWrong;

  return { grammarWrong, meaningWrong };
}
```

- `grammarWrong` is the first grammar distractor if available, or falls back to `correctEn`.
- `meaningWrong` is:
  - Random `pool.en`, or
  - When sentence looks like `There is/are ...`, reuse the correct `There is/are` and swap in a noun phrase from a different `there` sentence, or
  - Fallback to a second grammar distractor or to `grammarWrong`.

### 6.2 There is / There are (`buildThereIsAreOptions`)

```js
function buildThereIsAreOptions(correctEn, pool){
  let grammarWrong = correctEn;
  const low = correctEn.toLowerCase();
  if (/^there\s+is\b/.test(low)) {
    grammarWrong = correctEn.replace(/^(there\s+)is\b/i, '$1are');
  } else if (/^there\s+are\b/.test(low)) {
    grammarWrong = correctEn.replace(/^(there\s+)are\b/i, '$1is');
  }

  let meaningWrong = null;
  const baseMatch = correctEn.match(/^(there\s+(?:is|are)\s+)(.+)$/i);
  if (baseMatch) {
    const auxPart = baseMatch[1];
    const other = (pool || []).find(p => p.en && /^there\s+(?:is|are)\s+/i.test(p.en) && p.en !== correctEn);
    if (other) {
      const otherMatch = other.en.match(/^(there\s+(?:is|are)\s+)(.+)$/i);
      if (otherMatch) {
        meaningWrong = auxPart + otherMatch[2];
      }
    }
  }

  if (!meaningWrong && pool && pool.length) {
    meaningWrong = pool[0].en;
  }

  return { grammarWrong, meaningWrong };
}
```

- Grammar-wrong:
  - Flips `is`↔`are` while keeping the same noun phrase.
- Meaning-wrong:
  - Same `There is/are` aux, but noun phrase from a different `there` sentence in the pool.

### 6.3 Present Simple sentences (`buildPresentSimpleOptions`)

Used for affirmative present simple lists.

```js
function buildPresentSimpleOptions(correctEn, pool){
  const tokens = String(correctEn || '').split(/\s+/);
  if (tokens.length < 2) return { grammarWrong: correctEn, meaningWrong: pool[0]?.en || correctEn };
  const lower = tokens.map(t => t.toLowerCase());
  let subjIdx = 0;
  if (lower[0] === 'the' && tokens.length >= 3) subjIdx = 1;
  let verbIdx = subjIdx + 1;
  if (verbIdx >= tokens.length) verbIdx = 1;
  const origVerb = tokens[verbIdx] || '';
  const bare = origVerb.replace(/[.,!?;:]+$/g, '');
  const punct = origVerb.slice(bare.length);
  // ... makeForms ...
  const [baseForm, sForm] = makeForms(bare);
  const wrongVerb = (bare === sForm) ? baseForm : sForm;
  const badTokens = tokens.slice();
  badTokens[verbIdx] = (wrongVerb || bare) + punct;
  const grammarWrong = badTokens.join(' ');
  const meaningWrong = (pool && pool.length)
    ? (pool.find(p => p.en && p.en !== correctEn)?.en || pool[0].en)
    : correctEn;
  return { grammarWrong, meaningWrong };
}
```

- Grammar-wrong:
  - Toggles the verb form between its base and `-s`/`-es`/`-ies` forms, simulating agreement errors.
- Meaning-wrong:
  - A different present simple sentence from the pool.

### 6.4 Present Simple negative (`buildPresentSimpleNegativeOptions`)

```js
function buildPresentSimpleNegativeOptions(correctEn, pool){
  const rxDoesnt = /\bdoesn['’]?t\b/i;
  const rxDont = /\bdon['’]?t\b/i;
  let grammarWrong = correctEn;
  if (rxDoesnt.test(correctEn)) {
    grammarWrong = correctEn.replace(rxDoesnt, (m)=> (m[0]===m[0].toUpperCase()?"Don't":"don't"));
  } else if (rxDont.test(correctEn)) {
    grammarWrong = correctEn.replace(rxDont, (m)=> (m[0]===m[0].toUpperCase()?"Doesn't":"doesn't"));
  }
  const meaningWrong = (pool && pool.length)
    ? (pool.find(p => p.en && p.en !== correctEn)?.en || pool[0].en)
    : correctEn;
  return { grammarWrong, meaningWrong };
}
```

- Grammar-wrong:
  - Flips `doesn't` ↔ `don't` (preserving capitalization).
- Meaning-wrong:
  - Any other negative sentence from the pool.

### 6.5 Some vs Any (`generateSomeAnyDistractors`)

```js
function generateSomeAnyDistractors(correctEn, pool){
  const outs = [];
  // 1) Flip some/any preserving case
  // 2) Replace noun after some/any or final content word with noun from pool
  // 3) If still <2, reuse generic generateDistractors
  return outs.slice(0,2);
}
```

- First distractor: `some` ↔ `any` (same sentence skeleton).
- Second distractor: noun variation near `some/any` or at the sentence end.
- If still fewer than 2, it calls `generateDistractors` and uses those outputs.

In `renderQuestion()`:

```js
const sa = generateSomeAnyDistractors(correctEn, pool);
grammarWrong = sa[0] || correctEn;
meaningWrong = sa[1] || (pool[0]?.en || correctEn);
```

So:
- `sa[0]` becomes the grammar-focused distractor.
- `sa[1]` becomes meaning-focused.

### 6.6 Generic auxiliary-based distractors (`generateDistractors`)

```js
function generateDistractors(correctEn, pool) {
  const distractors = [];
  const auxMatch = correctEn.match(/^(Do|Does|Is|Are|Can|Could|Will|Would|Should)\s+/i);
  const aux = auxMatch ? auxMatch[1].toLowerCase() : null;
  // Extract subject & rest, then build:
  // 1) Wrong auxiliary for same subject
  // 2) Alternate auxiliary type (meaning shift or structure error)
  // 3) If needed, verb +s/-s tweak with swapped aux
  // 4) If still short, random pool sentences
  return distractors.slice(0, 2);
}

### 6.7 Present Progressive – Negative (`buildPresentProgressiveNegativeOptions`)

- Grammar-wrong: swap the BE inside the negative chunk while preserving contraction style.
  - Examples: `I am not …` → `I is not …`; `He isn't …` → `He aren't …`; `They aren't …` → `They isn't …`.
- Meaning-wrong: keep the negative chunk (subject + BE + not) and swap the `V‑ing` phrase from another progressive sentence.

### 6.8 Present Progressive – Yes/No Questions (`buildPresentProgressiveYesNoOptions`)

- Pattern: `Am/Is/Are + subject + … V‑ing … ?`.
- Grammar-wrong: wrong BE for subject.
  - Examples: `Is he …?` → `Are he …?`; `Are they …?` → `Is they …?`; `Am I …?` → `Is I …?`.
- Meaning-wrong: keep `BE + subject`, swap in a different `V‑ing` phrase from another question.

### 6.9 Present Progressive – WH Questions (`buildPresentProgressiveWhOptions`)

- Pattern: `WH + Am/Is/Are + (subject|V‑ing) …` (supports omitted-subject like `Who is singing?`).
- Grammar-wrong: flip the BE immediately after the WH word (preserve capitalization).
  - Examples: `Where is she …?` → `Where are she …?`; `Who is singing?` → `Who are singing?`.
- Meaning-wrong: keep `WH + BE (+ subject)`, swap the first `V‑ing` phrase from another progressive sentence.
```

- **Distractor 1**: wrong aux for same subject (`Can`→`Do/Does`, `Do`↔`Does`, `Is`↔`Are`).
- **Distractor 2**: alternate aux type (e.g., `Do`→`Can`, `Is/Are`→`Does/Do`).
- If still <2 and aux is Do/Does, add verb form mismatch + wrong aux.
- If still <2, fill with random sentences from pool.

---

## 7. Answer Handling, Logging & Summary

### 7.1 Answer handling

`handleAnswer(selected, correct, btn, optionsGrid)`:

- `isCorrect = (selected === correct)`.
- Disable all option buttons.
- Visual feedback:
  - If correct: highlight selected in green (`borderColor` / `background`) and increment `correctCount`.
  - If wrong: highlight selected in red; find the correct button and highlight it in green; increment `wrongCount`.
- Play SFX:

```js
try { playSFX('correct'); } catch {}
// or 'wrong'
```

- Log attempt:

```js
logAttempt({
  session_id: sessionId,
  mode: 'grammar_translation_choice',
  word: item.word || item.id,
  is_correct: isCorrect,
  answer: selected,
  correct_answer: correct,
  extra: {
    direction: 'KO→EN',
    input_type: 'mc',
    korean_prompt: item.ko,
    distractor_count: 2
  }
});
```

- After 600 ms, append a `translation-next-btn` to proceed or finish:

```js
nextBtn.textContent = currentIndex < items.length - 1 ? 'Next Question' : 'Finish';
```

### 7.2 End of game

`endGame()`:

- Calculate accuracy:

```js
const totalAttempts = correctCount + wrongCount;
const accuracy = totalAttempts > 0
  ? Math.round((correctCount / totalAttempts) * 100)
  : 0;
```

- `endSession`:

```js
endSession(sessionId, {
  mode: 'grammar_translation_choice',
  summary: {
    correct: correctCount,
    wrong: wrongCount,
    total: items.length,
    accuracy,
    grammarName,
    grammarFile
  },
  listName: grammarName,
  wordList: items.map(it => it.word || it.id),
  meta: { grammarFile, grammarName, direction: 'KO→EN' }
});
```

- Play `end` SFX and show grammar summary:

```js
renderGrammarSummary({
  gameArea: container,
  score: correctCount,
  total: items.length,
  ctx: {}
});
```

---

## 8. Author Checklist (Translation Choice Lists)

Use this when creating or editing lists for `grammar_translation_choice`.

### 8.1 Basic structure

- [ ] Each item has:
  - [ ] `ko` (Korean sentence or phrase).
  - [ ] `en` (English sentence matching the Korean).
- [ ] English sentences are **short and clear** and fit one of the supported patterns (see below).

### 8.2 File naming & `grammarName`

- [ ] The filename and/or `grammarName` correctly identify the type:
  - Some vs Any: `some_vs_any.json` or name includes `some vs any`.
  - Present Simple sentences: `present_simple_sentences.json`.
  - Present Simple negative: `present_simple_negative.json`.
  - There is vs There are: `there_is_vs_there_are.json`.
- [ ] If you add future specialized modes, follow the same detection style (clear filename and name patterns).

### 8.3 List-specific rules

- **Some vs Any list**
  - [ ] `en` contains exactly one `some` or `any` in the target position.
  - [ ] Korean side (`ko`) clearly distinguishes when `some` vs `any` is appropriate.

- **Present Simple sentences list**
  - [ ] `en` is a simple present sentence like `He plays games.`, `They play games.`.
  - [ ] Subject appears first (or after `The`), verb is next, so the heuristic can find it.

- **Present Simple negative list**
  - [ ] Each `en` contains exactly one `don't` or `doesn't`.
  - [ ] Subject and verb agree with the original correct form.

- **There is vs There are list**
  - [ ] Each `en` starts with `There is` or `There are`.
  - [ ] Noun phrase clearly indicates singular or plural.

### 8.4 Logging & analytics

- [ ] `word` or `id` is set to a stable key so `wordList` and logs are easy to interpret.
- [ ] You can use `grammarName` to group lists (e.g., "Present Simple – KO→EN"), which will appear in summaries.

### 8.5 Testing

- [ ] Play through the Translation Choice mode for each list:
  - [ ] For each item, the correct English option always appears.
  - [ ] Grammar-wrong options show **typical errors** (auxiliary or verb agreement) rather than nonsense.
  - [ ] Meaning-wrong options are grammatically correct and clearly different from the correct sentence.
- [ ] Long Korean prompts still display legibly on small screens.

With this spec, future agents and authors can confidently extend `grammar_translation_choice.js` and build new KO→EN grammar-focused translation lists while keeping behavior consistent with the existing 7 public lists.