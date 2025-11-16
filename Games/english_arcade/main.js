// Entry point for Word Arcade (ES module)
// Rewritten with: Supabase singleton auth, robust fetchJSON, abortable audio preload,
// safer sample list URLs, inline toasts, and lazy-loaded modes.

import { playTTS, playTTSVariant, preprocessTTS, preloadAllAudio } from './tts.js';
import { playSFX } from './sfx.js';
import { renderModeSelector } from './ui/mode_selector.js';
import { showGrammarModeSelector } from './ui/grammar_mode_selector.js';
import { renderGameView } from './ui/game_view.js';
import { showModeModal } from './ui/mode_modal.js';
import { showSampleWordlistModal } from './ui/sample_wordlist_modal.js';
import { showBrowseModal } from './ui/browse_modal.js';
import { showPhonicsModal } from './ui/phonics_modal.js';
import { showLevel2Modal } from './ui/level2_modal.js';
import { showLevel3Modal } from './ui/level3_modal.js';
import { showLevel4Modal } from './ui/level4_modal.js';
import { showGrammarL1Modal } from './ui/level1_grammar_modal.js';
import { showGrammarL2Modal } from './ui/level2_grammar_modal.js';
// Ensure star overlay script is loaded once; it attaches window.showRoundStars
import './ui/star_overlay.js';
import { FN } from './scripts/api-base.js';
// Review manager (provenance + enrichment for review attempts)
// Legacy review manager (kept for rollback) not needed for new flow.
// import { ReviewManager } from './modes/review.js';
import { showReviewSelectionModal, runReviewSession } from './modes/review_session.js';
// History manager for browser back button support
import { historyManager } from './history-manager.js';
// Progress cache for instant progress bar loading
import { progressCache } from './utils/progress-cache.js';
import { LEVEL1_LISTS, LEVEL2_LISTS, LEVEL3_LISTS, LEVEL4_LISTS, PHONICS_LISTS } from './utils/level-lists.js';
import { prefetchAllProgress, loadStarCounts } from './utils/progress-data-service.js';

// -----------------------------
// Auth redirect helper
// -----------------------------
function redirectToStudentLogin() {
  try {
    const already = new URL(location.href);
    const next = encodeURIComponent(already.pathname + already.search + already.hash);
    // Avoid infinite loop if we're already on the student login
    if (/\/students\/login\.html$/i.test(already.pathname)) return;
    location.href = `/students/login.html?next=${next}`;
  } catch {
    location.href = '/students/login.html';
  }
}

// No direct Supabase client here. We rely on HTTP-only cookies set by Netlify functions.

// -----------------------------
// Fetch helper (timeout + JSON + JWT + nicer errors)
// -----------------------------
async function fetchJSON(url, {
  method = 'GET', timeoutMs = 15000,
  headers = {}, body, cache = 'no-store', credentials = 'include',
  externalSignal
} = {}) {
  const ctrl = new AbortController();
  // Allow callers to abort via their own signal
  try { if (externalSignal) externalSignal.addEventListener('abort', () => { try { ctrl.abort(); } catch {} }); } catch {}
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
      const serverMsg = (data && (data.error || data.message)) || raw.slice(0,160);
      if (serverMsg) msg += ` – ${serverMsg}`;
      const e = new Error(msg);
      e.status = res.status;
      // Detect auth issues: 401/403 or recognizable error strings
      const authLike = res.status === 401 || res.status === 403 || /not\s*signed\s*in|not\s*auth|no\s*session/i.test(serverMsg || '');
      if (authLike) {
        // Schedule redirect after small delay so calling code can stop UI work
        setTimeout(() => redirectToStudentLogin(), 50);
      }
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
let activeModeCleanup = null; // optional cleanup function returned by mode runners

// Navigation cancellation epoch: bump this to cancel any in-flight async flows
let __navEpoch = 0;
// Track any pending splash screen timeout so we can cancel it
let __pendingSplashTimeout = null;

// Abort any ongoing preload/game work when user navigates back
function __abortInFlight() {
  // Increment epoch so pending async continuations bail out
  __navEpoch++;
  // Cancel pending splash screen timeout
  if (__pendingSplashTimeout) {
    clearTimeout(__pendingSplashTimeout);
    __pendingSplashTimeout = null;
  }
  // Abort audio preload if running
  if (currentPreloadAbort) {
    try { currentPreloadAbort.abort(); } catch {}
    currentPreloadAbort = null;
  }
  // Stop any active mode to prevent stray timers/callbacks
  destroyModeIfActive();
  // Clear the gameArea to remove any loading/splash screens
  if (gameArea) gameArea.replaceChildren();
}

// -------------------------------------------------------------
// Image normalization (handles builder refactor differences)
// -------------------------------------------------------------
// Some newer builder saves may store raw keys like "words/apple.jpg" or legacy
// variants like "images/words/apple.jpg" or even double-prefixed forms.
// Older saved games may already contain full https URLs (Pixabay or R2 public).
// This helper upgrades every word entry so that downstream modes can rely on
// a consistent `.img` field when an image is available.
// Strategy:
// 1. Detect a public base from (priority): window.R2_PUBLIC_BASE (builder),
//    <meta name="r2-public-base"> tag, or fallback null (means leave relative).
// 2. If a value looks like a relative key (no http/https/data:) build absolute.
// 3. Strip unintended leading segments: images/, public/, / before joining.
// 4. Preserve original field if already absolute; set word.img unified alias.
function normalizeImageUrl(raw, base) {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  
  // CRITICAL FIX: Strip legacy /images/ prefix from absolute R2 URLs
  // Pattern: https://pub-xxx.r2.dev/images/words/... → https://pub-xxx.r2.dev/words/...
  if (/^https?:\/\/[^/]+\.r2\.dev\/images\/words\//i.test(s)) {
    s = s.replace(/\/images\/words\//i, '/words/');
    console.log('[normalizeImageUrl] Stripped /images/ prefix:', s.substring(0, 80));
  }
  
  // Already absolute or data URI or Netlify proxy - return as-is after legacy fix
  if (/^(?:https?:)?\/\//i.test(s) || s.startsWith('data:') || /\.netlify\/functions\/image_proxy/.test(s)) return s;
  
  // For relative paths: clean up legacy prefixes
  s = s.replace(/^\/+/, '');
  s = s.replace(/^(?:images\/)+/i,'');
  s = s.replace(/^(?:public\/)+/i,'');
  
  // Build absolute if base available
  if (!base) return s;
  const cleanBase = base.replace(/\/$/, '');
  return cleanBase + '/' + s;
}

function detectR2Base() {
  try {
    if (window.R2_PUBLIC_BASE && /^(https?:)?\/\//i.test(window.R2_PUBLIC_BASE)) return window.R2_PUBLIC_BASE;
    const meta = document.querySelector('meta[name="r2-public-base"], meta[name="wa-r2-base"], meta[name="r2-base"]');
    if (meta) {
      const v = (meta.getAttribute('content')||'').trim();
      if (v && /^(https?:)?\/\//i.test(v) && !/your_r2_public_base/i.test(v)) return v;
    }
  } catch {}
  return null;
}

function normalizeWordImages(list) {
  const base = detectR2Base();
  for (const w of list) {
    if (!w || typeof w !== 'object') continue;
    // Gather candidate from any field (mimicking mini player's multi-alias approach)
    const candidate = w.image_url || w.image || w.img || w.picture || '';
    const norm = normalizeImageUrl(candidate, base);
    if (norm) {
      // ALWAYS overwrite all image field variants with normalized URL
      // (fixes bug where existing fields had bad /images/ prefix that wasn't being replaced)
      w.img = norm;
      w.image_url = norm;
      w.image = norm;
      w.picture = norm;
    }
  }
}

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
// Hard reset / quit helpers
// -----------------------------
function clearSessionState() {
  try {
    sessionStorage.removeItem('WA_words');
    sessionStorage.removeItem('WA_list_name');
  } catch {}
}

function resetProgressBar() {
  const wrap = document.getElementById('gameProgressBar');
  const fill = document.getElementById('gameProgressFill');
  const txt = document.getElementById('gameProgressText');
  if (fill) fill.style.width = '0%';
  if (txt) txt.textContent = '0/0';
  if (wrap) wrap.style.display = 'none';
}

function destroyModeIfActive() {
  try { if (typeof activeModeCleanup === 'function') activeModeCleanup(); } catch (e) { console.warn('[WordArcade] Mode cleanup error', e); }
  activeModeCleanup = null;
}

function clearCurrentGameState({ keepWordList = false } = {}) {
  // Abort any pending audio work
  if (currentPreloadAbort) { try { currentPreloadAbort.abort(); } catch {} }
  currentPreloadAbort = null;
  destroyModeIfActive();
  if (!keepWordList) {
    wordList = [];
    currentListName = null;
    clearSessionState();
    try { delete window.__WA_IS_PHONICS__; } catch {}
  }
  currentMode = null;
  // Clear UI surface
  if (gameArea) gameArea.replaceChildren();
  resetProgressBar();
  // Remove lingering quit button
  try { document.getElementById('wa-quit-btn')?.remove(); } catch {}
  // Remove missing audio set for safety
  try { delete window.__WA_MISSING_AUDIO; } catch {}
}

function quitToOpening(fully = false) {
  clearCurrentGameState({ keepWordList: !fully });
  // Render the real opening menu (restore original buttons and wire events)
  renderOpeningMenu();
  // Only push a new history entry if this is not triggered by a back navigation
  try {
    if (!historyManager || !historyManager.isBackNavigation) {
      historyManager.navigateToOpening();
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
  // Store timeout so it can be cancelled if user presses back
  __pendingSplashTimeout = setTimeout(callback, 2000);
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
async function callProgressSummary(section, params = {}, opts = {}) {
  const url = new URL(FN('progress_summary'), window.location.origin);
  url.searchParams.set('section', section);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  // Use cookie-based auth only
  return fetchJSON(url.toString(), {
    timeoutMs: typeof opts.timeoutMs === 'number' ? opts.timeoutMs : 15000,
    cache: 'no-store',
    credentials: 'include',
    externalSignal: opts.signal,
  });
}

// Lightweight in-memory cache for review candidates
let __reviewCache = { words: null, ts: 0, inflight: null };

async function fetchChallengingWords(opts = {}) {
  // Prefer new v2 algorithm; allow fallback if disabled globally
  const sectionPrimary = (window.__WA_REVIEW_ALGO === 'legacy') ? 'challenging' : 'challenging_v2';
  let list;
  try {
    list = await callProgressSummary(sectionPrimary, {}, { signal: opts.signal, timeoutMs: opts.timeoutMs });
  } catch (e) {
    // Fallback to legacy endpoint quickly on error/timeout
    try { list = await callProgressSummary('challenging', {}, { signal: opts.signal, timeoutMs: Math.min(8000, opts.timeoutMs || 8000) }); } catch {}
  }
  if (!Array.isArray(list)) return [];
  // Enforce fixed rule: include only words with >= 2 incorrect attempts when available
  try {
    list = list.filter(it => {
      if (!it || typeof it !== 'object') return false;
      const wrong = (typeof it.incorrect === 'number') ? it.incorrect
        : (typeof it.incorrect_total === 'number') ? it.incorrect_total
        : null;
      // If we can't determine, keep it (backend may already have enforced); else require >= 2
      return (wrong == null) ? true : (Number(wrong) >= 2);
    });
  } catch {}
  const hasHangul = (s) => /[\u3131-\uD79D\uAC00-\uD7AF]/.test(s);
  const hasLatin = (s) => /[A-Za-z]/.test(s);
  const sanitizeToken = (s) => {
    if (!s || typeof s !== 'string') return '';
    return s
      .replace(/[\[\(\{]\s*picture\s*[\]\)\}]/gi,'')
      .replace(/^[\s\-–—_:,.;'"`~]+/, '')
      .replace(/[\s\-–—_:,.;'"`~]+$/, '')
      .replace(/\s{2,}/g,' ')
      .trim();
  };
  const sanitizeEntry = (it) => {
    if (!it || typeof it !== 'object') return null;
    let eng = sanitizeToken(String(it.word_en || it.word || it.eng || ''));
    let kor = sanitizeToken(String(it.word_kr || it.kor || it.translation || ''));
    const defRaw = it.def || it.definition || it.meaning || '';
    // Swap heuristic
    if (eng && kor && hasHangul(eng) && !hasHangul(kor) && hasLatin(kor) && !hasLatin(eng)) {
      [eng, kor] = [kor, eng];
    } else if (eng && !hasLatin(eng) && hasLatin(kor) && hasHangul(eng)) {
      [eng, kor] = [kor, eng];
    }
    if (!eng || !kor) return null;
    // Skip obvious duplicate both-Korean same string
    if (hasHangul(eng) && hasHangul(kor) && !hasLatin(eng)) {
      const a = eng.replace(/\s+/g,'').toLowerCase();
      const b = kor.replace(/\s+/g,'').toLowerCase();
      if (a === b) return null;
    }
    const def = (defRaw && String(defRaw).trim()) ? String(defRaw).trim() : undefined;
    return { eng, kor, ...(def?{def}:{} )};
  };
  const cleaned = list.map(sanitizeEntry).filter(Boolean);
  // If after cleaning we have <5, try a relaxed pass on the same data
  if (cleaned.length < 5) {
    const relaxed = list.map(it => {
      if (!it || typeof it !== 'object') return null;
      let eng = sanitizeToken(String(it.word_en || it.word || it.eng || ''));
      let kor = sanitizeToken(String(it.word_kr || it.kor || it.translation || ''));
      if (!eng || !kor) return null;
      return { eng, kor };
    }).filter(Boolean);
    // Merge any new not-already-present
    const existing = new Set(cleaned.map(w => w.eng + '|' + w.kor));
    for (const r of relaxed) {
      const key = r.eng + '|' + r.kor;
      if (!existing.has(key)) { cleaned.push(r); existing.add(key); if (cleaned.length >= 5) break; }
    }
  }
  return cleaned;
}

async function processWordlist(data) {
  try {
    const myEpoch = __navEpoch;
    wordList = Array.isArray(data) ? data : [];
    if (!wordList.length) throw new Error('No words provided');
    // Normalize image fields early (supports builder refactor differences)
    try { normalizeWordImages(wordList); } catch (e) { console.warn('[WordArcade] image normalization failed (non-fatal)', e); }
    // Save early so UI can reflect title/list even if user navigates quickly
    saveSessionState();

    // cancel any in-flight preload
    if (currentPreloadAbort) currentPreloadAbort.abort();
    currentPreloadAbort = new AbortController();

    showProgress('Preparing audio files...', 0);
    let preloadError = null;
    let preloadSummary = null;
    try {
      preloadSummary = await preloadAllAudio(wordList, ({ phase, word, progress }) => {
        const phaseText = phase === 'checking' ? 'Checking existing files' : phase === 'generating' ? 'Generating missing audio' : 'Loading audio files';
        showProgress(`${phaseText}<br><small>Current: ${word || ''}</small>`, progress || 0);
      }, { signal: currentPreloadAbort.signal });
    } catch (err) {
      if (err?.name === 'AbortError') return; // list changed mid-flight
      preloadError = err;
      console.warn('[WordArcade] Audio preload partial failure – continuing anyway.', err);
    }

    // If navigation changed (user pressed Back), bail out quietly
    if (myEpoch !== __navEpoch) return;

    showGameStart(() => {
      // If navigation changed during the splash delay, bail out
      if (myEpoch !== __navEpoch) return;
      if (preloadSummary && preloadSummary.missing && preloadSummary.missing.length) {
        inlineToast(`Audio unavailable for ${preloadSummary.missing.length} word${preloadSummary.missing.length>1?'s':''}. These will be skipped in audio modes.`);
        window.__WA_MISSING_AUDIO = new Set(preloadSummary.missing.map(w => String(w).trim().toLowerCase()));
      } else if (preloadError) {
        inlineToast('Audio problem – starting anyway.');
      }
      // Persist again in case we force-cleared earlier
      try { saveSessionState(); } catch {}
      startModeSelector();
      // One-time deferred re-render if header/title or stats didn't populate yet
      // (only needed for edge case where list name wasn't set before audio preload finished)
      // Mark that we've already rendered to prevent duplicate mode cards
      const alreadyRendered = !!currentListName;
      setTimeout(() => {
        if (myEpoch !== __navEpoch) return;
        try {
          // Skip deferred re-render if we already had a list name at first render time
          if (alreadyRendered) return;
          
          const headerTitle = document.querySelector('#modeHeader .file-title');
          const needsRerender = !headerTitle || !headerTitle.textContent || /Word List/i.test(headerTitle.textContent);
          if (currentListName && needsRerender) {
            startModeSelector();
          }
        } catch {}
      }, 180);
    });

  } catch (err) {
    if (err?.name === 'AbortError') return;
    console.error('Error processing word list (fatal):', err);
    const msg = err.message || 'Unknown error';
    showInlineError(`Error processing word list: ${msg}`, () => processWordlist(data));
  }
}

async function loadSampleWordlistByFilename(filename, { force = false, listName = null } = {}) {
  try {
    if (!filename) throw new Error('No filename');
    // optional filename safety - allow slashes for subfolders
    if (!/^[A-Za-z0-9._\/-]+$/.test(filename)) throw new Error('Invalid filename');

    // If forcing a fresh start or we still have a previous list loaded, clear previous game state first
    if (force || (Array.isArray(wordList) && wordList.length)) {
      try { clearCurrentGameState({ keepWordList: false }); } catch {}
    }

    try { window.__WA_IS_PHONICS__ = false; } catch {}

    currentListName = listName || filename || 'Sample List';
    // Attempt primary fetch plus fallback variants for names with spaces vs underscores/hyphens
    const candidates = [filename];
    // If filename contains spaces, user likely passed a friendly name; generate slug variants
    if (filename.includes(' ')) {
      const base = filename.trim();
      candidates.push(base.replace(/\s+/g, '_'));
      candidates.push(base.replace(/\s+/g, '-'));
      candidates.push(base.replace(/\s+/g, ''));
    } else if (!filename.includes('_') && !filename.includes('-')) {
      // If user passed snake or kebab originally, we already have; else also try underscore & hyphen inserts for common patterns (icecream -> ice_cream)
      if (/icecream/i.test(filename)) candidates.push(filename.replace(/icecream/i, 'ice_cream'));
      if (/sorethroat/i.test(filename)) candidates.push(filename.replace(/sorethroat/i, 'sore_throat'));
    }
    let lastErr = null; let loaded = null;
    for (const cand of Array.from(new Set(candidates))) {
      try {
        // If path already contains a slash (subfolder), use as-is; otherwise prefix with sample-wordlists/
        const path = cand.includes('/') ? `./${cand}` : `./sample-wordlists/${cand}`;
        const url = new URL(path, import.meta.url);
        const res = await fetch(url.href, { cache: 'no-store' });
        if (!res.ok) { lastErr = new Error(`HTTP ${res.status}`); continue; }
  const ct = (res.headers.get('content-type') || '').toLowerCase();
  const data = ct.includes('application/json') ? await res.json() : JSON.parse(await res.text());
  loaded = data;
  // Preserve friendly listName if provided; otherwise fall back to candidate name
  if (!listName) currentListName = cand;
  break;
      } catch (e) { lastErr = e; }
    }
    if (!loaded) throw new Error(`Failed to fetch ${filename}${lastErr ? ': ' + lastErr.message : ''}`);
    await processWordlist(loaded);
  } catch (err) {
    inlineToast('Error loading sample word list: ' + err.message);
  }
}

function startModeSelector() {
  showOpeningButtons(false);
  // Ensure we have any cached state back in memory for UI headers
  restoreSessionStateIfEmpty();
  
  // Track this state for browser back button
  // If we came from levels menu, restore back to levels menu (not opening)
  const underlyingState = currentListName ? 'levels_menu' : 'opening_menu';
  try {
    if (!historyManager || !historyManager.isBackNavigation) {
      historyManager.navigateToModeSelector({ listName: currentListName, wordCount: wordList.length, underlyingState });
    }
  } catch {}
  
  renderModeSelector({
    onModeChosen: (mode) => { currentMode = mode; startGame(mode); },
  onWordsClick: (filename) => { if (filename) loadSampleWordlistByFilename(filename, { force: true }); },
  });
}

function startFilePicker() {
  showOpeningButtons(true);
  showSampleWordlistModal({ onChoose: (filename) => { if (filename) loadSampleWordlistByFilename(filename, { force: true }); } });
}

// -----------------------------
// Lazy-load modes for better initial paint
// -----------------------------
const modeLoaders = {
  meaning:        () => import('./modes/meaning.js').then(m => m.runMeaningMode),
  sentence:       () => import('./modes/word_sentence_mode.js').then(m => m.run),
  spelling:       () => import('./modes/spelling.js').then(m => m.runSpellingMode),
  listening:      () => import('./modes/listening.js').then(m => m.runListeningMode),
  picture:        () => import('./modes/picture.js').then(m => m.runPictureMode),
  easy_picture:   () => import('./modes/easy_picture.js').then(m => m.runEasyPictureMode),
  listen_and_spell: () => import('./modes/listen_and_spell.js').then(m => m.runListenAndSpellMode),
  multi_choice:   () => import('./modes/multi_choice.js').then(m => m.runMultiChoiceMode),
  level_up:       () => import('./modes/level_up.js').then(m => m.runLevelUpMode),
  time_battle:    () => import('./modes/time_battle.js').then(m => m.run),
  // Phonics modes
  listen:         () => import('./modes/phonics_listening.js').then(m => m.runPhonicsListeningMode),
  // Read & Find should be textual read (multi_choice) for phonics; picture mode remains available separately
  read:           () => import('./modes/multi_choice.js').then(m => m.runMultiChoiceMode),
  // True missing-letter mode (new)
  missing_letter: () => import('./modes/missing_letter.js').then(m => m.runMissingLetterMode),
  phonics_listening: () => import('./modes/phonics_listening.js').then(m => m.runPhonicsListeningMode),
  // Grammar modes
  grammar_choose: () => import('./modes/grammar_mode.js').then(m => m.runGrammarMode),
  grammar_lesson: () => import('./modes/lessons/grammar_lesson.js').then(m => m.runGrammarLesson),
  grammar_lesson_it_vs_they: () => import('./modes/lessons/grammar_lesson_it_vs_they.js').then(m => m.runGrammarLessonItVsThey),
  grammar_lesson_am_are_is: () => import('./modes/lessons/grammar_lesson_am_are_is.js').then(m => m.runGrammarLessonAmAreIs),
  grammar_lesson_plurals_s: () => import('./modes/lessons/grammar_lesson_plurals_s.js').then(m => m.runGrammarLessonPluralsS),
  grammar_lesson_plurals_es: () => import('./modes/lessons/grammar_lesson_plurals_es.js').then(m => m.runGrammarLessonPluralsEs),
  grammar_lesson_plurals_ies: () => import('./modes/lessons/grammar_lesson_plurals_ies.js').then(m => m.runGrammarLessonPluralsIes),
  grammar_lesson_plurals_irregular: () => import('./modes/lessons/grammar_lesson_plurals_irregular.js').then(m => m.runGrammarLessonPluralsIrregular),
  grammar_lesson_countable_uncountable: () => import('./modes/lessons/grammar_lesson_countable_uncountable.js').then(m => m.runGrammarLessonCountableUncountable),
  grammar_lesson_this_that: () => import('./modes/lessons/grammar_lesson_this_that.js').then(m => m.runGrammarLessonThisThat),
  grammar_lesson_these_those: () => import('./modes/lessons/grammar_lesson_these_vs_those.js').then(m => m.runGrammarLessonTheseThose),
  grammar_lesson_have_has: () => import('./modes/lessons/grammar_lesson_have_has.js').then(m => m.runGrammarLessonHaveHas),
  grammar_lesson_he_she_it: () => import('./modes/lessons/grammar_lesson_he_she_it.js').then(m => m.runGrammarLessonHeShelt),
  grammar_lesson_do_does_questions: () => import('./modes/lessons/grammar_lesson_do_does_questions.js').then(m => m.runGrammarLessonDoDoesQuestions),
  grammar_lesson_is_are_questions: () => import('./modes/lessons/grammar_lesson_is_are_questions.js').then(m => m.runGrammarLessonIsAreQuestions),
  grammar_lesson_can_cant: () => import('./modes/lessons/grammar_lesson_can_cant.js').then(m => m.runGrammarLessonCanCant),
  grammar_lesson_dont_doesnt: () => import('./modes/lessons/grammar_lesson_dont_doesnt.js').then(m => m.runGrammarLessonDontDoesnt),
  grammar_lesson_isnt_arent: () => import('./modes/lessons/grammar_lesson_isnt_arent.js').then(m => m.runGrammarLessonIsntArent),
  grammar_lesson_want_wants: () => import('./modes/lessons/grammar_lesson_want_wants.js').then(m => m.runGrammarLessonWantWants),
  grammar_lesson_like_likes: () => import('./modes/lessons/grammar_lesson_like_likes.js').then(m => m.runGrammarLessonLikeLikes),
  grammar_lesson_contractions_be: () => import('./modes/lessons/grammar_lesson_contractions_be.js').then(m => m.runGrammarLessonContractionsBe),
  grammar_lesson_in_on_under: () => import('./modes/lessons/grammar_lesson_in_on_under.js').then(m => m.runGrammarLessonInOnUnder),
  grammar_fill_gap: () => import('./modes/grammar_fill_gap.js').then(m => m.runGrammarFillGapMode),
  grammar_sentence_unscramble: () => import('./modes/grammar_sentence_unscramble.js').then(m => m.runGrammarSentenceUnscramble),
  grammar_sorting: () => import('./modes/grammar_sorting.js').then(m => m.runGrammarSortingMode),
  grammar_translation_choice: () => import('./modes/grammar_translation_choice.js').then(m => m.runGrammarTranslationChoiceMode),
  grammar_find_mistake: () => import('./modes/grammar_find_mistake.js').then(m => m.runGrammarFindMistakeMode),
};

// Load and start a phonics game
async function loadPhonicsGame({ listFile, mode, listName }) {
  try {
    console.log('[loadPhonicsGame] Starting load:', { listFile, mode, listName, previousListName: currentListName });
  // Fetch the word list using the provided relative path
  const response = await fetch(`./${listFile}`);
    if (!response.ok) throw new Error(`Failed to load ${listFile}`);
    
    const wordData = await response.json();
    console.log('[loadPhonicsGame] Fetched', wordData.length, 'words');
    // Mark this as a phonics flow so the mode selector can show phonics modes/colors
    window.__WA_IS_PHONICS__ = true;
    // Set list name before processing so it's persisted alongside the words
    currentListName = listName || 'Phonics List';
    console.log('[loadPhonicsGame] Set currentListName to:', currentListName);
    // Use the standard processing pipeline so we normalize, preload audio, and SAVE session state
    await processWordlist(Array.isArray(wordData) ? wordData : []);
    console.log('[loadPhonicsGame] processWordlist complete, currentListName is now:', currentListName);
    // If a mode was preselected, jump straight in; otherwise the processor already opened the mode selector
    if (mode) { currentMode = mode; startGame(mode); }
  } catch (error) {
    console.error('Error loading phonics list:', error);
    inlineToast(`Error loading list: ${error.message}`);
    showOpeningButtons(true);
  }
}

// Load and start a grammar game
async function loadGrammarGame({ grammarFile, grammarName, grammarConfig }) {
  try {
    console.log('[loadGrammarGame] Starting grammar game:', { grammarFile, grammarName });
    showOpeningButtons(false);
    gameArea.innerHTML = '';
    currentListName = grammarName || null;
    wordList = [];
  const baseConfig = grammarConfig || {};
    
    // Mark as grammar flow
    window.__WA_IS_GRAMMAR__ = true;
    try { window.__WA_LAST_GRAMMAR__ = { grammarFile, grammarName, grammarConfig: baseConfig }; } catch {}
    
    // Show grammar mode selector first
    showGrammarModeSelector({
      grammarFile,
      grammarName,
      grammarConfig: baseConfig,
      onModeChosen: async (selection) => {
        // Now start the actual game with the chosen mode
        const memo = selection || {};
        const { mode, grammarFile: selectedFile, grammarName: selectedName, grammarConfig: selectedConfig } = memo;
        
        // Determine files to use first (needed for conditional logic below)
        const fileToUse = selectedFile || grammarFile;
        const nameToUse = selectedName || grammarName;
        const configToUse = selectedConfig || baseConfig;
        
        const loaderMap = {
          lesson: 'grammar_lesson',
          choose: 'grammar_choose',
          fill_gap: 'grammar_fill_gap',
          unscramble: 'grammar_sentence_unscramble',
          sorting: 'grammar_sorting',
          find_mistake: 'grammar_find_mistake',
          translation: 'grammar_translation_choice', // keep existing
        };
        let loaderKey = loaderMap[mode] || 'grammar_choose';
        if (mode === 'lesson') {
          loaderKey = (selectedConfig && selectedConfig.lessonModule) || memo.lessonModule || baseConfig.lessonModule || 'grammar_lesson';
        }
        const modeLoader = modeLoaders[loaderKey];
        if (!modeLoader) throw new Error('Grammar mode loader not found');
        const runGrammarMode = await modeLoader();
        
        // Remember last grammar config for restoring mode menu and back/forward
        try { window.__WA_LAST_GRAMMAR__ = { grammarFile: fileToUse, grammarName: nameToUse, grammarConfig: configToUse }; } catch {}
        // Track entering grammar game for back/forward support
        try {
          if (!historyManager || !historyManager.isBackNavigation) {
            historyManager.navigateToGame(loaderKey, { grammar: window.__WA_LAST_GRAMMAR__ });
          }
        } catch {}

        // Call grammar runner with context
        runGrammarMode({
          grammarFile: fileToUse,
          grammarName: nameToUse,
          grammarConfig: configToUse,
          renderGameView,
          showModeModal,
          playSFX,
          playTTS,
          inlineToast,
          getListName: () => currentListName,
          getUserId: () => { try { return (window.WordArcade && typeof window.WordArcade.getUserId === 'function') ? window.WordArcade.getUserId() : null; } catch { return null; } },
          FN,
          showOpeningButtons
        });
      },
      onClose: () => {
        showGrammarLevelsMenu();
      }
    });
  } catch (error) {
    console.error('Error loading grammar game:', error);
    inlineToast(`Error: ${error.message}`);
    showOpeningButtons(true);
  }
}

export async function startGame(mode = 'meaning') {
  showOpeningButtons(false);
  if (!wordList.length) { showOpeningButtons(true); gameArea.innerHTML = ''; return; }
  // Clear any previous mode (when switching)
  destroyModeIfActive();
  
  // Clear the game area before rendering new content
  gameArea.innerHTML = '';

  // Track entering game state for browser back button
  historyManager.navigateToGame(mode, { listName: currentListName, wordCount: wordList.length });

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
  const ctx = { wordList, gameArea, playTTS, playTTSVariant, preprocessTTS, startGame, listName: currentListName };
  const maybeCleanup = run(ctx);
  if (typeof maybeCleanup === 'function') activeModeCleanup = maybeCleanup;
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
async function openSavedGamesModal(underlyingState = 'opening_menu') {
  // Track that we opened the Browse modal for back/forward support
  try {
    if (!historyManager || !historyManager.isBackNavigation) {
      historyManager.navigateToModal('browseModal', underlyingState);
    }
  } catch {}
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
      // Preserve image in ALL field variants so normalizeWordImages can find and process it
      if (img && img.toLowerCase() !== 'null' && img.toLowerCase() !== 'undefined') {
        out.image_url = img;
        out.image = img;
        out.img = img;
        out.picture = img;
      }
      return out;
    }).filter(w => w && w.eng);
    if (!mapped.length) {
      inlineToast('This saved game has no words.');
      return;
    }
    try { window.__WA_IS_PHONICS__ = false; } catch {}
    currentListName = row.title || 'Saved Game';
    console.log('[WordArcade] Before normalization, sample words:', mapped.slice(0,3).map(w => ({
      eng: w.eng,
      image_url: w.image_url?.substring(0,60),
      img: w.img?.substring(0,60)
    })));
    try { normalizeWordImages(mapped); } catch (e) { console.warn('[WordArcade] saved game image normalization failed', e); }
    console.log('[WordArcade] After normalization, sample words:', mapped.slice(0,3).map(w => ({
      eng: w.eng,
      image_url: w.image_url?.substring(0,60),
      img: w.img?.substring(0,60)
    })));
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


// Color palette for level cards (4 colors only, matching main menu)
// Fixed rotation pattern: pink, cyan, orange, blue, repeating
const levelColors = ['#ff6fb0', '#5b9fd3', '#d9923b', '#21b3be']; // pink, cyan, orange, teal/blue
const abcColors = ['#21b3be', '#d9923b', '#ff6fb0']; // cyan, orange, pink for letters

// Store original opening buttons HTML for back button (exactly matches index.html current design)
const originalOpeningButtonsHTML = `
      <button id="basicWordsBtn" class="wa-option wa-option-card wa-basic" type="button">
        <img src="./assets/Images/icons/cutie.svg" alt="Word Games" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
        <div class="card-text-group">
          <span class="card-title" data-i18n="Word Games">Word Games</span>
          <span class="card-subtitle" data-i18n="Word Games Subtitle">Learn words and level up!</span>
        </div>
      </button>
      <button id="grammarGamesBtn" class="wa-option wa-option-card wa-grammar" type="button" style="border-color: #21b3be; color: #21b3be;">
        <img src="./assets/Images/icons/grammar.svg" alt="Grammar Games" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
        <div class="card-text-group">
          <span class="card-title" data-i18n="Grammar Games" style="color: #21b3be;">Grammar Games</span>
          <span class="card-subtitle" data-i18n="Grammar Games Subtitle">Build perfect sentences!</span>
        </div>
      </button>
      <button id="reviewBtn" class="wa-option wa-option-card wa-review" type="button">
        <img src="./assets/Images/icons/fire-fist.svg" alt="X3 Point Challenge" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
        <div class="card-text-group">
          <span class="card-title" data-i18n="X3 Point Challenge">X3 Point Challenge</span>
          <span class="card-subtitle" data-i18n="X3 Point Challenge Subtitle">Master tough words for 3x rewards!</span>
        </div>
      </button>
      <button id="browseBtn" class="wa-option wa-option-card wa-browse" type="button">
        <img src="./assets/Images/icons/browse.png?v=20250910a" alt="Discover" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
        <span data-i18n="Discover">Discover</span>
      </button>
    `;

// Recreate the opening menu buttons and wire events
function renderOpeningMenu() {
  const openingButtons = document.getElementById('openingButtons');
  if (openingButtons) {
    openingButtons.innerHTML = originalOpeningButtonsHTML;
  }
  showOpeningButtons(true);
  // Re-attach event listeners to the restored buttons
  wireUpMainMenuButtons();
  // Re-apply translations for restored content
  if (window.StudentLang && typeof window.StudentLang.applyTranslations === 'function') {
    try { window.StudentLang.applyTranslations(); } catch {}
  }
}

// Show levels menu when Word Games button is clicked
function showLevelsMenu() {
  const openingButtons = document.getElementById('openingButtons');
  if (!openingButtons) return;
  // Ensure the opening area is visible when restoring from mode selector/back
  showOpeningButtons(true);
  
  // Track navigation to levels menu (but don't push during back/forward restoration)
  try {
    if (!historyManager || !historyManager.isBackNavigation) {
      historyManager.navigateToLevels();
    }
  } catch {}
  
  // Generate colors in strict rotation pattern
  const backColor = levelColors[0]; // pink
  const level0Color = levelColors[1]; // cyan
  const level1Color = levelColors[2]; // orange
  const level2Color = levelColors[3]; // blue
  const level3Color = levelColors[0]; // pink
  const level4Color = levelColors[1]; // cyan
  const level5Color = levelColors[2]; // orange
  
  openingButtons.innerHTML = `
    <button id="level0Btn" class="wa-option wa-option-card wa-level-0" type="button" style="border-color: ${level0Color};">
      <img src="./assets/Images/icons/0abc.svg" alt="Level 0" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
      <span style="color: ${level0Color};">Phonics</span>
      <span class="wa-card-stars" id="wa-stars-level0" style="font-size: 0.85rem; color: #19777e; margin-top: 4px; display: block;">⭐ 0</span>
    </button>
    <button id="level1Btn" class="wa-option wa-option-card wa-level-1" type="button" style="border-color: ${level1Color};">
      <img src="./assets/Images/icons/basic.png?v=20250910a" alt="Level 1" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
      <span style="color: ${level1Color};">Level 1</span>
      <span class="wa-card-stars" id="wa-stars-level1" style="font-size: 0.85rem; color: #19777e; margin-top: 4px; display: block;">⭐ 0</span>
    </button>
    <button id="level2Btn" class="wa-option wa-option-card wa-level-2" type="button" style="border-color: ${level2Color};">
      <img src="./assets/Images/icons/2leaf.svg" alt="Level 2" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
      <span style="color: ${level2Color};">Level 2</span>
      <span class="wa-card-stars" id="wa-stars-level2" style="font-size: 0.85rem; color: #19777e; margin-top: 4px; display: block;">⭐ 0</span>
    </button>
    <button id="level3Btn" class="wa-option wa-option-card wa-level-3" type="button" style="border-color: ${level3Color};">
      <img src="./assets/Images/icons/3blue-flower.svg" alt="Level 3" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
      <span style="color: ${level3Color};">Level 3</span>
      <span class="wa-card-stars" id="wa-stars-level3" style="font-size: 0.85rem; color: #19777e; margin-top: 4px; display: block;">⭐ 0</span>
    </button>
    <button id="level4Btn" class="wa-option wa-option-card wa-level-4" type="button" style="border-color: ${level4Color};">
      <img src="./assets/Images/icons/4green-butterfly.svg" alt="Level 4" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
      <span style="color: ${level4Color};">Level 4</span>
      <span class="wa-card-stars" id="wa-stars-level4" style="font-size: 0.85rem; color: #19777e; margin-top: 4px; display: block;">⭐ 0</span>
    </button>
    <button id="level5Btn" class="wa-option wa-option-card wa-level-5 wa-level-inactive" type="button" style="border-color: ${level5Color}; opacity: 0.6;">
      <img src="./assets/Images/icons/5blue-bird.svg" alt="Level 5" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
      <span style="color: ${level5Color};">Level 5</span>
      <span style="font-size: 0.75rem; color: #999; margin-top: 4px;">Coming soon</span>
    </button>
    <button id="levelBackBtn" class="wa-option wa-option-card wa-back" type="button" style="border-color: ${backColor}; height: auto; min-height: auto; padding: 8px 8px 10px;">
      <div class="wa-logo-crop">
        <img src="./assets/Images/icons/word-arcade.svg?v=20250910a" alt="Back" class="wa-icon wa-icon-back" loading="lazy" decoding="async" draggable="false" />
      </div>
      <span style="color: ${backColor}; font-size: 0.7rem;" data-i18n="Back">← Back</span>
    </button>
  `;
  
  // Apply translations to the newly created elements (supports Korean)
  if (window.StudentLang && typeof window.StudentLang.applyTranslations === 'function') {
    window.StudentLang.applyTranslations();
  }
  
  // Back button - goes to main menu
  const backBtn = document.getElementById('levelBackBtn');
  if (backBtn) {
    // Clone and replace to remove any old listeners
    const newBackBtn = backBtn.cloneNode(true);
    backBtn.replaceWith(newBackBtn);
    newBackBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      // Restore the original main menu buttons
      renderOpeningMenu();
    });
  }
  
  // Level 1 (Easy) - shows the word list modal and loads basic mode
  const level1Btn = document.getElementById('level1Btn');
  if (level1Btn) {
    // Clone and replace to remove any old listeners
    const newLevel1Btn = level1Btn.cloneNode(true);
    level1Btn.replaceWith(newLevel1Btn);
    newLevel1Btn.addEventListener('click', () => {
      // Track that we opened a modal from levels menu
      historyManager.navigateToModal('sampleWordlistModal', 'levels_menu');
      showSampleWordlistModal({ onChoose: (filename) => { if (filename) loadSampleWordlistByFilename(filename, { force: true }); } });
    });
  }
  
  // Level 0 (Phonics) - shows the phonics modal
  const level0Btn = document.getElementById('level0Btn');
  if (level0Btn) {
    // Clone and replace to remove any old listeners
    const newLevel0Btn = level0Btn.cloneNode(true);
    level0Btn.replaceWith(newLevel0Btn);
    newLevel0Btn.addEventListener('click', () => {
      // Track that we opened a modal from levels menu
      historyManager.navigateToModal('phonicsModal', 'levels_menu');
      showPhonicsModal({
        onChoose: (data) => {
          // data = { listFile, mode, listName }
          loadPhonicsGame(data);
        },
        onClose: () => {}
      });
    });
  }
  
  // Level 2 - shows the level 2 modal
  const level2Btn = document.getElementById('level2Btn');
  if (level2Btn) {
    // Clone and replace to remove any old listeners
    const newLevel2Btn = level2Btn.cloneNode(true);
    level2Btn.replaceWith(newLevel2Btn);
    newLevel2Btn.addEventListener('click', () => {
      // Track that we opened a modal from levels menu
      historyManager.navigateToModal('level2Modal', 'levels_menu');
      showLevel2Modal({
        onChoose: (data) => {
          // data = { listFile, listName }
          loadSampleWordlistByFilename(data.listFile, { force: true, listName: data.listName });
        },
        onClose: () => {}
      });
    });
  }
  
  // Level 5 - Coming Soon
  [5].forEach(level => {
    const btn = document.getElementById(`level${level}Btn`);
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.replaceWith(newBtn);
      newBtn.addEventListener('click', () => {
        const modal = document.getElementById('comingSoonModal');
        if (modal) modal.style.display = 'flex';
      });
    }
  });

  // Level 4 - shows the level 4 modal
  const level4Btn = document.getElementById('level4Btn');
  if (level4Btn) {
    const newLevel4Btn = level4Btn.cloneNode(true);
    level4Btn.replaceWith(newLevel4Btn);
    newLevel4Btn.addEventListener('click', () => {
      historyManager.navigateToModal('level4Modal', 'levels_menu');
      showLevel4Modal({
        onChoose: (data) => {
          loadSampleWordlistByFilename(data.listFile, { force: true, listName: data.listName });
        },
        onClose: () => {}
      });
    });
  }

  // Level 3 - shows the level 3 modal
  const level3Btn = document.getElementById('level3Btn');
  if (level3Btn) {
    const newLevel3Btn = level3Btn.cloneNode(true);
    level3Btn.replaceWith(newLevel3Btn);
    newLevel3Btn.addEventListener('click', () => {
      // Track that we opened a modal from levels menu
      historyManager.navigateToModal('level3Modal', 'levels_menu');
      showLevel3Modal({
        onChoose: (data) => {
          // data = { listFile, listName }
          loadSampleWordlistByFilename(data.listFile, { force: true, listName: data.listName });
        },
        onClose: () => {}
      });
    });
  }

  // After wiring buttons, compute and render per-level star counts (WITH CACHING)
  (async () => {
    try {
      // Helper to render stars in the UI
      const renderStars = (starCounts) => {
        const s0 = document.getElementById('wa-stars-level0');
        const s1 = document.getElementById('wa-stars-level1');
        const s2 = document.getElementById('wa-stars-level2');
        const s3 = document.getElementById('wa-stars-level3');
        const s4 = document.getElementById('wa-stars-level4');
        if (s0) s0.textContent = `⭐ ${starCounts.level0 || 0}`;
        if (s1) s1.textContent = `⭐ ${starCounts.level1 || 0}`;
        if (s2) s2.textContent = `⭐ ${starCounts.level2 || 0}`;
        if (s3) s3.textContent = `⭐ ${starCounts.level3 || 0}`;
        if (s4) s4.textContent = `⭐ ${starCounts.level4 || 0}`;
      };

      // Fetch from shared progress service (instant if prefetched!)
      const { data, fromCache } = await loadStarCounts();

      if (data?.ready) {
        renderStars(data.counts);
      } else {
        renderStars({ level0: 0, level1: 0, level2: 0, level3: 0, level4: 0 });
      }

      if (fromCache) {
        const unsubscribe = progressCache.onUpdate('level_stars', (fresh) => {
          if (fresh?.ready) {
            renderStars(fresh.counts);
          }
          unsubscribe();
        });
      }
    } catch (e) {
      // Silent fail; stars are optional UI sugar
      try { console.info('[levels] stars unavailable', e?.message || e); } catch {}
    }
  })();
}

// Show grammar levels menu (Level 1, Level 2, etc.) - mirrors showLevelsMenu for word games
function showGrammarLevelsMenu() {
  const openingButtons = document.getElementById('openingButtons');
  if (!openingButtons) return;
  // Ensure the opening area is visible when restoring from mode selector/back
  showOpeningButtons(true);
  
  // Track navigation to grammar levels menu
  try {
    if (!historyManager || !historyManager.isBackNavigation) {
      historyManager.navigateToGrammarLevels();
    }
  } catch {}
  
  // Generate colors for grammar levels
  const backColor = levelColors[0]; // pink
  const level1Color = levelColors[1]; // cyan
  const level2Color = levelColors[2]; // orange

  // Clear and build DOM programmatically (avoid large template literals)
  openingButtons.innerHTML = '';

  const mkLevelBtn = (id, color, label, starId) => {
    const btn = document.createElement('button');
    btn.id = id;
    btn.type = 'button';
    btn.className = `wa-option wa-option-card ${id === 'grammarLevel1Btn' ? 'wa-level-1' : (id === 'grammarLevel2Btn' ? 'wa-level-2' : '')}`.trim();
    btn.style.borderColor = color;
    // Use different icons for each grammar level
    const iconSrc = id === 'grammarLevel2Btn' ? './assets/Images/icons/moon_and_clouds.svg' : './assets/Images/icons/rainbow.svg';
    btn.innerHTML = `
      <img src="${iconSrc}" alt="${label}" class="wa-icon" loading="lazy" decoding="async" draggable="false" />
      <span style="color:${color};">${label}</span>
      <span class="wa-card-stars" id="${starId}" style="font-size:0.85rem; color:#19777e; margin-top:4px; display:block;">⭐ 0</span>
    `;
    return btn;
  };

  const level1Btn = mkLevelBtn('grammarLevel1Btn', level1Color, 'Level 1', 'wa-stars-grammar-level1');
  const level2Btn = mkLevelBtn('grammarLevel2Btn', level2Color, 'Level 2', 'wa-stars-grammar-level2');

  const backBtn = document.createElement('button');
  backBtn.id = 'grammarLevelBackBtn';
  backBtn.type = 'button';
  backBtn.className = 'wa-option wa-option-card wa-back';
  backBtn.style.borderColor = backColor;
  backBtn.style.height = 'auto';
  backBtn.style.minHeight = 'auto';
  backBtn.style.padding = '8px 8px 10px';
  backBtn.innerHTML = `
    <div class="wa-logo-crop">
      <img src="./assets/Images/icons/word-arcade.svg?v=20250910a" alt="Back" class="wa-icon wa-icon-back" loading="lazy" decoding="async" draggable="false" />
    </div>
    <span style="color:${backColor}; font-size:0.7rem;" data-i18n="Back">← Back</span>
  `;

  openingButtons.appendChild(level1Btn);
  openingButtons.appendChild(level2Btn);
  openingButtons.appendChild(backBtn);
  
  // Apply translations
  if (window.StudentLang && typeof window.StudentLang.applyTranslations === 'function') {
    window.StudentLang.applyTranslations();
  }
  
  // Update grammar level progress stars using shared progress service
  (async () => {
    const applyStars = (targetId, value) => {
      const el = document.getElementById(targetId);
      if (!el) return;
      const val = Number(value) || 0;
      el.textContent = `⭐ ${Math.max(0, Math.round(val))}`;
    };

    applyStars('wa-stars-grammar-level1', 0);
    applyStars('wa-stars-grammar-level2', 0);

    try {
      const { data, fromCache } = await loadStarCounts();
      if (data?.ready) {
        applyStars('wa-stars-grammar-level1', data.counts?.grammarLevel1 || 0);
        applyStars('wa-stars-grammar-level2', data.counts?.grammarLevel2 || 0);
      }

      if (fromCache) {
        const unsubscribe = progressCache.onUpdate('level_stars', (fresh) => {
          if (fresh?.ready) {
            applyStars('wa-stars-grammar-level1', fresh.counts?.grammarLevel1 || 0);
            applyStars('wa-stars-grammar-level2', fresh.counts?.grammarLevel2 || 0);
          }
          unsubscribe();
        });
      }
    } catch (err) {
      console.info('[GrammarLevels] stars unavailable', err?.message || err);
    }
  })();

  // Back button - go back to main menu
  const newBackBtn = backBtn.cloneNode(true);
  backBtn.replaceWith(newBackBtn);
  newBackBtn.addEventListener('click', () => { renderOpeningMenu(); });
  
  // Level 1 button - show grammar level 1 modal
  const newLevel1Btn = level1Btn.cloneNode(true);
  level1Btn.replaceWith(newLevel1Btn);
  newLevel1Btn.addEventListener('click', () => {
    historyManager.navigateToModal('grammarL1Modal', 'grammar_levels_menu');
    showGrammarL1Modal({
      onChoose: (config) => { loadGrammarGame(config); },
      onClose: () => {}
    });
  });

  // Level 2 button - show grammar level 2 modal
  const newLevel2Btn = level2Btn.cloneNode(true);
  level2Btn.replaceWith(newLevel2Btn);
  newLevel2Btn.addEventListener('click', () => {
    historyManager.navigateToModal('grammarL2Modal', 'grammar_levels_menu');
    showGrammarL2Modal({
      onChoose: (config) => { loadGrammarGame(config); },
      onClose: () => {}
    });
  });
}

// Wire up main menu button event listeners
function wireUpMainMenuButtons() {
  const assignmentsBtn = document.getElementById('assignmentsBtn');
  const basicBtn = document.getElementById('basicWordsBtn');
  const grammarBtn = document.getElementById('grammarGamesBtn');
  const reviewBtn = document.getElementById('reviewBtn');
  const browseBtn = document.getElementById('browseBtn');
  
  // Clone and replace each button to remove old listeners
  if (assignmentsBtn) {
    const newAssignmentsBtn = assignmentsBtn.cloneNode(true);
    assignmentsBtn.replaceWith(newAssignmentsBtn);
    newAssignmentsBtn.addEventListener('click', () => {
      const modal = document.getElementById('comingSoonModal');
      if (modal) modal.style.display = 'flex';
    });
  }
  
  if (basicBtn) {
    const newBasicBtn = basicBtn.cloneNode(true);
    basicBtn.replaceWith(newBasicBtn);
    newBasicBtn.addEventListener('click', () => {
      showLevelsMenu();
    });
  }

  if (grammarBtn) {
    const newGrammarBtn = grammarBtn.cloneNode(true);
    grammarBtn.replaceWith(newGrammarBtn);
    newGrammarBtn.addEventListener('click', () => {
      showGrammarLevelsMenu();
    });
  }
  
  if (reviewBtn) {
    const newReviewBtn = reviewBtn.cloneNode(true);
    reviewBtn.replaceWith(newReviewBtn);
    newReviewBtn.addEventListener('click', () => { loadChallengingAndStart(); });
  }
  
  if (browseBtn) {
    const newBrowseBtn = browseBtn.cloneNode(true);
    browseBtn.replaceWith(newBrowseBtn);
  newBrowseBtn.addEventListener('click', () => { openSavedGamesModal('opening_menu'); });
  }
}

// Wire up opening page buttons after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Initialize history manager for browser back button support
  historyManager.init();
  
  // Try restoring session state so the mode menu or headers can show last list
  restoreSessionStateIfEmpty();
  wireUpMainMenuButtons();

  // Prefetch progress data in background (non-blocking)
  // This warms up the cache so modals open instantly
  setTimeout(() => {
    console.log('[WordArcade] Prefetching progress data for instant modal loading...');
    prefetchAllProgress({
      level1Lists: LEVEL1_LISTS,
      level2Lists: LEVEL2_LISTS,
      level3Lists: LEVEL3_LISTS,
      level4Lists: LEVEL4_LISTS,
      phonicsLists: PHONICS_LISTS,
    });
  }, 500); // Delay 500ms to not block initial render

  // Also prefetch review candidates in the background to avoid cold-start latency
  setTimeout(() => {
    if (__reviewCache.inflight) return;
    __reviewCache.inflight = (async () => {
      try {
        const words = await fetchChallengingWords({ timeoutMs: 10000 });
        if (Array.isArray(words) && words.length) {
          __reviewCache.words = words;
          __reviewCache.ts = Date.now();
        }
      } catch {}
      __reviewCache.inflight = null;
    })();
  }, 1200);

  // Auto-open a saved game when linked with ?open=saved&id=123
  try {
    const params = new URLSearchParams(window.location.search);
    const open = (params.get('open') || '').toLowerCase();
    const id = params.get('id');
    if (open === 'saved' && id) {
      openSavedGameById(id);
    }
  } catch {}

  // Global stars overlay hook: show after any Word Arcade session ends
  try {
    window.addEventListener('wa:session-ended', (e) => {
      const detail = (e && e.detail) || {};
      const summary = detail.summary || {};
      // Normalize to correct/total
      let correct = Number(summary.score ?? summary.correct ?? 0);
      let total = Number((summary.total ?? summary.max ?? 0));
      // Fallback: if total missing but percent-like summary provided
      if (!total && typeof summary.percent === 'number') {
        total = 100; correct = Math.round(summary.percent);
      }
      if (total > 0 && typeof window.showRoundStars === 'function') {
        try { window.showRoundStars({ correct, total }); } catch {}
      }
      
      // Invalidate progress cache after session ends (ensures fresh data on next modal open)
      try {
        progressCache.invalidate([
          'level1_progress',
          'level2_progress',
          'level3_progress',
          'level4_progress',
          'phonics_progress',
          'grammar_level1_progress',
          'grammar_level2_progress',
          'level_stars'
        ]);
        console.log('[WordArcade] Progress cache invalidated after session completion');
      } catch (e) {
        console.warn('[WordArcade] Failed to invalidate cache:', e);
      }
    });
  } catch {}
});

// Optional: expose for console debugging and UI querying
window.WordArcade = {
  startGame,
  startFilePicker,
  startModeSelector,
  // Grammar helpers
  startGrammarModeSelector: () => {
    try {
      showOpeningButtons(false);
      const cfg = window.__WA_LAST_GRAMMAR__ || {};
      showGrammarModeSelector({
        grammarFile: cfg.grammarFile || 'data/grammar/level1/articles.json',
        grammarName: cfg.grammarName || 'A vs An',
        grammarConfig: cfg.grammarConfig || {},
        onModeChosen: async (config) => {
          try {
            const mapping = {
              lesson: config?.grammarConfig?.lessonModule || 'grammar_lesson',
              choose: 'grammar_choose',
              fill_gap: 'grammar_fill_gap',
              unscramble: 'grammar_sentence_unscramble',
              sorting: 'grammar_sorting',
              find_mistake: 'grammar_find_mistake',
              translation: 'grammar_translation_choice',
            };
            const targetKey = mapping[config?.mode] || 'grammar_choose';
            const loader = modeLoaders[targetKey];
            if (!loader) throw new Error(`Grammar mode loader missing for ${targetKey}`);
            const runGrammarMode = await loader();
            try { window.__WA_LAST_GRAMMAR__ = { grammarFile: config.grammarFile, grammarName: config.grammarName, grammarConfig: config.grammarConfig }; } catch {}
            try {
              if (!historyManager || !historyManager.isBackNavigation) {
                historyManager.navigateToGame(targetKey, { grammar: window.__WA_LAST_GRAMMAR__ });
              }
            } catch {}
            runGrammarMode({
              grammarFile: config.grammarFile,
              grammarName: config.grammarName,
              grammarConfig: config.grammarConfig,
              renderGameView,
              showModeModal,
              playSFX,
              playTTS,
              inlineToast,
              getListName: () => currentListName,
              getUserId: () => {
                try {
                  return (window.WordArcade && typeof window.WordArcade.getUserId === 'function')
                    ? window.WordArcade.getUserId()
                    : null;
                } catch {
                  return null;
                }
              },
              FN,
              showOpeningButtons
            });
          } catch (err) {
            console.error('[WordArcade] Failed to start grammar mode from selector', err);
            inlineToast?.('Could not start this grammar mode');
            showOpeningButtons(true);
          }
        },
        onClose: () => { showGrammarLevelsMenu(); }
      });
    } catch (e) { console.warn('Failed to open grammar mode selector', e); }
  },
  getWordList: () => wordList,
  getListName: () => currentListName,
  openSavedGames: () => openSavedGamesModal('opening_menu'),
  quitToOpening,
  clearCurrentGameState,
  loadGrammarGame,
  loadPhonicsGame,
  loadSampleWordlistByFilename,
  showLevelsMenu,
  showGrammarLevelsMenu,
  __abortInFlight,
  historyManager, // Expose for debugging
  progressCache, // Expose cache for debugging
};

// Review flow using secure endpoint
// Rollback toggle: set window.__WA_REVIEW_V2 = false before clicking Review to fallback (not implemented old code retained separately if needed)
async function loadChallengingAndStart() {
  if (window.__WA_REVIEW_V2 === false) {
    inlineToast('Legacy review mode disabled in this build.');
    return;
  }
  try {
    // Show a tiny loading overlay to avoid "nothing is happening" feeling
    const abort = new AbortController();
    const hide = showLoadingOverlay('Loading review candidates…', () => abort.abort());
    // Use warm cache if present (under 2 minutes old)
    const now = Date.now();
    if (__reviewCache.words && (now - __reviewCache.ts) < 2 * 60 * 1000) {
      const cached = __reviewCache.words.slice(0);
      hide();
      return showReviewSelectionModal(cached, {
        min: 5,
        max: 15,
        onStart: (chosen) => {
          try { startNewReviewCombined(chosen); } catch (e) { console.error('Review start failed', e); inlineToast('Could not start review.'); }
        },
        onCancel: () => {}
      });
    }

    let words = await fetchChallengingWords({ signal: abort.signal, timeoutMs: 12000 });
    hide();
    if (!Array.isArray(words)) words = [];
    // Defensive sanitize: drop any non-object or missing eng/kor pairs
    words = words.filter(w => w && typeof w === 'object' && typeof w.eng === 'string' && typeof w.kor === 'string' && w.eng.trim() && w.kor.trim());
    if (!words.length) { inlineToast('No challenging words to review yet.'); return; }
    // Update cache
    try { __reviewCache.words = words.slice(0); __reviewCache.ts = Date.now(); } catch {}
    // Keep full list for selection; enforce max 10 in selection modal.
    try { if (window.__WA_DEBUG_REVIEW) console.debug('[Review] candidate words', words); } catch {}
    // Track that we opened the 3x (review) selection modal from the opening menu
    try { if (!historyManager || !historyManager.isBackNavigation) historyManager.navigateToModal('reviewSelectionModal', 'opening_menu'); } catch {}
    showReviewSelectionModal(words, {
      min: 5,
      max: 15,
      onStart: (chosen) => {
        try { startNewReviewCombined(chosen); } catch (e) { console.error('Review start failed', e); inlineToast('Could not start review.'); }
      },
      onCancel: () => {}
    });
  } catch (e) {
    if (e.code === 'NOT_AUTH' || /Not signed in/i.test(e.message)) { inlineToast('Please sign in to use Review.'); return; }
    console.error('Failed to load challenging words:', e);
    inlineToast('Could not load review candidates.');
  }
}

// Minimal loading overlay
function showLoadingOverlay(message = 'Loading…', onCancel) {
  try { hideLoadingOverlay(); } catch {}
  const el = document.createElement('div');
  el.id = 'wa_loading_overlay';
  el.style.position = 'fixed';
  el.style.inset = '0';
  el.style.background = 'rgba(0,0,0,0.35)';
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.zIndex = '9998';
  el.innerHTML = `
    <div style="background:#ffffff; padding:16px 18px; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,.18); min-width: 240px; text-align:center; font:14px/1.4 system-ui, Arial, sans-serif; color:#222;">
      <div style="margin-bottom:10px; font-weight:600;">${message}</div>
      <div style="margin-bottom:12px; opacity:.75;">Please wait…</div>
      <button id="wa_loading_cancel" style="padding:8px 12px; border-radius:10px; border:none; background:#93cbcf; color:#fff; font-weight:700; cursor:pointer;">Cancel</button>
    </div>`;
  document.body.appendChild(el);
  const btn = el.querySelector('#wa_loading_cancel');
  if (btn) btn.addEventListener('click', () => { try { if (typeof onCancel === 'function') onCancel(); } finally { hideLoadingOverlay(); } });
  return () => { try { hideLoadingOverlay(); } catch {} };
}
function hideLoadingOverlay() {
  const el = document.getElementById('wa_loading_overlay');
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function startNewReviewCombined(chosenWords) {
  try { window.__WA_IS_PHONICS__ = false; } catch {}
  // Clear any active mode and render into gameArea directly (no mode selector)
  destroyModeIfActive();
  showOpeningButtons(false);
  gameArea.innerHTML = '';
  currentListName = 'Review (Custom)';
  const mount = document.createElement('div');
  gameArea.appendChild(mount);
  runReviewSession({
    words: chosenWords.map(w => ({ eng: w.eng || w.word, kor: w.kor || w.word_kr, def: w.def })),
    mount,
    onFinish: ({ aborted }) => {
      if (aborted) { quitToOpening(true); return; }
      // After finish, return to opening buttons
      setTimeout(() => { quitToOpening(true); }, 400);
    }
  });
}
