// Full Arcade Mode: orchestrates all six standard Word Arcade rounds in sequence.
// Rounds list order (adjust if your project uses different canonical order):
// 1. multi_choice_eng_to_kor
// 2. multi_choice_kor_to_eng
// 3. picture_multi_choice
// 4. easy_picture (or listening_multi_choice if you prefer)
// 5. spelling (or listen_and_spell)
// 6. matching (definitions / meaning)

// The orchestrator wraps each underlying mode, listens for its normal end screen,
// injects Next / Replay buttons, and maintains cumulative stats.

import { loadMode } from '../core/mode-registry.js';

const ROUND_SEQUENCE = [
  'multi_choice_eng_to_kor',
  'multi_choice_kor_to_eng',
  'picture_multi_choice',
  'easy_picture',
  'spelling',
  'matching'
];

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

  function startRound(i) {
    roundIndex = i;
    const modeKey = ROUND_SEQUENCE[i];
    if (!modeKey) return finalSummary();
    // Clear area & show lightweight round header
    gameArea.innerHTML = `<div class="arcade-round-intro" style="text-align:center;padding:16px 8px;font-family:system-ui,sans-serif;">
      <h2 style="margin:4px 0 10px;font-size:1.25rem;color:#19777e;font-weight:800;">Round ${i+1} / ${ROUND_SEQUENCE.length}</h2>
      <div style="color:#334155;font-size:.9rem;margin-bottom:8px;">${modeKey.replace(/_/g,' ')}</div>
      <div style="font-size:.8rem;color:#64748b;">Loading…</div>
    </div>`;
    loadMode(modeKey).then(mod => {
      currentMode = modeKey;
      // Run underlying mode with same context; pass through wordList (can be filtered per round later)
      mod.run({ ...context, wordList, gameArea });
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
    nextBtn.textContent = nextIdx < ROUND_SEQUENCE.length ? 'Next Round ➜' : 'Final Summary';
    nextBtn.style.cssText = commonBtnStyle('#0d9488');
    nextBtn.onclick = () => {
      if (nextIdx < ROUND_SEQUENCE.length) startRound(nextIdx); else finalSummary();
    };
    bar.appendChild(nextBtn);

    endPanel.appendChild(bar);
  }

  function finalSummary() {
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
      if (context.startGame) context.startGame('multi_choice_eng_to_kor');
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
