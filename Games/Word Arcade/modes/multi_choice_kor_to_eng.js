import { playSFX } from '../sfx.js';

// Multi-choice: Korean prompt, English choices
export function runMultiChoiceKorToEng({ wordList, gameArea, startGame }) {
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="multiKorEngIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Choose the English word!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('multiKorEngIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { renderQuestion(); }, 650);
  }, 1000);

  function renderQuestion() {
    if (idx >= shuffled.length) {
      playSFX('end');
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;"><h2 style="color:#41b6beff;">Game Complete!</h2><div style="font-size:1.3em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div><button id="playAgainMultiKorEng" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button></div>`;
      document.getElementById('playAgainMultiKorEng').onclick = () => startGame('multi_choice_kor_to_eng');
      return;
    }
    const current = shuffled[idx];
    // Pick 3 distractors
    const choices = [current.eng];
    const pool = shuffled.filter(w => w.eng !== current.eng);
    while (choices.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      choices.push(pick.eng);
    }
    choices.sort(() => Math.random() - 0.5);
    gameArea.innerHTML = `<div style="padding:24px;text-align:center;max-width:420px;margin:0 auto;">
      <div style="font-size:clamp(1.3em,3vw,2.2em);font-weight:700;color:#19777e;margin-bottom:18px;">${current.kor}</div>
      <div id="multiChoicesKorEng" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:400px;margin:0 auto 18px auto;">
        ${choices.map(eng => `
          <button class="multi-choice-btn" data-eng="${eng}" style="height:15vh;border-radius:8px;background:#f7f7f7;color:#19777e;font-weight:700;border:2px solid #41b6beff;box-shadow:0 2px 8px rgba(60,60,80,0.10);cursor:pointer;font-size:clamp(1.2em,4vw,3em);display:flex;align-items:center;justify-content:center;transition:transform .08s ease;">
            ${eng}
          </button>
        `).join('')}
      </div>
      <div id="multiFeedbackKorEng" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
      <div id="multiScoreKorEng" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">Score: ${score}</div>
    </div>`;
    document.querySelectorAll('.multi-choice-btn').forEach(btn => {
      btn.onmousedown = () => { btn.style.transform = 'scale(0.97)'; };
      btn.onmouseup = () => { btn.style.transform = 'scale(1)'; };
      btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
      btn.onclick = () => {
        const feedback = document.getElementById('multiFeedbackKorEng');
        if (btn.dataset.eng === current.eng) {
          score++;
          feedback.textContent = 'Correct!';
          feedback.style.color = '#19777e';
          playSFX('correct');
        } else {
          feedback.textContent = 'Incorrect!';
          feedback.style.color = '#e53e3e';
          playSFX('wrong');
        }
        setTimeout(() => {
          idx++;
          renderQuestion();
        }, 900);
      };
    });
  }
  
  // First question is triggered after the intro fades out
}
