#!/usr/bin/env node
/*
  Audit R2 audio coverage for English Arcade default lists.

  What it checks:
  - Word audio presence for each unique `eng` token (via get_audio_urls)
  - Sentence audio presence for each sentence ID (via get_sentence_audio_urls or get_audio_urls for local_* IDs)

  Usage examples:
  node scripts/audit-r2-audio-coverage.js
  node scripts/audit-r2-audio-coverage.js --base-url https://staging.willenaenglish.com
  node scripts/audit-r2-audio-coverage.js --audio-base-url https://api.willenaenglish.com --sentence-base-url https://willena-proxy.willena.workers.dev
  node scripts/audit-r2-audio-coverage.js --out docs/reports/r2-audio-audit.json

  Notes:
  - This script is read-only. It does not generate audio.
  - Requires Node.js 18+ (built-in fetch).
*/

const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();
const DEFAULT_DIRS = [
  'sample-wordlists',
  'sample-wordlists-level2',
  'sample-wordlists-level3',
  'sample-wordlists-level4',
  'sample-wordlists-level5'
];

function parseArgs(argv) {
  const args = {
    baseUrl: '',
    audioBaseUrl: '',
    sentenceBaseUrl: '',
    out: 'docs/reports/r2-audio-audit.json',
    chunk: 100
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base-url' && argv[i + 1]) {
      args.baseUrl = String(argv[++i]).trim();
    } else if (a === '--audio-base-url' && argv[i + 1]) {
      args.audioBaseUrl = String(argv[++i]).trim();
    } else if (a === '--sentence-base-url' && argv[i + 1]) {
      args.sentenceBaseUrl = String(argv[++i]).trim();
    } else if (a === '--out' && argv[i + 1]) {
      args.out = String(argv[++i]).trim();
    } else if (a === '--chunk' && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) args.chunk = Math.floor(n);
    }
  }
  if (!args.baseUrl) {
    const env = process.env.EA_AUDIT_BASE_URL || process.env.BASE_URL || '';
    args.baseUrl = String(env).trim();
  }
  if (!args.audioBaseUrl) {
    args.audioBaseUrl = args.baseUrl || process.env.EA_AUDIT_AUDIO_BASE_URL || 'https://api.willenaenglish.com';
  }
  if (!args.sentenceBaseUrl) {
    args.sentenceBaseUrl = args.baseUrl || process.env.EA_AUDIT_SENTENCE_BASE_URL || 'https://willena-proxy.willena.workers.dev';
  }
  args.audioBaseUrl = String(args.audioBaseUrl).replace(/\/$/, '');
  args.sentenceBaseUrl = String(args.sentenceBaseUrl).replace(/\/$/, '');
  return args;
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listJsonFiles(dirAbs) {
  const out = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(current, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) {
        out.push(abs);
      }
    }
  }
  await walk(dirAbs);
  return out;
}

function normalizeWord(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${url} ${txt.slice(0, 240)}`);
  }
  return res.json();
}

async function postJsonWithFallback(urls, body) {
  let lastErr = null;
  for (const url of urls) {
    try {
      return await postJson(url, body);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All endpoint attempts failed');
}

function safeLevelFromPath(relPath) {
  const first = relPath.split(/[\\/]/)[0] || 'unknown';
  return first;
}

async function main() {
  const args = parseArgs(process.argv);

  const jsonFiles = [];
  for (const d of DEFAULT_DIRS) {
    const abs = path.join(ROOT, d);
    if (!(await fileExists(abs))) continue;
    const found = await listJsonFiles(abs);
    jsonFiles.push(...found);
  }

  if (!jsonFiles.length) {
    throw new Error('No JSON files found under sample-wordlists directories.');
  }

  const wordsToFiles = new Map();
  const sentenceIdsToFiles = new Map();

  for (const abs of jsonFiles) {
    const rel = path.relative(ROOT, abs).replace(/\\/g, '/');
    const raw = await fs.readFile(abs, 'utf8');
    let arr;
    try {
      arr = JSON.parse(raw);
    } catch (e) {
      throw new Error(`Invalid JSON: ${rel} (${e.message})`);
    }
    if (!Array.isArray(arr)) continue;

    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;

      const eng = normalizeWord(item.eng);
      if (eng) {
        if (!wordsToFiles.has(eng)) wordsToFiles.set(eng, new Set());
        wordsToFiles.get(eng).add(rel);
      }

      const sidDirect = String(item.primary_sentence_id || item.sentence_id || '').trim();
      const sids = new Set();
      if (sidDirect) sids.add(sidDirect);
      if (Array.isArray(item.sentences)) {
        for (const s of item.sentences) {
          const sid = String((s && s.id) || '').trim();
          if (sid) sids.add(sid);
        }
      }
      for (const sid of sids) {
        if (!sentenceIdsToFiles.has(sid)) sentenceIdsToFiles.set(sid, new Set());
        sentenceIdsToFiles.get(sid).add(rel);
      }
    }
  }

  const words = Array.from(wordsToFiles.keys());
  const sentenceIds = Array.from(sentenceIdsToFiles.keys());
  const localSentenceIds = sentenceIds.filter(id => /^local_/i.test(id));
  const persistentSentenceIds = sentenceIds.filter(id => !/^local_/i.test(id));

  const wordResults = {};
  for (const batch of chunk(words, args.chunk)) {
    const data = await postJsonWithFallback([
      `${args.audioBaseUrl}/.netlify/functions/get_audio_urls`,
      `${args.sentenceBaseUrl}/.netlify/functions/get_audio_urls`
    ], { words: batch });
    const results = data && data.results ? data.results : {};
    for (const k of batch) wordResults[k] = results[k] || { exists: false };
  }

  const sentenceResults = {};
  for (const batch of chunk(persistentSentenceIds, args.chunk)) {
    const data = await postJsonWithFallback([
      `${args.sentenceBaseUrl}/.netlify/functions/get_sentence_audio_urls`,
      `${args.audioBaseUrl}/.netlify/functions/get_sentence_audio_urls`
    ], { sentence_ids: batch });
    const results = data && data.results ? data.results : {};
    for (const sid of batch) sentenceResults[sid] = results[sid] || { exists: false };
  }

  if (localSentenceIds.length) {
    const localKeys = [];
    const keyToSid = new Map();
    for (const sid of localSentenceIds) {
      const k1 = `sent_${sid}.mp3`;
      const k2 = `sent_${sid}`;
      localKeys.push(k1, k2);
      keyToSid.set(k1, sid);
      keyToSid.set(k2, sid);
    }
    const localKeyResults = {};
    for (const batch of chunk(localKeys, args.chunk)) {
      const data = await postJsonWithFallback([
        `${args.audioBaseUrl}/.netlify/functions/get_audio_urls`,
        `${args.sentenceBaseUrl}/.netlify/functions/get_audio_urls`
      ], { words: batch });
      const results = data && data.results ? data.results : {};
      for (const k of batch) localKeyResults[k] = results[k] || { exists: false };
    }
    for (const sid of localSentenceIds) {
      const k1 = `sent_${sid}.mp3`;
      const k2 = `sent_${sid}`;
      const r = localKeyResults[k1] || localKeyResults[k2] || { exists: false };
      sentenceResults[sid] = r;
    }
  }

  const missingWords = words
    .filter(w => !(wordResults[w] && wordResults[w].exists))
    .map(w => ({ word: w, files: Array.from(wordsToFiles.get(w) || []) }));

  const missingSentenceAudio = sentenceIds
    .filter(sid => !(sentenceResults[sid] && sentenceResults[sid].exists))
    .map(sid => ({ sentence_id: sid, files: Array.from(sentenceIdsToFiles.get(sid) || []) }));

  const missingByLevel = {};
  for (const row of missingSentenceAudio) {
    for (const rel of row.files) {
      const lvl = safeLevelFromPath(rel);
      missingByLevel[lvl] = missingByLevel[lvl] || { missing_sentence_audio: 0, missing_word_audio: 0 };
      missingByLevel[lvl].missing_sentence_audio++;
    }
  }
  for (const row of missingWords) {
    for (const rel of row.files) {
      const lvl = safeLevelFromPath(rel);
      missingByLevel[lvl] = missingByLevel[lvl] || { missing_sentence_audio: 0, missing_word_audio: 0 };
      missingByLevel[lvl].missing_word_audio++;
    }
  }

  const report = {
    generated_at: new Date().toISOString(),
    endpoints: {
      audio_base_url: args.audioBaseUrl,
      sentence_base_url: args.sentenceBaseUrl
    },
    totals: {
      list_files: jsonFiles.length,
      unique_words: words.length,
      unique_sentence_ids: sentenceIds.length,
      missing_word_audio: missingWords.length,
      missing_sentence_audio: missingSentenceAudio.length
    },
    missing_by_level: missingByLevel,
    missing_word_audio: missingWords,
    missing_sentence_audio: missingSentenceAudio
  };

  const outAbs = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, JSON.stringify(report, null, 2), 'utf8');

  console.log('R2 audio audit complete.');
  console.log(`Lists: ${report.totals.list_files}`);
  console.log(`Unique words: ${report.totals.unique_words}`);
  console.log(`Unique sentence IDs: ${report.totals.unique_sentence_ids}`);
  console.log(`Missing word audio: ${report.totals.missing_word_audio}`);
  console.log(`Missing sentence audio: ${report.totals.missing_sentence_audio}`);
  console.log(`Report: ${path.relative(ROOT, outAbs).replace(/\\/g, '/')}`);

  if (report.totals.missing_word_audio || report.totals.missing_sentence_audio) {
    process.exitCode = 2;
  }
}

main().catch(err => {
  console.error('R2 audio audit failed:', err.message || err);
  process.exit(1);
});
