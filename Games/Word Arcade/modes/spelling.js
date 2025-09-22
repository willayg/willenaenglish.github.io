import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

// ----- Live Play Helpers (play.html integration) ---------------------------------
function isLivePlayContext() {
  // Detect if loaded inside the standalone live play host (play.html) by path or query param
  try {
    const loc = window.location || {};
    if (/play\.html$/i.test(loc.pathname)) return true;
    if (loc.search && /[?&]mode=(spelling|listen_and_spell)/i.test(loc.search)) return true;
  } catch { /* noop */ }
  return !!window.__WORD_ARCADE_LIVE; // manual escape hatch
}

function ensureLiveSpellStyles() {
  if (!isLivePlayContext()) return;
  if (document.getElementById('wa-live-spell-styles')) return;
  const style = document.createElement('style');
  style.id = 'wa-live-spell-styles';
  style.textContent = `
    /* Live play responsive adjustments for tap-to-spell */
    .wa-live-wrap { width:100%; max-width:660px; margin:0 auto; padding:0 10px 8px; box-sizing:border-box; }
    .wa-live-wrap .tap-spell { max-width:100% !important; }
    .wa-live-wrap #letterTiles { max-width:100% !important; }
    .wa-live-wrap .slot-row { flex-wrap:nowrap; }
    @media (max-width:520px){
      .wa-live-wrap .slot-row { gap:6px !important; }
      .wa-live-wrap #korPrompt { margin-bottom:46px !important; }
    }
    @media (max-width:420px){
      .wa-live-wrap .tile-btn { width:54px !important; height:54px !important; font-size:1.15em !important; }
    }
  `;
  document.head.appendChild(style);
}

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
  ensureLiveSpellStyles();
  let score = 0;
  let idx = 0;
  const ordered = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'spelling', wordList, listName });

  // Intro splash
  gameArea.innerHTML = `
  <div id="spellingIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:30vh;opacity:1;transition:opacity .6s ease;">
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
  ${document.getElementById('gameStage') ? '' : `<button id=\"tryMoreSpelling\" style=\"font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Try More</button>`}
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

    const fromBuilder = !!window.__WA_FROM_BUILDER;
    const live = isLivePlayContext();
    // Multi-line slot rendering: split answer into words, skip spaces
    // Compute dynamic max width when in live play (container driven) else fallback to prior constants.
    let dynamicContainerWidth = null;
    if (live) {
      try {
        // Allow smaller minimum than before (was 280); helps very narrow devices.
        const computed = gameArea.clientWidth - 24; // padding allowance
        dynamicContainerWidth = Math.min(660, Math.max(200, computed));
      } catch { dynamicContainerWidth = null; }
    }
    const maxSlotsWidth = dynamicContainerWidth || (fromBuilder ? 520 : 340); // px
    // Allow slots to shrink further (down to 20) on narrow phones; builder keeps a bit larger.
  // Remove enforced minimum so very long words can compress further on narrow screens.
  const minSlotSize = fromBuilder ? 26 : 10; // kept a tiny floor just to avoid zero; effectively no visual clamp
    const slotGap = fromBuilder ? 10 : (live ? 8 : 8); // keep ability to tweak live later
    const words = correct.split(' ');
    // Multi-row logic: if a single word is long and viewport is narrow, wrap into 2 rows (balanced) instead of shrinking too small.
    function maybeSplitLongWord(word, availableWidth) {
      const MIN_WRAP_TRIGGER = 9; // letters
      const narrow = availableWidth < 380; // arbitrary breakpoint for very small phones
      if (!narrow || word.length < MIN_WRAP_TRIGGER) return [word];
      // Split roughly in half, bias first row longer if odd.
      const mid = Math.ceil(word.length / 2);
      return [word.slice(0, mid), word.slice(mid)];
    }
    // For each (possibly split) word segment, calculate slot size so all segments fit their own line.
    function renderSlotRows() {
      const borderThickness = 3; // matches inline style
      let segments = [];
      words.forEach(w => { segments.push(...maybeSplitLongWord(w, maxSlotsWidth)); });
      return `<div class=\"slot-rows-container\" style=\"display:flex;flex-direction:column;align-items:center;\">` +
        segments.map(segment => {
          const slotCount = segment.length || 1;
          const totalGaps = slotGap * (slotCount - 1);
          let slotSize = Math.floor((maxSlotsWidth - totalGaps) / slotCount);
          if (slotSize < minSlotSize) slotSize = minSlotSize;
          let fontPx = Math.round(slotSize * 0.72);
          const maxFont = slotSize - (borderThickness * 2) - 4;
          if (fontPx > maxFont) fontPx = maxFont;
          if (fontPx < 10) fontPx = 10;
          if (window.__WA_SLOTS_DEBUG) console.log('[spelling] sizing row', { maxSlotsWidth, slotCount, slotSize, fontPx });
          return `<div class=\"slot-row\" data-row-len='${slotCount}' style=\"display:inline-flex;gap:${slotGap}px;margin-bottom:4px;\">${segment.split('').map(() => `<div class=\"slot\" style=\"box-sizing:border-box;width:${slotSize}px;height:${slotSize}px;border:${borderThickness}px solid #93cbcf;border-radius:14px;background:#f7fafc;display:flex;align-items:center;justify-content:center;font-size:${fontPx}px;font-weight:800;color:#0f172a;transition:width .2s;\"></div>`).join('')}</div>`;
        }).join('') + '</div>';
    }
    const tileSize = fromBuilder ? 62 : 56;
    const tileRadius = fromBuilder ? 14 : 12;
    const fontScale = fromBuilder ? 1.15 : 1.0;
    // Only show tiles for non-space characters
    const tileChars = correct.replace(/ /g, '').split('');
    const tileObjs = tileChars.map((ch, i) => ({ id: 'b' + i, ch }));
    // Add distractors as before
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const inWordSet = new Set(tileChars);
    const pool = alphabet.filter(ch => !inWordSet.has(ch));
    const distractorCount = 2;
    const distractors = [];
    while (distractors.length < distractorCount && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      distractors.push(pick);
    }
    distractors.forEach((ch, i) => tileObjs.push({ id: 'd' + i, ch }));
    // Shuffle
    for (let i = tileObjs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tileObjs[i], tileObjs[j]] = [tileObjs[j], tileObjs[i]];
    }

    const innerHTML = `
      <div class="tap-spell ${fromBuilder ? 'from-builder' : ''}" style="max-width:${fromBuilder ? '600px' : (isLivePlayContext() ? dynamicContainerWidth + 'px' : '520px')};margin:0 auto;">
        <div id="korPrompt" style="margin-bottom:62px;text-align:center;font-size:${fromBuilder ? '1.35em' : '1.25em'};color:#19777e;font-weight:800;">${current.kor || ''}</div>
        <div id="letterSlots" style="margin:8px 0 12px 0;">
          ${renderSlotRows()}
        </div>
        <div id="letterTiles" style="display:flex;flex-wrap:wrap;gap:${fromBuilder ? '12px' : '10px'};max-width:${fromBuilder ? '520px' : '420px'};margin:0 auto;justify-content:center;align-items:center;">
          ${tileObjs.map(t => `<button class=\"choice-btn tile-btn\" data-id=\"${t.id}\" data-ch=\"${t.ch}\" style=\"width:${tileSize}px;height:${tileSize}px;border:3px solid #cfdbe2;border-radius:${tileRadius}px;background:#fff;font-size:${1.2*fontScale}em;font-weight:800;color:#314249;display:flex;align-items:center;justify-content:center;\">${t.ch.toUpperCase()}</button>`).join('')}
        </div>
        <div id="spelling-feedback" style="min-height:26px;text-align:center;font-size:1.05em;color:#555;margin-top:10px;"></div>
        <div id="spelling-score" style="margin-top:6px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
      </div>
    `;
    if (live) {
      gameArea.innerHTML = `<div class="wa-live-wrap">${innerHTML}</div>`;
    } else {
      gameArea.innerHTML = innerHTML;
    }

    // Live resizing: re-render slots if container width changes significantly (>=8px diff)
    if (live) {
      const wrap = gameArea.querySelector('.wa-live-wrap');
      if (wrap && !wrap.__slotResizeObserver) {
        let lastWidth = wrap.clientWidth;
        const ro = new ResizeObserver(entries => {
          for (const entry of entries) {
            const w = entry.contentRect.width;
            if (Math.abs(w - lastWidth) >= 8) {
              lastWidth = w;
              // Recompute and replace slot rows only
              try {
                const slotsContainer = gameArea.querySelector('#letterSlots');
                if (slotsContainer) {
                  // Recalculate dynamicContainerWidth and regenerate rows
                  let dynamic = Math.min(660, Math.max(200, wrap.clientWidth - 24));
                  // Rebuild with potential wrapping identical to initial render
                  function maybeSplitLongWord(word, availableWidth) {
                    const MIN_WRAP_TRIGGER = 9; const narrow = availableWidth < 380; if (!narrow || word.length < MIN_WRAP_TRIGGER) return [word];
                    const mid = Math.ceil(word.length / 2); return [word.slice(0, mid), word.slice(mid)];
                  }
                  const borderThickness = 3;
                  const newWords = correct.split(' ');
                  let segments = [];
                  newWords.forEach(w => { segments.push(...maybeSplitLongWord(w, dynamic)); });
                  const newHTML = `<div class=\"slot-rows-container\" style=\"display:flex;flex-direction:column;align-items:center;\">` +
                    segments.map(segment => {
                      const slotCount = segment.length || 1;
                      const totalGaps = slotGap * (slotCount - 1);
                      let slotSize = Math.floor((dynamic - totalGaps) / slotCount);
                      if (slotSize < minSlotSize) slotSize = minSlotSize;
                      let fontPx = Math.round(slotSize * 0.72);
                      const maxFont = slotSize - (borderThickness * 2) - 4;
                      if (fontPx > maxFont) fontPx = maxFont;
                      if (fontPx < 10) fontPx = 10;
                      if (window.__WA_SLOTS_DEBUG) console.log('[spelling][resize] sizing row', { dynamic, slotCount, slotSize, fontPx });
                      return `<div class=\"slot-row\" data-row-len='${slotCount}' style=\"display:inline-flex;gap:${slotGap}px;margin-bottom:4px;\">${segment.split('').map(() => `<div class=\"slot\" style=\"box-sizing:border-box;width:${slotSize}px;height:${slotSize}px;border:${borderThickness}px solid #93cbcf;border-radius:14px;background:#f7fafc;display:flex;align-items:center;justify-content:center;font-size:${fontPx}px;font-weight:800;color:#0f172a;transition:width .15s;\"></div>`).join('')}</div>`;
                    }).join('') + '</div>';
                  slotsContainer.innerHTML = newHTML;
                  // Re-link slotEls reference & repaint current letters
                  slotEls = Array.from(document.querySelectorAll('#letterSlots .slot'));
                  const letters = usedStack.map(id => {
                    const btn = document.querySelector(`.tile-btn[data-id="${id}"]`);
                    return btn ? btn.getAttribute('data-ch') : '';
                  });
                  slotEls.forEach((el, i) => { el.textContent = letters[i] ? letters[i].toUpperCase() : ''; });
                  bindSlotRemovalHandlers();
                }
              } catch { /* ignore */ }
            }
          }
        });
        ro.observe(wrap);
        wrap.__slotResizeObserver = ro;
      }
    }

  const tileButtons = Array.from(document.querySelectorAll('.tile-btn'));
  let slotEls = Array.from(document.querySelectorAll('#letterSlots .slot'));
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
      // Only require non-space letters
      const expectedLength = correct.replace(/ /g, '').length;
      if (usedStack.length !== expectedLength || locked) return;
      locked = true;
      const answer = usedStack.map(id => {
        const b = document.querySelector(`.tile-btn[data-id="${id}"]`);
        return b ? b.getAttribute('data-ch') : '';
      }).join('').toLowerCase().replace(/ /g, '');
      const correctLower = correct.toLowerCase().replace(/ /g, '');
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
      // Only allow as many tiles as non-space letters (mirror listen_and_spell behavior)
      const expectedLength = correct.replace(/ /g, '').length;
      if (usedStack.length >= expectedLength) return;
      usedStack.push(id);
      btn.disabled = true;
      btn.classList.add('selected');
      // Simple hide (avoid animation leaving transient blank interactive area)
      btn.style.display = 'none';
      updateSlots();
      evaluateIfComplete();
    }

    tileButtons.forEach(btn => btn.onclick = () => onTileClick(btn));

    function bindSlotRemovalHandlers() {
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
    bindSlotRemovalHandlers();
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
