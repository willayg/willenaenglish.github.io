import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

// Phonics: Missing Letter — hear the word, pick the missing letter
// Simple one-letter gap per word, 1 point per correct

// Fisher-Yates shuffle for randomizing word order
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function runMissingLetterMode({ wordList, gameArea, playTTS, /* preprocessTTS */ startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  if (!Array.isArray(wordList) || !wordList.length) {
    gameArea.innerHTML = '<div style="padding:28px;text-align:center;color:#666;font-weight:600;">No words available.</div>';
    return;
  }

  let score = 0;
  let idx = 0;
  const ordered = shuffle([...wordList].filter(w => w && w.eng && typeof w.eng === 'string'));
  const sessionId = startSession({ mode: 'missing_letter', wordList: ordered, listName });

  // Intro splash
  gameArea.innerHTML = `
    <div id="mlIntro" class="splash" style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:32vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.4rem,5.6vw,3.6rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">
        Find the missing letter
        <div style="font-size:clamp(.9rem,3vw,1.25rem);font-weight:600;color:#248b86ff;margin-top:8px;">Listen and choose the letter</div>
      </div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('mlIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { showGameProgress(ordered.length, 0); renderQuestion(); }, 650);
  }, 900);

  function renderQuestion() {
    if (idx >= ordered.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'missing_letter', summary: { score, total: ordered.length, completed: true }, listName, wordList: ordered });
      hideGameProgress();
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#41b6beff;font-size:2em;margin-bottom:18px;">Missing Letter Complete!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.25em;margin-bottom:12px;\">Score: <span style=\"color:#19777e;font-weight:700;\">${score} / ${ordered.length}</span></div>`}
        <button id="mlAgain" style="display:none;font-size:1.06em;padding:12px 26px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:800;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
        ${document.getElementById('gameStage') ? '' : `<button id=\"mlMenu\" style=\"font-size:1.0em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:800;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Return</button>`}
      </div>`;
      document.getElementById('mlAgain')?.addEventListener('click', () => startGame('missing_letter'));
      document.getElementById('mlMenu')?.addEventListener('click', () => {
        const quitBtn = document.getElementById('wa-quit-btn');
        if (quitBtn) quitBtn.style.display = 'none';
        if (window.WordArcade?.startModeSelector) window.WordArcade.startModeSelector();
        else startGame('missing_letter');
      });
      return;
    }

    const current = ordered[idx];
    const word = String(current.eng || '').toLowerCase().trim();

    // Determine list behavior
    const activeName = (listName || (window.WordArcade?.getListName?.() || '')) + '';
    const isConsonantBlend = /Blend/i.test(activeName);
    const isStartDigraphList = /(CH,?\s*SH|TH,?\s*WH)/i.test(activeName);
    const isEndingsList = /Endings/i.test(activeName);

    let firstPart, missing, masked;
    const startFocus = (isConsonantBlend || isStartDigraphList);

    if (startFocus) {
      // For starting blends/digraphs: hide first 2 or 3 letters
      const hideCount = (word.startsWith('thr')) ? 3 : 2;
      missing = word.slice(0, hideCount);
      firstPart = word.slice(hideCount);
      masked = '_'.repeat(hideCount) + firstPart;
    } else if (isEndingsList) {
      // For CK / NG / MP endings list: hide last 2 or 3 letters
      const hideCount = word.endsWith('ing') ? 3 : 2;
      firstPart = word.slice(0, word.length - hideCount);
      missing = word.slice(-hideCount);
      masked = firstPart + '_'.repeat(hideCount);
    } else {
      // Default (other lists): hide the last 2-3 letters based on word length
      const hideCount = Math.min(3, Math.max(2, Math.floor(word.length / 3)));
      firstPart = word.slice(0, word.length - hideCount);
      missing = word.slice(word.length - hideCount);
      masked = firstPart + '_'.repeat(hideCount);
    }

    // Build 3 distractor choices with better shuffling
    const allChoices = ordered
      .map(w => String(w.eng || '').toLowerCase().trim())
      .filter(w => w !== word);
    
    let distractors = [];
    
    if (startFocus) {
      // For starting blends/digraphs: collect first N letters from other words
      const n = missing.length;
      distractors = allChoices
        .map(w => w.slice(0, n))
        .filter((blend, idx, arr) => blend !== missing && blend.length === n && arr.indexOf(blend) === idx);
    } else {
      // For endings: collect last N letters from other words
      const n = missing.length;
      distractors = allChoices
        .map(w => w.slice(-n))
        .filter((ending, idx, arr) => ending !== missing && ending.length === n && arr.indexOf(ending) === idx);
    }

    // Fisher-Yates shuffle for better randomization
    function shuffle(arr) {
      const result = [...arr];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    }
    
    distractors = shuffle(distractors);

    // If we don't have enough distractors, generate plausible ones
    if (startFocus) {
      // Patterns for 2-letter and 3-letter starts
      const patterns2 = ['ch','sh','th','wh','bl','br','cl','cr','dr','fl','fr','gl','gr','pl','pr','sc','sk','sl','sm','sn','sp','st','sw','tr','tw'];
      const patterns3 = ['thr','shr','scr','spl','spr','str'];
      const pool = (missing.length === 3) ? patterns3 : patterns2;
      while (distractors.length < 3) {
        const cand = pool.find(p => p !== missing && !distractors.includes(p));
        if (cand) distractors.push(cand); else break;
      }
    } else {
      // Ending patterns – keep focused on target endings
      const pool = (missing.length === 3) ? ['ing'] : ['ck','ng','mp'];
      while (distractors.length < 3) {
        const cand = pool.find(p => p !== missing && !distractors.includes(p));
        if (cand) distractors.push(cand); else break;
      }
    }

    // Shuffle the final choices one more time for better randomization
    const choices = shuffle([missing, ...distractors.slice(0, 3)]);

    gameArea.innerHTML = `
      <div class="missing-letter" style="padding:24px 16px;text-align:center;max-width:640px;margin:0 auto;position:relative;">
        <div id="mlScore" style="${isReview ? 'display:none;' : ''}position:absolute;top:8px;left:50%;transform:translateX(-50%);padding:6px 12px;border-radius:999px;background:#e6f7f8;color:#0a6b70;font-weight:800;font-size:.95em;border:1px solid #bfe7ea;box-shadow:0 1px 3px rgba(0,0,0,.05);">Score: ${score}</div>
        <div style="height:50px;display:flex;align-items:center;justify-content:center;margin:28px 0 28px 0;"><div style="font-size:clamp(2.2em,7vw,3.4em);font-weight:900;color:#19777e;letter-spacing:.04em;">${masked}</div></div>
        <div style="display:flex;justify-content:center;align-items:center;margin:20px 0 32px 0;">
          <button id="mlPlay" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:56px;height:56px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.6em;">▶</button>
        </div>
        <div id="mlChoices" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));gap:16px;max-width:min(92vw, 560px);margin:0 auto 24px auto;justify-content:center;">
          ${choices.map(choice => `<button class=\"choice-btn ml-btn\" data-choice=\"${choice}\" ${choice===missing?'data-correct=\"1\"':''} style=\"height:100px;border-radius:14px;font-size:clamp(1.25em,3vw,1.6em);font-weight:800;background:#fff;border:3px solid #cfdbe2;\">${choice}</button>`).join('')}
        </div>
        <div id="mlFeedback" style="margin-top:16px;font-size:1.05em;height:24px;color:#555;"></div>
      </div>
    `;

    const playCurrent = () => { try { playTTS(current.eng); } catch {} };
    document.getElementById('mlPlay')?.addEventListener('click', playCurrent);
    // Auto play once
    playCurrent();

    let locked = false;
    const feedback = document.getElementById('mlFeedback');
    document.querySelectorAll('#mlChoices .ml-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        const pick = (btn.getAttribute('data-choice') || '').toLowerCase();
        const correct = pick === missing;
        // Splash feedback
        if (correct) { playSFX('correct'); if (feedback) { feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; } }
        else { playSFX('wrong'); if (feedback) { feedback.textContent = `It was: ${missing}`; feedback.style.color = '#e53e3e'; } }
        document.querySelectorAll('#mlChoices .ml-btn').forEach(b => b.disabled = true);
        
        // Show the complete word after answering
        const wordDisplay = document.querySelector('.missing-letter > div:nth-of-type(2)');
        if (wordDisplay) {
          wordDisplay.style.transition = 'all .3s ease';
          wordDisplay.textContent = word;
          wordDisplay.style.opacity = '1';
          wordDisplay.style.color = correct ? '#0badadff' : '#e53e3e';
          wordDisplay.style.fontSize = 'clamp(4em, 9vw, 7em)';
          wordDisplay.style.fontWeight = '900';
        }
        
        // Log attempt
        logAttempt({
          session_id: sessionId,
          mode: 'missing_letter',
          word: current.eng,
          is_correct: correct,
          answer: pick,
          correct_answer: missing,
          attempt_index: idx + 1,
          extra: { prompt: masked }
        });
        if (correct) score += 1;
        const sc = document.getElementById('mlScore');
        if (sc && !isReview) sc.textContent = `Score: ${score}`;
        setTimeout(() => { idx++; updateGameProgress(idx, ordered.length); renderQuestion(); }, 900);
      });
    });
  }
}
