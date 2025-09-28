# willenaenglish.github.io
 
Quick function health checks (when running on Netlify):
- Logger env: `/.netlify/functions/log_word_attempt?env=1`
- Logger self-test insert: `/.netlify/functions/log_word_attempt?selftest=1`
- Progress summary (requires auth cookie): `/.netlify/functions/progress_summary?section=kpi`

## Batch Generating Word List Audio

You can bulk create ElevenLabs TTS MP3 files for every word across the sample word list JSON files in `Games/Word Arcade/sample-wordlists` and upload them to Cloudflare R2.

Script location: `scripts/process_wordlists.js`

Add required environment variables (can be in a local `.env` consumed by Netlify dev or your shell):

Required for TTS:
- `ELEVEN_LABS_API_KEY`
- `ELEVEN_LABS_DEFAULT_VOICE_ID` (or pass `--voice` flag)

Required for R2 upload (same as existing functions):
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT` (e.g. `https://<account>.r2.cloudflarestorage.com`)
- `R2_BUCKET_NAME` (or `R2_BUCKET` / `R2_BUCKETNAME`)
- (Optional) `R2_PUBLIC_BASE` if you serve objects via a custom/public base URL

Run Netlify functions locally first:
```
netlify dev
```

Then dry run (no audio generation/uploads):
```
npm run process:wordlists -- --dry-run --limit 5
```

Full run (all words):
```
npm run process:wordlists
```

Useful flags:
- `--dry-run` : show what would be generated without calling APIs
- `--limit N` : only process first N unique words per file (for quick tests)
- `--voice VOICE_ID` : override default voice
- `--dir relative/path` : different directory of JSON lists
- `--concurrency 5` : parallel word generations (default 3, max 8)
- `--use-examples` : use each entry's example sentence (`ex`) as the TTS text instead of a generated prompt (falls back to prompt if missing)
- `--verbose` : extra per-word logging (shows whether example or prompt used)

Examples:
Use examples with verbose logging (first 10 words only):
```
npm run process:wordlists -- --use-examples --limit 10 --verbose
```

Full run using examples:
```
npm run process:wordlists -- --use-examples
```

Output report written to: `build/wordlist-audio-report.json` summarizing per-file stats (generated, skipped, errors).

Idempotent: existing audio files (detected by functions `get_audio_urls` / `get_audio_url`) are skipped, so re-running only fills gaps.

## Sentence Manifest Generation

Script: `scripts/generate_sentences.js`

Rebuilds `build/sentences/manifest.json`, `upload_manifest.json`, `all_sentences.txt`, and `all_words.txt` from every JSON word list in `Games/Word Arcade/sample-wordlists`.

Behavior:
- Preserves existing sentence IDs when the sentence text already exists (reusing the original 6‑char code fragment).
- For brand new sentence texts, derives a deterministic 6‑char code from the sentence text (sha256 prefix) while avoiding collisions.
- Uses `item.ex` when present; otherwise creates a simple fallback sentence.

Run dry (preview only, no writes):
```
npm run generate:sentences -- --dry-run --limit 5
```

Full generation:
```
npm run generate:sentences
```

Flags:
- `--dry-run`  Do not write files.
- `--limit N`  Limit number of words per list (useful for quick tests).

Output Files:
- `build/sentences/manifest.json`      (detailed sentence + reverse index)
- `build/sentences/upload_manifest.json` (flat array for uploading / external tasks)
- `build/sentences/all_sentences.txt`  (one sentence per line)
- `build/sentences/all_words.txt`      (unique words sorted)

ID Format: `<slug>__sNNN__xxxxxx`
- `slug`: lowercased wordlist filename sans `.json`
- `NNN`: 1-based, zero-padded index per list
- `xxxxxx`: 6-char hex code reused or derived from sentence text

## Sentence Audio Generation (word_sentence.mp3)

You can generate MP3 audio for each sentence using the naming pattern `<word>_sentence.mp3` so it sits alongside existing single-word audio. This uses the already generated sentences in `build/sentences/manifest.json`.

Script: `scripts/process_sentence_audio.js`

NPM script:
```
npm run process:sentences
```

Dry run (preview first 15 sentences only):
```
npm run process:sentences -- --dry-run --limit 15
```

Generate only specific lists (comma-separated slugs):
```
npm run process:sentences -- --list easyanimals,food1
```

Flags:
- `--dry-run`       Show actions without generating/uploading.
- `--limit N`       Limit total sentences processed (after filtering) for quick tests.
- `--concurrency N` Parallel TTS/upload workers (default 3, max 8).
- `--voice VOICE_ID` Override ElevenLabs voice (else uses env default).
- `--list slugA,slugB` Only process sentences whose `list` slug matches one of these.

Naming logic:
- For a sentence whose word is `apple`, uploaded file name becomes `apple_sentence.mp3`.
- Word normalization matches other scripts: lowercase, spaces -> `_`, non-alphanumerics removed (except `_` and `-`).

Idempotent:
- Existing `word_sentence` audio is detected and skipped using the same `get_audio_url(s)` functions.

Report:
- After a real run a summary JSON is written to `build/sentence-audio-report.json`.

Prerequisites:
- Run `npm run generate:sentences` first to build the manifest.
- Ensure Netlify functions are available locally (`netlify dev`) or script will fall back to production paths.
