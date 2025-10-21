// Phonics Learning Modal
// Guides users through: Category → Specific Level → Word List → Game Mode

import { showModeModal } from './mode_modal.js';

function ensurePhonicsModalStyles() {
  if (document.getElementById('phonics-modal-styles')) return;
  const style = document.createElement('style');
  style.id = 'phonics-modal-styles';
  style.textContent = `
    .phonics-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: linear-gradient(120deg, rgba(25, 119, 126, 0.22) 0%, rgba(255, 255, 255, 0.18) 100%);
      backdrop-filter: blur(12px) saturate(1.2);
      -webkit-backdrop-filter: blur(12px) saturate(1.2);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .phonics-modal-container {
      width: 95vw;
      max-width: 420px;
      max-height: 85vh;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: 'Poppins', Arial, sans-serif;
    }
    .phonics-modal-header {
      position: sticky;
      top: 0;
      background: #f6feff;
      border-bottom: 2px solid #a9d6e9;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
    }
    .phonics-modal-header span {
      font-size: 1.3em;
      color: #19777e;
      font-weight: 700;
    }
    .phonics-modal-close {
      cursor: pointer;
      border: none;
      background: transparent;
      color: #19777e;
      font-size: 20px;
      font-weight: 700;
      padding: 0;
    }
    .phonics-modal-list {
      padding: 12px 0;
      overflow: auto;
      flex: 1;
    }
    .phonics-category-btn {
      width: 100%;
      height: auto;
      margin: 0;
      background: none;
      border: none;
      font-size: 1.1rem;
      cursor: pointer;
      font-family: 'Poppins', Arial, sans-serif;
      color: #19777e;
      padding: 12px 18px;
      border-radius: 10px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.2s;
    }
    .phonics-category-btn:hover {
      background: rgba(25, 119, 126, 0.08);
    }
    .phonics-category-emoji {
      font-size: 2em;
      flex-shrink: 0;
      margin-right: 12px;
    }
    .phonics-modal-buttons {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 0 18px 12px 18px;
      flex-wrap: wrap;
    }
    .phonics-modal-btn {
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      border: none;
      box-shadow: 0 2px 8px rgba(60, 60, 80, 0.08);
      cursor: pointer;
      font-family: 'Poppins', Arial, sans-serif;
    }
    .phonics-modal-btn-cancel {
      background: #93cbcf;
      color: #fff;
    }
    .phonics-modal-btn-back {
      background: #eceff1;
      color: #19777e;
    }
  `;
  document.head.appendChild(style);
}

export function showPhonicsModal({ onChoose, onClose }) {
  ensurePhonicsModalStyles();
  
  let modal = document.getElementById('phonicsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'phonicsModal';
    modal.className = 'phonics-modal-overlay';
    document.body.appendChild(modal);
  }

  // Phonics Categories with child-friendly names
  const categories = [
    {
      id: 'short-vowels',
      label: 'Sound Starters',
      emoji: '🎵',
      sublabel: 'Short Vowel Sounds',
      folder: 'short-vowels',
      lists: [
        { label: 'Short A Sound', file: 'short-a.json', emoji: '🐱' },
        { label: 'Short E Sound', file: 'short-e.json', emoji: '🥚' },
        { label: 'Short I Sound', file: 'short-i.json', emoji: '🏠' },
        { label: 'Short O Sound', file: 'short-o.json', emoji: '🐕' },
        { label: 'Short U Sound', file: 'short-u.json', emoji: '☀️' }
      ]
    },
    {
      id: 'long-vowels',
      label: 'Long Sound Builders',
      emoji: '📖',
      sublabel: 'Long Vowel Sounds',
      folder: 'long-vowels',
      lists: [
        { label: 'Long A Sound', file: 'long-a.json', emoji: '🍰' },
        { label: 'Long E Sound', file: 'long-e.json', emoji: '🐝' },
        { label: 'Long I Sound', file: 'long-i.json', emoji: '🍦' },
        { label: 'Long O Sound', file: 'long-o.json', emoji: '🌊' },
        { label: 'Long U Sound', file: 'long-u.json', emoji: '🐮' }
      ]
    },
    {
      id: 'consonant-clusters',
      label: 'Blend Masters',
      emoji: '⚡',
      sublabel: 'Consonant Blends & Clusters',
      folder: 'consonant-blends',
      lists: [
        { label: 'Blend: BL, BR', file: 'blend-br-bl.json', emoji: '🎈' },
        { label: 'Blend: CL, CR', file: 'blend-cr-cl.json', emoji: '☁️' },
        { label: 'Blend: DR, FL, FR', file: 'blend-dr-fl-fr.json', emoji: '🌸' },
        { label: 'Blend: GL, GR', file: 'blend-gr-gl.json', emoji: '🍇' },
        { label: 'Blend: PL, PR', file: 'blend-pl-pr-sc.json', emoji: '🌳' },
        { label: 'Blend: SK, SL, SM, SN, SP, ST, SW', file: 'blend-sk-sl-sm-sn-sp-st-sw.json', emoji: '⭐' },
        { label: 'Blend: TR, TW', file: 'blend-tr-tw.json', emoji: '🎄' }
      ]
    }
  ];

  // Phonics Modes
  // We will reuse the global mode selector UI; keep this for future use
  const phonic_modes = [
    { id: 'listen', label: 'Listen & Pick', emoji: '👂', desc: 'Hear the word, choose the picture' },
    { id: 'read', label: 'Read & Find', emoji: '👀', desc: 'See the word, find the picture' },
    { id: 'missing_letter', label: 'Missing Letter', emoji: '❓', desc: 'Hear the word, pick the missing letter' },
    { id: 'spelling', label: 'Spell It Out', emoji: '✏️', desc: 'Hear the word, spell it out' }
  ];

  function renderCategoryMenu() {
    modal.innerHTML = `
      <div class="phonics-modal-container">
        <div class="phonics-modal-header">
          <span data-i18n="Phonics Levels">Phonics Levels</span>
          <button class="phonics-modal-close" id="phonicsCloseX" title="Close">✕</button>
        </div>
        <div class="phonics-modal-list" id="phoneticsCategoryList"></div>
        <div class="phonics-modal-buttons">
          <button class="phonics-modal-btn phonics-modal-btn-cancel" id="phonicsCancel" data-i18n="Cancel">Cancel</button>
        </div>
      </div>
    `;

    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    document.getElementById('phonicsCloseX').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('phonicsCancel').onclick = () => { modal.style.display = 'none'; onClose?.(); };

    const list = document.getElementById('phoneticsCategoryList');
    list.innerHTML = categories.map((cat, i) => `
      <button class="phonics-category-btn" data-idx="${i}">
        <span class="phonics-category-emoji">${cat.emoji}</span>
        <div style="text-align: right; flex: 1;">
          <div style="font-weight: 600; font-size: 1.05em;">${cat.label}</div>
          <div style="font-size: 0.85em; color: #666; font-weight: 400;">${cat.sublabel}</div>
        </div>
      </button>
    `).join('');

    Array.from(list.children).forEach((btn) => {
      btn.onclick = () => {
        renderSubcategoryMenu(categories[Number(btn.getAttribute('data-idx'))]);
      };
    });

    modal.style.display = 'flex';
    if (window.StudentLang && typeof window.StudentLang.applyTranslations === 'function') {
      window.StudentLang.applyTranslations();
    }
  }

  function renderSubcategoryMenu(category) {
    modal.innerHTML = `
      <div class="phonics-modal-container">
        <div class="phonics-modal-header">
          <span>${category.label}</span>
          <button class="phonics-modal-close" id="phonicsCloseX" title="Close">✕</button>
        </div>
        <div class="phonics-modal-list" id="phonicsSubcategoryList"></div>
        <div class="phonics-modal-buttons">
          <button class="phonics-modal-btn phonics-modal-btn-back" id="phonicsBack">← Back</button>
          <button class="phonics-modal-btn phonics-modal-btn-cancel" id="phonicsCancel" data-i18n="Cancel">Cancel</button>
        </div>
      </div>
    `;

    modal.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    document.getElementById('phonicsCloseX').onclick = () => { modal.style.display = 'none'; };
    document.getElementById('phonicsBack').onclick = renderCategoryMenu;
    document.getElementById('phonicsCancel').onclick = () => { modal.style.display = 'none'; onClose?.(); };

    const list = document.getElementById('phonicsSubcategoryList');
    list.innerHTML = category.lists.map((item, i) => `
      <button class="phonics-category-btn" data-idx="${i}">
        <span class="phonics-category-emoji">${item.emoji}</span>
        <span style="font-weight: 600; flex: 1; text-align: right;">${item.label}</span>
      </button>
    `).join('');

    Array.from(list.children).forEach((btn) => {
      btn.onclick = () => {
        const itemIndex = Number(btn.getAttribute('data-idx'));
        const selectedList = category.lists[itemIndex];
        renderModeMenu(selectedList, category);
      };
    });

    modal.style.display = 'flex';
  }

  // Instead of showing modes inside this modal, close it and let the global
  // mode selector render colorful cards. This fixes the duplicate UI layer.
  function renderModeMenu(listItem, category) {
    // Immediately close the modal and propagate selection upward
    modal.style.display = 'none';
    modal.remove();
    if (onChoose) {
      onChoose({
        listFile: `phonics-lists/${category.folder}/${listItem.file}`,
        // Do not force a mode here; the mode selector will be shown next
        mode: null,
        listName: listItem.label
      });
    }
  }

  // Start with category menu
  renderCategoryMenu();
}
