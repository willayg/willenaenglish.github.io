import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

// Spelling mode (Tap-to-Spell with Korean prompt)
export function runSpellingMode({ wordList, gameArea, listName = null }) {
  // Defensive logging to help diagnose why the spelling UI might be blank
  console.log('runSpellingMode called', { wordCount: Array.isArray(wordList) ? wordList.length : 0, listName });
  // Ensure we have a valid gameArea element
  gameArea = gameArea || document.getElementById('gameArea');
  if (!gameArea) {
    console.error('runSpellingMode: no gameArea available');
    return;
  }
  // Validate list
  if (!Array.isArray(wordList) || wordList.length === 0) {
    gameArea.innerHTML = `<div style="padding:28px;text-align:center;color:#666;font-weight:600;">No words available for Spelling mode.<br>Please choose a lesson or load a word list first.</div>`;
    return;
  }

  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = 0;
  let idx = 0;
  const ordered = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'spelling', wordList, listName });

  // Intro splash
  gameArea.innerHTML = `
    <div id="spellingIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Spell the English word</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('spellingIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => {
      showGameProgress(ordered.length, 0);
      renderQuestion();
    }, 650);
  }, 1000);

  function makeLetterTilesFor(word) {
    const clean = String(word || '').trim().toLowerCase();
    const base = clean.split('');
    // Build distractors: choose 2 letters not in the word (avoid duplicates)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const inWordSet = new Set(base);
    const pool = alphabet.filter(ch => !inWordSet.has(ch));
    const distractorCount = 2;
    const distractors = [];
    while (distractors.length < distractorCount && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      distractors.push(pick);
    }
    // Create tile objects with ids, including duplicates from base letters
    const tiles = base.map((ch, i) => ({ id: 'b' + i, ch }));
    distractors.forEach((ch, i) => tiles.push({ id: 'd' + i, ch }));
    // Shuffle
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
  }

  function renderQuestion() {
    if (idx >= ordered.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'spelling', summary: { score, max: ordered.length * 2 } });
      hideGameProgress();
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Spelling Game Over!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.3em;margin-bottom:12px;\">Your Score: <span style=\"color:#19777e;font-weight:700;\">${score} / ${ordered.length*2}</span></div>`}
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

    const current = ordered[idx];
    const correct = String(current.eng || '').trim();
    const tiles = makeLetterTilesFor(correct.toLowerCase());
    const usedStack = []; // stack of tile ids used in order
    let locked = false;

    gameArea.innerHTML = `
      <div class="tap-spell" style="max-width:520px;margin:0 auto;">
        <div id="korPrompt" style="margin-bottom:12px;text-align:center;font-size:1.25em;color:#19777e;font-weight:800;">${current.kor || ''}</div>
        <div id="letterSlots" style="display:flex;justify-content:center;gap:8px;margin:8px 0 12px 0;">
          ${correct.split('').map(() => `<div class=\"slot\" style=\"width:38px;height:46px;border:2px solid #93cbcf;border-radius:10px;background:#f7fafc;display:flex;align-items:center;justify-content:center;font-size:1.3em;font-weight:800;color:#0f172a;\"></div>`).join('')}
        </div>
        <div id="letterTiles" style="display:flex;flex-wrap:wrap;gap:10px;max-width:420px;margin:0 auto;justify-content:center;align-items:center;">
          ${tiles.map(t => `<button class=\"choice-btn tile-btn\" data-id=\"${t.id}\" data-ch=\"${t.ch}\" style=\"width:56px;height:56px;border:2px solid #cfdbe2;border-radius:12px;background:#fff;font-size:1.2em;font-weight:800;color:#314249;display:flex;align-items:center;justify-content:center;\">${t.ch.toUpperCase()}</button>`).join('')}
        </div>
        <div id="spelling-feedback" style="min-height:26px;text-align:center;font-size:1.05em;color:#555;margin-top:10px;"></div>
        <div id="spelling-score" style="margin-top:6px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
      </div>
    `;

    const tileButtons = Array.from(document.querySelectorAll('.tile-btn'));
    const slotEls = Array.from(document.querySelectorAll('#letterSlots .slot'));
    const feedback = document.getElementById('spelling-feedback');

    function updateSlots() {
      const letters = usedStack.map(id => {
        const btn = document.querySelector(`.tile-btn[data-id="${id}"]`);
        return btn ? btn.getAttribute('data-ch') : '';
      });
      slotEls.forEach((el, i) => {
        el.textContent = letters[i] ? letters[i].toUpperCase() : '';
      });
    }

    function evaluateIfComplete() {
      if (usedStack.length !== correct.length || locked) return;
      locked = true;
      const answer = usedStack.map(id => {
        const b = document.querySelector(`.tile-btn[data-id="${id}"]`);
        return b ? b.getAttribute('data-ch') : '';
      }).join('');
      const correctLower = correct.toLowerCase();
      let basePoints = 0;
      if (answer === correctLower && correctLower.length > 0) {
        basePoints = 2; feedback.textContent = 'Perfect! +2'; feedback.style.color = '#19777e'; playSFX('correct');
      } else if (levenshtein(answer, correctLower) === 1) {
        basePoints = 1; feedback.textContent = 'Close! +1'; feedback.style.color = '#f59e0b'; playSFX('kindaRight');
      } else {
        basePoints = 0; feedback.textContent = 'Oops!'; feedback.style.color = '#e53e3e'; playSFX('wrong');
      }
      const points = basePoints > 0 ? (isReview ? 3 : basePoints) : 0;
      // Log attempt
      logAttempt({
        session_id: sessionId,
        mode: 'spelling',
        word: current.eng,
        is_correct: basePoints > 0,
        answer,
        correct_answer: correctLower,
        points,
        attempt_index: idx + 1
      });
      // UI update and next
      score += basePoints;
      const scoreEl = document.getElementById('spelling-score');
      if (scoreEl && !isReview) scoreEl.textContent = `Score: ${score}`;
      setTimeout(() => {
        idx++;
        updateGameProgress(idx, ordered.length);
        renderQuestion();
      }, 900);
    }

    function onTileClick(btn) {
      if (locked) return;
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (usedStack.length >= correct.length) return;
      usedStack.push(id);
      btn.disabled = true;
      btn.classList.add('selected');
      // Subtle animation then hide
      try {
        btn.style.transform = 'scale(0.92)';
        btn.style.opacity = '0';
        setTimeout(() => { btn.style.display = 'none'; }, 140);
      } catch { btn.style.display = 'none'; }
      updateSlots();
      evaluateIfComplete();
    }

    tileButtons.forEach(btn => btn.onclick = () => onTileClick(btn));

    // Tap slot to restore that letter's tile
    slotEls.forEach((slotEl, slotIndex) => {
      slotEl.style.cursor = 'pointer';
      slotEl.title = 'Tap to remove letter';
      slotEl.onclick = () => {
        if (locked) return;
        if (slotIndex >= usedStack.length) return; // empty slot
        const removedId = usedStack.splice(slotIndex, 1)[0];
        const btn = document.querySelector(`.tile-btn[data-id="${removedId}"]`);
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('selected');
          btn.style.display = '';
        }
        updateSlots();
      };
    });
  }

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
}
