import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';
import { ensureImageStyles } from '../ui/image_styles.js';

// Listening mode: English audio, choose correct Korean translation
export function runListeningMode({ wordList, gameArea, playTTS, preprocessTTS, startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'listening', wordList, listName });
  // One-answer-per-question lockout shared across renderers
  let questionLocked = false;

  // Detect sample list for emoji-first behavior (any .json file from sample-wordlists or sample-wordlists-level2)
  const isSampleList = !!(listName && listName.includes('.json'));

  // Emoji mapping cache (loaded on demand)
  let emojiMap = {};
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
  async function ensureEmojiMappings() {
    if (Object.keys(emojiMap).length > 0) return emojiMap;
    try {
      const res = await fetch('./emoji-list/emoji-mappings.json');
      const mappings = await res.json();
      for (const category of Object.values(mappings)) Object.assign(emojiMap, category);
    } catch (e) {
      console.warn('Could not load emoji mappings for listening mix, using fallback', e);
      emojiMap = {
        dog: '🐶', cat: '🐱', rabbit: '🐰', horse: '🐴', cow: '🐮', pig: '🐷',
        car: '🚗', bus: '🚌', train: '🚆', plane: '✈️', house: '🏠', school: '🏫',
        apple: '🍎', banana: '🍌', orange: '🍊', sun: '☀️', moon: '🌙', star: '⭐'
      };
    }
    return emojiMap;
  }
  function hasValidImg(w) {
    const raw = (w && (w.image_url || w.image || w.img)) || '';
    if (typeof raw !== 'string') return false;
    const s = raw.trim();
    if (!s) return false; const low = s.toLowerCase();
    return low !== 'null' && low !== 'undefined';
  }
  function getEmojiFor(word) {
    const key = String(word || '').toLowerCase();
    return emojiMap[key] || '';
  }
  function getPicturable(list) {
    return list.filter(w => {
      if (!w || !w.eng) return false;
      // Check for emoji field (phonics)
      if (w.emoji && isEmojiSupported(w.emoji)) return true;
      if (isSampleList) {
        const em = getEmojiFor(w.eng);
        return em && isEmojiSupported(em);
      }
      return hasValidImg(w); // user content: require real image
    });
  }
  function tileHtml(w) {
    // Check emoji field first (phonics)
    if (w.emoji && isEmojiSupported(w.emoji)) {
      return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:clamp(2.5rem,8vw,3.8rem);line-height:1;\">${w.emoji}</div>`;
    }
    if (isSampleList) {
      const em = getEmojiFor(w.eng) || '❓';
      return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:clamp(2.5rem,8vw,3.8rem);line-height:1;\">${em}</div>`;
    }
    const src = (w.image_url || w.image || w.img).trim();
    ensureImageStyles();
    // Include an inline fallback so a failed image shows the word instead of a blank tile
    return `<div class=\"wa-img-box wa-4x3 rounded shadow\" style=\"max-width:40vw;display:flex;align-items:center;justify-content:center;position:relative;\">
      <img src='${src}' alt='${w.eng}' style=\"max-width:100%;max-height:100%;object-fit:cover;\" onerror=\"this.style.display='none';this.nextElementSibling.style.display='flex';\">
      <div class=\"wa-img-fallback\" style=\"display:none;font-size:clamp(1rem,3.1vw,1.35rem);font-weight:600;padding:4px;text-align:center;\">${w.eng}</div>
    </div>`;
  }
  let picturable = [];
  let canDoPictures = false;
  let usePictureNext = true; // alternate where possible

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="listeningIntro" style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">Listen and choose!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('listeningIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(async () => {
      await ensureEmojiMappings();
      picturable = getPicturable(shuffled);
      canDoPictures = picturable.length >= 4;
      // Initialize in-game progress: 0 of N
      showGameProgress(shuffled.length, 0);
      renderQuestion();
    }, 650);
  }, 1000);

  function renderQuestion() {
  // Reset lock for this question
  questionLocked = false;
    if (idx >= shuffled.length) {
      playSFX('end');
  endSession(sessionId, { mode: 'listening', summary: { score, total: shuffled.length, completed: true }, listName, wordList: shuffled });
      hideGameProgress();
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#41b6beff;font-size:2em;margin-bottom:18px;">Listening Game Over!</h2>
        ${isReview ? '' : `<div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div>`}
        <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
  ${document.getElementById('gameStage') ? '' : `<button id=\"tryMoreBtn\" style=\"font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Try More</button>`}
      </div>`;
      document.getElementById('playAgainBtn').onclick = () => startGame('listening');
      document.getElementById('tryMoreBtn').onclick = () => {
        if (window.WordArcade?.startModeSelector) {
          window.WordArcade.startModeSelector();
        } else {
          startGame('listening', { shuffle: true });
        }
      };
      return;
    }
    const current = shuffled[idx];

    // Decide question type: alternate text vs picture when possible
    const currentCanBePicture = canDoPictures && picturable.some(w => w.eng === current.eng);
    // Only ask for a picture round if we can assemble 4 fully visual options (current + 3 others)
    let askPicture = false;
    if (currentCanBePicture) {
      const others = picturable.filter(w => w.eng !== current.eng);
      if (others.length >= 3) askPicture = usePictureNext; // alternate only if feasible
    }

    if (askPicture) {
      // Build 4 picture choices (1 correct + 3 distractors)
      const pool = picturable.filter(w => w.eng !== current.eng);
      const choices = [current];
      while (choices.length < 4 && pool.length) {
        const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        if (pick) choices.push(pick);
      }
      // Fallback to text if insufficient distractors
      if (choices.length < 4) {
        renderAsTextQuestion(current);
      } else {
        const shuffledChoices = choices.sort(() => Math.random() - 0.5);
        gameArea.innerHTML = `
          <div class="listening-game" style="max-width:640px;margin:0 auto;">
            <div id="pictureChoices" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:16px;max-width:100%;margin:0 auto 18px auto;padding:0 12px;">
              ${shuffledChoices.map(ch => `
                <button class="choice-btn pic-choice" data-eng="${ch.eng}" ${ch.eng === current.eng ? 'data-correct="1"' : ''} style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;min-height:140px;">
                  ${tileHtml(ch)}
                </button>
              `).join('')}
            </div>
            <div style="display:flex;justify-content:center;align-items:center;margin:18px 0 0 0;">
              <button id="playAudioBtn" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:52px;height:52px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.5em;">▶</button>
            </div>
            <div id="listening-feedback" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
            <div id="listening-score" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
          </div>`;

        // Play audio
        const playCurrentWord = () => playTTS(current.eng);
        playCurrentWord();
        document.getElementById('playAudioBtn').onclick = playCurrentWord;
        setupChoiceButtons(gameArea);
        gameArea.querySelectorAll('.pic-choice').forEach(btn => {
          btn.onclick = () => {
            if (questionLocked) return;
            questionLocked = true;
            const picked = btn.getAttribute('data-eng');
            const isCorrect = picked === current.eng;
            splashResult(btn, isCorrect);
            const feedback = document.getElementById('listening-feedback');
            if (isCorrect) { score++; if (feedback) { feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; } playSFX('correct'); }
            else { if (feedback) { feedback.textContent = `It was: ${current.eng}`; feedback.style.color = '#e53e3e'; } playSFX('wrong'); }
            // Disable all buttons until next render
            gameArea.querySelectorAll('button').forEach(b => b.disabled = true);
            logAttempt({ session_id: sessionId, mode: 'listening', word: current.eng, is_correct: isCorrect, answer: picked, correct_answer: current.eng, attempt_index: idx + 1 });
            setTimeout(() => { idx++; updateGameProgress(idx, shuffled.length); if (canDoPictures) usePictureNext = !usePictureNext; renderQuestion(); }, 900);
          };
        });
      }
    } else {
      renderAsTextQuestion(current);
    }
  }

  function renderAsTextQuestion(current) {
  // Reset lock when rendering text question
  questionLocked = false;
    // Build 4 Korean choices (1 correct + 3 distractors)
    const choices = [current.kor];
    const pool = shuffled.filter(w => w.kor !== current.kor);
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (pick && pick.kor) choices.push(pick.kor);
    }
    const shuffledKor = choices.sort(() => Math.random() - 0.5);

    gameArea.innerHTML = `<div class="listening-game" style="max-width:640px;margin:0 auto;">
      <div id="listeningChoices" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:12px;max-width:100%;margin:0 auto 18px auto;padding:0 12px;">
        ${shuffledKor.map(kor => `
            <button class="listening-choice choice-btn" data-kor="${kor}" ${kor === current.kor ? 'data-correct="1"' : ''} style="height:auto;min-height:80px;display:flex;align-items:center;justify-content:center;">
            ${kor}
          </button>
        `).join('')}
      </div>
      <div style="display:flex;justify-content:center;align-items:center;margin:18px 0 0 0;">
        <button id="playAudioBtn" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:52px;height:52px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.5em;">▶</button>
      </div>
      <div id="listening-feedback" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
      <div id="listening-score" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
    </div>`;

    const playCurrentWord = () => playTTS(current.eng);
    playCurrentWord();
    document.getElementById('playAudioBtn').onclick = playCurrentWord;

    setupChoiceButtons(gameArea);
    gameArea.querySelectorAll('.listening-choice').forEach(btn => {
      btn.onclick = () => {
        if (questionLocked) return;
        questionLocked = true;
        const isCorrect = btn.dataset.kor === current.kor;
        splashResult(btn, isCorrect);
        const feedback = document.getElementById('listening-feedback');
        if (isCorrect) {
          score++;
          if (feedback) { feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; }
          playSFX('correct');
        } else {
          if (feedback) { feedback.textContent = 'Incorrect!'; feedback.style.color = '#e53e3e'; }
          playSFX('wrong');
        }
        // Disable all buttons until next render
        gameArea.querySelectorAll('button').forEach(b => b.disabled = true);
  logAttempt({ session_id: sessionId, mode: 'listening', word: current.eng, is_correct: isCorrect, answer: btn.dataset.kor, correct_answer: current.kor, attempt_index: idx + 1 });
        setTimeout(() => { idx++; updateGameProgress(idx, shuffled.length); if (canDoPictures) usePictureNext = !usePictureNext; renderQuestion(); }, 900);
      };
    });
  }

  // First question is triggered after the intro fades out
}
