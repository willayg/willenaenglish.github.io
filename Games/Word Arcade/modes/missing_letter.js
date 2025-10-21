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
        <button id="mlAgain" style="font-size:1.06em;padding:12px 26px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:800;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
        ${document.getElementById('gameStage') ? '' : `<button id=\"mlMenu\" style=\"font-size:1.0em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:800;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Try More</button>`}
      </div>`;
      document.getElementById('mlAgain')?.addEventListener('click', () => startGame('missing_letter'));
      document.getElementById('mlMenu')?.addEventListener('click', () => {
        if (window.WordArcade?.startModeSelector) window.WordArcade.startModeSelector();
        else startGame('missing_letter');
      });
      return;
    }

    const current = ordered[idx];
    const word = String(current.eng || '').toLowerCase().trim();
    
    // Detect if this is a consonant blend list (check if listName contains 'Blend')
    const isConsonantBlend = (listName && listName.includes('Blend')) || (window.WordArcade?.getListName?.() || '').includes('Blend');
    
    let firstPart, missing, masked;
    
    if (isConsonantBlend) {
      // For consonant blends: hide the first 2 letters (the blend itself)
      missing = word.slice(0, 2);
      firstPart = word.slice(2);
      masked = '__' + firstPart;
    } else {
      // For vowels: hide the last 2-3 letters (phonics focus on endings)
      const hideCount = Math.min(3, Math.max(2, Math.floor(word.length / 3))); // 2-3 letters depending on word length
      firstPart = word.slice(0, word.length - hideCount);
      missing = word.slice(word.length - hideCount);
      masked = firstPart + '_'.repeat(hideCount);
    }

    // Build 3 distractor choices with better shuffling
    const allChoices = ordered
      .map(w => String(w.eng || '').toLowerCase().trim())
      .filter(w => w !== word);
    
    let distractors = [];
    
    if (isConsonantBlend) {
      // For consonant blends: collect first 2 letters from other words
      distractors = allChoices
        .map(w => w.slice(0, 2))
        .filter((blend, idx, arr) => blend !== missing && blend.length === 2 && arr.indexOf(blend) === idx); // unique, correct length
    } else {
      // For vowels: collect the ending part from other words
      const hideCount = missing.length;
      distractors = allChoices
        .map(w => w.slice(-hideCount))
        .filter((ending, idx, arr) => ending !== missing && ending.length === hideCount && arr.indexOf(ending) === idx); // unique, correct length
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
    if (isConsonantBlend) {
      // Common consonant blend patterns
      const blendPatterns = ['bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'sc', 'sh', 'ch', 'th', 'wh'];
      while (distractors.length < 3) {
        const cand = blendPatterns.find(b => b !== missing && !distractors.includes(b));
        if (cand) distractors.push(cand);
        else break;
      }
    } else {
      // Common ending patterns for vowels
      const patterns = ['at', 'an', 'ap', 'ad', 'ag', 'am', 'as', 'ax', 'ab', 'et', 'en', 'ed', 'ig', 'it', 'in', 'og', 'ot', 'on', 'ug', 'ut', 'um'];
      while (distractors.length < 3) {
        const cand = patterns.find(p => p !== missing && !distractors.includes(p));
        if (cand) distractors.push(cand);
        else break;
      }
    }

    // Shuffle the final choices one more time for better randomization
    const choices = shuffle([missing, ...distractors.slice(0, 3)]);

    gameArea.innerHTML = `
      <div class="missing-letter" style="padding:24px 16px;text-align:center;max-width:640px;margin:0 auto;">
        <div style="font-size:clamp(0.95em,2.6vw,1.1em);color:#555;margin-bottom:16px;">${isConsonantBlend ? 'Find the starting blend' : 'Complete the ending'}</div>
        <div style="font-size:clamp(2.2em,7vw,3.4em);font-weight:900;color:#19777e;margin:20px 0 28px 0;letter-spacing:.04em;">${masked}</div>
        <div style="display:flex;justify-content:center;align-items:center;margin:20px 0 32px 0;">
          <button id="mlPlay" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:56px;height:56px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.6em;">▶</button>
        </div>
        <div id="mlChoices" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(100px, 1fr));gap:16px;max-width:min(92vw, 560px);margin:0 auto 24px auto;justify-content:center;">
          ${choices.map(choice => `<button class=\"choice-btn ml-btn\" data-choice=\"${choice}\" ${choice===missing?'data-correct=\"1\"':''} style=\"height:100px;border-radius:14px;font-size:clamp(1.25em,3vw,1.6em);font-weight:800;background:#fff;border:3px solid #cfdbe2;\">${choice}</button>`).join('')}
        </div>
        <div id="mlFeedback" style="margin-top:16px;font-size:1.05em;height:24px;color:#555;"></div>
        <div id="mlScore" style="margin-top:16px;text-align:center;font-size:1.15em;font-weight:800;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
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
          wordDisplay.style.color = '#0badadff';
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
