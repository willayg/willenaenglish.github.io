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

  // We keep the full list (with required fields) then decide per-question if a valid 4-image (or 4-emoji) set can be constructed.
  const hasValidImg = w => !!(w && typeof w.img === 'string' && w.img.trim() && !['null','undefined'].includes(w.img.trim().toLowerCase()));
  const hasEmoji = w => { const em = emojiMap[String(w?.eng||'').toLowerCase()]; return em && isEmojiSupported(em); };
  const base = wordList.filter(w => w && w.eng && w.kor);
  if (base.length === 0) { gameArea.innerHTML = '<div style="padding:40px;text-align:center;color:#888;font-size:1.1em;">No words available.</div>'; return; }
  const available = [...base];

  // Randomize question order for this run
  const ordered = [...available].sort(() => Math.random() - 0.5);
  let score = 0;
  let idx = 0;
  const sessionId = startSession({ mode: 'picture', wordList, listName });

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="picIntro" style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">Which word matches the picture?</div>
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
    // Decide if we can build a full visual question (all 4 options must have visuals)
    const visualQualifier = (w) => isSampleList ? hasEmoji(w) : hasValidImg(w);
    const poolCandidates = ordered.filter(w => w.eng !== current.eng && visualQualifier(w));
    const canVisual = visualQualifier(current) && poolCandidates.length >= 3; // need 3 distractors

    if (canVisual) {
      const distractors = [];
      const poolCopy = [...poolCandidates];
      while (distractors.length < 3 && poolCopy.length) {
        const pick = poolCopy.splice(Math.floor(Math.random()*poolCopy.length),1)[0];
        distractors.push(pick);
      }
      const set = [current, ...distractors].sort(()=>Math.random()-0.5);
      let promptVisual;
      if (isSampleList) {
        const em = emojiMap[String(current.eng).toLowerCase()];
        if (em && isEmojiSupported(em)) {
          promptVisual = `<div style=\"font-size:5em;margin-bottom:18px;\">${em}</div>`;
        } else {
          promptVisual = `<div style=\"font-size:clamp(1.1rem,3.5vw,1.8rem);font-weight:700;padding:8px;margin-bottom:18px;\">${current.kor || current.eng}</div>`;
        }
      } else {
        const src = current.img.trim(); ensureImageStyles();
        promptVisual = `<div class=\"wa-img-box wa-square rounded shadow\"><img src='${src}' alt='${current.eng}' onerror=\"this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';\"><div style=\"display:none;font-size:clamp(1.05rem,3.2vw,1.6rem);font-weight:600;padding:6px;text-align:center;\">${current.kor || current.eng}</div></div>`;
      }
      gameArea.innerHTML = `<div style=\"padding:24px;text-align:center;\">\n        <div style=\"margin-bottom:18px;\">${promptVisual}</div>\n        <div id=\"picChoices\" style=\"display:grid;grid-template-columns:repeat(2,minmax(40vw,1fr));gap:16px;max-width:92vw;margin:0 auto;\">\n          ${set.map(w => `<button class=\\"pic-choice choice-btn\\" data-eng=\\"${w.eng}\\" ${w.eng===current.eng?'data-correct=\\"1\\"':''} style=\\"height:28vh;\\">${w.eng}</button>`).join('')}\n        </div>\n        <div id=\"picFeedback\" style=\"margin-top:16px;font-size:1.1em;height:24px;color:#555;\"></div>\n      </div>`;
      wireAnswerHandlers(current);
    } else {
      // Fallback text question (Korean prompt -> pick English) ensures no blanks
      const choices = [current.eng];
      const others = ordered.filter(w => w.eng !== current.eng);
      while (choices.length < 4 && others.length) {
        const pick = others.splice(Math.floor(Math.random()*others.length),1)[0];
        if (pick) choices.push(pick.eng);
      }
      choices.sort(()=>Math.random()-0.5);
      gameArea.innerHTML = `<div style=\"padding:24px;text-align:center;max-width:640px;margin:0 auto;\">\n        <div style=\"font-size:clamp(.95em,2.5vw,1.1em);color:#555;margin-bottom:8px;\">Pick the English</div>\n        <div style=\"font-size:clamp(1.3em,3vw,2.2em);font-weight:700;color:#19777e;margin-bottom:18px;\">${current.kor}</div>\n        <div id=\"picChoices\" style=\"display:grid;grid-template-columns:repeat(2,minmax(40vw,1fr));gap:16px;max-width:92vw;margin:0 auto;\">\n          ${choices.map(w => `<button class=\\"pic-choice choice-btn\\" data-eng=\\"${w}\\" ${w===current.eng?'data-correct=\\"1\\"':''} style=\\"height:18vh;\\">${w}</button>`).join('')}\n        </div>\n        <div id=\"picFeedback\" style=\"margin-top:16px;font-size:1.05em;height:24px;color:#555;\"></div>\n      </div>`;
      wireAnswerHandlers(current);
    }

    function wireAnswerHandlers(cur) {
      setupChoiceButtons(gameArea);
      document.querySelectorAll('.pic-choice').forEach(btn => {
        btn.onclick = () => {
          if (questionLocked) return; questionLocked = true;
          const correct = btn.getAttribute('data-eng') === cur.eng;
          splashResult(btn, correct);
          const f = document.getElementById('picFeedback');
          if (correct) { score++; playSFX('correct'); if (f) f.textContent='Correct!'; }
          else { playSFX('wrong'); if (f) f.textContent = `It was: ${cur.eng}`; }
          document.querySelectorAll('#picChoices button').forEach(b=>b.disabled=true);
          logAttempt({ session_id: sessionId, mode:'picture', word: cur.eng, is_correct: correct, answer: btn.getAttribute('data-eng'), correct_answer: cur.eng, attempt_index: idx+1 });
          setTimeout(()=>{ idx++; updateGameProgress(idx, ordered.length); renderQuestion(); }, 900);
        };
      });
    }

  }
}
