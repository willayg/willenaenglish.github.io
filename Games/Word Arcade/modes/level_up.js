import { playSFX } from '../sfx.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { startSession, logAttempt, endSession } from '../../../students/records.js';
import { showGameProgress, updateGameProgress, hideGameProgress } from '../main.js';

// Level Up: show the word; student chooses the correct definition/gloss
// Assumptions:
// - Prefer item.def/definition/gloss if present
// - Fallback to Korean translation (kor) as the “definition” text when needed
export async function runLevelUpMode({ wordList, gameArea, startGame, listName = null }) {
  const isReview = (listName === 'Review List') || ((window.WordArcade?.getListName?.() || '') === 'Review List');

  // Simple localStorage cache helpers
  const cacheKey = (w) => `levelup:def:v1:${(w || '').toLowerCase()}`;
  const getCached = (w) => {
    try { const raw = localStorage.getItem(cacheKey(w)); if (!raw) return null; const js = JSON.parse(raw); return Array.isArray(js?.defs) && js.defs.length ? js.defs : null; } catch { return null; }
  };
  const setCached = (w, defs) => { try { localStorage.setItem(cacheKey(w), JSON.stringify({ t: Date.now(), defs })); } catch {}
  };

  // Resolve a single word's definition list using Netlify function
  async function fetchDefsFromFunction(word) {
    try {
      const url = new URL('/.netlify/functions/define_word?word=' + encodeURIComponent(word), window.location.origin);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) return [];
      const js = await res.json();
      return Array.isArray(js?.defs) ? js.defs : [];
    } catch { return []; }
  }
  async function fetchDefsFromPublic(word) {
    try {
      const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return [];
      const arr = await res.json();
      const out = [];
      if (Array.isArray(arr)) {
        for (const entry of arr) {
          const meanings = entry?.meanings || [];
          for (const m of meanings) {
            const defs = m?.definitions || [];
            for (const d of defs) {
              const t = String(d?.definition || '').trim();
              if (t) out.push(t);
            }
          }
        }
      }
      // de-dupe, first 5
      const seen = new Set();
      const uniq = [];
      for (const d of out) { if (!seen.has(d)) { seen.add(d); uniq.push(d); } }
      return uniq.slice(0, 5);
    } catch { return []; }
  }
  async function fetchDefs(word) {
    // Try Netlify function first, then public API
    const fromFn = await fetchDefsFromFunction(word);
    if (fromFn && fromFn.length) return fromFn;
    return await fetchDefsFromPublic(word);
  }

  // Build base set with primary (Supabase/file) definitions when present
  let enriched = (wordList || []).map(w => {
    const def = w.def || w.definition || w.gloss || w.meaning || w.kor || '';
    return { ...w, _def: String(def || '').trim() };
  }).filter(w => w.eng);

  // Collect words missing definitions and try cache/network
  const missing = enriched.filter(w => !w._def);
  if (missing.length) {
    // Prefetch step UI (lightweight)
    gameArea.innerHTML = `<div style="padding:36px;text-align:center;color:#19777e;">
      <div style="font-size:1.2em;font-weight:700;">Looking up definitions…</div>
      <div id="lvlupLookupProgress" style="margin-top:10px;color:#666;">0 / ${missing.length}</div>
    </div>`;
    let done = 0;
    for (const m of missing) {
      let defs = getCached(m.eng) || [];
      if (!defs || !defs.length) {
        try { defs = await fetchDefs(m.eng); } catch {}
        if (defs && defs.length) setCached(m.eng, defs);
      }
      if (defs && defs.length && !m._def) m._def = String(defs[0]).trim();
      done++;
      const p = document.getElementById('lvlupLookupProgress');
      if (p) p.textContent = `${done} / ${missing.length}`;
    }
  }

  // Filter to those that now have definitions
  const ordered = enriched.filter(w => w._def && w._def.length > 1).sort(() => Math.random() - 0.5);
  if (!ordered.length) {
    gameArea.innerHTML = '<div style="padding:40px;text-align:center;color:#888;font-size:1.1em;">No definitions available for this list.</div>';
    return;
  }
  let score = 0;
  let idx = 0;
  const sessionId = startSession({ mode: 'level_up', wordList: ordered.map(({ _def, ...rest }) => rest), listName });

  // Intro
  gameArea.innerHTML = `
    <div id="lvlUpIntro" style="display:flex;align-items:center;justify-content:center;width:90vw;height:40vh;opacity:1;transition:opacity .6s ease;">
      <div style="font-size:clamp(1.2rem,5vw,3.5rem);font-weight:800;color:#19777e;text-align:center;width:90%;">
        Level Up
        <div style="font-size:clamp(0.9rem,3.5vw,1.4rem);font-weight:600;color:#248b86ff;margin-top:8px;">Read the definition and pick the word</div>
      </div>
    </div>`;
  setTimeout(() => {
    const intro = document.getElementById('lvlUpIntro');
    if (intro) intro.style.opacity = '0';
    setTimeout(() => { showGameProgress(ordered.length, 0); renderQ(); }, 650);
  }, 800);

  function pickN(pool, n, exclude = new Set()) {
    const out = [];
    const arr = pool.filter(x => !exclude.has(x));
    while (out.length < n && arr.length) {
      const i = Math.floor(Math.random() * arr.length);
      out.push(arr.splice(i, 1)[0]);
    }
    return out;
  }

  function renderQ() {
    if (idx >= ordered.length) {
      playSFX('end');
      endSession(sessionId, { mode: 'level_up', summary: { score, total: ordered.length } });
      hideGameProgress();
      gameArea.innerHTML = `<div style="padding:40px;text-align:center;">
        <h2 style="color:#41b6beff;">Level Up Complete!</h2>
        ${isReview ? '' : `<div style=\"font-size:1.2em;margin-bottom:12px;\">Score: <span style=\"color:#19777e;font-weight:700;\">${score} / ${ordered.length}</span></div>`}
        <button id="playAgainLevelUp" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
        <button id="tryMoreLevelUp" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;">Try More</button>
      </div>`;
      const again = document.getElementById('playAgainLevelUp');
      if (again) again.onclick = () => startGame('level_up');
      const more = document.getElementById('tryMoreLevelUp');
      if (more) more.onclick = () => {
        if (window.WordArcade?.startModeSelector) window.WordArcade.startModeSelector();
        else startGame('level_up', { shuffle: true });
      };
      return;
    }

    const current = ordered[idx];
    // Build 4 options: words (English) for a given definition
    const otherWords = ordered.filter(w => w !== current).map(w => w.eng);
    const options = [current.eng, ...pickN(otherWords, 3)].sort(() => Math.random() - 0.5);

    gameArea.innerHTML = `
      <div style="padding:22px;text-align:center;max-width:720px;margin:0 auto;">
        <div style="font-size:clamp(0.95em,2.6vw,1.1em);color:#555;margin-bottom:10px;">Choose the word that matches the definition</div>
        <div style="font-size:clamp(1.1em,2.8vw,1.5em);color:#19777e;margin:0 auto 16px auto;max-width:680px;line-height:1.5;background:#f0fbfc;border-radius:12px;padding:12px 16px;">${current._def}</div>
        <div id="lvlUpChoices" style="display:grid;grid-template-columns:repeat(2, minmax(120px, 1fr));gap:16px;max-width:520px;margin:0 auto 12px auto;">
          ${options.map(txt => `
            <button class="lvlup-choice choice-btn" data-eng="${String(txt).replaceAll('"','&quot;')}">${txt}</button>
          `).join('')}
        </div>
        <div id="lvlUpFeedback" style="margin-top:8px;font-size:1.1em;height:24px;color:#555;"></div>
        <div id="lvlUpScore" style="margin-top:6px;text-align:center;font-size:1.2em;font-weight:700;color:#19777e;">${isReview ? '' : `Score: ${score}`}</div>
      </div>`;

    document.querySelectorAll('#lvlUpChoices .choice-btn').forEach(btn => { btn.style.height = '15vh'; });
    setupChoiceButtons(gameArea);
    document.querySelectorAll('#lvlUpChoices .lvlup-choice').forEach(btn => {
      btn.onclick = () => {
        const picked = btn.getAttribute('data-eng');
        const correct = picked === current.eng;
        splashResult(btn, correct);
        const fb = document.getElementById('lvlUpFeedback');
        if (correct) { score++; playSFX('correct'); if (fb) { fb.textContent = 'Correct!'; fb.style.color = '#19777e'; } }
        else { playSFX('wrong'); if (fb) { fb.textContent = `It was: ${current.eng}`; fb.style.color = '#e53e3e'; } }
        logAttempt({
          session_id: sessionId,
          mode: 'level_up',
          word: current._def,
          is_correct: correct,
          answer: picked,
          correct_answer: current.eng,
          points: correct ? (isReview ? 2 : 1) : 0,
          attempt_index: idx + 1,
          extra: { eng: current.eng, kor: current.kor }
        });
        setTimeout(() => { idx++; updateGameProgress(idx, ordered.length); renderQ(); }, 900);
      };
    });
  }
}

export default runLevelUpMode;