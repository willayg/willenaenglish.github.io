// Shared TTS utilities

async function callTTSFunction(payload) {
  const endpoints = [
    '/.netlify/functions/eleven_labs_proxy',
    'http://localhost:8888/.netlify/functions/eleven_labs_proxy'
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn('TTS endpoint failed:', url, e);
    }
  }
  throw new Error('All TTS endpoints failed');
}

async function checkSupabaseAudio(word) {
  try {
    // Try to get the Supabase URL from your environment or use a fallback
  const supabaseUrl = 'https://fiieuiktlsivwfgyivai.supabase.co'; // User's actual Supabase project URL
    const audioUrl = `${supabaseUrl}/storage/v1/object/public/audio/${word}.mp3`;
    const response = await fetch(audioUrl, { method: 'HEAD' });
    if (response.ok) {
      return audioUrl;
    }
  } catch (e) {
    console.warn('Supabase audio check failed:', e);
  }
  return null;
}

async function uploadToSupabase(word, audioBase64) {
  const endpoints = [
    '/.netlify/functions/upload_audio',
    'http://localhost:8888/.netlify/functions/upload_audio'
  ];
  for (const url of endpoints) {
    try {
      console.log(`Attempting upload to: ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, fileDataBase64: audioBase64 })
      });
      console.log(`Response status: ${res.status}`);
      if (res.ok) {
        const result = await res.json();
        console.log(`Uploaded ${word}.mp3 to Supabase:`, result);
        return;
      } else {
        const errorText = await res.text();
        console.warn(`Upload failed with status ${res.status}:`, errorText);
      }
    } catch (e) {
      console.warn('Supabase upload failed:', url, e);
    }
  }
  console.warn('All Supabase upload endpoints failed');
}

export function preprocessTTS(text) {
  const isShort = text.length <= 4 || (/^[a-zA-Z]+$/.test(text) && text.split(/[^aeiouy]+/).length <= 2);
  if (isShort) {
    return `The word is ${text}.`;
  }
  return text;
}

export async function playTTS(text) {
  console.log(`Attempting TTS for: "${text}"`);
  
  // Extract the actual word for filename (remove "The word is" prefix if present)
  const word = text.replace(/^The word is\s+/, '').replace(/\.$/, '');
  
  // First, check if audio exists in Supabase
  const supabaseUrl = await checkSupabaseAudio(word);
  if (supabaseUrl) {
    console.log(`Playing cached audio from Supabase for: ${word}`);
    const audio = new Audio(supabaseUrl);
    audio.play();
    return;
  }
  
  // If not in Supabase, generate with Eleven Labs
  try {
    const data = await callTTSFunction({ text });
    if (data && data.audio) {
      const audioBlob = new Blob([Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      console.log('Playing ElevenLabs audio...');
      audio.play();
      
      // Upload to Supabase for future use
      uploadToSupabase(word, data.audio).catch(err => console.warn('Upload failed:', err));
      return;
    }
    console.log('No audio in response, falling back');
    throw new Error('No audio');
  } catch (err) {
    console.error('ElevenLabs TTS error:', err);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }
}
