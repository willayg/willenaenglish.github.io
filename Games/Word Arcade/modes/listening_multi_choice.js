import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Listening multiple choice: play TTS/audio of the English (or Korean) word; student chooses the correct written form (default: English prompt -> choose Korean)
// Word object: { eng, kor, audio_eng?, audio_kor? }
// We'll look for audio URL fields: audio || audio_eng || tts || (later dynamic fetch?)
// Fallback: if no audio, just display the word text similarly to eng->kor mode (so game still proceeds).
export function runListeningMultiChoice({ wordList, gameArea, startGame, listName = null, playTTS }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = 0; let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'listening_multi_choice', wordList, listName });

  gameArea.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.3rem,5vw,3.8rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Listen and Choose!</div>
    </div>`;
  // After intro, start the first question; audio has been preloaded via play-main.js
  setTimeout(() => { const intro = gameArea.querySelector('div'); if (intro) intro.style.opacity = '0'; setTimeout(() => renderQuestion(), 300); }, 900);

  function renderQuestion() {
    if (idx >= shuffled.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'listening_multi_choice', summary: { score, total: shuffled.length } });
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;"><h2 style="color:#41b6beff;">Listening Mode Complete!</h2><div style="font-size:1.3em;margin-bottom:12px;">Score: <span style="color:#19777e;font-weight:700;">${score} / ${shuffled.length}</span></div><button id="playAgainListening" style="font-size:1.05em;padding:12px 26px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button></div>`;
      document.getElementById('playAgainListening').onclick = () => startGame('listening_multi_choice');
      return;
    }
    const current = shuffled[idx];
    const correctAnswer = current.kor || current.eng; // choose answer text
    const pool = shuffled.filter(w => (w.kor || w.eng) !== correctAnswer);
    const answers = [correctAnswer];
    while (answers.length < 4 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      answers.push(pick.kor || pick.eng);
    }
    answers.sort(() => Math.random() - 0.5);

    gameArea.innerHTML = `<div style="padding:22px;text-align:center;max-width:560px;margin:0 auto;">
      <div style="margin-bottom:14px;">
        <button id="listenPlayBtn" style="background:#19777e;color:#fff;font-weight:700;padding:14px 30px;font-size:1.1em;border:none;border-radius:14px;box-shadow:0 4px 14px rgba(0,0,0,.12);cursor:pointer;">▶ Listen</button>
      </div>
      <div id="listeningChoices" style="display:grid;grid-template-columns:repeat(2,minmax(140px,1fr));gap:16px;max-width:480px;margin:0 auto 12px auto;">
        ${answers.map(a => `<button class=\"choice-btn listening-choice\" data-answer=\"${a}\" ${a === correctAnswer ? 'data-correct=\"1\"' : ''}>${a}</button>`).join('')}
      </div>
      <div id="listeningFeedback" style="min-height:28px;font-size:1.05em;color:#555;margin-top:6px;"></div>
      <div style="margin-top:4px;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
    </div>`;

  // Enforce single answer + minimal latency to reduce rapid-fire guessing
  setupChoiceButtons(gameArea, { minAnswerLatencyMs: 120 });

    const playBtn = document.getElementById('listenPlayBtn');
    playBtn.onclick = () => { try { playTTS(current.eng); } catch { /* ignore */ } };
    // Auto play once
    setTimeout(() => { playBtn.click(); }, 250);

    document.querySelectorAll('.listening-choice').forEach(btn => {
      btn.onclick = () => {
        const feedback = document.getElementById('listeningFeedback');
        const chosen = btn.dataset.answer;
        const correct = chosen === correctAnswer;
        splashResult(btn, correct);
        if (correct) { score++; feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; playSFX('correct'); }
        else { feedback.textContent = 'Incorrect'; feedback.style.color = '#e53e3e'; playSFX('wrong'); }

        logAttempt({
          session_id: sessionId,
            mode: 'listening_multi_choice',
            word: current.eng,
            is_correct: correct,
            answer: chosen,
            correct_answer: correctAnswer,
            attempt_index: idx + 1,
            extra: { eng: current.eng, kor: current.kor || null }
        });
        setTimeout(() => { idx++; renderQuestion(); }, 900);
      };
    });
  }
}
