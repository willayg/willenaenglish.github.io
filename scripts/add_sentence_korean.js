/*
Batch add Korean translations for example sentences in wordlist JSON files.

Usage:
  node scripts/add_sentence_korean.js \
    --dirs "Games/Word Arcade/sample-wordlists,Games/Word Arcade/sample-wordlists-level2,Games/Word Arcade/sample-wordlists-level3" \
    --endpoint http://localhost:8888 \
    --write

Notes:
- This calls the Netlify translate function at `${endpoint}/.netlify/functions/translate`.
- You can point endpoint to your deployed site origin instead of localhost.
- If endpoint is omitted, script will still run but will not translate (dry placeholder).
*/

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const argv = process.argv.slice(2);
function getArg(name, def = null){
  const idx = argv.findIndex(a => a === `--${name}`);
  if (idx !== -1) return argv[idx+1] || def;
  const pref = `--${name}=`;
  const v = argv.find(a => a.startsWith(pref));
  return v ? v.slice(pref.length) : def;
}
const shouldWrite = argv.includes('--write');
const endpoint = (getArg('endpoint', '') || '').replace(/\/$/, '');
const dirsArg = getArg('dirs', 'Games/Word Arcade/sample-wordlists,Games/Word Arcade/sample-wordlists-level2,Games/Word Arcade/sample-wordlists-level3');
const dirs = dirsArg.split(',').map(s => s.trim()).filter(Boolean);
const concurrency = Number(getArg('concurrency', '3')) || 3;

function pickSentence(item){
  if (!item || typeof item !== 'object') return null;
  if (typeof item.sentence === 'string' && item.sentence.trim()) return item.sentence.trim();
  const cands = [item.example, item.ex, item.example_sentence, item.sentence_example, item.ex_sentence].filter(v => typeof v === 'string' && v.trim());
  if (cands.length) return String(cands[0]).trim();
  if (Array.isArray(item.sentences) && item.sentences.length){
    const chosen = (item.primary_sentence_id ? item.sentences.find(s=>s.id === item.primary_sentence_id) : null) || item.sentences[0];
    if (chosen && typeof chosen.text === 'string' && chosen.text.trim()) return chosen.text.trim();
  }
  return null;
}
function hasKor(item){
  if (!item || typeof item !== 'object') return false;
  const cands = [item.sentence_kor, item.sentenceKor, item.ex_kor, item.example_kor, item.kor_sentence, item.korean_sentence, item.korean, item.kor, item.ko, item.translation_ko, item.translationKor].filter(v => typeof v === 'string' && v.trim());
  if (cands.length) return true;
  if (Array.isArray(item.sentences) && item.sentences.length){
    const chosen = (item.primary_sentence_id ? item.sentences.find(s=>s.id === item.primary_sentence_id) : null) || item.sentences[0];
    if (chosen && (chosen.ko || chosen.kor || chosen.korean || chosen.translation_ko)) return true;
  }
  return false;
}
function looksKorean(str){
  if (!str) return false;
  return /[\u3131-\u318E\uAC00-\uD7A3]/.test(str);
}

async function translate(text){
  // If an endpoint is provided, use the Netlify translate function
  if (endpoint){
    const url = endpoint.includes('/.netlify/functions/translate')
      ? endpoint
      : endpoint + '/.netlify/functions/translate';
    const res = await fetch(url + `?target=ko&text=${encodeURIComponent(text)}`);
    if (!res.ok) throw new Error(`translate failed ${res.status}`);
    const js = await res.json();
    const out = (js && (js.translated || js.translatedText)) || null;
    return out;
  }
  // Fallback: call public LibreTranslate directly (no key). May be rate-limited.
  try {
    const libreUrl = (process.env.LIBRE_TRANSLATE_URL || 'https://libretranslate.com').replace(/\/$/, '');
    const libreKey = process.env.LIBRE_TRANSLATE_KEY || '';
    const res = await fetch(libreUrl + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: 'en', target: 'ko', format: 'text', api_key: libreKey || undefined })
    });
    if (res.ok){
      const js = await res.json().catch(()=>null);
      const translated = js?.translatedText || js?.translated || '';
      if (translated) return translated;
    }
  } catch(e){ /* ignore and return null below */ }
  return null;
}

async function processFile(filePath){
  const raw = await fs.promises.readFile(filePath, 'utf8');
  let arr;
  try { arr = JSON.parse(raw); } catch(e){ console.warn('Skip invalid JSON:', filePath); return { filePath, updated: 0, total: 0 }; }
  if (!Array.isArray(arr)) return { filePath, updated: 0, total: 0 };
  let updated = 0;
  for (let i=0;i<arr.length;i++){
    const it = arr[i];
    if (hasKor(it)) continue;
    const s = pickSentence(it);
    if (!s) continue;
  let ko = null;
  try { ko = await translate(s); } catch(e){ console.warn('translate error:', e.message); }
  if (!ko) continue; // skip if no translation returned
  // Guard: don't write if translation equals source (common when mock returns echo)
  const srcNorm = String(s).trim().toLowerCase();
  const koNorm = String(ko).trim().toLowerCase();
  if (koNorm === srcNorm && !looksKorean(ko)) continue;
    it.sentence_kor = ko;
    // If there is a sentences array, also mirror the value onto the chosen entry
    if (Array.isArray(it.sentences) && it.sentences.length){
      const chosen = (it.primary_sentence_id ? it.sentences.find(s=>s.id === it.primary_sentence_id) : null) || it.sentences[0];
      if (chosen && !chosen.ko) chosen.ko = ko;
    }
    updated++;
  }
  if (updated && shouldWrite){
    await fs.promises.writeFile(filePath, JSON.stringify(arr, null, 2) + '\n', 'utf8');
  }
  return { filePath, updated, total: arr.length };
}

async function* walkJsonFiles(root){
  const ents = await fs.promises.readdir(root, { withFileTypes: true });
  for (const ent of ents){
    const p = path.join(root, ent.name);
    if (ent.isDirectory()){
      yield* walkJsonFiles(p);
    } else if (ent.isFile() && p.toLowerCase().endsWith('.json')){
      yield p;
    }
  }
}

async function run(){
  const files = [];
  for (const dir of dirs){
    try {
      for await (const f of walkJsonFiles(dir)) files.push(f);
    } catch(e){ console.warn('Skip dir (missing?):', dir); }
  }
  console.log('Found JSON files:', files.length);
  let queue = files.slice();
  let active = 0; let done = 0; let updatedTotal = 0;
  await new Promise((resolve)=>{
    const kick = ()=>{
      while (active < concurrency && queue.length){
        const f = queue.shift();
        active++;
        processFile(f).then(res=>{
          done++; active--; updatedTotal += res.updated; 
          console.log(`[${done}/${files.length}] ${path.relative(process.cwd(), res.filePath)} -> updated ${res.updated}`);
          kick();
        }).catch(err=>{ done++; active--; console.warn('error', err); kick(); });
      }
      if (done >= files.length) resolve();
    };
    kick();
  });
  console.log('Completed. Updated sentences:', updatedTotal);
  if (!shouldWrite){
    console.log('Dry run (no files written). Add --write to save changes.');
  }
}

run().catch(err=>{ console.error(err); process.exit(1); });
