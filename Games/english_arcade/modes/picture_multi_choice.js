import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { ensureImageStyles } from '../ui/image_styles.js';

// Picture multiple choice: show an image, student chooses the matching target word (English display -> choose Korean or English variant)
// Expected word object properties (flexible): { eng, kor, img }
// Fallback: if no img, show the English word as text placeholder box.
export function runPictureMultiChoice({ wordList, gameArea, startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = 0; let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'picture_multi_choice', wordList, listName });

  gameArea.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.4rem,5vw,4rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">Match the Picture!</div>
    </div>`;
  setTimeout(() => { showQuestion(); }, 900);

  function showQuestion() {
    if (idx >= shuffled.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'picture_multi_choice', summary: { score, total: shuffled.length, completed: true }, listName, wordList: shuffled });
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;"><h2 style="color:#41b6beff;">Picture Mode Complete!</h2><div style="font-size:1.3em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div><button id="playAgainPicture" style="font-size:1.05em;padding:12px 26px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button></div>`;
      document.getElementById('playAgainPicture').onclick = () => startGame('picture_multi_choice');
      return;
    }
    const current = shuffled[idx];

  // Candidate answer text: show ENGLISH choices for learning English (use eng as answer key)
  const correctAnswer = current.eng;

    // Build distractors from pool
  const pool = shuffled.filter(w => w.eng !== correctAnswer);
    const answers = [correctAnswer];
    while (answers.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  answers.push(pick.eng);
    }
    answers.sort(() => Math.random() - 0.5);

  const imgUrl = current.img || current.image || current.picture || current.image_url || '';

    ensureImageStyles();
    gameArea.innerHTML = `<div style="padding:18px;text-align:center;max-width:560px;margin:0 auto;">
      <div style="margin-bottom:18px;">
        ${imgUrl ? `
          <div class=\"wa-img-box wa-4x3 rounded-14 shadow-lg\" style=\"width:100%;max-width:420px;margin:0 auto;\">\n            <img src='${imgUrl}' alt='word image' onerror=\"this.onerror=null;this.parentElement.style.display='none';\" />\n          </div>` : `<div style=\"height:160px;display:flex;align-items:center;justify-content:center;font-size:clamp(1.4rem,3.5vw,2.6rem);font-weight:700;color:#19777e;border:3px dashed #93cbcf;border-radius:14px;\">${current.eng}</div>`}
      </div>
  <div id="pictureChoices" style="display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:16px;max-width:480px;margin:0 auto 12px auto;justify-content:center;">
    ${answers.map(a => `<button class=\"choice-btn picture-choice\" data-answer=\"${a}\" ${a === correctAnswer ? 'data-correct="1"' : ''}>${a}</button>`).join('')}
      </div>
      <div id="pictureFeedback" style="min-height:28px;font-size:1.05em;color:#555;margin-top:6px;"></div>
      <div style="margin-top:4px;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
    </div>`;
  // Add anti-cheat lock with small latency
  setupChoiceButtons(gameArea, { minAnswerLatencyMs: 120 });

    document.querySelectorAll('.picture-choice').forEach(btn => {
      btn.onclick = () => {
        const feedback = document.getElementById('pictureFeedback');
        const chosen = btn.dataset.answer;
        const correct = chosen === correctAnswer;
        splashResult(btn, correct);
        if (correct) { score++; feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; playSFX('correct'); }
        else { feedback.textContent = 'Incorrect'; feedback.style.color = '#e53e3e'; playSFX('wrong'); }

        logAttempt({
          session_id: sessionId,
          mode: 'picture_multi_choice',
          word: current.eng,
          is_correct: correct,
          answer: chosen,
          correct_answer: correctAnswer,
          attempt_index: idx + 1,
          extra: { img: imgUrl || null, eng: current.eng, kor: current.kor || null }
        });
        setTimeout(() => { idx++; showQuestion(); }, 900);
      };
    });
  }
}
