// File Service - Save/Load/Delete game data operations
import { fetchJSONSafe } from '../utils/network.js';
// escapeHtml lives in dom-helpers (not validation)
import { escapeHtml } from '../utils/dom-helpers.js';

/**
 * Get current user ID from various storage locations
 * @returns {string} User ID or empty string
 */
export function getCurrentUserId() {
  try {
    const possibleKeys = [
      'user_id', 'id', 'userId', 'current_user_id', 'currentUserId',
      'sb_user_id', 'supabase_user_id', 'auth_user_id'
    ];
    
    // Check localStorage first
    for (const key of possibleKeys) {
      const value = localStorage.getItem(key);
      if (value && value.trim()) {
        console.log('[getCurrentUserId] Found in localStorage:', key.substring(0, 8) + '...');
        return value.trim();
      }
    }
    
    // Check sessionStorage
    for (const key of possibleKeys) {
      const value = sessionStorage.getItem(key);
      if (value && value.trim()) {
        console.log('[getCurrentUserId] Found in sessionStorage:', key.substring(0, 8) + '...');
        return value.trim();
      }
    }
    
    // Try to extract from Supabase auth cookie
    try {
      const cookieHeader = document.cookie;
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
      
      const accessToken = cookies['sb_access'] || cookies['sb-access-token'];
      if (accessToken) {
        const parts = accessToken.split('.');
        if (parts.length >= 2) {
          const base64url = parts[1];
          const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
          const json = atob(base64);
          const payload = JSON.parse(json);
          if (payload.sub) {
            console.log('[getCurrentUserId] Found in JWT:', payload.sub.substring(0, 8) + '...');
            return payload.sub;
          }
        }
      }
    } catch (e) {
      console.warn('[getCurrentUserId] Error extracting from cookie:', e);
    }
    
    console.warn('[getCurrentUserId] No user ID found');
    return '';
  } catch (e) {
    console.error('[getCurrentUserId] Error:', e);
    return '';
  }
}

/**
 * Ensure sentence IDs are created for words with example sentences
 * @param {Array} wordObjs - Array of word objects
 * @returns {Promise<Object>} {inserted: number}
 */
export async function ensureSentenceIdsBuilder(wordObjs, opts = {}) {
  try {
    if (!Array.isArray(wordObjs) || !wordObjs.length) return { inserted: 0 };
    
    const norm = s => (s || '').trim().replace(/\s+/g, ' ');
    // Case-insensitive key for reliable text matching (backend may return different casing)
    const normKey = s => norm(s).toLowerCase();
    const targets = wordObjs.filter(w => {
      const currentText = norm(w.example || w.legacy_sentence || '');
      if (!currentText || currentText.split(/\s+/).length < 3) return false;

      // Case 1: No sentence identity yet — needs processing
      if (!w.primary_sentence_id && !(Array.isArray(w.sentences) && w.sentences.length)) return true;

      // Case 2: Has identity but the text has CHANGED (teacher edited sentence)
      if (Array.isArray(w.sentences) && w.sentences.length) {
        const persistedText = norm(
          (w.sentences.find(s => s && typeof s === 'object' && s.text) || {}).text || ''
        );
        if (persistedText && normKey(persistedText) !== normKey(currentText)) {
          // Clear stale identity so backend creates a fresh sentence row + audio
          delete w.primary_sentence_id;
          w.sentences = [];
          return true;
        }
      }

      return false;
    });
    
    console.log('[SentenceUpgrade][builder] targets:', targets.length, 'of', wordObjs.length, 'words');
    if (!targets.length) return { inserted: 0 };
    
    const map = new Map();
    for (const w of targets) {
      const raw = w.legacy_sentence || w.example || '';
      if (raw && raw.split(/\s+/).length >= 3) {
        const n = norm(raw);
        const key = normKey(raw);
        if (key && !map.has(key)) {
          map.set(key, { text: n, words: [w.eng].filter(Boolean) });
        }
      }
    }
    
    if (!map.size) { console.warn('[SentenceUpgrade][builder] no sentences to send'); return { inserted: 0 }; }
    
    const sentenceList = Array.from(map.values());
    console.log('[SentenceUpgrade][builder] sending', sentenceList.length, 'unique sentences to backend');
    
    const payload = {
      action: 'upsert_sentences_batch',
      sentences: sentenceList
    };
    if (opts.forceNewIds) payload.force_new_ids = true;
    
    // Use WillenaAPI.fetch if available (handles routing + auth), fallback to raw fetch
    const doFetch = (typeof WillenaAPI !== 'undefined' && WillenaAPI.fetch)
      ? WillenaAPI.fetch.bind(WillenaAPI)
      : (url, init) => fetch(url, { ...init, credentials: 'include' });
    
    const res = await doFetch('/.netlify/functions/upsert_sentences_batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const js = await res.json().catch(() => null);
    
    if (js && js.audio) {
      console.log('[SentenceUpgrade][builder][audio] summary', js.audio);
    }
    if (js && js.audio_status) {
      console.log('[SentenceUpgrade][builder][audio_status sample]', js.audio_status.slice(0, 5));
    }
    
    if (!js || !js.success || !Array.isArray(js.sentences)) {
      console.warn('[SentenceUpgrade][builder] batch FAILED', { status: res.status, ok: res.ok, body: js });
      return { inserted: 0, backend: false };
    }
    
    console.log('[SentenceUpgrade][builder] backend returned', js.sentences.length, 'sentences');
    
    // Build case-insensitive text map for reliable matching
    const byText = new Map(js.sentences.map(r => [normKey(r.text), r]));
    let applied = 0;
    
    for (const w of targets) {
      const raw = w.legacy_sentence || w.example || '';
      const rec = byText.get(normKey(raw));
      if (rec && rec.id) {
        const sentObj = { id: rec.id, text: rec.text };
        if (rec.audio_key) sentObj.audio_key = rec.audio_key;
        w.sentences = [sentObj];
        w.primary_sentence_id = rec.id;
        applied++;
      } else {
        console.warn('[SentenceUpgrade][builder] NO MATCH for word:', w.eng, 'sentence:', raw.substring(0, 60));
      }
    }
    
    console.log('[SentenceUpgrade][builder] ✓ applied sentence IDs:', applied, '/', targets.length,
      'sample:', targets.slice(0, 2).map(w => ({ eng: w.eng, sid: w.primary_sentence_id, ak: w.sentences?.[0]?.audio_key })));
    
    return { inserted: applied };
  } catch (e) {
    console.warn('[SentenceUpgrade][builder] ERROR:', e?.message, e);
    return { inserted: 0, error: true };
  }
}

function modeNeedsSentenceIds(mode) {
  return /sentence/i.test(String(mode || ''));
}

function payloadNeedsSentenceIds(payload) {
  const modes = Array.isArray(payload?.modes) ? payload.modes : [];
  if (modes.some(modeNeedsSentenceIds)) return true;
  return modeNeedsSentenceIds(payload?.mode);
}

function unresolvedSentenceLinks(words = []) {
  if (!Array.isArray(words)) return [];
  return words.filter((w) => {
    if (!w || typeof w !== 'object') return false;
    const sentenceFromArray = Array.isArray(w.sentences) && w.sentences.length
      ? (w.sentences.find(s => typeof s?.text === 'string' && s.text.trim())?.text || '')
      : '';
    const hasSentence = String(w.sentence || w.legacy_sentence || w.example || sentenceFromArray || '').trim().split(/\s+/).length >= 3;
    if (!hasSentence) return false;
    const nestedId = Array.isArray(w.sentences) && w.sentences.some(s => s && s.id);
    return !w.primary_sentence_id && !nestedId;
  });
}

/**
 * Prepare and upload images to R2 if needed
 * @param {Object} payload - Game payload with words and gameImage
 * @param {string} gameId - Current game ID
 * @param {Object} opts - Options {force: boolean}
 * @returns {Promise<Object>} Updated payload
 */
export async function prepareAndUploadImagesIfNeeded(payload, gameId, opts = {}) {
  try {
    const R2_PREFIX = window.R2_PUBLIC_BASE || 'https://';
    const toUpload = [];
    // -------------------------------------------------------------
    // Stable folder naming (Option B): payload.image_folder
    // Rules:
    //  * If payload.image_folder exists -> reuse.
    //  * Else attempt to extract from any existing /words/<folder>/ image_url.
    //  * Else generate slug(title)+"-"+4char code and persist onto payload.image_folder.
    //  * We no longer rely on global gb_image_folder_v1 so different games don't collide.
    //  * gameId param (DB id) is NOT used for image folder naming anymore (decoupled).
    function slugify(t){ return (t||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48) || 'untitled'; }
    let folder = (payload && payload.image_folder) || null;
    if (!folder) {
      // Try extract from existing word image
      try {
        const sampleWord = (payload.words||[]).find(w => w && typeof w.image_url === 'string' && /\/words\//.test(w.image_url));
        if (sampleWord) {
          const m = sampleWord.image_url.match(/\/words\/([^\/]+)\//);
          if (m && m[1]) folder = m[1];
        }
      } catch {}
    }
    if (!folder) {
      const base = slugify(payload.title || payload.gameTitle || 'untitled');
      const code = Math.random().toString(36).slice(2,6);
      folder = `${base}-${code}`;
    }
    // Persist on payload for future saves and for DB storage (so when reloading builder we keep same folder)
    try { payload.image_folder = folder; } catch {}
    
    // Check each word image
    payload.words.forEach((w, i) => {
      if (!w || !w.image_url) return;
      const url = w.image_url;
      const isProxy = /\/.netlify\/functions\/image_proxy\?key=/.test(url);
      const isR2Public = !!R2_PREFIX && url.startsWith(R2_PREFIX) && /\/words\//.test(url);
      const isData = url.startsWith('data:');
      
      const needs = isData || (!isProxy && !isR2Public && /^https?:/i.test(url));
      if (needs) toUpload.push({ index: i, source: url });
    });
    
    // Check cover image
    const coverNeeds = (() => {
      if (!payload.gameImage) return false;
      const gi = payload.gameImage;
      const isData = gi.startsWith('data:');
      const isR2 = !!R2_PREFIX && gi.startsWith(R2_PREFIX) && /\/cover\//.test(gi);
      const isProxy = /\/.netlify\/functions\/image_proxy\?key=/.test(gi);
      return isData || (!isR2 && !isProxy && /^https?:/i.test(gi));
    })();
    
    if (!toUpload.length && !coverNeeds) return payload;
    
    console.debug('[ImageUpload] Found images to process:', {
      words: toUpload.length,
      cover: coverNeeds
    });
    
    // Batch upload using /upload-images Netlify function
    try {
      const body = {
        // Use the stable image folder instead of DB game id for R2 key paths
        gameId: (folder || gameId || 'temp'),
        words: toUpload.map(t => ({ index: t.index, source: t.source })),
        cover: coverNeeds ? { source: payload.gameImage } : undefined,
        force: !!opts.force
      };
      const res = await WillenaAPI.fetch('/.netlify/functions/upload-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        console.warn('[ImageUpload] batch failed', res.status);
      } else {
        let js = null;
        try { js = await res.json(); } catch (e) { console.warn('[ImageUpload] bad JSON', e); }
        if (js) {
          // Server may return relative image_proxy URLs when R2_PUBLIC_BASE env
          // is missing. Convert them to absolute R2 public URLs client-side so
          // the stored URLs work from any origin (staging, production, etc.).
          const fixProxyUrl = (url) => {
            if (!url) return url;
            const m = url.match(/^\/?\.netlify\/functions\/image_proxy\?key=(.+)/);
            if (m) {
              const key = decodeURIComponent(m[1]);
              const base = (window.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
              if (base) return `${base}/${key}`;
            }
            return url;
          };
          if (Array.isArray(js.words)) {
            for (const w of js.words) {
              if (w && typeof w.index === 'number' && w.url && payload.words[w.index]) {
                payload.words[w.index].image_url = fixProxyUrl(w.url);
                console.debug('[ImageUpload] word', w.index, payload.words[w.index].image_url.substring(0,80));
              }
            }
          }
          if (js.cover && js.cover.url) {
            payload.gameImage = fixProxyUrl(js.cover.url);
            console.debug('[ImageUpload] cover', payload.gameImage.substring(0,80));
          }
        }
      }
    } catch (e) {
      console.warn('[ImageUpload] batch exception', e?.message);
    }
    
    return payload;
  } catch (e) {
    console.warn('[prepareAndUploadImagesIfNeeded] Error:', e);
    return payload;
  }
}

/**
 * Save game data to database
 * @param {Object} payload - Game data {title, words, gameImage}
 * @param {string} existingId - ID if updating existing game
 * @returns {Promise<Object>} {success, id, error}
 */
export async function saveGameData(payload, existingId = null) {
  try {
    // Ensure created_by is attached
    const uid = getCurrentUserId();
    if (uid) payload.created_by = uid;

    // Always ensure sentence IDs for every word before saving.
    // This is a safety net — the caller should have already called ensureSentenceIdsBuilder,
    // but if it failed or was skipped, this catch-all ensures sentence identity is created.
    if (Array.isArray(payload.words) && payload.words.length) {
      const needIds = payload.words.some(w =>
        !(w.primary_sentence_id || (Array.isArray(w.sentences) && w.sentences.length))
        && (w.example || w.legacy_sentence)
      );
      if (needIds) {
        console.log('[saveGameData] Running safety-net ensureSentenceIdsBuilder…');
        await ensureSentenceIdsBuilder(payload.words);
      }
    }
    
    const action = existingId ? 'update_game_data' : 'insert_game_data';
    let postBody = { action, data: payload };
    if (existingId) {
      postBody.id = existingId;
    }
    
    console.log('[SAVE PAYLOAD words[0..5]]', (postBody.data.words || []).slice(0, 6).map(w => ({
      eng: w.eng,
      img: (w.image_url || '').slice(0, 80),
      sentence_id: w.primary_sentence_id || null,
      audio_key: (w.sentences && w.sentences[0] && w.sentences[0].audio_key) || null,
      has_sentences: !!(w.sentences && w.sentences.length)
    })));
    
    let js = await fetchJSONSafe('/.netlify/functions/supabase_proxy_fixed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(postBody)
    });

    let savedId = existingId || null;
    let savedAsCopy = false;

    if (existingId && !js?.success && /not owner|forbidden/i.test(String(js?.error || ''))) {
      js = await fetchJSONSafe('/.netlify/functions/supabase_proxy_fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'insert_game_data', data: payload })
      });
      savedId = null;
      savedAsCopy = !!js?.success;
    }

    const responseId = js?.id || js?.data?.id || (Array.isArray(js?.data) ? js.data[0]?.id : null) || null;
    if (responseId) savedId = responseId;
    
    if (js?.success) {
      return { success: true, id: savedId, savedAsCopy };
    } else {
      return { success: false, error: js?.error || 'Save failed' };
    }
  } catch (e) {
    console.error('[saveGameData] Error:', e);
    return { success: false, error: e?.message || 'Save error' };
  }
}

/**
 * Load game data from database
 * @param {string} id - Game ID to load
 * @returns {Promise<Object>} {success, game, error}
 */
export async function loadGameData(id) {
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy_fixed?get=game_data&id=' + encodeURIComponent(id));
    if (!res.ok) {
      return { success: false, error: `Open failed (${res.status})` };
    }
    
    const js = await res.json();
    const row = js && js.data ? js.data : js;
    if (!row) {
      return { success: false, error: 'Load failed' };
    }
    
    // Parse words
    let words = row.words;
    if (typeof words === 'string') {
      try {
        words = JSON.parse(words);
      } catch {}
    }
    
    if (!Array.isArray(words) && words && typeof words === 'object') {
      if (Array.isArray(words.words)) words = words.words;
      else if (Array.isArray(words.data)) words = words.data;
      else if (Array.isArray(words.items)) words = words.items;
      else {
        const numKeys = Object.keys(words).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
        if (numKeys.length) words = numKeys.map(k => words[k]);
      }
    }
    
    if (!Array.isArray(words)) {
      console.warn('[loadGameData] Unexpected words shape', row.words);
      return { success: false, error: 'Game has no words' };
    }
    
    // Normalize image URLs: convert relative image_proxy URLs to absolute R2 public URLs
    const r2Base = (window.R2_PUBLIC_BASE || '').replace(/\/+$/, '');
    if (r2Base) {
      for (const w of words) {
        if (!w || !w.image_url) continue;
        const pm = String(w.image_url).match(/^\/?\.netlify\/functions\/image_proxy\?key=(.+)/);
        if (pm && pm[1]) {
          w.image_url = `${r2Base}/${decodeURIComponent(pm[1])}`;
        }
      }
    }
    
    let gameImg = row.gameImage || row.game_image || '';
    if (r2Base && gameImg) {
      const cm = String(gameImg).match(/^\/?\.netlify\/functions\/image_proxy\?key=(.+)/);
      if (cm && cm[1]) gameImg = `${r2Base}/${decodeURIComponent(cm[1])}`;
    }

    return {
      success: true,
      game: {
        id: row.id || id,
        title: row.title || 'Untitled Game',
        words: words,
        gameImage: gameImg,
        // Best-effort extraction of image folder for older records that predate image_folder persistence
        image_folder: (() => {
          if (row.image_folder && typeof row.image_folder === 'string') return row.image_folder;
            // Derive from any word image_url pattern /words/<folder>/
            try {
              const sample = (Array.isArray(words)?words:[]).find(w => w && typeof w.image_url === 'string' && /\/words\//.test(w.image_url));
              if (sample) {
                const m = sample.image_url.match(/\/words\/([^\/]+)\//);
                if (m && m[1]) return m[1];
              }
            } catch {}
            // Derive from cover path if available
            try {
              const cover = row.gameImage || row.game_image || '';
              if (cover && /\/cover\//.test(cover)) {
                const m2 = cover.match(/\/cover\/([^\/]+)\//);
                if (m2 && m2[1]) return m2[1];
              }
            } catch {}
          return undefined;
        })()
      }
    };
  } catch (e) {
    console.error('[loadGameData] Error:', e);
    return { success: false, error: 'Load error' };
  }
}

/**
 * Delete game data from database
 * @param {string} id - Game ID to delete
 * @returns {Promise<Object>} {success, error}
 */
export async function deleteGameData(id) {
  try {
    const js = await fetchJSONSafe('/.netlify/functions/supabase_proxy_fixed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'delete_game_data', id })
    });
    
    if (js?.success) {
      return { success: true };
    } else {
      return { success: false, error: js?.error || 'Delete failed' };
    }
  } catch (e) {
    console.error('[deleteGameData] Error:', e);
    return { success: false, error: 'Delete error' };
  }
}

/**
 * List saved games (with caching support)
 * @param {Object} opts - {limit, offset, created_by, allMode}
 * @returns {Promise<Object>} {success, data, uniqueCount, error}
 */
export async function listGameData(opts = {}) {
  const { limit = 10, offset = 0, created_by = '', allMode = false } = opts;
  
  try {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      unique: '1',
      names: '0',
      page_pull: String(limit * 4) // Oversampling for deduplication
    });
    
    if (created_by && !allMode) {
      params.set('created_by', created_by);
    }
    
    const res = await WillenaAPI.fetch('/.netlify/functions/list_game_data_unique?' + params.toString());
    if (!res.ok) {
      return { success: false, error: `List failed (${res.status})` };
    }
    
    const js = await res.json();
    
    return {
      success: true,
      data: Array.isArray(js.data) ? js.data : [],
      uniqueCount: js.unique_count || js.uniqueCount || 0
    };
  } catch (e) {
    console.error('[listGameData] Error:', e);
    return { success: false, error: 'List error' };
  }
}

/**
 * Find existing game by title for current user
 * @param {string} title - Game title to search for
 * @returns {Promise<Object|null>} Existing game row or null
 */
export async function findGameByTitle(title) {
  try {
    const currentUid = getCurrentUserId();
    const result = await listGameData({ limit: 50, offset: 0, created_by: currentUid });
    
    if (result.success && Array.isArray(result.data)) {
      return result.data.find(r =>
        r.title && r.title.trim().toLowerCase() === title.trim().toLowerCase()
      ) || null;
    }
    
    return null;
  } catch (e) {
    console.warn('[findGameByTitle] Error:', e);
    return null;
  }
}

/**
 * Generate incremented title (e.g., "Game (2)", "Game (3)")
 * @param {string} baseTitle - Base title
 * @returns {Promise<string>} Unique incremented title
 */
export async function generateIncrementedTitle(baseTitle) {
  try {
    const base = baseTitle.replace(/\s*\(\d+\)$/, '').trim();
    const currentUid = getCurrentUserId();
    const result = await listGameData({ limit: 200, offset: 0, created_by: currentUid });
    
    if (!result.success) return `${base} (2)`;
    
    const titlesLower = new Set((result.data || []).map(r => (r.title || '').toLowerCase()));
    let n = 2;
    let newTitle = `${base} (${n})`;
    
    while (titlesLower.has(newTitle.toLowerCase()) && n < 200) {
      n++;
      newTitle = `${base} (${n})`;
    }
    
    return newTitle;
  } catch {
    return `${baseTitle} (2)`;
  }
}

/**
 * Show title conflict modal and get user choice
 * @param {string} title - Conflicting title
 * @returns {Promise<string>} 'overwrite', 'increment', or 'cancel'
 */
export async function showTitleConflictModal(title) {
  return new Promise(resolve => {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.background = 'rgba(0,0,0,0.45)';
    modal.style.zIndex = '99999';
    modal.innerHTML = `<div style="background:#fff;max-width:420px;margin:10% auto;padding:20px;border-radius:12px;font-family:sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);">
      <h3 style="margin-top:0;">Title Exists</h3>
      <p style="font-size:14px;color:#334155;line-height:1.4;">You already have a game named <strong>${escapeHtml(title)}</strong>. What would you like to do?</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
        <button id="dupOverwrite" class="btn primary" style="width:100%;">Overwrite Existing</button>
        <button id="dupIncrement" class="btn" style="width:100%;background:#f1f5f9;">Save as Incremented Name</button>
        <button id="dupCancel" class="btn" style="width:100%;background:#fee2e2;color:#b91c1c;">Cancel</button>
      </div>
    </div>`;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', e => {
      if (e.target.id === 'dupOverwrite') {
        resolve('overwrite');
        modal.remove();
      } else if (e.target.id === 'dupIncrement') {
        resolve('increment');
        modal.remove();
      } else if (e.target.id === 'dupCancel') {
        resolve('cancel');
        modal.remove();
      } else if (e.target === modal) {
        resolve('cancel');
        modal.remove();
      }
    });
  });
}
