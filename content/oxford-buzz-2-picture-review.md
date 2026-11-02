# Oxford Buzz 2 — picture dictionary review

Imported on 2026-11-02 from user-provided photographs of contents and picture dictionary, pp. 92–96.

**Status:** 97 picture-inferred vocabulary candidates in `unit_vocab_targets`; all remain `active=false` pending verification of Oxford's exact labels. We intentionally did not create published vocabulary occurrences or expose these candidates to Word Genius. 8 units and 64 original short sentences (8 per unit) are linked for Sentence Genius; live gameplay is not yet verified.

## Candidate counts and context
| Unit | Topic | Candidate words | Active |
|---|---|---:|---:|
| 1 | At School | 8 | 0 |
| 2 | My Things | 15 | 0 |
| 3 | Fun with Friends | 9 | 0 |
| 4 | Outdoors | 16 | 0 |
| 5 | My Body | 11 | 0 |
| 6 | My Family | 8 | 0 |
| 7 | My Clothes | 12 | 0 |
| 8 | Food | 18 | 0 |

## Required editorial review

The dictionary consists of **pictures and blank answer lines**, not printed vocabulary labels. A sensible English description is not necessarily the publisher's intended target.

- **Unit 1:** Check classroom object names (e.g. bin/trash can; board/blackboard), and source colours from colour pages; photographed grayscale pages do not establish them.
- **Unit 2:** Confirm toy names and spellings (e.g. plane/airplane, scooter), and school-object labels.
- **Unit 3:** Many actions and sports pictures are ambiguous without captions; only obvious candidates recorded so far.
- **Unit 4:** Confirm animal and nature words, especially ambiguous backgrounds/landscapes.
- **Unit 5:** Distinguish named body parts from illustration cues and verify animal-body items.
- **Unit 6:** Identify relatives/feelings from the precise book dialogue; portraits alone don't tell which relatives they are.
- **Unit 7:** Check cap/hat, trousers/pants, jacket/coat, and picture-dictionary exact wording.
- **Unit 8:** Confirm food names and plural forms for Word Genius answer checking.

## How to finish activation

1. Compare pictures with the vocabulary printed in relevant lesson pages or an approved publisher wordlist. Correct wrong labels, fill missing words and Korean translations.
2. Resolve candidates to the right `lexical_entry_id` and mark only verified `unit_vocab_targets.active=true`; preserve `lesson` in `provenance`.
3. For verified targets, create idempotent `source_content_occurrences` with `occurrence_type='lexical_entry'`, `skill='vocabulary'`, accurate `source_text`, proper book/unit/lexical IDs and unique source keys, following root `AGENTS.md`.
4. Verify book and unit discovery, catalog counts, spelling and speaking evaluation, and actual student app gameplay.

**Do not blindly activate all 97.** Some are plausible picture interpretations rather than confirmed textbook words.

## Sentence Genius

10 sentences per unit are not necessary at this introductory level: 8 short, original English–Korean sentence pairs per unit were entered in `sentences` and linked in `source_content_occurrences` with keys `buzz2:sentence:<unit>:<sequence>` and `buzz2:sentence-occurrence:<unit>:<sequence>`. Check real gameplay before claiming deployment.

## Writing Genius

Previously specified level-4 eligibility preference means Buzz 2 should **not** be added to Writing Genius's standard diary/topic-writing selector without reconsidering that gate. Grammar Genius is deferred.
