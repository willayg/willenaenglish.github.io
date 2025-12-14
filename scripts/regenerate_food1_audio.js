#!/usr/bin/env node
/**
 * Regenerate sentence audio for Food1.json wordlist using ElevenLabs.
 * This script directly calls ElevenLabs API and uploads to R2, bypassing Netlify functions.
 * 
 * Usage: node scripts/regenerate_food1_audio.js [--dry-run]
 * 
 * Environment required: .env file with ELEVEN_LABS_API_KEY, ELEVEN_LABS_DEFAULT_VOICE_ID, R2_* vars
 */

const fs = require('fs');
const path = require('path');

// Load .env file manually (no dotenv dependency)
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.warn('.env file not found');
    return;
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
loadEnv();
const fetch = require('node-fetch');
const { S3Client, HeadObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

// Config from environment
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_VOICE_ID = process.env.ELEVEN_LABS_DEFAULT_VOICE_ID;
const ELEVEN_LABS_MODEL_ID = process.env.ELEVEN_LABS_MODEL_ID || 'eleven_multilingual_v2';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'tts-audio';

// Voice settings for clarity
const VOICE_SETTINGS = {
  stability: 1.0,
  similarity_boost: 1.0,
  style: 0.0,
  use_speaker_boost: false
};

// Path to Food1.json
const FOOD1_PATH = path.join(__dirname, '..', 'Games', 'english_arcade', 'sample-wordlists', 'Food1.json');

// Initialize R2/S3 client
const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

function normalizeWord(w) {
  return String(w || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '');
}

async function checkExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadToR2(key, audioBuffer) {
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: audioBuffer,
    ContentType: 'audio/mpeg',
    CacheControl: 'public, max-age=31536000, immutable'
  }));
}

async function generateAudio(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_LABS_VOICE_ID}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: text,
      model_id: ELEVEN_LABS_MODEL_ID,
      voice_settings: VOICE_SETTINGS
    })
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`ElevenLabs API error ${response.status}: ${errText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('=== Regenerate Food1 Sentence Audio ===\n');
  
  // Validate environment
  if (!ELEVEN_LABS_API_KEY) {
    console.error('Missing ELEVEN_LABS_API_KEY');
    process.exit(1);
  }
  if (!ELEVEN_LABS_VOICE_ID) {
    console.error('Missing ELEVEN_LABS_DEFAULT_VOICE_ID');
    process.exit(1);
  }
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) {
    console.error('Missing R2 credentials');
    process.exit(1);
  }

  // Load Food1.json
  if (!fs.existsSync(FOOD1_PATH)) {
    console.error('Food1.json not found at:', FOOD1_PATH);
    process.exit(1);
  }

  const food1Data = JSON.parse(fs.readFileSync(FOOD1_PATH, 'utf8'));
  console.log(`Loaded ${food1Data.length} words from Food1.json\n`);

  const summary = {
    total: food1Data.length,
    generated: 0,
    skipped: 0,
    errors: 0
  };

  for (let i = 0; i < food1Data.length; i++) {
    const item = food1Data[i];
    const word = item.eng;
    const sentence = item.ex; // example sentence field
    
    if (!word || !sentence) {
      console.log(`[SKIP] ${word || 'unknown'}: no sentence`);
      summary.skipped++;
      continue;
    }

    const key = `${normalizeWord(word)}_sentence.mp3`;
    
    // Check if exists and skip if not forcing
    if (!FORCE) {
      const exists = await checkExists(key);
      if (exists) {
        console.log(`[EXISTS] ${key} - skipping (use --force to regenerate)`);
        summary.skipped++;
        continue;
      }
    }

    if (DRY_RUN) {
      console.log(`[DRY-RUN] Would generate: ${key}`);
      console.log(`          Sentence: "${sentence}"`);
      summary.generated++;
      continue;
    }

    try {
      console.log(`[${i + 1}/${food1Data.length}] Generating: ${key}`);
      console.log(`    Sentence: "${sentence}"`);
      
      const audioBuffer = await generateAudio(sentence);
      await uploadToR2(key, audioBuffer);
      
      console.log(`    ✓ Uploaded ${(audioBuffer.length / 1024).toFixed(1)} KB`);
      summary.generated++;
      
      // Rate limit: small delay between API calls
      if (i < food1Data.length - 1) {
        await delay(500);
      }
    } catch (err) {
      console.error(`    ✗ Error: ${err.message}`);
      summary.errors++;
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total words: ${summary.total}`);
  console.log(`Generated:   ${summary.generated}`);
  console.log(`Skipped:     ${summary.skipped}`);
  console.log(`Errors:      ${summary.errors}`);
  
  if (DRY_RUN) {
    console.log('\n(Dry run - no files were actually created)');
  }
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
