#!/usr/bin/env node
/**
 * Upsert all sentences from one or more wordlist directories into Supabase and ensure ID-based audio.
 * - Uses Netlify function upsert_sentences_batch to create/find sentence rows and (optionally) generate audio sent_<id>.mp3
 * - Safely de-duplicates identical sentences across lists.
 *
 * Usage:
 *   node scripts/upsert_sentences_for_lists.js \
 *     --dirs "Games/Word Arcade/sample-wordlists,Games/Word Arcade/sample-wordlists-level2,Games/Word Arcade/sample-wordlists-level3" \
 *     [--generate-audio true|false] [--voice <ELEVEN_VOICE_ID>] [--concurrency 3]
 *
 * Defaults:
 *   --dirs: Games/Word Arcade/sample-wordlists
 *   --generate-audio: true
 *   --concurrency: 3
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

function getArg(name, def){
  const args = process.argv.slice(2);
  const idx = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const raw = args[idx];
  if (raw.includes('=')) return raw.split('=').slice(1).join('=');
  const next = args[idx+1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const DDIRS = getArg('dirs', 'Games/Word Arcade/sample-wordlists');
const GEN_AUDIO = String(getArg('generate-audio', 'true')).toLowerCase() !== 'false';
const CONCURRENCY = Math.max(1, Math.min(parseInt(getArg('concurrency','3'),10)||3, 8));
const CHUNK_SIZE = Math.max(10, Math.min(parseInt(getArg('chunk-size','200'),10)||200, 200));
const VOICE = getArg('voice', '') || undefined;
const MODEL = getArg('model', process.env.ELEVEN_LABS_MODEL_ID || '');

const ROOT = process.cwd();
const DIRS = DDIRS.split(',').map(d => path.join(ROOT, d.trim())).filter(Boolean);

const functionCandidates = [
  'http://localhost:9000/.netlify/functions',
  'http://127.0.0.1:9000/.netlify/functions',
  'http://localhost:8888/.netlify/functions',
  'http://127.0.0.1:8888/.netlify/functions',
  '/.netlify/functions'
];
async function pickBase(){
  for (const base of functionCandidates){
    try { const res = await fetch(base + '/diag_env'); if (res.ok) return base; } catch {/* ignore */}
  }
  return functionCandidates[functionCandidates.length-1];
}

function safeListDir(dir){
  try { return fs.readdirSync(dir, { withFileTypes:true }); } catch { return []; }
}

function normText(s){ return String(s||'').trim().replace(/\s+/g,' '); }

function collectSentencesFromItem(item){
  const out = [];
  if (!item || typeof item !== 'object') return out;
  const pushTxt = s => { if (typeof s === 'string'){ const t = normText(s); if (t.split(/\s+/).length >= 3) out.push(t); } };
  // common direct fields
  pushTxt(item.sentence);
  pushTxt(item.example);
  pushTxt(item.ex);
  pushTxt(item.example_sentence);
  pushTxt(item.sentence_example);
  pushTxt(item.ex_sentence);
  // arrays of strings or objects with .text
  const fromArray = arr => {
    if (!Array.isArray(arr)) return;
    for (const v of arr){
      if (typeof v === 'string') pushTxt(v);
      else if (v && typeof v.text === 'string') pushTxt(v.text);
    }
  };
  fromArray(item.sentences);
  fromArray(item.examples);
  return Array.from(new Set(out));
}

function normalizeWord(w){
  return String(w||'').trim();
}

function* iterWordlists(){
  for (const dir of DIRS){
    const entries = safeListDir(dir);
    for (const ent of entries){
      if (!ent.isFile()) continue;
      if (!ent.name.toLowerCase().endsWith('.json')) continue;
      const full = path.join(dir, ent.name);
      let data = null;
      try {
        data = JSON.parse(fs.readFileSync(full,'utf8'));
      } catch(e){
        console.warn('[WARN] skip invalid JSON', full, e.message);
        continue;
      }
      const list = Array.isArray(data) ? data : (Array.isArray(data?.words) ? data.words : []);
      if (!Array.isArray(list) || !list.length) continue;
      yield { file: full, name: ent.name, list };
    }
  }
}

async function main(){
  const base = await pickBase();
  console.log('[INFO] Using functions base:', base);

  const uniqueSentences = new Map(); // text -> Set(words)
  for (const { file, name, list } of iterWordlists()){
    for (const item of list){
      const words = new Set();
      const eng = normalizeWord(item.eng || item.word || item.term || '');
      if (eng) words.add(eng);
      for (const s of collectSentencesFromItem(item)){
        if (!uniqueSentences.has(s)) uniqueSentences.set(s, new Set());
        for (const w of words) uniqueSentences.get(s).add(w);
      }
    }
  }

  const sentencesPayload = Array.from(uniqueSentences.entries()).map(([text, set]) => ({ text, words: Array.from(set) }));
  console.log('[INFO] Total unique sentences:', sentencesPayload.length);
  if (!sentencesPayload.length){ console.log('[DONE] Nothing to upsert.'); return; }

  const chunkSize = CHUNK_SIZE; // keep request payloads manageable and avoid function timeouts
  const chunks = [];
  for (let i=0;i<sentencesPayload.length;i+=chunkSize){ chunks.push(sentencesPayload.slice(i, i+chunkSize)); }

  const summary = { chunks: chunks.length, total: sentencesPayload.length, ok:0, errors:0, generated:0, reused:0 };
  const voice_id = VOICE; // optional voice override

  let ci = 0; async function worker(){
    while (ci < chunks.length){
      const idx = ci++;
  const body = { action:'upsert_sentences_batch', sentences: chunks[idx], skip_audio: !GEN_AUDIO };
      if (voice_id) body.voice_id = voice_id;
  if (MODEL) body.model_id = MODEL;
      try {
        const res = await fetch(base + '/upsert_sentences_batch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (!res.ok) { summary.errors++; console.warn('[ERR] chunk', idx, 'HTTP', res.status); continue; }
        const js = await res.json();
        if (js && js.success){
          summary.ok++;
          if (js.audio){ summary.generated += js.audio.generated||0; summary.reused += js.audio.reused||0; }
        } else { summary.errors++; console.warn('[ERR] chunk', idx, 'invalid response'); }
      } catch(e){ summary.errors++; console.warn('[ERR] chunk', idx, e.message); }
    }
  }
  const workers = Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, () => worker());
  await Promise.all(workers);

  const report = { generatedAt: new Date().toISOString(), ...summary };
  const outDir = path.join(ROOT, 'build');
  try { fs.mkdirSync(outDir, { recursive:true }); } catch {}
  const outPath = path.join(outDir, 'sentences-upsert-report.json');
  try { fs.writeFileSync(outPath, JSON.stringify(report, null, 2)); console.log('[OK] Report:', outPath); } catch {}
  console.log('\n=== Upsert Summary ===');
  console.log(report);
}

main().catch(e => { console.error('[FATAL]', e); process.exit(1); });
