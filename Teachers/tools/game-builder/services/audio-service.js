// Audio Service - TTS generation and audio file management
import { isLocalHost } from '../utils/network.js';
import { normalizeForKey } from '../utils/validation.js';

/**
 * Get the preferred TTS voice ID from localStorage
 * @returns {string|null} Voice ID or null for default
 */
export function preferredVoice() {
  try {
    const id = localStorage.getItem('ttsVoiceId');
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

/**
 * Check which audio files already exist in R2 storage
 * @param {string[]} keys - Array of audio keys to check
 * @returns {Promise<Object>} Map of key -> {exists, url}
 */
export async function checkExistingAudioKeys(keys) {
  if (!Array.isArray(keys) || !keys.length) return {};
  
  const endpoints = isLocalHost()
    ? ['/.netlify/functions/get_audio_urls', 'http://localhost:9000/.netlify/functions/get_audio_urls']
    : ['/.netlify/functions/get_audio_urls'];
  
  let lastErr = null;
  for (const url of endpoints) {
    try {
      const init = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: keys })
      };
      
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) {
        init.signal = AbortSignal.timeout(12000);
      }
      
      const res = await fetch(url, init);
      if (res.ok) {
        const data = await res.json();
        return data && data.results ? data.results : {};
      } else {
        lastErr = new Error(`get_audio_urls ${res.status}`);
      }
    } catch (e) {
      lastErr = e;
    }
  }
  
  throw lastErr || new Error('get_audio_urls failed');
}

/**
 * Call ElevenLabs TTS proxy to generate audio
 * @param {Object} payload - {text, voice_id, model_id}
 * @returns {Promise<Object>} Response with audio base64
 */
export async function callTTSProxy(payload) {
  const endpoints = isLocalHost()
    ? ['/.netlify/functions/eleven_labs_proxy', 'http://localhost:9000/.netlify/functions/eleven_labs_proxy']
    : ['/.netlify/functions/eleven_labs_proxy'];
  
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) return await res.json();
    } catch (e) {
      // Try next endpoint
    }
  }
  
  throw new Error('All TTS endpoints failed');
}

/**
 * Upload audio file to R2 storage
 * @param {string} key - Audio key (e.g., "apple" or "apple_sentence")
 * @param {string} audioBase64 - Base64-encoded audio data
 * @returns {Promise<string>} Public URL of uploaded file
 */
export async function uploadAudioFile(key, audioBase64) {
  const endpoints = isLocalHost()
    ? ['/.netlify/functions/upload_audio', 'http://localhost:9000/.netlify/functions/upload_audio']
    : ['/.netlify/functions/upload_audio'];
  
  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: key, fileDataBase64: audioBase64 })
      });
      
      if (res.ok) {
        const r = await res.json();
        return r.url;
      }
    } catch (e) {
      // Try next endpoint
    }
  }
  
  throw new Error('Upload failed');
}

/**
 * Generate a deterministic prefixed sentence for a word
 * @param {string} word - The word to wrap in a sentence
 * @returns {string} A varied sentence containing the word
 */
function generatePrefixedSentence(word) {
  const w = String(word || '').replace(/\s+/g, ' ').trim();
  
  // Simple hash function for deterministic variety
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  
  const templates = [
    'This one is {w}.',
    'The word is {w}.',
    '{w} is the word.',
    'The word you want is {w}.',
    "Now, let's do {w}.",
    'How about {w}?',
    'Do you know {w}?',
    'This word is {w}.',
    "The word I'm looking for is {w}.",
    '{w} is the one that I want.'
  ];
  
  const idx = templates.length ? (hash32(w) % templates.length) : 0;
  return templates[idx].replace('{w}', w);
}

/**
 * Ensure audio files exist for words and their example sentences
 * @param {string[]} wordsList - Array of words (strings)
 * @param {Object} examplesMap - Map of word -> example sentence
 * @param {Object} opts - Options: {maxWorkers, onInit, onProgress, onDone, force}
 * @returns {Promise<Object>} {ensuredWords, ensuredSentences}
 */
export async function ensureAudioForWordsAndSentences(wordsList, examplesMap, opts = {}) {
  const words = (wordsList || []).map(w => normalizeForKey(w)).filter(Boolean);
  
  // Map back from normalized key to original word
  const originalByKey = {};
  (wordsList || []).forEach(orig => {
    const k = normalizeForKey(orig);
    if (k) originalByKey[k] = String(orig);
  });
  
  const { maxWorkers = 3, onInit, onProgress, onDone, force = false } = opts || {};
  
  if (!words.length && (!examplesMap || Object.keys(examplesMap).length === 0)) {
    if (typeof onInit === 'function') onInit(0);
    if (typeof onDone === 'function') onDone();
    return { ensuredWords: [], ensuredSentences: [] };
  }
  
  // 1) Prepare keys
  const wordKeys = words.slice();
  const sentenceKeys = words.map(w => `${w}_sentence`);
  
  let missingWordKeys = wordKeys.slice();
  let missingSentenceKeys = sentenceKeys.slice();
  
  // 2) Check existing (unless force=true)
  if (!force) {
    const combinedKeys = Array.from(new Set([].concat(wordKeys, sentenceKeys)));
    let existing = {};
    try {
      existing = await checkExistingAudioKeys(combinedKeys);
    } catch (e) {
      console.warn('checkExistingAudioKeys failed', e);
      existing = {};
    }
    
    missingWordKeys = wordKeys.filter(w => {
      const info = existing[w];
      return !(info && info.exists && info.url);
    });
    
    missingSentenceKeys = sentenceKeys.filter(k => {
      const info = existing[k];
      return !(info && info.exists && info.url);
    });
  }
  
  // 3) Progress tracking
  let totalTasksForProgress = 0;
  let completedTasksForProgress = 0;
  
  /**
   * Generate and upload audio for a set of tasks in parallel
   */
  async function runGeneration(tasks, generatorFn) {
    const failures = [];
    const buckets = Array.from({ length: Math.min(maxWorkers || 3, tasks.length) }, () => []);
    tasks.forEach((t, i) => buckets[i % buckets.length].push(t));
    
    await Promise.all(buckets.map(async (bucket) => {
      for (const task of bucket) {
        try {
          if (!task || !task.text || !String(task.text).trim()) {
            failures.push(task);
          } else {
            const payload = await generatorFn(task);
            if (payload && typeof payload.audio === 'string' && payload.audio.trim()) {
              await uploadAudioFile(task.key, payload.audio);
            } else {
              failures.push(task);
            }
          }
        } catch (e) {
          console.warn('Generation/upload failed for', task, e);
          failures.push(task);
        }
        
        completedTasksForProgress++;
        if (typeof onProgress === 'function') {
          onProgress(completedTasksForProgress, totalTasksForProgress);
        }
      }
    }));
    
    return failures;
  }
  
  // 4) Prepare word tasks - use prefixed sentences for variety
  const wordTasks = missingWordKeys.map(k => {
    const orig = (originalByKey[k] || k || '').toString().replace(/_/g, ' ').trim();
    return { key: k, text: generatePrefixedSentence(orig) };
  }).filter(t => t && t.text && String(t.text).trim());
  
  // 5) Prepare sentence tasks - use example sentences or fallback to prefixed
  const sentenceTasks = missingSentenceKeys.map(k => {
    const base = String(k).replace(/_sentence$/i, '');
    const lookup = Object.keys(examplesMap || {}).find(orig => normalizeForKey(orig) === base);
    
    let text = '';
    if (lookup) {
      text = String(examplesMap[lookup] || '').trim();
    }
    
    if (!text) {
      const original = (wordsList || []).find(w => normalizeForKey(w) === base) || base.replace(/_/g, ' ');
      text = generatePrefixedSentence(original);
    }
    
    return { key: k, text };
  }).filter(t => t && t.text && String(t.text).trim());
  
  // 6) Initialize progress
  totalTasksForProgress = wordTasks.length + sentenceTasks.length;
  if (typeof onInit === 'function') onInit(totalTasksForProgress);
  
  // 7) Generate audio
  if (wordTasks.length) {
    await runGeneration(wordTasks, async (task) => {
      const voice = preferredVoice();
      return await callTTSProxy({
        text: task.text,
        voice_id: voice,
        model_id: 'eleven_v3' // Use v3 for word clarity
      });
    });
  }
  
  if (sentenceTasks.length) {
    await runGeneration(sentenceTasks, async (task) => {
      const voice = preferredVoice();
      return await callTTSProxy({
        text: task.text,
        voice_id: voice,
        model_id: 'eleven_turbo_v2_5' // Use turbo for speed on sentences
      });
    });
  }
  
  if (typeof onDone === 'function') onDone();
  
  return { ensuredWords: wordKeys, ensuredSentences: sentenceKeys };
}

/**
 * Ensure regenerate audio checkbox exists in Save modal
 */
export function ensureRegenerateAudioCheckbox() {
  try {
    const boxId = 'regenerateAudioCheckbox';
    const statusBox = document.getElementById('saveModalStatus');
    const container = statusBox && statusBox.parentElement ? statusBox.parentElement : document.getElementById('saveModal');
    if (!container) return;
    
    let row = document.getElementById('regenerateAudioRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'regenerateAudioRow';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0 2px 0;';
      row.innerHTML = `
        <input type="checkbox" id="${boxId}" style="transform:translateY(1px);" />
        <label for="${boxId}" style="font-size:13px;color:#334155;cursor:pointer;">Regenerate audio for all words (overwrite)</label>
      `;
      
      if (statusBox && statusBox.parentElement) {
        statusBox.parentElement.insertBefore(row, statusBox);
      } else {
        container.appendChild(row);
      }
    }
    
    const cb = document.getElementById(boxId);
    const saved = localStorage.getItem('gb_regenerate_audio') === '1';
    if (cb) {
      cb.checked = saved;
      cb.onchange = () => {
        try {
          localStorage.setItem('gb_regenerate_audio', cb.checked ? '1' : '0');
        } catch {}
      };
    }
  } catch {}
}
