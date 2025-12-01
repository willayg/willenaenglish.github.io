// Level‑3 Fill‑The‑Gap (past‑tense focused)
// Lightweight fill-gap mode that blanks the past-tense verb and offers multiple-choice answers.

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { renderGrammarSummary } from '../grammar_summary.js';

let state = null;
const MODE = 'grammar_fill_gap';
const DEFAULT_FILE = 'data/grammar/level3/past_simple_irregular.json';

function shuffle(array) {
  const arr = Array.isArray(array) ? array.slice() : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadGrammarList(filePath) {
  // module is in: Games/english_arcade/modes/level_3_grammar/
  // need to resolve relative to Games/english_arcade/ -> go up two levels
  const base = new URL('../../', import.meta.url);
  const url = new URL(filePath, base);
  const response = await fetch(url.href, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${filePath}: ${response.status}`);
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function startGrammarFillGapL3({
  containerId = 'gameArea',
  grammarFile,
  grammarName,
  grammarConfig,
  onQuit,
  onComplete,
  playSFX,
} = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const resolvedSFX = typeof playSFX === 'function'
    ? playSFX
    : (window.WordArcade && typeof window.WordArcade.playSFX === 'function'
        ? (name) => window.WordArcade.playSFX(name)
        : null);

  state = {
    grammarFile: grammarFile || DEFAULT_FILE,
    grammarName,
    grammarConfig,
    score: 0,
    index: 0,
    container,
    onQuit,
    onComplete,
    playSFX: resolvedSFX,
    sessionId: null,
    list: [],
    currentAnswerToken: '',
  };

  try {
    const list = await loadGrammarList(state.grammarFile);
    state.list = Array.isArray(list) ? list.slice() : [];
  } catch (err) {
    console.error('Failed to load grammar list', err);
    state.list = [];
  }

  // Start session for stars/progress tracking
  try {
    state.sessionId = startSession({
      mode: MODE,
      listName: grammarName || null,
      wordList: state.list.map(it => it.word || it.id || it.base || it.past).filter(Boolean),
      meta: { category: 'grammar', grammarFile: state.grammarFile, grammarName: grammarName || null, level: 3 }
    });
  } catch (e) {
    console.debug('[fill_gap_l3] startSession failed', e?.message);
    state.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  if (!state.list.length) {
    container.innerHTML = '<div style="padding:20px">No Level 3 grammar content found.</div>';
    if (onComplete) onComplete(state);
    return;
  }

  state.list = shuffle(state.list);
  renderQuestion(container);

  function renderQuestion(containerEl) {
    const item = state.list[state.index];
    if (!item) {
      finish(containerEl);
      return;
    }

    const sentenceRaw = (item.exampleSentence || item.en || '').trim();
    const pastToken = (item.past || '').trim();
    const baseToken = (item.base || '').trim();
    let displaySentence = sentenceRaw;
    let blanked = false;
    let answerToken = '';

    if (pastToken && sentenceRaw && sentenceRaw.toLowerCase().includes(pastToken.toLowerCase())) {
      // Replace first occurrence of pastToken (case-insensitive) with blank
      const re = new RegExp(pastToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      displaySentence = sentenceRaw.replace(re, '_____');
      blanked = true;
      answerToken = pastToken;
    } else if (baseToken && sentenceRaw && sentenceRaw.toLowerCase().includes(baseToken.toLowerCase())) {
      const re = new RegExp(baseToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      displaySentence = sentenceRaw.replace(re, '_____');
      blanked = true;
      answerToken = baseToken;
    } else if (sentenceRaw) {
      // try to find a token that looks like a verb (last word before punctuation)
      const m = sentenceRaw.match(/([A-Za-z']+)[^A-Za-z']*$/);
      if (m && m[1]) {
        const last = m[1];
        const re = new RegExp(last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
        displaySentence = sentenceRaw.replace(re, '_____');
        blanked = true;
        answerToken = last;
      }
    }

    // Fallback answer token if nothing blanked
    if (!answerToken) answerToken = pastToken || baseToken || '';
    state.currentAnswerToken = answerToken;

    const choices = makeChoices(item, answerToken);
    const questionNumber = state.index + 1;
    const totalQuestions = state.list.length;

    containerEl.innerHTML = `
      <div class="grammar-fill-gap-l3" style="padding:22px 18px 18px;display:flex;flex-direction:column;min-height:100%;font-family:'Poppins',Arial,sans-serif;">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;text-align:center;">
          <div style="font-size:1.05rem;font-weight:700;color:#21b5c0;">${escapeHtml(item.exampleSentenceKo || item.ko || '')}</div>
        </div>
        <div style="font-size:1.4rem;font-weight:700;text-align:center;padding:18px;border-radius:12px;border:2px solid #f0f0f0;background:#fff;margin-bottom:14px;color:#666;">${escapeHtml(displaySentence || '_____')}</div>
        <div id="gfg-choices" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:12px;justify-items:center;">
          ${choices.map((c) => `<button data-answer="${escapeHtml(c)}" class="gfg-choice-btn" style="flex:1;min-width:clamp(120px,22vw,160px);padding:12px 18px;font-size:1.15rem;font-weight:800;border-radius:20px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,0.06);">${escapeHtml(c)}</button>`).join('')}
        </div>
        <div id="gfg-feedback" style="min-height:1.2em;font-weight:700;font-size:1rem;margin-bottom:12px;color:#2e7d32;text-align:center"></div>
        <div style="margin-top:auto;font-size:0.85rem;color:#888;text-align:center;">Question ${questionNumber} / ${totalQuestions}</div>
        <div style="display:flex;justify-content:center;margin-top:12px;"><button id="gfg-quit" type="button" style="border:none;background:transparent;cursor:pointer;display:flex;align-items:center;gap:8px;padding:4px;"><img src="./assets/Images/icons/quit-game.svg" alt="Quit" style="width:28px;height:28px;"/></button></div>
      </div>`;

    const choicesEl = containerEl.querySelector('#gfg-choices');
    choicesEl.querySelectorAll('button.gfg-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenText = btn.textContent.trim();
        markChoices(choicesEl, chosenText, item);
        disableChoices(choicesEl);
        handleChoice(chosenText, item, containerEl);
      });
    });

    const quitBtn = containerEl.querySelector('#gfg-quit');
    if (quitBtn) quitBtn.onclick = () => quitToMenu('quit');
  }

  function makeChoices(item, answerToken) {
    const correct = (answerToken || item.past || item.base || item.word || item.en || '').trim();
    const pool = new Set();
    if (correct) pool.add(correct);
    // Add other verbs from the grammar list (excluding the current item)
    for (const other of state.list) {
      if (!other || other === item) continue;
      const cand = (other.past || other.base || other.word || other.en || '').trim();
      if (cand) pool.add(cand);
      if (pool.size >= 6) break;
    }
    const arr = Array.from(pool).filter(Boolean);
    // Ensure correct present
    if (correct && !arr.includes(correct)) arr.unshift(correct);
    while (arr.length < 3) arr.push(correct || arr[0] || '');
    const options = shuffle(arr);
    // Guarantee inclusion inside the first 4 returned
    let firstFour = options.slice(0, 4);
    if (correct && !firstFour.includes(correct)) {
      // Replace a random index in firstFour with correct to preserve variety
      const replaceIdx = Math.floor(Math.random() * firstFour.length);
      firstFour[replaceIdx] = correct;
    }
    return shuffle(firstFour);
  }

  function handleChoice(chosen, item, containerEl) {
    const correct = (state.currentAnswerToken || item.past || '').trim();
    const isCorrect = chosen.trim().toLowerCase() === correct.trim().toLowerCase();
    if (isCorrect) state.score += 1;
    // Log attempt
    try {
      logAttempt({
        session_id: state.sessionId,
        mode: MODE,
        word: item.word || item.id || item.base || item.past || 'unknown',
        is_correct: isCorrect,
        answer: chosen,
        correct_answer: correct,
        points: isCorrect ? 1 : 0,
        attempt_index: state.index,
        round: state.index + 1,
        extra: { category: 'grammar', grammarFile: state.grammarFile, level: 3 }
      });
    } catch {}
    state.index += 1;
    playFeedbackSFX(isCorrect);
    const feedbackEl = containerEl.querySelector('#gfg-feedback');
    if (feedbackEl) {
      feedbackEl.textContent = isCorrect ? 'Correct!' : `No — the right answer is ${correct}`;
      feedbackEl.style.color = isCorrect ? '#2e7d32' : '#f44336';
    }
    setTimeout(() => renderQuestion(containerEl), 700);
  }

  function markChoices(choicesEl, chosenText, item) {
    if (!choicesEl) return;
    const correct = (state.currentAnswerToken || item.past || '').trim();
    choicesEl.querySelectorAll('button.gfg-choice-btn').forEach((btn) => {
      const text = (btn.textContent || '').trim();
      if (text.trim().toLowerCase() === correct.trim().toLowerCase()) {
        btn.style.background = '#2e7d32';
        btn.style.color = '#fff';
        btn.style.border = '3px solid #2e7d32';
      } else if (text === chosenText) {
        btn.style.background = '#f44336';
        btn.style.color = '#fff';
        btn.style.border = '3px solid #f44336';
      } else {
        btn.style.opacity = '0.7';
      }
    });
  }

  function disableChoices(choicesEl) {
    if (!choicesEl) return;
    choicesEl.querySelectorAll('button.gfg-choice-btn').forEach((btn) => btn.disabled = true);
  }

  function playFeedbackSFX(isCorrect) {
    const fx = state?.playSFX;
    if (typeof fx === 'function') {
      try { fx(isCorrect ? 'correct' : 'wrong'); } catch (err) { console.debug('SFX failed', err); }
    } else if (window.WordArcade && typeof window.WordArcade.playSFX === 'function') {
      try { window.WordArcade.playSFX(isCorrect ? 'correct' : 'wrong'); } catch {}
    }
  }

  function finish(containerEl) {
    try {
      endSession(state.sessionId, {
        mode: MODE,
        summary: { score: state.score, total: state.list.length, correct: state.score, points: state.score, category: 'grammar', grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 },
        listName: state.grammarName || null,
        wordList: state.list.map(it => it.word || it.id || it.base || it.past).filter(Boolean),
        meta: { category: 'grammar', grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 }
      });
    } catch {}
    renderGrammarSummary({ gameArea: containerEl, score: state.score, total: state.list.length, ctx: { grammarFile: state.grammarFile, grammarName } });
    if (onComplete) onComplete(state);
  }

  function quitToMenu(reason = 'quit') {
    const current = state;
    if (!current) return;
    const { onQuit, onComplete, container } = current;
    if (container) {
      try { container.innerHTML = ''; } catch {}
    }
    if (current.sessionId) {
      try {
        endSession(current.sessionId, {
          mode: MODE,
          summary: { score: current.score, total: current.list.length, correct: current.score, points: current.score, category: 'grammar', grammarFile: current.grammarFile, grammarName: current.grammarName, level: 3 },
          listName: current.grammarName || null,
          wordList: current.list.map(it => it.word || it.id || it.base || it.past).filter(Boolean),
          meta: { category: 'grammar', grammarFile: current.grammarFile, grammarName: current.grammarName, level: 3, quit_reason: reason }
        });
      } catch {}
    }
    if (typeof onComplete === 'function') {
      try { onComplete({ reason, state: current }); } catch (err) { console.error('onComplete failed', err); }
    }
    if (typeof onQuit === 'function') {
      try { onQuit({ reason }); } catch (err) { console.error('onQuit failed', err); }
    } else {
      try {
        if (window.WordArcade?.startGrammarModeSelector) {
          window.WordArcade.startGrammarModeSelector();
        } else if (window.WordArcade?.showGrammarLevelsMenu) {
          window.WordArcade.showGrammarLevelsMenu();
        } else if (window.WordArcade?.quitToOpening) {
          window.WordArcade.quitToOpening(true);
        } else if (window.history?.length > 1) {
          window.history.back();
        } else {
          location.reload();
        }
      } catch {}
    }
    stopGrammarFillGapL3();
  }

  // expose stop via closure (not exported) but provide external stop fn below
}

export function stopGrammarFillGapL3() {
  state = null;
}

export default { start: startGrammarFillGapL3, stop: stopGrammarFillGapL3 };
