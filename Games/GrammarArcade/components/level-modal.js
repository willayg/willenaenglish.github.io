// Lightweight Levels modal (no framework)
// Usage:
//   import { initLevelsModal, openLevelsModal } from './components/level-modal.js'
//   initLevelsModal({ levels, onStart: (level) => {} })
//   openLevelsModal()

let state = {
  levels: [],
  onStart: null,
  el: null,
};

export function initLevelsModal({ levels, onStart }) {
  state.levels = levels || [];
  state.onStart = onStart || (() => {});

  // Create modal root once
  const existing = document.getElementById('gaLevelsModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'gaLevelsModal';
  modal.className = 'ga-modal';
  modal.innerHTML = `
    <div class="ga-modal-content ga-levels">
      <div class="ga-levels-header">
        <div class="ga-levels-title">Choose a Level</div>
        <button type="button" class="ga-modal-btn ga-close" id="gaLevelsClose">Close</button>
      </div>
      <div class="ga-levels-grid" id="gaLevelsGrid"></div>
    </div>
  `;

  document.body.appendChild(modal);
  state.el = modal;

  // Render level cards
  const grid = modal.querySelector('#gaLevelsGrid');
  grid.innerHTML = state.levels.map(l => {
    const iconImg = l.icon ? `<img class="ga-level-icon" src="${l.icon}" alt="${l.title}" loading="lazy" />` : '';
    const locked = l.unlocked === false;
    return `
      <div class="ga-level-card ${locked ? 'locked' : ''}" data-id="${l.id}">
        <div class="ga-level-top">
          ${iconImg}
          <div class="ga-level-name">${l.title}</div>
          <div class="ga-level-desc">${l.desc || ''}</div>
        </div>
        <div class="ga-level-actions">
          <button class="ga-level-start ${locked ? 'disabled' : ''}" ${locked ? 'disabled' : ''}>Start</button>
        </div>
      </div>`;
  }).join('');

  // Events
  modal.addEventListener('click', (e) => {
    if (e.target.id === 'gaLevelsClose') {
      closeLevelsModal();
      return;
    }
    if (e.target.classList.contains('ga-level-start')) {
      const card = e.target.closest('.ga-level-card');
      const id = Number(card?.dataset?.id);
      const level = state.levels.find(l => l.id === id);
      if (!level || level.unlocked === false) return;
      closeLevelsModal();
      state.onStart(level);
    }
    // click outside content closes
    const content = modal.querySelector('.ga-modal-content');
    if (e.target === modal && content) {
      closeLevelsModal();
    }
  });
}

export function openLevelsModal() {
  state.el?.classList.add('open');
}

export function closeLevelsModal() {
  state.el?.classList.remove('open');
}
