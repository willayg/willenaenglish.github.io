// Game View UI
import { showSampleWordlistModal } from './sample_wordlist_modal.js';
import { showModeModal } from './mode_modal.js';

export function renderGameView({ modeName, onShowModeModal, onWordsClick, onModeClick }) {
  const container = document.getElementById('gameArea');
  // The actual game will be rendered by the mode function, but we add the mode modal button here
  const modalBtn = document.createElement('button');
  modalBtn.textContent = 'Change Mode';
  modalBtn.style = 'position:absolute;top:16px;right:16px;z-index:10;padding:8px 18px;border-radius:8px;background:#41b6beff;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;';
  modalBtn.onclick = onShowModeModal;
  container.appendChild(modalBtn);

  // Show the menu bar and wire navigation
  const menuBar = document.getElementById('menuBar');
  if (menuBar) {
    menuBar.style.display = 'flex';
    
    const wordsBtn = document.getElementById('wordsBtn');
    const modeBtn = document.getElementById('modeBtn');
    
    if (wordsBtn) {
      wordsBtn.onclick = () => {
        // Open sample wordlist modal instead of navigating
        showSampleWordlistModal({
          onChoose: async (filename) => {
            // Delegate to existing onWordsClick to restart flow after selection
            if (onWordsClick) onWordsClick(filename);
          }
        });
      };
      wordsBtn.style.opacity = '0.6'; // Not current section
    }
    if (modeBtn) {
      modeBtn.onclick = () => {
        showModeModal({
          onModeChosen: (newMode) => {
            if (onModeClick) onModeClick(newMode);
          }
        });
      };
      modeBtn.style.opacity = '1'; // Current section
      modeBtn.style.fontWeight = 'bold';
    }
  }

  // Always show Back button in menu bar
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.style.display = '';
    backBtn.onclick = () => {
      // Full quit: remove current list so next game truly starts fresh
      if (window.WordArcade && typeof window.WordArcade.quitToOpening === 'function') {
        window.WordArcade.quitToOpening(true);
      } else {
        try { document.getElementById('wa-quit-btn')?.remove(); } catch {}
        import('./mode_selector.js').then(mod => { if (mod.renderModeSelector) mod.renderModeSelector({}); });
      }
    };
  }

  // Add bottom-centered Quit Game button (hidden until after splash)
  try { document.getElementById('wa-quit-btn')?.remove(); } catch {}
  const quitBtn = document.createElement('button');
  quitBtn.id = 'wa-quit-btn';
  quitBtn.textContent = 'Quit Game';
  quitBtn.setAttribute('aria-label', 'Quit current game and return to mode menu');
  // Visuals: white pill, teal border, bluish text (match provided image)
  quitBtn.style.cssText = [
    'font-family:\'Poppins\', Arial, sans-serif',
    'position:fixed',
    'left:50%',
    'transform:translateX(-50%)',
    'bottom:max(16px, env(safe-area-inset-bottom))',
    'z-index:1000',
    'padding:10px 22px',
    'border-radius:9999px',
    'background:#fff',
    'color:#6273e4',
    'font-weight:800',
    'font-size:13px',
    'border:3px solid #39d5da',
    'box-shadow:none',
    'cursor:pointer',
    'outline:none',
    '-webkit-tap-highlight-color:transparent',
    'transition:transform .15s ease, box-shadow .15s ease, opacity .2s ease',
    'opacity:0' // start hidden; reveal after splash
  ].join(';');

  // Hover/active micro-interactions
  quitBtn.addEventListener('mouseenter', () => {
    quitBtn.style.transform = 'translateX(-50%) translateY(-1px)';
  });
  quitBtn.addEventListener('mouseleave', () => {
    quitBtn.style.transform = 'translateX(-50%) translateY(0)';
  });
  quitBtn.addEventListener('mousedown', () => {
    quitBtn.style.transform = 'translateX(-50%) translateY(1px)';
  });
  quitBtn.addEventListener('mouseup', () => {
    quitBtn.style.transform = 'translateX(-50%) translateY(0)';
  });

  quitBtn.addEventListener('click', () => {
    // Soft quit: keep wordList so user can pick a new mode quickly
    if (window.WordArcade && typeof window.WordArcade.clearCurrentGameState === 'function') {
      window.WordArcade.clearCurrentGameState({ keepWordList: true });
      if (window.WordArcade.startModeSelector) window.WordArcade.startModeSelector();
    } else {
      try { quitBtn.remove(); } catch {}
      import('./mode_selector.js').then(mod => { if (mod.renderModeSelector) mod.renderModeSelector({}); });
    }
  });
  // Append AFTER splash: wait at least a short delay and until common splash markers are gone
  let canceled = false;
  const earliestMs = 1200; // ensure it doesn't appear during initial splash/transition
  const startAt = Date.now();
  const tryAppend = () => {
    if (canceled) return;
    if (Date.now() - startAt < earliestMs) { setTimeout(tryAppend, 150); return; }
    const hasSplash = document.querySelector('.splash, #splash, #gameStartContent, .game-splash, [data-splash]');
    if (hasSplash) { setTimeout(tryAppend, 150); return; }
    if (!document.getElementById('wa-quit-btn')) {
      document.body.appendChild(quitBtn);
      // fade in
      requestAnimationFrame(() => { quitBtn.style.opacity = '1'; });
    }
  };
  // If user navigates back before we append, cancel pending insert
  backBtn?.addEventListener('click', () => { canceled = true; });
  setTimeout(tryAppend, 50);
}
