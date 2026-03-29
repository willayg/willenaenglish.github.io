#!/usr/bin/env node
/*
  Backfill missing R2 audio keys from the audit report.

  Source report default:
    docs/reports/r2-audio-audit.json

  Safe usage:
    node scripts/backfill-missing-r2-audio.js --dry-run
    node scripts/backfill-missing-r2-audio.js --mode sentence --limit 20

  Full run examples:
    node scripts/backfill-missing-r2-audio.js --mode sentence
    node scripts/backfill-missing-r2-audio.js --mode all

  Notes:
  - Uses eleven_labs_proxy to synthesize audio.
  - Uses upload_audio to write object keys into R2.
  - For sentence IDs, uploads key name sent_<sentence_id>.mp3 via upload_audio word="sent_<sentence_id>".
*/

const fs = require('fs/promises');
const path = require('path');

const ROOT = process.cwd();

function parseArgs(argv) {
  const args = {
    report: 'docs/reports/r2-audio-audit.json',
    mode: 'sentence', // sentence | word | all
    dryRun: false,
    limit: 0,
    // Lookup endpoints (same defaults as audit script)
    lookupAudioBaseUrl: process.env.EA_AUDIT_AUDIO_BASE_URL || 'https://api.willenaenglish.com',
    lookupSentenceBaseUrl: process.env.EA_AUDIT_SENTENCE_BASE_URL || 'https://willena-proxy.willena.workers.dev',
    // Generation/upload endpoint (Netlify-hosted functions with Eleven/R2 env)
    generateBaseUrl: process.env.EA_BACKFILL_BASE_URL || 'https://staging.willenaenglish.com',
    timeoutMs: Number(process.env.EA_BACKFILL_TIMEOUT_MS || 45000)
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--report' && argv[i + 1]) args.report = String(argv[++i]).trim();
    else if (a === '--mode' && argv[i + 1]) args.mode = String(argv[++i]).trim().toLowerCase();
    else if (a === '--limit' && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) args.limit = Math.floor(n);
    }
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--lookup-audio-base-url' && argv[i + 1]) args.lookupAudioBaseUrl = String(argv[++i]).trim();
    else if (a === '--lookup-sentence-base-url' && argv[i + 1]) args.lookupSentenceBaseUrl = String(argv[++i]).trim();
    else if (a === '--generate-base-url' && argv[i + 1]) args.generateBaseUrl = String(argv[++i]).trim();
    else if (a === '--timeout-ms' && argv[i + 1]) {
      const n = Number(argv[++i]);
      if (Number.isFinite(n) && n > 0) args.timeoutMs = Math.floor(n);
    }
  }

  if (!['sentence', 'word', 'all'].includes(args.mode)) {
    throw new Error('Invalid --mode. Use sentence, word, or all.');
  }

  args.lookupAudioBaseUrl = args.lookupAudioBaseUrl.replace(/\/$/, '');
  args.lookupSentenceBaseUrl = args.lookupSentenceBaseUrl.replace(/\/$/, '');
  args.generateBaseUrl = args.generateBaseUrl.replace(/\/$/, '');

  return args;
}

async function readJson(absPath) {
  const raw = await fs.readFile(absPath, 'utf8');
  return JSON.parse(raw);
}

async function postJson(url, body, timeoutMs = 45000) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      };
      if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        init.signal = AbortSignal.timeout(timeoutMs);
      }
      const res = await fetch(url, init);
      const txt = await res.text().catch(() => '');
      let js = null;
      try { js = txt ? JSON.parse(txt) : null; } catch { js = null; }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url} ${(txt || '').slice(0, 220)}`);
      return js;
    } catch (e) {
      lastErr = e;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }
  throw lastErr;
}

function getSentenceTextFromItem(item, targetSid) {
  if (!item || typeof item !== 'object') return '';
  const sid = String(item.primary_sentence_id || item.sentence_id || '').trim();
  if (sid && targetSid && sid === targetSid) {
    const direct = [item.ex, item.example, item.sentence, item.legacy_sentence].find(v => typeof v === 'string' && v.trim());
    if (direct) return String(direct).trim();
  }
  if (Array.isArray(item.sentences)) {
    const sObj = item.sentences.find(s => s && String(s.id || '').trim() === targetSid);
    if (sObj && typeof sObj.text === 'string' && sObj.text.trim()) return sObj.text.trim();
  }
  // Fallback for flat rows where sid matched but sentence text is still on ex/example
  const fallback = [item.ex, item.example, item.sentence, item.legacy_sentence].find(v => typeof v === 'string' && v.trim());
  return fallback ? String(fallback).trim() : '';
}

async function resolveSentenceSource(rootAbs, sentenceId, files) {
  for (const rel of files || []) {
    const abs = path.join(rootAbs, rel);
    let arr;
    try { arr = await readJson(abs); } catch { continue; }
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const sid = String(item.primary_sentence_id || item.sentence_id || '').trim();
      const inSentArray = Array.isArray(item.sentences) && item.sentences.some(s => s && String(s.id || '').trim() === sentenceId);
      if (sid === sentenceId || inSentArray) {
        const text = getSentenceTextFromItem(item, sentenceId);
        const eng = String(item.eng || '').trim();
        if (text) return { text, eng, file: rel };
      }
    }
  }
  return null;
}

async function verifySentenceExists(args, sentenceId) {
  const isLocal = /^local_/i.test(String(sentenceId || '').trim());
  if (isLocal) {
    const keys = [`sent_${sentenceId}.mp3`, `sent_${sentenceId}`];
    const js = await postJson(`${args.lookupAudioBaseUrl}/.netlify/functions/get_audio_urls`, { words: keys }, args.timeoutMs);
    const map = (js && js.results) || {};
    const hit = map[keys[0]] || map[keys[1]];
    return !!(hit && hit.exists);
  }
  const js = await postJson(`${args.lookupSentenceBaseUrl}/.netlify/functions/get_sentence_audio_urls`, { sentence_ids: [sentenceId] }, args.timeoutMs);
  const rec = js && js.results ? js.results[sentenceId] : null;
  return !!(rec && rec.exists);
}

async function verifyWordExists(args, wordKey) {
  const js = await postJson(`${args.lookupAudioBaseUrl}/.netlify/functions/get_audio_urls`, { words: [wordKey] }, args.timeoutMs);
  const rec = js && js.results ? js.results[wordKey] : null;
  return !!(rec && rec.exists);
}

async function synthesizeText(args, text) {
  const js = await postJson(`${args.generateBaseUrl}/.netlify/functions/eleven_labs_proxy`, { text }, args.timeoutMs);
  if (!js || !js.audio) throw new Error('eleven_labs_proxy missing audio field');
  return js.audio;
}

async function uploadKey(args, keyBase, base64Audio) {
  return postJson(`${args.generateBaseUrl}/.netlify/functions/upload_audio`, {
    word: keyBase,
    fileDataBase64: base64Audio
  }, args.timeoutMs);
}

async function backfillSentences(args, report) {
  const missing = Array.isArray(report.missing_sentence_audio) ? report.missing_sentence_audio.slice() : [];
  const targets = args.limit > 0 ? missing.slice(0, args.limit) : missing;

  let attempted = 0;
  let success = 0;
  let failed = 0;
  const failures = [];

  for (const row of targets) {
    const sid = String(row && row.sentence_id || '').trim();
    if (!sid) continue;
    attempted++;

    try {
      const source = await resolveSentenceSource(ROOT, sid, row.files || []);
      if (!source || !source.text) throw new Error('Could not resolve sentence text from listed files');

      if (args.dryRun) {
        console.log(`[DRY] sentence_id=${sid} key=sent_${sid}.mp3 file=${source.file}`);
        success++;
        continue;
      }

      const audioBase64 = await synthesizeText(args, source.text);
      await uploadKey(args, `sent_${sid}`, audioBase64);
      const exists = await verifySentenceExists(args, sid);
      if (!exists) throw new Error('Uploaded but verify failed');
      success++;
      console.log(`OK sentence_id=${sid}`);
    } catch (e) {
      failed++;
      failures.push({ sentence_id: sid, error: e.message || String(e) });
      console.log(`FAIL sentence_id=${sid} ${(e && e.message) || e}`);
    }
  }

  return { attempted, success, failed, failures };
}

async function backfillWords(args, report) {
  const missing = Array.isArray(report.missing_word_audio) ? report.missing_word_audio.slice() : [];
  const targets = args.limit > 0 ? missing.slice(0, args.limit) : missing;

  let attempted = 0;
  let success = 0;
  let failed = 0;
  const failures = [];

  for (const row of targets) {
    const wordKey = String(row && row.word || '').trim().toLowerCase();
    if (!wordKey) continue;
    attempted++;

    try {
      const textForTTS = wordKey.replace(/_/g, ' ');

      if (args.dryRun) {
        console.log(`[DRY] word=${wordKey}`);
        success++;
        continue;
      }

      const audioBase64 = await synthesizeText(args, textForTTS);
      await uploadKey(args, wordKey, audioBase64);
      const exists = await verifyWordExists(args, wordKey);
      if (!exists) throw new Error('Uploaded but verify failed');
      success++;
      console.log(`OK word=${wordKey}`);
    } catch (e) {
      failed++;
      failures.push({ word: wordKey, error: e.message || String(e) });
      console.log(`FAIL word=${wordKey} ${(e && e.message) || e}`);
    }
  }

  return { attempted, success, failed, failures };
}

async function main() {
  const args = parseArgs(process.argv);
  const reportAbs = path.isAbsolute(args.report) ? args.report : path.join(ROOT, args.report);
  const report = await readJson(reportAbs);

  console.log('Backfill start');
  console.log(`Mode: ${args.mode}`);
  console.log(`Dry-run: ${args.dryRun}`);
  console.log(`Report: ${path.relative(ROOT, reportAbs).replace(/\\/g, '/')}`);
  console.log(`Generate base: ${args.generateBaseUrl}`);
  console.log(`Lookup audio base: ${args.lookupAudioBaseUrl}`);
  console.log(`Lookup sentence base: ${args.lookupSentenceBaseUrl}`);

  const summary = {
    generated_at: new Date().toISOString(),
    mode: args.mode,
    dry_run: args.dryRun,
    sentence: null,
    word: null
  };

  if (args.mode === 'sentence' || args.mode === 'all') {
    summary.sentence = await backfillSentences(args, report);
  }
  if (args.mode === 'word' || args.mode === 'all') {
    summary.word = await backfillWords(args, report);
  }

  const outRel = `docs/reports/r2-audio-backfill-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const outAbs = path.join(ROOT, outRel);
  await fs.mkdir(path.dirname(outAbs), { recursive: true });
  await fs.writeFile(outAbs, JSON.stringify(summary, null, 2), 'utf8');

  console.log('Backfill complete');
  if (summary.sentence) {
    console.log(`Sentence: attempted=${summary.sentence.attempted} success=${summary.sentence.success} failed=${summary.sentence.failed}`);
  }
  if (summary.word) {
    console.log(`Word: attempted=${summary.word.attempted} success=${summary.word.success} failed=${summary.word.failed}`);
  }
  console.log(`Summary report: ${outRel}`);

  const failed = (summary.sentence && summary.sentence.failed) || 0;
  const failedW = (summary.word && summary.word.failed) || 0;
  if (!args.dryRun && (failed > 0 || failedW > 0)) {
    process.exitCode = 2;
  }
}

main().catch(err => {
  console.error('Backfill failed:', err.message || err);
  process.exit(1);
});
