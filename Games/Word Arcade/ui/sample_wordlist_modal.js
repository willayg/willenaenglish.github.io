// Sample Wordlist Modal
import { ensureModeButtonStyles } from './buttons.js';

export function showSampleWordlistModal({ onChoose }) {
  // Modal overlay
  let modal = document.getElementById('sampleWordlistModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'sampleWordlistModal';
    modal.style = `
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      background: linear-gradient(120deg, rgba(25,119,126,0.22) 0%, rgba(255,255,255,0.18) 100%);
      backdrop-filter: blur(12px) saturate(1.2);
      -webkit-backdrop-filter: blur(12px) saturate(1.2);
      z-index:1000;display:flex;align-items:center;justify-content:center;
    `;
    document.body.appendChild(modal);
  }
  // Category mapping
  const categories = [
    { label: 'Animals', lists: [
      { label: 'Easy Animals', file: 'EasyAnimals.json' },
      { label: 'More Animals', file: 'Animals2.json' }
    ]},
    { label: 'Food', lists: [
      { label: 'Fruits & Veggies', file: 'Food1.json' },
      { label: 'Meals & Snacks', file: 'Food2.json' },
      { label: 'World Foods', file: 'Food3.json' }
    ]},
    { label: 'Lifestyle & Activities', lists: [
      { label: 'Jobs (Easy)', file: 'EasyJobs.json' },
      { label: 'Getting Around', file: 'Transportation.json' },
      { label: 'Hobbies (Easy)', file: 'EasyHobbies.json' },
      { label: 'Sports', file: 'Sports.json' },
      { label: 'School Things', file: 'SchoolSupplies.json' },
      // Basic Words at the bottom
      { label: 'Mixed Words (All)', file: 'sample-wordlist.json' },
      { label: 'Mixed Words (15)', file: 'sample-wordlist-15.json' }
    ]},
    { label: 'Verbs & Adjectives', lists: [
      { label: 'Action Words (Easy)', file: 'EasyVerbs.json' },
      { label: 'Feelings & Emotions', file: 'Feelings.json' }
    ]},
    { label: 'Phonics', lists: [
      { label: 'Long U (Phonics)', file: 'LongU.json' }
    ]}
  ];

  // Emoji for each category
  const categoryEmojis = {
    'Animals': '🐶',
    'Food': '🍎',
    'Lifestyle & Activities': '🏃',
    'Verbs & Adjectives': '💬',
    'Phonics': '🔤'
  };
  function renderCategoryMenu() {
    modal.innerHTML = `
      <div style="width:80vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;position:relative;">
        <div id="wa-browse-header" style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;z-index:1;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px 12px;">
            <span style="font-size:1.3em;color:#19777e;font-weight:700;">Choose a Category</span>
            <button id="closeSampleWordlistModalX" title="Close" style="margin-left:auto;cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
          </div>
        </div>
        <div id="sampleCategoryList" style="padding:12px 0;overflow:auto;"></div>
        <button id="closeSampleWordlistModal" style="margin:12px 18px 12px 18px;padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
      </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModal').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModalX').onclick = () => { modal.style.display = 'none'; };
    const list = document.getElementById('sampleCategoryList');
    list.innerHTML = categories.map((cat, i) => `
      <button class="mode-btn" data-idx="${i}" style="display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:10px;">
        <span style="font-size:2em;">${categoryEmojis[cat.label] || '📚'}</span>
        <span style="font-weight:600;">${cat.label}</span>
      </button>
    `).join('');
    Array.from(list.children).forEach((btn) => {
      btn.onclick = () => {
        renderListMenu(categories[Number(btn.getAttribute('data-idx'))]);
      };
    });
    modal.style.display = 'flex';
  }

  function renderListMenu(category) {
    modal.innerHTML = `
      <div style="width:80vw;max-width:420px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:'Poppins',Arial,sans-serif;position:relative;">
        <div id="wa-browse-header" style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;z-index:1;">
          <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px 12px;">
            <span style="font-size:1.3em;color:#19777e;font-weight:700;">${category.label}</span>
            <button id="closeSampleWordlistModalX" title="Close" style="margin-left:auto;cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
          </div>
        </div>
        <div id="sampleWordlistList" style="padding:12px 0;overflow:auto;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;padding:0 18px 12px 18px;">
          <button id="backToCategories" style="padding:8px 18px;border-radius:8px;background:#eceff1;color:#19777e;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Back</button>
          <button id="closeSampleWordlistModal" style="padding:8px 18px;border-radius:8px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Cancel</button>
        </div>
      </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModal').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('closeSampleWordlistModalX').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('backToCategories').onclick = () => renderCategoryMenu();
    const list = document.getElementById('sampleWordlistList');
    ensureModeButtonStyles();
    list.className = 'mode-grid';
    list.style.gridTemplateColumns = 'repeat(1, 1fr)';
    // Emoji per sub-list
    const listEmojis = {
      'EasyAnimals.json': '🐯',
      'Animals2.json': '🐼',
      'Food1.json': '🍎',
      'Food2.json': '🍔',
      'Food3.json': '🍣',
      'EasyJobs.json': '👩‍🔧',
      'Transportation.json': '🚗',
      'EasyHobbies.json': '🎨',
      'Sports.json': '🏀',
      'SchoolSupplies.json': '✏️',
      'sample-wordlist.json': '📚',
      'sample-wordlist-15.json': '📝',
      'EasyVerbs.json': '🏃‍♂️',
      'Feelings.json': '😊',
      'LongU.json': '🦄'
    };
    list.innerHTML = category.lists.map((it, i) => {
      const emoji = listEmojis[it.file] || categoryEmojis[category.label] || '📚';
      return `<button class="mode-btn" data-idx="${i}" style="display:flex;align-items:center;gap:12px;width:100%;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:#19777e;padding:12px 18px;border-radius:10px;">
        <span style="font-size:2em;">${emoji}</span>
        <span style="font-weight:600;">${it.label}</span>
      </button>`;
    }).join('');
    Array.from(list.children).forEach((btn) => {
      btn.onclick = () => {
        modal.style.display = 'none';
        if (onChoose) onChoose(category.lists[Number(btn.getAttribute('data-idx'))].file);
      };
    });
    modal.style.display = 'flex';
  }

  renderCategoryMenu();
}
