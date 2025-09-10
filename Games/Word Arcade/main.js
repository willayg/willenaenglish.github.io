// Entry point for Word Arcade (ES module)
// Rewritten with: Supabase singleton auth, robust fetchJSON, abortable audio preload,
// safer sample list URLs, inline toasts, and lazy-loaded modes.

import { playTTS, preprocessTTS, preloadAllAudio } from './tts.js';
import { playSFX } from './sfx.js';
import { renderModeSelector } from './ui/mode_selector.js';
import { renderGameView } from './ui/game_view.js';
import { showModeModal } from './ui/mode_modal.js';
import { showSampleWordlistModal } from './ui/sample_wordlist_modal.js';
import { showBrowseModal } from './ui/browse_modal.js';
import { FN } from './scripts/api-base.js';

// No direct Supabase client here. We rely on HTTP-only cookies set by Netlify functions.

// -----------------------------
// Fetch helper (timeout + JSON + JWT + nicer errors)
// -----------------------------
async function fetchJSON(url, {
  method = 'GET', timeoutMs = 15000,
  headers = {}, body, cache = 'no-store', credentials = 'include'
} = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method, cache, credentials, signal: ctrl.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const raw = await res.text().catch(() => '');
    const tryParse = () => {
      const s = (raw || '').trim();
      if (!s) return undefined;
      if (s.startsWith('{') || s.startsWith('[')) {
        try { return JSON.parse(s); } catch { return undefined; }
      }
      return undefined;
    };
    const data = tryParse();
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      if (data && (data.error || data.message)) {
        msg += ` – ${data.error || data.message}`;
      } else if (raw) {
        msg += ` – ${raw.slice(0, 160)}`;
      }
      const e = new Error(msg);
      e.status = res.status;
      throw e;
    }
    return data !== undefined ? data : raw;
  } finally {
    clearTimeout(t);
  }
}

// -----------------------------
// Inline toast helper (non-blocking alerts)
// -----------------------------
function inlineToast(msg, opts = {}) {
  const { timeout = 3200 } = opts;
  let host = document.getElementById('wa_toast_host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'wa_toast_host';
    host.style.position = 'fixed';
    host.style.left = '50%';
    host.style.bottom = '24px';
    host.style.transform = 'translateX(-50%)';
    host.style.zIndex = '9999';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.background = 'rgba(25,119,126,.95)';
  el.style.color = '#fff';
  el.style.padding = '10px 14px';
  el.style.marginTop = '8px';
  el.style.borderRadius = '10px';
  el.style.boxShadow = '0 6px 24px rgba(0,0,0,.18)';
  el.style.font = '14px/1.4 system-ui, Arial, sans-serif';
  el.style.maxWidth = '86vw';
  el.style.textAlign = 'center';
  el.style.opacity = '0';
  el.style.transition = 'opacity .2s ease, transform .2s ease';
  el.style.transform = 'translateY(8px)';
  host.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 240);
  }, timeout);
}

// -----------------------------
// App state
// -----------------------------
let wordList = [];
let currentMode = null;
let currentListName = null;
let currentPreloadAbort = null; // for abortable audio preload

const gameArea = document.getElementById('gameArea');

// -----------------------------
// Session cache (non-persistent across browser restarts)
// -----------------------------
function saveSessionState() {
  try {
    if (Array.isArray(wordList) && wordList.length) {
      sessionStorage.setItem('WA_words', JSON.stringify(wordList));
    }
    if (currentListName) sessionStorage.setItem('WA_list_name', String(currentListName));
  } catch {}
}

function restoreSessionStateIfEmpty() {
  try {
    if (!Array.isArray(wordList) || wordList.length === 0) {
      const raw = sessionStorage.getItem('WA_words');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length) {
          wordList = arr;
        }
      }
    }
    if (!currentListName) {
      const ln = sessionStorage.getItem('WA_list_name');
      if (ln) currentListName = ln;
    }
  } catch {}
}

// -----------------------------
// UI helpers
// -----------------------------
function showOpeningButtons(visible) {
  const btns = document.getElementById('openingButtons');
  if (btns) btns.style.display = visible ? '' : 'none';
}

function showProgress(message, progress = 0) {
  showOpeningButtons(false);
  gameArea.innerHTML = `<div style="text-align:center;padding:40px;font-family:Arial,sans-serif;">
    <h3 style="margin-bottom:20px;color:#333;">${message}</h3>
    <div style="width:300px;height:20px;background:#f0f0f0;border-radius:10px;margin:20px auto;overflow:hidden;" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}">
      <div id="progressBar" style="height:100%;background:linear-gradient(90deg,#41b6beff,#248b86ff);border-radius:10px;width:${progress}%;transition:width .3s ease;"></div>
    </div>
    <div style="margin-top:10px;color:#666;font-size:14px;">${Math.round(progress)}% complete</div>
  </div>`;
}

function showGameStart(callback) {
  gameArea.innerHTML = `<div style="text-align:center;padding:40px;font-family:Arial,sans-serif;opacity:0;" id="gameStartContent">
    <h2 style="color:#4CAF50;margin-bottom:20px;">Ready!</h2>
    <p style="color:#333;font-size:18px;">All ${wordList.length} words loaded successfully</p>
    <p style="color:#666;margin-top:20px;">Starting game...</p>
  </div>`;
  playSFX('begin-the-game');
  const content = document.getElementById('gameStartContent');
  setTimeout(() => { content.style.transition = 'opacity .8s ease-in-out'; content.style.opacity = '1'; }, 100);
  setTimeout(callback, 2000);
}

function showInlineError(text, onRetry) {
  gameArea.innerHTML = `<div style="text-align:center;padding:40px;font-family:Arial,sans-serif;">
    <h3 style="margin-bottom:14px;color:#e53e3e;">We couldn't prepare all audio</h3>
    <div style="color:#555;margin-bottom:16px;">${text}</div>
    <button id="retryPreload" style="font-size:1em;padding:10px 22px;border-radius:10px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,.08);cursor:pointer;">Retry</button>
    <button id="pickDifferent" style="font-size:1em;padding:10px 22px;border-radius:10px;background:#19777e;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,.08);cursor:pointer;margin-left:10px;">Choose Lesson</button>
  </div>`;
  document.getElementById('retryPreload')?.addEventListener('click', onRetry);
  document.getElementById('pickDifferent')?.addEventListener('click', () => {
    showOpeningButtons(true);
    gameArea.innerHTML = '';
  });
}

// -----------------------------
// Core flow
// -----------------------------
async function callProgressSummary(section, params = {}) {
  const url = new URL(FN('progress_summary'), window.location.origin);
  url.searchParams.set('section', section);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  // Use cookie-based auth only
  return fetchJSON(url.toString());
}

async function fetchChallengingWords() {
  const list = await callProgressSummary('challenging');
  if (!Array.isArray(list)) return [];
  // Client-side safety: remove any bracketed [picture] tokens and surrounding dashes/punctuation
  const sanitize = (s) => {
    if (!s || typeof s !== 'string') return '';
    let t = s;
    t = t.replace(/[\[\(\{]\s*picture\s*[\]\)\}]\s*[-–—_:]*\s*/gi, '');
    t = t.replace(/\s*[\[\(\{]\s*picture\s*[\]\)\}]\s*/gi, ' ');
    t = t.replace(/^[\s\-–—_:,.;'"`~]+/, '').replace(/[\s\-–—_:,.;'"`~]+$/, '');
    t = t.replace(/\s{2,}/g, ' ');
    return t.trim();
  };
  const out = list.map(it => {
    const eng = it.word_en || it.word || it.eng || '';
    const kor = it.word_kr || it.kor || it.translation || '';
    const def = it.def || it.definition || it.meaning || '';
    const w = { eng: sanitize(String(eng).trim()), kor: sanitize(String(kor || '').trim()) };
    if (def && String(def).trim()) w.def = String(def).trim();
    return w;
  }).filter(w => w.eng && w.kor)
    .filter(w => {
      const isPlaceholder = (s) => {
        if (!s) return false; const t = String(s).trim().toLowerCase();
        const core = t.replace(/^[\s\[\(\{]+|[\s\]\)\}]+$/g, '');
        return t === '[picture]' || core === 'picture';
      };
      return !isPlaceholder(w.eng) && !isPlaceholder(w.kor);
    });
  return out;
}

async function processWordlist(data) {
  try {
    wordList = Array.isArray(data) ? data : [];
    if (!wordList.length) throw new Error('No words provided');
  // Save early so UI can reflect title/list even if user navigates quickly
  saveSessionState();

    // cancel any in-flight preload
    if (currentPreloadAbort) currentPreloadAbort.abort();
    currentPreloadAbort = new AbortController();

    showProgress('Preparing audio files...', 0);

    // NOTE: ensure your preloadAllAudio supports an options object with { signal }.
    // If it doesn't yet, adding a third arg is safe (it will be ignored until implemented).
    await preloadAllAudio(wordList, ({ phase, word, progress }) => {
      const phaseText = phase === 'checking' ? 'Checking existing files' : phase === 'generating' ? 'Generating missing audio' : 'Loading audio files';
      showProgress(`${phaseText}<br><small>Current: ${word || ''}</small>`, progress || 0);
    }, { signal: currentPreloadAbort.signal });

    showGameStart(() => startModeSelector());

  } catch (err) {
    if (err?.name === 'AbortError') return; // user changed lists
    console.error('Error processing word list:', err);
    const missing = err && err.details && Array.isArray(err.details.missingAfter) ? err.details.missingAfter : [];
    const friendly = missing.length
      ? `Some audio files could not be prepared (${missing.length}). Please try again or pick another lesson.`
      : `Error processing word list: ${err.message}`;
    showInlineError(friendly, () => processWordlist(data));
  }
}

async function loadSampleWordlistByFilename(filename) {
  try {
    if (!filename) throw new Error('No filename');
    // optional filename safety if user-provided
    if (!/^[A-Za-z0-9._-]+$/.test(filename)) throw new Error('Invalid filename');

    currentListName = filename || 'Sample List';
    const url = new URL(`./sample-wordlists/${filename}`, import.meta.url);
    const res = await fetch(url.href, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await res.json() : JSON.parse(await res.text());
    await processWordlist(data);
  } catch (err) {
    inlineToast('Error loading sample word list: ' + err.message);
  }
}

function startModeSelector() {
  showOpeningButtons(false);
  // Ensure we have any cached state back in memory for UI headers
  restoreSessionStateIfEmpty();
  renderModeSelector({
    onModeChosen: (mode) => { currentMode = mode; startGame(mode); },
    onWordsClick: (filename) => { if (filename) loadSampleWordlistByFilename(filename); },
  });
}

function startFilePicker() {
  showOpeningButtons(true);
  showSampleWordlistModal({ onChoose: (filename) => { if (filename) loadSampleWordlistByFilename(filename); } });
}

// -----------------------------
// Lazy-load modes for better initial paint
// -----------------------------
const modeLoaders = {
  meaning:        () => import('./modes/meaning.js').then(m => m.runMeaningMode),
  spelling:       () => import('./modes/spelling.js').then(m => m.runSpellingMode),
  listening:      () => import('./modes/listening.js').then(m => m.runListeningMode),
  picture:        () => import('./modes/picture.js').then(m => m.runPictureMode),
  easy_picture:   () => import('./modes/easy_picture.js').then(m => m.runEasyPictureMode),
  listen_and_spell: () => import('./modes/listen_and_spell.js').then(m => m.runListenAndSpellMode),
  multi_choice:   () => import('./modes/multi_choice.js').then(m => m.runMultiChoiceMode),
  level_up:       () => import('./modes/level_up.js').then(m => m.runLevelUpMode),
};

export async function startGame(mode = 'meaning') {
  showOpeningButtons(false);
  if (!wordList.length) { showOpeningButtons(true); gameArea.innerHTML = ''; return; }

  renderGameView({
    modeName: mode,
    onShowModeModal: () => {
      showModeModal({
        onModeChosen: (newMode) => { currentMode = newMode; startGame(newMode); },
        onClose: () => {}
      });
    },
    onWordsClick: (filename) => { if (filename) loadSampleWordlistByFilename(filename); },
    onModeClick: (newMode) => { if (newMode) { currentMode = newMode; startGame(newMode); } },
  });

  const pick = modeLoaders[mode] || modeLoaders.meaning;
  const run = await pick();
  const ctx = { wordList, gameArea, playTTS, preprocessTTS, startGame, listName: currentListName };
  run(ctx);
}

// In-game progress bar helpers
export function showGameProgress(total, current = 0) {
  const wrap = document.getElementById('gameProgressBar');
  const fill = document.getElementById('gameProgressFill');
  const txt = document.getElementById('gameProgressText');
  if (!wrap || !fill || !txt) return;
  wrap.style.display = '';
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
  fill.style.width = pct + '%';
  txt.textContent = `${current}/${total}`;
  wrap.setAttribute('aria-valuemin', '0');
  wrap.setAttribute('aria-valuemax', String(total));
  wrap.setAttribute('aria-valuenow', String(current));
}

export function updateGameProgress(current, total) {
  const fill = document.getElementById('gameProgressFill');
  const txt = document.getElementById('gameProgressText');
  const wrap = document.getElementById('gameProgressBar');
  if (!fill || !txt || !wrap) return;
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
  fill.style.width = pct + '%';
  txt.textContent = `${current}/${total}`;
  wrap.setAttribute('aria-valuenow', String(current));
  if (current >= total) hideGameProgress();
}

export function hideGameProgress() {
  const wrap = document.getElementById('gameProgressBar');
  if (wrap) wrap.style.display = 'none';
}

// Saved games modal via Netlify proxy
async function openSavedGamesModal() {
  await showBrowseModal({
    onOpen: async (id, dismiss) => { await openSavedGameById(id); if (dismiss) dismiss(); },
    onClose: () => {}
  });
}

async function openSavedGameById(id) {
  try {
  const js = await fetchJSON(`${FN('supabase_proxy_fixed')}?get=game_data&id=${encodeURIComponent(id)}`);
    const row = js?.data || js;
    if (!row) {
      inlineToast('Saved game not found or invalid.');
      return;
    }
    // Normalize words: can be array, JSON string, or nested under a subkey
    let words = row.words;
    if (typeof words === 'string') {
      try { words = JSON.parse(words); } catch { /* leave as-is */ }
    }
    if (!Array.isArray(words) && words && typeof words === 'object') {
      // Try common subkeys
      if (Array.isArray(words.words)) words = words.words;
      else if (Array.isArray(words.data)) words = words.data;
      else if (Array.isArray(words.items)) words = words.items;
      else {
        // Convert dictionary with numeric keys into array
        const vals = Object.keys(words).sort((a,b)=>Number(a)-Number(b)).map(k => words[k]);
        if (vals.length) words = vals;
      }
    }
    if (!Array.isArray(words)) {
      try { console.warn('[WordArcade] Saved game words has unexpected shape:', row.words); } catch {}
      inlineToast('Saved game not found or invalid.');
      return;
    }
    const mapped = words.map(w => {
      if (typeof w === 'string') {
        // support "eng, kor" lines
        const parts = w.split(/[,|]/);
        const eng = (parts[0] || '').trim();
        const kor = (parts[1] || '').trim();
        return eng ? { eng, kor } : null;
      }
      const eng = w.eng || w.en || w.word || '';
      const kor = w.kor || w.kr || w.translation || '';
      const def = w.def || w.definition || w.gloss || w.meaning || '';
      const rawImg = w.image_url || w.image || w.img || w.img_url || w.picture || '';
      const img = (typeof rawImg === 'string') ? rawImg.trim() : '';
      const out = { eng: String(eng).trim(), kor: String(kor).trim() };
      if (def && String(def).trim()) out.def = String(def).trim();
      if (img && img.toLowerCase() !== 'null' && img.toLowerCase() !== 'undefined') out.img = img;
      return out;
    }).filter(w => w && w.eng);
    if (!mapped.length) {
      inlineToast('This saved game has no words.');
      return;
    }
    currentListName = row.title || 'Saved Game';
    await processWordlist(mapped);
  } catch (e) {
  if (e.code === 'NOT_AUTH' || /Not signed in/i.test(e.message)) {
      inlineToast('Please sign in to open saved games.');
      return;
    }
    console.error('Failed to open saved game', e);
    inlineToast('Could not open the saved game.');
  }
}

// Wire up opening page buttons after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Try restoring session state so the mode menu or headers can show last list
  restoreSessionStateIfEmpty();
  const basicBtn = document.getElementById('basicWordsBtn');
  const reviewBtn = document.getElementById('reviewBtn');
  const browseBtn = document.getElementById('browseBtn');
  if (basicBtn) basicBtn.addEventListener('click', () => {
    showSampleWordlistModal({ onChoose: (filename) => { if (filename) loadSampleWordlistByFilename(filename); } });
  });
  if (reviewBtn) reviewBtn.addEventListener('click', () => { loadChallengingAndStart(); });
  if (browseBtn) browseBtn.addEventListener('click', () => { openSavedGamesModal(); });
});

// Optional: expose for console debugging and UI querying
window.WordArcade = {
  startGame,
  startFilePicker,
  startModeSelector,
  getWordList: () => wordList,
  getListName: () => currentListName,
  openSavedGames: () => openSavedGamesModal(),
};

// Review flow using secure endpoint
async function loadChallengingAndStart() {
  try {
    let cleaned = await fetchChallengingWords();
    if (!cleaned.length) {
      inlineToast('No challenging words to review yet.');
      return;
    }
    // Cap to 10 hardest/due items
    cleaned = cleaned.slice(0, 10);
    // Preview modal
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:10000;display:flex;align-items:center;justify-content:center;padding:12px;';
    const modal = document.createElement('div');
    modal.style.cssText = 'width:min(520px,92vw);max-height:86vh;background:#fff;border-radius:16px;border:2px solid #67e2e6;box-shadow:0 8px 30px rgba(0,0,0,0.2);overflow:hidden;display:flex;flex-direction:column;';
    modal.innerHTML = `
      <div style="padding:12px 14px;border-bottom:1px solid #e6eaef;display:flex;align-items:center;justify-content:space-between;">
        <div style="font-weight:800;color:#19777e;">Review Preview</div>
        <button id="rvwClose" style="appearance:none;border:none;background:#fff;color:#19777e;font-weight:800;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:10px 12px;">
        <div style="color:#248b86ff;margin-bottom:8px;font-weight:700;">You will review these ${cleaned.length} difficult words:</div>
        <div id="rvwList" style="max-height:48vh;overflow:auto;border:1px solid #e6eaef;border-radius:10px;padding:8px;">
          ${cleaned.map(w => `<div style='display:flex;align-items:center;justify-content:space-between;padding:6px 4px;border-bottom:1px dashed #edf1f4;'><span style='font-weight:800;color:#19777e;'>${(w.eng||w.word||'').toString()}</span><span style='color:#6b7a8f;margin-left:8px;'>${(w.kor||w.word_kr||'').toString()}</span></div>`).join('')}
        </div>
        <div style="margin-top:10px;font-size:12px;color:#888;">Scoring in Review: +3 points per correct answer.</div>
      </div>
      <div style="padding:10px 12px;border-top:1px solid #e6eaef;display:flex;justify-content:flex-end;gap:8px;">
        <button id="rvwCancel" class="btn-ghost" style="background:#fff;border:1px solid #e6eaef;border-radius:12px;padding:10px 14px;cursor:pointer;">Cancel</button>
        <button id="rvwStart" class="btn-primary" style="background:#19777e;color:#fff;border:1px solid #19777e;border-radius:12px;padding:10px 14px;cursor:pointer;">Start</button>
      </div>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    const dismiss = () => { try { overlay.remove(); } catch {} };
    modal.querySelector('#rvwClose')?.addEventListener('click', dismiss);
    modal.querySelector('#rvwCancel')?.addEventListener('click', dismiss);
    modal.querySelector('#rvwStart')?.addEventListener('click', async () => {
      dismiss();
      currentListName = 'Review List';
      await processWordlist(cleaned.map(w => ({ eng: w.eng || w.word, kor: w.kor || w.word_kr, def: w.def })));
    });
  } catch (e) {
    if (e.code === 'NOT_AUTH' || /Not signed in/i.test(e.message)) {
      inlineToast('Please sign in to use Review.');
      return;
    }
    console.error('Failed to load challenging words:', e);
    inlineToast('Could not load your review list. Please try again.');
  }
}
