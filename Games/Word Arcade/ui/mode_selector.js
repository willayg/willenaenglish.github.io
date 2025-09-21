import { renderModeButtons, ensureModeButtonStyles } from './buttons.js';
import { getUserId } from '../../../students/records.js';
import { showSampleWordlistModal } from './sample_wordlist_modal.js';
import { FN } from '../scripts/api-base.js';

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

  // Clear and render a single stacked rounded panel matching main menu style
  container.innerHTML = `<div style="display:flex;justify-content:center;padding:18px 12px;">
    <div style="width:100%;max-width:360px;border-radius:18px;border:2px solid #67e2e6;padding:6px 6px;background:#fff;">
      <div id="modeHeader"></div>
      <div class="mode-grid"></div>
    </div>
  </div>`;

  ensureModeButtonStyles();
  // Inject header styles (scoped) if not present
  if (!document.getElementById('mode-selector-header-styles')) {
    const hs = document.createElement('style');
    hs.id = 'mode-selector-header-styles';
    hs.textContent = `
      #gameArea .mode-selector-header { text-align:center; padding:4px 8px 10px; }
      #gameArea .mode-selector-header .file-title { font-family:'Poppins', Arial, sans-serif; font-weight:800; color:#19777e; font-size:18px; margin-top:4px; }
    `; // Medal-specific CSS removed (skeleton kept minimal)
    document.head.appendChild(hs);
  }

  // Pre-fetch per-mode best score for this list (cookie-based like profile page)
  const userId = getUserId && getUserId(); // may be null; don't gate on this
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
        // Compute best score per mode for this list (robust matching + top-level fields)
        const norm = (v) => (v||'').toString().trim().toLowerCase();
        const stripExt = (v) => v.replace(/\.json$/i, '');
        const target = norm(listName);
        const targetNoExt = stripExt(target);
        (Array.isArray(sessions) ? sessions : []).forEach(s => {
          if (!s) return;
          let sum = s.summary; try { if (typeof sum === 'string') sum = JSON.parse(sum); } catch {}
          const key = (s.mode || 'unknown').toString().toLowerCase();
          const rowName = norm(s.list_name);
          const sumName = norm(sum?.list_name || sum?.listName);
          const rowNoExt = stripExt(rowName);
          const sumNoExt = stripExt(sumName);
          const matches = (name) => !!name && (name === target || name === targetNoExt);
          if (!(matches(rowName) || matches(sumName) || matches(rowNoExt) || matches(sumNoExt))) return;
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
          } else if (typeof s.correct === 'number' && typeof s.total === 'number' && s.total > 0) {
            const pct = Math.round((s.correct / s.total) * 100);
            if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
          } else if (typeof s.accuracy === 'number') {
            const pct = Math.round((s.accuracy || 0) * 100);
            if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
          }
        });
  // Do not fallback to aggregate stats: leave modes at 0% if this list has no prior sessions.
      }
    } catch {}
  }
  // Determine if picture modes are available
  const wl = (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [];
  
  // Check if this is a sample list (always has emoji fallbacks)
  const isSampleList = listName && (listName.includes('.json') || listName.includes('Sample') || listName.includes('Mixed') || listName.includes('Easy') || listName.includes('Food') || listName.includes('Animals') || listName.includes('Transportation') || listName.includes('Jobs') || listName.includes('Sports') || listName.includes('School') || listName.includes('Hobbies') || listName.includes('Verbs') || listName.includes('Feelings') || listName.includes('Long U'));
  
  let pictureCount = 0;
  if (Array.isArray(wl) && wl.length) {
    wl.forEach(w => { if (w && w.img) pictureCount++; });
  }
  
  // Picture modes are available if:
  // 1. It's a sample list (has emoji fallbacks), OR
  // 2. User content with at least 4 explicit images
  const hasPicturable = isSampleList || pictureCount >= 4;

  // Mark perfect (100%), excellent (95%+), and great (90%+) modes for glow
  const getModeClass = (modeId) => {
    // Don't apply special styling in Review mode
    if (isReview) return undefined;
    
    const b = bestByMode[modeId?.toLowerCase?.() ?? ''];
    if (b && typeof b.pct === 'number') {
      if (b.pct >= 100) return 'mode-perfect';
      if (b.pct >= 95) return 'mode-excellent';
      if (b.pct >= 90) return 'mode-great';
    }
    return undefined;
  };

  // Convert pct to 0-5 stars using the mapping requested
  const pctToStars = (pct) => {
    if (pct == null) return 0;
    if (pct >= 100) return 5;
    if (pct >= 95) return 4;
    if (pct >= 90) return 3;
    if (pct >= 85) return 2;
    if (pct >= 80) return 1;
    return 0;
  };

  const starSvg = (filled) => {
    if (filled) return `<svg class="star-filled" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;
    return `<svg class="star-empty" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;
  };

  // Simplified header (medals removed entirely)
  const humanizeListName = (name) => {
    if (!name) return 'Word List';
    // Remove .json extension
    let base = name.replace(/\.json$/i, '');
    // Replace underscores / dashes with spaces
    base = base.replace(/[_-]+/g, ' ');
    // Insert spaces before CamelCase boundaries (e.g., EasyAnimals -> Easy Animals)
    base = base.replace(/([a-z])([A-Z])/g, '$1 $2');
    // Insert spaces between letters and numbers (Food1 -> Food 1, Level2Words -> Level 2 Words)
    base = base.replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2');
    // Collapse multiple spaces
    base = base.replace(/\s+/g, ' ').trim();
    // Preserve special known names exactly
    if (base.toLowerCase() === 'review list') return 'Review List';
    // Capitalize each word (only if not already properly capitalized)
    base = base.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
    return base;
  };

  const buildHeader = () => {
    const displayName = humanizeListName(listName);
    return `<div class="mode-selector-header" role="region" aria-label="${displayName}">
      <div class="file-title">${displayName}</div>
    </div>`;
  };

  // Check if we're in Review mode - hide stats if so
  const isReview = listName === 'Review List' || (window.WordArcade?.getListName?.() === 'Review List');

  // Grouped items in requested order
  const labelWithBest = (id, svgPath, title, colorClass) => {
    const key = id.toLowerCase();
    const best = bestByMode[key];
    // If no data, show 0% (per request)
    let meta = '0%';
    let pct = null;
    let starsHtml = '';
    
    // In Review mode, don't show any stats - just the icon
    if (isReview) {
      return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;">
        <div><img src="${svgPath}" alt="${id}" style="width:120px;height:120px;" /></div>
      </div>`;
    }
    
    if (best && best.pct != null) {
      pct = best.pct;
      const metaClass = pct === 0 ? 'zero' : colorClass;
      meta = `<span class="mode-meta ${metaClass}">${pct}%</span>`;
      const filled = pctToStars(pct);
      // Render 5 stars, filled or empty
      for (let i = 0; i < 5; i++) {
        starsHtml += starSvg(i < filled);
      }
    } else if (best && best.pts != null) {
      meta = `<span class="mode-meta zero">0%</span>`;
      // no pct -> show 0 filled stars but show empties
      for (let i = 0; i < 5; i++) starsHtml += starSvg(false);
    } else {
      // No data yet: show empty stars and 0% with same styling/spacing
      meta = `<span class="mode-meta zero">0%</span>`;
      for (let i = 0; i < 5; i++) starsHtml += starSvg(false);
    }

    // Return content block; actual button HTML will wrap this
  return `<div class="mode-content">
      <div class="mode-left">
        <div class="mode-title ${colorClass}">${title}</div>
        <div class="star-row">${starsHtml}</div>
    <div>${meta}</div>
      </div>
      <div class="mode-icon"><img src="${svgPath}" alt="${id}"/></div>
    </div>`;
  };
  // Create a single list of modes in the order shown in the image
  const modes = [
  { id: 'meaning', title: 'Match', icon: './assets/Images/icons/matching.png?v=20250910a', colorClass: 'for-you' },
  { id: 'listening', title: 'Listen', icon: './assets/Images/icons/listening.png?v=20250910a', colorClass: 'review' },
  { id: 'multi_choice', title: 'Read', icon: './assets/Images/icons/reading.png?v=20250910a', colorClass: 'basic' },
  { id: 'listen_and_spell', title: 'Spell', icon: './assets/Images/icons/listen-and-spell.png?v=20250910a', colorClass: 'browse' },
  { id: 'spelling', title: 'Test', icon: './assets/Images/icons/translate-and-spell.png?v=20250910a', colorClass: 'browse' },
  { id: 'level_up', title: 'Level up', icon: './assets/Images/icons/level up.png?v=20250910a', colorClass: 'for-you' },
  ];

  // Neutralized medals logic: always show zero earned (skeleton retained for future redesign)
  const headerEl = container.querySelector('#modeHeader');
  if (headerEl) headerEl.innerHTML = buildHeader();

  const listContainer = container.querySelector('.mode-grid');
  modes.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'mode-btn';
    btn.dataset.modeId = m.id;
    btn.innerHTML = labelWithBest(m.id, m.icon, m.title, m.colorClass);
    btn.onclick = () => onModeChosen && onModeChosen(m.id);
    listContainer.appendChild(btn);
  });
}
