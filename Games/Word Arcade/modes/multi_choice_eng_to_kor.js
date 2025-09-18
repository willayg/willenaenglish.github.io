import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Multi-choice: English prompt, Korean choices
export function runMultiChoiceEngToKor({ wordList, gameArea, startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'multi_choice_eng_to_kor', wordList, listName });

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="multiEngKorIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Choose the Korean word!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('multiEngKorIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderQuestion(); }, 650);
  }, 1000);

  function renderQuestion() {
    if (idx >= shuffled.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'multi_choice_eng_to_kor', summary: { score, total: shuffled.length } });
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;"><h2 style="color:#41b6beff;">Game Complete!</h2><div style="font-size:1.3em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div><button id="playAgainMultiEngKor" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button></div>`;
      document.getElementById('playAgainMultiEngKor').onclick = () => startGame('multi_choice_eng_to_kor');
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
    gameArea.innerHTML = `<div style="padding:24px;text-align:center;max-width:420px;margin:0 auto;">
      <div style="font-size:clamp(1.3em,3vw,2.2em);font-weight:700;color:#19777e;margin-bottom:18px;">${current.eng}</div>
      <div id="multiChoicesEngKor" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:400px;margin:0 auto 18px auto;">
        ${choices.map(kor => `
          <button class="multi-choice-btn choice-btn" data-kor="${kor}" style="height:15vh;">
            ${kor}
          </button>
        `).join('')}
      </div>
      <div id="multiFeedbackEngKor" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
  <div id="multiScoreEngKor" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
    </div>`;
  setupChoiceButtons(gameArea, { minAnswerLatencyMs: 120 });
    document.querySelectorAll('.multi-choice-btn').forEach(btn => {
      btn.onclick = () => {
        const feedback = document.getElementById('multiFeedbackEngKor');
        const correct = btn.dataset.kor === current.kor;
        splashResult(btn, correct);
        if (correct) {
          score++;
          feedback.textContent = 'Correct!';
          feedback.style.color = '#19777e';
          playSFX('correct');
        } else {
          feedback.textContent = 'Incorrect!';
          feedback.style.color = '#e53e3e';
          playSFX('wrong');
        }
        // Log attempt: `word` is the prompt (English), `answer` is chosen Korean
        logAttempt({
          session_id: sessionId,
          mode: 'multi_choice_eng_to_kor',
          word: current.eng,
          is_correct: correct,
          answer: btn.dataset.kor,
          correct_answer: current.kor,
          // scoreless build: no points
          attempt_index: idx + 1,
          extra: { direction: 'eng_to_kor', eng: current.eng, kor: current.kor }
        });
        setTimeout(() => {
          idx++;
          renderQuestion();
        }, 900);
      };
    });
  }
  
  // First question is triggered after the intro fades out
}
