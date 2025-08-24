import { renderModeButtons, ensureModeButtonStyles } from './buttons.js';
import { showSampleWordlistModal } from './sample_wordlist_modal.js';

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

  // Clear and render title + grouped sections
  container.innerHTML = `<div style="text-align:center;padding:40px 20px;">
    <h2>Choose a Mode</h2>
    <div style="margin:8px auto 0;max-width:900px;">
      <div style="display:flex;align-items:center;justify-content:center;margin:12px 0 8px;">
        <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
        <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Listen</div>
        <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
      </div>
      <div id="modeListenGroup" style="margin-bottom:18px;"></div>
      <div style="display:flex;align-items:center;justify-content:center;margin:12px 0 8px;">
        <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
        <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Read</div>
        <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
      </div>
      <div id="modeReadGroup" style="margin-bottom:18px;"></div>
      <div style="display:flex;align-items:center;justify-content:center;margin:12px 0 8px;">
        <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
        <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Spell</div>
        <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
      </div>
      <div id="modeSpellGroup"></div>
    </div>
  </div>`;

  ensureModeButtonStyles();
  // Determine if picture modes are available: need at least 4 picturable items (img or emoji)
  const wl = (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [];
  let picturableKeys = new Set();
  if (Array.isArray(wl) && wl.length) {
    // Count items with explicit images
    wl.forEach(w => {
      if (!w) return;
      if (w.img) {
        const key = w.eng ? String(w.eng).toLowerCase() : String(w.img);
        picturableKeys.add(key);
      }
    });
    // If fewer than 4, try to add emoji-based ones
    if (picturableKeys.size < 4) {
      try {
        const resp = await fetch('./emoji-list/emoji-mappings.json');
        if (resp.ok) {
          const mappings = await resp.json();
          const flat = Object.values(mappings).reduce((acc, cat) => Object.assign(acc, cat), {});
          wl.forEach(w => {
            if (!w || !w.eng) return;
            const key = String(w.eng).toLowerCase();
            if (flat[key]) picturableKeys.add(key);
          });
        }
      } catch {}
    }
  }
  const hasPicturable = picturableKeys.size >= 4;

  // Grouped items in requested order
  const listenModes = [
    ...(hasPicturable ? [{ id: 'easy_picture', label: 'Picture Listen' }] : []),
    { id: 'listening', label: 'Listening Mode' },
  ];
  const readModes = [
    ...(hasPicturable ? [{ id: 'picture', label: 'Picture Mode' }] : []),
    { id: 'meaning', label: 'Matching Mode' },
    { id: 'multi_choice', label: 'Multiple Choice' },
  ];
  const spellModes = [
    { id: 'spelling', label: 'Translate and Spell' },
    { id: 'listen_and_spell', label: 'Listen and Spell' },
  ];

  const common = { columns: 2, buttonHeight: '120px', onClick: onModeChosen };
  renderModeButtons(container.querySelector('#modeListenGroup'), listenModes, common);
  renderModeButtons(container.querySelector('#modeReadGroup'), readModes, common);
  renderModeButtons(container.querySelector('#modeSpellGroup'), spellModes, common);
}
