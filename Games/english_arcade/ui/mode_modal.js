// Mode Modal UI
import { renderModeButtons, ensureModeButtonStyles } from './buttons.js';
import { getUserId } from '../../../students/records.js';
import { FN } from '../scripts/api-base.js';

export async function showModeModal({ onModeChosen, onClose }) {
  let modal = document.getElementById('modeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modeModal';
    modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1000;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
  <div style="background:#fff;padding:8px;border-radius:18px;box-shadow:0 4px 24px rgba(60,60,80,0.18);min-width:240px;max-width:420px;max-height:80vh;overflow-y:auto;position:relative;border:2px solid #67e2e6;">
      <button id="closeModeModalX" title="Close" style="position:absolute;top:8px;right:10px;font-size:1.3em;background:none;border:none;color:#19777e;cursor:pointer;line-height:1;width:28px;height:28px;z-index:2;">&times;</button>
      <div style="margin:6px 8px;">
  <div id="modeModalHeader"></div>
        <div class="mode-grid"></div>
      </div>
      <div style="text-align:center;margin-top:8px;">
        <button id="closeModeModal" style="font-size:1em;padding:8px 22px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
      </div>
    </div>`;

  ensureModeButtonStyles();

  // Pre-fetch per-mode best score for this list (if logged in)
  const userId = getUserId && getUserId();
  const listName = (window.WordArcade && typeof window.WordArcade.getListName === 'function') ? window.WordArcade.getListName() : null;
  // bestByMode: mode -> { pct?: number, pts?: number }
  let bestByMode = {};
  if (listName) {
    try {
      const url = new URL(FN('progress_summary'), window.location.origin);
      url.searchParams.set('section', 'sessions');
      if (listName) url.searchParams.set('list_name', listName);
      const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
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
  
  // Inject header styles (scoped) if not present
  if (!document.getElementById('mode-modal-header-styles')) {
    const hs = document.createElement('style');
    hs.id = 'mode-modal-header-styles';
    hs.textContent = `
      #modeModal .mode-modal-header { text-align:center; padding:4px 8px 10px; }
      #modeModal .mode-modal-header .file-title { font-family:'Poppins', Arial, sans-serif; font-weight:800; color:#19777e; font-size:18px; margin-top:4px; }
    `; // Medal styles removed
    document.head.appendChild(hs);
  }
  // Decide availability for picture modes: require at least 4 explicit images (no emoji fallback)
  const wl = (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [];
  let pictureCount = 0;
  if (Array.isArray(wl) && wl.length) {
    wl.forEach(w => { if (w && w.img) pictureCount++; });
  }
  const hasPicturable = pictureCount >= 4;

  // Check if we're in Review mode - hide stats if so
  const isReview = listName === 'Review List' || (window.WordArcade?.getListName?.() === 'Review List');

  // Helper for PNG icon paths (lighter assets)
  const modeIcons = {
  easy_picture: './assets/Images/icons/reading.png?v=20250910a',
  listening: './assets/Images/icons/listening.png?v=20250910a',
  picture: './assets/Images/icons/reading.png?v=20250910a',
  meaning: './assets/Images/icons/matching.png?v=20250910a',
  multi_choice: './assets/Images/icons/reading.png?v=20250910a',
  spelling: './assets/Images/icons/translate-and-spell.png?v=20250910a',
  listen_and_spell: './assets/Images/icons/listen-and-spell.png?v=20250910a',
  level_up: './assets/Images/icons/level up.png?v=20250910a',
  };

  // Map best pct to a CSS class for glow styling
  const getModeClass = (modeId) => {
    // Don't apply special styling in Review mode
    if (isReview) return '';
    
    const key = String(modeId || '').toLowerCase();
    const best = bestByMode[key];
    const pct = best && typeof best.pct === 'number' ? best.pct : null;
    if (pct == null) return '';
    if (pct >= 100) return 'mode-perfect';
    if (pct >= 95) return 'mode-excellent';
    if (pct >= 90) return 'mode-great';
    return '';
  };

  // Convert pct to 0-5 stars using the mapping requested
  const pctToStars = (pct) => {
    if (pct == null) return 0;
    if (pct >= 100) return 5;
    if (pct > 90) return 4;
    if (pct > 80) return 3;
    if (pct > 70) return 2;
    if (pct >= 60) return 1;
    return 0;
  };

  // Simplified modal header (medals removed)
  const buildHeader = () => {
    const displayName = listName || 'Word List';
    return `<div class="mode-modal-header" role="region" aria-label="${displayName}">
      <div class="file-title">${displayName}</div>
    </div>`;
  };

  const starSvg = (filled) => {
    if (filled) return `<svg class="star-filled" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;
    return `<svg class="star-empty" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;
  };

  // Improved label with SVG icon and percent/stars (horizontal layout)
  const labelWithBest = (id, label) => {
    const key = id.toLowerCase();
    const best = bestByMode[key];
    // Default to 0% when not played
    let meta = '0%';
    let pct = null;
    let starsHtml = '';

    // In Review mode, keep simple icon-only layout
    if (isReview) {
      return `<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;'>
        <div style='display:flex;flex-direction:column;align-items:flex-start;'>
          <div style='font-weight:700;color:#19777e;margin-bottom:6px;text-transform:capitalize;font-size:14px;'>${label}</div>
        </div>
        <div style='flex-shrink:0;opacity:0.95;'><img src='${modeIcons[id] || ''}' alt='${label}' style='width:92px;height:92px;'/></div>
      </div>`;
    }

    if (best && best.pct != null) {
      pct = best.pct;
      const metaClass = pct === 0 ? 'zero' : (label.toLowerCase() === 'match' ? 'for-you' : label.toLowerCase() === 'listen' ? 'review' : label.toLowerCase() === 'read' ? 'basic' : 'browse');
      meta = `<span class="mode-meta ${metaClass}">${pct}%</span>`;
      const filled = pctToStars(pct);
      for (let i = 0; i < 5; i++) starsHtml += starSvg(i < filled);
    } else if (best && best.pts != null) {
      meta = `<span class="mode-meta zero">0%</span>`;
      for (let i = 0; i < 5; i++) starsHtml += starSvg(false);
    } else {
      // Unplayed: show empty stars and 0% with same styling/spacing
      meta = `<span class="mode-meta zero">0%</span>`;
      for (let i = 0; i < 5; i++) starsHtml += starSvg(false);
    }

    return `<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;'>
      <div style='display:flex;flex-direction:column;align-items:flex-start;'>
        <div class='mode-title' style='color:#19777e;margin-bottom:6px;text-transform:capitalize;font-size:14px;font-weight:800;'>${label}</div>
        <div class='star-row'>${starsHtml}</div>
        <div>${meta}</div>
      </div>
      <div style='flex-shrink:0;opacity:0.95;'><img src='${modeIcons[id] || ''}' alt='${label}' style='width:92px;height:92px;'/></div>
    </div>`;
  };

  // Build same stacked list as selector
  const modes = [
  { id: 'meaning', title: 'Match', icon: './assets/Images/icons/matching.png?v=20250910a', colorClass: 'for-you' },
  { id: 'listening', title: 'Listen', icon: './assets/Images/icons/listening.png?v=20250910a', colorClass: 'review' },
  { id: 'multi_choice', title: 'Read', icon: './assets/Images/icons/reading.png?v=20250910a', colorClass: 'basic' },
  { id: 'listen_and_spell', title: 'Spell', icon: './assets/Images/icons/listen-and-spell.png?v=20250910a', colorClass: 'browse' },
  { id: 'spelling', title: 'Test', icon: './assets/Images/icons/translate-and-spell.png?v=20250910a', colorClass: 'browse' },
  { id: 'level_up', title: 'Level up', icon: './assets/Images/icons/level up.png?v=20250910a', colorClass: 'for-you' },
  ];
  const headerEl = modal.querySelector('#modeModalHeader');
  if (headerEl) headerEl.innerHTML = buildHeader();

  const listContainer = modal.querySelector('.mode-grid');
  modes.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.dataset.modeId = m.id;
    btn.innerHTML = labelWithBest(m.id, m.title, m.title, m.colorClass);
    btn.onclick = () => { modal.style.display = 'none'; if (onModeChosen) onModeChosen(m.id); };
    listContainer.appendChild(btn);
  });

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
