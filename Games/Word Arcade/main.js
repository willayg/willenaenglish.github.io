// Entry point for Word Arcade (ES module)
import { runMeaningMode } from './modes/meaning.js';
import { runSpellingMode } from './modes/spelling.js';
import { runListeningMode } from './modes/listening.js';
import { playTTS, preprocessTTS } from './tts.js';

let wordList = [];

const gameArea = document.getElementById('gameArea');

// Mode registry
const modes = {
  meaning: runMeaningMode,
  spelling: runSpellingMode,
  listening: runListeningMode,
};

export function startGame(mode = 'meaning') {
  if (!wordList.length) {
    gameArea.innerHTML = '<p>Please load a word list first.</p>';
    return;
  }
  const run = modes[mode] || modes.meaning;
  const ctx = { wordList, gameArea, playTTS, preprocessTTS, startGame };
  run(ctx);
}

// Wire up UI
document.getElementById('loadWordsBtn').onclick = () => {
  document.getElementById('wordFileInput').click();
};

document.getElementById('wordFileInput').onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      wordList = JSON.parse(evt.target.result);
      startGame();
    } catch (err) {
      alert('Invalid JSON file.');
    }
  };
  reader.readAsText(file);
};

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.onclick = () => {
    startGame(btn.dataset.mode);
  };
});

// Optional: expose for console debugging
window.WordArcade = { startGame };
