// Mode Modal UI
import { renderModeButtons, ensureModeButtonStyles } from './buttons.js';

export async function showModeModal({ onModeChosen, onClose }) {
  let modal = document.getElementById('modeModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modeModal';
    modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;z-index:1000;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:#fff;padding:18px 12px;border-radius:18px;box-shadow:0 4px 24px rgba(60,60,80,0.18);min-width:240px;max-width:420px;max-height:80vh;overflow-y:auto;position:relative;">
      <button id="closeModeModalX" title="Close" style="position:absolute;top:8px;right:10px;font-size:1.3em;background:none;border:none;color:#19777e;cursor:pointer;line-height:1;width:28px;height:28px;z-index:2;">&times;</button>
      <div style="text-align:center;">
        <h2 style="margin-bottom:18px;color:#19777e;">Choose a Mode</h2>
      </div>
      <div style="margin-bottom:8px;margin-top:2px;">
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
          <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
          <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Listen</div>
          <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
        </div>
        <div id="modeModalListenGroup" style="margin-bottom:18px;"></div>
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
          <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
          <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Read</div>
          <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
        </div>
        <div id="modeModalReadGroup" style="margin-bottom:18px;"></div>
        <div style="display:flex;align-items:center;justify-content:center;margin-bottom:8px;">
          <div style="flex:1;height:1px;background:#b2d6d9;margin-right:8px;"></div>
          <div style="font-size:1.08em;color:#19777e;font-weight:600;letter-spacing:0.5px;">Spell</div>
          <div style="flex:1;height:1px;background:#b2d6d9;margin-left:8px;"></div>
        </div>
        <div id="modeModalSpellGroup" style="margin-bottom:0px;"></div>
      </div>
      <div style="text-align:center;margin-top:18px;">
        <button id="closeModeModal" style="font-size:1em;padding:8px 22px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
      </div>
    </div>`;

  ensureModeButtonStyles();
  // Decide availability for picture modes: require at least 4 picturable items (img or emoji)
  const wl = (window.WordArcade && typeof window.WordArcade.getWordList === 'function') ? window.WordArcade.getWordList() : [];
  let picturableKeys = new Set();
  if (Array.isArray(wl) && wl.length) {
    wl.forEach(w => {
      if (!w) return;
      if (w.img) {
        const key = w.eng ? String(w.eng).toLowerCase() : String(w.img);
        picturableKeys.add(key);
      }
    });
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

  // Group modes
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

  // Render each group with improved spacing
  renderModeButtons(
    modal.querySelector('#modeModalListenGroup'),
    listenModes,
    {
      columns: 2,
      buttonHeight: '110px',
      onClick: (id) => {
        modal.style.display = 'none';
        if (onModeChosen) onModeChosen(id);
      }
    }
  );
  renderModeButtons(
    modal.querySelector('#modeModalReadGroup'),
    readModes,
    {
      columns: 2,
      buttonHeight: '110px',
      onClick: (id) => {
        modal.style.display = 'none';
        if (onModeChosen) onModeChosen(id);
      }
    }
  );
  renderModeButtons(
    modal.querySelector('#modeModalSpellGroup'),
    spellModes,
    {
      columns: 2,
      buttonHeight: '110px',
      onClick: (id) => {
        modal.style.display = 'none';
        if (onModeChosen) onModeChosen(id);
      }
    }
  );

  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  modal.style.display = 'flex';
  document.getElementById('closeModeModal').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
  document.getElementById('closeModeModalX').onclick = () => {
    modal.style.display = 'none';
    if (onClose) onClose();
  };
}
