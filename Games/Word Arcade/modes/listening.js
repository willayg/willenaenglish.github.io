import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Listening mode: English audio, choose correct Korean translation
export function runListeningMode({ wordList, gameArea, playTTS, preprocessTTS, startGame }) {
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'listening', wordList });

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="listeningIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Listen and choose Korean!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('listeningIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderQuestion(); }, 650);
  }, 1000);

  function renderQuestion() {
    if (idx >= shuffled.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'listening', summary: { score, total: shuffled.length } });
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#41b6beff;font-size:2em;margin-bottom:18px;">Listening Game Over!</h2>
        <div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div>
        <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
      </div>`;
      document.getElementById('playAgainBtn').onclick = () => startGame('listening');
      return;
    }
    const current = shuffled[idx];
    // Pick 3 distractors
    const choices = [current.kor];
    const pool = shuffled.filter(w => w.kor !== current.kor);
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      choices.push(pick.kor);
    }
    choices.sort(() => Math.random() - 0.5);

    gameArea.innerHTML = `<div class="listening-game" style="max-width:640px;margin:0 auto;">
      <div id="listening-instructions" style="margin-bottom:18px;text-align:center;font-size:1.1em;color:#19777e;">Listen and choose the correct Korean translation:</div>
      <button id="playAudioBtn" style="font-size:1em;padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-bottom:18px;">🔊 Play Again</button>
      <div id="listeningChoices" style="display:grid;grid-template-columns:repeat(2, minmax(160px, 1fr));gap:16px;max-width:540px;margin:0 auto 18px auto;">
        ${choices.map(kor => `
            <button class="listening-choice choice-btn" data-kor="${kor}" style="height:18vh;">
            ${kor}
          </button>
        `).join('')}
      </div>
      <div id="listening-feedback" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
      <div id="listening-score" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">Score: ${score}</div>
    </div>`;

    // Play audio
    function playCurrentWord() {
      playTTS(preprocessTTS(current.eng));
    }
    playCurrentWord();
    document.getElementById('playAudioBtn').onclick = playCurrentWord;

    // Button logic using shared helpers and splash feedback
    setupChoiceButtons(gameArea);
    document.querySelectorAll('.listening-choice').forEach(btn => {
      btn.onclick = () => {
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
        // Log attempt
        logAttempt({
          session_id: sessionId,
          mode: 'listening',
          word: current.eng,
          is_correct: isCorrect,
          answer: btn.dataset.kor,
          correct_answer: current.kor,
          points: isCorrect ? 1 : 0,
          attempt_index: idx + 1
        });
        setTimeout(() => { idx++; renderQuestion(); }, 900);
      };
    });
  }

  // First question is triggered after the intro fades out
}
