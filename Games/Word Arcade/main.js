// Entry point for Word Arcade (ES module)
import { runMeaningMode } from './modes/meaning.js';
import { runSpellingMode } from './modes/spelling.js';
import { runListeningMode } from './modes/listening.js';
import { runPictureMode } from './modes/picture.js';
import { runEasyPictureMode } from './modes/easy_picture.js';
import { runListenAndSpellMode } from './modes/listen_and_spell.js';
import { runMultiChoiceMode } from './modes/multi_choice.js';
import { playTTS, preprocessTTS, preloadAllAudio } from './tts.js';
import { playSFX } from './sfx.js';
import { renderFilePicker } from './ui/file_picker.js';
import { renderModeSelector } from './ui/mode_selector.js';
import { renderGameView } from './ui/game_view.js';
import { showModeModal } from './ui/mode_modal.js';
import { showSampleWordlistModal } from './ui/sample_wordlist_modal.js';

let wordList = [];
let currentMode = null;
let currentListName = null; // track the currently loaded word list filename/label

const gameArea = document.getElementById('gameArea');

// Mode registry
const modes = {
  meaning: runMeaningMode,
  spelling: runSpellingMode,
  listening: runListeningMode,
  picture: runPictureMode,
  easy_picture: runEasyPictureMode,
  listen_and_spell: runListenAndSpellMode,
  multi_choice: runMultiChoiceMode,
};

function showProgress(message, progress = 0) {
  gameArea.innerHTML = `<div style="text-align: center; padding: 40px; font-family: Arial, sans-serif;">
    <h3 style="margin-bottom: 20px; color: #333;">${message}</h3>
    <div style="width: 300px; height: 20px; background: #f0f0f0; border-radius: 10px; margin: 20px auto; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">
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

function startFilePicker() {
  renderFilePicker({
    onFileChosen: async (fileData) => {
      try {
        // Handle either a File object (from original file picker) or {name, content} object from sample wordlist modal
        if (fileData instanceof File) {
          // Original File object handling
          currentListName = fileData.name || 'Custom List';
          const reader = new FileReader();
          reader.onload = async function(evt) {
            try {
              processWordlist(JSON.parse(evt.target.result));
            } catch (err) {
              alert('Invalid JSON file.');
            }
          };
          reader.readAsText(fileData);
        } else {
          // Sample wordlist {name, content} object
          currentListName = fileData && fileData.name ? fileData.name : 'Sample List';
          processWordlist(fileData.content);
        }
      } catch (err) {
        alert('Error loading word list: ' + err.message);
      }
    }
  });
}

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
    alert('Error processing word list: ' + err.message);
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

function startModeSelector() {
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

export function startGame(mode = 'meaning') {
  if (!wordList.length) {
    startFilePicker();
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

// Initialize the app with the file picker
startFilePicker();

// Optional: expose for console debugging and UI querying
window.WordArcade = { 
  startGame, 
  startFilePicker, 
  startModeSelector,
  getWordList: () => wordList,
  getListName: () => currentListName,
};
