import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

// Listen and Spell mode
export function runListenAndSpellMode({ wordList, gameArea, playTTS, preprocessTTS, startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let listeningScore = 0;
  let listeningIdx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'listen_and_spell', wordList, listName });

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="listenSpellIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Listen and spell it out!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('listenSpellIntro');
    if (intro) intro.style.opacity = '0';
  setTimeout(() => { showGameProgress(shuffled.length, 0); startGame(); }, 650);
  }, 1000);

  function startGame() {
    gameArea.innerHTML = `<div class="listening-game" style="max-width:340px;margin:0 auto;">
      <div id="listening-instructions" style="margin-bottom:18px;text-align:center;font-size:1.1em;color:#19777e;">Listen and type the English word you hear:</div>
      <input type="text" id="listeningInput" placeholder="Type English" style="font-size:1.1em;padding:8px 12px;border-radius:8px;border:1.5px solid #f59e0b;outline:none;width:120px;">
      <span id="listening-feedback" style="margin-left:12px;font-size:1em;"></span>
      <div style="display:flex;justify-content:center;align-items:center;margin:18px 0 0 0;">
        <button id="playAudioBtn" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:52px;height:52px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.5em;">▶</button>
      </div>
      <div id="listening-score" style="margin-top:18px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : 'Score: 0'}</div>
    </div>`;

    function playCurrentWord() {
      const word = shuffled[listeningIdx].eng;
      // Use the raw target word for playback so it maps directly to cached audio
      playTTS(word);
    }
    playCurrentWord();

    document.getElementById('playAudioBtn').onclick = playCurrentWord;

    const input = document.getElementById('listeningInput');
    input.focus();
    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !input.disabled) {
        const feedback = document.getElementById('listening-feedback');
        const answer = input.value.trim().toLowerCase();
        const correct = shuffled[listeningIdx].eng.toLowerCase();
        let points = 0;
        if (answer === correct) {
          points = 2;
          feedback.textContent = 'Perfect! +2';
          feedback.style.color = '#19777e';
          playSFX('correct');
        } else if (levenshtein(answer, correct) === 1) {
          points = 1;
          feedback.textContent = 'Close! +1';
          feedback.style.color = '#f59e0b';
          playSFX('kindaRight');
        } else {
          feedback.textContent = 'Oops!';
          feedback.style.color = '#e53e3e';
          playSFX('wrong');
        }
        // Log attempt
        logAttempt({
          session_id: sessionId,
          mode: 'listen_and_spell',
          word: shuffled[listeningIdx].eng,
          is_correct: points > 0,
          answer,
          correct_answer: correct,
          points: isReview ? points * 2 : points,
          attempt_index: listeningIdx + 1
        });
        input.disabled = true;
        listeningScore += points;
        const scoreEl = document.getElementById('listening-score');
        if (scoreEl && !isReview) scoreEl.textContent = `Score: ${listeningScore}`;
        setTimeout(() => {
          listeningIdx++;
          updateGameProgress(listeningIdx, shuffled.length);
          if (listeningIdx < shuffled.length) {
            feedback.textContent = '';
            input.value = '';
            input.disabled = false;
            playCurrentWord();
            input.focus();
          } else {
            playSFX('end');
      endSession(sessionId, { mode: 'listen_and_spell', summary: { score: listeningScore, max: shuffled.length * 2 } });
            hideGameProgress();
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
                <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Listening Game Over!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.3em;margin-bottom:12px;\">Your Score: <span style=\"color:#19777e;font-weight:700;\">${listeningScore} / ${shuffled.length*2}</span></div>`}
                <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
                <button id="tryMoreListenSpell" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;">Try More</button>
              </div>`;
            document.getElementById('playAgainBtn').onclick = () => startGame('listen_and_spell');
            document.getElementById('tryMoreListenSpell').onclick = () => {
              if (window.WordArcade?.startModeSelector) {
                window.WordArcade.startModeSelector();
              } else {
                startGame('listen_and_spell', { shuffle: true });
              }
            };
          }
        }, 900);
      }
    });
  }

  function levenshtein(a, b) {
    const dp = Array(a.length + 1).fill().map(() => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
        else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[a.length][b.length];
  }

  // Game starts after the intro fades out
}
