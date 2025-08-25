// Utility: check if emoji renders as a visible symbol (not ? or blank)
function isEmojiSupported(emoji) {
  if (!emoji) return false;
  // Create a hidden span and measure width
  const span = document.createElement('span');
  span.textContent = emoji;
  span.style.visibility = 'hidden';
  span.style.fontSize = '32px';
  document.body.appendChild(span);
  const width = span.offsetWidth;
  document.body.removeChild(span);
  // Most unsupported emoji render as very narrow (like ? or box)
  return width > 10;
}
// Easy Picture mode: play audio of the word, show 4 pictures (image/emoji), student selects the picture
import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Local emoji mapping cache
let emojiMap = {};

async function loadEmojiMappings() {
  if (Object.keys(emojiMap).length > 0) return emojiMap;
  try {
    const res = await fetch('./emoji-list/emoji-mappings.json');
    const mappings = await res.json();
    for (const category of Object.values(mappings)) {
      Object.assign(emojiMap, category);
    }
    return emojiMap;
  } catch (e) {
    console.warn('Could not load emoji mappings for easy picture, using fallback', e);
    emojiMap = {
      dog: '🐶', cat: '🐱', rabbit: '🐰', horse: '🐴', cow: '🐮', pig: '🐷',
      car: '🚗', bus: '🚌', train: '🚆', plane: '✈️', house: '🏠', school: '🏫',
      apple: '🍎', banana: '🍌', orange: '🍊', sun: '☀️', moon: '🌙', star: '⭐'
    };
    return emojiMap;
  }
}

export async function runEasyPictureMode({ wordList, gameArea, playTTS, preprocessTTS, startGame, listName = null }) {
  await loadEmojiMappings();

  // Only use entries with image or supported emoji available
  const available = wordList.filter(w => {
    if (!w || !w.eng) return false;
    if (w.img) return true;
    const key = String(w.eng).toLowerCase();
    const emoji = emojiMap[key];
    return emoji && isEmojiSupported(emoji);
  });
  if (available.length < 4) {
    gameArea.innerHTML = '<div style="padding:40px;text-align:center;color:#888;font-size:1.1em;">Need at least 4 items with pictures or emojis for Easy Picture mode.</div>';
    return;
  }

  // Shuffle question order
  const ordered = [...available].sort(() => Math.random() - 0.5);
  let score = 0;
  let idx = 0;
  const sessionId = startSession({ mode: 'easy_picture', wordList: available, listName });

  // Intro splash
  gameArea.innerHTML = `
    <div id="easyPicIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.3rem,5.2vw,4rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Listen and choose the picture</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('easyPicIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderQuestion(); }, 650);
  }, 1000);

  function getTileHtml(wordEntry) {
    if (wordEntry.img) {
      return `<img src="${wordEntry.img}" alt="${wordEntry.eng}" style="max-width:38vw;max-height:22vh;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.12);object-fit:contain;background:#fff;">`;
    }
    const key = String(wordEntry.eng).toLowerCase();
    const emoji = emojiMap[key] || '❓';
    return `<div style="font-size:3.2rem;line-height:1;">${emoji}</div>`;
  }

  function renderQuestion() {
    if (idx >= ordered.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'easy_picture', summary: { score, total: ordered.length } });
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;"><h2 style="color:#41b6beff;">Easy Picture Complete!</h2><div style="font-size:1.2em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${ordered.length}</span></div><button id="playAgainEasyPic" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button></div>`;
      const again = document.getElementById('playAgainEasyPic');
      if (again) again.onclick = () => startGame('easy_picture');
      return;
    }

    const current = ordered[idx];
    // Build 4-picture choice set (1 correct + 3 random distractors)
    const choices = [current];
    const pool = ordered.filter(w => w !== current);
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (pick) choices.push(pick);
    }
    // If for some reason fewer than 4, pad from full available
    const backupPool = available.filter(w => !choices.includes(w));
    while (choices.length < 4 && backupPool.length) {
      const pick = backupPool.splice(Math.floor(Math.random() * backupPool.length), 1)[0];
      if (pick) choices.push(pick);
    }
    const shuffledChoices = choices.sort(() => Math.random() - 0.5);

    // Render tiles grid and controls
    gameArea.innerHTML = `
      <div style="padding:16px 16px 6px;text-align:center;">
        <div style="display:flex;justify-content:center;align-items:center;gap:10px;margin-bottom:10px;">
          <button id="replayWord" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:42px;height:42px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;">▶</button>
          <div id="promptText" style="color:#555;font-size:0.95em;">Listen and tap the picture</div>
        </div>
        <div id="easyPicGrid" style="display:grid;grid-template-columns:repeat(2, minmax(42vw, 1fr));gap:14px;max-width:94vw;margin:0 auto;">
          ${shuffledChoices.map(ch => `
            <button class="choice-btn easy-pic-choice" data-eng="${ch.eng}" style="height:26vh;display:flex;align-items:center;justify-content:center;">
              ${getTileHtml(ch)}
            </button>
          `).join('')}
        </div>
        <div id="picFeedback" style="margin-top:10px;font-size:1.05em;height:24px;color:#555;"></div>
      </div>`;

    // Wire buttons + styles
    setupChoiceButtons(gameArea);

    // Play the target word (with friendly short-word phrasing)
    const phrase = preprocessTTS(current.eng);
    playTTS(phrase);
    const replayBtn = document.getElementById('replayWord');
    if (replayBtn) replayBtn.onclick = () => playTTS(phrase);

    document.querySelectorAll('.easy-pic-choice').forEach(btn => {
      btn.onclick = () => {
        const picked = btn.getAttribute('data-eng');
        const correct = picked === current.eng;
        splashResult(btn, correct);
        const fb = document.getElementById('picFeedback');
        if (correct) {
          score++;
          playSFX('correct');
          if (fb) fb.textContent = 'Correct!';
        } else {
          playSFX('wrong');
          if (fb) fb.textContent = `It was: ${current.eng}`;
        }
        // Log attempt
        logAttempt({
          session_id: sessionId,
          mode: 'easy_picture',
          word: current.eng,
          is_correct: correct,
          answer: picked,
          correct_answer: current.eng,
          points: correct ? 1 : 0,
          attempt_index: idx + 1
        });
        setTimeout(() => { idx++; renderQuestion(); }, 900);
      };
    });
  }
}
