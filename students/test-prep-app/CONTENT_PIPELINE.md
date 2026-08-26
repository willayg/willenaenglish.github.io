# Willena Test Prep Content Pipeline

This document defines the process for adding textbook-linked test-prep content to the Willena Content Database and for creating Willena-original practice from that content.

The goal is consistency. New units should be inserted and categorized the same way as existing units so the student app, study-path engine, mock generator, teacher tools, and analytics can all use the same metadata.

## 1. Core content model

Each book/unit can contain four student skills:

- `vocabulary`
- `communication`
- `grammar`
- `reading`

For current test-prep imports, external/reference items and Willena-original items live together in `test_prep_questions` but must remain distinguishable.

### External/reference rows

Use:

- `content_status = external_reference`
- `student_source_label = Z Reference`
- `replacement_needed = true`
- `student_usable = true` only after the item is usable in the app

### Willena-original rows

Use:

- `content_status = willena_published`
- `student_source_label = Willena Published`
- `replacement_needed = false`
- `student_usable = true`

Willena questions should test the same textbook content and exam-relevant language without simply copying the reference question architecture/choices word-for-word.

## 2. Required import order for a new unit

Always work in this order:

1. Confirm the correct `book_id`.
2. Create or confirm the `unit_id`.
3. Add canonical source anchors.
4. Import external/reference questions.
5. Add answers and Korean explanations.
6. Categorize each question.
7. Link questions to canonical anchors where appropriate.
8. QA rendering and answer behavior.
9. Turn student usability on.
10. Create the Willena-original set.
11. QA the Willena set in the actual app.

Do not skip the anchor stage and reconstruct textbook source material later from a reference company's altered question.

## 3. Canonical anchors

### Communication

Store confirmed textbook dialogues in:

- `source_dialogues`
- `source_dialogue_turns`

Store:

- stable `source_key`
- title
- full dialogue
- characters/speakers
- language functions
- book/unit metadata
- `anchor_status`

Do **not** treat every dialogue invented by a worksheet/reference provider as a canonical textbook dialogue. Only add an anchor when the source dialogue is confirmed.

### Reading

Store confirmed textbook passages in `passages`.

A long textbook reading may be split into meaningful canonical parts when the text itself has clear sections, speakers, or sub-passages. Store stable source keys and the exact confirmed text.

Question rows should store anchor IDs/source keys in metadata when the item is clearly based on one or more anchors.

## 4. Categorization rules

Every question should separate these concepts instead of mixing them into one label:

### `section`
What broad skill does this belong to?

- vocabulary
- communication
- grammar
- reading

### `targets`
What knowledge/skill is being tested?

Examples:

- `modal_can`
- `modal_will`
- `present_progressive`
- `simple_present`
- `asking_frequency`
- `making_suggestion`
- `main_idea`
- `detail`
- `inference`
- `reference_resolution`
- `vocabulary_in_context`

**Reuse an existing target whenever it accurately fits.** Do not create near-duplicates such as `third_person_present` when `third_person_s` already exists.

Only add a new target if the existing taxonomy cannot describe the tested skill accurately.

### `question_type`
How is the question constructed?

Examples:

- `dialogue_reorder`
- `sentence_insertion`
- `underlined_error`
- `multi_blank_choice`
- `content_mismatch`
- `information_not_given`
- `main_topic`
- `definition_to_word`
- `count_correct_sentences`

The same target can appear in many question types. This distinction is essential for diagnostics.

Example:

- Target problem: student repeatedly misses `modal_can` across many formats.
- Format problem: student understands `modal_can` but repeatedly misses `underlined_error` questions.

The study-path engine must be able to tell these apart.

### `context_type`
Describe the material the question operates on, e.g.:

- standalone sentence
- dialogue
- reading passage
- table
- paired passages
- sentence set
- definition set

### `difficulty`
Use the existing difficulty scale consistently. Difficulty should reflect the actual cognitive/question burden, not merely the grammar level.

A familiar grammar target inside a multi-step passage-analysis question can be harder than the same grammar in a one-line blank.

## 5. CRITICAL rendering rules

These are recurring failure points. They must be checked every time content is imported or generated.

### A. Underlining must actually render

If the printed/source question underlines a word, phrase, clause, or sentence, the app version must visibly underline the same material.

Do not store an underline only as plain text such as `ⓐword` and assume the UI makes the distinction obvious.

Use the structured underline fields already supported by the renderer, such as:

- `context.underlined`
- `context.underlined_spans`

QA the **rendered app**, not just the JSON.

Underlining must also work when the target appears inside:

- passages
- dialogues
- items
- sentence sets
- reorder segments
- answer choices where required

If a renderer path does not support underlining, fix the renderer before publishing the item.

### B. Sentence/dialogue order questions must display the actual segments

Never create a reorder question where the answer choices show orders such as `(C)-(B)-(D)-(A)` but the student cannot see what A/B/C/D are.

For every sentence-order/dialogue-order question:

1. Store the actual labeled segments in `context.items` or `context.segments`.
2. Confirm A/B/C/D labels are visible on screen.
3. Confirm the beginning/end text is shown when the question has fixed opening/closing text.
4. Confirm each order-choice refers to the same visible labels.
5. Confirm the correct answer after rendering.

This is mandatory QA because missing reorder segments has already caused repeated broken questions.

## 6. Answers and explanations

For imported reference questions:

- verify the source answer key
- store the correct answer in the app's expected format
- attach the Korean source explanation when available

Do not infer an answer from OCR if the answer key is available.

If parsed PDF text and page image disagree or the parsed text is incomplete, inspect the rendered source page before finalizing the item.

## 7. Creating Willena-original sets

Default target for each completed unit/skill:

- 20 Willena-original Communication questions
- 20 Willena-original Grammar questions
- 20 Willena-original Reading questions
- Vocabulary set size can be defined when vocabulary content is added

### Willena question principles

1. Stay inside the actual textbook test range.
2. Use confirmed textbook dialogue/passage anchors for book-linked Communication and Reading.
3. Balance anchors rather than overusing whichever dialogue appears most often in the reference worksheet.
4. Reuse the same taxonomy as external/reference items.
5. Vary question architecture.
6. Include Korean explanations.
7. Make wrong choices plausible but unambiguous.
8. Avoid creating confusing questions merely to make them look difficult.
9. Preserve exact textbook character names/details when the question depends on memorized source text.
10. Mark anchor IDs/source keys in metadata.

For Reading, create questions across the major canonical passage parts instead of letting one paragraph dominate the set.

For Grammar, use the actual unit grammar and textbook language where appropriate, while creating original item construction and distractors.

## 8. Mock-test system

All Willena mock tests are **25 questions** and score out of 100, so the default score is 4 points per question.

Real schools may use 23-25 questions and unusual weighting, but Willena's internal mock engine is standardized to 25 questions for clean comparison across repeated mocks.

The database table `mock_test_formats` defines reusable mock blueprints.

A format controls:

- skill distribution
- difficulty distribution
- question-type diversity
- target diversity or weakness bias
- external/Willena source mix
- anchor diversity
- scoring policy

Current format codes:

### `balanced_standard`
Default exam-prep mock.

- 25 questions
- Vocabulary 5
- Communication 5
- Grammar 7
- Reading 8
- difficulty: 5 easy / 15 medium / 5 hard

### `balanced_easy`
Confidence-building version.

- 12 easy / 11 medium / 2 hard

### `balanced_hard`
Challenge version.

- 2 easy / 11 medium / 12 hard
- biases toward more complex/multi-step architecture

### `adaptive_weakness`
Diagnostic/reinforcement mock.

- biases selection toward the student's weak targets and weak question types
- still maintains broad skill coverage

## 9. Mock generation rules

Mocks must **not** be 25 completely random questions.

Selection should obey a blueprint.

At minimum:

1. Keep the requested skill distribution.
2. Keep the requested difficulty distribution.
3. Maintain question-type diversity.
4. Avoid too many consecutive questions of the same architecture.
5. Avoid one target dominating the paper unless the format is explicitly adaptive.
6. Avoid one reading passage/dialogue anchor dominating the paper.
7. Avoid recently seen questions when enough alternatives exist.
8. Avoid exact duplicate questions within a mock.
9. Prefer a realistic Korean middle-school exam mixture: dialogue/application, vocabulary/definition, grammar/usage, passage-embedded grammar, reference/cohesion, reading comprehension, sentence insertion/order, and mixed multi-statement items.
10. Record which blueprint/version generated each mock so results remain interpretable later.

A school-specific blueprint may be added later when enough real exam papers from that school have been analyzed, but the generator should never assume one school's architecture represents every school.

## 10. Repeated mocks

Students may take many mocks before an exam. Repeated mocks should therefore be treated as a sequence, not a single initial/final test.

The system should eventually track:

- mock number
- format used
- questions served
- score
- skill accuracy
- target accuracy
- question-type accuracy
- difficulty accuracy
- time spent
- repeated-question exposure
- score trend

This allows a study rail such as:

`Mock 1 -> targeted practice -> Mock 2 -> targeted practice -> Mock 3 ...`

and allows teachers to see whether the student's readiness is actually improving.

## 11. Study-path implications

The study rail should use both teacher control and algorithmic recommendations.

Priority order:

1. Explicit teacher assignment/override
2. Required exam-plan checkpoint
3. Algorithmic recommendation from recent performance
4. Student free study

The algorithm should use both target weakness and question-type weakness.

Students should always retain a manual path:

`Unit -> Skill -> source/mode -> questions`

while the primary home experience can present one clear next recommended action.

## 12. QA checklist before publishing a unit

- correct book and unit IDs
- canonical dialogues/passages inserted
- source question count correct
- source question number/page stored
- answers match the source key
- explanations present where available
- targets reuse existing taxonomy where possible
- question type accurately describes architecture
- context type set
- difficulty set consistently
- anchor links added where applicable
- **underlining visibly renders**
- **sentence/dialogue reorder segments visibly render**
- choices render in the correct order
- multi-select behavior works when required
- correct answer is accepted by the app
- source label is correct
- Willena question number is correct
- flagging works
- no accidental duplicate rows
- student-usable count matches expectation

If any of these fail, the content is not finished even if the DB row exists.
