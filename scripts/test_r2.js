// Quick local test for R2-backed functions without netlify dev
const fs = require('fs');
const path = require('path');

function loadDotEnv(envPath) {
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key && !(key in process.env)) {
        process.env[key] = val;
      }
    }
  } catch (e) {
    // ignore
  }
}

(async () => {
  // Load .env at repo root
  loadDotEnv(path.join(__dirname, '..', '.env'));

  const getAudioUrls = require(path.join(__dirname, '..', 'netlify', 'functions', 'get_audio_urls.js'));
  const uploadAudio = require(path.join(__dirname, '..', 'netlify', 'functions', 'upload_audio.js'));
  const getAudioUrl = require(path.join(__dirname, '..', 'netlify', 'functions', 'get_audio_url.js'));

  const ts = Date.now();
  const testWord = `tmp_r2_test_${ts}`;
  console.log('Testing R2 env presence...');
  const r2Env = {
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_ENDPOINT: !!process.env.R2_ENDPOINT,
    R2_BUCKET_NAME: !!(process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME),
  };
  console.log(r2Env);

  console.log('Calling get_audio_url (should be not found before upload)...');
  let res1 = await getAudioUrl.handler({ httpMethod: 'GET', queryStringParameters: { word: testWord } });
  console.log('get_audio_url before upload:', res1.statusCode, res1.body);

  console.log('Uploading small fake MP3 to R2 via upload_audio...');
  const fakeBytes = Buffer.from([0x49,0x44,0x33,0x03,0x00,0x00,0x00,0x00]); // starts with "ID3" header-like
  let up = await uploadAudio.handler({ httpMethod: 'POST', body: JSON.stringify({ word: testWord, fileDataBase64: fakeBytes.toString('base64') }) });
  console.log('upload_audio:', up.statusCode, up.body);

  console.log('Calling get_audio_url (should exist after upload)...');
  let res2 = await getAudioUrl.handler({ httpMethod: 'GET', queryStringParameters: { word: testWord } });
  console.log('get_audio_url after upload:', res2.statusCode, res2.body);

  console.log('Batch check with get_audio_urls...');
  let batch = await getAudioUrls.handler({ httpMethod: 'POST', body: JSON.stringify({ words: [testWord, 'nonexistent_word_123'] }) });
  console.log('get_audio_urls:', batch.statusCode, batch.body);
})();