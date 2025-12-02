// Grammar Choose Mode (Level 3)
// Lightweight, Level-3 scoped choose/selection mode for grammar items.
// Mirrors the style and API of the existing grammar choose mode but
// forces Level 3 behaviors and paths (keeps editing/maintenance simple).

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { renderGrammarSummary } from '../grammar_summary.js';

let state = null;
const MODE = 'grammar_choose';
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

export function initGrammarChooseL3() {
  // no-op for now; kept for parity with other modes
}

export async function startGrammarChooseL3({
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
    console.debug('[choose_l3] startSession failed', e?.message);
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

    const answers = makeChoices(item);
    const questionNumber = state.index + 1;
    const totalQuestions = state.list.length;
    const displayBase = escapeHtml(item.base || item.word || 'Base Verb');
    const displayEmoji = escapeHtml(item.emoji || '🟩');

    containerEl.innerHTML = `
      <div class="grammar-choose-l3" style="padding:24px 20px 18px;display:flex;flex-direction:column;min-height:100%;font-family:'Poppins',Arial,sans-serif;">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin-bottom:18px;text-align:center;">
          <div style="font-size:3rem;line-height:1;">${displayEmoji}</div>
          <div style="font-size:clamp(1.8rem, 6vw, 2.4rem);font-weight:800;letter-spacing:0.02em;color:#21b5c0;">${displayBase}</div>
          <div style="margin-top:6px;font-size:0.95rem;color:#21b5c0;">Pick the correct past-tense form.</div>
        </div>
        <div id="gch-choices" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:14px;margin-bottom:14px;justify-items:center;">
          ${answers.map((answer) => {
            const safeAnswer = escapeHtml(answer);
            return `<button data-answer="${safeAnswer}" class="grammar-choice-btn" style="flex:1;min-width:clamp(120px, 24vw, 170px);padding:clamp(12px,2.5vh,16px) clamp(16px,3vw,24px);font-size:clamp(1.1rem,3vw,1.5rem);font-weight:800;border-radius:22px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 10px rgba(0,0,0,0.08);text-transform:none;font-family:'Poppins',Arial,sans-serif;">${safeAnswer}</button>`;
          }).join('')}
        </div>
        <div id="gch-feedback" style="min-height:1.2em;font-weight:700;font-size:1rem;margin-bottom:12px;color:#2e7d32"></div>
        <div style="margin-top:auto;font-size:0.85rem;color:#888;text-align:center;font-family:'Poppins',Arial,sans-serif;">Question ${questionNumber} / ${totalQuestions}</div>
        <div style="display:flex;justify-content:center;margin-top:12px;">
          <button id="gch-quit" type="button" class="wa-quit-btn" style="border:none;background:transparent;cursor:pointer;display:flex;align-items:center;gap:8px;padding:4px;">
            <img src="./assets/Images/icons/quit-game.svg" alt="Quit game" aria-hidden="true" style="width:28px;height:28px;" />
          </button>
        </div>
      </div>`;

    const choicesEl = containerEl.querySelector('#gch-choices');
    choicesEl.querySelectorAll('button.grammar-choice-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosenText = btn.textContent.trim();
        markChoices(choicesEl, chosenText, item);
        disableChoices(choicesEl);
        handleChoice(chosenText, item, containerEl);
      });
    });

    const quitBtn = containerEl.querySelector('#gch-quit');
    if (quitBtn) {
      quitBtn.onclick = () => quitToMenu('quit');
    }
  }

  function makeChoices(item) {
    const correct = (item.past || item.base || item.word || item.en || '').trim();
    const poolSet = new Set();
    if (correct) poolSet.add(correct);
    if (Array.isArray(item.detractors)) {
      item.detractors.forEach((d) => { if (d && d.trim()) poolSet.add(d.trim()); });
    }
    const arr = Array.from(poolSet).filter(Boolean);
    // Ensure the correct answer is present
    if (correct && !arr.includes(correct)) arr.unshift(correct);
    // Guarantee at least 3 options
    while (arr.length < 3) arr.push(correct || arr[0] || '');
    const options = shuffle(arr);
    if (correct && !options.includes(correct)) {
      options[options.length - 1] = correct;
    }
    return options.slice(0, 4);
  }

  function handleChoice(chosen, item, containerEl) {
    const correct = item.past || item.word || item.en;
    const isCorrect = chosen === correct;
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
    const feedbackEl = containerEl.querySelector('#gch-feedback');
    if (feedbackEl) {
      feedbackEl.textContent = isCorrect ? 'Correct!' : `No — the right answer is ${correct}`;
      feedbackEl.style.color = isCorrect ? '#2e7d32' : '#f44336';
    }
    setTimeout(() => renderQuestion(containerEl), 700);
  }

  function markChoices(choicesEl, chosenText, item) {
    if (!choicesEl) return;
    const correct = item.past || item.word || item.en;
    choicesEl.querySelectorAll('button.grammar-choice-btn').forEach((btn) => {
      const text = (btn.textContent || '').trim();
      if (text === correct) {
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
    choicesEl.querySelectorAll('button.grammar-choice-btn').forEach((btn) => btn.disabled = true);
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
    // End session & show shared summary UI
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
}

export function stopGrammarChooseL3() {
  state = null;
}

function quitToMenu(reason = 'quit') {
  const current = state;
  if (!current) return;
  const { onQuit, onComplete, container } = current;
  if (container) {
    try { container.innerHTML = ''; } catch {}
  }
  // Partial endSession for quit (records progress so stars can update)
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
  stopGrammarChooseL3();
}

export default { init: initGrammarChooseL3, start: startGrammarChooseL3, stop: stopGrammarChooseL3 };
