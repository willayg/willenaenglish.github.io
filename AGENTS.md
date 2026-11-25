# Willena architecture rules

## Never use Netlify

DO NOT USE NETLIFY FOR WILLENA.

- Do not create files under `netlify/functions/`.
- Do not propose or implement Netlify Functions.
- Do not route Willena APIs through Netlify.
- Do not assume a Netlify deployment exists.
- Do not use Netlify as a fallback or temporary backend.

## Approved architecture

Willena uses:

- Cloudflare Pages for hosted web apps.
- Cloudflare Workers / the existing Cloudflare API gateway for server-side API logic when needed.
- Supabase for authentication, database, storage, RLS, and direct data operations where appropriate.

For new backend work, first determine whether it belongs in an existing Cloudflare Worker/API route or can be done safely through Supabase with RLS. Do not introduce another backend platform.

## Existing legacy paths

Some existing frontend code may still contain historical `/.netlify/functions/...`-shaped paths because the Cloudflare gateway maps legacy route names. Do not interpret those strings as permission to create or depend on Netlify infrastructure. Prefer migrating new work to explicit Cloudflare/Supabase architecture when practical.

---

# READ THIS BEFORE TOUCHING TEST PREP V2 OR THE RENDER LAB

If you duplicate the question renderer, you have broken the architecture.

This rule is non-negotiable.

## SINGLE SOURCE OF TRUTH

The only question rendering implementation across the student apps is:

`shared/questions/question-renderer.js`

`students/test-prep-v2/question-renderer.js` is a compatibility re-export only.

The canonical question adapter/model is:

`students/test-prep-v2/question-model.js`

The renderer lab at:

`students/question-render-lab/`

MUST import those exact files. The lab is a test harness, not a second renderer.

## ABSOLUTELY FORBIDDEN

Do NOT:

- copy `question-renderer.js` into the lab
- paste renderer functions into `question-render-lab/index.html`
- create a lab-only `renderChoice`, `renderWrite`, `renderOrder`, etc.
- create a vocab renderer, grammar renderer, reading renderer, seosul renderer, review renderer, or performance renderer
- patch rendered question DOM after the canonical renderer runs
- add `*-render-fix.js`, `*-layout-fix.js`, MutationObserver renderer patches, or equivalent workaround files
- fork the renderer because one screen needs a slightly different layout

If a question renders incorrectly, fix `shared/questions/question-renderer.js`.

If source data cannot be converted into the canonical question shape, fix the source adapter/model. Do NOT fix the renderer by teaching it random database schemas.

## THE LAB MUST MATCH PRODUCTION RENDERING

The purpose of `students/question-render-lab/` is to reproduce rendering problems safely.

Therefore a question shown in the lab and the same normalized question shown in Test Prep v2 MUST pass through the exact same renderer module. "Similar", "copied from", and "kept in sync" are not acceptable.

Different lab navigation, filters, fixture selection, and diagnostic styling are allowed. A different rendering implementation is not.

## SHARED PREPROCESSING

When preprocessing changes what the renderer receives, share that logic too.

Example: textbook passage sentence splitting must use the shared Test Prep v2 passage utility. Do not create a second sentence splitter in the lab. This specifically protects abbreviations such as `Dr.`, `Mr.`, `Mrs.`, `Ms.`, `Prof.`, `St.`, `a.m.`, `p.m.`, `e.g.`, `i.e.`, `U.S.`, and `U.K.` from drifting into different behavior.

---

# TEST PREP V2 NAVIGATION IS ALSO SINGLE-SOURCE

The only browser/history navigation owner for Test Prep v2 is:

`students/test-prep-v2/navigation.js`

This rule is non-negotiable too.

Only `navigation.js` may:

- call `history.pushState()`
- call `history.replaceState()`
- listen to `popstate`
- decide how Test Prep history routes are encoded/restored

`app.js`, vocabulary, 수행평가, 오답, Ask Willi, modals, and future workflows may request navigation or provide leave/cleanup hooks. They may NOT create their own browser-history implementation.

UI back buttons must go through the canonical navigator (`back()` / browser history). Do not manually call an older screen renderer as a substitute for Back.

A `popstate` render must NEVER push a new history entry. If Back causes a screen to reopen, fix the route/render ownership or stale async work; do not add a Back-button patch script.

Do NOT add:

- another `popstate` listener in Test Prep v2
- `navigation-fix.js`, `back-fix.js`, `history-patch.js`, or equivalent workaround files
- direct `pushState` / `replaceState` calls outside `navigation.js`
- workflow-specific history stacks

If navigation is wrong, fix `students/test-prep-v2/navigation.js` or the single route renderer in `app.js`.

## BEFORE ADDING A FILE

Ask:

1. Does an existing module already own this responsibility?
2. Can I subtract/replace old code instead of adding another layer?
3. Would this create a second implementation of rendering, navigation, grading, tracking, stats, source loading, or review state?

If yes, stop and use the existing owner.

## TEST PREP V2 MODULE OWNERSHIP

- `question-model.js` — canonical question shape / adaptation
- `shared/questions/question-renderer.js` — ALL question answer UI / DOM
- `question-grader.js` — grading only
- `navigation.js` — ALL browser/device history ownership and route transitions
- `app.js` — the single route-to-screen renderer/controller; it requests navigation but does not own browser history
- content/source modules — question generation/loading only
- `tracking-client.js` — attempts/sessions only
- stats module/service — Test Prep metrics only
- review service — wrong-answer state/queue only

A module may call another owner. It may not reimplement that owner's job.

## RULE FOR FUTURE AGENTS

If a requested fix seems easiest by adding one more patch file, that is a warning sign. Investigate the owning module and fix the root cause there.

---

# AGENTS.md — Adding vocabulary to Willena Word Genius

This document records the known, working **database import workflow for Word Genius vocabulary**. Use it before making repeated schema-discovery queries. Last verified: 2026-11-02.

## Projects: choose the right database

- **Willena Content Database**: Supabase project ID `gxwfsqxyuufqtitspfqg`. Vocabulary and textbook data live here.
- **Willena Game Scores**: project ID `fiieuiktlsivwfgyivai`. Do **not** import vocabulary there.
- App repository: `willayg/willenaenglish.github.io`.
- Use connected Supabase tools with explicit `project_id`. Do not expose secrets or service keys.

## Known schema — skip broad discovery

1. `content_series`: `id, name, publisher, source_key, metadata`.
2. `content_books`: `id, series_id, title, book_number, public_level, source_key, status, metadata`.
3. `content_units`: `id, book_id, unit_number, title, public_level, source_key, status, metadata, unit_type`.
4. `lexical_entries`: `id, source_key, canonical_text, normalized_text, entry_type, translation_ko, definition_en, status, metadata, ...`.
5. `unit_vocab_targets`: `id, book_id, unit_id, lexical_entry_id, source_kind, priority, active, provenance`.
6. `source_content_occurrences`: `id, book_id, unit_id, occurrence_type, source_text, normalized_text, lexical_entry_id, public_level, skill, source_key, status, metadata, ...`.
7. `teacher_book_catalog`: existing **read/view** of catalog content. A successful import into `unit_vocab_targets` alone did not populate it; inserting corresponding `source_content_occurrences` did.

Database constraints discovered:
- Content book, unit, and lexical statuses: `draft`, `review`, `published`, `archived` — **not** `active`.
- `lexical_entries.entry_type` accepts `word`, `compound_word`, `noun_phrase`, `verb_phrase`, `adjective_phrase`, `fixed_expression`, `phrasal_verb`, `collocation`, `idiom`, `interjection`. **Not** `phrase`.
- `lexical_entries.normalized_text` is a **generated column**. Never explicitly insert a value.
- The examples below use `published` for approved vocabulary, `source_content` for `unit_vocab_targets.source_kind`, `lexical_entry` for `source_content_occurrences.occurrence_type`, and `vocabulary` for `skill`.

## Required import workflow

1. Identify the exact book and unit by `source_key`; check whether they already exist. If absent, create an appropriate series, book, and numbered units using **idempotent** inserts. Avoid accidentally making a second book with a slightly different title.
2. Transcribe words from the user's supplied vocabulary source, maintaining unit and lesson numbers. Check apostrophes, spelling, singular/plural forms, multiword phrases, capitalization, and ambiguous senses. Do not silently invent source vocabulary.
3. Stage the input as `(unit_number, lesson_number, english, korean)` rows. For repeatable batch loads, use a transaction and `CREATE TEMP TABLE ... ON COMMIT DROP`.
4. **Reuse existing lexical entries** where the normalized English matches and the sense is appropriate. Check existing `translation_ko`; same English text can have multiple meanings. Do not overwrite a valid existing translation just to fit another textbook. Use an appropriate sense or create a distinct entry when necessary.
5. Insert missing lexical entries with unique deterministic `source_key`, `canonical_text`, proper `entry_type`, `translation_ko`, and approved `status`. **Never insert `normalized_text`**.
6. Insert `unit_vocab_targets` linking `book_id + unit_id + lexical_entry_id`. In the verified example, `source_kind='source_content'`, `priority=100`, `active=true`. Store `lesson`, `unit`, and source notes in `provenance` JSON.
7. Also insert **matching `source_content_occurrences`**, with `occurrence_type='lexical_entry'`, `skill='vocabulary'`, `lexical_entry_id`, `source_text`, `status='published'`, unique `source_key`, and the same book/unit. This step populated `teacher_book_catalog` in the verified import.
8. Query counts per unit, missing Korean translations, and catalog rows. Fix mismatches. Then verify Word Genius through its actual student and teacher UI: book selection, unit load, question generation, spelling, speech, assignments, and refresh. **Database counts alone do not establish working gameplay.**

## Minimal SQL patterns

Always replace sample source keys and use the correct existing IDs. First check the record; don't run the examples blindly in production.

```sql
-- Existing book / units, without guessing IDs
SELECT id, title, status FROM content_books
WHERE source_key = 'book:YOUR_SERIES:YOUR_BOOK';

SELECT id, unit_number, title FROM content_units
WHERE book_id = (SELECT id FROM content_books
                 WHERE source_key = 'book:YOUR_SERIES:YOUR_BOOK')
ORDER BY unit_number;

-- Find an existing lexical entry. Verify its *sense*, not just spelling.
SELECT id, canonical_text, translation_ko, entry_type, status
FROM lexical_entries WHERE normalized_text = lower('airport');

-- A missing word: normalized_text is generated, so leave it out.
INSERT INTO lexical_entries
  (source_key, canonical_text, entry_type, translation_ko, status)
SELECT 'import:UNIQUE_SOURCE_KEY', 'example term', 'noun_phrase',
       '예시 번역', 'published'
WHERE NOT EXISTS (
  SELECT 1 FROM lexical_entries
  WHERE normalized_text = lower('example term')
);
```

Given staged data in `incoming_words(unit_number, lesson_number, english, korean)`, and an existing target book:

```sql
-- Link source vocabulary to units; run in a transaction.
-- Match entries on the intended meaning before this step.
INSERT INTO unit_vocab_targets
  (book_id, unit_id, lexical_entry_id, source_kind, priority, active, provenance)
SELECT b.id, u.id, l.id, 'source_content', 100, true,
       jsonb_build_object('unit', s.unit_number, 'lesson', s.lesson_number,
                          'source', 'supplied vocabulary list')
FROM incoming_words s
JOIN content_books b ON b.source_key = 'book:YOUR_SERIES:YOUR_BOOK'
JOIN content_units u ON u.book_id = b.id
                    AND u.unit_number = s.unit_number
JOIN lexical_entries l ON l.normalized_text = lower(s.english)
WHERE NOT EXISTS (
  SELECT 1 FROM unit_vocab_targets t
  WHERE t.unit_id = u.id AND t.lexical_entry_id = l.id
);
-- CAUTION: if several lexical entries share normalized_text, this join
-- can select several senses. Pre-resolve to lexical_entry_id for safety.
```

```sql
-- With links already resolved, populate the source catalog.
INSERT INTO source_content_occurrences
 (book_id, unit_id, occurrence_type, source_text, normalized_text,
  lexical_entry_id, public_level, skill, source_key, status, metadata)
SELECT t.book_id, t.unit_id, 'lexical_entry', l.canonical_text,
       l.normalized_text, l.id, b.public_level, 'vocabulary',
       'import:' || t.unit_id::text || ':' || l.id::text,
       'published', t.provenance
FROM unit_vocab_targets t
JOIN lexical_entries l ON l.id = t.lexical_entry_id
JOIN content_books b ON b.id = t.book_id
WHERE b.source_key = 'book:YOUR_SERIES:YOUR_BOOK'
AND NOT EXISTS (
  SELECT 1 FROM source_content_occurrences o
  WHERE o.source_key = 'import:' || t.unit_id::text || ':' || l.id::text
);
```

## Fast verification queries

```sql
SELECT u.unit_number, count(t.id) AS targets,
       count(*) FILTER (WHERE l.translation_ko IS NULL) AS missing_korean
FROM content_units u
LEFT JOIN unit_vocab_targets t ON t.unit_id = u.id
LEFT JOIN lexical_entries l ON l.id = t.lexical_entry_id
WHERE u.book_id = (SELECT id FROM content_books
                   WHERE source_key = 'book:YOUR_SERIES:YOUR_BOOK')
GROUP BY u.unit_number ORDER BY u.unit_number;

SELECT
 (SELECT count(*) FROM unit_vocab_targets
  WHERE book_id = (SELECT id FROM content_books
                   WHERE source_key = 'book:YOUR_SERIES:YOUR_BOOK')) AS targets,
 (SELECT count(*) FROM source_content_occurrences
  WHERE book_id = (SELECT id FROM content_books
                   WHERE source_key = 'book:YOUR_SERIES:YOUR_BOOK')) AS occurrences,
 (SELECT count(*) FROM teacher_book_catalog
  WHERE book_id = (SELECT id FROM content_books
                   WHERE source_key = 'book:YOUR_SERIES:YOUR_BOOK')) AS catalog_rows;
```

Counts should match the expected imported items; review legitimate preexisting rows and duplicate senses rather than blindly forcing equal totals.

## Verified historical example (2026-11-02)

Oxford Buzz 6 was inserted with:
- series key `series:oxford_buzz`;
- book key `book:oxford_buzz:6`;
- eight numbered units, each with 22 lexical targets;
- **176 `unit_vocab_targets`, 176 `source_content_occurrences`, and 176 `teacher_book_catalog` rows** verified via SQL;
- Korean translations populated for all 176; missing values repaired for `repair`, `download`, `upload`, and `whistle`;
- lesson numbers (1, 3, 5) retained in `unit_vocab_targets.provenance`.

This verified the **database/catalog import**, not full live Word Genius gameplay. The lesson identifier is in JSON provenance; do not assume the Word Genius UI treats those lessons as independently selectable without checking.

## Known pitfalls

- `status='active'` fails the book/unit CHECK constraint.
- `entry_type='phrase'` fails the lexical CHECK constraint.
- Supplying `lexical_entries.normalized_text` fails because it is generated.
- Importing only `unit_vocab_targets` leaves the teacher catalog empty; corresponding `source_content_occurrences` populated it in our test.
- Existing entries sometimes have null `translation_ko`. Check before certifying.
- A term can have different senses (e.g. `play`, `fall`, `light`); a simplistic normalized-text join is not always sufficient.
- Prefer compact, scoped SQL reads and clear verification queries over re-querying `information_schema` repeatedly.
- Never claim the student app or homework works until it has been tested.

## Sentence Genius: adding curriculum-aligned sentences (verified 2026-11-02)

After vocabulary import, Sentence Genius needs actual **sentences linked to the book's units**. Vocabulary targets alone do not create sentence activities.

- Content database: `gxwfsqxyuufqtitspfqg`.
- Relevant tables: `sentences` and `source_content_occurrences`, plus `content_books` / `content_units`.
- Student app on the `students` branch: `students/sentence-genius/content.js`. Its `loadSentences(bookId,unitId,unit)` selects published/review `source_content_occurrences` having non-null `sentence_id`, then loads associated published/review `sentences` with complete English and Korean pairs. It additionally loads sentence patterns and policy overrides; absence of those links does not by itself prevent basic sentence exercises.
- Each supplied textbook unit can be expanded to **8–10 original sentences**. Use the table of contents' actual grammar focus and wordlist vocabulary in natural context; use accurate Korean translations; avoid reproducing copyrighted textbook example sentences.
- Preserve original words / grammar level. Include statements, questions, and negatives where useful. Avoid ungrammatical, ambiguous, or unnatural examples.
- Generate stable unique `source_key` per book/unit/sequence (e.g. `buzz6:sentence:3:7`). Insert idempotently into `sentences(text,translation_ko,source_key,status,metadata)` with `status='published'`, `metadata` noting book, unit and `source='original curriculum-aligned example'`.
- Link each sentence using `source_content_occurrences(book_id,unit_id,occurrence_type,source_text,sentence_id,public_level,skill,source_key,status,metadata)` with `occurrence_type='sentence'`, `skill='speaking'`, `status='published'`, and a separate stable occurrence key (e.g. `buzz6:sentence-occurrence:3:7`). Resolve the `sentences.id` from the stable source key. Use NOT EXISTS checks to avoid duplicate rows.
- **Working pattern:** stage `(unit_no,position_no,en,ko)` in a temp table within `BEGIN ... COMMIT`, insert missing sentences, insert missing occurrences by joining staged unit number to `content_units`, book source key to `content_books`, and sentence source key to `sentences`.
- Verification:

```sql
SELECT u.unit_number,
       count(DISTINCT o.sentence_id) AS linked,
       count(DISTINCT o.sentence_id) FILTER (
         WHERE s.translation_ko IS NOT NULL
           AND s.status IN ('review','published')
       ) AS usable
FROM content_units u
LEFT JOIN source_content_occurrences o
  ON o.unit_id=u.id AND o.sentence_id IS NOT NULL
LEFT JOIN sentences s ON s.id=o.sentence_id
WHERE u.book_id=(SELECT id FROM content_books
                 WHERE source_key='book:YOUR_SERIES:YOUR_BOOK')
GROUP BY u.unit_number
ORDER BY u.unit_number;
```

- For Oxford Buzz 6 the final database query returned **10 linked / 10 usable per unit, 80 in total**. Originally four per unit were created, then six per unit were added in a second idempotent batch, bringing the total to 80.
- **Important:** a successful count does *not* verify authenticated student gameplay or a production deployment.

## Writing Genius: unit-based topic prompts (verified code workflow, not deployed)

- We authored **24 original Buzz 6 writing topics** (3 per unit) in `content/oxford-buzz-6-writing-prompts.json` on the repository's `main` branch. Prompts contain `id`, `book_key`, `unit`, `title`, `prompt`, `grammar_focus` and hints.
- The **actual** Writing Genius frontend is on the `students` branch, at `students/writing-genius/app.js`, not necessarily on `main`. Always inspect the relevant branch; previous searches of `main` misleadingly made this app appear missing.
- In that app, there is a `const prompts={ sentence:[...], diary:[...], topic:[...] }` list. We appended the 24 Buzz 6 topics to `prompts.topic` using `prompts.topic.push(...[ {key,title,help,starters}, ... ])`, immediately after the `prompts` object and before `const exampleDiaries=[`. This preserved the built-in topics and custom topic freedom.
- Committed on the `students` branch as `268f857`. **Check whether that commit reached production** before claiming students see the topics.
- This was a static in-app topic bank, **not** a per-book filtered list. If building textbook-specific selection later, inspect `setPromptOptions`, `createEntry`, and the topic-selection flow rather than assuming a book selection is available.
- The student's title must remain editable. Never reject an off-topic or custom title solely because it differs from a suggested title.

## Critical branch distinction

`main` and `students` contain materially different app files. For student app modifications, inspect `students` explicitly; for teacher UI inspect `teachers` explicitly. Do not assume a file missing on `main` is missing from the active app. Check the deployed branch and confirm the commit actually reached the live site before declaring an app fixed.
