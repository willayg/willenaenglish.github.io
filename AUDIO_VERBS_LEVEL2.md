# Level 2 Verbs (Verbs1–4) — ElevenLabs Audio

This repo now includes a one-command way to generate/upload ElevenLabs TTS audio for the four Level 2 Verbs lists:

- Games/Word Arcade/sample-wordlists-level2/Verbs1.json
- Games/Word Arcade/sample-wordlists-level2/Verbs2.json
- Games/Word Arcade/sample-wordlists-level2/Verbs3.json
- Games/Word Arcade/sample-wordlists-level2/Verbs4.json

## Prerequisites
- Netlify dev running with functions (so env and proxies work):
  - Requires server-side env: ELEVEN_LABS_API_KEY, ELEVEN_LABS_DEFAULT_VOICE_ID, R2_* for upload
- From the project root

## Quick run (Windows PowerShell)

```
# Optional: ensure Netlify dev is running (port 8888/9000). If not, start it first.
# Generate + upload audio for Verbs1–4 (includes "_itself" variants).
npm run audio:verbs-l2
```

The script calls `scripts/process_wordlists.js` with a filename filter so only these four lists are processed. Output summary is written to:

- build/wordlist-audio-report.json

## Advanced options
If you prefer sentences instead of the simple word prompt for TTS, you can run the processor directly using the `--use-examples` flag to read each entry's `ex` field (first example per word wins):

```
node scripts/process_wordlists.js --dir "Games/Word Arcade/sample-wordlists-level2" --files "Verbs1.json,Verbs2.json,Verbs3.json,Verbs4.json" --concurrency 4 --also-itself --use-examples --verbose
```

Notes:
- The browser game never generates audio on-the-fly (DISABLE_TTS_GENERATION=true). It expects these assets to exist in storage. Running the commands above ensures audio is available.
- You can re-run safely; existing audio is skipped unless you add `--force`.
- If Netlify dev isn’t running, the script falls back to `/.netlify/functions`, which works on deployed environments.
