#!/usr/bin/env node
/**
 * Hydrate sentence IDs into wordlist JSON files.
 * 
 * This script:
 * 1. Reads each wordlist JSON from specified directories
 * 2. For each word's example sentence (ex field), upserts to Supabase sentences table
 * 3. Generates audio as sent_<uuid>.mp3 if missing
 * 4. Writes sentence_id back into the JSON file
 * 
 * Usage:
 *   node scripts/hydrate_sentence_ids.js --dirs "Games/english_arcade/sample-wordlists" [--dry-run] [--concurrency 3]
 * 
 * Environment: Requires netlify dev running on localhost:9000 (or 8888)
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Load .env
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnv();

// CLI args
function getArg(name, def) {
  const args = process.argv.slice(2);
  const idx = args.findIndex(a => a === `--${name}` || a.startsWith(`--${name}=`));
  if (idx === -1) return def;
  const raw = args[idx];
  if (raw.includes('=')) return raw.split('=').slice(1).join('=');
  const next = args[idx + 1];
  if (!next || next.startsWith('--')) return true;
  return next;
}

const DRY_RUN = process.argv.includes('--dry-run');
const DDIRS = getArg('dirs', 'Games/english_arcade/sample-wordlists');
const CONCURRENCY = Math.max(1, Math.min(parseInt(getArg('concurrency', '3'), 10) || 3, 8));
const VOICE = getArg('voice', '') || undefined;

const ROOT = process.cwd();
const DIRS = DDIRS.split(',').map(d => path.join(ROOT, d.trim())).filter(Boolean);

// Find running netlify dev server OR use production
const functionCandidates = [
  'http://localhost:9000/.netlify/functions',
  'http://127.0.0.1:9000/.netlify/functions',
  'http://localhost:8888/.netlify/functions',
  'http://127.0.0.1:8888/.netlify/functions',
  'https://willenaenglish.com/.netlify/functions'  // Production fallback
];

async function pickBase() {
  for (const base of functionCandidates) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(base + '/diag_env', { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) return base;
    } catch { /* ignore */ }
  }
  return null;
}

function normText(s) {
  return String(s || '').trim().replace(/\s+/g, ' ');
}

// Collect all wordlist files
function* iterWordlists() {
  for (const dir of DIRS) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      console.warn(`[WARN] Cannot read directory: ${dir}`);
      continue;
    }
    for (const ent of entries) {
      if (!ent.isFile()) continue;
      if (!ent.name.toLowerCase().endsWith('.json')) continue;
      const full = path.join(dir, ent.name);
      yield { file: full, name: ent.name };
    }
  }
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('=== Hydrate Sentence IDs ===\n');
  console.log(`Directories: ${DIRS.join(', ')}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Concurrency: ${CONCURRENCY}\n`);

  const base = await pickBase();
  if (!base) {
    console.error('[ERROR] No netlify dev server found. Please start it with: netlify dev');
    process.exit(1);
  }
  console.log(`Using functions base: ${base}\n`);

  const summary = {
    filesProcessed: 0,
    filesModified: 0,
    sentencesUpserted: 0,
    audioGenerated: 0,
    audioReused: 0,
    errors: 0
  };

  // Collect all files first
  const files = [...iterWordlists()];
  console.log(`Found ${files.length} wordlist files to process.\n`);

  for (const { file, name } of files) {
    console.log(`\n--- Processing: ${name} ---`);
    
    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.warn(`[WARN] Skipping invalid JSON: ${file}`, e.message);
      continue;
    }

    const list = Array.isArray(data) ? data : (Array.isArray(data?.words) ? data.words : []);
    if (!list.length) {
      console.log(`  No words found, skipping.`);
      continue;
    }

    summary.filesProcessed++;
    let modified = false;

    // Collect sentences to upsert in batch
    const sentencesToUpsert = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const sentence = normText(item.ex || item.example || item.sentence);
      const word = String(item.eng || item.word || '').trim();
      
      if (!sentence || sentence.split(/\s+/).length < 3) continue;
      if (item.sentence_id) continue; // Already has ID
      
      sentencesToUpsert.push({ text: sentence, words: word ? [word] : [], item });
    }

    if (!sentencesToUpsert.length) {
      console.log(`  All items already have sentence_id or no valid sentences.`);
      continue;
    }

    console.log(`  Upserting ${sentencesToUpsert.length} sentences...`);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] Would upsert ${sentencesToUpsert.length} sentences`);
      sentencesToUpsert.forEach(s => console.log(`    - "${s.text.slice(0, 50)}..."`));
      continue;
    }

    // Send to upsert_sentences_batch in chunks
    const CHUNK_SIZE = 50;
    for (let i = 0; i < sentencesToUpsert.length; i += CHUNK_SIZE) {
      const chunk = sentencesToUpsert.slice(i, i + CHUNK_SIZE);
      const payload = {
        action: 'upsert_sentences_batch',
        sentences: chunk.map(c => ({ text: c.text, words: c.words })),
        skip_audio: false
      };
      if (VOICE) payload.voice_id = VOICE;

      try {
        const res = await fetch(base + '/upsert_sentences_batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          console.warn(`  [ERR] HTTP ${res.status} for chunk ${i}-${i + chunk.length}`);
          summary.errors++;
          continue;
        }

        const result = await res.json();
        if (!result.success) {
          console.warn(`  [ERR] Batch failed for chunk ${i}-${i + chunk.length}`);
          summary.errors++;
          continue;
        }

        // Map returned sentence IDs back to items
        const returnedSentences = result.sentences || [];
        for (const returned of returnedSentences) {
          // Find matching item in chunk by text
          const match = chunk.find(c => normText(c.text) === normText(returned.text));
          if (match && returned.id) {
            match.item.sentence_id = returned.id;
            modified = true;
            summary.sentencesUpserted++;
          }
        }

        // Track audio stats
        if (result.audio) {
          summary.audioGenerated += result.audio.generated || 0;
          summary.audioReused += result.audio.reused || 0;
        }

        console.log(`  Chunk ${i + 1}-${Math.min(i + CHUNK_SIZE, sentencesToUpsert.length)}: ${returnedSentences.length} IDs returned`);
        
        // Small delay between chunks to avoid overwhelming the server
        if (i + CHUNK_SIZE < sentencesToUpsert.length) {
          await delay(500);
        }
      } catch (e) {
        console.warn(`  [ERR] Request failed for chunk: ${e.message}`);
        summary.errors++;
      }
    }

    // Write back to file if modified
    if (modified) {
      try {
        const output = Array.isArray(data) ? list : { ...data, words: list };
        fs.writeFileSync(file, JSON.stringify(output, null, 2) + '\n');
        summary.filesModified++;
        console.log(`  ✓ Updated ${file}`);
      } catch (e) {
        console.warn(`  [ERR] Failed to write file: ${e.message}`);
        summary.errors++;
      }
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Files processed:    ${summary.filesProcessed}`);
  console.log(`Files modified:     ${summary.filesModified}`);
  console.log(`Sentences upserted: ${summary.sentencesUpserted}`);
  console.log(`Audio generated:    ${summary.audioGenerated}`);
  console.log(`Audio reused:       ${summary.audioReused}`);
  console.log(`Errors:             ${summary.errors}`);

  if (DRY_RUN) {
    console.log('\n(Dry run - no changes were made)');
  }
}

main().catch(e => {
  console.error('[FATAL]', e);
  process.exit(1);
});
