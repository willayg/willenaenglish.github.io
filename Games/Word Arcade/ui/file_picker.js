// File Picker UI
export function renderFilePicker({ onFileChosen }) {
  const container = document.getElementById('gameArea');
  container.innerHTML = `<div style="text-align:center;padding:40px;">
    <h2>Choose a Word List</h2>
    <div style="margin-top: 32px;">
      <button id="loadWordsBtn" style="
        padding: 18px 32px;
        border: 2px solid #19777e;
        border-radius: 12px;
        background: #93cbcf;
        color: #fff;
        font-weight: 600;
        font-size: 18px;
        cursor: pointer;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(60,60,80,0.08);
        touch-action: manipulation;
      " onmouseover="this.style.background='#19777e'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 16px rgba(60,60,80,0.15)'; this.style.borderColor='#93cbcf'" onmouseout="this.style.background='#93cbcf'; this.style.transform='translateY(0)'; this.style.boxShadow='0 2px 8px rgba(60,60,80,0.08)'; this.style.borderColor='#19777e'">
        Choose Word List File
      </button>
      <input type="file" id="wordFileInput" accept=".json" style="display:none;">
    </div>
    <p style="margin-top: 16px; color: #666; font-size: 14px;">Select a JSON file containing your word list</p>
  </div>`;
  
  const button = document.getElementById('loadWordsBtn');
  const input = document.getElementById('wordFileInput');
  
  button.onclick = () => input.click();
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) onFileChosen(file);
  };

  // Hide menu bar and back button on file picker screen
  const menuBar = document.getElementById('menuBar');
  if (menuBar) menuBar.style.display = 'none';
  
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.style.display = 'none';
  
  const burgerMenu = document.getElementById('burgerMenu');
  if (burgerMenu) burgerMenu.style.display = 'none';
}
