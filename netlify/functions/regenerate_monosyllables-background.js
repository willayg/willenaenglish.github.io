const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

const BATCH_ID = 'shimmer-monosyllables-20260927-v1';
const MARKER_KEY = '_batches/' + BATCH_ID + '.json';
const MODEL = 'gpt-4o-mini-tts';
const VOICE = 'shimmer';
const TTS_INSTRUCTIONS = 'Pronounce this English vocabulary word once, clearly and naturally. Warm, friendly and encouraging tone for a child learning English. Neutral American English. Slightly slower than normal conversation, but do not exaggerate. Make the complete final sound clear. Do not add any other words or sounds.';

function s3Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error('Missing R2 credentials');
  return new S3Client({
    region: 'auto',
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey }
  });
}

function bucketName() {
  const b = process.env.R2_BUCKET_NAME || process.env.R2_BUCKET || process.env.R2_BUCKETNAME;
  if (!b) throw new Error('Missing R2 bucket');
  return b;
}

async function streamToString(body) {
  const chunks = [];
  for await (const chunk of body) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

async function readMarker(s3, bucket) {
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: MARKER_KEY }));
    return JSON.parse(await streamToString(out.Body));
  } catch (e) {
    return null;
  }
}

async function writeMarker(s3, bucket, marker) {
  marker.updated_at = new Date().toISOString();
  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: MARKER_KEY,
    Body: Buffer.from(JSON.stringify(marker, null, 2)),
    ContentType: 'application/json',
    CacheControl: 'no-store'
  }));
}

function safeKey(word) {
  return String(word).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '') + '.mp3';
}

async function fetchPublishedWords() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) throw new Error('Missing Supabase server credentials');
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('lexical_entries')
      .select('canonical_text,status')
      .eq('status', 'published')
      .range(from, from + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return [...new Set(rows
    .map(r => String(r.canonical_text || '').trim())
    .filter(w => /^[A-Za-z]+$/.test(w) && w.length >= 2)
  )].sort((a,b) => a.localeCompare(b));
}

async function classifyMonosyllables(words) {
  const apiKey = process.env.OPENAI_API;
  if (!apiKey) throw new Error('Missing OPENAI_API');
  const selected = [];
  const chunkSize = 180;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize);
    const prompt = [
      'From the supplied English vocabulary tokens, return ONLY those pronounced as exactly ONE syllable in ordinary neutral American English.',
      'Include diphthongs. Include homographs if the token itself is still one syllable in its common pronunciations (read, lead, live, wind, tear, close, use, etc.).',
      'Do not exclude a word merely because it has many letters. Exclude abbreviations, obvious proper-name-only items, nonwords, and anything normally two or more syllables.',
      'Return JSON exactly as {"words":["..."]}. Preserve each selected token exactly as supplied.',
      '',
      JSON.stringify(chunk)
    ].join('\n');
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a careful American English pronunciation lexicographer.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    if (!resp.ok) throw new Error('Classification failed ' + resp.status + ': ' + (await resp.text()).slice(0,500));
    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(text);
    const allowed = new Set(chunk);
    for (const w of (parsed.words || [])) if (allowed.has(w)) selected.push(w);
  }
  return [...new Set(selected)].sort((a,b) => a.localeCompare(b));
}

async function generateMp3(word) {
  const apiKey = process.env.OPENAI_API;
  const resp = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: word,
      instructions: TTS_INSTRUCTIONS,
      response_format: 'mp3'
    })
  });
  if (!resp.ok) throw new Error('TTS ' + word + ' failed ' + resp.status + ': ' + (await resp.text()).slice(0,300));
  return Buffer.from(await resp.arrayBuffer());
}

async function runBatch() {
  const s3 = s3Client();
  const bucket = bucketName();
  let marker = await readMarker(s3, bucket);

  if (marker?.state === 'complete') return marker;

  if (marker?.state === 'running' && marker.updated_at) {
    const age = Date.now() - Date.parse(marker.updated_at);
    if (Number.isFinite(age) && age < 20 * 60 * 1000) return { ...marker, note: 'already_running' };
  }

  if (!marker || !Array.isArray(marker.targets)) {
    marker = {
      batch_id: BATCH_ID,
      state: 'classifying',
      model: MODEL,
      voice: VOICE,
      started_at: new Date().toISOString(),
      completed: [],
      failures: []
    };
    await writeMarker(s3, bucket, marker);
    const published = await fetchPublishedWords();
    const targets = await classifyMonosyllables(published);
    marker.targets = targets;
    marker.published_single_tokens = published.length;
    marker.target_count = targets.length;
  }

  marker.state = 'running';
  marker.completed = Array.isArray(marker.completed) ? marker.completed : [];
  marker.failures = Array.isArray(marker.failures) ? marker.failures : [];
  await writeMarker(s3, bucket, marker);

  const done = new Set(marker.completed);
  const targets = marker.targets.filter(w => !done.has(w));
  const concurrency = 6;
  let idx = 0;
  let sinceSave = 0;

  async function worker() {
    while (idx < targets.length) {
      const word = targets[idx++];
      try {
        const audio = await generateMp3(word);
        await s3.send(new PutObjectCommand({
          Bucket: bucket,
          Key: safeKey(word),
          Body: audio,
          ContentType: 'audio/mpeg',
          CacheControl: 'public, max-age=300, must-revalidate',
          Metadata: {
            tts_provider: 'openai',
            tts_model: MODEL,
            tts_voice: VOICE,
            batch_id: BATCH_ID
          }
        }));
        marker.completed.push(word);
        marker.failures = marker.failures.filter(f => f.word !== word);
      } catch (e) {
        marker.failures.push({ word, error: String(e.message || e).slice(0,500) });
      }
      sinceSave++;
      if (sinceSave >= 20) {
        sinceSave = 0;
        marker.completed_count = marker.completed.length;
        marker.failure_count = marker.failures.length;
        await writeMarker(s3, bucket, marker);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  marker.completed_count = marker.completed.length;
  marker.failure_count = marker.failures.length;
  marker.finished_at = new Date().toISOString();
  marker.state = marker.failures.length ? 'complete_with_failures' : 'complete';
  await writeMarker(s3, bucket, marker);
  return marker;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  const batch = event.queryStringParameters?.batch;
  if (batch !== BATCH_ID) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid batch id' }) };
  }
  await runBatch();
  return { statusCode: 202, body: JSON.stringify({ accepted: true, batch_id: BATCH_ID }) };
};
