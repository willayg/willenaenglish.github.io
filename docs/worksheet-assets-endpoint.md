# Worksheet asset endpoint

Status: Phase 4 implementation on `worksheet-storage-audit`. This endpoint does not save worksheet rows.

## Route

```text
POST /.netlify/functions/worksheet-assets
```

The caller must be signed in. Authentication is accepted from the normal `sb_access` cookie or an `Authorization: Bearer <token>` header.

## Environment

Required:

```text
SUPABASE_URL
SUPABASE_ANON_KEY (or SUPABASE_KEY)
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ENDPOINT (or R2_ACCOUNT_ID)
R2_IMAGES_BUCKET_NAME (or R2_BUCKET_NAME / R2_BUCKET)
R2_PUBLIC_BASE
```

Optional limits:

```text
WORKSHEET_IMAGE_MAX_BYTES          default 5242880
WORKSHEET_MAX_ASSETS               default 60
WORKSHEET_TOTAL_IMAGE_MAX_BYTES    default 20971520
```

## Transform a worksheet

```json
{
  "action": "transform_worksheet",
  "dry_run": true,
  "worksheet": {
    "worksheet_type": "wordtest",
    "images": "{...}",
    "settings": "{...}"
  }
}
```

With `dry_run: true`, the endpoint authenticates, transforms and validates the worksheet, but makes no R2 requests. With `dry_run: false`, each unique image is checked with `HeadObject`; missing objects are uploaded with immutable caching.

The response contains the transformed worksheet, the unique asset list and upload/reuse statistics. It does not write to Supabase.

## Upload a prepared asset list

```json
{
  "action": "upload_assets",
  "dry_run": false,
  "uploads": [
    {
      "data_url": "data:image/png;base64,...",
      "sha256": "...",
      "asset_key": "worksheets/assets/sha256/ab/<hash>.png"
    }
  ]
}
```

The endpoint recalculates the SHA-256 hash and asset key from decoded image bytes. A mismatch is rejected.

## Safety properties

- R2 credentials stay on the server.
- Requests require a valid Supabase user.
- CORS is restricted to known Willena origins.
- Only the image MIME types supported by the transformer are accepted.
- Per-image, total-byte and asset-count limits are enforced.
- Identical images are deduplicated by SHA-256.
- Existing objects are reused rather than overwritten.
- The endpoint never updates or deletes a worksheet row.
