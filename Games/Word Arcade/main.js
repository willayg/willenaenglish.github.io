// Entry point for Word Arcade (ES module)
import { runMeaningMode } from './modes/meaning.js';
import { runSpellingMode } from './modes/spelling.js';
import { runListeningMode } from './modes/listening.js';
import { runPictureMode } from './modes/picture.js';
import { runListenAndSpellMode } from './modes/listen_and_spell.js';
import { runMultiChoiceKorToEng } from './modes/multi_choice_kor_to_eng.js';
import { runMultiChoiceEngToKor } from './modes/multi_choice_eng_to_kor.js';
import { playTTS, preprocessTTS, preloadAllAudio } from './tts.js';
import { playSFX } from './sfx.js';
import { renderFilePicker } from './ui/file_picker.js';
import { renderModeSelector } from './ui/mode_selector.js';
import { renderGameView } from './ui/game_view.js';
import { showModeModal } from './ui/mode_modal.js';

let wordList = [];
let currentMode = null;

const gameArea = document.getElementById('gameArea');

// Mode registry
const modes = {
  meaning: runMeaningMode,
  spelling: runSpellingMode,
  listening: runListeningMode,
  picture: runPictureMode,
  listen_and_spell: runListenAndSpellMode,
  multi_choice_kor_to_eng: runMultiChoiceKorToEng,
  multi_choice_eng_to_kor: runMultiChoiceEngToKor,
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
    onFileChosen: (file) => {
      const reader = new FileReader();
      reader.onload = async function(evt) {
        try {
          wordList = JSON.parse(evt.target.result);
          
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
          alert('Invalid JSON file.');
        }
      };
      reader.readAsText(file);
    }
  });
}

function startModeSelector() {
  renderModeSelector({
    onModeChosen: (mode) => {
      currentMode = mode;
      startGame(mode);
    },
    onWordsClick: () => {
      startFilePicker();
    }
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
    onWordsClick: () => {
      startFilePicker();
    },
    onModeClick: () => {
      startModeSelector();
    }
  });
  
  const run = modes[mode] || modes.meaning;
  const ctx = { wordList, gameArea, playTTS, preprocessTTS, startGame };
  run(ctx);
}

// Initialize the app with the file picker
startFilePicker();

// Optional: expose for console debugging
window.WordArcade = { startGame, startFilePicker, startModeSelector };
