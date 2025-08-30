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
// import { renderFilePicker } from './ui/file_picker.js';
import { renderModeSelector } from './ui/mode_selector.js';
import { renderGameView } from './ui/game_view.js';
import { showModeModal } from './ui/mode_modal.js';
import { showSampleWordlistModal } from './ui/sample_wordlist_modal.js';
import { showBrowseModal } from './ui/browse_modal.js';

let wordList = [];
let currentMode = null;
let currentListName = null; // track the currently loaded word list filename/label

const gameArea = document.getElementById('gameArea');

// Minimal helpers to build absolute URLs and get current user id
const apiAbs = (path) => new URL(path, window.location.origin).toString();
function getUserId() {
  return (
    localStorage.getItem('user_id') ||
    sessionStorage.getItem('user_id') ||
    localStorage.getItem('userId') ||
    sessionStorage.getItem('userId') ||
    localStorage.getItem('student_id') ||
    sessionStorage.getItem('student_id') ||
    localStorage.getItem('profile_id') ||
    sessionStorage.getItem('profile_id') ||
    localStorage.getItem('id') ||
    sessionStorage.getItem('id') ||
    null
  );
}
async function fetchJSONNoStore(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// Load the student's challenging words from backend and start review flow
async function loadChallengingAndStart() {
  const uid = getUserId();
  if (!uid) {
    alert('Please sign in to use Review.');
    return;
  }
  try {
    const url = apiAbs(`/.netlify/functions/progress_summary?user_id=${encodeURIComponent(uid)}&section=challenging`);
    const list = await fetchJSONNoStore(url);
    if (!Array.isArray(list) || !list.length) {
      alert('No challenging words to review yet.');
      return;
    }
    // Map API rows to { eng, kor } with tolerant field names
    const mapped = list.map(it => {
      const eng = it.word_en || it.word || it.eng || '';
      const kor = it.word_kr || it.kor || it.translation || '';
      return { eng, kor };
    }).filter(w => w.eng);
    const cleaned = mapped.filter(w => w.kor && w.kor.trim());
    if (!cleaned.length) {
      alert('Your review list has no Korean translations yet. Play a few rounds so we can learn them, then try again.');
      return;
    }
    if (cleaned.length < mapped.length) {
      console.warn(`Review: skipped ${mapped.length - cleaned.length} items with missing Korean.`);
    }
    if (!mapped.length) {
      alert('No challenging words to review yet.');
      return;
    }
    currentListName = 'Review List';
    await processWordlist(cleaned);
  } catch (e) {
    console.error('Failed to load challenging words:', e);
    alert('Could not load your review list. Please try again.');
  }
}

// Mode registry
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

function showProgress(message, progress = 0) {
  showOpeningButtons(false);
  gameArea.innerHTML = `<div style="text-align: center; padding: 40px; font-family: Arial, sans-serif;">
    <h3 style="margin-bottom: 20px; color: #333;">${message}</h3>
    <div style="width: 300px; height: 20px; background: #f0f0f0; border-radius: 10px; margin: 20px auto; overflow: hidden;">
      <div id="progressBar" style="height: 100%; background: linear-gradient(90deg, #41b6beff, #248b86ff); border-radius: 10px; width: ${progress}%; transition: width 0.3s ease;"></div>
    </div>
    <div style="margin-top: 10px; color: #666; font-size: 14px;">${Math.round(progress)}% complete</div>
  </div>`;
}

function showGameStart(callback) {
  gameArea.innerHTML = `<div style="text-align: center; padding: 40px; font-family: Arial, sans-serif; opacity: 0;" id="gameStartContent">
    <h2 style="color: #4CAF50; margin-bottom: 20px;">Ready!</h2>
    <p style="color: #333; font-size: 18px;">All ${wordList.length} words loaded successfully</p>
    <p style="color: #666; margin-top: 20px;">Starting game...</p>
  </div>`;
  
  // Play the begin game SFX
  playSFX('begin-the-game');
  
  // Fade in animation
  const content = document.getElementById('gameStartContent');
  setTimeout(() => {
    content.style.transition = 'opacity 0.8s ease-in-out';
    content.style.opacity = '1';
  }, 100);
  
  // Start the actual game after a short delay
  setTimeout(() => {
    callback();
  }, 2000);
}

// Removed file picker logic

async function processWordlist(data) {
  try {
    wordList = data;
    
    // Show initial progress
    showProgress('Preparing audio files...', 0);
    
    // Preload all audio with progress tracking
    await preloadAllAudio(wordList, (progressData) => {
      const { phase, word, progress } = progressData;
      
      let phaseText = phase === 'checking' ? 'Checking existing files' : 
                     phase === 'generating' ? 'Generating missing audio' : 'Loading audio files';
      
      showProgress(`${phaseText}<br><small>Current: ${word}</small>`, progress || 0);
    });
    
    // Show completion screen with fade-in and SFX
    showGameStart(() => startModeSelector());
    
  } catch (err) {
    console.error('Error processing word list:', err);
    const missing = err && err.details && Array.isArray(err.details.missingAfter) ? err.details.missingAfter : [];
    const friendly = missing.length
      ? `Some audio files could not be prepared (${missing.length}). Please try again or pick another lesson.`
      : `Error processing word list: ${err.message}`;
    // Render a retry UI instead of a plain alert
    gameArea.innerHTML = `<div style="text-align:center; padding: 40px; font-family: Arial, sans-serif;">
      <h3 style="margin-bottom: 14px; color: #e53e3e;">We couldn't prepare all audio</h3>
      <div style="color:#555; margin-bottom:16px;">${friendly}</div>
      <button id="retryPreload" style="font-size:1em;padding:10px 22px;border-radius:10px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Retry</button>
      <button id="pickDifferent" style="font-size:1em;padding:10px 22px;border-radius:10px;background:#19777e;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:10px;">Choose Lesson</button>
    </div>`;
    const again = document.getElementById('retryPreload');
    if (again) again.onclick = () => processWordlist(data);
    const pick = document.getElementById('pickDifferent');
    if (pick) pick.onclick = () => {
      // Go to initial menu (show opening buttons, clear game area)
      showOpeningButtons(true);
      gameArea.innerHTML = '';
    };
  }
}

// Load a sample wordlist JSON by filename and process it
async function loadSampleWordlistByFilename(filename) {
  try {
  currentListName = filename || 'Sample List';
    const url = new URL(`./sample-wordlists/${filename}`, window.location.href);
    const res = await fetch(url.href, { cache: 'no-store' });
    if (!res.ok) {
      const preview = await res.text().catch(() => '');
      throw new Error(`Failed to fetch ${filename}: ${res.status}. ${preview.slice(0,120)}`);
    }
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const data = ct.includes('application/json') ? await res.json() : JSON.parse(await res.text());
    await processWordlist(data);
  } catch (err) {
    alert('Error loading sample word list: ' + err.message);
  }
}

function showOpeningButtons(visible) {
  const btns = document.getElementById('openingButtons');
  if (btns) btns.style.display = visible ? '' : 'none';
}

function startModeSelector() {
  showOpeningButtons(false);
  renderModeSelector({
    onModeChosen: (mode) => {
      currentMode = mode;
      startGame(mode);
    },
    // Handle selection from the wordlist modal (filename is provided by the modal)
    onWordsClick: (filename) => {
      if (filename) {
        loadSampleWordlistByFilename(filename);
      }
    },
  });
}

// Simple file picker entry that opens the sample wordlist modal
function startFilePicker() {
  showOpeningButtons(true);
  showSampleWordlistModal({
    onChoose: (filename) => {
      if (filename) loadSampleWordlistByFilename(filename);
    }
  });
}

export function startGame(mode = 'meaning') {
  showOpeningButtons(false);
  if (!wordList.length) {
    showOpeningButtons(true);
    gameArea.innerHTML = '';
    return;
  }

  // Show game view with "Change Mode" button
  renderGameView({
    modeName: mode,
    onShowModeModal: () => {
      showModeModal({
        onModeChosen: (newMode) => {
          currentMode = newMode;
          startGame(newMode);
        },
        onClose: () => {
          // Resume current activity if needed
        }
      });
    },
    // Opened via modal; we just receive filename to load
    onWordsClick: (filename) => {
      if (filename) loadSampleWordlistByFilename(filename);
    },
    // Mode modal will pass the new mode id here
    onModeClick: (newMode) => {
      if (newMode) {
        currentMode = newMode;
        startGame(newMode);
      }
    },
  });

  const run = modes[mode] || modes.meaning;
  const ctx = { wordList, gameArea, playTTS, preprocessTTS, startGame, listName: currentListName };
  run(ctx);
}


// Wire up opening page buttons after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  const basicBtn = document.getElementById('basicWordsBtn');
  const reviewBtn = document.getElementById('reviewBtn');
  const browseBtn = document.getElementById('browseBtn');
  if (basicBtn) {
    basicBtn.onclick = () => {
      showSampleWordlistModal({
        onChoose: (filename) => {
          if (filename) loadSampleWordlistByFilename(filename);
        }
      });
    };
  }
  if (reviewBtn) {
    reviewBtn.onclick = () => {
      loadChallengingAndStart();
    };
  }
  if (browseBtn) {
    browseBtn.onclick = () => {
      openSavedGamesModal();
    };
  }
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

// Lightweight UI helpers for in-game progress bar
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

// Simple modal to browse saved games from Supabase via Netlify proxy
async function openSavedGamesModal() {
  await showBrowseModal({
    onOpen: async (id, dismiss) => { await openSavedGameById(id); if (dismiss) dismiss(); },
    onClose: () => {}
  });
}

// Load a saved game_data row and start Word Arcade
async function openSavedGameById(id) {
  try {
    const res = await fetch(`/.netlify/functions/supabase_proxy_fixed?get=game_data&id=${encodeURIComponent(id)}`, { cache: 'no-store' });
    const js = await res.json();
    const row = js?.data || js;
    if (!row || !Array.isArray(row.words)) {
      alert('Saved game not found or invalid.');
      return;
    }
    // Map to Word Arcade shape: { eng, kor, img? }
    const mapped = row.words.map(w => {
      const eng = w.eng || w.en || w.word || '';
      const kor = w.kor || w.kr || w.translation || '';
      const def = w.def || w.definition || w.gloss || w.meaning || '';
      const rawImg = w.image_url || w.image || w.img || '';
      const img = (typeof rawImg === 'string') ? rawImg.trim() : '';
      const out = { eng, kor };
      if (def && String(def).trim()) out.def = String(def).trim();
      // Only keep valid non-placeholder image strings
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
    console.error('Failed to open saved game', e);
    alert('Could not open the saved game.');
  }
}

// Local HTML-escape helper for injected rows
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
