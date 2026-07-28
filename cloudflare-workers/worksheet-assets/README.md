# Worksheet Assets Worker

Cloudflare Worker for moving embedded worksheet images into R2 without routing through Netlify or the S3-compatible API.

## What it does

- Requires a valid Supabase access token from the normal auth cookie or Bearer header.
- Transforms `wordtest` and `flashcard` worksheet payloads.
- Hashes decoded image bytes with SHA-256 using Web Crypto.
- Uses the direct `WORKSHEET_ASSETS` R2 binding for `head()` and `put()`.
- Reuses existing content-addressed objects.
- Returns the compact worksheet payload but never writes a worksheet row.
- Supports `dry_run: true`, which performs no R2 reads or writes.

## Route

Deploy this Worker behind the shared API routing as:

```text
POST /api/worksheet-assets
```

Request:

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

## Required bindings and secrets

R2 binding:

```toml
[[r2_buckets]]
binding = "WORKSHEET_ASSETS"
bucket_name = "<image bucket name>"
```

Secrets:

```text
SUPABASE_URL
SUPABASE_ANON_KEY
```

Variables:

```text
R2_PUBLIC_BASE
WORKSHEET_IMAGE_MAX_BYTES
WORKSHEET_MAX_ASSETS
WORKSHEET_TOTAL_IMAGE_MAX_BYTES
```

No R2 access key or secret is used. The Worker talks directly to the bound bucket.

## Deployment boundary

This phase only provides the Worker. It does not update the worksheet Save button, modify Supabase rows, migrate legacy worksheets, or delete embedded data.
