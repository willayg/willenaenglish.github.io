// Time Battle v2: 35s timed round with mixed question types, responsive UI,
// per-letter scoring for spelling, correct/wrong SFX and highlights, replay, and live leaderboard.

import { showLeaderboardModal } from '../ui/leaderboard_modal.js';
import { setupChoiceButtons, splashResult } from '../ui/buttons.js';
import { playSFX } from '../sfx.js';
import { playTTS } from '../tts.js';

function hasCookie(name) {
  return document.cookie.split(';').some(c => c.trim().startsWith(name + '='));
}

async function requireLogin() {
  // Call a protected endpoint to verify cookie (no need to parse body)
  try {
    const res = await fetch('/.netlify/functions/progress_summary?section=kpi', { credentials: 'include', cache: 'no-store' });
    return res.ok;
  } catch { return false; }
}

function makeSessionId() {
  // If launched from a live_game session, prefer that id
  try {
    const url = new URL(location.href);
    const sid = url.searchParams.get('session_id') || url.searchParams.get('id');
    if (sid) return sid;
  } catch {}
  // Otherwise, persist a stable session id in localStorage for this round (cleared on Replay)
  const LS_KEY = 'tbv2:time_battle:session_id';
  try {
    const existing = localStorage.getItem(LS_KEY);
    if (existing) return existing;
  } catch {}
  const gen = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  try { localStorage.setItem(LS_KEY, gen); } catch {}
  return gen;
}

function injectResponsiveStyles() {
  if (document.getElementById('tbStyles')) return;
  const css = `
  .tb-wrap { width:100%; box-sizing:border-box; max-width: var(--tb-container-max, 980px); margin: 24px auto; padding: 18px; border:2px solid #67e2e6; border-radius:16px; background:#fff; font-family: system-ui, Arial, sans-serif; }
  .tb-head { display:flex; align-items:center; justify-content:space-between; margin-bottom: 12px; }
  .tb-title { font-weight: 900; color:#19777e; font-size: clamp(1.2rem, calc(1rem * var(--tb-font-scale, 1.15)), 1.6rem); }
  .tb-meta { display:flex; gap:10px; color:#0f172a; font-weight:800; font-size: clamp(1rem, calc(.95rem * var(--tb-font-scale, 1.15)), 1.2rem); }
  .tb-meta #tbTimer.tb-pulse { animation: tbPulse 500ms ease; }
  @keyframes tbPulse { 0% { transform: scale(1); color:#0f172a; } 40% { transform: scale(1.18); color:#0d9488; } 100% { transform: scale(1); color:#0f172a; } }
  .tb-card { position:relative; width:100%; box-sizing:border-box; border:1px solid #e6eaef; border-radius:14px; padding: clamp(16px, 2.2vw, 28px); text-align:center; min-height: 160px; display:flex; flex-direction:column; gap:14px; align-items:center; justify-content:center; }
  .tb-prompt { font-size: clamp(1.3rem, calc(1.2rem * var(--tb-font-scale, 1.15)), 1.8rem); color:#0f172a; font-weight:900; }
  .tb-choices { display:grid; gap: 14px; width:100%; max-width: 860px; grid-template-columns: repeat(2, minmax(140px, 1fr)); }
  .tb-choices .choice-btn { min-height: var(--tb-choice-min-h, 64px); }
  .tb-spelling { display:flex; flex-direction:column; gap:12px; align-items:center; }
  .tb-spelling[hidden] { display: none !important; }
  .tb-tiles { display:flex; flex-wrap: wrap; gap: 10px 10px; justify-content: center; width: 100%; max-width: 660px; }
  #tbSpellInput { width:min(560px, 86%); font-size: clamp(1.1rem, 2.4vw, 1.6rem); padding: 12px 14px; border-radius: 10px; border:2px solid #93cbcf; font-weight:800; color:#19777e; }
  .tb-btn { background:#19777e; color:#fff; border:none; padding: 10px 16px; border-radius: 10px; font-weight:800; cursor:pointer; }
  .tb-audio-btn { width:44px; height:44px; display:flex; align-items:center; justify-content:center; background:#0d9488; color:#fff; border:2px solid #0b7a71; border-radius:50%; font-weight:900; font-size:1.1rem; cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,.12); }
  .tb-audio-btn[hidden] { display:none !important; }
  .tb-countdown { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.92); border-radius:14px; font-weight:900; color:#19777e; font-size: clamp(1.4rem, 4vw, 2.2rem); }
  .tb-countdown[hidden] { display:none !important; }

  @media (max-width: 768px) {
    .tb-wrap { padding: 12px; }
    .tb-choices { grid-template-columns: repeat(2, minmax(120px, 1fr)); }
  }
  @media (max-width: 480px) {
    :root { --tb-font-scale: 1.0; }
    .tb-choices { grid-template-columns: 1fr; }
    .tb-card { padding: 14px; }
  }
  @media (min-width: 1201px) {
    :root { --tb-font-scale: 1.22; }
    .tb-wrap { max-width: 1024px; }
  }
  `;
  const style = document.createElement('style');
  style.id = 'tbStyles';
  style.textContent = css;
  document.head.appendChild(style);
}

async function fetchLeaderboard(sessionId, round) {
  const u = new URL('/.netlify/functions/timer_score', location.origin);
  u.searchParams.set('session_id', sessionId);
  u.searchParams.set('round', String(round));
  // Request aggregation: best score per user across the session
  u.searchParams.set('best', '1');
  const res = await fetch(u.toString(), { cache: 'no-store' });
  if (!res.ok) return [];
  const json = await res.json();
  return json && json.success && Array.isArray(json.leaderboard) ? json.leaderboard : [];
}

async function submitScore(sessionId, round, score) {
  const res = await fetch('/.netlify/functions/timer_score', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ session_id: sessionId, round, score })
  });
  try { return await res.json(); } catch { return { success: false, error: 'bad_json' }; }
}

export async function runTimeBattleMode(context) {
  const { wordList, gameArea } = context;
  // Force login gate
  const loggedIn = await requireLogin();
  if (!loggedIn) {
    gameArea.innerHTML = `<div style="max-width:640px;margin:40px auto;padding:24px;border:2px solid #93cbcf;border-radius:16px;background:#fff;font-family:system-ui;text-align:center;">
      <h2 style="margin:0 0 10px;color:#0f172a;">Sign in required</h2>
      <p style="margin:0 0 12px;color:#334155;">Time Battle needs your account to post live scores. Please sign in and try again.</p>
      <div><a href="/students/login.html" style="color:#0d9488;font-weight:800;text-decoration:underline;">Go to Login</a></div>
    </div>`;
    return;
  }

  // Game settings
  const durationSec = 35;
  const sessionId = makeSessionId();
  const STORAGE_KEY = `tbv2:${sessionId}:time_battle`;
  // Always start each round at score 0 (no accumulation across rounds)
  let score = 0;
  let idx = 0; // word index pivot
  let round = 1;
  try {
    const u = new URL(location.href);
    const r = Number(u.searchParams.get('round') || '1');
    if (Number.isFinite(r) && r >= 1) round = r;
  } catch {}
  // Use URL-provided round if present; do not persist across sessions

  const words = Array.isArray(wordList) ? wordList.slice() : [];
  if (!words.length) {
    gameArea.innerHTML = '<div style="padding:24px;text-align:center;">No words.</div>';
    return;
  }

  // Shuffle words lightly
  for (let i = words.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [words[i], words[j]] = [words[j], words[i]];
  }

  injectResponsiveStyles();
  gameArea.innerHTML = `
    <div class="tb-wrap">
      <div class="tb-head">
        <div class="tb-title">Time Battle</div>
        <div class="tb-meta">
          <span>Round <strong id="tbRound">${round}</strong></span>
          <span>|</span>
             <span>Score <strong id="tbScore">${score}</strong></span>
          <span>|</span>
          <span id="tbTimer">${durationSec}s</span>
        </div>
      </div>
      <div id="tbCard" class="tb-card">
        <div id="tbPrompt" class="tb-prompt"></div>
  <button id="tbAudioReplay" class="tb-audio-btn" hidden title="Replay audio">▶</button>
        <div id="tbCountdown" class="tb-countdown" hidden>Are you ready?</div>
        <div id="tbChoices" class="tb-choices"></div>
        <div id="tbSpelling" class="tb-spelling" hidden>
          <div id="tbSlotRows"></div>
          <div id="tbTiles" class="tb-tiles"></div>
        </div>
      </div>
    </div>`;
  const promptEl = document.getElementById('tbPrompt');
  const choicesEl = document.getElementById('tbChoices');
  const scoreEl = document.getElementById('tbScore');
  const timerEl = document.getElementById('tbTimer');
  const audioBtn = document.getElementById('tbAudioReplay');
  const countdownEl = document.getElementById('tbCountdown');

  const spellingEl = document.getElementById('tbSpelling');
  const slotRowsEl = document.getElementById('tbSlotRows');
  const tilesEl = document.getElementById('tbTiles');

  const TYPES = ['K2E', 'E2K', 'LISTEN_K', 'SPELL'];
  let nextTypeIndex = 0;
  let lastAudioText = null;

  function saveState() {
    try {
      const data = { score, remaining };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {}
  }
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (typeof obj !== 'object' || obj === null) return null;
      return obj;
    } catch { return null; }
  }

  function updateScore(newScore) {
    score = newScore;
    if (scoreEl) scoreEl.textContent = String(score);
    saveState();
  }

  function nextQuestion() {
    if (!words.length) return;
    const w = words[idx % words.length];
    idx++;
    const eng = (w.eng || w.en || w.word || '').toString();
    const kor = (w.kor || w.kr || w.translation || '').toString();

    // Rotate type; if listening not feasible (no audio), fall back to K2E
    let type = TYPES[nextTypeIndex % TYPES.length];
    nextTypeIndex++;
    if (type === 'LISTEN_K' && !eng) type = 'K2E';
    renderByType(type, { eng, kor });
  }

  function renderByType(type, q) {
    choicesEl.innerHTML = '';
    // Always hide and clear spelling UI unless explicitly rendering spelling
    spellingEl.hidden = true;
    if (slotRowsEl) slotRowsEl.innerHTML = '';
    if (tilesEl) tilesEl.innerHTML = '';
    promptEl.textContent = '';
    // reset audio replay button each question
    if (audioBtn) { audioBtn.hidden = true; audioBtn.onclick = null; audioBtn.textContent = '▶'; }
    lastAudioText = null;
    if (type === 'K2E') {
      // Korean prompt → English choices
      promptEl.textContent = q.kor;
      renderChoices('eng', q.eng);
    } else if (type === 'E2K') {
      // English prompt → Korean choices
      promptEl.textContent = q.eng;
      renderChoices('kor', q.kor);
    } else if (type === 'LISTEN_K') {
      // Play audio of English word; user selects Korean meaning
    if (q.eng) { playTTS(q.eng); lastAudioText = q.eng; }
    if (audioBtn && lastAudioText) { audioBtn.hidden = false; audioBtn.textContent = '▶'; audioBtn.onclick = () => playTTS(lastAudioText); }
      renderChoices('kor', q.kor);
    } else if (type === 'SPELL') {
      // Spelling: custom tiles (no soft keyboard)
      promptEl.textContent = q.kor;
    if (q.eng) { playTTS(q.eng); lastAudioText = q.eng; }
    if (audioBtn && lastAudioText) { audioBtn.hidden = false; audioBtn.textContent = '▶'; audioBtn.onclick = () => playTTS(lastAudioText); }
      spellingEl.hidden = false;
      renderSpellingTiles(q.eng);
    }
  }

  function perLetterScore(ans, correct) {
    const a = (ans || '').toLowerCase();
    const b = (correct || '').toLowerCase();
    const n = Math.min(a.length, b.length);
    let pts = 0;
    for (let i = 0; i < n; i++) if (a[i] === b[i]) pts++;
    return pts;
  }

  function renderSpellingTiles(correctWord) {
    const correct = String(correctWord || '').trim();
    // Build slots layout similar to listen_and_spell
    const words = correct.split(' ');
    const live = !!document.getElementById('gameStage');
    let maxSlotsWidth = 520;
    try { maxSlotsWidth = Math.min(660, Math.max(280, gameArea.clientWidth - 24)); } catch {}
    const slotGap = 8;
    const minSlotSize = 10;
    function maybeSplitLongWord(word, availableWidth) {
      const MIN_WRAP_TRIGGER = 9; const narrow = availableWidth < 380; if (!narrow || word.length < MIN_WRAP_TRIGGER) return [word];
      const mid = Math.ceil(word.length / 2); return [word.slice(0, mid), word.slice(mid)];
    }
    function renderSlotRowsHTML() {
      let segments = [];
      words.forEach(w => { segments.push(...maybeSplitLongWord(w, maxSlotsWidth)); });
      return `<div class="slot-rows-container" style="display:flex;flex-direction:column;align-items:center;">` +
        segments.map(segment => {
          const slotCount = segment.length;
          let slotSize = Math.floor((maxSlotsWidth - slotGap * (slotCount - 1)) / Math.max(1, slotCount));
          if (slotSize < minSlotSize) slotSize = minSlotSize;
          const fontPx = Math.min(30, Math.max(14, Math.round(slotSize * 0.78)));
          return `<div class="slot-row" data-row-len='${slotCount}' style="display:inline-flex;gap:${slotGap}px;margin-bottom:4px;">${segment.split('').map(() => `<div class="slot" style="width:${slotSize}px;height:${slotSize}px;border:2px solid #93cbcf;border-radius:10px;background:#f7fafc;display:flex;align-items:center;justify-content:center;font-size:${fontPx}px;font-weight:800;color:#0f172a;"></div>`).join('')}</div>`;
        }).join('') + '</div>';
    }
    slotRowsEl.innerHTML = renderSlotRowsHTML();
    // Build tiles: letters from the word (without spaces) + 2 distractors
    const tileChars = correct.replace(/ /g, '').split('');
    const tiles = tileChars.map((ch, i) => ({ id: 'b' + i, ch }));
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const inWordSet = new Set(tileChars.map(c => c.toLowerCase()));
    const pool = alphabet.filter(ch => !inWordSet.has(ch));
    for (let i = 0; i < 2 && pool.length; i++) tiles.push({ id: 'd' + i, ch: pool.splice(Math.floor(Math.random() * pool.length), 1)[0] });
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }

    const usedStack = [];
  tilesEl.innerHTML = tiles.map(t => `<button class="choice-btn tile-btn" data-id="${t.id}" data-ch="${t.ch}" style="width:56px;height:56px;border:2px solid #cfdbe2;border-radius:12px;background:#fff;font-size:1.2em;font-weight:800;color:#314249;display:flex;align-items:center;justify-content:center;">${t.ch.toUpperCase()}</button>`).join('');
  // Enable press animations but DO NOT lock or disable other tiles; allow multiple letter inputs
  setupChoiceButtons(tilesEl, { lockOnClick: false, disableOthers: false, minAnswerLatencyMs: 0 });
    let slotEls = Array.from(slotRowsEl.querySelectorAll('.slot'));
    function updateSlots() {
      const letters = usedStack.map(id => {
        const btn = tilesEl.querySelector(`.tile-btn[data-id="${id}"]`);
        return btn ? btn.getAttribute('data-ch') : '';
      });
      slotEls.forEach((el, i) => { el.textContent = letters[i] ? letters[i].toUpperCase() : ''; });
    }
    function completeIfReady() {
      const expected = correct.replace(/ /g, '').length;
      if (usedStack.length !== expected) return;
      const ans = usedStack.map(id => {
        const b = tilesEl.querySelector(`.tile-btn[data-id="${id}"]`);
        return b ? b.getAttribute('data-ch') : '';
      }).join('');
      // Compare against correct with spaces removed so positions align
      const gained = perLetterScore(ans, correct.replace(/ /g, ''));
      if (gained > 0) { playSFX('correct'); } else { playSFX('wrong'); }
      updateScore(score + gained);
      if (gained > 0) { addTime(gained); }
      setTimeout(nextQuestion, 500);
    }
    tilesEl.querySelectorAll('.tile-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        const expected = correct.replace(/ /g, '').length;
        if (usedStack.length >= expected) return; // already full; wait for slot removal
        usedStack.push(id);
        btn.disabled = true; btn.classList.add('selected'); btn.style.display = 'none';
        updateSlots();
        completeIfReady();
      });
    });
    // Allow removing letters by clicking slots
    slotEls.forEach((slotEl, slotIndex) => {
      slotEl.style.cursor = 'pointer'; slotEl.title = 'Tap to remove letter';
      slotEl.addEventListener('click', () => {
        if (slotIndex >= usedStack.length) return;
        const removedId = usedStack.splice(slotIndex, 1)[0];
        const btn = tilesEl.querySelector(`.tile-btn[data-id="${removedId}"]`);
        if (btn) { btn.disabled = false; btn.classList.remove('selected'); btn.style.display = ''; }
        updateSlots();
      });
    });
  }

  function renderChoices(field, target) {
    const pool = words.slice();
    const opts = new Set([target]);
    while (opts.size < Math.min(4, Math.max(2, pool.length))) {
      const cand = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      const v = cand && (field === 'eng' ? (cand.eng || cand.en || cand.word) : (cand.kor || cand.kr || cand.translation));
      if (v && !opts.has(v)) opts.add(v);
    }
    const answers = Array.from(opts).sort(() => Math.random() - 0.5);
    choicesEl.innerHTML = '';
    answers.forEach(val => {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = val;
      if (val === target) btn.setAttribute('data-correct', '1');
      btn.style.minHeight = '64px';
      btn.onclick = () => {
        const correct = (val === target);
        splashResult(btn, correct);
        if (correct) {
          updateScore(score + 1);
          addTime(1);
          playSFX('correct');
        }
        else { playSFX('wrong'); }
        setTimeout(nextQuestion, 600);
      };
      choicesEl.appendChild(btn);
    });
    setupChoiceButtons(gameArea, { minAnswerLatencyMs: 120 });
  }

  let remaining = durationSec;
  let timer = null;

  function addTime(seconds) {
    const inc = Number(seconds) || 0;
    if (inc <= 0) return;
    remaining += inc;
    if (timerEl) {
      timerEl.textContent = remaining + 's';
      // Pulse animation for visual feedback
      timerEl.classList.remove('tb-pulse');
      void timerEl.offsetWidth; // reflow to restart animation
      timerEl.classList.add('tb-pulse');
    }
    saveState();
  }

  // Restore score/time from previous tab refresh for this session
  const restored = loadState();
  if (restored) {
    if (Number.isFinite(restored.score)) updateScore(Number(restored.score));
    if (Number.isFinite(restored.remaining)) { remaining = Number(restored.remaining); if (timerEl) timerEl.textContent = remaining + 's'; }
  } else {
    // Save an initial state so accidental refresh before first answer still restores
    saveState();
  }

  async function runCountdown() {
    if (!countdownEl) return;
    const steps = ['Are you ready?', '3', '2', '1', 'Go!'];
    countdownEl.hidden = false;
    for (let i = 0; i < steps.length; i++) {
      countdownEl.textContent = steps[i];
      // First message slightly longer
      const delay = i === 0 ? 900 : 800;
      await new Promise(r => setTimeout(r, delay));
    }
    countdownEl.hidden = true;
  }

  await runCountdown();
  nextQuestion();
  timer = setInterval(() => {
    remaining--; timerEl.textContent = remaining + 's';
    saveState();
    if (remaining <= 0) {
      clearInterval(timer);
      finish();
    }
  }, 1000);

  async function finish() {
    // Submit and show leaderboard
    await submitScore(sessionId, round, score);
    const initial = await fetchLeaderboard(sessionId, round);
    const modal = showLeaderboardModal({
      title: 'Live Leaderboard',
      entries: initial,
      onReplay: () => {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        try { modal.close(); } catch {}
        gameArea.innerHTML = '';
        runTimeBattleMode(context);
      }
    });
  }
}

export const run = runTimeBattleMode;
