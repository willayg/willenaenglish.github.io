# Grammar Sorting Mode – Authoring & Coding Spec

---

## [2025-11-18] Present Progressive Negative & Yes/No Sorting Update

- **Routing order fixed:** Negative and Yes/No lists now match before the general present progressive route. This ensures that `present_progressive_negative.json` and `present_progressive_questions_yesno.json` use their own strategies, not the default.
- **Negative chips masking:** Chips for negative sentences now hide "isn't", "aren't", "is not", "are not", "am not" as blanks, so chips look like `He ___ not running...` or `I ___ not eating...`.
- **Yes/No chips masking:** Chips for yes/no questions now start with a blank, e.g. `___ he playing...?`, `___ they watching...?`.
- **Buckets:**
  - Negative: Three pots labeled `am not`, `isn't`, `aren't`.
  - Yes/No: Three pots labeled `AM`, `IS`, `ARE`.
- **General present progressive:** Only matches if not negative or yes/no, so buckets are `am`, `is`, `are` and chips look like `He ___ playing...`.

---

This document tells you how to design and implement grammar lists for the **Grammar Sorting (choose)** mode in `Games/english_arcade`. Follow this whenever you add new lists or update existing ones.

The implementation lives in:

- Mode logic: `Games/english_arcade/modes/grammar_sorting.js`
- Level 2 modal: `Games/english_arcade/ui/level2_grammar_modal.js`
- Data files: `Games/english_arcade/data/grammar/<level>/<list_name>.json`

---

## 1. Concept: What Grammar Sorting Mode Does

- Shows a **pool** of items (sentences, subjects, verbs, or noun phrases) as clickable chips.
- Shows **2–5 labeled buckets**, each representing a grammar choice (e.g., DO vs DOES, There is vs There are).
- The learner **clicks a chip**, then **clicks a bucket**. The game immediately marks the choice **correct or incorrect**.
- Only **3 chips** are visible at a time; new chips appear as you sort.
- At the end, the game shows a **score + accuracy summary** and reports progress for that list.

---

## 2. Key Moving Parts

When you design a new list, you are deciding:

1. **Grammar Decision**  
   Example: DO vs DOES, some vs any, There is vs There are, don’t vs doesn’t.

2. **Visible Unit (Chip Text)**  
   Example: subject only ("he", "they"), noun phrase ("two cats"), verb form ("walks"), or full sentence.

3. **Buckets (Categories)**  
   Strategy-specific internal keys like `do`, `does`, `there_is`, `there_are`, `some`, `any`, etc.  
   What label appears to the learner (e.g., "DO", "DOES", "There is").

4. **Classification Logic**  
   How the code decides which bucket each item belongs to.  
   Implemented inside `categoryStrategies` in `grammar_sorting.js`.

5. **Data Structure**  
   JSON items typically have:  
   - `en` (sentence/question text, required)  
   - `answer_positive` (optional positive answer)  
   - `answer_negative` (optional negative answer)

---

## 3. Strategies: How Lists Are Routed

`grammar_sorting.js` uses **strategies** to decide how to sort and display items. Each has:

- `name`: strategy ID
- `detect(rawItems)`: heuristic detection (fallback)
- `classify(text)`: returns a category key for a sentence
- `categories()`: all possible category keys
- Optional `displayLabel(key)`: how to show the bucket label

Routing happens in `chooseCategoryStrategy(rawItems, { grammarFile, grammarName })`:

- It first checks **filename / grammarName patterns** for hard routing.
- If no match, it tries each strategy’s `detect`.
- If still nothing, it falls back to `short_questions`.

### 3.1 Existing Strategies (Reuse These When Possible)

1. **`short_questions_be_do`**  
   Use for **Short Questions 1 & 2** (BE vs DO).  
   Categories: `['be', 'do']`  
   Labels:  
   - `be` → `"BE Verb (is, are, am)"`  
   - `do` → `"DO Verb (do, does)"`  
   Classification (simplified):  
   - Sentences starting with IS/ARE/AM/ISN'T/AREN'T/AM NOT / WAS/WERE → `be`  
   - Sentences starting with DO/DOES/DON'T/DOESN'T → `do`

2. **`there_is_are_statements`**  
   Use for **There is vs There are** statements.  
   Categories: `['there_is', 'there_are']`  
   Labels: `"There is"`, `"There are"`  
   Classification:  
   - Starts with `"there are"` → `there_are`  
   - Starts with `"there is"` → `there_is`  
   - `"Are there…"`, `"There aren’t…"` → `there_are`  
   - `"Is there…"`, `"There isn’t…"` → `there_is`  
   - Fallback: look at noun phrase; plural/quantity → `there_are`, else `there_is`.

3. **`there_is_are_questions`**  
   Use for **Is there vs Are there?** questions.  
   Same categories and labels as above, but labels are `"Is there"` / `"Are there"`.  
   Classification favors `are` for plural nouns and `is` otherwise.

4. **`some_any`**  
   Use for **Some vs Any**.  
   Categories: `['some', 'any']`  
   No custom labels (labels = keys).  
   Classification:  
   - If sentence includes `any` → `any`  
   - If includes `some` → `some`  
   - If questions with have/need/there is there → `any`  
   - Negatives with have/need or there → `any`  
   - Plain statements with have/need/there → `some`  
   Note: Not used when "There is/are" pattern is strongly dominant (that list should use `there_is_are_*` instead).

5. **`short_questions` (fallback)**  
   Generic short-question classifier (DO/DOES/IS/ARE/CAN).  
   Categories: `['do', 'does', 'is', 'are', 'can']`.  
   Used by **Present Simple WH Questions** and any generic question sets.

6. **`present_simple_subject_groups`**  
   Use for **Present Simple: Sentences** (verb form with/without -s).  
   Categories: `['third_singular', 'others']`  
   Labels:  
   - `third_singular` → `"He, She, It, the dog (3인칭 단수)"`  
   - `others` → `"We, They, You, I, the dogs"`  
   Classification:  
   - Extracts subject (first word, or `the + noun`).  
   - Subjects in `['he','she','it','the dog','the sun','the kid','the girl','the boy','the cat','william']` → `third_singular`.  
   - Everything else → `others`.  
   Chip text: **verb form only**, extracted from the sentence.

7. **`present_simple_negative_subjects`**  
   Use for **Present Simple: Negative** (don’t vs doesn’t).  
   Categories: `['doesnt','dont']`  
   Labels: `"doesn't"`, `"don't"`  
   Classification:  
   - If sentence contains `doesn't/doesnt` → `doesnt`.  
   - If contains `don't/dont` → `dont`.  
   - Else, fallback by subject (he/she/it → `doesnt`; `"the + singular"` → mostly `doesnt`, plural nouns → `dont`).  
   Chip text: **subject-only label** (e.g., `"He"`, `"I"`, `"The shop"`).

8. **`present_simple_yesno_do_does`**  
   Use for **Present Simple: Yes/No Questions**.  
   Categories: `['do','does']`  
   Labels: `"DO"`, `"DOES"`  
   Classification:  
   - Question starting with `"Does"` → `does`.  
   - Starting with `"Do"` → `do`.  
   Chip text: **subject-only label** (subject after Do/Does).

---

## 4. How Pool Items and Chips Are Built

Inside `runGrammarSortingMode`:

1. It loads `raw` JSON (`en`, optional `answer_positive`, `answer_negative`).
2. It builds `items`:
   - `question`: main sentence (`en` / `example` / `word`)  
   - `pos`, `neg`: positive/negative answers if present  
   - `category`: result of `strategy.classify(question)`  
   - For some strategies: `verbForm` or `subjectLabel`.

3. It works out which categories are **active** based on which ones actually appear in `items`.

4. It builds **pool items**:

   - **There is/are** strategies:  
     - Prefer noun phrase chips via `extractThereNounPhrase(question)`.  
     - Fallback: use `answer_positive` / `answer_negative` sentences; if none, use the original questions.

   - **Present Simple subject groups**:  
     - Use each sentence as a pool item, but chip shows just `verbForm`.

   - **Present Simple negative and yes/no**:  
     - Use each sentence; chip shows `subjectLabel`.

   - **Other strategies**:  
     - If `answer_positive` / `answer_negative` exist, use them.  
     - Else, use the original sentence.

5. Chips are created with:

   - For `present_simple_subject_groups`: `chip.textContent = verbForm`.
   - For `present_simple_negative_subjects` / `present_simple_yesno_do_does`: `chip.textContent = subjectLabel`.
   - For there is/are NP mode: chip uses the noun phrase `question` when `np: true`.
   - For others: chip shows a **truncated sentence** via `truncateSentenceDisplay`.

---

## 5. Authoring Template for a New List

When you want to add a new grammar sorting list, follow this template.

### 5.1 High-Level Fields (for humans and GPTs)

- **Level:** e.g., Level 2
- **List ID / Filename:** e.g., `present_simple_questions_yesno.json`
- **Display Name:** e.g., `"Present Simple: Yes/No Questions"`
- **Mode:** `grammar_sorting`
- **Strategy:** one of existing names (or define a new one if needed)
- **Buckets (Categories):**
  - Internal keys: e.g., `['do','does']`  
  - Learner labels: e.g., `"DO"`, `"DOES"`
- **Key Grammar Decision:** short sentence like `"Choose DO vs DOES for present simple yes/no questions."`
- **Visible Unit (Chip Text):** e.g., `"subject only"`, `"noun phrase"`, `"verb form"`, or `"full short sentence"`.
- **Data Fields Used:**
  - Minimum: `en` (question/statement)
  - Optional: `answer_positive`, `answer_negative` (for building extra chips)

### 5.2 JSON Item Pattern

Define 5–20 items using a consistent pattern. Example for a DO/DOES list:

```json
{
  "en": "Do you like pizza?"
}
```

```json
{
  "en": "Does she play soccer?"
}
```

```json
{
  "en": "Do the kids go to school?"
}
```

For a don’t/doesn’t list:

```json
{
  "en": "I don't like carrots."
}
```

```json
{
  "en": "He doesn't watch TV at night."
}
```

```json
{
  "en": "The shops don't open on Sunday."
}
```

For there is/are noun phrases:

```json
{
  "en": "There is a cat on the sofa."
}
```

```json
{
  "en": "There are two cats on the sofa."
}
```

You can optionally include `answer_positive` / `answer_negative` for future flexibility, but the current Level 2 lists mostly rely on `en`.

### 5.3 Coding Checklist for a New List

1. **Create JSON file** under:  
   `Games/english_arcade/data/grammar/levelX/<your_list>.json`

2. **Choose a Strategy** (existing or new):
   - If it’s similar to one of the existing Level 2 lists, reuse those strategies.
   - If truly new, add a new strategy object to `categoryStrategies` in `grammar_sorting.js`:
     - Implement `name`, `detect`, `classify`, `categories`, and optional `displayLabel`.

3. **Add Routing** in `chooseCategoryStrategy()`:
   - Match by filename and/or display name via regex.
   - Ensure it returns your new or chosen strategy.

4. **Add to the Level Modal and Unlock It**:
   - For Level 2, update `Games/english_arcade/ui/level2_grammar_modal.js`:
     - Add a new entry with `id`, `label`, `emoji`, `file`, and `config`.
     - Ensure `file` path points to your JSON file.
   - If the list should be **playable (not coming soon)**, also add its `id` to the `progressIds` array in the same file so it is treated as an unlocked, progress-tracked game.

5. **Educational Check**:
   - Make sure each sentence clearly expresses the target pattern.
   - Avoid extra noise: vocab should be easy; grammar decision should be obvious.
   - Ensure there are enough examples of each bucket (rough balance).

---

## 6. Patterns Based on Existing Level 2 Lists

You can model new lists after these patterns:

- **Subject → don’t/doesn’t:**  
  - Strategy: `present_simple_negative_subjects`  
  - Chips: subject-only  
  - Use with sentences like `"He doesn't like carrots."` / `"They don't play."`

- **Subject → Do/Does:**  
  - Strategy: `present_simple_yesno_do_does`  
  - Chips: subject-only  
  - Questions: `"Do they play?"`, `"Does she study?"`, `"Do you read?"`

- **Noun Phrase → There is/There are:**  
  - Strategy: `there_is_are_statements` or `there_is_are_questions`  
  - Chips: noun phrase only (plus optional fallback to sentence).

- **Sentence → Some/Any:**  
  - Strategy: `some_any`  
  - Chips: full sentence truncated; classifier relies on `some/any`, negation, and question patterns.

- **Verb Form → Third Singular vs Others:**  
  - Strategy: `present_simple_subject_groups`  
  - Chips: verb only; subject is inside `en`.

---

## 7. Pedagogical Rules of Thumb

When designing any new grammar sorting list:

- **Keep the decision binary or small (2–3 buckets)** for clarity.
- **Control vocabulary** so learners can focus on the grammar choice, not decoding new words.
- **Use consistent frames** (e.g., always `"Do/Does + subject + verb"` for a DO/DOES list).
- **Align chip text with what you want them to notice**:
  - If you want them to think about **subject**, show subject only.
  - If you want them to think about **verb form**, show verb only.
  - If you want them to think about **quantity/number**, show noun phrase only.

---

This spec is designed so that a future GPT (or developer) can read it and:

1. Decide the grammar decision and chip design for a new list.
2. Create the JSON file with appropriate sentences.
3. Wire it into `grammar_sorting.js` via an existing or new strategy.
4. Expose it in the appropriate level modal with a label and emoji.
