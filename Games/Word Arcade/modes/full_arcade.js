// Full Arcade Mode: orchestrates six themed rounds in the pedagogical order
// you described (Match, Listen, Read, Spell, Test, Level Up). We map those
// themes onto existing underlying mode implementations while introducing a
// little variation so repeated playthroughs feel fresh.
//
// Theme -> Underlying Mode Mapping:
// 1. Matching:      'matching' (existing match English↔Korean)
// 2. Listen:        now uses unified 'listening' hybrid mode (per-question alternates
//                   between picture (image/emoji) and Korean meaning where enough
//                   picturable items (>=4) exist; otherwise gracefully falls back
//                   to meaning-only questions).
// 3. Read:          alternates direction each run between ENG→KOR and KOR→ENG
//                   multi-choice (vocabulary recognition in reading form).
// 4. Spell:         'listen_and_spell' (listen then type exact word).
// 5. Test:          'spelling' (show Korean, type English) – existing spelling drill.
// 6. Level Up:      'level_up' (definition → word selection).
//
// We compute a dynamic ROUND_SEQUENCE at runtime instead of a static constant.

// The orchestrator wraps each underlying mode, listens for its normal end screen,
// injects Next / Replay buttons, and maintains cumulative stats.

import { loadMode } from '../core/mode-registry.js';

// --- Custom lightweight preloader & loader override for two special modes ---
// Rationale: user requested a rewrite of how Full Arcade imports `listen_and_spell` and `spelling`
// without touching the mode source files themselves. We special‑case these here so the rest of the
// ecosystem (mini player, direct launches) still uses the central registry untouched.
// Strategy:
// 1. Kick off early dynamic imports (preload) when Full Arcade starts to hide latency.
// 2. Provide a local loadArcadeMode(key) that bypasses registry for those two keys with retry + fallback.
// 3. If a special mode fails twice, we gracefully skip to next round (recording a skipped marker) so the
//    arcade flow never hard-crashes in production.

const SPECIAL_MODE_KEYS = new Set(['listen_and_spell','spelling']);
const __fa_preloaded = {};

function preloadSpecialModes() {
  SPECIAL_MODE_KEYS.forEach(k => {
    // Only preload once
    if (__fa_preloaded[k]) return;
    __fa_preloaded[k] = import(`../modes/${k}.js`).catch(err => {
      console.warn('[FullArcade] Preload failed for', k, err);
      return null; // store null so later we attempt real load again
    });
  });
}

async function loadArcadeMode(key) {
  if (!SPECIAL_MODE_KEYS.has(key)) {
    // Delegate to standard registry for all other modes
    return loadMode(key);
  }
  // Attempt: prefer preloaded promise if exists
  let attempt = 0;
  while (attempt < 2) {
    try {
      attempt++;
      let modPromise = __fa_preloaded[key];
      if (!modPromise) {
        modPromise = import(`../modes/${key}.js`);
        __fa_preloaded[key] = modPromise; // cache for any future use
      }
      const raw = await modPromise;
      if (!raw) throw new Error('Module object null');
      // Expect the canonical run export names used historically
      let runner = raw.run || raw[`run${camelCase(key)}Mode`] || raw[`run${camelCase(key)}`];
      if (!runner) {
        // Historical specific exports
        if (key === 'listen_and_spell' && raw.runListenAndSpellMode) runner = raw.runListenAndSpellMode;
        else if (key === 'spelling' && raw.runSpellingMode) runner = raw.runSpellingMode;
      }
      if (typeof runner !== 'function') throw new Error('No runnable export found');
      return { run: (ctx) => {
        if (window.__FA_DEBUG) console.debug(`[FullArcade] Running special mode ${key} (attempt ${attempt})`);
        return runner(ctx);
      }};
    } catch (err) {
      console.error(`[FullArcade] Load attempt ${attempt} failed for ${key}`, err);
      // Invalidate cached failed preloaded promise so next loop can re-import fresh
      __fa_preloaded[key] = null;
      if (attempt >= 2) break; // stop retrying
    }
  }
  // Fallback shim: returns an immediate end screen with skip messaging.
  return { run: (ctx) => {
    const { gameArea } = ctx;
    gameArea.innerHTML = `<div style="padding:32px;text-align:center;font-family:system-ui;">
      <h2 style="margin:0 0 12px;font-size:1.3rem;color:#b91c1c;">${prettyLabel(key)} Unavailable</h2>
      <p style="margin:0 0 16px;font-size:.95rem;color:#475569;">We couldn't load this round right now. Skipping it so you can keep playing.</p>
      <button id="fa-skip-broken" style="${commonBtnStyle('#0d9488')}">Continue</button>
    </div>`;
    const btn = document.getElementById('fa-skip-broken');
    if (btn) btn.onclick = () => {
      if (window.__fullArcadeNextRound) window.__fullArcadeNextRound();
    };
  }};
}

function camelCase(key) {
  return key.split(/[_-]/).map((p,i) => i===0 ? p.charAt(0).toUpperCase()+p.slice(1) : p.charAt(0).toUpperCase()+p.slice(1)).join('');
}

// Persist lightweight counters across runs so Listen & Read rounds rotate deterministically
// rather than random each time (better perceived coverage & fairness).
let __fa_listen_counter = (window.__fa_listen_counter || 0);
let __fa_read_counter = (window.__fa_read_counter || 0);
window.__fa_listen_counter = __fa_listen_counter + 1;
window.__fa_read_counter = __fa_read_counter + 1;

function buildRoundSequence() {
  // Listen round always uses the hybrid mode which internally alternates
  // per question. If later you want to occasionally insert a pure variant,
  // you can restore a rotation here.
  const listenVariant = 'listening';
  const readVariant = 'multi_choice';
  return [
    'matching',
    listenVariant,
    readVariant,
    'listen_and_spell',
    'spelling',
    'level_up',
  ];
}

function getThemedSequence() {
  // Always randomize Listen round at the moment Full Arcade starts
  return buildRoundSequence();
}

// Utility to create a simple container for per-round overlays
function ensureOverlay() {
  let el = document.getElementById('fullArcadeOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'fullArcadeOverlay';
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4000;';
    document.body.appendChild(el);
  }
  return el;
}

function summaryBlock(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.firstElementChild || div;
}

export function runFullArcadeMode(context) {
  const { wordList, gameArea } = context;
  // Signal to nested modes that we are in the live play environment even if URL lacks direct mode key.
  window.__WORD_ARCADE_LIVE = true;
  if (!Array.isArray(wordList) || !wordList.length) {
    gameArea.innerHTML = '<div style="padding:30px;text-align:center;">No words available.</div>';
    return;
  }

  // Begin preloading special modes immediately (non-blocking)
  try { preloadSpecialModes(); } catch(e) { console.debug('[FullArcade] Preload init skipped', e); }

  const cumulative = {
    rounds: [], // { key, correct, total }
    totalCorrect: 0,
    totalQuestions: 0
  };

  let roundIndex = 0;
  let currentMode = null;
  const THEMED_SEQUENCE = getThemedSequence();

  // Provide a globally callable helper so external UI (e.g., Skip link) can advance
  window.__fullArcadeNextRound = function() {
    const nextIdx = roundIndex + 1;
    if (nextIdx < THEMED_SEQUENCE.length) startRound(nextIdx); else finalSummary();
  };

  // Provide a globally callable helper to go back to the previous round
  window.__fullArcadePrevRound = function() {
    const prevIdx = roundIndex - 1;
    if (prevIdx >= 0) startRound(prevIdx);
  };

  // Skip Round small text link (bottom-right) — injected once then shown/hidden
  function ensureSkipLink() {
    let link = document.getElementById('faSkipRoundLink');
    if (!link) {
      link = document.createElement('div');
      link.id = 'faSkipRoundLink';
      link.textContent = 'Skip round →';
      link.style.cssText = 'position:fixed;right:16px;bottom:14px;font-size:.85rem;color:#19777e;cursor:pointer;z-index:5000;font-weight:500;text-decoration:underline;font-family:system-ui,sans-serif;';
      link.onclick = () => window.__fullArcadeNextRound && window.__fullArcadeNextRound();
      document.body.appendChild(link);
    }
    link.style.display = 'block';
  }
  function hideSkipLink() { const link = document.getElementById('faSkipRoundLink'); if (link) link.style.display = 'none'; }

  // Bottom-left "Last round" (previous) link
  function ensurePrevLink() {
    let link = document.getElementById('faPrevRoundLink');
    if (!link) {
      link = document.createElement('div');
      link.id = 'faPrevRoundLink';
      link.textContent = '← Last round';
      link.style.cssText = 'position:fixed;left:16px;bottom:14px;font-size:.85rem;color:#19777e;cursor:pointer;z-index:7000;font-weight:500;text-decoration:underline;font-family:system-ui,sans-serif;';
      link.onclick = () => window.__fullArcadePrevRound && window.__fullArcadePrevRound();
      document.body.appendChild(link);
    }
    // Show whenever not the very first index; also keep during end screen
    link.style.display = (roundIndex > 0) ? 'block' : 'none';
  }
  function hidePrevLink() { const link = document.getElementById('faPrevRoundLink'); if (link) link.style.display = 'none'; }

  function startRound(i) {
    roundIndex = i;
    const modeKey = THEMED_SEQUENCE[i];
    if (!modeKey) return finalSummary();
    // Clear area & show lightweight round header
    if (window.__FA_DEBUG) console.debug('[FullArcade] Starting round', i, modeKey, 'special?', SPECIAL_MODE_KEYS.has(modeKey));
    gameArea.innerHTML = `<div class="arcade-round-intro" style="text-align:center;padding:16px 8px;font-family:system-ui,sans-serif;">
      <h2 style="margin:4px 0 10px;font-size:1.25rem;color:#19777e;font-weight:800;">Round ${i+1} / ${THEMED_SEQUENCE.length}</h2>
      <div style="color:#334155;font-size:.9rem;margin-bottom:8px;">${prettyLabel(modeKey)}</div>
      <div style="font-size:.8rem;color:#64748b;">Loading…</div>
    </div>`;
    ensureSkipLink();
  ensurePrevLink();
    loadArcadeMode(modeKey).then(mod => {
      currentMode = modeKey;
      // Run underlying mode with same context; pass through wordList (can be filtered per round later)
      mod.run({ ...context, wordList, gameArea });
      // Reassert prev link shortly after mode renders in case mode wipes overlays
      setTimeout(ensurePrevLink, 250);
      setTimeout(ensurePrevLink, 750);
      hookEndScreen();
    }).catch(e => {
      console.error('[FullArcade] failed to load mode', modeKey, e);
      gameArea.innerHTML = `<div style="padding:30px;text-align:center;color:#b91c1c;">Failed to load ${modeKey}</div>`;
    });
  }

  // Observe for an end screen insertion (looking for buttons / typical finish markers)
  let mutationObserver = null;
  function hookEndScreen() {
    if (mutationObserver) try { mutationObserver.disconnect(); } catch {}
    mutationObserver = new MutationObserver(checkForEnd);
    mutationObserver.observe(gameArea, { childList: true, subtree: true });
  }

  function checkForEnd() {
    // Expanded heuristic: look for typical end screen containers OR a lone Play Again button.
    const endEl = gameArea.querySelector('[id*="end" i], .game-end-screen, .end-screen, .ending-screen');
    const playAgainBtn = gameArea.querySelector('#playAgainBtn, button[id*="playAgain" i], button');
    // If neither endEl nor a Play Again candidate present, keep waiting.
    if (!endEl && !(playAgainBtn && /play again/i.test(playAgainBtn.textContent || ''))) return;

    const container = endEl || playAgainBtn?.closest('div') || gameArea;

    // Prevent multiple triggers
    if (container && container._faCaptured) return; if (container) container._faCaptured = true;

    let correct = 0, total = 0;
    try {
      const percNode = container.querySelector('[data-correct]');
      if (percNode) {
        correct = Number(percNode.getAttribute('data-correct')) || 0;
        total = Number(percNode.getAttribute('data-total')) || 0;
      }
    } catch {}

    if (!total) {
      // Parse patterns like '7 / 10', 'Score: 7 / 10', 'Correct: 7 of 10'
      const txt = container.textContent || '';
      let m = /(\d+)\s*\/\s*(\d+)/.exec(txt);
      if (!m) m = /Correct\s*:?\s*(\d+)\s*(?:of|\/|out of)\s*(\d+)/i.exec(txt);
      if (m) { correct = Number(m[1]); total = Number(m[2]); }
    }

    if (total) {
      cumulative.rounds.push({ key: currentMode, correct, total });
      cumulative.totalCorrect += correct;
      cumulative.totalQuestions += total;
    }

    if (mutationObserver) try { mutationObserver.disconnect(); } catch {}
    injectRoundControls(correct, total);
    // Re-evaluate prev link visibility after round ends
    ensurePrevLink();
  }

  function injectRoundControls(correct, total) {
    // Locate end panel first
    const endPanel = gameArea.querySelector('[id*="end" i], .game-end-screen, .end-screen, .ending-screen') || gameArea;
    if (!endPanel) return;

    // Fallback: some modes only show a percentage (e.g., "Your Score: 100.0%") without x/y numbers.
    if ((!total || total === 0) && (correct === 0)) {
      try {
        const txt = endPanel.textContent || '';
        const pm = /(\d+(?:\.\d+)?)\s*%/.exec(txt);
        if (pm) {
          const perc = parseFloat(pm[1]);
          if (!isNaN(perc)) {
            total = 100; // treat percent as out of 100
            correct = Math.round(perc); // preserve integer percent
            if (window.__FA_DEBUG) console.debug('[FullArcade] Percent fallback applied', { perc, correct, total });
          }
        }
      } catch {}
    }

    // Hide underlying Play Again to avoid duplicate UX (if present)
    const underlyingReplay = endPanel.querySelector('#playAgainBtn, button');
    if (underlyingReplay && /play again/i.test(underlyingReplay.textContent || '')) underlyingReplay.style.display = 'none';

    const perfect = total && correct === total;
    // Trigger star overlay (defer slightly to allow DOM of end panel to settle)
    try {
      if (typeof window.showRoundStars === 'function') {
        setTimeout(() => { window.showRoundStars({ correct, total }); }, 60);
      } else {
        // Lazy load if not yet present
        import('../ui/star_overlay.js').then(() => {
          if (typeof window.showRoundStars === 'function') window.showRoundStars({ correct, total });
        }).catch(()=>{});
      }
    } catch {}
    // Container bar
    const bar = document.createElement('div');
    bar.style.cssText = 'margin-top:18px;display:flex;flex-wrap:wrap;gap:12px;justify-content:center;';

    if (!perfect) {
      const replayBtn = document.createElement('button');
      replayBtn.textContent = 'Replay Round';
      replayBtn.style.cssText = commonBtnStyle('#6366f1');
      replayBtn.onclick = () => startRound(roundIndex); // restart same round
      bar.appendChild(replayBtn);
    }

    const nextIdx = roundIndex + 1;
    const nextBtn = document.createElement('button');
    nextBtn.textContent = nextIdx < THEMED_SEQUENCE.length ? 'Next Round ➜' : 'Final Summary';
    nextBtn.style.cssText = commonBtnStyle('#0d9488');
    nextBtn.onclick = () => {
      if (nextIdx < THEMED_SEQUENCE.length) startRound(nextIdx); else finalSummary();
    };
    bar.appendChild(nextBtn);

    endPanel.appendChild(bar);
  }

  function finalSummary() {
    hideSkipLink();
    hidePrevLink();
    const pct = cumulative.totalQuestions ? Math.round((cumulative.totalCorrect / cumulative.totalQuestions) * 100) : 0;
    gameArea.innerHTML = `<div style="max-width:560px;margin:40px auto;padding:28px 24px;background:#fff;border:2px solid #cfdbe2;border-radius:20px;font-family:system-ui,sans-serif;text-align:center;">
      <h2 style="margin:0 0 14px;font-size:1.6rem;color:#0f172a;font-weight:800;">Full Arcade Complete</h2>
      <div style="font-size:1.1rem;color:#334155;margin-bottom:14px;">Overall Score: <strong>${cumulative.totalCorrect} / ${cumulative.totalQuestions}</strong> (${pct}%)</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin:12px 0 18px;">
        ${cumulative.rounds.map(r => {
          const rp = r.total ? Math.round((r.correct/r.total)*100) : 0;
          return `<div style=\"font-size:.9rem;color:#475569;\"><strong>${r.key.replace(/_/g,' ')}</strong>: ${r.correct}/${r.total} (${rp}%)</div>`;
        }).join('')}
      </div>
      <div style="display:flex;justify-content:center;gap:14px;flex-wrap:wrap;">
        <button id="fa-restart" style="${commonBtnStyle('#6366f1')}">Restart Full Arcade</button>
        <button id="fa-exit" style="${commonBtnStyle('#0d9488')}">Exit</button>
      </div>
    </div>`;
    const restart = document.getElementById('fa-restart');
    if (restart) restart.onclick = () => {
      cumulative.rounds.length = 0; cumulative.totalCorrect = 0; cumulative.totalQuestions = 0; startRound(0);
    };
    const exitBtn = document.getElementById('fa-exit');
    if (exitBtn) exitBtn.onclick = () => {
      if (context.startGame) context.startGame('matching');
    };
  }

  function commonBtnStyle(color) {
    return [
      'background:'+color,
      'color:#fff','border:none','padding:10px 20px','border-radius:12px','font-weight:700','font-size:14px','cursor:pointer','box-shadow:0 2px 6px rgba(0,0,0,.15)','transition:transform .15s'
    ].join(';');
  }

  // Show a pre-game word list modal once before the first round
  function showWordListModal(onStart, onCancel){
    // Build lightweight overlay
    let overlay = document.getElementById('faWordListOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'faWordListOverlay';
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:9000;';
      document.body.appendChild(overlay);
    }
    const listName = (window.WordArcade && typeof window.WordArcade.getListName === 'function') ? window.WordArcade.getListName() : 'Word List';
    const itemsHtml = (wordList || []).map(w => {
      const eng = (w && (w.eng || w.en || w.word)) || '';
      const kor = (w && (w.kor || w.kr || w.word_kr || w.translation)) || '';
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px dashed #edf1f4;">
        <span style="font-weight:800;color:#19777e;">${String(eng)}</span>
        <span style="color:#6b7a8f;margin-left:8px;">${String(kor)}</span>
      </div>`;
    }).join('');

    overlay.innerHTML = `
      <div role="dialog" aria-label="Word list preview" aria-modal="true" style="background:#fff;border-radius:18px;border:2px solid #67e2e6;box-shadow:0 10px 30px rgba(0,0,0,.25);width:min(720px,92vw);max-height:min(82vh,880px);display:flex;flex-direction:column;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #e6eaef;">
          <div style="font-weight:900;font-size:1.1rem;color:#19777e;">${String(listName)}</div>
          <button id="faWlCloseX" title="Close" style="background:none;border:none;font-size:1.3rem;color:#334155;cursor:pointer;">×</button>
        </div>
        <div style="padding:12px 14px;">
          <div style="font-size:.95rem;color:#334155;margin-bottom:8px;">Review the words before you start:</div>
          <div style="border:1px solid #e6eaef;border-radius:12px;max-height:56vh;overflow:auto;padding:6px 8px;">${itemsHtml}</div>
          <div style="display:flex;justify-content:center;gap:12px;margin-top:12px;">
            <button id="faWlStart" style="${commonBtnStyle('#0d9488')}">Start</button>
          </div>
        </div>
      </div>`;

    function cleanup(){ try { overlay.remove(); } catch{} }
  const startBtn = overlay.querySelector('#faWlStart');
  const closeX = overlay.querySelector('#faWlCloseX');
  if (startBtn) startBtn.onclick = () => { cleanup(); if (onStart) onStart(); };
  if (closeX) closeX.onclick = () => { cleanup(); if (onStart) onStart(); };
  overlay.onclick = (e) => { if (e.target === overlay) { cleanup(); if (onStart) onStart(); } };
  }

  showWordListModal(() => startRound(0), () => {
    // Exit back to mode selector if Cancel
    if (window.WordArcade && typeof window.WordArcade.startModeSelector === 'function') {
      window.WordArcade.startModeSelector();
    } else if (context.startGame) {
      context.startGame('matching');
    }
  });
}

export const run = runFullArcadeMode;

function prettyLabel(key) {
  switch (key) {
    case 'matching': return 'Match (Words)';
    case 'easy_picture': return 'Listen (Audio → Picture)';
    case 'listening_multi_choice': return 'Listen (Audio → Meaning)';
  case 'listening': return 'Listen (Pictures / Korean)';
    case 'multi_choice_eng_to_kor': return 'Read (ENG → KOR)';
    case 'multi_choice_kor_to_eng': return 'Read (KOR → ENG)';
  case 'multi_choice': return 'Read (Mixed)';
  case 'picture_multi_choice': return 'Read (Picture → EN Word)';
    case 'listen_and_spell': return 'Spell (Listen & Type)';
    case 'spelling': return 'Test (KOR → Spell EN)';
    case 'level_up': return 'Level Up (Definition)';
    default: return key.replace(/_/g,' ');
  }
}
