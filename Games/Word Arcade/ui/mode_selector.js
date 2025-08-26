import { renderModeButtons, ensureModeButtonStyles } from './buttons.js';
import { getUserId } from '../../../students/records.js';
import { showSampleWordlistModal } from './sample_wordlist_modal.js';

// Mode Selector UI
export async function renderModeSelector({ onModeChosen, onWordsClick }) {
  const container = document.getElementById('gameArea');

  // Show the menu bar
  const menuBar = document.getElementById('menuBar');
  if (menuBar) {
    menuBar.style.display = 'flex';
    // Always show Back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
      backBtn.style.display = '';
      backBtn.onclick = () => {
        if (window.WordArcade && typeof window.WordArcade.startFilePicker === 'function') {
          window.WordArcade.startFilePicker();
        } else {
          // Fallback: soft reload
          location.reload();
        }
      };
    }

    // Wire up navigation
    const wordsBtn = document.getElementById('wordsBtn');
    const modeBtn = document.getElementById('modeBtn');
    if (wordsBtn) {
      wordsBtn.onclick = () => {
        showSampleWordlistModal({
          onChoose: (filename) => {
            if (onWordsClick && filename) onWordsClick(filename);
          }
        });
      };
    }
    if (modeBtn) modeBtn.style.color = '#93cbcf'; // Highlight current section
  }

  // Clear and render title + grouped sections
  container.innerHTML = `<div style="text-align:center;padding:40px 20px;">
    <h2>Choose a Mode</h2>
    <div style="margin:8px auto 0;max-width:900px;">
      <div style="display:flex;align-items:center;justify-content:center;margin:12px 0 8px;">
        <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
        <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Listening</div>
        <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
      </div>
      <div id="modeListenGroup" style="margin-bottom:18px;"></div>
      <div style="display:flex;align-items:center;justify-content:center;margin:12px 0 8px;">
        <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
        <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Reading</div>
        <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
      </div>
      <div id="modeReadGroup" style="margin-bottom:18px;"></div>
      <div style="display:flex;align-items:center;justify-content:center;margin:12px 0 8px;">
        <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
        <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Spelling</div>
        <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
      </div>
      <div id="modeSpellGroup"></div>
    </div>
  </div>`;

  ensureModeButtonStyles();

  // Pre-fetch per-mode best score for this list (if logged in)
  const userId = getUserId && getUserId();
  const listName = (window.WordArcade && typeof window.WordArcade.getListName === 'function') ? window.WordArcade.getListName() : null;
  // bestByMode: mode -> { pct?: number, pts?: number }
  let bestByMode = {};
  if (userId && listName) {
    try {
      const url = new URL('/.netlify/functions/progress_summary', window.location.origin);
      url.searchParams.set('user_id', userId);
      url.searchParams.set('section', 'sessions');
  if (listName) url.searchParams.set('list_name', listName);
  const res = await fetch(url.toString(), { cache: 'no-store' });
      if (res.ok) {
        const sessions = await res.json();
        // Compute best score per mode for this list
        (Array.isArray(sessions) ? sessions : []).forEach(s => {
          if (!s || s.list_name !== listName) return;
          let sum = s.summary; try { if (typeof sum === 'string') sum = JSON.parse(sum); } catch {}
          const key = (s.mode || 'unknown').toString().toLowerCase();
          if (sum && typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) {
            const pct = Math.round((sum.score / sum.total) * 100);
            if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
          } else if (sum && typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) {
            const pct = Math.round((sum.score / sum.max) * 100);
            if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
          } else if (sum && typeof sum.accuracy === 'number') {
            const pct = Math.round((sum.accuracy || 0) * 100);
            if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
          } else if (sum && typeof sum.score === 'number') {
            const pts = Math.round(sum.score);
            if (!(key in bestByMode) || (bestByMode[key].pts ?? -1) < pts) bestByMode[key] = { pts };
          }
        });
      }
    } catch {}
  }
  // Determine if picture modes are available: need at least 4 picturable items (img or emoji)
  const wl = (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [];
  let picturableKeys = new Set();
  if (Array.isArray(wl) && wl.length) {
    // Count items with explicit images
    wl.forEach(w => {
      if (!w) return;
      if (w.img) {
        const key = w.eng ? String(w.eng).toLowerCase() : String(w.img);
        picturableKeys.add(key);
      }
    });
    // If fewer than 4, try to add emoji-based ones
    if (picturableKeys.size < 4) {
      try {
        const resp = await fetch('./emoji-list/emoji-mappings.json');
        if (resp.ok) {
          const mappings = await resp.json();
          const flat = Object.values(mappings).reduce((acc, cat) => Object.assign(acc, cat), {});
          wl.forEach(w => {
            if (!w || !w.eng) return;
            const key = String(w.eng).toLowerCase();
            if (flat[key]) picturableKeys.add(key);
          });
        }
      } catch {}
    }
  }
  const hasPicturable = picturableKeys.size >= 4;

  // Mark perfect (100%), excellent (95%+), and great (90%+) modes for glow
  const getModeClass = (modeId) => {
    const b = bestByMode[modeId?.toLowerCase?.() ?? ''];
    if (b && typeof b.pct === 'number') {
      if (b.pct >= 100) return 'mode-perfect';
      if (b.pct >= 95) return 'mode-excellent';
      if (b.pct >= 90) return 'mode-great';
    }
    return undefined;
  };

  // Grouped items in requested order
  const labelWithBest = (id, svgPath) => {
    const key = id.toLowerCase();
    const best = bestByMode[key];
    let meta = '—';
    let stars = '';
    let pct = null;
    if (best && best.pct != null) {
      pct = best.pct;
      meta = `<span style="font-size:1.5em;font-weight:bold;">${pct}%</span>`;
      if (pct >= 100) stars = '<img src="./assets/Images/icons/star.svg" alt="star" style="width:30px;height:30px;" />'.repeat(3);
      else if (pct >= 95) stars = '<img src="./assets/Images/icons/star.svg" alt="star" style="width:30px;height:30px;" />'.repeat(2);
      else if (pct >= 90) stars = '<img src="./assets/Images/icons/star.svg" alt="star" style="width:30px;height:30px;" />';
    } else if (best && best.pts != null) {
      meta = `<span style="font-size:1.5em;font-weight:bold;">${best.pts} pts</span>`;
    }
    const bar = pct != null ? `<div style='width:90%;height:8px;border-radius:6px;background:#eceff1;margin-top:6px;overflow:hidden;'>
      <div style='height:100%;width:${pct}%;background:linear-gradient(90deg,#93cbcf,#19777e);'></div>
    </div>` : '';
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <div><img src="${svgPath}" alt="${id}" style="width:120px;height:120px;" /></div>
      <span class="mode-meta">${meta}</span>
      <div>${stars}</div>
      ${bar}
    </div>`;
  };

  const listenModes = [
    ...(hasPicturable ? [{ id: 'easy_picture', label: labelWithBest('easy_picture', './assets/Images/icons/picture-listen.svg'), className: getModeClass('easy_picture') }] : []),
    { id: 'listening', label: labelWithBest('listening', './assets/Images/icons/listening-mode.svg'), className: getModeClass('listening') },
  ];
  const readModes = [
    ...(hasPicturable ? [{ id: 'picture', label: labelWithBest('picture', './assets/Images/icons/picture-mode.svg'), className: getModeClass('picture') }] : []),
    { id: 'meaning', label: labelWithBest('meaning', './assets/Images/icons/matching.svg'), className: getModeClass('meaning') },
    { id: 'multi_choice', label: labelWithBest('multi_choice', './assets/Images/icons/multiple-choice.svg'), className: getModeClass('multi_choice') },
  ];
  const spellModes = [
    { id: 'spelling', label: labelWithBest('spelling', './assets/Images/icons/translate-and-spell.svg'), className: getModeClass('spelling') },
    { id: 'listen_and_spell', label: labelWithBest('listen_and_spell', './assets/Images/icons/listen-and-spell.svg'), className: getModeClass('listen_and_spell') },
  ];

  const common = { columns: 2, buttonHeight: '220px', onClick: onModeChosen };
  renderModeButtons(container.querySelector('#modeListenGroup'), listenModes, common);
  renderModeButtons(container.querySelector('#modeReadGroup'), readModes, common);
  renderModeButtons(container.querySelector('#modeSpellGroup'), spellModes, common);
}
