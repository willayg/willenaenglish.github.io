# Phase 7B — Legacy worksheet migration tool

Status: implemented, not executed against production data.

## Safety model

The command defaults to dry-run. Apply mode is blocked unless both flags are supplied:

```bash
--apply --confirm=MIGRATE_LEGACY_WORKSHEETS
```

The tool:

- reads all worksheet rows and selects only `wordtest` or `flashcard` rows containing embedded images;
- supports `--limit`, `--type`, and explicit `--ids` selection;
- calls the deployed worksheet-assets Worker for the same transformation used by new saves;
- creates a complete JSON backup of every selected row before any database update;
- only patches image-bearing `images`, `settings`, or `image_data` fields;
- rejects a transformation that changes any protected worksheet field;
- rejects a transformation if embedded base64 remains;
- uses `user_id` plus the original `updated_at` value for optimistic concurrency;
- stops the apply run after the first failed row;
- writes checksums, asset counts, success/failure details, and database-update status to a report.

Uploading an R2 object and then failing the database patch may leave an unreferenced content-addressed object. That is safe and can be cleaned later; the worksheet row remains unchanged.

## Required environment variables

- `SUPABASE_SERVICE_ROLE_KEY`: server-side key used to read and patch the worksheet table. Never expose it in frontend code.
- `WORKSHEET_MIGRATION_ACCESS_TOKEN`: a valid Supabase user access token used to authenticate with the Worker.

Optional:

- `SUPABASE_URL` — defaults to the Willena Supabase project.
- `WORKSHEET_ASSETS_URL` — defaults to `https://worksheet-assets.willenaenglish.com`.

## Examples

Dry-run six rows:

```bash
node scripts/worksheet-storage/migrate_legacy_worksheets.js --limit=6
```

Dry-run three flashcard rows:

```bash
node scripts/worksheet-storage/migrate_legacy_worksheets.js --type=flashcard --limit=3
```

Apply an explicitly reviewed pilot selection:

```bash
node scripts/worksheet-storage/migrate_legacy_worksheets.js \
  --ids=<uuid-1>,<uuid-2> \
  --apply \
  --confirm=MIGRATE_LEGACY_WORKSHEETS
```

## Output

Each run creates a timestamped directory beneath:

```text
migration-output/worksheet-storage/
```

Dry-runs create only `report.json`. Apply runs also create one complete original-row backup per selected worksheet under `backups/`.

## Phase boundary

Phase 7B ends when the code tests pass. It does not migrate production rows. The first actual database writes belong to Phase 7C and should be limited to a small, explicitly chosen pilot set.
