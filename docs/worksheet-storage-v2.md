# Worksheet storage v2

Status: design and compatibility layer only. No live worksheet rows are changed by this phase.

## Goals

- Keep editable worksheet text and layout in Supabase.
- Store image binaries in Cloudflare R2.
- Preserve all existing URL-based worksheets.
- Read legacy base64 worksheets during migration.
- Prevent new base64 payloads from reaching Postgres once the save guard is deployed.

## Canonical asset reference

```json
{
  "kind": "asset",
  "asset_key": "worksheets/assets/sha256/ab/abcdef...png",
  "url": "https://<public-r2-domain>/worksheets/assets/sha256/ab/abcdef...png",
  "sha256": "abcdef...",
  "mime_type": "image/png",
  "bytes": 12345
}
```

`url` is kept for current browser compatibility. `asset_key` is the durable identity. The hash is calculated from decoded binary bytes, not from the base64 string.

## R2 key format

```text
worksheets/assets/sha256/<first-two-hash-characters>/<full-sha256>.<extension>
```

The key is content-addressed, so identical images upload once and can be reused across worksheets.

Allowed initial MIME types:

- image/png
- image/jpeg
- image/webp
- image/gif

SVG is excluded from the first migration because it needs separate sanitisation.

## Schema marker

Migrated worksheets receive this property inside `settings` or a future dedicated column:

```json
{
  "storage_schema_version": 2
}
```

Until a dedicated database column is added, loaders must not rely only on this marker. They should detect either legacy data URLs or v2 asset references.

## Word-test representation

Keep the current `images` map and replace only its image source:

```json
{
  "ant_0": {
    "src": "https://<public-r2-domain>/worksheets/assets/sha256/ab/abcdef.png",
    "asset_key": "worksheets/assets/sha256/ab/abcdef.png",
    "sha256": "abcdef",
    "mime_type": "image/png",
    "word": "ant",
    "index": 0
  }
}
```

Emoji entries remain unchanged:

```json
{
  "ant_0": {
    "src": "emoji",
    "emoji": "🐜",
    "word": "ant",
    "index": 0
  }
}
```

Existing normal HTTP(S) URLs remain unchanged during migration.

## Flashcard representation

Flashcards use one canonical image map in `images`. `settings` contains display and card-layout configuration only.

```json
{
  "cards": [
    {
      "card_index": 0,
      "word": "apple",
      "image": {
        "kind": "asset",
        "asset_key": "worksheets/assets/sha256/ab/abcdef.png",
        "url": "https://<public-r2-domain>/worksheets/assets/sha256/ab/abcdef.png",
        "sha256": "abcdef",
        "mime_type": "image/png",
        "bytes": 12345
      }
    }
  ]
}
```

Any image-heavy card copy found in `settings` is removed only after the transformer has matched it to the canonical card entry and validation succeeds.

## Compatibility rules

Loaders must accept:

1. Legacy `data:image/...` strings.
2. Existing HTTP(S) image URLs.
3. V2 objects containing `url` and `asset_key`.
4. Emoji markers.

Savers may temporarily accept all four, but the server-side save guard will eventually reject any persisted `data:image/...` string.

## Upload contract

The future upload endpoint receives decoded image data or a data URL and returns:

```json
{
  "success": true,
  "asset": {
    "asset_key": "worksheets/assets/sha256/ab/abcdef.png",
    "url": "https://<public-r2-domain>/worksheets/assets/sha256/ab/abcdef.png",
    "sha256": "abcdef",
    "mime_type": "image/png",
    "bytes": 12345,
    "created": false
  }
}
```

`created: false` means an identical content-addressed object already existed.

## Validation invariants

A transformed worksheet is acceptable only when:

- No `data:image/` string remains in `images`, `settings`, or `image_data`.
- Word-test image keys, words and indices are preserved.
- Flashcard count and order are preserved.
- Existing external URLs are preserved.
- Emoji entries are preserved.
- The transformed payload can be serialised and parsed again.
- Every new asset reference has an R2 key, public URL, MIME type and SHA-256 hash.

## Phase boundaries

Phase 3 defines the format and pure transformation logic. It does not:

- upload any live image,
- alter Supabase schema,
- change save/load endpoints,
- update worksheet rows,
- delete legacy data.
