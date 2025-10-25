#!/usr/bin/env node
/**
 * Generate audio for sentences (one per word) using existing build/sentences/manifest.json.
 * Naming convention requested: <word>_sentence.mp3 (word normalized like other uploads).
 * Process:
 *  1. Load manifest (must exist; run generate:sentences first).
 *  2. For each sentence entry, construct target name `${word}_sentence`.
 *  3. Check if audio already exists (via get_audio_url(s)). If exists, skip.
 *  4. If missing, call eleven_labs_proxy with the sentence text, then upload via upload_audio providing word=`<word>_sentence`.
 *  5. Report summary per run; supports --dry-run, --limit, --concurrency, --voice, --list slug filter.
 *
 * Usage:
 *  node scripts/process_sentence_audio.js [--dry-run] [--limit N] [--concurrency 3] [--voice VOICE_ID] [--list slugA,slugB]
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const args = process.argv.slice(2);
function flag(name){ return args.includes(`--${name}`); }
function getArg(name, def){
  const idx = args.findIndex(a=> a===`--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const raw = args[idx];
  if (raw.includes('=')) return raw.split('=').slice(1).join('=');
  const next = args[idx+1];
  if (!next || next.startsWith('--')) return true; return next;
}
  const FORCE = flag('force') || getArg('force', false) === 'true';

const DRY = flag('dry-run') || getArg('dry-run', false) === 'true';
const LIMIT = parseInt(getArg('limit','0'),10) || 0; // number of sentences total
const CONCURRENCY = Math.max(1, Math.min(parseInt(getArg('concurrency','3'),10)||3, 8));
const VOICE = getArg('voice', process.env.ELEVEN_LABS_DEFAULT_VOICE_ID || '');
const MODEL = getArg('model', process.env.ELEVEN_LABS_MODEL_ID || '');
const LIST_FILTER = (getArg('list','')||'').split(',').map(s=>s.trim()).filter(Boolean); // optional list slug filter
const EXCLUDE_LIST = (getArg('exclude-list','')||'').split(',').map(s=>s.trim()).filter(Boolean); // optional list slug exclude
// If true, speak only the base word for each sentence entry (i.e., word_itself-style),
// while still saving to the standard `<word>_sentence` file name.
const WORD_ITSELF_MODE = flag('word-itself-mode') || getArg('word-itself-mode', false) === 'true';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'build', 'sentences', 'manifest.json');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('[ERROR] Sentences manifest not found. Run generate:sentences first.');
  process.exit(1);
}

const functionCandidates = [
  'http://localhost:9000/.netlify/functions',
  'http://127.0.0.1:9000/.netlify/functions',
  'http://localhost:8888/.netlify/functions',
  'http://127.0.0.1:8888/.netlify/functions',
  '/.netlify/functions'
];
async function pickBase(){
  for (const base of functionCandidates){
    try { const res = await fetch(base + '/diag_env'); if (res.ok) return base; } catch {/*ignore*/}
  }
  return functionCandidates[functionCandidates.length-1];
}

function normalizeWord(w){
  return String(w||'').trim().toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_\-]/g,'');
}

async function audioExists(base, name){
  try {
    const batch = await fetch(base + '/get_audio_urls', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ words:[name] }) });
    if (batch.ok){
      const data = await batch.json();
      const info = data.results && (data.results[name] || data.results[normalizeWord(name)]);
      if (info && info.exists) return true;
    }
  } catch {}
  try {
    const single = await fetch(base + '/get_audio_url?word=' + encodeURIComponent(name));
    if (single.ok){ const d = await single.json(); return !!d.exists; }
  } catch {}
  return false;
}

async function delay(ms){ return new Promise(r=> setTimeout(r, ms)); }

async function tts(base, text){
  const body = { text };
  if (VOICE) body.voice_id = VOICE;
  if (MODEL) body.model_id = MODEL;
  let attempt = 0;
  const maxAttempts = 6;
  let lastErr = null;
  while (attempt < maxAttempts){
    try {
      const res = await fetch(base + '/eleven_labs_proxy', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
      if (!res.ok) {
        let detail = '';
        try { const d = await res.json(); detail = d && (d.details || d.error) || ''; } catch {}
        const status = res.status;
        // Handle rate limiting or transient server errors with backoff
        if (status === 429 || status === 503) {
          attempt++;
          const retryAfter = res.headers && (res.headers.get ? res.headers.get('retry-after') : null);
          const waitMs = retryAfter ? (parseFloat(retryAfter) * 1000) : Math.min(30000, 2000 * Math.pow(2, attempt));
          await delay(waitMs);
          continue;
        }
        throw new Error('TTS failed HTTP ' + status + (detail ? (' :: ' + String(detail).slice(0,200)) : ''));
      }
      const data = await res.json();
      if (!data.audio) throw new Error('No audio');
      return data.audio;
    } catch (e){
      lastErr = e;
      attempt++;
      if (attempt < maxAttempts) {
        await delay(Math.min(30000, 1000 * Math.pow(2, attempt-1)));
        continue;
      }
    }
  }
  throw lastErr || new Error('TTS failed');
}

async function upload(base, name, audioB64){
  const res = await fetch(base + '/upload_audio', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ word: name, fileDataBase64: audioB64 }) });
  if (!res.ok) throw new Error('Upload HTTP '+res.status);
  const data = await res.json();
  if (!data.success) throw new Error('Upload failed');
  return data.url;
}

function loadSentences(){
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));
  const out = [];
  for (const id of Object.keys(manifest.sentences)){
    const s = manifest.sentences[id];
    if (!s || !s.word || !s.text) continue;
    if (LIST_FILTER.length && !LIST_FILTER.includes(s.list)) continue;
    if (EXCLUDE_LIST.length && EXCLUDE_LIST.includes(s.list)) continue;
    out.push({ id, word: s.word, text: s.text, list: s.list, index: s.index });
  }
  // Sort stable by list then index
  out.sort((a,b)=> a.list===b.list ? a.index - b.index : a.list.localeCompare(b.list));
  return out;
}

async function main(){
  const base = await pickBase();
  console.log('[INFO] Using functions base:', base);
  const all = loadSentences();
  const target = LIMIT > 0 ? all.slice(0, LIMIT) : all;
  console.log('[INFO] Total sentences:', all.length, 'Processing:', target.length);

  let idx = 0; const summary = { considered: target.length, skippedExisting:0, generated:0, errors:0, mode: WORD_ITSELF_MODE ? 'word_itself' : 'sentence' };
  async function worker(){
    while (idx < target.length){
      const cur = target[idx++];
      const baseName = normalizeWord(cur.word) + '_sentence';
      try {
        const exists = await audioExists(base, baseName);
          if (exists && !FORCE){ summary.skippedExisting++; continue; }
        const textToSpeak = WORD_ITSELF_MODE ? cur.word : cur.text;
        if (DRY){ console.log('[DRY] Would gen', baseName, 'from:', textToSpeak); continue; }
        const audioB64 = await tts(base, textToSpeak);
        await upload(base, baseName, audioB64);
        summary.generated++; console.log('[OK]', baseName);
      } catch(e){ summary.errors++; console.warn('[ERR]', baseName, e.message); }
    }
  }
  const workers = Array.from({ length: CONCURRENCY }, ()=> worker());
  await Promise.all(workers);
  console.log('\n=== Sentence Audio Summary ===');
  console.log(summary);
  if (!DRY){
    // Write a small report
    const reportPath = path.join(ROOT,'build','sentence-audio-report.json');
    try { fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), ...summary },null,2)); console.log('Report written to', reportPath); } catch {}
  }
}

main().catch(e=>{ console.error('[FATAL]', e); process.exit(1); });
