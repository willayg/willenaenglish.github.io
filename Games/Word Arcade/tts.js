// Shared TTS utilities

// Audio cache for preloaded sounds (keyed by normalized word)
const audioCache = new Map(); // normalizedWord -> Audio object

// Strict behavior flags
// Disable generation completely (per requirement to prevent creating new audio files)
const DISABLE_TTS_GENERATION = true;

function normalizeWord(w) {
  // Unify cache keys so 'ice cream' and 'ice_cream' map to the same key
  // Use lowercase and replace all whitespace with underscores
  return String(w || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
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
  // Try relative first (works in Netlify dev/prod), then common localhost ports
  const endpoints = [
    '/.netlify/functions/get_audio_urls',
    'http://localhost:9000/.netlify/functions/get_audio_urls',
    'http://127.0.0.1:9000/.netlify/functions/get_audio_urls',
    'http://localhost:8888/.netlify/functions/get_audio_urls',
    'http://127.0.0.1:8888/.netlify/functions/get_audio_urls'
  ];
  let lastErr = null;
  for (const url of endpoints) {
    try {
      const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) };
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
        init.signal = AbortSignal.timeout(12000);
      }
      const res = await fetch(url, init);
      if (!res.ok) {
        lastErr = new Error(`get_audio_urls HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      if (data && data.results && typeof data.results === 'object') {
        return data.results; // { [word]: { exists: boolean, url?: string } }
      }
      lastErr = new Error('Malformed response from get_audio_urls');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('get_audio_urls failed');
}

// Robust loader: try to load an Audio element; if it fails, fetch as Blob and use an object URL
async function loadAudioElement(url) {
  // First attempt: direct Audio src
  try {
    const audio = new Audio(url);
    audio.preload = 'auto';
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Load timeout')), 10000);
      audio.oncanplaythrough = () => { clearTimeout(timeout); resolve(); };
      audio.onerror = () => { clearTimeout(timeout); reject(new Error('Load error')); };
      audio.load();
    });
    return audio;
  } catch (e) {
    // Fallback: fetch blob and create object URL
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const audio2 = new Audio(objectUrl);
      audio2.preload = 'auto';
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Blob load timeout')), 10000);
        audio2.oncanplaythrough = () => { clearTimeout(timeout); resolve(); };
        audio2.onerror = () => { clearTimeout(timeout); reject(new Error('Blob load error')); };
        audio2.load();
      });
      return audio2;
    } catch (e2) {
      throw e2;
    }
  }
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

  // Generation disabled: skip creation entirely. Report phase 2 instantly if callback expects it.
  if (onProgress) {
    onProgress({ phase: 'generating', word: '', progress: 66, completed, total: totalWords });
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
        const audio = await loadAudioElement(url);
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

  // Do NOT throw if missing; instead return a summary so caller can skip those words in audio-dependent modes.
  const missingAfter = words.filter(w => !audioCache.has(normalizeWord(w)));
  const summary = {
    ready: audioCache.size,
    missing: missingAfter,
    failedGenerations: Array.from(failedGenerations),
    failedLoads: Array.from(failedLoads)
  };
  console.log(`[AudioPreload] Complete. Ready: ${summary.ready} Missing: ${summary.missing.length}`);
  return summary;
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
  const payload = { word, fileDataBase64: audioBase64 };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

function countVowelGroups(s) {
  if (!/^[a-zA-Z]+$/.test(s)) return Infinity; // non-simple words: skip syllable guess
  // Split on one-or-more non-vowel characters and count non-empty vowel chunks
  return s.split(/[^aeiouy]+/i).filter(Boolean).length;
}

function isMonosyllabic(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  const vg = countVowelGroups(t);
  return vg === 1;
}

// Treat very short words similarly to monosyllabic ones for pacing/playback
function isShortWord(s) {
  const t = String(s || '').trim();
  return t.length > 0 && t.length <= 4;
}

function isMonoOrShortWord(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  return isMonosyllabic(t) || isShortWord(t);
}

export function preprocessTTS(text) {
  // Normalize underscores to spaces (defensive: avoid voices saying "underscore")
  text = String(text || '').replace(/_/g, ' ').trim();
  // Apply a prefixed natural-speech template for every word/phrase to soften delivery
  const w = text;
  const templates = [
    (x) => `This one is "${x}"...`,
    (x) => `The word is "${x}"...`,
    (x) => `"${x}", is the word...`,
    (x) => `Try "${x}"...`,
    (x) => `How about "${x}"?...`,
    (x) => `"${x}", is the one...`,
    (x) => `Can you do the word; "${x}"?...`,
    (x) => `Can you do; "${x}"?...`,
    (x) => `The word you want is... "${x}"...`
  ];
  let idx = 0;
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    window.crypto.getRandomValues(arr);
    idx = arr[0] % templates.length;
  } else {
    idx = Math.floor(Math.random() * templates.length);
  }
  return templates[idx](w);
}

// Extract the canonical word from a TTS phrase, handling quotes and prefixes
function extractWordForAudio(text) {
  if (!text) return '';
  const raw = String(text).replace(/_/g, ' ').trim();
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
  // Strip common prompt prefixes if present (including our natural-speech helpers)
  const promptPrefix = /^(?:the word is|the word you want is|this is a|this is an|this one is|how about|let['’]s try|can you (?:say|do)|try|say it slowly|please say|repeat slowly|repeat|slowly|let['’]s say it slowly)\s*[:：-]?\s*/i;
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
            utt2.rate = 0.8; utt2.pitch = 1.0; utt2.volume = 1.0;
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
        utt.rate = 0.8; utt.pitch = 1.0; utt.volume = 1.0;
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

  // Lazy-load from backend if not preloaded yet
  try {
    // Prefer get_audio_urls to get a signed/public URL when needed
    const listEndpoints = [
      '/.netlify/functions/get_audio_urls',
      'http://localhost:9000/.netlify/functions/get_audio_urls'
    ];
    let loaded = false;
    for (const url of listEndpoints) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ words: [word] })
        });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.results) {
          const info = data.results[word] || data.results[normalizeWord(word)] || null;
          if (info && info.exists && info.url) {
            const audio = await loadAudioElement(info.url);
            audioCache.set(key, audio);
            try { await audio.play(); console.debug('Lazy-loaded audio from R2 (list):', word); } catch { /* ignore */ }
            loaded = true;
            break;
          }
        }
      } catch { /* try next */ }
    }
    if (loaded) return;

    // Fallback to single URL check (may require public base)
    const singleEndpoints = [
      '/.netlify/functions/get_audio_url',
      'http://localhost:9000/.netlify/functions/get_audio_url'
    ];
    for (const url of singleEndpoints) {
      try {
        const res = await fetch(`${url}?word=${encodeURIComponent(word)}`, { method: 'GET' });
        if (!res.ok) continue;
        const data = await res.json();
        if (data && data.exists && data.url) {
          const audio = await loadAudioElement(data.url);
          audioCache.set(key, audio);
          try { await audio.play(); console.debug('Lazy-loaded audio from R2 (single):', word); } catch { /* ignore */ }
          return;
        }
      } catch { /* try next */ }
    }
  } catch { /* swallow and fall back */ }

  // Strict mode: do not generate; fallback to system TTS (US female preferred)
  // Keep logs quiet to avoid noise during class use
  // console.debug(`Audio not preloaded for word: "${word}"; speaking via system TTS.`);
  await speakWithSystemTTS(word);
}
