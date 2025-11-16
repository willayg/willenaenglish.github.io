// Normalize Level 2 grammar JSON files to a consistent schema
// Target dir: Games/english_arcade/data/grammar/level2/*.json
// Schema per item (fields optional when not derivable):
// {
//   id: string,
//   word: string,
//   en: string,
//   ko: string,
//   exampleSentence: string,
//   exampleSentenceKo: string,
//   emoji: string,
//   article: string
// }

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const TARGET_DIR = path.join(ROOT, 'Games', 'english_arcade', 'data', 'grammar', 'level2');

function slugify(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

function firstNWords(s, n = 3) {
  const words = String(s || '').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, n).join(' ');
}

function pick(obj, keys) {
  for (const k of keys) {
    const v = obj && obj[k];
    if (typeof v === 'string' && v.trim()) return String(v).trim();
  }
  return '';
}

function normalizeItem(it, idx, usedIds) {
  const out = { ...it };

  // Prefer core sentence and translation
  const en = pick(it, ['en', 'sentence', 'exampleSentence', 'example']);
  const ko = pick(it, ['ko', 'kor', 'korean']);

  // Example sentence text (fallback to en if not provided)
  const exampleSentence = pick(it, ['exampleSentence', 'example', 'sentence']) || en;
  const exampleSentenceKo = pick(it, ['exampleSentenceKo', 'sentence_kor', 'sentenceKor', 'kor_sentence', 'korean_sentence', 'example_kor', 'ex_kor', 'translation_ko']) || ko;

  // ID: keep existing if sane, else derive from en
  let id = String(it.id || '').trim();
  if (!id) {
    const base = slugify(firstNWords(en, 4)) || `row_${idx + 1}`;
    id = base;
  }
  // Ensure unique per file
  let uniqueId = id;
  let bump = 1;
  while (usedIds.has(uniqueId)) {
    uniqueId = `${id}_${++bump}`;
  }
  usedIds.add(uniqueId);

  // word: keep if present; else derive from first 2 words
  const word = String(it.word || '').trim() || slugify(firstNWords(en, 2)) || uniqueId;

  // emoji: keep if provided
  const emoji = typeof it.emoji === 'string' && it.emoji ? it.emoji : it.emoji ? it.emoji : undefined;

  // article: pass through if provided
  const article = typeof it.article === 'string' && it.article.trim() ? it.article : undefined;

  return {
    id: uniqueId,
    word,
    en,
    ko,
    exampleSentence,
    exampleSentenceKo,
    ...(emoji ? { emoji } : {}),
    ...(article ? { article } : {}),
  };
}

function normalizeFile(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return { file: filePath, ok: false, error: `read: ${e.message}` };
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    return { file: filePath, ok: false, error: `json: ${e.message}` };
  }
  if (!Array.isArray(data)) {
    return { file: filePath, ok: false, error: 'not an array' };
  }
  const used = new Set();
  const normalized = data.map((it, i) => normalizeItem(it || {}, i, used));
  const pretty = JSON.stringify(normalized, null, 2) + '\n';
  try {
    fs.writeFileSync(filePath, pretty, 'utf8');
  } catch (e) {
    return { file: filePath, ok: false, error: `write: ${e.message}` };
  }
  return { file: filePath, ok: true, count: normalized.length };
}

function main() {
  if (!fs.existsSync(TARGET_DIR)) {
    console.error('[normalize] Missing dir:', TARGET_DIR);
    process.exit(1);
  }
  const files = fs.readdirSync(TARGET_DIR).filter(f => f.toLowerCase().endsWith('.json'));
  let ok = 0, fail = 0;
  files.forEach(f => {
    const full = path.join(TARGET_DIR, f);
    const res = normalizeFile(full);
    if (res.ok) { ok++; console.log('✔', path.basename(full), '-', res.count, 'items'); }
    else { fail++; console.warn('✖', path.basename(full), '-', res.error); }
  });
  console.log(`Done. ${ok} ok, ${fail} failed.`);
}

if (require.main === module) main();
