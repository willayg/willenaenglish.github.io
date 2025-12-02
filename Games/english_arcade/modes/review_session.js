// New Review Session Engine
// Flow: selection (5-10 words) -> combined per-word multi-choice + spelling -> summary (no separate fix cycle)
// Logging uses attempt_context = 'review_combo'

import { logAttempt } from '../../../students/records.js';
import { playSFX } from '../sfx.js';

// ---------------- Mastery Tracking (local persistent) --------------------
// Structure in localStorage key 'WA_REVIEW_MASTERY': { word_id: { correct: n, total: n } }
function loadMasteryStore() {
  try { const raw = localStorage.getItem('WA_REVIEW_MASTERY'); if (raw) return JSON.parse(raw) || {}; } catch {}
  return {};
}
function saveMasteryStore(store) { try { localStorage.setItem('WA_REVIEW_MASTERY', JSON.stringify(store)); } catch {} }
const __MASTERY = loadMasteryStore();
function getMastery(wordObj) {
  const id = hashWord(wordObj); const rec = __MASTERY[id];
  if (!rec) return { id, correct:0, total:0, pct:0 };
  const pct = rec.total ? Math.round((rec.correct / rec.total) * 100) : 0;
  return { id, correct:rec.correct, total:rec.total, pct };
}
function recordAttempt(wordObj, isCorrect) {
  const id = hashWord(wordObj);
  const rec = __MASTERY[id] || { correct:0, total:0 };
  rec.total += 1; if (isCorrect) rec.correct += 1; __MASTERY[id] = rec; saveMasteryStore(__MASTERY);
  return getMastery(wordObj);
}
function isMastered(wordObj) { return getMastery(wordObj).pct >= 80; }

function hashWord(w) {
  const eng = (w.eng || w.word || '').toString().trim().toLowerCase();
  const kor = (w.kor || w.word_kr || '').toString().trim().toLowerCase();
  const base = `${eng}|${kor}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < base.length; i++) { h ^= base.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'w_' + (h >>> 0).toString(36);
}

// Selection Modal ---------------------------------------------------------
export function showReviewSelectionModal(words, { min = 5, max = 10, onStart, onCancel } = {}) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
  const modal = document.createElement('div');
  modal.style.cssText = 'width:min(680px,calc(100vw - 40px));max-height:90vh;background:#fff;border-radius:18px;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.25);overflow:hidden;border:2px solid #21b3be';
  const style = document.createElement('style');
  style.textContent = `
    .rvw-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;padding:6px; }
    .rvw-item { position:relative;padding:10px 10px 12px;border:2px solid #d9edef;border-radius:14px;cursor:pointer;display:flex;flex-direction:column;gap:4px;background:#f9fcfd;transition:.18s; }
    .rvw-item:hover { background:#f2fbfc; }
    .rvw-item.selected { border-color:#21b3be;background:#e6f8f9; box-shadow:0 0 0 3px rgba(33,179,190,.20); }
    .rvw-item .eng { font-weight:700;color:#19777e;font-size:15px; }
  .rvw-item .kor { font-size:13px;color:#4a5a63; }
  .rvw-item .pct { font-size:11px;color:#5d7780;font-weight:600; }
  .rvw-item.mastered { opacity:.55; }
    .rvw-item .check { position:absolute;top:6px;right:6px;width:20px;height:20px;border-radius:50%;background:#21b3be;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.6);transition:.18s; }
    .rvw-item.selected .check { opacity:1;transform:scale(1); }
    .rvw-footer { padding:12px 16px;border-top:1px solid #e3ecef;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap; }
    .btn { appearance:none;border:none;border-radius:14px;padding:10px 18px;font-weight:700;font-size:14px;cursor:pointer;display:inline-flex;align-items:center;gap:6px; }
    .btn-primary { background:#19777e;color:#fff; }
    .btn-primary:disabled { background:#9bbfc2;cursor:not-allowed; }
    .btn-ghost { background:#fff;border:1px solid #c3d9dd;color:#19777e; }
    .rvw-header { padding:14px 18px;border-bottom:1px solid #e3ecef;display:flex;align-items:center;justify-content:space-between; }
    .rvw-counter { font-size:13px;color:#34575a;font-weight:600; }
    .rvw-msg { font-size:12px;color:#b34040;font-weight:600;display:none; }
    .rvw-msg.show { display:block; }
  `;
  document.head.appendChild(style);
  modal.innerHTML = `
    <div class="rvw-header" style="gap:10px;">
      <div id=\"rvwTitle\" style=\"font-weight:800;font-size:19px;color:#b34040;\">0 words selected</div>
      <button id="rvwSelClose" class="btn btn-ghost" style="padding:6px 12px;font-size:13px;">Close</button>
    </div>
    <div style="padding:10px 16px 6px;font-size:13px;color:#37595c;line-height:1.4;">
      Choose between ${min} and ${max} words. You may drop below ${min}, but you need at least ${min} to start.
    </div>
    <div id="rvwContainer" style="padding:4px 14px 14px;overflow:auto;flex:1;">
      <div class="rvw-grid"></div>
    </div>
    <div class="rvw-footer">
      <div>
        <span class="rvw-counter" id="rvwCount">Selected: 0 / ${max}</span>
        <div id="rvwErr" class="rvw-msg" style="color:#b34040;">Select ${min}–${max} words.</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="rvwStartBtn" class="btn btn-primary">Start Review</button>
      </div>
    </div>
  `;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const grid = modal.querySelector('.rvw-grid');
  const startBtn = modal.querySelector('#rvwStartBtn');
  const countEl = modal.querySelector('#rvwCount');
  const errEl = modal.querySelector('#rvwErr');
  const closeBtn = modal.querySelector('#rvwSelClose');

  const selected = new Set();
  const minKeep = min;
  const maxKeep = max;

  function update() {
    const n = selected.size;
    countEl.textContent = `Selected: ${n} / ${maxKeep}`;
    const title = modal.querySelector('#rvwTitle');
    if (title) {
      title.textContent = n === 1 ? '1 word selected' : `${n} words selected`;
      title.style.color = n >= minKeep ? '#21b3be' : '#b34040';
    }
    const valid = n >= minKeep && n <= maxKeep;
    if (!valid) errEl.classList.add('show'); else errEl.classList.remove('show');
  }

  // Remove fully mastered (100%) words from the selectable pool
  const filteredWords = (Array.isArray(words)?words:[]).filter(w => w && typeof w === 'object' && (w.eng || w.word) && (w.kor || w.word_kr))
    .filter(w => getMastery(w).pct < 100);
  const enriched = filteredWords.map(w => ({ w, m: getMastery(w) }))
    .sort((a,b)=> a.m.pct === b.m.pct ? 0 : a.m.pct - b.m.pct);
  enriched.forEach((entry, idx) => {
  const w = entry.w; const m = entry.m;
  if (!w || !m) return; // safety
    const id = hashWord(w) + '_' + idx;
    const item = document.createElement('div');
    item.className = 'rvw-item';
    if (m.pct >= 80) item.classList.add('mastered');
    item.setAttribute('role','button');
    item.setAttribute('tabindex','0');
    item.dataset.id = id;
  item.innerHTML = `<div class="eng">${(w.eng||w.word||'')}</div><div class="kor">${(w.kor||w.word_kr||'')}</div><div class="pct">${m.pct}%</div><div class="check">✓</div>`;
    if (idx < minKeep) { selected.add(id); item.classList.add('selected'); }
    const toggle = () => {
      if (selected.has(id)) {
        selected.delete(id); item.classList.remove('selected');
      } else {
        if (selected.size >= maxKeep) {
          errEl.textContent = `Maximum of ${maxKeep} reached.`;
          errEl.classList.add('show');
          setTimeout(()=>{ errEl.classList.remove('show'); errEl.textContent = `Select ${minKeep}–${maxKeep} words.`; }, 1400);
          return;
        }
        selected.add(id); item.classList.add('selected');
      }
      update();
    };
    item.addEventListener('click', toggle);
    item.addEventListener('keydown', (e) => { if (e.key===' '||e.key==='Enter') { e.preventDefault(); toggle(); } });
    if (idx < minKeep && m.pct >= 80) { selected.delete(id); item.classList.remove('selected'); }
    grid.appendChild(item);
    w.__rvwSelId = id; // attach for mapping later
  });
  update();

  startBtn.addEventListener('click', () => {
    const chosen = filteredWords.filter(w => selected.has(w.__rvwSelId));
    if (chosen.length < minKeep || chosen.length > maxKeep) {
      const warn = document.createElement('div');
      warn.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:10001;';
      warn.innerHTML = `<div style=\"background:#fff;padding:28px 30px;border-radius:18px;max-width:360px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.25);border:2px solid #b34040;\">\n        <div style=\"font-weight:800;font-size:20px;color:#b34040;margin-bottom:12px;\">Need More Words</div>\n        <div style=\"font-size:14px;color:#4a5a63;line-height:1.45;margin-bottom:18px;\">Please choose ${minKeep}–${maxKeep} words to start your review.</div>\n        <button id=\"rvwWarnOk\" style=\"background:#b34040;color:#fff;border:none;font-weight:700;border-radius:12px;padding:10px 20px;cursor:pointer;font-size:14px;\">OK</button>\n      </div>`;
      document.body.appendChild(warn);
      warn.querySelector('#rvwWarnOk').addEventListener('click', () => warn.remove());
      return;
    }
    cleanup();
    onStart && onStart(chosen);
  });
  closeBtn.addEventListener('click', () => { cleanup(); onCancel && onCancel(); });

  function cleanup() { try { overlay.remove(); } catch {} setTimeout(()=>{ try { style.remove(); } catch {} }, 10); }
}

// Quiz Engine -------------------------------------------------------------
export function runReviewSession({ words, mount, onFinish }) {
  // words already selected (5-10). We'll run per-word multi-choice then spelling.
  let activeWords = words.filter(w => !isMastered(w));
  if (activeWords.length === 0) { onFinish && onFinish({ aborted:false, incorrect:[], correct:[] }); return; }
  const reviewSessionId = 'rvw_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);
  const perWordState = activeWords.map(w => ({ word: w, mcDone:false, mcCorrect:null, spellDone:false, spellCorrect:null, wid: hashWord(w) }));
  let totalPoints = 0;
  // Removed redo/fix cycle; single pass only
  let index = 0; // index into perWordState
  let subPhase = 'mc'; // 'mc' or 'spell'
  let questionCounter = 0;
  const totalQuestions = perWordState.length * 2;

  mount.innerHTML = '';
  const root = document.createElement('div');
  root.style.cssText = 'width:100%;max-width:1000px;margin:0 auto;padding:10px clamp(8px,3vw,22px);display:flex;flex-direction:column;gap:14px;box-sizing:border-box;';
  mount.appendChild(root);

  const progress = document.createElement('div');
  progress.style.cssText = 'height:10px;background:#e5eef0;border-radius:6px;overflow:hidden;';
  progress.innerHTML = '<div id="rvwProgFill" style="height:100%;width:0%;background:linear-gradient(90deg,#21b3be,#19777e);transition:width .3s;"></div>';
  root.appendChild(progress);

  const content = document.createElement('div');
  root.appendChild(content);

  const footer = document.createElement('div');
  footer.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-top:4px;';
  footer.innerHTML = `<div style="font-size:12px;color:#35575b;" id="rvwQCount"></div><button id="rvwExit" style="background:#fff;border:1px solid #d0e4e7;border-radius:10px;padding:6px 12px;font-size:12px;color:#19777e;cursor:pointer;">Exit</button>`;
  root.appendChild(footer);
  footer.querySelector('#rvwExit').addEventListener('click', () => { if (confirm('Exit review? Progress will be lost.')) { onFinish && onFinish({ aborted:true }); } });

  function updateProgress() {
    const fill = root.querySelector('#rvwProgFill');
    const qCount = root.querySelector('#rvwQCount');
    const pct = Math.round((questionCounter / totalQuestions) * 100);
    if (fill) fill.style.width = pct + '%';
    if (qCount) qCount.textContent = `Question ${questionCounter} / ${totalQuestions}`;
  }

  function next() {
    // Advance internal pointers robustly (handles already-completed words in fix cycle)
    while (index < perWordState.length) {
      const cur = perWordState[index];
      if (subPhase === 'mc') {
        if (!cur.mcDone) break; // need to ask MC for this word
        if (cur.mcDone && !cur.spellDone) { subPhase = 'spell'; break; } // move to spelling for this word
        if (cur.mcDone && cur.spellDone) { index++; continue; } // fully done; skip to next word
      } else if (subPhase === 'spell') {
        if (!cur.spellDone) break; // need to ask spelling
        if (cur.spellDone) { subPhase = 'mc'; index++; continue; } // finished spelling; advance
      }
    }
    if (index >= perWordState.length) {
      // Completed full first cycle; check if all spelling done and MC done
      const allDone = perWordState.every(w => w.mcDone && w.spellDone);
      if (allDone) { return showSummary(); }
      // (Shouldn't happen; by design each word has exactly 2 phases)
    }
    renderQuestion();
  }

  function renderQuestion() {
    questionCounter = perWordState.reduce((acc,w) => acc + (w.mcDone?1:0) + (w.spellDone?1:0), 0) + 1; // about to present new one
    updateProgress();
    const cur = perWordState[index];
    content.innerHTML = '';
    if (subPhase === 'mc') renderMultiChoice(cur); else renderSpelling(cur);
  }

  function log({ cur, is_correct, sub_mode, answer, correct, points=null, partial=false }) {
    try {
      logAttempt({
        session_id: reviewSessionId,
        mode: 'review_' + sub_mode,
        word: cur.word.eng,
        is_correct,
        answer,
        correct_answer: correct,
        points,
        extra: {
          attempt_context: 'review_combo',
          review_session_id: reviewSessionId,
          word_id: cur.wid,
          sub_mode,
          selected_total: perWordState.length,
          first_cycle: true,
          redo: false,
          partial_credit: partial || false
        }
      });
    } catch {}
  }

  function renderMultiChoice(cur) {
    // Build distractors preferring unique Korean translations to avoid duplicate answer buttons
    const others = perWordState.filter(p => p.word !== cur.word).map(p => p.word);
    const shuffled = shuffle(others);
    const seenKor = new Set([cur.word.kor]);
    const distractors = [];
    for (const w of shuffled) {
      if (distractors.length >= 3) break;
      const kor = w.kor || w.word_kr || '';
      if (!kor) continue;
      if (seenKor.has(kor)) continue; // enforce uniqueness first pass
      seenKor.add(kor);
      distractors.push(w);
    }
    // If we did not get 3 unique, allow duplicates as fallback so we still have 4 buttons
    if (distractors.length < 3) {
      for (const w of shuffled) {
        if (distractors.length >= 3) break;
        if (w === cur.word) continue;
        if (!distractors.includes(w)) distractors.push(w);
      }
    }
    const options = shuffle([cur.word, ...distractors]);
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div style="font-weight:700;color:#19777e;font-size:20px;margin:4px 0 14px;">${cur.word.eng}</div>`;
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px;';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'rvw-mc-btn';
      btn.style.cssText = 'background:#fff;border:2px solid #d4e7ea;padding:14px 10px;border-radius:14px;font-size:15px;font-weight:600;color:#35575b;cursor:pointer;transition:.18s;';
      btn.textContent = opt.kor;
      btn.addEventListener('click', () => {
        const correct = opt === cur.word;
        cur.mcDone = true; cur.mcCorrect = !!correct;
        let pts = 0;
        if (correct) { pts = 3; totalPoints += pts; playSFX('correct'); }
        else { playSFX('wrong'); }
        log({ cur, is_correct: correct, sub_mode: 'multi', answer: opt.kor, correct: cur.word.kor, points: pts });
        recordAttempt(cur.word, correct);
        btn.style.borderColor = correct ? '#27b87f' : '#d94a48';
        if (pts) showPointBurst(btn, '+' + pts);
        setTimeout(()=> { subPhase = 'spell'; pruneMasteredAndMaybeFinish(); next(); }, 360);
      });
      btn.addEventListener('mouseenter', () => { btn.style.borderColor = '#21b3be'; });
      btn.addEventListener('mouseleave', () => { btn.style.borderColor = '#d4e7ea'; });
      grid.appendChild(btn);
    });
    wrap.appendChild(grid);
    content.appendChild(wrap);
  }

  function renderSpelling(cur) {
    const answerOriginal = cur.word.eng.trim();
    const clean = answerOriginal.replace(/ /g,'').toLowerCase();
    const letters = clean.split('');
    const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
    const pool = alphabet.filter(ch => !letters.includes(ch));
    const distractors = [];
    while (distractors.length < 2 && pool.length) distractors.push(pool.splice(Math.floor(Math.random()*pool.length),1)[0]);
    const tiles = letters.map((ch,i)=>({ id:'b'+i, ch }))
      .concat(distractors.map((ch,i)=>({ id:'d'+i, ch })))
      .sort(()=>Math.random()-0.5);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'width:100%;max-width:760px;margin:0 auto;display:flex;flex-direction:column;align-items:center;';
    wrap.innerHTML = `<div style="font-weight:700;color:#19777e;font-size:clamp(18px,2.3vw,28px);margin:4px 0 14px;text-align:center;">${cur.word.kor}</div>`;

    // Build multi-line slot rows: one centered row per word segment
    const phraseWords = answerOriginal.split(/\s+/).filter(Boolean);
    const slotEls = []; // flattened for logic
    const rowsWrap = document.createElement('div');
    rowsWrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;margin:4px 0 18px;width:100%;align-items:center;';

    function buildRow(wordIdx, wordStr) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:nowrap;';
      const wLetters = wordStr.toLowerCase().split('');
      // sizing based on per-word length
      const MAX_SLOT_W = 54, MIN_SLOT_W = 32, MAX_SLOT_H = 54, MIN_SLOT_H = 26;
      let available = wrap.clientWidth || 760; // may be 0 pre-mount
      const gapTotal = (wLetters.length - 1) * 8;
      const maxWidthAllowed = Math.max(320, available - 80);
      let slotW = Math.min(MAX_SLOT_W, Math.floor((maxWidthAllowed - gapTotal) / wLetters.length));
      slotW = Math.max(MIN_SLOT_W, Math.min(MAX_SLOT_W, slotW));
      let slotH = slotW >= 46 ? MAX_SLOT_H : Math.max(MIN_SLOT_H, Math.round(MAX_SLOT_H * (0.65 + 0.35 * (slotW / MAX_SLOT_W))));
      const fontSize = Math.max(16, Math.round(slotH * 0.55));
      wLetters.forEach(() => {
        const d = document.createElement('div');
        d.style.cssText = `width:${slotW}px;height:${slotH}px;border:3px solid #93cbcf;border-radius:14px;background:#f7fafc;font-weight:800;font-size:${fontSize}px;display:flex;align-items:center;justify-content:center;transition:background .15s;cursor:pointer;`;
        row.appendChild(d); slotEls.push(d);
      });
      return row;
    }
    phraseWords.forEach((pw,i)=> rowsWrap.appendChild(buildRow(i,pw)) );
    wrap.appendChild(rowsWrap);

    const tileBox = document.createElement('div');
    tileBox.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;justify-content:center;max-width:640px;margin:0 auto 4px;';
    const tileButtonMap = new Map();
    // Determine a base tile size from average row slot size (use first slot if exists)
    const firstSlot = () => slotEls.find(s=>s); // may be undefined
    let baseTileSize = 50;
    if (firstSlot()) {
      try { baseTileSize = parseInt(firstSlot().style.width) || 50; } catch {}
    }
    tiles.forEach(t => {
      const b = document.createElement('button');
      b.textContent = t.ch.toUpperCase();
      b.dataset.id = t.id; b.dataset.ch = t.ch;
      b.style.cssText = `width:${baseTileSize}px;height:${baseTileSize}px;border:3px solid #cfdbe2;border-radius:14px;background:#fff;font-size:${Math.max(18, Math.round(baseTileSize*0.40))}px;font-weight:800;color:#314249;cursor:pointer;transition:transform .15s,border-color .15s;`;
      b.addEventListener('mouseenter',()=>{ if(!b.disabled) b.style.borderColor='#21b3be'; });
      b.addEventListener('mouseleave',()=>{ if(!b.disabled) b.style.borderColor='#cfdbe2'; });
      b.addEventListener('click', () => {
        if (b.disabled) return;
        const nextEmpty = slotEls.find(s=>!s.textContent);
        if (!nextEmpty) return;
        nextEmpty.textContent = t.ch.toUpperCase();
        b.disabled = true; b.style.visibility='hidden';
        checkComplete();
      });
      tileBox.appendChild(b);
      tileButtonMap.set(t.id, b);
    });

    // Enable removing letters by clicking a filled slot
    slotEls.forEach(slot => {
      slot.addEventListener('click', () => {
        if (!slot.textContent) return;
        const letter = slot.textContent.toLowerCase();
        for (const btn of tileButtonMap.values()) {
          if (btn.disabled && btn.dataset.ch === letter) {
            btn.disabled = false; btn.style.visibility='';
            slot.textContent='';
            break;
          }
        }
      });
    });

    const feedback = document.createElement('div');
    feedback.style.cssText='min-height:30px;text-align:center;font-weight:600;font-size:14px;color:#444;margin-top:6px;';
    wrap.appendChild(tileBox); wrap.appendChild(feedback); content.appendChild(wrap);

    // Post-mount resize adjustments per row
    const adjustRows = () => {
      const available = wrap.clientWidth || 760;
      const rows = [...rowsWrap.children];
      rows.forEach(row => {
        const slotsInRow = [...row.children];
        if (!slotsInRow.length) return;
        const gapTotal = (slotsInRow.length - 1) * 8;
        const maxWidthAllowed = Math.max(320, available - 80);
        const totalCurrent = slotsInRow.reduce((a,s)=> a + (parseInt(s.style.width)||54),0) + gapTotal;
        if (totalCurrent > maxWidthAllowed) {
          let slotW = Math.max(32, Math.floor((maxWidthAllowed - gapTotal)/slotsInRow.length));
          let slotH = slotW >= 46 ? 54 : Math.max(26, Math.round(54 * (0.65 + 0.35 * (slotW / 54))));
          const fontSize = Math.max(16, Math.round(slotH * 0.55));
            slotsInRow.forEach(s => { s.style.width=slotW+'px'; s.style.height=slotH+'px'; s.style.fontSize=fontSize+'px'; });
        }
      });
      // adjust tile size to match first slot width
      const first = slotEls.find(s=>s.style && s.style.width);
      if (first) {
        const size = parseInt(first.style.width) || 50;
        [...tileBox.children].forEach(btn => { btn.style.width=size+'px'; btn.style.height=size+'px'; btn.style.fontSize=Math.max(16, Math.round(size*0.40))+'px'; });
      }
    };
    requestAnimationFrame(adjustRows);
    const ro = new ResizeObserver(()=>adjustRows());
    ro.observe(wrap);

    function checkComplete() {
      if (slotEls.some(s=>!s.textContent)) return;
      const built = slotEls.map(s=>s.textContent.toLowerCase()).join('');
      const correct = built === clean;
      const dist = correct ? 0 : levenshtein(built, clean);
      const near = !correct && dist > 0 && dist <= 2 && clean.length >= 4;
      cur.spellDone = true; cur.spellCorrect = correct;
      let pts = 0; let partial = false;
      if (correct) { pts = 6; totalPoints += pts; playSFX('correct'); }
      else if (near) { pts = 3; partial = true; totalPoints += pts; playSFX('kindaRight'); }
      else { playSFX('wrong'); }
      log({ cur, is_correct: correct, sub_mode: 'spell', answer: built, correct: cur.word.eng, points: pts, partial });
      recordAttempt(cur.word, correct);
      feedback.textContent = correct ? `Correct! +${pts}` : near ? `Close! +${pts}` : `Incorrect – ${cur.word.eng}`;
      feedback.style.color = correct ? '#1b8a62' : near ? '#f59e0b' : '#c4413f';
      if (pts) showPointBurst(feedback, '+' + pts);
      setTimeout(()=> { subPhase = 'mc'; index++; pruneMasteredAndMaybeFinish(); next(); }, 700);
    }
  }

  function showSummary() {
    questionCounter = totalQuestions; updateProgress();
    const incorrect = perWordState.filter(w => !(w.mcCorrect && w.spellCorrect) && !isMastered(w.word));
    const correctList = perWordState.filter(w => (w.mcCorrect && w.spellCorrect) || isMastered(w.word));
    content.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h3 style="margin:4px 0 12px;color:#19777e;font-size:24px;">Review Summary</h3>`;
    const stats = document.createElement('div');
    stats.style.cssText = 'display:flex;flex-wrap:wrap;gap:24px;margin-bottom:16px;';
    stats.innerHTML = `<div style="font-weight:700;color:#1d6b70;">Perfect: ${correctList.length}</div><div style="font-weight:700;color:#b54848;">Not Mastered: ${incorrect.length}</div>`;
    wrap.appendChild(stats);
    const listsWrap = document.createElement('div');
    listsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:28px;width:100%;';
    const mkList = (arr, title, good) => {
      const box = document.createElement('div');
      box.style.cssText = 'flex:1 1 240px;min-width:240px;';
      box.innerHTML = `<div style="font-weight:700;color:${good?'#1d6b70':'#b54848'};margin-bottom:6px;">${title}</div>` +
        `<div style="border:1px solid #d9e7ea;border-radius:12px;padding:8px 10px;background:#f9fcfd;max-height:220px;overflow:auto;">` +
        (arr.length?arr.map(w=>`<div style='padding:4px 2px;font-size:14px;color:#234f54;font-weight:600;'>${w.word.eng} <span style='color:#5a7378;font-weight:500;'>${w.word.kor}</span></div>`).join(''):'<div style="font-size:12px;color:#6a8488;">None</div>') + '</div>';
      return box;
    };
    listsWrap.appendChild(mkList(correctList,'Correct',true));
    listsWrap.appendChild(mkList(incorrect,'Still Learning',false));
    wrap.appendChild(listsWrap);
    const btns = document.createElement('div');
    btns.style.cssText = 'margin-top:20px;display:flex;gap:14px;flex-wrap:wrap;';
    const done = document.createElement('button');
    done.textContent = 'Done';
    done.style.cssText = 'background:#19777e;color:#fff;font-weight:700;border:none;border-radius:14px;padding:12px 22px;font-size:16px;cursor:pointer;';
    done.addEventListener('click', () => { onFinish && onFinish({ aborted:false, incorrect: incorrect.map(w=>w.word), correct: correctList.map(w=>w.word) }); });
    btns.appendChild(done);
    wrap.appendChild(btns);
    content.appendChild(wrap);
  }

  function pruneMasteredAndMaybeFinish() {
    const stillProgressing = perWordState.some(w => (!w.mcDone || !w.spellDone) && !isMastered(w.word));
    if (!stillProgressing) { showSummary(); }
  }

  function shuffle(arr) { return arr.map(v => [Math.random(), v]).sort((a,b)=>a[0]-b[0]).map(p=>p[1]); }

  // Small floating point gain indicator
  function showPointBurst(anchorEl, text) {
    try {
      const rect = anchorEl.getBoundingClientRect();
      const el = document.createElement('div');
      el.textContent = text;
      // Enlarged visual for point burst
      el.style.cssText = 'position:fixed;left:'+(rect.left + rect.width/2)+'px;top:'+(rect.top - 10)+'px;transform:translate(-50%,0);background:rgba(25,119,126,0.92);color:#fff;font-size:18px;padding:8px 14px;border-radius:26px;font-weight:900;letter-spacing:0.3px;pointer-events:none;z-index:9999;opacity:1;transition:all .9s ease;box-shadow:0 8px 24px rgba(0,0,0,.18);';
      document.body.appendChild(el);
      // Float farther and fade a touch slower for emphasis
      requestAnimationFrame(()=>{ el.style.top = (rect.top - 60)+'px'; el.style.opacity='0'; });
      setTimeout(()=>{ el.remove(); }, 950);
    } catch {}
  }

  // Basic Levenshtein distance for partial credit
  function levenshtein(a,b){
    if(a===b) return 0; if(!a) return b.length; if(!b) return a.length;
    const dp = Array(b.length+1).fill(0).map((_,i)=>i);
    for(let i=0;i<a.length;i++){
      let prev = dp[0]; dp[0]=i+1;
      for(let j=0;j<b.length;j++){
        const tmp = dp[j+1];
        if(a[i]===b[j]) dp[j+1]=prev; else dp[j+1]=Math.min(prev+1, dp[j+1]+1, dp[j]+1);
        prev = tmp;
      }
    }
    return dp[b.length];
  }

  next();
}
