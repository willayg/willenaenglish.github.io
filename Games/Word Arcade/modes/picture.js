// Picture mode: show image or emoji, student picks the correct English word
import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Global emoji mapping - loaded from external file
let emojiMap = {};
// Utility: check if emoji renders as a visible symbol (not ? or blank)
function isEmojiSupported(emoji) {
  if (!emoji) return false;
  const span = document.createElement('span');
  span.textContent = emoji;
  span.style.visibility = 'hidden';
  span.style.fontSize = '32px';
  document.body.appendChild(span);
  const width = span.offsetWidth;
  document.body.removeChild(span);
  return width > 10;
}

// Load emoji mappings from external file
async function loadEmojiMappings() {
  if (Object.keys(emojiMap).length > 0) return emojiMap; // Already loaded
  try {
    const response = await fetch('./emoji-list/emoji-mappings.json');
    const mappings = await response.json();
    // Flatten categories to a single lookup
    for (const category of Object.values(mappings)) {
      Object.assign(emojiMap, category);
    }
    return emojiMap;
  } catch (error) {
    console.warn('Could not load emoji mappings, using fallback:', error);
    // Minimal fallback mappings (safe ASCII + common emoji)
    emojiMap = {
      dog: '🐶', cat: '🐱', rabbit: '🐰', horse: '🐴', cow: '🐮', pig: '🐷',
      car: '🚗', bus: '🚌', train: '🚆', plane: '✈️', house: '🏠', school: '🏫',
      apple: '🍎', banana: '🍌', orange: '🍊', sun: '☀️', moon: '🌙', star: '⭐'
    };
    return emojiMap;
  }
}

export async function runPictureMode({ wordList, gameArea, startGame }) {
  // Load emoji mappings first
  await loadEmojiMappings();

  // Only use words with an image or supported emoji; require at least 4 to support 4-choice gameplay
  const available = wordList.filter(w => {
    if (!w) return false;
    if (w.img) return true;
    const key = String(w.eng).toLowerCase();
    const emoji = emojiMap[key];
    return emoji && isEmojiSupported(emoji);
  });
  if (available.length < 4) {
    gameArea.innerHTML = '<div style="padding:40px;text-align:center;color:#888;font-size:1.1em;">Need at least 4 items with pictures or emojis for Picture Mode.</div>';
    return;
  }

  // Randomize question order for this run
  const ordered = [...available].sort(() => Math.random() - 0.5);
  let score = 0;
  let idx = 0;
  const sessionId = startSession({ mode: 'picture', wordList });

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="picIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Which word matches the picture?</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('picIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderQuestion(); }, 650);
  }, 1000);

  function renderQuestion() {
    if (idx >= ordered.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'picture', summary: { score, total: ordered.length } });
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;"><h2 style="color:#41b6beff;">Picture Mode Complete!</h2><div style="font-size:1.3em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${ordered.length}</span></div><button id="playAgainPic" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button></div>`;
      const again = document.getElementById('playAgainPic');
      if (again) again.onclick = () => startGame('picture');
      return;
    }

    const current = ordered[idx];
    // Pick 3 distractors
    const choices = [current.eng];
    const pool = ordered.filter(w => w.eng !== current.eng);
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (pick) choices.push(pick.eng);
    }
    choices.sort(() => Math.random() - 0.5);

    // Render image or emoji
    let imgHtml = '';
    if (current.img) {
      imgHtml = `<img src="${current.img}" alt="${current.eng}" style="max-width:180px;max-height:180px;border-radius:16px;box-shadow:0 2px 8px #ccc;margin-bottom:18px;">`;
    } else {
      const key = String(current.eng).toLowerCase();
      const emoji = emojiMap[key] || '';
      imgHtml = `<div style="font-size:5em;margin-bottom:18px;">${emoji}</div>`;
    }

    gameArea.innerHTML = `<div style="padding:24px;text-align:center;">
      <div style="margin-bottom:18px;">${imgHtml}</div>
      <div id="picChoices" style="display:grid;grid-template-columns:repeat(2, minmax(40vw, 1fr));gap:16px;max-width:92vw;margin:0 auto;">
        ${choices.map(w => `
          <button class="pic-choice choice-btn" data-eng="${w}" style="height:20vh;">
            ${w}
          </button>
        `).join('')}
      </div>
      <div id="picFeedback" style="margin-top:16px;font-size:1.1em;height:24px;color:#555;"></div>
    </div>`;

    setupChoiceButtons(gameArea);
    document.querySelectorAll('.pic-choice').forEach(btn => {
      btn.onclick = () => {
        const correct = btn.getAttribute('data-eng') === current.eng;
        splashResult(btn, correct);
        if (correct) {
          score++;
          playSFX('correct');
          const f = document.getElementById('picFeedback'); if (f) f.textContent = 'Correct!';
        } else {
          playSFX('wrong');
          const f = document.getElementById('picFeedback'); if (f) f.textContent = 'Incorrect!';
        }
        // Log attempt (fire-and-forget)
        logAttempt({
          session_id: sessionId,
          mode: 'picture',
          word: current.eng,
          is_correct: correct,
          answer: btn.getAttribute('data-eng'),
          correct_answer: current.eng,
          points: correct ? 1 : 0,
          attempt_index: idx + 1
        });
        setTimeout(() => { idx++; renderQuestion(); }, 900);
      };
    });

  }
}
