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

  // Add bottom-right Quit Game button (hidden until after splash)
  try { document.getElementById('wa-quit-btn')?.remove(); } catch {}
  const quitBtn = document.createElement('button');
  quitBtn.id = 'wa-quit-btn';
  quitBtn.type = 'button';
  quitBtn.classList.add('wa-quit-btn');
  quitBtn.setAttribute('aria-label', 'Quit current game and return to mode menu');
  quitBtn.title = 'Quit Game';
  quitBtn.innerHTML = `
    <span class="wa-sr-only">Quit Game</span>
    <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
  `;
  quitBtn.style.opacity = '0';

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
