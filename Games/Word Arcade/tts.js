// Shared TTS utilities

// Audio cache for preloaded sounds (keyed by normalized word)
const audioCache = new Map(); // normalizedWord -> Audio object

// Strict behavior flags
// Generation is allowed during preload to create files only for missing words; still disabled at runtime
const DISABLE_TTS_GENERATION = false;

function normalizeWord(w) {
  return String(w || '').trim().toLowerCase();
}

// Optional: persist a preferred ElevenLabs voice ID (e.g., US/UK voice)
function getPreferredVoiceId() {
  try {
    const id = localStorage.getItem('ttsVoiceId');
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

async function batchCheckSupabaseAudio(words) {
  const isLocal = typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname);
  const endpoints = isLocal
    ? ['http://localhost:9000/.netlify/functions/get_audio_urls', '/.netlify/functions/get_audio_urls']
    : ['/.netlify/functions/get_audio_urls'];
  let lastErr = null;
  for (const url of endpoints) {
    try {
      const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) };
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
        init.signal = AbortSignal.timeout(12000);
      }
      const res = await fetch(url, init);
      if (res.ok) {
        const data = await res.json();
        return data && data.results ? data.results : {};
      } else {
        lastErr = new Error(`get_audio_urls HTTP ${res.status}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('get_audio_urls failed');
}

// Preload all audio for a word list - generates missing MP3s and loads all from Supabase
export async function preloadAllAudio(wordList, onProgress = null) {
  const words = wordList
    .map(item => typeof item === 'string' ? item : item.eng)
    .filter(Boolean)
    .map(w => w.trim());
  const totalWords = words.length;
  let completed = 0;

  console.log(`Preloading audio for ${totalWords} words...`);

  // Check which words already exist in Supabase (batched)
  const existingAudio = new Map(); // normalizedWord -> url
  const missingWords = [];
  const failedGenerations = new Set();
  const failedLoads = new Set();

  // Query backend with normalized keys; build a normalized results map
  const resultsRaw = await batchCheckSupabaseAudio(words);
  const results = {};
  Object.keys(resultsRaw || {}).forEach(k => { results[normalizeWord(k)] = resultsRaw[k]; });
  for (const word of words) {
    const info = results[normalizeWord(word)];
    if (info && info.exists && info.url) {
      existingAudio.set(normalizeWord(word), info.url);
    } else {
      missingWords.push(word);
    }
    completed++;
    if (onProgress) {
      const progress = (completed / totalWords) * 33; // Phase 1
      onProgress({ completed, total: totalWords, phase: 'checking', word, progress });
    }
  }

  console.log(`Found ${existingAudio.size} existing, missing ${missingWords.length}`);

  // If none of the words exist, generate for all
  if (!DISABLE_TTS_GENERATION && missingWords.length) {
    completed = 0;
    const toGenerate = existingAudio.size === 0 ? words : missingWords;
    for (const word of toGenerate) {
      try {
        const text = preprocessTTS(word);
        const data = await callTTSFunction({ text, voice_id: getPreferredVoiceId() });
        if (data && data.audio) {
          const uploadedUrl = await uploadToSupabase(word, data.audio);
          if (uploadedUrl) {
            audioCache.delete(normalizeWord(word));
            existingAudio.set(normalizeWord(word), uploadedUrl);
          } else {
            failedGenerations.add(word);
          }
        }
      } catch (err) {
        failedGenerations.add(word);
      }
      completed++;
      if (onProgress) {
        const progress = 33 + (completed / Math.max(1, toGenerate.length)) * 33; // Phase 2
        onProgress({ completed, total: toGenerate.length, phase: 'generating', word, progress });
      }
    }
  }

  // Load all audio into cache (with concurrency)
  completed = 0;
  let audioIndex = 0;
  const audioEntries = Array.from(existingAudio.entries());

  async function loadWorker() {
    while (audioIndex < audioEntries.length) {
      const idx = audioIndex++;
      const [normWord, url] = audioEntries[idx];
      try {
        const audio = new Audio(url);
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Load timeout')), 10000);
          audio.oncanplaythrough = () => { clearTimeout(timeout); resolve(); };
          audio.onerror = () => { clearTimeout(timeout); reject(new Error('Load error')); };
          audio.load();
        });
        audioCache.set(normWord, audio);
      } catch (err) {
        failedLoads.add(normWord);
      }
      completed++;
      if (onProgress) {
        const progress = 66 + (completed / Math.max(1, audioEntries.length)) * 34; // Phase 3
        onProgress({ completed, total: audioEntries.length, phase: 'loading', word: normWord, progress });
      }
    }
  }

  const audioWorkers = Array.from({ length: Math.min(6, audioEntries.length) }, () => loadWorker());
  await Promise.all(audioWorkers);

  // Validate that all requested words are present in the cache
  const missingAfter = words.filter(w => !audioCache.has(normalizeWord(w)));
  if (missingAfter.length > 0) {
    const error = new Error(`Audio missing for ${missingAfter.length} word(s).`);
    error.details = {
      missingAfter,
      failedGenerations: Array.from(failedGenerations),
      failedLoads: Array.from(failedLoads)
    };
    throw error;
  }

  console.log(`Audio preload complete. ${audioCache.size} files ready.`);
  return audioCache.size;
}

async function callTTSFunction(payload) {
  const endpoints = [
    '/.netlify/functions/eleven_labs_proxy',
    'http://localhost:9000/.netlify/functions/eleven_labs_proxy'
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('TTS endpoint failed:', url, e);
    }
  }
  throw new Error('All TTS endpoints failed');
}

async function uploadToSupabase(word, audioBase64) {
  const endpoints = [
    '/.netlify/functions/upload_audio',
    'http://localhost:9000/.netlify/functions/upload_audio'
  ];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, fileDataBase64: audioBase64 })
      });
      if (res.ok) {
        const result = await res.json();
        return result.url;
      } else {
        const errorText = await res.text();
        console.warn(`Upload failed ${res.status}:`, errorText);
      }
    } catch (e) {
      console.warn('Supabase upload failed:', url, e);
    }
  }
  throw new Error('Upload failed');
}

export function preprocessTTS(text) {
  const isShort = text.length <= 4 || (/^[a-zA-Z]+$/.test(text) && text.split(/[^aeiouy]+/).length <= 2);
  if (isShort) {
    const formats = [
      (word) => `The word is: "${word}!"`,
      (word) => `Let's try: "${word}!"`,
      (word) => `Can you do: "${word}!"?`,
      (word) => `Try "${word}!"`,
      (word) => `This one is: "${word}"`
    ];
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

// Extract the canonical word from a TTS phrase, handling quotes and prefixes
function extractWordForAudio(text) {
  if (!text) return '';
  const raw = String(text).trim();
  const sanitize = (s) => s
    .trim()
    // drop any leading/trailing quotes, spaces, or punctuation
    .replace(/^[\s\"“”'‘’!?.:,;()\[\]-]+|[\s\"“”'‘’!?.:,;()\[\]-]+$/g, '')
    .trim();
  // Prefer quoted content first (ASCII or curly quotes)
  const quoted = raw.match(/[\"“”'‘’]\s*([^\"“”'‘’]+?)\s*[\"“”'‘’]/);
  if (quoted && quoted[1]) {
    const q = sanitize(quoted[1]);
    if (q) return q;
  }
  // Remove trailing punctuation/closing quotes
  const tailTrimmed = raw.replace(/[\"”'’!?.、，。…\s]*$/g, '').trim();
  // Strip common prompt prefixes if present
  const promptPrefix = /^(?:the word is|let[’']s try|can you (?:say|do)|try|this one is)\s*[:：-]?\s*/i;
  const removedPrompt = tailTrimmed.replace(promptPrefix, '').trim();
  // Clean any stray leading quotes left after prompt removal
  const cleaned = sanitize(removedPrompt);
  // If we accidentally stripped everything or ended up with just the prompt, return empty to avoid speaking the prompt itself
  if (!cleaned || /^(?:the word is|let[’']s try|can you(?: say| do)?|try|this one is)$/i.test(cleaned)) {
    return '';
  }
  return cleaned;
}

// System TTS fallback using Web Speech API; prefers en-US female where available
function speakWithSystemTTS(word) {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) return resolve();
      const synth = window.speechSynthesis;
      const pickVoice = () => {
        const voices = synth.getVoices() || [];
        if (!voices.length) return null;
        const prefers = [
          (v) => v.lang && v.lang.toLowerCase().startsWith('en-us') && /(female|zira|aria|jenny|samantha|allison|emily|lisa|michelle)/i.test(v.name || ''),
          (v) => v.lang && v.lang.toLowerCase().startsWith('en-us'),
          (v) => v.lang && v.lang.toLowerCase().startsWith('en')
        ];
        for (const rule of prefers) {
          const found = voices.find(rule);
          if (found) return found;
        }
        return voices[0] || null;
      };
      let voice = pickVoice();
      if (!voice) {
        // Attempt async load of voices once
        const onvc = () => {
          voice = pickVoice();
          synth.removeEventListener('voiceschanged', onvc);
          const utt2 = new SpeechSynthesisUtterance(String(word));
          if (voice) utt2.voice = voice;
          utt2.lang = (voice && voice.lang) || 'en-US';
          utt2.rate = 0.9; utt2.pitch = 1.0; utt2.volume = 1.0;
          utt2.onend = resolve; utt2.onerror = resolve;
          synth.speak(utt2);
        };
        synth.addEventListener('voiceschanged', onvc);
        // Kick voices load on some browsers
        synth.getVoices();
        // Also resolve in case no voices ever load
        setTimeout(resolve, 2500);
        return;
      }
      const utt = new SpeechSynthesisUtterance(String(word));
      utt.voice = voice;
      utt.lang = voice.lang || 'en-US';
      utt.rate = 0.9; utt.pitch = 1.0; utt.volume = 1.0;
      utt.onend = resolve; utt.onerror = resolve;
      synth.speak(utt);
    } catch {
      resolve();
    }
  });
}

export async function playTTS(text) {
  console.log(`Playing TTS for: "${text}"`);
  // Extract the actual word for filename (remove prompt formatting)
  const word = extractWordForAudio(text);

  // Play from cache when available (normalized)
  const key = normalizeWord(word);
  if (audioCache.has(key)) {
    const audio = audioCache.get(key);
    audio.currentTime = 0;
    audio.playbackRate = 0.85;
    try {
      await audio.play();
    } catch (err) {
      console.warn(`Audio play failed for ${word}, retrying once...`, err);
      await new Promise(r => setTimeout(r, 200));
      try { await audio.play(); } catch (err2) {
        console.warn(`Second audio play failed for ${word}.`, err2);
      }
    }
    return;
  }

  // Strict mode: do not generate; fallback to system TTS (US female preferred)
  // Keep logs quiet to avoid noise during class use
  // console.debug(`Audio not preloaded for word: "${word}"; speaking via system TTS.`);
  await speakWithSystemTTS(word);
}
