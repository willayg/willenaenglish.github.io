// Mode Modal UI
import { renderModeButtons, ensureModeButtonStyles } from './buttons.js';
import { getUserId } from '../../../students/records.js';

export async function showModeModal({ onModeChosen, onClose }) {
  let modal = document.getElementById('modeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modeModal';
    modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1000;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#fff;padding:18px 12px;border-radius:18px;box-shadow:0 4px 24px rgba(60,60,80,0.18);min-width:240px;max-width:420px;max-height:80vh;overflow-y:auto;position:relative;">
      <button id="closeModeModalX" title="Close" style="position:absolute;top:8px;right:10px;font-size:1.3em;background:none;border:none;color:#19777e;cursor:pointer;line-height:1;width:28px;height:28px;z-index:2;">&times;</button>
      <div style="text-align:center;">
        <h2 style="margin-bottom:18px;color:#19777e;">Choose a Mode</h2>
      </div>
      <div style="margin-bottom:8px;margin-top:2px;">
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
          <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
          <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Listening</div>
          <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
        </div>
        <div id="modeModalListenGroup" style="margin-bottom:18px;"></div>
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
          <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
          <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Reading</div>
          <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
        </div>
        <div id="modeModalReadGroup" style="margin-bottom:18px;"></div>
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
          <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
          <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Spelling</div>
          <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
        </div>
        <div id="modeModalSpellGroup" style="margin-bottom:0px;"></div>
      </div>
      <div style="text-align:center;margin-top:18px;">
        <button id="closeModeModal" style="font-size:1em;padding:8px 22px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
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
  // Decide availability for picture modes: require at least 4 picturable items (img or emoji)
  const wl = (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [];
  let picturableKeys = new Set();
  if (Array.isArray(wl) && wl.length) {
    wl.forEach(w => {
      if (!w) return;
      if (w.img) {
        const key = w.eng ? String(w.eng).toLowerCase() : String(w.img);
        picturableKeys.add(key);
      }
    });
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

  // Helper for SVG icon paths
  const modeIcons = {
    easy_picture: './assets/Images/icons/picture-listen.svg',
    listening: './assets/Images/icons/listening-mode.svg',
    picture: './assets/Images/icons/picture-mode.svg',
    meaning: './assets/Images/icons/matching.svg',
    multi_choice: './assets/Images/icons/multiple-choice.svg',
    spelling: './assets/Images/icons/translate-and-spell.svg',
    listen_and_spell: './assets/Images/icons/listen-and-spell.svg',
  };

  // Map best pct to a CSS class for glow styling
  const getModeClass = (modeId) => {
    const key = String(modeId || '').toLowerCase();
    const best = bestByMode[key];
    const pct = best && typeof best.pct === 'number' ? best.pct : null;
    if (pct == null) return '';
    if (pct >= 100) return 'mode-perfect';
    if (pct >= 95) return 'mode-excellent';
    if (pct >= 90) return 'mode-great';
    return '';
  };

  // Improved label with SVG icon and percent/stars
  const labelWithBest = (id, label) => {
    const key = id.toLowerCase();
    const best = bestByMode[key];
    let meta = '—';
    let stars = '';
    let pct = null;
    if (best && best.pct != null) {
      pct = best.pct;
      meta = `<span style='font-size:1.2em;font-weight:bold;'>${pct}%</span>`;
      if (pct >= 100) stars = '<img src="./assets/Images/icons/star.svg" alt="star" style="width:22px;height:22px;" />'.repeat(3);
      else if (pct >= 95) stars = '<img src="./assets/Images/icons/star.svg" alt="star" style="width:22px;height:22px;" />'.repeat(2);
      else if (pct >= 90) stars = '<img src="./assets/Images/icons/star.svg" alt="star" style="width:22px;height:22px;" />';
    } else if (best && best.pts != null) {
      meta = `<span style='font-size:1.2em;font-weight:bold;'>${best.pts} pts</span>`;
    }
    const bar = pct != null ? `<div style='width:80%;height:6px;border-radius:6px;background:#eceff1;margin-top:6px;overflow:hidden;'>
      <div style='height:100%;width:${pct}%;background:linear-gradient(90deg,#93cbcf,#19777e);'></div>
    </div>` : '';
    return `<div style='display:flex;flex-direction:column;align-items:center;justify-content:center;'>
      <div><img src='${modeIcons[id] || ''}' alt='${label}' style='width:60px;height:60px;'/></div>
      <div style='display:flex;align-items:center;gap:8px;'>${meta}${stars}</div>
      ${bar}
    </div>`;
  };

  const listenModes = [
    ...(hasPicturable ? [{ id: 'easy_picture', label: labelWithBest('easy_picture','Picture Listen'), className: getModeClass('easy_picture') }] : []),
    { id: 'listening', label: labelWithBest('listening','Listening Mode'), className: getModeClass('listening') },
  ];
  const readModes = [
    ...(hasPicturable ? [{ id: 'picture', label: labelWithBest('picture','Picture Mode'), className: getModeClass('picture') }] : []),
    { id: 'meaning', label: labelWithBest('meaning','Matching Mode'), className: getModeClass('meaning') },
    { id: 'multi_choice', label: labelWithBest('multi_choice','Multiple Choice'), className: getModeClass('multi_choice') },
  ];
  const spellModes = [
    { id: 'spelling', label: labelWithBest('spelling','Translate and Spell'), className: getModeClass('spelling') },
    { id: 'listen_and_spell', label: labelWithBest('listen_and_spell','Listen and Spell'), className: getModeClass('listen_and_spell') },
  ];

  // Render each group with improved spacing
  renderModeButtons(
    modal.querySelector('#modeModalListenGroup'),
    listenModes,
    {
      columns: 2,
      buttonHeight: '110px',
      onClick: (id) => {
        modal.style.display = 'none';
        if (onModeChosen) onModeChosen(id);
      }
    }
  );
  renderModeButtons(
    modal.querySelector('#modeModalReadGroup'),
    readModes,
    {
      columns: 2,
      buttonHeight: '110px',
      onClick: (id) => {
        modal.style.display = 'none';
        if (onModeChosen) onModeChosen(id);
      }
    }
  );
  renderModeButtons(
    modal.querySelector('#modeModalSpellGroup'),
    spellModes,
    {
      columns: 2,
      buttonHeight: '110px',
      onClick: (id) => {
        modal.style.display = 'none';
        if (onModeChosen) onModeChosen(id);
      }
    }
  );

  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  modal.style.display = 'flex';
  document.getElementById('closeModeModal').onclick = () => {
    modal.style.display = 'none';
    if (window.WordArcade && typeof window.WordArcade.startModeSelector === 'function') {
      window.WordArcade.startModeSelector();
    } else if (onClose) {
      onClose();
    }
  };
  document.getElementById('closeModeModalX').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
}
