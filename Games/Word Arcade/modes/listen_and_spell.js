import { playSFX } from '../sfx.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgressSync as showGameProgress, updateGameProgressSync as updateGameProgress, hideGameProgressSync as hideGameProgress } from '../utils/progress.js';

// ----- Live Play Helpers (play.html integration) -------------
function isLivePlayContext() {
  try {
    const loc = window.location || {};
    if (/play\.html$/i.test(loc.pathname)) return true;
    if (loc.search && /[&?]mode=(spelling|listen_and_spell)/i.test(loc.search)) return true;
  } catch { /* ignore */ }
  return !!window.__WORD_ARCADE_LIVE;
}

function ensureLiveListenStyles() {
  if (!isLivePlayContext()) return;
  if (document.getElementById('wa-live-spell-styles')) return; // spelling injector already covers shared rules
  const style = document.createElement('style');
  style.id = 'wa-live-spell-styles';
  style.textContent = `
    .wa-live-wrap { width:100%; max-width:660px; margin:0 auto; padding:0 10px 10px; box-sizing:border-box; }
    .wa-live-wrap .tap-spell { max-width:100% !important; }
    .wa-live-wrap #letterTiles { max-width:100% !important; }
    @media (max-width:520px){ .wa-live-wrap #tap-instructions { font-size:1em !important; } }
  `;
  document.head.appendChild(style);
}

// Listen and Spell (Tap-to-Spell) mode
export function runListenAndSpellMode({ wordList, gameArea, playTTS, preprocessTTS, startGame, listName = null }) {
  console.log('[ListenAndSpell] runListenAndSpellMode called', { 
    wordCount: Array.isArray(wordList) ? wordList.length : 0, 
    listName,
    gameAreaId: gameArea?.id,
    isLivePlay: isLivePlayContext(),
    hasPlayTTS: typeof playTTS === 'function'
  });

  // Ensure we have a valid gameArea element
  gameArea = gameArea || document.getElementById('gameArea');
  if (!gameArea) {
    console.error('[ListenAndSpell] no gameArea available');
    return;
  }
  
  // Validate list
  if (!Array.isArray(wordList) || wordList.length === 0) {
    console.error('[ListenAndSpell] Invalid or empty wordList:', wordList);
    gameArea.innerHTML = `<div style="padding:28px;text-align:center;color:#666;font-weight:600;">No words available for Listen and Spell mode.<br>Please choose a lesson or load a word list first.</div>`;
    return;
  }
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');
  ensureLiveListenStyles();
  let score = 0;
  let idx = 0;
  const ordered = [...wordList].sort(() => Math.random() - 0.5);
  const sessionId = startSession({ mode: 'listen_and_spell', wordList, listName });

  // Intro splash
  gameArea.innerHTML = `
    <div id="listenSpellIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.3rem,5.2vw,4rem);font-weight:800;color:#19777e;text-align:center;width:90%;">Listen and tap the letters</div>
    </div>
  `;
  setTimeout(() => {
    const intro = document.getElementById('listenSpellIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => {
      showGameProgress(ordered.length, 0);
      renderQuestion();
    }, 650);
  }, 1000);

  function makeLetterTilesFor(word) {
    const clean = String(word || '').trim();
    const base = clean.split('');
    // Build distractors: choose 2 letters not in the word (avoid duplicates)
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const inWordSet = new Set(base.map(c => c.toLowerCase()));
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
      endSession(sessionId, { mode: 'listen_and_spell', summary: { score, max: ordered.length * 2 } });
      hideGameProgress();
      gameArea.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
        <h2 style="color:#f59e0b;font-size:2em;margin-bottom:18px;">Listening Game Over!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.3em;margin-bottom:12px;\">Your Score: <span style=\"color:#19777e;font-weight:700;\">${score} / ${ordered.length*2}</span></div>`}
        <button id="playAgainBtn" style="font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
  ${document.getElementById('gameStage') ? '' : `<button id=\"tryMoreListenSpell\" style=\"font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;\">Try More</button>`}
      </div>`;
      document.getElementById('playAgainBtn').onclick = () => runListenAndSpellMode({ wordList, gameArea, playTTS, preprocessTTS, startGame, listName });
      document.getElementById('tryMoreListenSpell').onclick = () => {
        if (window.WordArcade?.startModeSelector) {
          window.WordArcade.startModeSelector();
        } else {
          runListenAndSpellMode({ wordList: wordList.sort(() => Math.random() - 0.5), gameArea, playTTS, preprocessTTS, startGame, listName });
        }
      };
      return;
    }

    const current = ordered[idx];
    const correct = String(current.eng || '').trim();
    const fromBuilder = !!window.__WA_FROM_BUILDER;
    const live = isLivePlayContext();
    // Multi-line slot rendering: split answer into words, skip spaces
    let dynamicContainerWidth = null;
    if (live) {
      try { dynamicContainerWidth = Math.min(660, Math.max(280, gameArea.clientWidth - 24)); } catch {}
    }
    const maxSlotsWidth = dynamicContainerWidth || (fromBuilder ? 520 : 340);
    // Relax minimum: allow very small slots (small floor) so we can avoid overflow on ultra narrow devices.
    const minSlotSize = fromBuilder ? 26 : 10;
    const slotGap = fromBuilder ? 10 : (live ? 8 : 8);
    const words = correct.split(' ');
    // Split a long single word into two segments on narrow screens (similar to spelling.js)
    function maybeSplitLongWord(word, availableWidth) {
      const MIN_WRAP_TRIGGER = 9; // letters
      const narrow = availableWidth < 380;
      if (!narrow || word.length < MIN_WRAP_TRIGGER) return [word];
      const mid = Math.ceil(word.length / 2);
      return [word.slice(0, mid), word.slice(mid)];
    }
    function renderSlotRows() {
      let segments = [];
      words.forEach(w => { segments.push(...maybeSplitLongWord(w, maxSlotsWidth)); });
      return `<div class=\"slot-rows-container\" style=\"display:flex;flex-direction:column;align-items:center;\">` +
        segments.map(segment => {
          const slotCount = segment.length;
          let slotSize = Math.floor((maxSlotsWidth - slotGap * (slotCount - 1)) / Math.max(1, slotCount));
          if (slotSize < minSlotSize) slotSize = minSlotSize; // minimal floor
          // Dynamic font size scaling (target ~ slotSize * 0.78) with clamp 14-30px
          const fontPx = Math.min(30, Math.max(14, Math.round(slotSize * 0.78)));
          return `<div class=\"slot-row\" data-row-len='${slotCount}' style=\"display:inline-flex;gap:${slotGap}px;margin-bottom:4px;\">${segment.split('').map(() => `<div class=\"slot\" style=\"width:${slotSize}px;height:${slotSize}px;border:2px solid #93cbcf;border-radius:10px;background:#f7fafc;display:flex;align-items:center;justify-content:center;font-size:${fontPx}px;font-weight:800;color:#0f172a;transition:width .2s;\"></div>`).join('')}</div>`;
        }).join('') + '</div>';
    }
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
    const usedStack = [];
    let locked = false;
    const innerHTML = `
      <div class="tap-spell ${fromBuilder ? 'from-builder' : ''}" style="max-width:${fromBuilder ? '600px' : (live ? dynamicContainerWidth + 'px' : '520px')};margin:0 auto;">
        <div id="tap-instructions" style="margin-bottom:12px;text-align:center;font-size:1.06em;color:#19777e;">Listen and tap the letters to spell the word:</div>
        <div style="display:flex;justify-content:center;align-items:center;margin:10px 0 58px 0;gap:10px;">
         <button id="playAudioBtn" title="Replay" style="border:none;background:#19777e;color:#fff;border-radius:999px;width:52px;height:52px;box-shadow:0 2px 8px rgba(60,60,80,0.12);cursor:pointer;font-size:1.5em;">▶</button>
        </div>
        <div id="letterSlots" style="margin:8px 0 12px 0;">
         ${renderSlotRows()}
        </div>
        <div id="letterTiles" style="display:flex;flex-wrap:wrap;gap:10px;max-width:420px;margin:0 auto;justify-content:center;align-items:center;">
          ${tileObjs.map(t => `<button class=\"choice-btn tile-btn\" data-id=\"${t.id}\" data-ch=\"${t.ch}\" style=\"width:56px;height:56px;border:2px solid #cfdbe2;border-radius:12px;background:#fff;font-size:1.2em;font-weight:800;color:#314249;display:flex;align-items:center;justify-content:center;\">${t.ch.toUpperCase()}</button>`).join('')}
        </div>
        <div id="listening-feedback" style="min-height:26px;text-align:center;font-size:1.05em;color:#555;margin-top:10px;"></div>
        <div id="listening-score" style="margin-top:6px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
      </div>
    `;
    if (live) {
      gameArea.innerHTML = `<div class=\"wa-live-wrap\">${innerHTML}</div>`;
    } else {
      gameArea.innerHTML = innerHTML;
    }
    // Live resizing for listen & spell
    if (live) {
      const wrap = gameArea.querySelector('.wa-live-wrap');
      if (wrap && !wrap.__slotResizeObserver) {
        let lastWidth = wrap.clientWidth;
        const ro = new ResizeObserver(entries => {
          for (const entry of entries) {
            const w = entry.contentRect.width;
            if (Math.abs(w - lastWidth) >= 8) {
              lastWidth = w;
              try {
                const slotsContainer = gameArea.querySelector('#letterSlots');
                if (slotsContainer) {
                  let dynamic = Math.min(660, Math.max(280, wrap.clientWidth - 24));
                  function maybeSplitLongWord(word, availableWidth) {
                    const MIN_WRAP_TRIGGER = 9; const narrow = availableWidth < 380; if (!narrow || word.length < MIN_WRAP_TRIGGER) return [word];
                    const mid = Math.ceil(word.length / 2); return [word.slice(0, mid), word.slice(mid)];
                  }
                  const newWords = correct.split(' ');
                  let segments = [];
                  newWords.forEach(w => { segments.push(...maybeSplitLongWord(w, dynamic)); });
                  const newHTML = `<div class=\"slot-rows-container\" style=\"display:flex;flex-direction:column;align-items:center;\">` +
                    segments.map(segment => {
                      const slotCount = segment.length;
                      let slotSize = Math.floor((dynamic - slotGap * (slotCount - 1)) / Math.max(1, slotCount));
                      if (slotSize < minSlotSize) slotSize = minSlotSize;
                      const fontPx = Math.min(30, Math.max(14, Math.round(slotSize * 0.78)));
                      return `<div class=\"slot-row\" data-row-len='${slotCount}' style=\"display:inline-flex;gap:${slotGap}px;margin-bottom:4px;\">${segment.split('').map(() => `<div class=\"slot\" style=\"width:${slotSize}px;height:${slotSize}px;border:2px solid #93cbcf;border-radius:10px;background:#f7fafc;display:flex;align-items:center;justify-content:center;font-size:${fontPx}px;font-weight:800;color:#0f172a;transition:width .15s;\"></div>`).join('')}</div>`;
                    }).join('') + '</div>';
                  slotsContainer.innerHTML = newHTML;
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
    // If launched from builder, swap in square larger tiles/slots
    if (window.__WA_FROM_BUILDER) {
      const wrap = gameArea.querySelector('.tap-spell');
      if (wrap) {
        wrap.style.maxWidth = '600px';
        const slotsRow = wrap.querySelector('#letterSlots');
        if (slotsRow) {
          slotsRow.style.gap = '10px';
          slotsRow.style.flexWrap = 'wrap';
          Array.from(slotsRow.children).forEach(ch => {
            ch.style.width = '54px';
            ch.style.height = '54px';
            ch.style.border = '3px solid #93cbcf';
            ch.style.borderRadius = '14px';
            ch.style.fontSize = '1.2em';
          });
        }
        const tilesWrap = wrap.querySelector('#letterTiles');
        if (tilesWrap) {
          tilesWrap.style.maxWidth = '520px';
          tilesWrap.style.gap = '12px';
          Array.from(tilesWrap.querySelectorAll('.tile-btn')).forEach(btn => {
            btn.style.width = '62px';
            btn.style.height = '62px';
            btn.style.border = '3px solid #cfdbe2';
            btn.style.borderRadius = '14px';
            btn.style.fontSize = '1.38em';
          });
        }
      }
    }

    function playCurrent() {
      try { 
        if (typeof playTTS === 'function') {
          playTTS(current.eng);
        } else {
          console.warn('[ListenAndSpell] playTTS function not available');
        }
      } catch (e) {
        console.error('[ListenAndSpell] Error playing TTS:', e);
      }
    }
    playCurrent();
    document.getElementById('playAudioBtn').onclick = playCurrent;

  const tileButtons = Array.from(document.querySelectorAll('.tile-btn'));
  let slotEls = Array.from(document.querySelectorAll('#letterSlots .slot'));
    const feedback = document.getElementById('listening-feedback');

    function updateSlots() {
      // Fill slots based on usedStack
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
        mode: 'listen_and_spell',
        word: current.eng,
        is_correct: basePoints > 0,
        answer,
        correct_answer: correctLower,
        points,
        attempt_index: idx + 1
      });
      // UI update and next
      score += basePoints;
      const scoreEl = document.getElementById('listening-score');
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
      // Only allow as many tiles as non-space letters
      const expectedLength = correct.replace(/ /g, '').length;
      if (usedStack.length >= expectedLength) return;
      usedStack.push(id);
      btn.disabled = true;
      btn.classList.add('selected');
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
    const dp = Array(a.length + 1).fill().map(() => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
        else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
      }
    }
    return dp[a.length][b.length];
  }
}

// Export for mode registry
export const run = runListenAndSpellMode;
