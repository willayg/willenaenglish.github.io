// File Picker UI
import { showSampleWordlistModal } from './sample_wordlist_modal.js';

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
    button.onclick = () => {
      showSampleWordlistModal({
        onChoose: async (filename) => {
          try {
            // Build absolute URL from current page to handle spaces/paths reliably
            const url = new URL(`./sample-wordlists/${filename}`, window.location.href);
            const response = await fetch(url.href, { cache: 'no-store' });
            if (!response.ok) {
              const preview = await response.text().catch(() => '');
              throw new Error(`Failed to fetch sample wordlist (${response.status}). URL: ${url.pathname}\n${preview.slice(0,120)}`);
            }
            const ct = (response.headers.get('content-type') || '').toLowerCase();
            let wordList;
            if (ct.includes('application/json')) {
              wordList = await response.json();
            } else {
              // Fallback: parse text, but surface better error if it looks like HTML
              const text = await response.text();
              if (/^\s*</.test(text)) {
                throw new Error('Received HTML instead of JSON (likely a 404). Please check the file name and path.');
              }
              wordList = JSON.parse(text);
            }
            if (typeof onFileChosen === 'function') {
              onFileChosen({ name: filename, content: wordList });
            } else {
              console.error('onFileChosen is not a function. Ensure startFilePicker() is used to open the file picker.');
              alert('Internal navigation issue. Please go Back using the header Back button or refresh the page.');
            }
          } catch (err) {
            console.error('Error loading sample wordlist:', err);
            alert('Error loading sample wordlist: ' + err.message);
          }
        }
      });
    };

  // Hide menu bar and back button on file picker screen
  const menuBar = document.getElementById('menuBar');
  if (menuBar) menuBar.style.display = 'none';
  
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.style.display = 'none';
  
  const burgerMenu = document.getElementById('burgerMenu');
  if (burgerMenu) burgerMenu.style.display = 'none';
}
