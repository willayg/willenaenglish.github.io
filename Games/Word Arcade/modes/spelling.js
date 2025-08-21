import { playSFX } from '../sfx.js';

// Spelling mode
export function runSpellingMode({ wordList, gameArea }) {
  const ROUND_SIZE = 5;
  let spellingScore = 0;
  let round = 0;
  let completedIndices = [];

  function renderRound() {
    const remainingIndices = wordList.map((_, i) => i).filter(i => !completedIndices.includes(i));
    const roundIndices = remainingIndices.slice(0, ROUND_SIZE);
    if (roundIndices.length === 0) {
      playSFX('end');
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Game Over!</h2>
        <div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style="color:#19777e;font-weight:700;">${spellingScore}</span></div>
        <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
      </div>`;
      document.getElementById('playAgainBtn').onclick = () => runSpellingMode({ wordList, gameArea });
      return;
    }
    gameArea.innerHTML = `
      <div id="spelling-score" style="margin-bottom:18px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">Score: ${spellingScore}<br>Round ${round + 1} / ${Math.ceil(wordList.length / ROUND_SIZE)}</div>
      <div class="spelling-game">
        ${roundIndices.map((idx) => {
          const word = wordList[idx];
          return `
            <div class="spelling-card" data-idx="${idx}" style="display:flex;align-items:center;justify-content:space-between;margin:10px 0;padding:12px 18px;border-radius:14px;background:#f7fafc;box-shadow:0 2px 8px rgba(60,60,80,0.08);border:2px solid #93cbcf;max-width:340px;margin-left:auto;margin-right:auto;">
              <span style="font-size:1.15em;color:#19777e;font-weight:700;">${word.kor}</span>
              <input type="text" class="spelling-input" placeholder="Type English" style="font-size:1.1em;padding:8px 12px;border-radius:8px;border:1.5px solid #f59e0b;outline:none;width:120px;">
              <span class="spelling-feedback" style="margin-left:12px;font-size:1em;"></span>
            </div>
          `;
        }).join('')}
      </div>
    `;

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

    document.querySelectorAll('.spelling-input').forEach((input, i) => {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !input.disabled) {
          const card = input.closest('.spelling-card');
          const feedback = card.querySelector('.spelling-feedback');
          const idx = parseInt(card.dataset.idx);
          const answer = input.value.trim().toLowerCase();
          const correct = wordList[idx].eng.toLowerCase();
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
          spellingScore += points;
          completedIndices.push(idx);
          document.getElementById('spelling-score').innerHTML = `Score: ${spellingScore}<br>Round ${round + 1} / ${Math.ceil(wordList.length / ROUND_SIZE)}`;
          // Focus next input in this round
          const next = document.querySelector(`.spelling-card[data-idx="${roundIndices[i+1]}"] .spelling-input`);
          if (next) next.focus();
          // If all inputs in this round are disabled, go to next round
          if (document.querySelectorAll('.spelling-input:not([disabled])').length === 0) {
            round++;
            setTimeout(renderRound, 600);
          }
        }
      });
    });
  }

  renderRound();
}
