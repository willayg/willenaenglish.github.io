import { renderModeButtons, ensureModeButtonStyles } from './buttons.js';
import { getUserId } from '../../../students/records.js';
import { showSampleWordlistModal } from './sample_wordlist_modal.js';
import { FN } from '../scripts/api-base.js';

// Mode Selector UI
export async function renderModeSelector({ onModeChosen, onWordsClick }) {
  const container = document.getElementById('gameArea');
  
  // Scroll to top when opening mode selector
  window.scrollTo(0, 0);
  if (container) container.scrollTop = 0;

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

  // Clear and render a single stacked rounded panel matching main menu style (no header above)
  container.innerHTML = `
    <div class="wa-card" id="modeSelectCard" style="background:#fbffff;">
      <div id="modeSelect" aria-label="Select a mode"></div>
    </div>
  `;

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
  let listName = (window.WordArcade && typeof window.WordArcade.getListName === 'function') ? window.WordArcade.getListName() : null;
  // Fallback: if force-clear removed name before splash ended, pull from sessionStorage
  if (!listName) {
    try { const ln = sessionStorage.getItem('WA_list_name'); if (ln) listName = ln; } catch {}
  }
  try { console.info('[mode_selector] Active listName =', listName); } catch {}
  
  // Helper: canonicalize raw mode values to the 6 displayed keys (MUST be defined before async code uses it!)
  const canonicalMode = (raw) => {
    const m = (raw || 'unknown').toString().toLowerCase();
    // Map any sentence variants to a single key so the 'Sentence' button shows progress
    if (m === 'sentence' || m.includes('sentence')) return 'sentence';
    if (m === 'matching' || m.startsWith('matching_') || m === 'meaning') return 'meaning';
    if (m === 'phonics_listening' || m === 'listen' || m === 'listening' || (m.startsWith('listening_') && !m.includes('spell'))) return 'listening';
    if (m.includes('listen') && m.includes('spell')) return 'listen_and_spell';
    if (m === 'multi_choice' || m.includes('multi_choice') || m.includes('picture_multi_choice') || m === 'easy_picture' || m === 'picture' || m === 'picture_mode' || m.includes('read')) return 'multi_choice';
    if (m === 'spelling' || m === 'missing_letter' || (m.includes('spell') && !m.includes('listen'))) return 'spelling';
    if (m.includes('level_up')) return 'level_up';
    return m;
  };
  
  // bestByMode: mode -> { pct?: number, pts?: number }
  let bestByMode = {};
  if (listName) {
    try {
      const canon = (v) => {
        if (!v) return '';
        return v.toString().trim().toLowerCase()
          .replace(/\.json$/i,'')
          .replace(/[_\-\s]+/g,'') // remove separators
          .replace(/[^a-z0-9]+/g,''); // strip any stray punctuation
      };
      const targetCanon = canon(listName);
      
      // For phonics lists, also accept the non-prefixed version (for backward compatibility)
      // e.g., "Phonics - Short A Sound" should also match sessions saved as "Short A Sound"
      const isPhonicsName = listName && listName.toLowerCase().includes('sound');
      const altCanon = isPhonicsName ? canon(listName.replace(/^Phonics\s*[-:]\s*/i, '')) : null;
      
      const matchesTarget = (rowName) => {
        const c = canon(rowName);
        if (!c) return false;
        if (c === targetCanon) return true;
        // Also check alternate canonicalized form for backward compatibility
        if (altCanon && c === altCanon) return true;
        return false;
      };
      // canonicalMode is now defined above outside this scope, no need to redefine it

      async function fetchSessions(scoped) {
        const url = new URL(FN('progress_summary'), window.location.origin);
        url.searchParams.set('section', 'sessions');
        if (scoped) url.searchParams.set('list_name', listName);
        const res = await fetch(url.toString(), { cache: 'no-store', credentials: 'include' });
        if (!res.ok) return [];
        return await res.json();
      }

      // First try list-scoped fetch (fast)
      let sessions = await fetchSessions(true);
      // If none returned (maybe list_name mismatch), fallback to all sessions then filter manually
      if (!sessions || !sessions.length) {
        sessions = await fetchSessions(false);
      }

      if (!sessions || !sessions.length) {
        try { console.info('[mode_selector] No session rows returned for list', listName); } catch {}
      }
      
      try {
        console.info('[mode_selector] Sessions received:', sessions.length, 'records');
        console.info('[mode_selector] Looking for listName:', listName, '-> canon:', canon(listName));
        if (altCanon) console.info('[mode_selector] Also looking for alt canon:', altCanon);
      } catch {}
      
      (Array.isArray(sessions) ? sessions : []).forEach(s => {
        if (!s) return;
        const listMatches = matchesTarget(s.list_name) || matchesTarget((s.summary && (s.summary.list_name || s.summary.listName)));
        try {
          console.info('[mode_selector] Session:', s.mode, 'list_name:', s.list_name, 'matches:', listMatches);
        } catch {}
        if (!listMatches) return;
        let sum = s.summary; try { if (typeof sum === 'string') sum = JSON.parse(sum); } catch {}
        const key = canonicalMode(s.mode);
        let pct = null; let pts = null;
        if (sum && typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) {
          pct = Math.round((sum.score / sum.total) * 100);
        } else if (sum && typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) {
          pct = Math.round((sum.score / sum.max) * 100);
        } else if (sum && typeof sum.accuracy === 'number') {
          pct = Math.round((sum.accuracy || 0) * 100);
        } else if (sum && typeof sum.score === 'number') {
          pts = Math.round(sum.score);
        } else if (typeof s.correct === 'number' && typeof s.total === 'number' && s.total > 0) {
          pct = Math.round((s.correct / s.total) * 100);
        } else if (typeof s.accuracy === 'number') {
          pct = Math.round((s.accuracy || 0) * 100);
        }
        try {
          console.info('[mode_selector] Mode:', s.mode, '-> canonical:', key, 'pct:', pct);
        } catch {}
        if (pct != null) {
          if (!(key in bestByMode) || (bestByMode[key].pct ?? -1) < pct) bestByMode[key] = { pct };
        } else if (pts != null) {
          if (!(key in bestByMode) || (bestByMode[key].pts ?? -1) < pts) bestByMode[key] = { pts };
        }
      });
      
      try {
        console.info('[mode_selector] Final bestByMode:', bestByMode);
      } catch {}
    } catch (e) {
      try { console.warn('[mode_selector] progress fetch error', e); } catch {}
    }
  }
  // Determine if picture modes are available
  const wl = (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [];
  
  // Check if this is a sample list (always has emoji fallbacks)
  const isSampleList = listName && listName.includes('.json');
  
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
    if (pct > 90) return 4;
    if (pct > 80) return 3;
    if (pct > 70) return 2;
    if (pct >= 60) return 1;
    return 0;
  };

  const starSvg = (filled) => {
    if (filled) return `<svg class="star-filled" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;
    return `<svg class="star-empty" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;
  };

  // Simplified header (medals removed entirely)
  const humanizeListName = (name) => {
    if (!name) return 'Word List';
    // Normalize to filename only (strip any folder path like sample-wordlists-level2/Vegetables.json)
    let base = String(name);
    if (base.includes('/') || base.includes('\\')) {
      base = base.split(/[/\\]/).pop();
    }
    // Remove .json extension
    base = base.replace(/\.json$/i, '');
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

  // canonicalMode already defined at top of function

  // Build visual parts for a mode: stacked layout (icon large → stars → small colored title)
  const buildModeVisual = (id, svgPath, title, colorClass, textIcon, textColor) => {
    const canonicalId = canonicalMode(id);
    const best = bestByMode[canonicalId];
    let starsHtml = '';

    if (!isReview) {
      if (best && typeof best.pct === 'number') {
        const filled = pctToStars(best.pct);
        for (let i = 0; i < 5; i++) starsHtml += starSvg(i < filled);
      } else {
        // No data or points-only: show empty stars
        for (let i = 0; i < 5; i++) starsHtml += starSvg(false);
      }
    }

    // Button inner: stacked vertically: large icon → stars → small title (all centered)
    return `
      <div class="mode-content" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;width:100%;height:100%;padding:12px;">
        <div class="mode-icon" style="flex-shrink:0;">
          ${textIcon
            ? `<div style="font-size:clamp(48px, 12vw, 94px);font-weight:800;color:${textColor || '#19777e'};line-height:1;display:block;">${textIcon}</div>`
            : `<img src="${svgPath}" alt="${id}" style="width:119px;height:119px;object-fit:contain;flex-shrink:0;display:block;"/>`}
        </div>
        ${isReview ? '' : `<div class="star-row" style="justify-content:center;gap:4px;margin:4px 0;flex-shrink:0;">${starsHtml}</div>`}
        <div class="mode-title ${colorClass}" style="font-size:13px;font-weight:700;margin:0;text-align:center;line-height:1.3;flex-shrink:0;color:#888888;">${title}</div>
      </div>`;
  };
  // Create a single list of modes in the order shown in the image
  // Check if this is a phonics list to show different modes.
  // Prefer a global flag set by the phonics loader, fallback to name heuristic.
  const isPhonics = (window.__WA_IS_PHONICS__ === true) || (
    (window.WordArcade && typeof window.WordArcade.getListName === 'function')
      ? ((window.WordArcade.getListName() || '').toLowerCase().includes('sound'))
      : false
  );
  
  const modes = isPhonics ? [
    // Use existing mode ids so colors and loaders work out-of-the-box
    { id: 'listen', title: 'Listen & Pick', icon: './assets/Images/icons/listening.png?v=20250910a', colorClass: 'review' },
    { id: 'missing_letter', title: 'Missing Letter', icon: './assets/Images/icons/questions.svg', colorClass: 'browse' },
    { id: 'multi_choice',   title: 'Read & Find',   icon: './assets/Images/icons/read.svg',   colorClass: 'basic' },
    { id: 'listen_and_spell',  title: 'Spell It Out',  icon: './assets/Images/icons/listen-and-spell.svg', colorClass: 'browse' },
  ] : [
    { id: 'meaning', title: 'Match', icon: './assets/Images/icons/matching.png?v=20250910a', colorClass: 'for-you' },
    { id: 'listening', title: 'Listen', icon: './assets/Images/icons/listening.png?v=20250910a', colorClass: 'review' },
    { id: 'multi_choice', title: 'Read', icon: './assets/Images/icons/read.svg', colorClass: 'basic' },
  { id: 'listen_and_spell', title: 'Spell', icon: './assets/Images/icons/listen-and-spell.svg', colorClass: 'browse' },
  { id: 'sentence', title: 'Sentence', icon: './assets/Images/icons/quiz.svg', colorClass: 'for-you' },
    { id: 'level_up', title: 'Level up', icon: './assets/Images/icons/level up.png?v=20250910a', colorClass: 'review' },
  ];

  // Neutralized medals logic: header removed per design (no separate title above container)

  const listContainer = container.querySelector('#modeSelect');

  // Add "Main Menu" button at the top (compact on tablets/iPads)
  const mainMenuBtn = document.createElement('button');
  mainMenuBtn.className = 'mode-btn mode-card main-menu-btn';
  mainMenuBtn.style.cssText = `
    margin-bottom: 0;
    grid-column: 1 / -1;
    background: #fff;
    color: #21b5c0ff;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 16px;
    height: 44px; max-height: 44px; --mode-btn-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #1eb0bbff;
    border-radius: 10px;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
    box-shadow: 0 2px 6px rgba(33, 181, 192, 0.1);
  `;
  mainMenuBtn.innerHTML = `<span data-i18n="Main Menu">Main Menu</span>`;
  mainMenuBtn.onclick = () => {
    if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
      window.WordArcade.quitToOpening(true);
    } else {
      // Fallback: navigate to main opening view
      if (typeof showOpeningButtons === 'function') showOpeningButtons(true);
    }
  };

  // Add hover effects
  mainMenuBtn.addEventListener('mouseenter', () => {
    mainMenuBtn.style.transform = 'translateY(-2px)';
    mainMenuBtn.style.boxShadow = '0 6px 16px rgba(25, 119, 126, 0.25)';
  });
  mainMenuBtn.addEventListener('mouseleave', () => {
    mainMenuBtn.style.transform = 'translateY(0)';
    mainMenuBtn.style.boxShadow = '0 4px 12px rgba(25, 119, 126, 0.15)';
  });

  // Defer appending main menu button to the bottom (outside the card container)

  // Add "Study" button (inside the container, at the top of the list)
  const studyWordsBtn = document.createElement('button');
  studyWordsBtn.className = 'mode-btn mode-card study-words-btn';
  studyWordsBtn.style.cssText = `
    margin-bottom: 5px;
    grid-column: 1 / -1;
    background: #fff;
    color: #ff6fb0;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 18px;
    padding: 10px 16px;
    height: 56px; max-height: 60px; --mode-btn-height: 56px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #21b3be;
    border-radius: 20px;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
    box-shadow: 0 2px 6px rgba(33, 179, 190, 0.1);
  `;
  {
    const displayName = (typeof humanizeListName === 'function') ? humanizeListName(listName) : (listName || 'Word List');
    studyWordsBtn.setAttribute('aria-label', `${displayName}. Click to study the words.`);
    studyWordsBtn.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;line-height:1.15;">
        <span style="font-weight:800;">${displayName}</span>
        <span style="font-size:10px;color:rgba(212, 214, 219, 1);font-weight:600;">click here</span>
      </div>`;
  }
  studyWordsBtn.onclick = async () => {
    const { showStudyWordsModal } = await import('./study_words_modal.js');
    showStudyWordsModal({
      wordList: (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [],
      onClose: () => {}
    });
  };

  // Add hover effects
  studyWordsBtn.addEventListener('mouseenter', () => {
    studyWordsBtn.style.transform = 'translateY(-2px)';
    studyWordsBtn.style.boxShadow = '0 6px 16px rgba(33, 179, 190, 0.25)';
  });
  studyWordsBtn.addEventListener('mouseleave', () => {
    studyWordsBtn.style.transform = 'translateY(0)';
    studyWordsBtn.style.boxShadow = '0 4px 12px rgba(33, 179, 190, 0.15)';
  });

  // Place Study button at the top inside the card container
  listContainer.prepend(studyWordsBtn);

  modes.forEach((m) => {
  const btn = document.createElement('button');
  btn.className = 'mode-btn mode-card';
  btn.setAttribute('data-mode', m.id);
  btn.dataset.modeId = m.id; // keep legacy data-modeId for any existing code
  btn.setAttribute('aria-label', m.title);
  
  btn.innerHTML = buildModeVisual(m.id, m.icon, m.title, m.colorClass, m.textIcon, m.textColor);
  btn.onclick = () => onModeChosen && onModeChosen(m.id);
    
  // Determine border color by mode ID (10% brighter and more vivid)
  let borderColor = '#40D4DE'; // default bright cyan
  if (m.id === 'listening' || m.id === 'level_up') {
    borderColor = '#FF85D0'; // bright pink
  } else if (m.id === 'multi_choice') {
    borderColor = '#FFB84D'; // bright orange
  } else if (m.id === 'spelling' || m.id === 'listen_and_spell' || m.id === 'missing_letter') {
    borderColor = '#7B9FFF'; // bright blue
  } else if (m.id === 'meaning') {
    borderColor = '#40D4DE'; // bright cyan
  } else if (m.id === 'sentence') {
    borderColor = '#40D4DE'; // bright cyan
  }

  // All mode cards: individualized borders, white background, more rounded corners
  btn.style.border = `3px solid ${borderColor}`;
  btn.style.borderRadius = '28px';
  btn.style.background = '#fff';
  btn.style.color = '#ff6fb0';
  btn.style.minHeight = '220px';
    
  listContainer.appendChild(btn);
  });

  // Add "Change Level" button (below modes, compact on tablets/iPads)
  const changeLevelBtn = document.createElement('button');
  changeLevelBtn.className = 'mode-btn mode-card change-level-btn';
  changeLevelBtn.style.cssText = `
    margin-top: 0;
    grid-column: 1 / -1;
    background: #fff;
    color: #21b5c0;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 5px;
    height: 44px; max-height: 44px; --mode-btn-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #21b5c0;
    border-radius: 10px;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
    box-shadow: 0 2px 6px rgba(33, 181, 192, 0.1);
  `;
  changeLevelBtn.innerHTML = `<span data-i18n="Change Level">Change Level</span>`;
  changeLevelBtn.onclick = async () => {
    // Detect which modal to show based on current list
    const isPhonicsMode = window.__WA_IS_PHONICS__ === true || (listName && listName.toLowerCase().includes('sound'));

    if (isPhonicsMode) {
      // Show phonics modal
      const { showPhonicsModal } = await import('./phonics_modal.js');
      showPhonicsModal({
        onChoose: (data) => {
          if (window.WordArcade && typeof window.WordArcade.loadPhonicsGame === 'function') {
            window.WordArcade.loadPhonicsGame(data);
          }
        },
        onClose: () => {}
      });
      return;
    }

    // Heuristic to determine current level from listName/path
    const ln = (listName || '').toLowerCase();
    const isL2 = ln.includes('level 2 - ') || ln.includes('sample-wordlists-level2/');
    const isL3 = ln.includes('level 3 - ') || ln.includes('sample-wordlists-level3/');

    if (isL2) {
      const { showLevel2Modal } = await import('./level2_modal.js');
      showLevel2Modal({
        onChoose: (data) => {
          if (window.WordArcade && typeof window.WordArcade.loadSampleWordlistByFilename === 'function') {
            window.WordArcade.loadSampleWordlistByFilename(data.listFile, { force: true, listName: data.listName });
          }
        },
        onClose: () => {}
      });
      return;
    }

    if (isL3) {
      const { showLevel3Modal } = await import('./level3_modal.js');
      showLevel3Modal({
        onChoose: (data) => {
          if (window.WordArcade && typeof window.WordArcade.loadSampleWordlistByFilename === 'function') {
            window.WordArcade.loadSampleWordlistByFilename(data.listFile, { force: true, listName: data.listName });
          }
        },
        onClose: () => {}
      });
      return;
    }

    // Default to Level 1 modal
    showSampleWordlistModal({
      onChoose: (filename) => {
        if (filename && window.WordArcade && typeof window.WordArcade.loadSampleWordlistByFilename === 'function') {
          window.WordArcade.loadSampleWordlistByFilename(filename, { force: true });
        }
      }
    });
  };

  // Add hover effects
  changeLevelBtn.addEventListener('mouseenter', () => {
    changeLevelBtn.style.transform = 'translateY(-2px)';
    changeLevelBtn.style.boxShadow = '0 6px 16px rgba(33, 181, 192, 0.25)';
  });
  changeLevelBtn.addEventListener('mouseleave', () => {
    changeLevelBtn.style.transform = 'translateY(0)';
    changeLevelBtn.style.boxShadow = '0 4px 12px rgba(33, 181, 192, 0.15)';
  });

  // Append bottom controls inside the container (grid) in order: Change Level, Main Menu
  const buttonContainer = document.getElementById('modeSelectCard');
  
  // Create a wrapper for buttons outside the mode list
  const buttonsWrapper = document.createElement('div');
  buttonsWrapper.style.cssText = `
    display: flex;
    gap: 12px;
    justify-content: center;
    margin-top: 16px;
    padding: 0 12px;
  `;
  
  buttonsWrapper.appendChild(changeLevelBtn);
  buttonsWrapper.appendChild(mainMenuBtn);
  buttonContainer.appendChild(buttonsWrapper);
}
