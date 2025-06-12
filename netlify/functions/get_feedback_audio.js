const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let phrase, type;
  try {
    const body = JSON.parse(event.body);
    phrase = body.phrase;
    type = body.type || 'feedback';
    if (!phrase) throw new Error('Missing phrase');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  // Create a safe filename
  const filename = phrase.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.mp3';
  const path = `feedback/${type}/${filename}`;

  // 1. Check if file exists in Supabase
  try {
    const { data, error } = await supabase
      .storage
      .from('tts-audio')
      .list(`feedback/${type}`, { search: filename });

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Supabase list error', details: error.message }) };
    }

    if (data && data.find(f => f.name === filename)) {
      // File exists, return public URL
      const url = `${SUPABASE_URL}/storage/v1/object/public/tts-audio/${path}`;
      return { statusCode: 200, body: JSON.stringify({ url }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase check error', details: err.message }) };
  }

  // 2. Generate audio with Eleven Labs
  let audioBuffer;
  try {
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_LABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVEN_LABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: phrase, model_id: "eleven_monolingual_v1" })
    });

    if (!ttsRes.ok) {
      return { statusCode: ttsRes.status, body: JSON.stringify({ error: 'Failed to fetch from Eleven Labs' }) };
    }
    audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Eleven Labs error', details: err.message }) };
  }

  // 3. Upload to Supabase
  try {
    const { error: uploadError } = await supabase
      .storage
      .from('tts-audio')
      .upload(path, audioBuffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Supabase upload error', details: uploadError.message }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase upload error', details: err.message }) };
  }

  // 4. Return public URL
  const url = `${SUPABASE_URL}/storage/v1/object/public/tts-audio/${path}`;
  return { statusCode: 200, body: JSON.stringify({ url }) };
};