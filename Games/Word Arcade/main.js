// Entry point for Word Arcade (ES module)

import { runMeaningMode } from './modes/meaning.js';
import { runSpellingMode } from './modes/spelling.js';
import { runListeningMode } from './modes/listening.js';
import { runPictureMode } from './modes/picture.js';
import { runEasyPictureMode } from './modes/easy_picture.js';
import { runListenAndSpellMode } from './modes/listen_and_spell.js';
import { runMultiChoiceMode } from './modes/multi_choice.js';
import { runLevelUpMode } from './modes/level_up.js';
import { playTTS, preprocessTTS, preloadAllAudio } from './tts.js';
import { playSFX } from './sfx.js';
import { renderModeSelector } from './ui/mode_selector.js';
import { renderGameView } from './ui/game_view.js';
import { showModeModal } from './ui/mode_modal.js';
import { showSampleWordlistModal } from './ui/sample_wordlist_modal.js';
import { showBrowseModal } from './ui/browse_modal.js';

// Auth helper: inline, no extra file needed
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon-key"]')?.content;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

async function getAccessToken() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session || !session.access_token) throw new Error('Not signed in');
  return session.access_token;
}

async function callProgressSummary(section, params = {}) {
  const token = await getAccessToken();
  const url = new URL('/.netlify/functions/progress_summary', window.location.origin);
  url.searchParams.set('section', section);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    credentials: 'same-origin'
  });
  if (!res.ok) throw new Error(`progress_summary ${section} failed: ${res.status}`);
  return res.json();
}

async function fetchChallengingWords() {
  const list = await callProgressSummary('challenging');
  if (!Array.isArray(list)) return [];
  const out = list.map(it => {
    const eng = it.word_en || it.word || it.eng || '';
    const kor = it.word_kr || it.kor || it.translation || '';
    const def = it.def || it.definition || it.meaning || '';
    const w = { eng: String(eng).trim(), kor: String(kor || '').trim() };
    if (def && String(def).trim()) w.def = String(def).trim();
    return w;
  }).filter(w => w.eng && w.kor);
  return out;
}

// App state
let wordList = [];
let currentMode = null;
let currentListName = null;

const gameArea = document.getElementById('gameArea');

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
    <div style="width:300px;height:20px;background:#f0f0f0;border-radius:10px;margin:20px auto;overflow:hidden;">
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

// -----------------------------
// Core flow
// -----------------------------
async function processWordlist(data) {
  try {
    wordList = Array.isArray(data) ? data : [];
    if (!wordList.length) throw new Error('No words provided');

    showProgress('Preparing audio files...', 0);

    await preloadAllAudio(wordList, ({ phase, word, progress }) => {
      const phaseText = phase === 'checking' ? 'Checking existing files' : phase === 'generating' ? 'Generating missing audio' : 'Loading audio files';
      showProgress(`${phaseText}<br><small>Current: ${word || ''}</small>`, progress || 0);
    });

    showGameStart(() => startModeSelector());

  } catch (err) {
    console.error('Error processing word list:', err);
    const missing = err && err.details && Array.isArray(err.details.missingAfter) ? err.details.missingAfter : [];
    const friendly = missing.length
      ? `Some audio files could not be prepared (${missing.length}). Please try again or pick another lesson.`
      : `Error processing word list: ${err.message}`;

    gameArea.innerHTML = `<div style="text-align:center;padding:40px;font-family:Arial,sans-serif;">
      <h3 style="margin-bottom:14px;color:#e53e3e;">We couldn't prepare all audio</h3>
      <div style="color:#555;margin-bottom:16px;">${friendly}</div>
      <button id="retryPreload" style="font-size:1em;padding:10px 22px;border-radius:10px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,.08);cursor:pointer;">Retry</button>
      <button id="pickDifferent" style="font-size:1em;padding:10px 22px;border-radius:10px;background:#19777e;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,.08);cursor:pointer;margin-left:10px;">Choose Lesson</button>
    </div>`;
    const again = document.getElementById('retryPreload');
    if (again) again.addEventListener('click', () => processWordlist(data));
    const pick = document.getElementById('pickDifferent');
    if (pick) pick.addEventListener('click', () => { showOpeningButtons(true); gameArea.innerHTML = ''; });
  }
}

async function loadSampleWordlistByFilename(filename) {
  try {
    currentListName = filename || 'Sample List';
    const url = new URL(`./sample-wordlists/${filename}`, window.location.href);
    const res = await fetch(url.href, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.status}`);
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await res.json() : JSON.parse(await res.text());
    await processWordlist(data);
  } catch (err) {
    alert('Error loading sample word list: ' + err.message);
  }
}

function startModeSelector() {
  showOpeningButtons(false);
  renderModeSelector({
    onModeChosen: (mode) => { currentMode = mode; startGame(mode); },
    onWordsClick: (filename) => { if (filename) loadSampleWordlistByFilename(filename); },
  });
}

function startFilePicker() {
  showOpeningButtons(true);
  showSampleWordlistModal({ onChoose: (filename) => { if (filename) loadSampleWordlistByFilename(filename); } });
}

export function startGame(mode = 'meaning') {
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

  const modes = {
    meaning: runMeaningMode,
    spelling: runSpellingMode,
    listening: runListeningMode,
    picture: runPictureMode,
    easy_picture: runEasyPictureMode,
    listen_and_spell: runListenAndSpellMode,
    multi_choice: runMultiChoiceMode,
    level_up: runLevelUpMode,
  };

  const run = modes[mode] || modes.meaning;
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
}

export function updateGameProgress(current, total) {
  const fill = document.getElementById('gameProgressFill');
  const txt = document.getElementById('gameProgressText');
  const wrap = document.getElementById('gameProgressBar');
  if (!fill || !txt || !wrap) return;
  const pct = total > 0 ? Math.max(0, Math.min(100, Math.round((current / total) * 100))) : 0;
  fill.style.width = pct + '%';
  txt.textContent = `${current}/${total}`;
  if (current >= total) hideGameProgress();
}

export function hideGameProgress() {
  const wrap = document.getElementById('gameProgressBar');
  if (wrap) wrap.style.display = 'none';
}

// Saved games modal via Netlify proxy
async function openSavedGamesModal() {
  await showBrowseModal({ onOpen: async (id, dismiss) => { await openSavedGameById(id); if (dismiss) dismiss(); }, onClose: () => {} });
}

async function openSavedGameById(id) {
  try {
    const token = await getAccessToken();
    const res = await fetch(`/.netlify/functions/supabase_proxy_fixed?get=game_data&id=${encodeURIComponent(id)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Load saved game failed: ${res.status}`);
    const js = await res.json();
    const row = js?.data || js;
    if (!row || !Array.isArray(row.words)) {
      alert('Saved game not found or invalid.');
      return;
    }
    const mapped = row.words.map(w => {
      const eng = w.eng || w.en || w.word || '';
      const kor = w.kor || w.kr || w.translation || '';
      const def = w.def || w.definition || w.gloss || w.meaning || '';
      const rawImg = w.image_url || w.image || w.img || '';
      const img = (typeof rawImg === 'string') ? rawImg.trim() : '';
      const out = { eng, kor };
      if (def && String(def).trim()) out.def = String(def).trim();
      if (img && img.toLowerCase() !== 'null' && img.toLowerCase() !== 'undefined') out.img = img;
      return out;
    }).filter(w => w.eng);
    if (!mapped.length) {
      alert('This saved game has no words.');
      return;
    }
    currentListName = row.title || 'Saved Game';
    await processWordlist(mapped);
  } catch (e) {
    if (/Not signed in/i.test(e.message)) {
      alert('Please sign in to open saved games.');
      return;
    }
    console.error('Failed to open saved game', e);
    alert('Could not open the saved game.');
  }
}

// Wire up opening page buttons after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
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
    const cleaned = await fetchChallengingWords();
    if (!cleaned.length) {
      alert('No challenging words to review yet.');
      return;
    }
    currentListName = 'Review List';
    await processWordlist(cleaned);
  } catch (e) {
    if (/Not signed in/i.test(e.message)) {
      alert('Please sign in to use Review.');
      return;
    }
    console.error('Failed to load challenging words:', e);
    alert('Could not load your review list. Please try again.');
  }
}
