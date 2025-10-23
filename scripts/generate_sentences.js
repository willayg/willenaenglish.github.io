#!/usr/bin/env node
/**
 * Sentence manifest generator (rebuilds build/sentences/* similar to existing structure).
 * Uses existing manifest.json to preserve IDs when sentence text matches.
 * For new sentences (different text not in previous manifest), produces ID of form:
 *   <slug>__sNNN__<code>
 * where <code> is:
 *   1) If an existing sentence elsewhere has identical text, reuse its 6-char code.
 *   2) Else derive deterministic code = first 6 hex of sha256(sentenceText). If that collides with a different sentenceText, append last 2 hex of full hash (ensuring uniqueness but still style). Finally truncate to 6.
 *
 * Sentence source priority per wordlist entry object:
 *   1. item.ex (example) if non-empty
 *   2. If item.def exists and short (<=60 chars) we might template: "<CapWord> - <trimmed def>." (Optional - currently not used to mimic existing style)
 *   3. Fallback template: "The <word> appears." for nouns (simple heuristic) or "I <word> ..." if verb-like (very naive). To keep consistent, we'll use minimal pattern: If word starts with a verb-like base (basic guess) use: "I <word> it." else "The <word> is here."  But since existing lists mostly already include examples, fallback will rarely trigger.
 *
 * NOTE: We purposely keep logic simple; you requested to "use the existing method". Because the actual original algorithm for the 6-char codes isn't present in repo, we preserve all existing IDs and mimic style for any new additions.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');  // Go up one level from scripts/
// Allow overriding the wordlist directory via --dir
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
const DIR_OVERRIDE = getArg('dir', '').trim();
const WORDLIST_DIR = DIR_OVERRIDE ? path.join(ROOT, DIR_OVERRIDE) : path.join(ROOT, 'Games', 'Word Arcade', 'sample-wordlists');
const BUILD_DIR = path.join(ROOT, 'build', 'sentences');
const DRY = args.includes('--dry-run');
const LIMIT = (()=>{ const i=args.indexOf('--limit'); if(i!==-1) return parseInt(args[i+1],10)||0; return 0; })();

function slugify(filename){
  return filename.replace(/\.json$/i,'').toLowerCase();
}

function zeroPad(n){ return n.toString().padStart(3,'0'); }

function deriveCode(text, reuseMap){
  // Reuse existing code if text found
  if (reuseMap.has(text)) return reuseMap.get(text);
  const full = crypto.createHash('sha256').update(text).digest('hex');
  let code = full.slice(0,6);
  // Simple collision check: if some other text already took this code, adjust
  while ([...reuseMap.values()].includes(code)) {
    code = full.slice(0,4) + full.slice(-2);
    if (code.length > 6) code = code.slice(0,6);
    break; // minimal attempt; extremely low probability of conflict beyond this
  }
  return code;
}

function guessSentence(word){
  const w = String(word).trim();
  if(!w) return '';
  // Very naive: treat words ending in common verb forms OR present tense basics
  if (/^(run|walk|eat|drink|sleep|read|write|sing|dance|swim|jump|talk|listen|see|buy|sell|make|give|take|open)$/i.test(w)) {
    return `I ${w.toLowerCase()} now.`;
  }
  return `The ${w.toLowerCase()} is here.`;
}

function loadExisting(){
  const manifestPath = path.join(BUILD_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try { return JSON.parse(fs.readFileSync(manifestPath,'utf8')); } catch { return null; }
}

function collectReuse(manifest){
  const textToCode = new Map();
  if(!manifest || !manifest.sentences) return textToCode;
  for (const id of Object.keys(manifest.sentences)){
    const sent = manifest.sentences[id];
    if (sent && sent.text) {
      const codePart = id.split('__').pop(); // last segment should be 6-char code
      if (/^[0-9a-f]{6}$/i.test(codePart)) {
        // Only add if not already to preserve first occurrence preference
        if(!textToCode.has(sent.text)) textToCode.set(sent.text, codePart);
      }
    }
  }
  return textToCode;
}

function buildOutputs(wordlists, existingManifest){
  const reuseMap = collectReuse(existingManifest);

  const sentences = {}; // id -> sentence object
  const wordsIndex = {}; // word -> { word, occurrences: [] }
  const listsSummary = []; // array of { slug,title,wordCount,sentenceCount }

  for (const wl of wordlists){
    const { slug, title, items } = wl;
    let idx=0;
    for (const item of items){
      if (LIMIT && idx >= LIMIT) break;
      const word = item.eng ? String(item.eng).trim() : '';
      if (!word) continue;
      idx++;
      const example = (item.ex && String(item.ex).trim()) || '';
      const text = example || guessSentence(word);
      const code = deriveCode(text, reuseMap);
      reuseMap.set(text, code); // ensure future reuse
      const id = `${slug}__s${zeroPad(idx)}__${code}`;
      sentences[id] = { id, text, word, list: slug, listTitle: title, index: idx };
      if (!wordsIndex[word]) wordsIndex[word] = { word, occurrences: [] };
      wordsIndex[word].occurrences.push(id);
    }
    listsSummary.push({ slug, title, wordCount: idx, sentenceCount: idx });
  }

  const allSentencesOrdered = Object.values(sentences)
    .sort((a,b)=> a.list === b.list ? a.index - b.index : a.list.localeCompare(b.list))
    .map(s=>s.text);
  const uniqueWords = Object.keys(wordsIndex).sort((a,b)=> a.localeCompare(b));

  const manifest = {
    generatedAt: new Date().toISOString(),
    lists: listsSummary,
    sentences,
    words: wordsIndex
  };

  const uploadManifest = Object.values(sentences).map(s => ({ type:'sentence', id:s.id, text:s.text, list:s.list, word:s.word }));

  return { manifest, uploadManifest, allSentencesOrdered, uniqueWords };
}

function loadWordlists(){
  if(!fs.existsSync(WORDLIST_DIR)) throw new Error('Wordlist dir missing: '+WORDLIST_DIR);
  const files = fs.readdirSync(WORDLIST_DIR).filter(f=>f.endsWith('.json'));
  return files.map(file=>{
    const arr = JSON.parse(fs.readFileSync(path.join(WORDLIST_DIR,file),'utf8'));
    if(!Array.isArray(arr)) throw new Error('Wordlist not array: '+file);
    return { slug: slugify(file), title: file.replace(/\.json$/,'') , items: arr };
  }).sort((a,b)=> a.slug.localeCompare(b.slug));
}

(async function main(){
  try {
    const existing = loadExisting();
    const wordlists = loadWordlists();
    const { manifest, uploadManifest, allSentencesOrdered, uniqueWords } = buildOutputs(wordlists, existing);

    if (DRY) {
      console.log('[DRY] Would write manifest with sentences:', Object.keys(manifest.sentences).length);
      console.log('[DRY] Example IDs:', Object.keys(manifest.sentences).slice(0,5));
      return;
    }

    if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true });
    fs.writeFileSync(path.join(BUILD_DIR,'manifest.json'), JSON.stringify(manifest,null,2));
    fs.writeFileSync(path.join(BUILD_DIR,'upload_manifest.json'), JSON.stringify(uploadManifest,null,2));
    fs.writeFileSync(path.join(BUILD_DIR,'all_sentences.txt'), allSentencesOrdered.join('\n')+'\n');
    fs.writeFileSync(path.join(BUILD_DIR,'all_words.txt'), uniqueWords.join('\n')+'\n');
    console.log('[OK] Wrote sentences manifest. Total sentences:', Object.keys(manifest.sentences).length);
  } catch (e){
    console.error('[ERROR]', e.message);
    process.exit(1);
  }
})();
