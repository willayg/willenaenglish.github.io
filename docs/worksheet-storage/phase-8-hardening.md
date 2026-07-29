# Phase 8 — Worksheet storage hardening

Status: active.

## Database protection

Production Supabase now has the constraint `worksheets_no_embedded_images_supported`.

For `wordtest` and `flashcard` rows, it rejects inserts or updates when `images`, `settings`, or `image_data` contains a `data:image/` payload. This prevents the old base64 storage format from returning even if a future frontend regression bypasses the current Worker flow.

## Regression audit

`scripts/worksheet-storage/check_no_embedded_images.js` reads all supported worksheet rows and exits with an error if any embedded image payload is found. It reports:

- total supported rows;
- rows using the R2 asset domain;
- rows containing embedded images;
- IDs and titles of any offending rows.

## Rollback window

Keep the Phase 7C and Phase 7D GitHub Actions artifacts for their configured retention period. They contain the complete original rows needed for rollback. Do not delete R2 objects or migration artifacts during this window.

## Cleanup boundary

The migration runner and rollback documentation should remain until the rollback window closes. Removing migration-only code is a later housekeeping task and is not required for production performance.
