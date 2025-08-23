// Game View UI
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
      wordsBtn.onclick = onWordsClick;
      wordsBtn.style.opacity = '0.6'; // Not current section
    }
    if (modeBtn) {
      modeBtn.onclick = onModeClick;
      modeBtn.style.opacity = '1'; // Current section
      modeBtn.style.fontWeight = 'bold';
    }
  }

  // Hide the back button and burger menu in favor of menu bar
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.style.display = 'none';
  
  const burgerMenu = document.getElementById('burgerMenu');
  if (burgerMenu) burgerMenu.style.display = 'none';
}
