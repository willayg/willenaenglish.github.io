#!/usr/bin/env node
/**
 * Phonics Audio Generator - Generate audio files for all phonics lists
 * and auto-upload to R2
 * 
 * Usage:
 *   node generate-phonics-audio.js [--dry-run] [--voice VOICE_ID]
 * 
 * Reads from .env file automatically
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// Load .env file
function loadEnv() {
  const envPath = path.join(__dirname, '..', '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(`.env file not found at ${envPath}`);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...valueParts] = trimmed.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });
  return env;
}

const envVars = loadEnv();
Object.assign(process.env, envVars);

// Parse arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const voiceArg = args.find(a => a.startsWith('--voice='));
const VOICE_ID = voiceArg ? voiceArg.split('=')[1] : process.env.ELEVEN_LABS_DEFAULT_VOICE_ID;
const API_KEY = process.env.ELEVEN_LABS_API_KEY;

// R2 config
const r2Config = {
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  endpoint: process.env.R2_ENDPOINT,
};

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'willena-files';
const s3 = new S3Client(r2Config);

// Find all phonics JSON files
function findPhonicsLists() {
  const basePath = path.join(__dirname, 'phonics-lists');
  const files = [];
  
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(full);
      }
    }
  }
  
  walk(basePath);
  return files;
}

// Normalize word for file naming
function normalizeWord(w) {
  return String(w || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '');
}

// Generate audio via 11 Labs
async function generateAudio(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: {
        stability: 1.0,
        similarity_boost: 1.0,
        style: 1.0,
        use_speaker_boost: false
      }
    });

    const options = {
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${VOICE_ID}`,
      method: 'POST',
      headers: {
        'xi-api-key': API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`ElevenLabs API error: ${res.statusCode}`));
          return;
        }
        // Combine chunks into buffer (already binary audio data)
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Check if file exists in R2
async function fileExistsInR2(fileName) {
  const key = `${fileName}.mp3`;
  try {
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: key
    });
    await s3.send(command);
    return true;
  } catch (e) {
    // File doesn't exist (404 or similar)
    return false;
  }
}

// Upload to R2
async function uploadToR2(fileName, buffer) {
  const key = `${fileName}.mp3`;
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: 'audio/mpeg'
  });

  await s3.send(command);
  return key;
}

// Generate prompt for word
function getWordPrompt(word) {
  const templates = [
    `The word is "${word}"...`,
    `This one is "${word}"...`,
    `Can you say "${word}"?`,
    `Try the word "${word}"...`,
    `Listen: "${word}".`
  ];
  let h = 0;
  for (let i = 0; i < word.length; i++) {
    h = (h * 31 + word.charCodeAt(i)) >>> 0;
  }
  return templates[h % templates.length];
}

// Generate prompt for sentence
function getSentencePrompt(sentence) {
  const templates = [
    `Listen: ${sentence}`,
    `Here's an example: ${sentence}`,
    `${sentence}`,
    `Try this: ${sentence}`
  ];
  let h = 0;
  for (let i = 0; i < sentence.length; i++) {
    h = (h * 31 + sentence.charCodeAt(i)) >>> 0;
  }
  return templates[h % templates.length];
}

// Main function
async function main() {
  console.log('🎵 Phonics Audio Generator\n');

  if (!API_KEY) {
    console.error('❌ Error: ELEVEN_LABS_API_KEY not set');
    process.exit(1);
  }
  if (!VOICE_ID) {
    console.error('❌ Error: ELEVEN_LABS_DEFAULT_VOICE_ID not set or passed');
    process.exit(1);
  }
  if (!process.env.R2_ACCESS_KEY_ID) {
    console.error('❌ Error: R2_ACCESS_KEY_ID not set');
    process.exit(1);
  }

  console.log(`✓ API Key: ${API_KEY.slice(0, 10)}...`);
  console.log(`✓ Voice ID: ${VOICE_ID}`);
  console.log(`✓ R2 Bucket: ${R2_BUCKET}`);
  console.log(`✓ Dry Run: ${DRY_RUN}\n`);

  const jsonFiles = findPhonicsLists();
  console.log(`📁 Found ${jsonFiles.length} phonics list files:\n`);

  let totalWords = 0;
  let totalGenerated = 0;
  let totalErrors = 0;

  for (const jsonFile of jsonFiles) {
    const relPath = path.relative(__dirname, jsonFile);
    console.log(`📄 Processing: ${relPath}`);

    let data;
    try {
      data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    } catch (e) {
      console.error(`  ❌ Parse error: ${e.message}`);
      continue;
    }

    if (!Array.isArray(data)) {
      console.error(`  ❌ Not an array`);
      continue;
    }

    const words = Array.from(new Set(
      data
        .filter(item => item && item.eng)
        .map(item => String(item.eng).trim())
        .filter(Boolean)
    ));

    console.log(`  Words: ${words.length}`);

    for (const word of words) {
      totalWords++;
      const normalized = normalizeWord(word);
      const prompt = getWordPrompt(word);

      if (DRY_RUN) {
        console.log(`    [DRY] ${word} → "${prompt}"`);
        totalGenerated++;
        continue;
      }

      try {
        // Check if file already exists in R2
        const exists = await fileExistsInR2(normalized);
        if (exists) {
          console.log(`    ✓ ${word} (skipped - already exists)`);
          totalGenerated++;
          continue;
        }

        process.stdout.write(`    ⏳ ${word}... `);
        const audioBuffer = await generateAudio(prompt);
        const key = await uploadToR2(normalized, audioBuffer);
        console.log(`✓ (${(audioBuffer.length / 1024).toFixed(1)}KB)`);
        totalGenerated++;
      } catch (e) {
        console.log(`❌ ${e.message}`);
        totalErrors++;
      }
    }

    // Also generate audio for example sentences
    const sentences = data
      .filter(item => item && item.ex)
      .map(item => ({ word: String(item.eng || '').trim(), sentence: String(item.ex || '').trim() }))
      .filter(item => item.word && item.sentence);

    if (sentences.length > 0) {
      console.log(`  Sentences: ${sentences.length}`);
      for (const { word, sentence } of sentences) {
        totalWords++;
        const normalized = normalizeWord(word) + '_ex';
        const prompt = getSentencePrompt(sentence);

        if (DRY_RUN) {
          console.log(`    [DRY] ${word} (sentence) → "${prompt}"`);
          totalGenerated++;
          continue;
        }

        try {
          // Check if file already exists in R2
          const exists = await fileExistsInR2(normalized);
          if (exists) {
            console.log(`    ✓ ${word} (ex) (skipped - already exists)`);
            totalGenerated++;
            continue;
          }

          process.stdout.write(`    ⏳ ${word} (ex)... `);
          const audioBuffer = await generateAudio(prompt);
          const key = await uploadToR2(normalized, audioBuffer);
          console.log(`✓ (${(audioBuffer.length / 1024).toFixed(1)}KB)`);
          totalGenerated++;
        } catch (e) {
          console.log(`❌ ${e.message}`);
          totalErrors++;
        }
      }
    }
    console.log('');
  }

  console.log('═══════════════════════════════════');
  console.log(`✓ Total words: ${totalWords}`);
  console.log(`✓ Generated: ${totalGenerated}`);
  console.log(`✗ Errors: ${totalErrors}`);
  console.log('═══════════════════════════════════');
}

main().catch(e => {
  console.error('❌ Fatal error:', e.message);
  process.exit(1);
});
