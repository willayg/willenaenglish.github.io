import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

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
  const isSampleList = listName && (listName.includes('.json') || listName.includes('Sample') || listName.includes('Mixed') || listName.includes('Easy') || listName.includes('Food') || listName.includes('Animals') || listName.includes('Transportation') || listName.includes('Jobs') || listName.includes('Sports') || listName.includes('School') || listName.includes('Hobbies') || listName.includes('Verbs') || listName.includes('Feelings') || listName.includes('Long U'));
  await loadEmojiMappings();
  const isPicturable = (w) => {
    if (!w || !w.eng) return false;
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
    if (isSampleList) {
      const emoji = emojiMap[String(w.eng).toLowerCase()] || '❓';
      return `<div style="font-size:3.2rem;line-height:1;">${emoji}</div>`;
    }
    const hasImg = w.img && String(w.img).trim() && String(w.img).toLowerCase() !== 'null' && String(w.img).toLowerCase() !== 'undefined';
    if (hasImg) {
      const safe = String(w.img).trim();
      return `<img src="${safe}" alt="${w.eng}" style="max-width:38vw;max-height:22vh;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.12);object-fit:contain;background:#fff;" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='block';"><div style="font-size:3.2rem;line-height:1;display:none;">❓</div>`;
    }
    const emoji = emojiMap[String(w.eng).toLowerCase()] || '❓';
    return `<div style="font-size:3.2rem;line-height:1;">${emoji}</div>`;
  };

  const getPromptTileHtml = (w) => {
    // For a single prompt image/emoji (larger)
    if (isSampleList) {
      const emoji = emojiMap[String(w.eng).toLowerCase()] || '❓';
      return `<div style="font-size:4rem;line-height:1;">${emoji}</div>`;
    }
    const hasImg = w.img && String(w.img).trim() && String(w.img).toLowerCase() !== 'null' && String(w.img).toLowerCase() !== 'undefined';
    if (hasImg) {
      const safe = String(w.img).trim();
      return `<img src="${safe}" alt="${w.eng}" style="max-width:64vw;max-height:28vh;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.12);object-fit:contain;background:#fff;" onerror="this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='block';"><div style="font-size:4rem;line-height:1;display:none;">❓</div>`;
    }
    const emoji = emojiMap[String(w.eng).toLowerCase()] || '❓';
    return `<div style="font-size:4rem;line-height:1;">${emoji}</div>`;
  };

  // Intro splash
  gameArea.innerHTML = `
    <div id="multiMixedIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.2rem,5vw,3.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">
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
      endSession(sessionId, { mode: 'multi_choice', summary: { score, total: shuffled.length } });
      hideGameProgress();
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;">
        <h2 style="color:#41b6beff;">Game Complete!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.3em;margin-bottom:12px;\">Score: <span style=\"color:#19777e;font-weight:700;\">${score} / ${shuffled.length}</span></div>`}
        <button id="playAgainMultiMixed" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
        <button id="tryMoreMultiMixed" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;">Try More</button>
      </div>`;
      document.getElementById('playAgainMultiMixed').onclick = () => startGame('multi_choice');
      document.getElementById('tryMoreMultiMixed').onclick = () => {
        if (window.WordArcade?.startModeSelector) {
          window.WordArcade.startModeSelector();
        } else {
          startGame('multi_choice', { shuffle: true });
        }
      };
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
        <div style="padding:16px 16px 6px;text-align:center;">
          <div style="font-size:clamp(0.95em,2.6vw,1.1em);color:#555;margin-bottom:6px;">Pick the picture</div>
          <div style="font-size:clamp(1.3em,3vw,2.2em);font-weight:700;color:#19777e;margin-bottom:12px;">${current.eng}</div>
          <div id="multiChoicesMixed" style="display:grid;grid-template-columns:repeat(2, minmax(42vw, 1fr));gap:14px;max-width:94vw;margin:0 auto 10px auto;">
            ${choices.map(ch => `
              <button class="choice-btn multi-pic-btn" data-eng="${ch.eng}" style="height:26vh;display:flex;align-items:center;justify-content:center;">
                ${getTileHtml(ch)}
              </button>
            `).join('')}
          </div>
          <div id="multiFeedbackMixed" style="margin-top:8px;font-size:1.05em;height:24px;color:#555;"></div>
          <div id="multiScoreMixed" style="margin-top:6px;text-align:center;font-size:1.1em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
        </div>`;

      setupChoiceButtons(gameArea);
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
          <div id="multiChoicesMixed" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:520px;margin:0 auto 12px auto;">
            ${choices.map(txt => `
              <button class="multi-choice-btn choice-btn" data-eng="${String(txt).replaceAll('"','&quot;')}">${txt}</button>
            `).join('')}
          </div>
          <div id="multiFeedbackMixed" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
          <div id="multiScoreMixed" style="margin-top:6px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
        </div>`;

      document.querySelectorAll('#multiChoicesMixed .choice-btn').forEach(btn => { btn.style.height = '15vh'; });
      setupChoiceButtons(gameArea);
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
      <div id="multiChoicesMixed" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:480px;margin:0 auto 18px auto;">
        ${choices.map(txt => `
          <button class="multi-choice-btn choice-btn" data-${dataAttr}="${txt.replaceAll('"','&quot;')}">
            ${txt}
          </button>
        `).join('')}
      </div>
      <div id="multiFeedbackMixed" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
      <div id="multiScoreMixed" style="margin-top:8px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
    </div>`;

    document.querySelectorAll('#multiChoicesMixed .choice-btn').forEach(btn => { btn.style.height = '15vh'; });
    setupChoiceButtons(gameArea);
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
