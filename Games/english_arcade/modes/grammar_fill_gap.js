// Grammar Fill-The-Gap Mode
// Presents the example sentence with the article removed so students type the missing word.
// Logs progress via records.js just like the other grammar games, and dispatches the
// wa:session-ended event so stars/upgrades refresh automatically.

import { startSession, logAttempt, endSession } from '../../../students/records.js';

let stylesInjected = false;
function ensureStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'grammar-fill-gap-styles';
  style.textContent = `
    .fg-root { display:flex; flex-direction:column; align-items:center; justify-content:flex-start; width:100%; gap:clamp(30px, 4vh, 44px); padding:clamp(32px, 6vh, 56px) clamp(18px, 8vw, 36px) clamp(40px, 8vh, 60px); font-family:'Poppins', Arial, sans-serif; background:#ffffff; box-sizing:border-box; min-height:calc(100vh - 220px); }
    .fg-content { width:100%; max-width:640px; display:flex; flex-direction:column; gap:clamp(30px, 5vh, 42px); position:relative; }
    .fg-counter { font-size:0.82rem; font-weight:700; color:#19777e; text-transform:uppercase; letter-spacing:0.08rem; }
    .fg-emoji { font-size:4rem; text-align:center; filter:drop-shadow(0 8px 24px rgba(0,0,0,0.08)); }
    .fg-word { text-align:center; font-size:clamp(2rem, 8vw, 3rem); font-weight:800; color:#21b3be; letter-spacing:0.04em; }
    .fg-sentence { font-size:1.15rem; line-height:1.55; color:#0f172a; background:#f2fbfc; border-radius:18px; padding:16px 18px; border:2px solid rgba(33,181,192,0.24); }
    .fg-sentence strong { color:#19777e; font-weight:800; }
    .fg-chip-row { display:flex; justify-content:center; gap:clamp(12px, 3vw, 18px); flex-wrap:wrap; }
    .fg-chip { font-family:inherit; font-weight:700; font-size:clamp(0.9rem, 2.5vw, 1.05rem); padding:clamp(10px, 2vh, 12px) clamp(18px, 4vw, 24px); border-radius:999px; border:3px solid #21b3be; background:#ffffff; color:#21b3be; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease, background .18s ease, color .18s ease, border-color .18s ease; box-shadow:0 16px 32px -16px rgba(0,0,0,0.25); letter-spacing:0.05em; min-width:clamp(60px, 15vw, 80px); }
    .fg-chip:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 12px 22px -10px rgba(0,0,0,0.28); background:#f1feff; }
    .fg-chip:active:not(:disabled) { transform:scale(0.94); }
    .fg-chip:disabled { opacity:0.45; cursor:default; box-shadow:none; }
    .fg-chip.fg-correct { background:#21b3be; color:#ffffff; border-color:#21b3be; box-shadow:0 18px 40px -16px rgba(33,179,190,0.55); opacity:1; }
    .fg-chip.fg-wrong { border-color:#f87171; color:#b91c1c; box-shadow:0 12px 30px -18px rgba(248,113,113,0.55); opacity:1; }
    .fg-hint { text-align:center; color:#8096a8; font-size:0.98rem; min-height:1.2rem; }
    .fg-feedback { text-align:center; font-size:1.05rem; font-weight:700; min-height:1.4rem; letter-spacing:0.02em; }
    .fg-reveal { font-size:1rem; color:#0f172a; background:#fff7ed; border-radius:18px; padding:16px 18px; border:2px solid #fdba74; text-align:center; }
    .fg-footer { width:100%; display:flex; justify-content:center; }
    .fg-actions { display:flex; justify-content:center; gap:16px; flex-wrap:wrap; margin-top:6px; }
    .fg-btn { font-family:inherit; font-weight:800; font-size:1.05rem; padding:14px 32px; border-radius:18px; border:2px solid transparent; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease; }
    .fg-btn.primary { background:#21b3be; color:#ffffff; border-color:#21b3be; box-shadow:0 18px 36px -14px rgba(20,126,130,0.55); }
    .fg-btn.primary:hover { transform:translateY(-2px); box-shadow:0 22px 34px -12px rgba(20,126,130,0.55); }
    #gameArea #grammarQuitBtn { font-family:'Poppins', Arial, sans-serif !important; font-weight:800 !important; font-size:1.05rem !important; padding:14px 36px !important; border-radius:20px !important; border-width:2px !important; border-color:#19777e !important; background:#ffffff !important; color:#19777e !important; letter-spacing:0.04em !important; box-shadow:0 20px 36px -16px rgba(25,119,126,0.45) !important; cursor:pointer !important; transition:transform .18s ease, box-shadow .18s ease, background .18s ease !important; }
    #gameArea #grammarQuitBtn:hover { transform:translateY(-3px); box-shadow:0 26px 42px -16px rgba(25,119,126,0.48) !important; background:#f2fbfc !important; }
    #gameArea #grammarQuitBtn:active { transform:scale(0.97); }
    #gameArea #grammarQuitBtn:focus-visible { outline:3px solid rgba(25,119,126,0.45); outline-offset:4px; }
    .fg-summary-card { width:min(640px, 92vw); margin:0 auto; background:#ffffff; border-radius:26px; border:2px solid #cbeef0; padding:32px 28px; box-shadow:0 24px 54px -22px rgba(20,126,130,0.45); text-align:center; display:flex; flex-direction:column; gap:22px; }
    .fg-summary-card h2 { margin:0; font-size:2.2rem; color:#19777e; font-weight:800; }
    .fg-summary-card .fg-score { font-size:1.4rem; font-weight:700; color:#0f172a; }
    .fg-summary-card .fg-score strong { color:#21b3be; }
  `;
  document.head.appendChild(style);
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSentenceWithBlank(item) {
  const sentence = (item?.exampleSentence || item?.example || '').trim();
  const article = (item?.article || '').trim();
  const word = (item?.word || '').trim();
  if (!sentence) {
    return `___ ${word}`.trim();
  }
  if (!article) return sentence;
  const articleWordPattern = new RegExp(`\\b${escapeRegex(article)}\\s+${escapeRegex(word)}\\b`, 'i');
  if (word && articleWordPattern.test(sentence)) {
    return sentence.replace(articleWordPattern, `___ ${word}`);
  }
  const articleOnlyPattern = new RegExp(`\\b${escapeRegex(article)}\\b`, 'i');
  if (articleOnlyPattern.test(sentence)) {
    return sentence.replace(articleOnlyPattern, '___');
  }
  return `___ ${word}`.trim();
}

export async function runGrammarFillGapMode(ctx) {
  const {
    grammarFile,
    grammarName,
    grammarConfig,
    playSFX,
    inlineToast,
    showOpeningButtons,
  } = ctx || {};

  const gameArea = document.getElementById('gameArea');
  if (!gameArea) {
    console.error('[GrammarFillGap] Missing game area');
    return;
  }

  if (!grammarFile) {
    inlineToast?.('Error: No grammar file selected');
    return;
  }

  let rawData = [];
  try {
    const res = await fetch(grammarFile);
    if (!res.ok) throw new Error(`Failed to load ${grammarFile}`);
    rawData = await res.json();
  } catch (err) {
    console.error('[GrammarFillGap] Unable to load data', err);
    inlineToast?.('Could not load grammar data');
    showOpeningButtons?.(true);
    return;
  }

  const usable = Array.isArray(rawData)
    ? rawData.filter((item) => item && item.word && item.article)
    : [];

  if (!usable.length) {
    inlineToast?.('No grammar items available yet');
    showOpeningButtons?.(true);
    return;
  }

  ensureStyles();

  // Extract answer choices from config (e.g., ['a', 'an'] or ['am', 'is', 'are'])
  const answerChoices = (grammarConfig && grammarConfig.answerChoices && Array.isArray(grammarConfig.answerChoices))
    ? grammarConfig.answerChoices
    : ['a', 'an']; // Default fallback

  const deck = shuffle(usable).slice(0, 15);
  const sessionWords = deck.map((item) => item.word);

  const updateProgressBar = (show, value = 0, max = 0) => {
    const bar = document.getElementById('gameProgressBar');
    const fill = document.getElementById('gameProgressFill');
    const text = document.getElementById('gameProgressText');
    if (!bar || !fill || !text) return;
    bar.style.display = show ? '' : 'none';
    if (show && max > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
      fill.style.width = `${pct}%`;
      text.textContent = `${value}/${max}`;
    }
  };

  let sessionId = null;
  try {
    sessionId = startSession({
      mode: 'grammar_fill_gap',
      wordList: sessionWords,
      listName: grammarName || null,
      meta: { category: 'grammar', file: grammarFile },
    });
  } catch (err) {
    console.debug('[GrammarFillGap] startSession failed', err?.message);
  }

  let currentIndex = 0;
  let correctCount = 0;
  let attempts = 0;
  let sessionEnded = false;
  let autoNextTimer = null;

  function clearAutoNext() {
    if (autoNextTimer) {
      clearTimeout(autoNextTimer);
      autoNextTimer = null;
    }
  }

  function quitToMenu() {
    sessionEnded = true;
    clearAutoNext();
    updateProgressBar(false);
    if (window.WordArcade?.startGrammarModeSelector) {
      window.WordArcade.startGrammarModeSelector();
    } else if (window.WordArcade?.quitToOpening) {
      window.WordArcade.quitToOpening(true);
    } else {
      showOpeningButtons?.(true);
    }
  }

  function renderLayout() {
    gameArea.innerHTML = `
      <div class="fg-root">
        <div class="fg-content" role="group" aria-live="polite">
          <div class="fg-emoji" id="fgEmoji" aria-hidden="true"></div>
          <div class="fg-word" id="fgWord"></div>
          <div class="fg-sentence" id="fgSentence"></div>
          <div class="fg-chip-row" id="fgOptions">
            ${answerChoices.map((choice) => `<button type="button" class="fg-chip" data-value="${choice.toLowerCase()}">${choice}</button>`).join('')}
          </div>
          <div class="fg-hint" id="fgHint"></div>
        </div>
        <div class="fg-footer">
          <button id="grammarQuitBtn" type="button">Quit Game</button>
        </div>
      </div>
    `;
  }

  function renderSummary() {
    sessionEnded = true;
    clearAutoNext();
    updateProgressBar(false);
    const accuracy = deck.length ? Math.round((correctCount / deck.length) * 100) : 0;
    try {
      const duration = Math.round((performance.now() - startTimeMs) / 1000);
      endSession(sessionId, {
        mode: 'grammar_fill_gap',
        summary: {
          score: correctCount,
          total: deck.length,
          correct: correctCount,
          points: correctCount,
          pct: accuracy,
          category: 'grammar',
          context: 'game',
          duration_s: duration,
          grammarName: grammarName || null,
        },
        listName: grammarName || null,
        wordList: sessionWords,
      });
      const ev = new CustomEvent('wa:session-ended', { detail: { summary: { score: correctCount, total: deck.length } } });
      window.dispatchEvent(ev);
    } catch (err) {
      console.debug('[GrammarFillGap] endSession error', err?.message);
    }

    gameArea.innerHTML = `
      <div class="fg-root">
        <div class="fg-summary-card">
          <h2>Great work!</h2>
          <div class="fg-score">You answered <strong>${correctCount}</strong> out of <strong>${deck.length}</strong> correctly (${accuracy}%).</div>
          <div class="fg-actions" style="justify-content:center;">
            <button type="button" class="fg-btn primary" id="fgBackToModes">Main Menu</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('fgBackToModes')?.addEventListener('click', () => {
      quitToMenu();
    });
  }

  function setReveal(text) {
    const revealEl = document.getElementById('fgReveal');
    if (!revealEl) return;
    if (!text) {
      revealEl.style.display = 'none';
      revealEl.textContent = '';
      return;
    }
    revealEl.textContent = text;
    revealEl.style.display = '';
  }

  function renderQuestion() {
    if (sessionEnded) return;
    const item = deck[currentIndex];
    if (!item) {
      renderSummary();
      return;
    }

    const counterEl = document.getElementById('fgCounter');
    const emojiEl = document.getElementById('fgEmoji');
    const wordEl = document.getElementById('fgWord');
    const sentenceEl = document.getElementById('fgSentence');
    const optionsRow = document.getElementById('fgOptions');
    const optionButtons = optionsRow ? Array.from(optionsRow.querySelectorAll('.fg-chip')) : [];
    const hintEl = document.getElementById('fgHint');

    if (!optionsRow || !optionButtons.length || !sentenceEl) {
      console.error('[GrammarFillGap] Missing layout nodes');
      return;
    }

    updateProgressBar(true, currentIndex, deck.length);

    emojiEl.textContent = item.emoji || '🧠';
  wordEl.textContent = item.prompt || item.word;
    sentenceEl.innerHTML = buildSentenceWithBlank(item).replace('___', '<strong>___</strong>');
    hintEl.textContent = item.exampleSentenceKo ? String(item.exampleSentenceKo).trim() : '';
    setReveal('');

    optionButtons.forEach((btn) => {
      btn.disabled = false;
      btn.classList.remove('fg-correct', 'fg-wrong');
    });
    const quitBtn = document.getElementById('grammarQuitBtn');
    if (quitBtn) {
      quitBtn.onclick = quitToMenu;
    }

    const handleSelection = (choice, btn) => {
      if (sessionEnded) return;
      if (btn.disabled) return;
      clearAutoNext();

      optionButtons.forEach((b) => { b.disabled = true; });

      const correctArticle = String(item.article || '').trim().toLowerCase();
      const guess = String(choice || '').trim().toLowerCase();
      const correct = guess === correctArticle;

      optionButtons.forEach((b) => {
        const val = String(b.dataset.value || '').trim().toLowerCase();
        if (val === correctArticle) {
          b.classList.add('fg-correct');
        } else if (val === guess) {
          b.classList.add('fg-wrong');
        }
      });

      if (correct) {
        correctCount += 1;
        if (playSFX) playSFX('correct');
        else try { new Audio('/Games/english_arcade/assets/audio/right-answer.mp3').play().catch(() => {}); } catch {}
      } else {
        if (playSFX) playSFX('wrong');
      }

      attempts += 1;
      updateProgressBar(true, currentIndex + 1, deck.length);

      try {
        logAttempt({
          session_id: sessionId,
          mode: 'grammar_fill_gap',
          word: item.id || item.word,
          is_correct: correct,
          answer: guess,
          correct_answer: item.article,
          points: correct ? 1 : 0,
          attempt_index: currentIndex,
          round: currentIndex + 1,
          extra: {
            word: item.word,
            article: item.article,
            sentence: item.exampleSentence,
            category: 'grammar',
          },
        });
      } catch (err) {
        console.debug('[GrammarFillGap] logAttempt failed', err?.message);
      }

      clearAutoNext();
      autoNextTimer = setTimeout(() => {
        if (sessionEnded) return;
        currentIndex += 1;
        renderQuestion();
      }, correct ? 1200 : 1700);
    };

    optionButtons.forEach((btn) => {
      btn.onclick = () => handleSelection(btn.dataset.value, btn);
    });
  }

  const startTimeMs = performance.now();

  renderLayout();
  renderQuestion();
}
