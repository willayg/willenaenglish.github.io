import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

// Spelling mode
export function runSpellingMode({ wordList, gameArea, listName = null }) {
  // Defensive logging to help diagnose why the spelling UI might be blank
  console.log('runSpellingMode called', { wordCount: Array.isArray(wordList) ? wordList.length : 0, listName });
  // Ensure we have a valid gameArea element
  gameArea = gameArea || document.getElementById('gameArea');
  if (!gameArea) {
    console.error('runSpellingMode: no gameArea available');
    return;
  }
  // If the word list is empty or invalid, show a helpful message instead of failing silently
  if (!Array.isArray(wordList) || wordList.length === 0) {
    gameArea.innerHTML = `<div style="padding:28px;text-align:center;color:#666;font-weight:600;">No words available for Spelling mode.<br>Please choose a lesson or load a word list first.</div>`;
    return;
  }
  const ROUND_SIZE = 5;
  let spellingScore = 0;
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let round = 0;
  const completedIndices = [];
  // Create a shuffled order of indices so rounds follow a random sequence
  const order = wordList.map((_, i) => i).sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'spelling', wordList, listName });

  // Show intro phrase large, then fade out to reveal the game
  gameArea.innerHTML = `
    <div id="spellingIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Spell the English words!</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('spellingIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => {
      showGameProgress(wordList.length, 0);
      renderRound();
    }, 650);
  }, 1000);

  function levenshtein(a, b) {
    a = a || '';
    b = b || '';
    const dp = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }
  
  function renderRound() {
    const remainingIndices = order.filter(i => !completedIndices.includes(i));
    const roundIndices = remainingIndices.slice(0, ROUND_SIZE);
    if (roundIndices.length === 0) {
      playSFX('end');
      const maxPoints = wordList.length * 2; // 2 points per word (non-review baseline)
      endSession(sessionId, { mode: 'spelling', summary: { score: spellingScore, max: maxPoints, total: maxPoints, rounds: round } });
      hideGameProgress();
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Game Over!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.3em;margin-bottom:12px;\">Your Score: <span style=\"color:#19777e;font-weight:700;\">${spellingScore}</span></div>`}
        <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
        <button id="tryMoreSpelling" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;">Try More</button>
      </div>`;
      document.getElementById('playAgainBtn').onclick = () => runSpellingMode({ wordList, gameArea, listName });
      document.getElementById('tryMoreSpelling').onclick = () => {
        if (window.WordArcade?.startModeSelector) {
          window.WordArcade.startModeSelector();
        } else {
          runSpellingMode({ wordList: wordList.sort(() => Math.random() - 0.5), gameArea, listName });
        }
      };
      return;
    }

    const totalRounds = Math.ceil(wordList.length / ROUND_SIZE);
    gameArea.innerHTML = `
      <div id="spelling-score" style="margin-bottom:18px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${spellingScore}`}<br>Round ${round + 1} / ${totalRounds}</div>
      <div class="spelling-game">
        ${roundIndices.map((idx) => {
          const word = wordList[idx];
          return `
            <div class=\"spelling-card\" data-idx=\"${idx}\" style=\"display:flex;align-items:center;justify-content:space-between;margin:10px 0;padding:12px 18px;border-radius:14px;background:#f7fafc;box-shadow:0 2px 8px rgba(60,60,80,0.08);border:2px solid #93cbcf;max-width:340px;margin-left:auto;margin-right:auto;\">
              <span style=\"font-size:1.15em;color:#19777e;font-weight:700;\">${word.kor}</span>
              <input type=\"text\" class=\"spelling-input\" placeholder=\"Type English\" style=\"font-size:1.1em;padding:8px 12px;border-radius:8px;border:1.5px solid #f59e0b;outline:none;width:140px;\">
              <span class=\"spelling-feedback\" style=\"margin-left:12px;font-size:1em;min-width:80px;\"></span>
            </div>
          `;
        }).join('')}
      </div>
    `;

    const inputs = Array.from(document.querySelectorAll('.spelling-input'));
    inputs.forEach((input, localIdx) => {
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || input.disabled) return;
        const card = input.closest('.spelling-card');
        const feedback = card.querySelector('.spelling-feedback');
        const idx = parseInt(card.dataset.idx, 10);
        const correct = (wordList[idx].eng || '').trim().toLowerCase();
        const answer = input.value.trim().toLowerCase();

        // Base scoring: exact = 2, near (edit distance 1) = 1, else 0
  let basePoints = 0;
        if (answer === correct && correct.length > 0) {
          basePoints = 2;
          feedback.textContent = '+2';
          feedback.style.color = '#19777e';
          playSFX('correct');
        } else if (correct && levenshtein(answer, correct) === 1) {
          basePoints = 1;
          feedback.textContent = 'Close! +1';
          feedback.style.color = '#f59e0b';
          playSFX('kindaRight');
        } else {
          basePoints = 0;
          feedback.textContent = 'Oops!';
          feedback.style.color = '#e53e3e';
          playSFX('wrong');
        }
  // In review: any correct (near or exact) logs 3 points; wrong logs 0
  const points = basePoints > 0 ? (isReview ? 3 : basePoints) : 0;

        // Log attempt
        logAttempt({
          session_id: sessionId,
          mode: 'spelling',
          word: wordList[idx].eng,
          is_correct: basePoints > 0,
          answer,
          correct_answer: correct,
          points,
          attempt_index: completedIndices.length + 1,
          round: round + 1
        });

        input.disabled = true;
  // Keep UI score on non-review scale; review screen hides score text
  spellingScore += basePoints;
        completedIndices.push(idx);
        updateGameProgress(completedIndices.length, wordList.length);
        if (!isReview) {
          const scoreEl = document.getElementById('spelling-score');
          if (scoreEl) scoreEl.innerHTML = `Score: ${spellingScore}<br>Round ${round + 1} / ${totalRounds}`;
        }

        // Focus next input in this round
        const nextIdx = roundIndices[localIdx + 1];
        if (typeof nextIdx !== 'undefined') {
          const next = document.querySelector(`.spelling-card[data-idx="${nextIdx}"] .spelling-input`);
          if (next) next.focus();
        }

        // If all inputs in this round are disabled, go to next round
        const remainingEnabled = document.querySelectorAll('.spelling-input:not([disabled])').length;
        if (remainingEnabled === 0) {
          round++;
          setTimeout(renderRound, 600);
        }
      });
    });
  }
}
