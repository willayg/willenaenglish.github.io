// Shared TTS utilities

// Audio cache for preloaded sounds
const audioCache = new Map(); // word -> Audio object

// Preload all audio for a word list - generates missing MP3s and loads all from Supabase
export async function preloadAllAudio(wordList, onProgress = null) {
  const words = wordList.map(item => typeof item === 'string' ? item : item.eng).filter(Boolean);
  const totalWords = words.length;
  let completed = 0;
  
  console.log(`Preloading audio for ${totalWords} words...`);
  
  // Check which words already exist in Supabase (with concurrency)
  const existingAudio = new Map(); // word -> url
  const missingWords = [];
  
  // Use concurrent workers to speed up checking
  const concurrency = 8;
  let wordIndex = 0;
  
  async function checkWorker() {
    while (wordIndex < words.length) {
      const idx = wordIndex++;
      const word = words[idx];
      try {
        const url = await checkSupabaseAudio(word);
        if (url) {
          existingAudio.set(word, url);
        } else {
          missingWords.push(word);
        }
      } catch (err) {
        console.warn(`Failed to check ${word}:`, err);
        missingWords.push(word);
      }
      completed++;
      if (onProgress) {
        // Phase 1: Checking (0-33%)
        const progress = (completed / totalWords) * 33;
        onProgress({ completed, total: totalWords, phase: 'checking', word, progress });
      }
    }
  }
  
  // Run concurrent workers
  const workers = Array.from({ length: Math.min(concurrency, words.length) }, () => checkWorker());
  await Promise.all(workers);
  
  console.log(`Found ${existingAudio.size} existing, generating ${missingWords.length} missing`);
  
  // Generate missing audio files
  completed = 0;
  for (const word of missingWords) {
    try {
      const text = preprocessTTS(word);
      const data = await callTTSFunction({ text });
      if (data && data.audio) {
        // Upload to Supabase and get URL
        const uploadedUrl = await uploadToSupabase(word, data.audio);
        if (uploadedUrl) {
          existingAudio.set(word, uploadedUrl);
        }
      }
    } catch (err) {
      console.warn(`Failed to generate audio for: ${word}`, err);
    }
    completed++;
    if (onProgress) {
      // Phase 2: Generating (33-66%)
      const progress = 33 + (completed / missingWords.length) * 33;
      onProgress({ completed, total: missingWords.length, phase: 'generating', word, progress });
    }
  }
  
  // Load all audio into cache (with concurrency)
  completed = 0;
  let audioIndex = 0;
  const audioEntries = Array.from(existingAudio.entries());
  
  async function loadWorker() {
    while (audioIndex < audioEntries.length) {
      const idx = audioIndex++;
      const [word, url] = audioEntries[idx];
      try {
        const audio = new Audio(url);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Load timeout')), 10000);
          audio.oncanplaythrough = () => { clearTimeout(timeout); resolve(); };
          audio.onerror = () => { clearTimeout(timeout); reject(new Error('Load error')); };
          audio.load();
        });
        audioCache.set(word, audio);
      } catch (err) {
        console.warn(`Failed to load audio for: ${word}`, err);
      }
      completed++;
      if (onProgress) {
        // Phase 3: Loading (66-100%)
        const progress = 66 + (completed / audioEntries.length) * 34;
        onProgress({ completed, total: audioEntries.length, phase: 'loading', word, progress });
      }
    }
  }
  
  // Run concurrent audio loading
  const audioWorkers = Array.from({ length: Math.min(6, audioEntries.length) }, () => loadWorker());
  await Promise.all(audioWorkers);
  
  console.log(`Audio preload complete. ${audioCache.size} files ready.`);
  return audioCache.size;
}

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
  const endpoints = [
    `/.netlify/functions/get_audio_url?word=${encodeURIComponent(word)}`,
    `http://localhost:8888/.netlify/functions/get_audio_url?word=${encodeURIComponent(word)}`
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { 
        cache: 'no-store',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.exists && data.url) return data.url;
      }
    } catch (e) {
      if (e.name !== 'TimeoutError') {
        console.warn('get_audio_url failed:', url, e);
      }
    }
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
        return result.url; // Return the public URL
      } else {
        const errorText = await res.text();
        console.warn(`Upload failed with status ${res.status}:`, errorText);
      }
    } catch (e) {
      console.warn('Supabase upload failed:', url, e);
    }
  }
  console.warn('All Supabase upload endpoints failed');
  throw new Error('Upload failed');
}

export function preprocessTTS(text) {
  const isShort = text.length <= 4 || (/^[a-zA-Z]+$/.test(text) && text.split(/[^aeiouy]+/).length <= 2);
  if (isShort) {
    const formats = [
      word => `The word is: "${word}!"`,
      word => `Let's try: "${word}!"`,
      word => `Can you do: "${word}!"?`,
      word => `Try "${word}!"`,
      word => `This one is: "${word}"`
    ];
    // Use crypto.getRandomValues for better randomness if available
    let idx;
    if (window.crypto && window.crypto.getRandomValues) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      idx = arr[0] % formats.length;
    } else {
      idx = Math.floor(Math.random() * formats.length);
    }
    return formats[idx](text);
  }
  return text;
}

export async function playTTS(text) {
  console.log(`Playing TTS for: "${text}"`);
  // Extract the actual word for filename (remove prompt formatting)
  const word = text.replace(/^(The word is|Let's try|Can you do|Try|This one is)\s*[:]?\s*"?/, '').replace(/[.!?"']*$/, '');

  // Check if we have preloaded audio
  if (audioCache.has(word)) {
    console.log(`Playing preloaded audio for: ${word}`);
    const audio = audioCache.get(word);
    audio.currentTime = 0; // Reset to beginning
    audio.playbackRate = 0.85; // Set slower speed
    try {
      await audio.play();
    } catch (err) {
      console.warn(`Audio play failed for ${word}, retrying once...`, err);
      // Try again after a short delay
      await new Promise(r => setTimeout(r, 200));
      audio.currentTime = 0;
      try {
        await audio.play();
        return;
      } catch (err2) {
        console.warn(`Second audio play failed for ${word}, falling back to Web Speech.`, err2);
      }
    }
    return;
  }

  // If not preloaded, something went wrong - log error and fallback to Web Speech
  console.warn(`Audio not preloaded for word: "${word}". This shouldn't happen after preloading.`);
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.85;
    speechSynthesis.speak(utterance);
  }
}
