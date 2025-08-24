import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Multiple Choice (Mixed): randomly alternates between Kor→Eng and Eng→Kor each round
export function runMultiChoiceMode({ wordList, gameArea, startGame }) {
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'multi_choice', wordList });

  // Intro splash
  gameArea.innerHTML = `
    <div id="multiMixedIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.2rem,5vw,3.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">
        Multiple Choice
        <div style="font-size:clamp(0.9rem,3.5vw,1.4rem);font-weight:600;color:#248b86ff;margin-top:8px;">
          Sometimes Korean, sometimes English!
        </div>
      </div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('multiMixedIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderQuestion(); }, 650);
  }, 1000);

  function renderQuestion() {
    if (idx >= shuffled.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'multi_choice', summary: { score, total: shuffled.length } });
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;">
        <h2 style="color:#41b6beff;">Game Complete!</h2>
        <div style="font-size:1.3em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div>
        <button id="playAgainMultiMixed" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
      </div>`;
      document.getElementById('playAgainMultiMixed').onclick = () => startGame('multi_choice');
      return;
    }

    const current = shuffled[idx];
    const korToEng = Math.random() < 0.5;

    // Build prompt and options depending on direction
    let prompt, correctText, optionPool, dataAttr;
    if (korToEng) {
      prompt = current.kor;
      correctText = current.eng;
      optionPool = shuffled.filter(w => w.eng !== current.eng).map(w => w.eng);
      dataAttr = 'eng';
    } else {
      prompt = current.eng;
      correctText = current.kor;
      optionPool = shuffled.filter(w => w.kor !== current.kor).map(w => w.kor);
      dataAttr = 'kor';
    }

    const choices = [correctText];
    const poolCopy = [...optionPool];
    while (choices.length < 4 && poolCopy.length) {
      const pick = poolCopy.splice(Math.floor(Math.random() * poolCopy.length), 1)[0];
      choices.push(pick);
    }
    choices.sort(() => Math.random() - 0.5);

    gameArea.innerHTML = `<div style="padding:24px;text-align:center;max-width:520px;margin:0 auto;">
      <div style="font-size:clamp(0.95em,2.6vw,1.1em);color:#555;margin-bottom:6px;">${korToEng ? 'Pick the English' : 'Pick the Korean'}</div>
      <div style="font-size:clamp(1.3em,3vw,2.2em);font-weight:700;color:#19777e;margin-bottom:18px;">${prompt}</div>
      <div id="multiChoicesMixed" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:480px;margin:0 auto 18px auto;">
        ${choices.map(txt => `
          <button class="multi-choice-btn choice-btn" data-${dataAttr}="${txt.replaceAll('"','&quot;')}">
            ${txt}
          </button>
        `).join('')}
      </div>
      <div id="multiFeedbackMixed" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
      <div id="multiScoreMixed" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">Score: ${score}</div>
    </div>`;

    // Set uniform height for choices
    document.querySelectorAll('#multiChoicesMixed .choice-btn').forEach(btn => {
      btn.style.height = '15vh';
    });

    setupChoiceButtons(gameArea);
    document.querySelectorAll('#multiChoicesMixed .multi-choice-btn').forEach(btn => {
      btn.onclick = () => {
        const feedback = document.getElementById('multiFeedbackMixed');
        const selected = btn.getAttribute(`data-${dataAttr}`);
        const correct = selected === correctText;
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
        // Log attempt
        logAttempt({
          session_id: sessionId,
          mode: 'multi_choice',
          word: korToEng ? current.eng : current.kor,
          is_correct: correct,
          answer: selected,
          correct_answer: correctText,
          points: correct ? 1 : 0,
          attempt_index: idx + 1,
          extra: { direction: korToEng ? 'kor_to_eng' : 'eng_to_kor' }
        });
        setTimeout(() => {
          idx++;
          renderQuestion();
        }, 900);
      };
    });
  }
}
