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
  if (!Array.isArray(wordList) || !wordList.length) {
    gameArea.innerHTML = '<div style="padding:30px;text-align:center;">No words available.</div>';
    return;
  }

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
    gameArea.innerHTML = `<div class="arcade-round-intro" style="text-align:center;padding:16px 8px;font-family:system-ui,sans-serif;">
      <h2 style="margin:4px 0 10px;font-size:1.25rem;color:#19777e;font-weight:800;">Round ${i+1} / ${THEMED_SEQUENCE.length}</h2>
      <div style="color:#334155;font-size:.9rem;margin-bottom:8px;">${prettyLabel(modeKey)}</div>
      <div style="font-size:.8rem;color:#64748b;">Loading…</div>
    </div>`;
    ensureSkipLink();
  ensurePrevLink();
    loadMode(modeKey).then(mod => {
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
    const perfect = total && correct === total;
  const endPanel = gameArea.querySelector('[id*="end" i], .game-end-screen, .end-screen, .ending-screen') || gameArea;
  // Hide underlying Play Again to avoid duplicate UX (if present)
  const underlyingReplay = endPanel.querySelector('#playAgainBtn, button');
  if (underlyingReplay && /play again/i.test(underlyingReplay.textContent || '')) underlyingReplay.style.display = 'none';
    if (!endPanel) return;
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

  startRound(0);
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
