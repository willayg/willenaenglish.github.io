# Willena Database Projects

This folder tracks the connected curriculum and assessment databases being developed in Supabase.

Supabase project currently used for the main work:

`gxwfsqxyuufqtitspfqg`

## 1. Willena Content Database

**Status:** Active

The central source of reusable teaching content.

Current core tables include:

- `lexical_entries`
- `lexical_forms`
- `sentences`
- `patterns`
- `sentence_patterns`
- `contraction_mappings`
- `collections`
- `collection_items`
- `activity_pattern_targets`

Important rules:

- Use duplicate-safe `source_key` upserts.
- Use the 1–200 difficulty scale.
- Store plural lexical forms and countability for countable nouns.
- Allow sentences to link to multiple patterns.
- Do not assign an intrinsic primary pattern to a sentence.
- Let each activity select its own teaching target.
- Treat chunks, collocations, phrasal verbs, fixed expressions and idioms as lexical entries.

## 2. Assessment Question Bank

**Status:** Active

A fixed authored bank for the adaptive placement test, teacher quizzes and future practice apps.

Current core tables:

- `assessment_items`
- `assessment_item_options`
- `assessment_item_patterns`

Question requirements:

- Duplicate-safe `source_key`
- Assigned level and difficulty
- Clear prompt
- Exactly four options where multiple choice is used
- Exactly one defensible correct answer
- `status = published` for live questions
- Grammar-pattern metadata where appropriate
- No random nonsense question generation at runtime

Current authored-assessment goal: ten strong questions per level for Levels 1–10.

## 3. Korean Middle-School Curriculum Database

**Status:** Planned / early design

This may be implemented as structured collections and source metadata inside the main content database rather than as an isolated database.

Planned coverage:

- Middle-school Years 1–3
- Approximately 24 main lessons
- Grammar points by lesson
- Vocabulary and expressions
- Reading passages
- Korean school-exam-style questions
- Reusable online and printable quizzes

## 4. Textbook Content Repository

**Status:** Active design and importing

A structured source layer for books used at Willena, beginning with English Bus 1.

Each imported item should retain:

- Series and book
- Unit and lesson
- Page or source reference
- Vocabulary and lexical forms
- Patterns and grammar
- Sentences and readings
- Activity type
- Willena level
- Difficulty
- Review/publication status

The textbook repository should feed the main content database rather than become a disconnected duplicate collection.

## Curriculum decisions currently recorded

- Most third-person singular content belongs in Level 4, except selected early patterns using `want` and `like`.
- Level 5 introduces a small set of short comparatives and superlatives such as bigger, smaller, taller, faster, cuter, the biggest and the fastest.
- Level 6 introduces long comparatives and superlatives such as more interesting and the most beautiful.

## Relationship between the databases

```text
Textbook and curriculum sources
             ↓
    Willena Content Database
             ↓
     Assessment Question Bank
             ↓
Placement tests, quizzes, games and student practice
```
