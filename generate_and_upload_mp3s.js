import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import * as wordData from './Games/game_templates/4_b_template_contents.js';

const ELEVEN_LABS_API_KEY = process.env.ELEVEN_LABS_API_KEY;
const ELEVEN_LABS_VOICE_ID = process.env.ELEVEN_LABS_VOICE_ID;
const SUPABASE_URL = process.env.supabase_url;
const SUPABASE_KEY = process.env.supabase_key;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getAudioFilename(word) {
  return word.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.mp3';
}

async function generateMp3(word) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_LABS_VOICE_ID}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': ELEVEN_LABS_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: word, model_id: "eleven_monolingual_v1" })
  });
  if (!res.ok) throw new Error(`TTS failed for "${word}"`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadToSupabase(filename, buffer) {
  const { error } = await supabase.storage
    .from('tts-audio')
    .upload(filename, buffer, { contentType: 'audio/mpeg', upsert: true });
  if (error) throw error;
}

async function main() {
  const allWords = [
    ...(wordData.foodWords || []),
    ...(wordData.toyWords || []),
    ...(wordData.animalWords || [])
    // Add more categories if needed
  ];
  for (const entry of allWords) {
    const word = entry.word;
    const filename = getAudioFilename(word);
    try {
      console.log(`Generating: ${word}`);
      const mp3 = await generateMp3(word);
      console.log(`Uploading: ${filename}`);
      await uploadToSupabase(filename, mp3);
      console.log(`Done: ${filename}`);
    } catch (err) {
      console.error(`Error for "${word}":`, err.message);
    }
  }
}

main();