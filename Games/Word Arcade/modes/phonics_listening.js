import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

// Phonics Listening Mode: hear a word, pick from 4 English words only (no pictures/Korean)
export function runPhonicsListeningMode({ wordList, gameArea, playTTS, /* preprocessTTS */ startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'phonics_listening', wordList, listName });
  let questionLocked = false;

  // Show intro phrase large, then fade out
  gameArea.innerHTML = `
    <div id="phonicsListeningIntro" style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">Listen and choose!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('phonicsListeningIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => {
      showGameProgress(shuffled.length, 0);
      renderQuestion();
    }, 650);
  }, 1000);

  function renderQuestion() {
    questionLocked = false;
    if (idx >= shuffled.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'phonics_listening', summary: { score, total: shuffled.length, completed: true }, listName, wordList: shuffled });
      hideGameProgress();
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#41b6beff;font-size:2em;margin-bottom:18px;">Phonics Listening Complete!</h2>
        ${isReview ? '' : `<div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div>`}
        <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
        ${document.getElementById('gameStage') ? '' : `<button id="tryMoreBtn" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;">Try More</button>`}
      </div>`;
      document.getElementById('playAgainBtn').onclick = () => startGame('phonics_listening');
      document.getElementById('tryMoreBtn').onclick = () => {
        if (window.WordArcade?.startModeSelector) {
          window.WordArcade.startModeSelector();
        } else {
          startGame('phonics_listening', { shuffle: true });
        }
      };
      return;
    }

    const current = shuffled[idx];

    // Build 4 English word choices (1 correct + 3 distractors)
    const choices = [current.eng];
    const pool = shuffled.filter(w => w.eng !== current.eng);
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (pick && pick.eng) choices.push(pick.eng);
    }
    const shuffledEng = choices.sort(() => Math.random() - 0.5);

    gameArea.innerHTML = `<div class="phonics-listening-game" style="max-width:640px;margin:0 auto;">
      <div id="phonicsListeningChoices" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;max-width:100%;margin:0 auto 18px auto;padding:0 12px;">
        ${shuffledEng.map(eng => {
          const wordObj = shuffled.find(w => w.eng === eng);
          const korean = wordObj?.kor || '';
          const emoji = wordObj?.emoji || '';
          return `
            <button class="phonics-listening-choice choice-btn" data-eng="${eng}" ${eng === current.eng ? 'data-correct="1"' : ''} style="height:auto;min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:700;padding:12px;border-radius:8px;gap:6px;font-family:'Poppins', Arial, sans-serif;">
              <div style="font-size:clamp(1.2rem,3.5vw,1.6rem);">${eng}</div>
              ${emoji ? `<div style="font-size:2em;">${emoji}</div>` : ''}
              ${korean ? `<div style="font-size:clamp(0.8rem,2vw,0.95rem);color:#666;">${korean}</div>` : ''}
            </button>
          `;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:center;align-items:center;margin:18px 0 0 0;">
        <button id="playAudioBtn" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:52px;height:52px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.5em;">▶</button>
      </div>
      <div id="phonics-listening-feedback" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
      <div id="phonics-listening-score" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
    </div>`;

    const playCurrentWord = () => playTTS(current.eng);
    playCurrentWord();
    document.getElementById('playAudioBtn').onclick = playCurrentWord;

    setupChoiceButtons(gameArea);
    gameArea.querySelectorAll('.phonics-listening-choice').forEach(btn => {
      btn.onclick = () => {
        if (questionLocked) return;
        questionLocked = true;
        const isCorrect = btn.dataset.eng === current.eng;
        splashResult(btn, isCorrect);
        const feedback = document.getElementById('phonics-listening-feedback');
        if (isCorrect) {
          score++;
          if (feedback) { feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; }
          playSFX('correct');
        } else {
          if (feedback) { feedback.textContent = `It was: ${current.eng}`; feedback.style.color = '#e53e3e'; }
          playSFX('wrong');
        }
        // Disable all buttons until next render
        gameArea.querySelectorAll('button').forEach(b => b.disabled = true);
        logAttempt({ session_id: sessionId, mode: 'phonics_listening', word: current.eng, is_correct: isCorrect, answer: btn.dataset.eng, correct_answer: current.eng, attempt_index: idx + 1 });
        const scoreBtn = document.getElementById('phonics-listening-score');
        if (scoreBtn && !isReview) scoreBtn.textContent = `Score: ${score}`;
        setTimeout(() => { idx++; updateGameProgress(idx, shuffled.length); renderQuestion(); }, 900);
      };
    });
  }
}
