#!/usr/bin/env node
/**
 * Batch processor for sample word list JSON files.
 * For each JSON file in Games/Word Arcade/sample-wordlists:
 *  - Load array of entries with shape: { eng, kor, def?, ex? }
 *  - For each unique English word (eng):
 *      * Check if audio already exists in R2 via get_audio_url (HEAD logic through existing function)
 *      * If missing, request ElevenLabs TTS through existing netlify function (eleven_labs_proxy)
 *      * Upload mp3 to R2 via upload_audio function
 *  - (Optional future) generate or augment sentences/examples
 *  - Write an output manifest summarizing which were newly generated
 *
 * ENV requirements (same as runtime functions):
 *  ELEVEN_LABS_API_KEY, ELEVEN_LABS_DEFAULT_VOICE_ID
 *  R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME (or variants), R2_PUBLIC_BASE(optional)
 *
 * Usage:
 *   node scripts/process_wordlists.js [--dry-run] [--limit N] [--voice VOICE_ID] [--dir relative/path] [--concurrency 3] [--use-examples] [--verbose]
 *
 * Flags:
 *   --use-examples  If present, use the entry's example sentence (ex) as the TTS text instead of a generated prompt.
 *                   If multiple entries share the same word, the first non-empty example is used. Falls back to prompt if missing.
 *   --verbose       Extra per-word logging (chosen text type, etc.).
 *
 * Notes:
 *  - Runs locally expecting `netlify dev` on port 8888 or 9000 for functions; falls back to production relative paths otherwise.
 *  - Safe to re-run; existing audio files are skipped.
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--') && !a.includes('=')));
function getArg(name, def) {
  const idx = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const raw = args[idx];
  if (raw.includes('=')) return raw.split('=').slice(1).join('=');
  const nxt = args[idx + 1];
  if (!nxt || nxt.startsWith('--')) return true;
  return nxt;
}

const DRY_RUN = flags.has('--dry-run') || getArg('dry-run', false) === 'true';
const LIMIT = parseInt(getArg('limit', '0'), 10) || 0; // limit words per file
const VOICE = getArg('voice', process.env.ELEVEN_LABS_DEFAULT_VOICE_ID || '');
const DIR = getArg('dir', 'Games/Word Arcade/sample-wordlists');
const FILES_FILTER = getArg('files', ''); // comma-separated basenames to include (e.g., "Verbs1.json,Verbs2.json")
const CONCURRENCY = Math.max(1, Math.min( parseInt(getArg('concurrency', '3'), 10) || 3, 8));
const USE_EXAMPLES = flags.has('--use-examples') || getArg('use-examples', false) === 'true';
const VERBOSE = flags.has('--verbose') || getArg('verbose', false) === 'true';
const FORCE = flags.has('--force') || getArg('force', false) === 'true';
const ALSO_ITSELF = flags.has('--also-itself') || getArg('also-itself', false) === 'true';

const root = process.cwd();
const targetDir = path.join(root, DIR);
if (!fs.existsSync(targetDir)) {
  console.error('[ERROR] Target directory not found:', targetDir);
  process.exit(1);
}

const functionCandidates = [
  'http://localhost:9000/.netlify/functions',
  'http://127.0.0.1:9000/.netlify/functions',
  'http://localhost:8888/.netlify/functions',
  'http://127.0.0.1:8888/.netlify/functions',
  '/.netlify/functions'
];

async function pickBase() {
  for (const base of functionCandidates) {
    try {
      const url = base + '/diag_env';
      const res = await fetch(url, { method: 'GET', timeout: 5000 });
      if (res.ok) return base;
    } catch { /* ignore */ }
  }
  return functionCandidates[functionCandidates.length - 1];
}

function normalizeWord(w){
  return String(w||'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
}

async function wordExists(base, word) {
  const qs = new URLSearchParams({ word });
  const endpoints = [ '/get_audio_url', '/get_audio_urls' ];
  // Try batch endpoint for possible richer logic
  try {
    const batch = await fetch(base + '/get_audio_urls', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ words:[word] }) });
    if (batch.ok) {
      const data = await batch.json();
      const info = data.results && (data.results[word] || data.results[normalizeWord(word)]);
      if (info && info.exists) return true;
    }
  } catch {}
  try {
    const single = await fetch(base + '/get_audio_url?' + qs.toString());
    if (single.ok) {
      const data = await single.json();
      return !!data.exists;
    }
  } catch {}
  return false; // assume missing
}

async function generateTTS(base, text) {
  const body = { text };
  if (VOICE) body.voice_id = VOICE;
  let attempt = 0; let lastErr = null;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
    try {
      const res = await fetch(base + '/eleven_labs_proxy', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('TTS proxy failed HTTP ' + res.status);
      const data = await res.json();
      if (!data.audio) throw new Error('No audio in response');
      return data.audio; // base64
    } catch (e) {
      lastErr = e; attempt++;
      if (attempt < maxAttempts) {
        const delay = 1000 * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr || new Error('TTS failed');
}

async function uploadAudio(base, word, audioBase64) {
  const res = await fetch(base + '/upload_audio', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ word, fileDataBase64: audioBase64 }) });
  if (!res.ok) throw new Error('Upload failed HTTP ' + res.status);
  const data = await res.json();
  if (!data.success) throw new Error('Upload unsuccessful');
  return data.url;
}

function pickPrompt(word){
  // Mirror subset of templates from tts.js preprocessTTS but simpler and deterministic to avoid many duplicates
  // Removed "Can you say" and "Please repeat" per content preference
  const templates = [
    (w)=>`The word is "${w}"...`,
    (w)=>`This one is "${w}"...`,
    (w)=>`Try the word "${w}"...`,
    (w)=>`Listen: "${w}".`
  ];
  // Deterministic index based on hash
  let h = 0; const s = word.toLowerCase();
  for (let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i)) >>> 0; }
  return templates[h % templates.length](word);
}

async function processFile(base, filePath){
  const raw = fs.readFileSync(filePath,'utf8');
  let arr;
  try { arr = JSON.parse(raw); } catch (e){ console.error('[SKIP] JSON parse failed', filePath, e.message); return { file: path.basename(filePath), error: 'parse_failed' }; }
  if (!Array.isArray(arr)) { console.error('[SKIP] Not an array', filePath); return { file: path.basename(filePath), error: 'not_array' }; }

  const words = [];
  const exampleMap = {}; // word -> example sentence
  for (const item of arr) {
    if (item && item.eng) {
      const w = String(item.eng).trim();
      if (!w) continue;
      words.push(w);
      if (USE_EXAMPLES && !exampleMap[w] && item.ex) {
        const ex = String(item.ex).trim();
        if (ex) exampleMap[w] = ex;
      }
    }
  }
  const unique = Array.from(new Set(words.filter(Boolean)));
  const limited = LIMIT > 0 ? unique.slice(0, LIMIT) : unique;

  const summary = { file: path.basename(filePath), total: unique.length, processing: limited.length, skippedExisting:0, generated:0, errors:0, usedExamples:0, generatedItself:0 };

  let i = 0; let active = 0; let idx = 0; const results = [];
  async function worker(){
    while (idx < limited.length){
      const w = limited[idx++];
      const norm = normalizeWord(w);
      try {
        const mainExists = await wordExists(base, w);
        const itselfTarget = `${w}_itself`;
        const itselfExists = ALSO_ITSELF ? await wordExists(base, itselfTarget) : false;

        // Generate main word audio if missing or forcing
        if (!mainExists || FORCE) {
          if (DRY_RUN) { console.log('[DRY] Would generate', w); }
          else {
            let text;
            if (USE_EXAMPLES && exampleMap[w]) {
              text = exampleMap[w];
              summary.usedExamples++;
              if (VERBOSE) console.log('[GEN][EX]', w, '->', text);
            } else {
              text = pickPrompt(w);
              if (VERBOSE) console.log('[GEN][PR]', w, '->', text);
            }
            const audioB64 = await generateTTS(base, text);
            await uploadAudio(base, w, audioB64);
            summary.generated++;
            console.log('[OK]', w);
          }
        } else {
          summary.skippedExisting++;
        }

        // Independently ensure the "itself" file exists when requested
        if (ALSO_ITSELF && !itselfExists) {
          try {
            if (DRY_RUN) { console.log('[DRY][itself] Would generate', itselfTarget); }
            else {
              const audioB64it = await generateTTS(base, w);
              await uploadAudio(base, itselfTarget, audioB64it);
              summary.generatedItself++;
              if (VERBOSE) console.log('[OK][itself]', itselfTarget);
            }
          } catch (e2) {
            summary.errors++;
            console.warn('[ERR][itself]', itselfTarget, e2.message);
          }
        }
      } catch (e){
        summary.errors++;
        console.warn('[ERR]', w, e.message);
      }
    }
  }
  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);
  return summary;
}

(async function main(){
  const base = await pickBase();
  console.log('[INFO] Using functions base:', base);
  // Recursively gather all JSON files under targetDir
  function listJsonFiles(dir){
    const out = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries){
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...listJsonFiles(full));
      else if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) out.push(full);
    }
    return out;
  }
  let files = listJsonFiles(targetDir);
  // Optional: filter by basenames provided via --files
  if (FILES_FILTER && typeof FILES_FILTER === 'string') {
    const names = new Set(
      FILES_FILTER.split(',')
        .map(s => s && s.trim().toLowerCase())
        .filter(Boolean)
    );
    if (names.size) {
      const before = files.length;
      files = files.filter(f => names.has(path.basename(f).toLowerCase()));
      console.log(`[INFO] Filtered files via --files (${names.size} names). ${before} -> ${files.length}`);
      if (!files.length) {
        console.warn('[WARN] No matching files after filter. Check --files values.');
      }
    }
  }
  const reports = [];
  for (const f of files) {
    console.log('\n=== Processing', path.relative(root, f), '===');
    const rep = await processFile(base, f);
    reports.push(rep);
  }
  console.log('\n=== Batch Summary ===');
  for (const r of reports){
    console.log(`${r.file}: total=${r.total} considered=${r.processing} generated=${r.generated} skippedExisting=${r.skippedExisting} errors=${r.errors} usedExamples=${r.usedExamples}`);
  }
  fs.writeFileSync(path.join(root,'build','wordlist-audio-report.json'), JSON.stringify(reports,null,2));
  console.log('\nReport written to build/wordlist-audio-report.json');
})();
