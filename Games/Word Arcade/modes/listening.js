import { playSFX } from '../sfx.js';

// Listening mode
export function runListeningMode({ wordList, gameArea, playTTS, preprocessTTS, startGame }) {
  let listeningScore = 0;
  let listeningIdx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  gameArea.innerHTML = `<div class="listening-game" style="max-width:340px;margin:0 auto;">
      <div id="listening-instructions" style="margin-bottom:18px;text-align:center;font-size:1.1em;color:#19777e;">Listen and type the English word you hear:</div>
      <button id="playAudioBtn" style="font-size:1em;padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-bottom:12px;">🔊 Play Again</button>
      <input type="text" id="listeningInput" placeholder="Type English" style="font-size:1.1em;padding:8px 12px;border-radius:8px;border:1.5px solid #f59e0b;outline:none;width:120px;">
      <span id="listening-feedback" style="margin-left:12px;font-size:1em;"></span>
      <div id="listening-score" style="margin-top:18px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">Score: 0</div>
    </div>`;

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

  function playCurrentWord() {
    const word = shuffled[listeningIdx].eng;
    playTTS(preprocessTTS(word));
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
      input.disabled = true;
      listeningScore += points;
      document.getElementById('listening-score').textContent = `Score: ${listeningScore}`;
      setTimeout(() => {
        listeningIdx++;
        if (listeningIdx < shuffled.length) {
          feedback.textContent = '';
          input.value = '';
          input.disabled = false;
          playCurrentWord();
          input.focus();
        } else {
          playSFX('end');
          gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
              <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Listening Game Over!</h2>
              <div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style="color:#19777e;font-weight:700;">${listeningScore} / ${shuffled.length*2}</span></div>
              <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
            </div>`;
          document.getElementById('playAgainBtn').onclick = () => startGame('listening');
        }
      }, 900);
    }
  });
}
