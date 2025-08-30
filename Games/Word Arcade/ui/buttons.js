// Shared button utilities for Word Arcade
//
// .choice-btn: Used for answer/option buttons in game modes (multi-choice, picture, etc)
// .mode-btn: Used for mode selector screen (Choose a Mode)
// .mode-grid: Used for the grid layout of mode selector buttons
//
// setupChoiceButtons: Adds press animation to .choice-btn (game answers)
// splashResult: Shows green/red splash for correct/wrong answers (game answers)
// ensureModeButtonStyles: Injects styles for both .choice-btn and .mode-btn
// renderModeButtons: Renders the mode selector grid/buttons

let stylesInjected = false;
function ensureChoiceButtonStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'choice-button-styles';
  style.textContent = `
    .choice-btn {
      border-radius: 10px;
      background: #f7f7f7;
      color: #19777e;
      font-weight: 700;
      border: 2px solid #41b6beff;
      box-shadow: 0 2px 8px rgba(60,60,80,0.10);
      cursor: pointer;
      font-size: clamp(1.2em, 4vw, 3em);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform .08s ease, background-color .2s ease, box-shadow .2s ease;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .choice-btn:focus { outline: none; }
    .choice-btn:active { transform: scale(0.97); }

    @keyframes btnSplashCorrect {
      0%   { box-shadow: 0 0 0 0 rgba(34,197,94,.6); background: #eafff2; }
      70%  { box-shadow: 0 0 0 16px rgba(34,197,94,0); }
      100% { background: #f7f7f7; }
    }
    @keyframes btnSplashWrong {
      0%   { box-shadow: 0 0 0 0 rgba(239,68,68,.6); background: #ffecec; }
      70%  { box-shadow: 0 0 0 16px rgba(239,68,68,0); }
      100% { background: #f7f7f7; }
    }
    .splash-correct { animation: btnSplashCorrect 450ms ease; }
    .splash-wrong { animation: btnSplashWrong 450ms ease; }

    /* Mode selector grid and buttons */
    .mode-grid {
      display: grid;
      gap: 25px;
      max-width: 800px;
      margin: 24px auto;
      padding: 0 20px;
      justify-content: center;
      align-items: center;
    }
    .mode-btn {
      width: calc(100% + 10px);
      height: var(--mode-btn-height, 120px);
      border: none;
      border-radius: 0;
      background: transparent;
      color: #19777e;
      font-weight: 700; /* slightly bolder */
      font-size: 16px;
      cursor: pointer;
      transition: all 0.18s ease;
      display: flex;
      align-items: center;
      justify-content: space-between;
      text-align: left;
      line-height: 1.2;
      box-shadow: none;
      padding: 12px 18px 32px 18px; /* add extra space below content */
      touch-action: manipulation;
      user-select: none;
      margin-bottom: 32px; /* increase vertical space between buttons */
    }
    .mode-btn:last-child {
      margin-bottom: 0;
    }
    .mode-btn:hover {
      background: rgba(147,203,207,0.06);
      transform: translateY(-2px);
    }
    .mode-btn:active { transform: translateY(0); }

    /* Golden back glow for perfect score */
    .mode-btn.mode-perfect {
      background: #fff;
      border-color: #f5c518;
      color: #19777e;
      box-shadow: 0 0 16px 5px rgba(245,197,24,0.50), 0 2px 8px rgba(60,60,80,0.10);
      transform: translateY(-1px);
    }
    .mode-btn.mode-perfect:hover {
      background: #fff;
      border-color: #f5c518;
      box-shadow: 0 0 22px 7px rgba(245,197,24,0.58), 0 4px 12px rgba(60,60,80,0.12);
      transform: translateY(-3px) scale(1.01);
    }

    /* Blue back glow for excellent score (95% and above) */
    .mode-btn.mode-excellent {
      background: #fff;
      border-color: #3bb6ff;
      color: #19777e;
      box-shadow: 0 0 16px 5px rgba(59,182,255,0.38), 0 2px 8px rgba(60,60,80,0.10);
      transform: translateY(-1px);
    }
    .mode-btn.mode-excellent:hover {
      background: #fff;
      border-color: #3bb6ff;
      box-shadow: 0 0 22px 7px rgba(59,182,255,0.48), 0 4px 12px rgba(60,60,80,0.12);
      transform: translateY(-3px) scale(1.01);
    }

    /* Pink back glow for great score (90% and above but less than 95%) */
    .mode-btn.mode-great {
      background: #fff;
      border-color: #ff69b4;
      color: #19777e;
      box-shadow: 0 0 16px 5px rgba(255,105,180,0.32), 0 2px 8px rgba(60,60,80,0.10);
      transform: translateY(-1px);
    }
    .mode-btn.mode-great:hover {
      background: #fff;
      border-color: #ff69b4;
      box-shadow: 0 0 22px 7px rgba(255,105,180,0.42), 0 4px 12px rgba(60,60,80,0.12);
      transform: translateY(-3px) scale(1.01);
    }

    /* Small meta line for progress (e.g., Best score) */
    .mode-meta {
      display: block;
      font-size: 12px;
      font-weight: 500;
      color: #5c98b4ff;
      margin-top: 6px;
    }
  /* Star row for mode ratings */
  .star-row { display:flex;gap:4px;align-items:center;justify-content:flex-start;margin-top:6px; } /* closer stars */
  .star-row svg { width:16px;height:16px;display:block; }
  .star-filled { fill: #f5c518; stroke: #d7b210; }
  .star-empty { fill: none; stroke: #e8d8a8; stroke-width:1.5; }

  /* Mode list styling: stacked rows, divider lines, alternating icon sides */
  .mode-grid { display:block; gap:0; max-width:360px; margin:0 auto; padding-top:32px; }
  .mode-grid .mode-btn { display:block; width:100%; padding:0px 30px 30px; background:transparent; position:relative; } /* larger vertical spacing */
  /* Subtle metallic sheen overlay */
  .mode-grid .mode-btn::before { content:''; position:absolute; left:50%; transform:translateX(-50%); top:2px; width:76%; height:58%; pointer-events:none; opacity:0.7; border-radius:12px;
    background: linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.20) 40%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0) 100%);
    mix-blend-mode: screen;
  }
  .mode-grid .mode-btn:hover::before { opacity:0.9; }
  .mode-grid .mode-btn::after { content:''; position:absolute; left:50%; transform:translateX(-50%); bottom:0; width:76%; height:2px; background:rgba(0,0,0,0.12); border-radius:1px; }
  .mode-grid .mode-btn:last-child::after { display:none; }
  .mode-grid .mode-btn .mode-content { display:flex; align-items:center; justify-content:space-between; gap:12px; }
  /* Reverse content order on even rows for staggered icons */
  .mode-grid .mode-btn:nth-child(even) .mode-content { flex-direction: row-reverse; }
  .mode-grid .mode-btn .mode-left { display:flex; flex-direction:column; align-items:flex-start; }
  .mode-grid .mode-btn:nth-child(even) .mode-left { align-items:flex-end; text-align:right; }
  .mode-grid .mode-btn .mode-icon img { width:92px; height:92px; }

  /* Title color classes using main menu palette */
  .mode-title { font-family: 'Poppins', Arial, sans-serif; font-weight:800; margin-bottom:6px; } /* slightly bolder */
  .mode-title.for-you { color: #21b3be; }
  .mode-title.review { color: #5b7fe5; }
  .mode-title.basic { color: #ff6fb0; }
  .mode-title.browse { color: #d9923b; }

  /* Percentage/meta style inside mode rows; color matches title via same colorClass */
  .mode-grid .mode-btn .mode-meta {
    margin-top:1.2em; /* more vertical space above percent */
    font-weight:800;
    font-size:1em; /* larger, em units */
    line-height:1.1;
    letter-spacing:0.01em;
    transition: color 0.2s;
  }
  .mode-grid .mode-btn .mode-meta.zero { color: #d4e3e9ff; }
  .mode-grid .mode-btn .mode-meta.for-you { color: #21b3be; }
  .mode-grid .mode-btn .mode-meta.review { color: #5b7fe5; }
  .mode-grid .mode-btn .mode-meta.basic { color: #ff6fb0; }
  .mode-grid .mode-btn .mode-meta.browse { color: #d9923b; }
  `;
  document.head.appendChild(style);
}

export function setupChoiceButtons(root = document) {
  ensureChoiceButtonStyles();
  const buttons = root.querySelectorAll('.choice-btn');
  buttons.forEach(btn => {
    // Extra JS press animation for mobile consistency
    btn.onmousedown = () => { btn.style.transform = 'scale(0.97)'; };
    const reset = () => { btn.style.transform = 'scale(1)'; };
    btn.onmouseup = reset;
    btn.onmouseleave = reset;
    btn.ontouchstart = () => { btn.style.transform = 'scale(0.97)'; };
    btn.ontouchend = reset;
  });
}

export function splashResult(el, isCorrect) {
  ensureChoiceButtonStyles();
  const cls = isCorrect ? 'splash-correct' : 'splash-wrong';
  el.classList.remove('splash-correct', 'splash-wrong');
  // Force reflow to restart animation
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => { el.classList.remove('splash-correct', 'splash-wrong'); }, 500);
}

// Ensure mode button styles are present (alias to shared injector)
export function ensureModeButtonStyles() {
  ensureChoiceButtonStyles();
}

// Render a grid of mode buttons
// items: Array<{ id: string, label: string }>
// options: { columns?: number, buttonHeight?: string, onClick?: (id) => void }
export function renderModeButtons(container, items, options = {}) {
  ensureModeButtonStyles();
  const { columns = 2, buttonHeight = '120px', onClick } = options;

  // Prepare grid container
  const grid = document.createElement('div');
  grid.className = 'mode-grid';
  grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'mode-btn';
    if (item.className) btn.classList.add(item.className);
    btn.style.setProperty('--mode-btn-height', buttonHeight);
    // Allow simple HTML like <br> in labels
    btn.innerHTML = item.label;
    btn.dataset.modeId = item.id;
    if (onClick) btn.onclick = () => onClick(item.id);
    grid.appendChild(btn);
  });

  container.appendChild(grid);
  return grid;
}
