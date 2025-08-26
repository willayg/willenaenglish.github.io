// Sample Wordlist Modal
import { ensureModeButtonStyles } from './buttons.js';

export function showSampleWordlistModal({ onChoose }) {
  // Modal overlay
  let modal = document.getElementById('sampleWordlistModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sampleWordlistModal';
    modal.style = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(25,119,126,0.18);z-index:1000;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = `
    <div style="background:#fff;border-radius:18px;box-shadow:0 4px 32px rgba(25,119,126,0.18);padding:18px 12px;min-width:240px;max-width:420px;max-height:80vh;overflow-y:auto;position:relative;">
      <button id="closeSampleWordlistModalX" title="Close" style="position:absolute;top:8px;right:10px;font-size:1.3em;background:none;border:none;color:#19777e;cursor:pointer;line-height:1;width:28px;height:28px;z-index:2;">&times;</button>
      <h2 style="color:#19777e;margin-bottom:18px;text-align:center;font-size:1.3em;">Choose a Sample Word List</h2>
      <div id="sampleWordlistList"></div>
      <button id="closeSampleWordlistModal" style="margin-top:8px;padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
    </div>
  `;
  modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
  document.getElementById('closeSampleWordlistModal').onclick = () => { modal.style.display = 'none'; };
  document.getElementById('closeSampleWordlistModalX').onclick = () => { modal.style.display = 'none'; };

  // List sample wordlist files (label -> filename)
  const files = [
    { label: 'Easy Animals', file: 'EasyAnimals.json' },
    { label: 'Easy Hobbies', file: 'EasyHobbies.json' },
    { label: 'Long U', file: 'LongU.json' },
    { label: 'Easy Verbs', file: 'EasyVerbs.json' },
    { label: 'Easy Jobs', file: 'EasyJobs.json' },
    { label: 'Mixed 15', file: 'sample-wordlist-15.json' },
    { label: 'Sample (All)', file: 'sample-wordlist.json' },
    { label: 'Animals 2', file: 'Animals2.json' },
    { label: 'Feelings', file: 'Feelings.json' },
    { label: 'Food 1', file: 'Food1.json' },
    { label: 'Food 2', file: 'Food2.json' },
    { label: 'Food 3', file: 'Food3.json' },
    { label: 'School Supplies', file: 'SchoolSupplies.json' },
    { label: 'Sports', file: 'Sports.json' },
    { label: 'Transportation', file: 'Transportation.json' }
  ];
  const list = document.getElementById('sampleWordlistList');
  ensureModeButtonStyles();
  // Render as a 1-column grid using shared .mode-btn for consistent look
  list.className = 'mode-grid';
  list.style.gridTemplateColumns = 'repeat(1, 1fr)';
  list.innerHTML = files.map((it, i) => `
    <button class="mode-btn" data-idx="${i}" style="--mode-btn-height: 60px;">${it.label}</button>
  `).join('');
  Array.from(list.children).forEach((btn) => {
    btn.onclick = () => {
      const i = Number(btn.getAttribute('data-idx'));
      modal.style.display = 'none';
      if (onChoose) onChoose(files[i].file);
    };
  });
  modal.style.display = 'flex';
}
