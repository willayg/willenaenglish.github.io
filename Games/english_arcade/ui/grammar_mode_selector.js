// Grammar Mode Selector - Shows available grammar game types for a level
// Uses EXACT same styling as word mode_selector.js
import { FN } from '../scripts/api-base.js';

export async function showGrammarModeSelector({ grammarFile, grammarName, onModeChosen, onClose }) {
  const container = document.getElementById('gameArea');
  if (!container) return;

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
        if (onClose) onClose();
      };
    }

    // Wire up navigation
    const modeBtn = document.getElementById('modeBtn');
    if (modeBtn) modeBtn.style.color = '#93cbcf'; // Highlight current section
  }

  // Modes (styleMode borrows Word Arcade accent colors)
  const modes = [
    // New: put Lesson first
    { mode: 'lesson', title: 'Lesson', svgPath: './grammar_rainbow.svg', styleMode: 'basic' },
    { mode: 'choose', title: 'Choose', svgPath: './ui/rainbow.svg', styleMode: 'multi_choice' },
    { mode: 'fill_gap', title: 'Fill the Gap', svgPath: './ui/rainbow.svg', styleMode: 'missing_letter', disabled: true }
  ];

  // Inject header styles (scoped) if not present
  if (!document.getElementById('grammar-mode-selector-header-styles')) {
    const hs = document.createElement('style');
    hs.id = 'grammar-mode-selector-header-styles';
    hs.textContent = `
      #gameArea .grammar-mode-selector-header { text-align:center; padding:12px 8px 16px; }
      #gameArea .grammar-mode-selector-header .grammar-rule-btn { 
        appearance: none; border:2px solid #21b5c0; background:#ffffff; color:#21b5c0; cursor:pointer;
        font-family:'Poppins', Arial, sans-serif; font-weight:800; font-size:20px; padding:12px 18px; border-radius:12px;
        box-shadow:0 2px 8px rgba(33,181,192,0.1); transition: transform .15s ease, box-shadow .15s ease;
      }
      #gameArea .grammar-mode-selector-header .grammar-rule-btn:hover { transform: translateY(-2px); box-shadow:0 6px 16px rgba(33,181,192,0.25); }
      #gameArea .grammar-mode-selector-header .grammar-rule-btn:active { transform: translateY(0); box-shadow:0 2px 8px rgba(33,181,192,0.15); }
      /* Slightly larger icons on grammar cards */
      #modeSelect .mode-btn .mode-icon img { width:88px !important; height:88px !important; }
      @media (min-width:600px){ #modeSelect .mode-btn .mode-icon img { width:96px !important; height:96px !important; } }
      @media (min-width:900px){ #modeSelect .mode-btn .mode-icon img { width:104px !important; height:104px !important; } }
      /* Rounder borders and larger vertical spacing on grammar buttons */
      #modeSelect .mode-btn { border-radius:28px !important; gap:20px !important; padding:20px 12px 24px !important; }
      #modeSelect .mode-btn .mode-content { gap:18px !important; }
      #modeSelect .mode-btn .mode-left { gap:12px !important; }
    `;
    document.head.appendChild(hs);
  }

  // Clear and render title ABOVE the card, then the card below
  const headerDiv = document.createElement('div');
  headerDiv.className = 'grammar-mode-selector-header';
  headerDiv.innerHTML = `<button type="button" class="grammar-rule-btn" aria-label="${grammarName}: rules and tips">${grammarName}</button>`;
  container.appendChild(headerDiv);

  // Title click becomes a rule-explainer button (modal coming later)
  try {
    headerDiv.querySelector('.grammar-rule-btn')?.addEventListener('click', () => {
      try {
        (window.WordArcade && window.WordArcade.inlineToast)
          ? window.WordArcade.inlineToast('Rules & tips coming soon')
          : alert('Rules & tips coming soon');
      } catch { alert('Rules & tips coming soon'); }
    });
  } catch {}

  // Now add the card below the header
  const cardDiv = document.createElement('div');
  cardDiv.className = 'wa-card';
  cardDiv.id = 'modeSelectCard';
  cardDiv.style.background = '#fbffff';
  container.appendChild(cardDiv);

  const modeSelectDiv = document.createElement('div');
  modeSelectDiv.id = 'modeSelect';
  modeSelectDiv.setAttribute('aria-label', 'Select a grammar game mode');
  cardDiv.appendChild(modeSelectDiv);

  const listContainer = modeSelectDiv;

  // Helpers to render star row (inline-colored SVGs to avoid external CSS dependency)
  const pctToStars = (pct) => {
    if (pct == null) return 0;
    if (pct >= 100) return 5;
    if (pct > 90) return 4;
    if (pct > 80) return 3;
    if (pct > 70) return 2;
    if (pct >= 60) return 1;
    return 0;
  };
  const starSvg = (filled) => filled
    ? `<svg class="star-filled" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="#ffd34d" stroke="#ffd34d" d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`
    : `<svg class="star-empty" viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path fill="none" stroke="#e8d8a8" stroke-width="1.5" d="M12 .587l3.668 7.431L23.5 9.75l-5.667 5.527L19.335 24 12 19.897 4.665 24l1.502-8.723L.5 9.75l7.832-1.732z"/></svg>`;

  const renderStarsInto = (el, pct) => {
    if (!el) return;
    const filled = pctToStars(pct);
    let html = '';
    for (let i=0;i<5;i++) html += starSvg(i < filled);
    el.innerHTML = html;
  };

  // Build mode buttons with EXACT word mode selector styling
  modes.forEach((m) => {
    const btn = document.createElement('button');
  btn.className = 'mode-btn mode-card';
  // Use a known data-mode so style.css applies Word selector accents
  btn.setAttribute('data-mode', m.styleMode || m.mode);
    btn.setAttribute('aria-label', m.title);

    // Build inner structure: mode-content > mode-left > mode-icon + mode-title
    const contentDiv = document.createElement('div');
    contentDiv.className = 'mode-content';

    const leftDiv = document.createElement('div');
    leftDiv.className = 'mode-left';

    const iconDiv = document.createElement('div');
    iconDiv.className = 'mode-icon';

    const img = document.createElement('img');
  img.src = m.svgPath;
    img.alt = m.title;
    img.style.width = '96px';
    img.style.height = '96px';
    img.style.objectFit = 'contain';
    img.style.display = 'block';

    iconDiv.appendChild(img);

  const titleDiv = document.createElement('div');
  titleDiv.className = 'mode-title';
  titleDiv.textContent = m.title;

    // Star row container
    const starRow = document.createElement('div');
    starRow.className = 'star-row';
    starRow.id = `grammar-star-${m.mode}`;
    starRow.style.display = 'flex';
    starRow.style.justifyContent = 'center';
    starRow.style.gap = '4px';
    // default 0 stars until we compute
    renderStarsInto(starRow, null);

    leftDiv.appendChild(iconDiv);
    leftDiv.appendChild(starRow);
    leftDiv.appendChild(titleDiv);
    contentDiv.appendChild(leftDiv);
    btn.appendChild(contentDiv);

  // Disabled/coming-soon styling
    if (m.disabled) {
      btn.style.opacity = '0.65';
      btn.style.cursor = 'not-allowed';
      btn.setAttribute('aria-disabled', 'true');
    }

    btn.addEventListener('click', () => {
      if (m.disabled) {
        try {
          (window.WordArcade && window.WordArcade.inlineToast)
            ? window.WordArcade.inlineToast('Fill the Gap is coming soon!')
            : alert('Fill the Gap is coming soon!');
        } catch { alert('Fill the Gap is coming soon!'); }
        return;
      }
      if (onModeChosen) onModeChosen({ mode: m.mode, grammarFile, grammarName });
    });

    listContainer.appendChild(btn);
  });

  // After rendering buttons, fetch session history to compute stars for 'Choose'
  (async () => {
    try {
      // Fetch sessions (try list-scoped first for speed)
      const makeUrl = (scoped) => {
        const base = (window.WordArcade && window.WordArcade.FN) ? window.WordArcade.FN('progress_summary') : (typeof FN === 'function' ? FN('progress_summary') : '/.netlify/functions/progress_summary');
        // Fall back if FN not available in this scope
        const u = new URL(base, window.location.origin);
        u.searchParams.set('section', 'sessions');
        if (scoped && grammarName) u.searchParams.set('list_name', grammarName);
        return u.toString();
      };
      let sessions = [];
      try {
        const res = await fetch(makeUrl(true), { cache: 'no-store', credentials: 'include' });
        if (res.ok) sessions = await res.json();
      } catch {}
      if (!Array.isArray(sessions) || !sessions.length) {
        try {
          const res = await fetch(makeUrl(false), { cache: 'no-store', credentials: 'include' });
          if (res.ok) sessions = await res.json();
        } catch {}
      }
      if (!Array.isArray(sessions) || !sessions.length) return;

      // Find best accuracy for this grammarName (category: grammar or mode: grammar_mode)
      const canon = (s) => (s || '').toString().trim().toLowerCase();
      const target = canon(grammarName);
      let bestPct = null;
      (sessions || []).forEach(s => {
        if (!s) return;
        const listCanon = canon(s.list_name) || canon((s.summary && (s.summary.list_name || s.summary.list)));
        if (!listCanon || (target && listCanon !== target)) return;
        // Match only grammar sessions
        let sum = s.summary; try { if (typeof sum === 'string') sum = JSON.parse(sum); } catch {}
        const isGrammar = (sum && canon(sum.category) === 'grammar') || canon(s.mode) === 'grammar_mode';
        if (!isGrammar) return;
        let pct = null;
        if (sum && typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) {
          pct = Math.round((sum.score / sum.total) * 100);
        } else if (sum && typeof sum.accuracy === 'number') {
          pct = Math.round(sum.accuracy);
        } else if (typeof s.correct === 'number' && typeof s.total === 'number' && s.total > 0) {
          pct = Math.round((s.correct / s.total) * 100);
        }
        if (pct != null) {
          if (bestPct == null || pct > bestPct) bestPct = pct;
        }
      });
      // Update the Choose card's stars (mode = 'choose')
      const starEl = document.getElementById('grammar-star-choose');
      renderStarsInto(starEl, bestPct);
    } catch (e) {
      // Silent; stars are optional
    }
  })();

  // Add Change Level button (below modes)
  const changeLevelBtn = document.createElement('button');
  changeLevelBtn.className = 'mode-btn mode-card';
  changeLevelBtn.style.cssText = `
    margin-top: 12px;
    grid-column: 1 / -1;
    background: #fff;
    color: #21b5c0;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 5px;
    height: 44px; max-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #21b5c0;
    border-radius: 10px;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
    box-shadow: 0 2px 6px rgba(33, 181, 192, 0.1);
  `;
  changeLevelBtn.textContent = 'Change Level';
  changeLevelBtn.addEventListener('click', () => {
    if (onClose) onClose();
  });

  // Add hover effects
  changeLevelBtn.addEventListener('mouseenter', () => {
    changeLevelBtn.style.transform = 'translateY(-2px)';
    changeLevelBtn.style.boxShadow = '0 6px 16px rgba(33, 181, 192, 0.25)';
  });
  changeLevelBtn.addEventListener('mouseleave', () => {
    changeLevelBtn.style.transform = 'translateY(0)';
    changeLevelBtn.style.boxShadow = '0 2px 6px rgba(33, 181, 192, 0.1)';
  });

  // Add Main Menu button at the bottom
  const mainMenuBtn = document.createElement('button');
  mainMenuBtn.className = 'mode-btn mode-card';
  mainMenuBtn.style.cssText = `
    margin-top: 0;
    grid-column: 1 / -1;
    background: #fff;
    color: #21b5c0ff;
    font-family: 'Poppins', Arial, sans-serif;
    font-weight: 700;
    font-size: 14px;
    padding: 8px 16px;
    height: 44px; max-height: 44px;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid #1eb0bbff;
    border-radius: 10px;
    cursor: pointer;
    transition: transform .15s ease, box-shadow .15s ease;
    box-shadow: 0 2px 6px rgba(33, 181, 192, 0.1);
  `;
  mainMenuBtn.textContent = 'Main Menu';
  mainMenuBtn.addEventListener('click', () => {
    if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
      window.WordArcade.quitToOpening(true);
    } else {
      // Fallback to full reload of the current page to restore opening menu
      try { location.reload(); } catch {}
    }
  });

  // Add hover effects
  mainMenuBtn.addEventListener('mouseenter', () => {
    mainMenuBtn.style.transform = 'translateY(-2px)';
    mainMenuBtn.style.boxShadow = '0 6px 16px rgba(25, 119, 126, 0.25)';
  });
  mainMenuBtn.addEventListener('mouseleave', () => {
    mainMenuBtn.style.transform = 'translateY(0)';
    mainMenuBtn.style.boxShadow = '0 2px 6px rgba(33, 181, 192, 0.1)';
  });

  // Append buttons in a wrapper
  const buttonsWrapper = document.createElement('div');
  buttonsWrapper.style.cssText = `
    display: flex;
    gap: 12px;
    flex-direction: column;
    margin-top: 16px;
    padding: 0 12px;
  `;

  buttonsWrapper.appendChild(changeLevelBtn);
  buttonsWrapper.appendChild(mainMenuBtn);

  const cardContainer = document.getElementById('modeSelectCard');
  cardContainer.appendChild(buttonsWrapper);
}
