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
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';
import { ensureImageStyles } from '../ui/image_styles.js';

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
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  const isSampleList = listName && (listName.includes('.json') || listName.includes('Sample') || listName.includes('Mixed') || listName.includes('Easy') || listName.includes('Food') || listName.includes('Animals') || listName.includes('Transportation') || listName.includes('Jobs') || listName.includes('Sports') || listName.includes('School') || listName.includes('Hobbies') || listName.includes('Verbs') || listName.includes('Feelings') || listName.includes('Long U'));
  await loadEmojiMappings();

  // Base cleaned list (allow non-visual entries for fallback text questions)
  const allWords = (wordList || []).filter(w => w && w.eng);
  if (allWords.length < 4) {
    gameArea.innerHTML = '<div style="padding:40px;text-align:center;color:#888;font-size:1.05em;">Need at least 4 words in the list for Easy Picture mode.</div>';
    return;
  }

  // Picturable subset (sample: emoji-supported; user: must have real image)
  function hasValidImg(w) {
    const src = (w.image_url || w.image || w.img || '').trim();
    if (!src) return false;
    const lower = src.toLowerCase();
    if (lower === 'null' || lower === 'undefined' || lower.startsWith('data:')) return false;
    return true;
  }
  const picturable = allWords.filter(w => {
    if (isSampleList) {
      const em = emojiMap[String(w.eng).toLowerCase()];
      return em && isEmojiSupported(em);
    }
    return hasValidImg(w);
  });

  // Shuffle order of all words (not just picturable) for broader exposure
  const ordered = [...allWords].sort(() => Math.random() - 0.5);
  let score = 0;
  let idx = 0;
  const sessionId = startSession({ mode: 'easy_picture', wordList: allWords, listName });

  // Intro splash
  gameArea.innerHTML = `
    <div id="easyPicIntro" style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.3rem,5.2vw,4rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">Listen and choose the picture</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('easyPicIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => {
      showGameProgress(ordered.length, 0);
      renderQuestion();
    }, 650);
  }, 1000);

  function tileHtml(w) {
    if (isSampleList) {
      const em = emojiMap[String(w.eng).toLowerCase()];
      if (em && isEmojiSupported(em)) {
        return `<div style=\"font-size:3.2rem;line-height:1;\">${em}</div>`;
      }
      return `<div style=\"font-size:clamp(1rem,2.9vw,1.3rem);font-weight:600;line-height:1.2;padding:4px;\">${w.kor || w.eng}</div>`;
    }
    const src = (w.image_url || w.image || w.img || '').trim();
    ensureImageStyles();
    return `<div class=\"wa-img-box wa-4x3 rounded shadow\"><img src='${src}' alt='${w.eng}' onerror=\"this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';\"><div style=\"display:none;font-size:clamp(.95rem,2.6vw,1.25rem);font-weight:600;padding:4px;text-align:center;\">${w.kor || w.eng}</div></div>`;
  }

  function canAskPicture(current, distractorPool) {
    if (isSampleList) {
      if (!picturable.some(w => w.eng === current.eng)) return false;
      const others = picturable.filter(w => w.eng !== current.eng);
      return others.length >= 3; // emoji-based
    }
    // user content: need image for current + 3 others
    if (!picturable.some(w => w.eng === current.eng)) return false;
    const others = picturable.filter(w => w.eng !== current.eng);
    return others.length >= 3;
  }

  function renderQuestion() {
  // Guard per question to prevent spamming multiple picks
  let questionLocked = false;
    if (idx >= ordered.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'easy_picture', summary: { score, total: ordered.length } });
      hideGameProgress();
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;">
        <h2 style="color:#41b6beff;">Easy Picture Complete!</h2>
        <div style="font-size:1.2em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${ordered.length}</span></div>
        <button id="playAgainEasyPic" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
  ${document.getElementById('gameStage') ? '' : `<button id=\"tryMoreEasyPic\" style=\"font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Try More</button>`}
      </div>`;
      const again = document.getElementById('playAgainEasyPic');
      if (again) again.onclick = () => startGame('easy_picture');
      const tryMore = document.getElementById('tryMoreEasyPic');
      if (tryMore) tryMore.onclick = () => {
        if (window.WordArcade?.startModeSelector) {
          window.WordArcade.startModeSelector();
        } else {
          startGame('easy_picture', { shuffle: true });
        }
      };
      return;
    }

    const current = ordered[idx];

    // Build distractor pool (other words)
    const others = ordered.filter(w => w !== current);
    // Decide if we can show a visual (picture/emoji) round this question
    const askPicture = canAskPicture(current, others);

    // Build choices (same approach for both; visual rendering differs)
    const choices = [current];
    const pool = [...others];
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (!choices.includes(pick)) choices.push(pick);
    }
    // If still short (should not happen often), pull from allWords again
    const backupPool = allWords.filter(w => !choices.includes(w));
    while (choices.length < 4 && backupPool.length) {
      const pick = backupPool.splice(Math.floor(Math.random() * backupPool.length), 1)[0];
      if (pick) choices.push(pick);
    }
    const shuffledChoices = choices.sort(() => Math.random() - 0.5);

    if (askPicture) {
      gameArea.innerHTML = `
        <div style="padding:16px 16px 6px;text-align:center;">
          <div id="easyPicGrid" style="display:grid;grid-template-columns:repeat(2, minmax(42vw, 1fr));gap:14px;max-width:94vw;margin:0 auto;">
            ${shuffledChoices.map(ch => `
              <button class=\"choice-btn easy-pic-choice\" data-eng=\"${ch.eng}\" ${ch.eng === current.eng ? 'data-correct="1"' : ''} style=\"height:34vh;display:flex;align-items:center;justify-content:center;\">
                ${tileHtml(ch)}
              </button>
            `).join('')}
          </div>
          <div style="display:flex;justify-content:center;align-items:center;margin:18px 0 0 0;">
            <button id="replayWord" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:52px;height:52px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.5em;">▶</button>
          </div>
          <div id="picFeedback" style="margin-top:10px;font-size:1.05em;height:24px;color:#555;"></div>
        </div>`;
    } else {
      // Text fallback (no images / not enough visuals) – show word choices as text buttons
      gameArea.innerHTML = `
        <div style="padding:16px 16px 6px;text-align:center;">
          <div style=\"font-size:1.1em;font-weight:600;margin-bottom:6px;color:#19777e;\">Listen and choose the word</div>
          <div id="easyPicGrid" style="display:grid;grid-template-columns:repeat(2, minmax(42vw, 1fr));gap:14px;max-width:94vw;margin:0 auto;">
            ${shuffledChoices.map(ch => `
              <button class=\"choice-btn easy-pic-choice\" data-eng=\"${ch.eng}\" ${ch.eng === current.eng ? 'data-correct="1"' : ''} style=\"height:10.5vh;display:flex;align-items:center;justify-content:center;font-size:clamp(1rem,3.2vw,1.4rem);font-weight:600;\">${ch.eng}</button>
            `).join('')}
          </div>
          <div style="display:flex;justify-content:center;align-items:center;margin:18px 0 0 0;">
            <button id="replayWord" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:52px;height:52px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.5em;">▶</button>
          </div>
          <div id="picFeedback" style="margin-top:10px;font-size:1.05em;height:24px;color:#555;"></div>
        </div>`;
    }

    // Wire buttons + styles
    setupChoiceButtons(gameArea);

  // Play the target word using the raw keyword to match cached filenames
  playTTS(current.eng);
  const replayBtn = document.getElementById('replayWord');
  if (replayBtn) replayBtn.onclick = () => playTTS(current.eng);

    document.querySelectorAll('.easy-pic-choice').forEach(btn => {
      btn.onclick = () => {
        if (questionLocked) return;
        questionLocked = true;
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
        // Disable all buttons until next render
        document.querySelectorAll('#easyPicGrid button').forEach(b => b.disabled = true);
        // Log attempt
        logAttempt({
          session_id: sessionId,
          mode: 'easy_picture',
          word: current.eng,
          is_correct: correct,
          answer: picked,
          correct_answer: current.eng,
          question_type: askPicture ? 'visual' : 'text',
          attempt_index: idx + 1
        });
        setTimeout(() => { idx++; updateGameProgress(idx, ordered.length); renderQuestion(); }, 900);
      };
    });
  }
}
