# Phase 7A — Legacy worksheet storage audit

Date: 2026-07-29  
Supabase project: `fiieuiktlsivwfgyivai`  
Scope: `public.worksheets`  
Mode: read-only SQL only; no rows, files, schemas, policies, or storage objects were changed.

## Executive summary

The database currently contains **535 worksheet rows**. Of those, **69 rows contain embedded base64 images** and require migration. No existing row currently contains the new `worksheet-assets.willenaenglish.com` R2 asset URL.

The 69 legacy rows occupy about **60.2 MB** of the table's roughly **60.8 MB** of row data. In other words, about **99% of the measured worksheet row storage** is concentrated in the base64-bearing rows.

The audit found **837 embedded image references**, representing an estimated **579 unique image payloads**. There are **258 duplicate references**, so content-addressed R2 storage should avoid storing a substantial amount of repeated image data.

Estimated decoded image data is about **45.0 MB**. The base64 text itself contains about **60.0 million characters**, consistent with base64's storage overhead.

## Migration population

| Worksheet type | Total rows | Rows with base64 | Base64-bearing row bytes | Largest affected row |
|---|---:|---:|---:|---:|
| `wordtest` | 269 | 43 | 38,531,608 | 4,157,764 |
| `flashcard` | 47 | 26 | 21,671,928 | 4,935,833 |
| All other types | 219 | 0 | 0 | — |
| **Total** | **535** | **69** | **60,203,536** | **4,935,833** |

Only `wordtest` and `flashcard` rows currently need image migration.

## Embedded image inventory

| Format | References |
|---|---:|
| JPEG/JPG | 751 |
| WebP | 63 |
| PNG | 23 |
| GIF | 0 |
| **Total** | **837** |

Estimated unique images: **579**  
Duplicate references: **258**

## Where the embedded data appears

| Column | Rows containing base64 |
|---|---:|
| `images` | 69 |
| `settings` | 26 |
| `image_data` | 0 |
| `words` | 0 |
| `sentences` | 0 |
| `questions` | 0 |
| `answers` | 0 |
| `notes` | 0 |
| `passage_text` | 0 |

Some flashcard rows contain the same image material in both `images` and `settings`; the migration transformer must preserve the existing structure while replacing every embedded occurrence.

## Row-size risk profile

- Median worksheet row: **1,447 bytes**
- 95th percentile: approximately **481 KB**
- 99th percentile: approximately **3.01 MB**
- Rows at least 1 MB: **20**
- Rows at least 3 MB: **6**
- Rows at least 5 MB: **0**
- Largest row: **4,935,833 bytes**

This confirms that embedded images, rather than ordinary worksheet text/configuration, are the dominant source of large rows and slow legacy loads.

## Data-quality checks

- Rows containing a `data:image/...;base64,` marker but no recognised PNG/JPEG/WebP/GIF payload: **0**
- Rows already using the new R2 asset domain: **0**
- Mixed rows containing both embedded base64 and new R2 URLs: **0**

The legacy population is therefore clean enough for a deterministic first migration pass, subject to per-row backup and verification.

## Phase 7B requirements derived from this audit

The migration tool should:

1. Target only the 69 affected rows.
2. Handle both `wordtest` and `flashcard` formats.
3. Replace base64 occurrences in `images` and, where present, `settings`.
4. Recognise PNG, JPEG/JPG, WebP, and GIF, even though no GIFs currently exist.
5. Deduplicate by decoded content hash, not by worksheet row.
6. Preserve all non-image fields exactly.
7. Be idempotent: skip already-migrated URLs and avoid duplicate R2 uploads.
8. Produce a per-row before/after checksum and failure log.
9. Support dry-run, limited batch size, and explicit row selection.
10. Keep recoverable originals until the rollback window ends.

## Recommended pilot

Use a controlled batch of **6 rows**:

- 3 `wordtest`
- 3 `flashcard`
- include at least one row above 3 MB
- include at least one flashcard row with base64 in both `images` and `settings`

After verifying save/load behaviour, image counts, hashes, and rollback data, expand in batches rather than migrating all 69 rows at once.

## Reproducibility

The read-only SQL used for this report is stored in:

`/scripts/worksheet-storage/phase7a_audit.sql`
