// Word Worksheet Generator - Slim entry point
// Keep this file tiny: wire up globals and bootstrap the app.

import { initWordtest } from './init.js';
import { updatePreview } from './preview.js';
import { printFile, generatePDF } from './print.js';
import { getCurrentWorksheetData, loadWorksheet } from './worksheet_integration.js';
import { cycleImage } from './images.js';

// Expose a minimal surface for inline handlers and external pages
window.cycleImage = (word, index) => cycleImage(word, index, updatePreview);
window.getCurrentWorksheetData = getCurrentWorksheetData;
window.loadWorksheet = loadWorksheet;
window.printFile = printFile;
window.generatePDF = generatePDF;
// Backward-compat hooks used by inline scripts in the HTML
window.updatePreview = updatePreview;
window.updateWordtestPreview = updatePreview;

const VIEW_STORAGE_KEY = 'wordtest-view-mode';

function applyViewMode(mode) {
  const validMode = ['auto', 'mobile', 'desktop'].includes(mode) ? mode : 'auto';
  if (validMode === 'auto') {
    document.body.removeAttribute('data-wordtest-layout');
  } else {
    document.body.setAttribute('data-wordtest-layout', validMode);
  }
  return validMode;
}

function setupViewSelector() {
  const toolbar = document.querySelector('.floating-toolbar');
  if (!toolbar || document.getElementById('wordtestViewSelect')) return;

  let savedMode = 'auto';
  try {
    savedMode = localStorage.getItem(VIEW_STORAGE_KEY) || 'auto';
  } catch (_) {}
  savedMode = applyViewMode(savedMode);

  const select = document.createElement('select');
  select.id = 'wordtestViewSelect';
  select.className = 'wordtest-view-select';
  select.title = 'Choose how this page is laid out on this device';
  select.setAttribute('aria-label', 'Page view');
  select.innerHTML = `
    <option value="auto">View: Auto</option>
    <option value="mobile">View: Mobile</option>
    <option value="desktop">View: Desktop</option>
  `;
  select.value = savedMode;

  select.addEventListener('change', () => {
    const mode = applyViewMode(select.value);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch (_) {}
    window.scrollTo({ left: 0, behavior: 'smooth' });
  });

  toolbar.appendChild(select);
}

// Bootstrap
initWordtest();
setupViewSelector();
