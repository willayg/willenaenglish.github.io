import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';
import { ensureImageStyles } from '../ui/image_styles.js';

// Local emoji mapping cache for picture-capable rounds
let emojiMap = {};
function isEmojiSupported(emoji) {
  if (!emoji) return false;
  const span = document.createElement('span');
  span.textContent = emoji;
  span.style.visibility = 'hidden';
  span.style.fontSize = '32px';
  document.body.appendChild(span);
  const width = span.offsetWidth;
  document.body.removeChild(span);
  return width > 10;
}
async function loadEmojiMappings() {
  if (Object.keys(emojiMap).length > 0) return emojiMap;
  try {
    const res = await fetch('./emoji-list/emoji-mappings.json');
    const mappings = await res.json();
    for (const category of Object.values(mappings)) Object.assign(emojiMap, category);
  } catch (e) {
    // Fallback minimal set
    emojiMap = {
      dog: '🐶', cat: '🐱', rabbit: '🐰', horse: '🐴', cow: '🐮', pig: '🐷',
      car: '🚗', bus: '🚌', train: '🚆', plane: '✈️', house: '🏠', school: '🏫',
      apple: '🍎', banana: '🍌', orange: '🍊', sun: '☀️', moon: '🌙', star: '⭐'
    };
  }
  return emojiMap;
}

// Multiple Choice (Mixed): randomly alternates between Kor→Eng and Eng→Kor each round
export async function runMultiChoiceMode({ wordList, gameArea, startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  let score = 0;
  let idx = 0;
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'multi_choice', wordList, listName });

  // Determine if we can support picture-based questions
  const isSampleList = listName && listName.includes('.json');
  await loadEmojiMappings();
  const isPicturable = (w) => {
    if (!w || !w.eng) return false;
    // Check if word has emoji field (phonics)
    if (w.emoji && isEmojiSupported(w.emoji)) return true;
    if (isSampleList) {
      const emoji = emojiMap[String(w.eng).toLowerCase()];
      return emoji && isEmojiSupported(emoji);
    }
    if (w.img && String(w.img).trim() && String(w.img).toLowerCase() !== 'null' && String(w.img).toLowerCase() !== 'undefined') return true;
    const emoji = emojiMap[String(w.eng).toLowerCase()];
    return emoji && isEmojiSupported(emoji);
  };
  const picturable = shuffled.filter(isPicturable);
  const hasPicturable = picturable.length >= 4;

  const getTileHtml = (w) => {
    // Check word's own emoji field first (phonics lists)
    if (w.emoji && isEmojiSupported(w.emoji)) {
      return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:clamp(2.5rem,8vw,3.8rem);line-height:1;\">${w.emoji}</div>`;
    }
    if (isSampleList) {
      const emoji = emojiMap[String(w.eng).toLowerCase()];
      if (emoji && isEmojiSupported(emoji)) {
        return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:clamp(2.5rem,8vw,3.8rem);line-height:1;\">${emoji}</div>`;
      }
      const fallbackLabel = w.kor || w.eng || '?';
      return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:clamp(1rem,2.8vw,1.3rem);line-height:1.15;font-weight:600;padding:4px;\">${fallbackLabel}</div>`;
    }
    const hasImg = w.img && String(w.img).trim() && String(w.img).toLowerCase() !== 'null' && String(w.img).toLowerCase() !== 'undefined';
    if (hasImg) {
      const safe = String(w.img).trim();
  ensureImageStyles();
  return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;\"><div class=\"wa-img-box wa-4x3 rounded shadow\" style=\"max-width:90%;max-height:90%;\"><img src='${safe}' alt='${w.eng}' style=\"max-width:100%;max-height:100%;object-fit:cover;\" onerror=\"this.onerror=null;this.parentElement.style.display='none';this.parentElement.nextElementSibling.style.display='flex';\"></div><div style=\"display:none;font-size:clamp(.9rem,2.6vw,1.2rem);line-height:1.15;font-weight:600;padding:4px;align-items:center;justify-content:center;text-align:center;\">${w.kor || w.eng || '?'}</div></div>`;
    }
    const emoji = emojiMap[String(w.eng).toLowerCase()];
    if (emoji && isEmojiSupported(emoji)) {
      return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:clamp(2.5rem,8vw,3.8rem);line-height:1;\">${emoji}</div>`;
    }
    return `<div style=\"display:flex;align-items:center;justify-content:center;width:100%;height:100%;font-size:clamp(1rem,2.8vw,1.3rem);line-height:1.15;font-weight:600;padding:4px;\">${w.kor || w.eng || '?'}</div>`;
  };

  const getPromptTileHtml = (w) => {
    // For a single prompt image/emoji (larger)
    // Check word's own emoji field first (phonics lists)
    if (w.emoji && isEmojiSupported(w.emoji)) {
      return `<div style=\"font-size:4rem;line-height:1;\">${w.emoji}</div>`;
    }
    if (isSampleList) {
      const emoji = emojiMap[String(w.eng).toLowerCase()];
      if (emoji && isEmojiSupported(emoji)) {
        return `<div style=\"font-size:4rem;line-height:1;\">${emoji}</div>`;
      }
      return `<div style=\"font-size:clamp(1.1rem,3.2vw,1.5rem);line-height:1.25;font-weight:700;padding:6px;\">${w.kor || w.eng || '?'} </div>`;
    }
    const hasImg = w.img && String(w.img).trim() && String(w.img).toLowerCase() !== 'null' && String(w.img).toLowerCase() !== 'undefined';
    if (hasImg) {
      const safe = String(w.img).trim();
  ensureImageStyles();
  return `<div class=\"wa-img-box wa-4x3 rounded shadow\" style=\"max-width:64vw;display:flex;align-items:center;justify-content:center;\"><img src='${safe}' alt='${w.eng}' onerror=\"this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='flex';\" style=\"max-width:100%;max-height:100%;object-fit:cover;\"><div style=\"display:none;font-size:clamp(1.1rem,3.2vw,1.5rem);line-height:1.25;font-weight:700;padding:6px;text-align:center;\">${w.kor || w.eng || '?'}</div></div>`;
    }
    const emoji = emojiMap[String(w.eng).toLowerCase()];
    if (emoji && isEmojiSupported(emoji)) {
      return `<div style=\"font-size:4rem;line-height:1;\">${emoji}</div>`;
    }
    return `<div style=\"font-size:clamp(1.1rem,3.2vw,1.5rem);line-height:1.25;font-weight:700;padding:6px;\">${w.kor || w.eng || '?'} </div>`;
  };

  // Intro splash
  gameArea.innerHTML = `
    <div id="multiMixedIntro" style="display:flex;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.2rem,5vw,3.5rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;">
        Reading
        <div style="font-size:clamp(0.9rem,3.5vw,1.4rem);font-weight:600;color:#248b86ff;margin-top:8px;">
          Pictures and words — mixed questions
        </div>
      </div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('multiMixedIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => {
      showGameProgress(shuffled.length, 0);
      renderQuestion();
    }, 650);
  }, 1000);

  function renderQuestion() {
  // One-answer-per-question lockout
  let questionLocked = false;
    if (idx >= shuffled.length) {
      playSFX('end');
  endSession(sessionId, { mode: 'multi_choice', summary: { score, total: shuffled.length, completed: true }, listName, wordList: shuffled });
      hideGameProgress();
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;">
        <h2 style="color:#41b6beff;">Game Complete!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.3em;margin-bottom:12px;\">Score: <span style=\"color:#19777e;font-weight:700;\">${score} / ${shuffled.length}</span></div>`}
        <button id="playAgainMultiMixed" style="display:none;font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
  ${document.getElementById('gameStage') ? '' : `<button id=\"tryMoreMultiMixed\" style=\"font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Return</button>`}
      </div>`;
      document.getElementById('playAgainMultiMixed').onclick = () => startGame('multi_choice');
      const tryMoreMulti = document.getElementById('tryMoreMultiMixed');
      if (tryMoreMulti) {
        tryMoreMulti.onclick = () => {
          const quitBtn = document.getElementById('wa-quit-btn');
          if (quitBtn) quitBtn.style.display = 'none';
          if (window.WordArcade?.startModeSelector) {
            window.WordArcade.startModeSelector();
          } else {
            startGame('multi_choice', { shuffle: true });
          }
        };
      }
      return;
    }

    const current = shuffled[idx];
    // Define preferred rotation of question types
    const typeOrder = hasPicturable
      ? ['eng_to_pic', 'eng_to_kor', 'pic_to_eng', 'kor_to_eng']
      : ['eng_to_kor', 'kor_to_eng'];
    let qType = typeOrder[idx % typeOrder.length];

    // Helper to safely build a set of N distinct items from a pool
    const pickN = (pool, n, exclude = new Set()) => {
      const out = [];
      const candidates = pool.filter(x => !exclude.has(x));
      const arr = [...candidates];
      while (out.length < n && arr.length) {
        const i = Math.floor(Math.random() * arr.length);
        out.push(arr.splice(i, 1)[0]);
      }
      return out;
    };

    // If picture types are chosen but not feasible, fallback to a text type
    const ensureFeasibleType = () => {
      if (!hasPicturable && (qType === 'eng_to_pic' || qType === 'pic_to_eng')) qType = 'eng_to_kor';
      if (hasPicturable && (qType === 'eng_to_pic')) {
        // Need 3 other picturable besides current
        if (!isPicturable(current) || picturable.filter(w => w !== current).length < 3) qType = 'eng_to_kor';
      }
      if (hasPicturable && (qType === 'pic_to_eng')) {
        if (!isPicturable(current)) qType = 'kor_to_eng';
      }
    };
    ensureFeasibleType();

    // Render per qType
    if (qType === 'eng_to_pic') {
      // Prompt: English word; Choices: 4 picture tiles
      const distractors = pickN(picturable.filter(w => w !== current), 3);
      const choices = [current, ...distractors].sort(() => Math.random() - 0.5);
      gameArea.innerHTML = `
        <div style="padding:16px 12px 6px;text-align:center;">
          <div style="font-size:clamp(0.95em,2.6vw,1.1em);color:#555;margin-bottom:6px;">Pick the picture</div>
          <div style="font-size:clamp(1.3em,3vw,2.2em);font-weight:700;color:#19777e;margin-bottom:12px;">${current.eng}</div>
          <div id="multiChoicesMixed" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(120px, 1fr));gap:12px;max-width:100%;margin:0 auto 10px auto;padding:0 4px;">
            ${choices.map(ch => `
              <button class="choice-btn multi-pic-btn" data-eng="${ch.eng}" ${ch.eng === current.eng ? 'data-correct="1"' : ''} style="aspect-ratio:1;min-height:120px;padding:8px;display:flex;align-items:center;justify-content:center;border:2px solid #e15b96;border-radius:18px;background:#fff;transition:all 0.2s ease;">
                ${getTileHtml(ch)}
              </button>
            `).join('')}
          </div>
          <div id="multiFeedbackMixed" style="margin-top:8px;font-size:1.05em;height:24px;color:#555;"></div>
          <div id="multiScoreMixed" style="margin-top:6px;text-align:center;font-size:1.1em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
        </div>`;

  setupChoiceButtons(gameArea, { minAnswerLatencyMs: 120 });
      document.querySelectorAll('#multiChoicesMixed .multi-pic-btn').forEach(btn => {
        btn.onclick = () => {
          if (questionLocked) return;
          questionLocked = true;
          const selected = btn.getAttribute('data-eng');
          const correct = selected === current.eng;
          splashResult(btn, correct);
          const feedback = document.getElementById('multiFeedbackMixed');
          if (correct) { score++; playSFX('correct'); if (feedback) { feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; } }
          else { playSFX('wrong'); if (feedback) { feedback.textContent = `It was: ${current.eng}`; feedback.style.color = '#e53e3e'; } }
          // Disable all buttons to prevent rapid multiple taps
          document.querySelectorAll('#multiChoicesMixed button').forEach(b => b.disabled = true);
          logAttempt({
            session_id: sessionId,
            mode: 'multi_choice',
            word: current.eng,
            is_correct: correct,
            answer: selected,
            correct_answer: current.eng,
            // scoreless build: no points
            attempt_index: idx + 1,
            extra: { direction: 'eng_to_pic', eng: current.eng, kor: current.kor }
          });
          setTimeout(() => { idx++; updateGameProgress(idx, shuffled.length); renderQuestion(); }, 900);
        };
      });
      return;
    }

    if (qType === 'pic_to_eng') {
      // Prompt: single picture; Choices: 4 English words
      const pool = shuffled.filter(w => w.eng !== current.eng).map(w => w.eng);
      const choices = [current.eng, ...pickN(pool, 3)].sort(() => Math.random() - 0.5);
      gameArea.innerHTML = `
        <div style="padding:24px;text-align:center;max-width:720px;margin:0 auto;">
          <div style="font-size:clamp(0.95em,2.6vw,1.1em);color:#555;margin-bottom:6px;">Pick the English</div>
          <div style="margin:8px 0 14px 0;display:flex;justify-content:center;">${getPromptTileHtml(current)}</div>
          <div id="multiChoicesMixed" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:min(90vw, 520px);margin:0 auto 12px auto;justify-content:center;">
            ${choices.map(txt => `
              <button class="multi-choice-btn choice-btn" data-eng="${String(txt).replaceAll('"','&quot;')}" ${txt === current.eng ? 'data-correct="1"' : ''} style="font-size:clamp(1.0625rem,2.75vw,1.3125rem);font-weight:600;color:#e15b96;border:2px solid #e15b96;background:#fff;border-radius:18px;padding:16px 20px;transition:all 0.2s ease;">${txt}</button>
            `).join('')}
          </div>
          <div id="multiFeedbackMixed" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
          <div id="multiScoreMixed" style="margin-top:6px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
        </div>`;

      document.querySelectorAll('#multiChoicesMixed .choice-btn').forEach(btn => { btn.style.height = '12vh'; });
  setupChoiceButtons(gameArea, { minAnswerLatencyMs: 120 });
      document.querySelectorAll('#multiChoicesMixed .multi-choice-btn').forEach(btn => {
        btn.onclick = () => {
          if (questionLocked) return;
          questionLocked = true;
          const selected = btn.getAttribute('data-eng');
          const correct = selected === current.eng;
          splashResult(btn, correct);
          const feedback = document.getElementById('multiFeedbackMixed');
          if (correct) { score++; playSFX('correct'); if (feedback) { feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; } }
          else { playSFX('wrong'); if (feedback) { feedback.textContent = `It was: ${current.eng}`; feedback.style.color = '#e53e3e'; } }
          // Disable all buttons to prevent rapid multiple taps
          document.querySelectorAll('#multiChoicesMixed button').forEach(b => b.disabled = true);
          logAttempt({
            session_id: sessionId,
            mode: 'multi_choice',
            word: current.eng,
            is_correct: correct,
            answer: selected,
            correct_answer: current.eng,
            // scoreless build: no points
            attempt_index: idx + 1,
            extra: { direction: 'pic_to_eng', eng: current.eng, kor: current.kor }
          });
          setTimeout(() => { idx++; updateGameProgress(idx, shuffled.length); renderQuestion(); }, 900);
        };
      });
      return;
    }

    // Text-based rounds
    const korToEng = (qType === 'kor_to_eng') || (qType === 'eng_to_kor' ? false : Math.random() < 0.5);
    let prompt, correctText, optionPool, dataAttr;
    if (korToEng) {
      prompt = current.kor;
      correctText = current.eng;
      optionPool = shuffled.filter(w => w.eng !== current.eng).map(w => w.eng);
      dataAttr = 'eng';
    } else {
      prompt = current.eng;
      correctText = current.kor;
      optionPool = shuffled.filter(w => w.kor !== current.kor).map(w => w.kor);
      dataAttr = 'kor';
    }
    const choices = [correctText];
    const poolCopy = [...optionPool];
    while (choices.length < 4 && poolCopy.length) {
      const pick = poolCopy.splice(Math.floor(Math.random() * poolCopy.length), 1)[0];
      choices.push(pick);
    }
    choices.sort(() => Math.random() - 0.5);

    gameArea.innerHTML = `<div style="padding:24px;text-align:center;max-width:520px;margin:0 auto;">
      <div style="font-size:clamp(0.95em,2.6vw,1.1em);color:#555;margin-bottom:6px;">${korToEng ? 'Pick the English' : 'Pick the Korean'}</div>
      <div style="font-size:clamp(1.3em,3vw,2.2em);font-weight:700;color:#19777e;margin-bottom:18px;">${prompt}</div>
      <div id="multiChoicesMixed" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:min(90vw, 480px);margin:0 auto 18px auto;justify-content:center;">
        ${choices.map(txt => `
          <button class="multi-choice-btn choice-btn" data-${dataAttr}="${txt.replaceAll('"','&quot;')}" ${txt === correctText ? 'data-correct="1"' : ''} style="font-size:clamp(1.0625rem,2.75vw,1.3125rem);font-weight:600;color:#e15b96;border:2px solid #e15b96;background:#fff;border-radius:18px;padding:16px 20px;transition:all 0.2s ease;">
            ${txt}
          </button>
        `).join('')}
      </div>
      <div id="multiFeedbackMixed" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
      <div id="multiScoreMixed" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
    </div>`;

    document.querySelectorAll('#multiChoicesMixed .choice-btn').forEach(btn => { btn.style.height = '12vh'; });
  setupChoiceButtons(gameArea, { minAnswerLatencyMs: 120 });
    document.querySelectorAll('#multiChoicesMixed .multi-choice-btn').forEach(btn => {
      btn.onclick = () => {
        if (questionLocked) return;
        questionLocked = true;
        const feedback = document.getElementById('multiFeedbackMixed');
        const selected = btn.getAttribute(`data-${dataAttr}`);
        const correct = selected === correctText;
        splashResult(btn, correct);
        if (correct) {
          score++;
          if (feedback) { feedback.textContent = 'Correct!'; feedback.style.color = '#19777e'; }
          playSFX('correct');
        } else {
          if (feedback) { feedback.textContent = 'Incorrect!'; feedback.style.color = '#e53e3e'; }
          playSFX('wrong');
        }
        // Disable all buttons to prevent rapid multiple taps
        document.querySelectorAll('#multiChoicesMixed button').forEach(b => b.disabled = true);
        const wordLogged = korToEng ? current.kor : current.eng;
        const correctAns = korToEng ? current.eng : current.kor;
        logAttempt({
          session_id: sessionId,
          mode: 'multi_choice',
          word: wordLogged,
          is_correct: correct,
          answer: selected,
          correct_answer: correctAns,
          // scoreless build: no points
          attempt_index: idx + 1,
          extra: { direction: korToEng ? 'kor_to_eng' : 'eng_to_kor', eng: current.eng, kor: current.kor }
        });
        setTimeout(() => { idx++; updateGameProgress(idx, shuffled.length); renderQuestion(); }, 900);
      };
    });
  }
}
