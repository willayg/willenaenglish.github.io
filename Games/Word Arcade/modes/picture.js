// Picture mode: show image or emoji, student picks the correct English word
import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';
import { ensureImageStyles } from '../ui/image_styles.js';

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

export async function runPictureMode({ wordList, gameArea, startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  // Check if this is a sample list (basic wordlists use emoji, user content uses Pixabay)
  const isSampleList = listName && (listName.includes('.json') || listName.includes('Sample') || listName.includes('Mixed') || listName.includes('Easy') || listName.includes('Food') || listName.includes('Animals') || listName.includes('Transportation') || listName.includes('Jobs') || listName.includes('Sports') || listName.includes('School') || listName.includes('Hobbies') || listName.includes('Verbs') || listName.includes('Feelings') || listName.includes('Long U'));
  // Load emoji mappings first
  await loadEmojiMappings();

  // Only use words with an image or supported emoji; require at least 4 to support 4-choice gameplay
  const available = wordList.filter(w => {
    if (!w) return false;
    if (isSampleList) {
      // For sample lists, prefer emoji over images
      const key = String(w.eng).toLowerCase();
      const emoji = emojiMap[key];
      return emoji && isEmojiSupported(emoji);
    } else {
      // For user content, require actual images
      if (w.img) return true;
      const key = String(w.eng).toLowerCase();
      const emoji = emojiMap[key];
      return emoji && isEmojiSupported(emoji);
    }
  });
  if (available.length < 4) {
    gameArea.innerHTML = '<div style="padding:40px;text-align:center;color:#888;font-size:1.1em;">Need at least 4 items with pictures or emojis for Picture Mode.</div>';
    return;
  }

  // Randomize question order for this run
  const ordered = [...available].sort(() => Math.random() - 0.5);
  let score = 0;
  let idx = 0;
  const sessionId = startSession({ mode: 'picture', wordList, listName });

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="picIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Which word matches the picture?</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('picIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => {
      showGameProgress(ordered.length, 0);
      renderQuestion();
    }, 650);
  }, 1000);

  function renderQuestion() {
  // Per-question guard to avoid rapid double clicks
  let questionLocked = false;
    if (idx >= ordered.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'picture', summary: { score, total: ordered.length } });
      hideGameProgress();
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;">
        <h2 style="color:#41b6beff;">Picture Mode Complete!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.3em;margin-bottom:12px;\">Score: <span style=\"color:#19777e;font-weight:700;\">${score} / ${ordered.length}</span></div>`}
        <button id="playAgainPic" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
  ${document.getElementById('gameStage') ? '' : `<button id=\"tryMorePic\" style=\"font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Try More</button>`}
      </div>`;
      const again = document.getElementById('playAgainPic');
      if (again) again.onclick = () => startGame('picture');
      const tryMore = document.getElementById('tryMorePic');
      if (tryMore) tryMore.onclick = () => {
        if (window.WordArcade?.startModeSelector) {
          window.WordArcade.startModeSelector();
        } else {
          startGame('picture', { shuffle: true });
        }
      };
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

    // Render image or emoji with different logic for sample vs user content
    let imgHtml = '';
    if (isSampleList) {
      // For sample lists, always use emoji
      const key = String(current.eng).toLowerCase();
      const emoji = emojiMap[key] || '❓';
      imgHtml = `<div style="font-size:5em;margin-bottom:18px;">${emoji}</div>`;
    } else {
      // For user content, prefer Pixabay images with emoji fallback
      const hasImg = typeof current.img === 'string' && current.img.trim() && current.img.toLowerCase() !== 'null' && current.img.toLowerCase() !== 'undefined';
      if (hasImg) {
        const safeSrc = current.img.trim();
        ensureImageStyles();
        imgHtml = `<div class=\"wa-img-box wa-square rounded shadow\" style=\"max-width:40vw;\"><img src='${safeSrc}' alt='${current.eng}' onerror=\"this.onerror=null;this.parentElement.style.display='none';this.parentElement.nextElementSibling.style.display='block';\"></div><div style=\"font-size:5em;margin-bottom:18px;display:none;\">❓</div>`;
      } else {
        const key = String(current.eng).toLowerCase();
        const emoji = emojiMap[key] || '❓';
        imgHtml = `<div style="font-size:5em;margin-bottom:18px;">${emoji}</div>`;
      }
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
        if (questionLocked) return;
        questionLocked = true;
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
        // Disable all buttons to avoid multiple attempts for same question
        document.querySelectorAll('#picChoices button').forEach(b => b.disabled = true);
        // Log attempt (fire-and-forget)
        logAttempt({
          session_id: sessionId,
          mode: 'picture',
          word: current.eng,
          is_correct: correct,
          answer: btn.getAttribute('data-eng'),
          correct_answer: current.eng,
          // scoreless build: no points
          attempt_index: idx + 1
        });
  setTimeout(() => { idx++; updateGameProgress(idx, ordered.length); renderQuestion(); }, 900);
      };
    });

  }
}
