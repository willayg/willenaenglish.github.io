import { playSFX } from '../sfx.js';

// Listening mode: English audio, choose correct Korean translation
export function runListeningMode({ wordList, gameArea, playTTS, preprocessTTS, startGame }) {
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);

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

    gameArea.innerHTML = `<div class="listening-game" style="max-width:420px;margin:0 auto;">
      <div id="listening-instructions" style="margin-bottom:18px;text-align:center;font-size:1.1em;color:#19777e;">Listen and choose the correct Korean translation:</div>
      <button id="playAudioBtn" style="font-size:1em;padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-bottom:18px;">🔊 Play Again</button>
      <div id="listeningChoices" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:400px;margin:0 auto 18px auto;">
        ${choices.map(kor => `
            <button class="listening-choice" data-kor="${kor}" style="height:15vh;border-radius:8px;background:#f7f7f7;color:#19777e;font-weight:700;border:2px solid #41b6beff;box-shadow:0 2px 8px rgba(60,60,80,0.10);cursor:pointer;font-size:clamp(1.2em,4vw,3em);display:flex;align-items:center;justify-content:center;transition:transform .08s ease;">
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

    // Button logic
    document.querySelectorAll('.listening-choice').forEach(btn => {
      btn.onmousedown = () => { btn.style.transform = 'scale(0.97)'; };
      btn.onmouseup = () => { btn.style.transform = 'scale(1)'; };
      btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; };
      btn.onclick = () => {
        const feedback = document.getElementById('listening-feedback');
        if (btn.dataset.kor === current.kor) {
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
