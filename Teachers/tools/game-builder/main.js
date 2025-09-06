// Game Builder - desktop-first, mobile-friendly
// Reuses Pixabay search (via Netlify), drag-and-drop, and OpenAI proxy for kid-friendly definitions

import { 
  initImageSystem, 
  hasValidImageUrl, 
  applyWorksheetImages as applyWorksheetImagesFromModule, 
  loadImagesForMissingOnly, 
  loadImageForRow,
  setupImageDropZone, 
  generateImageDropZoneHTML,
  escapeHtml
} from './images.js';
import { initMintAiListBuilder } from './MintAi-list-builder.js';
import { initCreateGameModal, openCreateGameModal } from './create-game-modal.js';

// DOM refs
const rowsEl = document.getElementById('rows');
const titleEl = document.getElementById('titleInput');
const addWordLink = document.getElementById('addWordLink');
const loadWorksheetsLink = document.getElementById('loadWorksheetsLink');
const openLink = document.getElementById('openLink');
const saveLink = document.getElementById('saveLink');
const previewBtn = document.getElementById('previewBtn');
const createGameLink = document.getElementById('createGameLink');
const editListLink = document.getElementById('editListLink');
const editListModal = document.getElementById('editListModal');
const editListModalClose = document.getElementById('editListModalClose');
const editListRaw = document.getElementById('editListRaw');
const editListSave = document.getElementById('editListSave');
const editListCancel = document.getElementById('editListCancel');
// Edit List modal logic
function showEditListModal() {
  if (!editListModal) return;
  // Populate textarea with current list
  editListRaw.value = list.map(w => `${w.eng || ''}, ${w.kor || ''}`.trim()).join('\n');
  editListModal.style.display = 'flex';
}
function hideEditListModal() {
  if (editListModal) editListModal.style.display = 'none';
}
if (editListLink) editListLink.onclick = (e) => { e.preventDefault(); showEditListModal(); };
if (editListModalClose) editListModalClose.onclick = hideEditListModal;
if (editListCancel) editListCancel.onclick = hideEditListModal;
if (editListSave) editListSave.onclick = () => {
  if (!editListRaw) return;
  const lines = editListRaw.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const newRows = lines.map(line => {
    const [eng, kor] = line.split(',').map(s => (s || '').trim());
    return newRow({ eng, kor });
  }).filter(r => r.eng);
  if (newRows.length) {
    saveState();
    list = newRows;
    render();
    hideEditListModal();
    toast('List updated');
  } else {
    toast('No valid words');
  }
};

const getTranslationsLink = document.getElementById('getTranslationsLink');
const enablePicturesEl = document.getElementById('enablePictures');
const enableDefinitionsEl = document.getElementById('enableDefinitions');
const statusEl = document.getElementById('status');
const fileModal = document.getElementById('fileModal');
const fileList = document.getElementById('fileList');
const fileModalClose = document.getElementById('fileModalClose');

// State
let list = [];
let loadingImages; // from image system

// Undo/Redo functionality
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STACK = 50;

// Initialize image system
const imageSystem = initImageSystem();
loadingImages = imageSystem.loadingImages;

// Default: enable pictures and definitions
if (enablePicturesEl) enablePicturesEl.checked = true;
if (enableDefinitionsEl) enableDefinitionsEl.checked = true;

// Wire Create Game modal
if (createGameLink) {
  createGameLink.onclick = (e) => {
    e.preventDefault();
    openCreateGameModal();
  };
}

// Undo/Redo functions
function saveState() {
  undoStack.push(JSON.parse(JSON.stringify(list)));
  if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();
  redoStack = [];
}
function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.parse(JSON.stringify(list)));
  list = undoStack.pop();
  render();
  toast('Undone');
}
function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.parse(JSON.stringify(list)));
  list = redoStack.pop();
  render();
  toast('Redone');
}
// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
});

function newRow(data = {}) {
  return {
    eng: data.eng || '',
    kor: data.kor || '',
    image_url: data.image_url || '',
    definition: data.definition || ''
  };
}

function render() {
  rowsEl.innerHTML = '';
  // If images or definitions are disabled, add a class to the table for CSS hiding
  const wordTable = document.querySelector('.word-table');
  if (wordTable) {
    if (enablePicturesEl && !enablePicturesEl.checked) {
      wordTable.classList.add('hide-images');
    } else {
      wordTable.classList.remove('hide-images');
    }
    if (enableDefinitionsEl && !enableDefinitionsEl.checked) {
      wordTable.classList.add('hide-definitions');
    } else {
      wordTable.classList.remove('hide-definitions');
    }
  }
  list.forEach((w, i) => {
    const tr = document.createElement('tr');
    const isLoading = loadingImages.has(i);
    const dzInner = generateImageDropZoneHTML(w, i, isLoading, escapeHtml);
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><input class="row-input" data-field="eng" data-idx="${i}" value="${escapeHtml(w.eng)}" placeholder="English" /></td>
      <td><input class="row-input" data-field="kor" data-idx="${i}" value="${escapeHtml(w.kor)}" placeholder="Korean" /></td>
      <td>
        <div class="drop-zone" data-idx="${i}">
          ${dzInner}
        </div>
      </td>
      <td>
        <div style="display:flex; gap:8px; align-items:center;">
          <textarea class="row-input" data-field="definition" data-idx="${i}" rows="2" placeholder="Definition (optional)">${escapeHtml(w.definition || '')}</textarea>
        </div>
      </td>
      <td>
        <button class="btn small icon" title="Remove" aria-label="Remove" data-action="delete" data-idx="${i}">×</button>
      </td>
    `;
    rowsEl.appendChild(tr);
  });
  bindRowEvents();
}

// Import list from Word Builder (wordtest) via localStorage if present
(function importFromWordTestIfPresent() {
  try {
    const raw = localStorage.getItem('gameBuilderWordList');
    if (!raw) return;
    localStorage.removeItem('gameBuilderWordList');

    let title = '';
    let book = '';
    let unit = '';
    let image = '';
    let rows = [];
    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) {}

    if (parsed && typeof parsed === 'object' && (parsed.wordList || parsed.words)) {
      title = parsed.title || '';
      book = parsed.book || '';
      unit = parsed.unit || '';
      image = parsed.image || '';
      // Prefer structured words if present
      if (Array.isArray(parsed.words)) {
        rows = parsed.words.map((w) => newRow({
          eng: (w && (w.eng || w.en)) || (typeof w === 'string' ? String(w).split(/[,|]/)[0]?.trim() : ''),
          kor: (w && (w.kor || w.kr || w.translation)) || (typeof w === 'string' ? String(w).split(/[,|]/)[1]?.trim() : ''),
          image_url: (w && (w.image_url || w.image)) || '',
          definition: (w && w.definition) || ''
        })).filter(r => r.eng);
      }
      // If not, try to parse wordList
      if (!rows.length && typeof parsed.wordList === 'string') {
        // Try JSON array first
        try {
          const arr = JSON.parse(parsed.wordList);
          if (Array.isArray(arr)) {
            rows = arr.map((w) => {
              if (typeof w === 'string') {
                const [eng, kor] = w.split(/[,|]/).map(s => (s || '').trim());
                return newRow({ eng, kor });
              }
              return newRow({
                eng: w.eng || w.en || '',
                kor: w.kor || w.kr || w.translation || '',
                image_url: w.image_url || w.image || '',
                definition: w.definition || ''
              });
            }).filter(r => r.eng);
          }
        } catch (_) {}
        if (!rows.length) {
          // Support raw text: one pair per line: "english, korean"
          const lines = parsed.wordList.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          rows = lines.map(line => {
            const [eng, kor] = line.split(/[,|]/).map(s => (s || '').trim());
            return newRow({ eng, kor });
          }).filter(r => r.eng);
        }
      }
      // Apply worksheet-level images when provided (parsed.images may be JSON string)
      let imagesField = parsed.images;
      if (typeof imagesField === 'string') {
        try { imagesField = JSON.parse(imagesField); } catch (_) {}
      }
      if (imagesField && rows.length) {
        applyWorksheetImages(rows, imagesField, parsed.words || parsed.wordList);
      }
    } else if (parsed && Array.isArray(parsed)) {
      rows = parsed.map((w) => {
        if (typeof w === 'string') {
          const [eng, kor] = w.split(/[,|]/).map(s => (s || '').trim());
          return newRow({ eng, kor });
        }
        return newRow({
          eng: w.eng || w.en || '',
          kor: w.kor || w.kr || w.translation || '',
          image_url: w.image_url || w.image || '',
          definition: w.definition || ''
        });
      }).filter(r => r.eng);
    } else if (typeof raw === 'string') {
      // Support raw text: one pair per line: "english, korean"
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      rows = lines.map(line => {
        const [eng, kor] = line.split(/[,|]/).map(s => (s || '').trim());
        return newRow({ eng, kor });
      }).filter(r => r.eng);
    }

    if (title && titleEl) titleEl.value = title;
    if (book) {
      const bookEl = document.getElementById('gameBook');
      if (bookEl) bookEl.value = book;
    }
    if (unit) {
      const unitEl = document.getElementById('gameUnit');
      if (unitEl) unitEl.value = unit;
    }
    if (image) {
      const imgZone = document.getElementById('gameImageZone');
      if (imgZone) {
        imgZone.innerHTML = `<img src="${image}" alt="Game Image" style="max-width:100%;max-height:100px;border-radius:8px;">`;
      }
    }
    if (rows.length) {
      saveState();
      list = rows;
      render();
      toast('Imported list from Word Builder');
    }
  } catch (e) {
    console.warn('Import from Word Builder failed:', e);
  }
})();

function bindRowEvents() {
  // Inputs - save state on blur (when user finishes editing)
  rowsEl.querySelectorAll('input.row-input, textarea.row-input').forEach((el) => {
    let originalValue = el.value;
    
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx, 10);
      const field = el.dataset.field;
      if (list[idx]) list[idx][field] = el.value;
    });
    
    el.addEventListener('focus', () => {
      originalValue = el.value;
    });
    
    el.addEventListener('blur', () => {
      if (el.value !== originalValue) {
        saveState(); // Save state when user finishes editing and value changed
      }
    });
  });

  // Delete
  rowsEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx, 10);
      saveState(); // Save state before deletion
      list.splice(idx, 1);
      render();
    };
  });

  // (AI per-row button removed)

  // Drop zones
  rowsEl.querySelectorAll('.drop-zone').forEach(zone => {
    const idx = parseInt(zone.dataset.idx, 10);
    setupImageDropZone(zone, idx, list, render, escapeHtml, saveState);
  });
}

function toast(msg) {
  statusEl.textContent = msg;
  setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 2000);
}


function buildPayload() {
  return {
    title: titleEl.value || 'Untitled Game',
    words: list.map(w => ({
      eng: w.eng || '',
      kor: w.kor || '',
      image_url: w.image_url || '',
      definition: w.definition || ''
    }))
  };
}

// Toolbar actions
addWordLink.onclick = () => { 
  saveState(); // Save state before adding
  list.push(newRow()); 
  render(); 
};
previewBtn.onclick = () => {
  const data = buildPayload();
  console.log('Preview JSON', data);
  alert(JSON.stringify(data, null, 2));
};

// Get translations for rows that have English but missing Korean
if (getTranslationsLink) {
  getTranslationsLink.onclick = async (e) => {
    e.preventDefault();
    const pending = list
      .map((row, idx) => ({ eng: (row.eng || '').trim(), idx }))
      .filter(x => x.eng && !(list[x.idx].kor || '').trim());
    if (!pending.length) { toast('No untranslated words'); return; }

    try {
      getTranslationsLink.classList.add('disabled');
      const words = pending.map(p => p.eng).join('\n');
      const prompt = `Translate the following English words into natural Korean used in everyday speech.\nReturn ONLY the Korean translations, one per line, same order, no numbering or extra text.\n\n${words}`;
      const res = await fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const js = await res.json();
      let text = (js?.result || '').trim();
      if (!text) { toast('No translations returned'); return; }

      // Normalize bullets/numbers if model added them
      const lines = text
        .split(/\r?\n/)
        .map(l => l.replace(/^\s*[-*•]?\s*\d+[).]?\s*/, '').trim())
        .filter(Boolean);
      if (!lines.length) { toast('Parse error'); return; }

      saveState();
      const n = Math.min(lines.length, pending.length);
      for (let i = 0; i < n; i++) {
        list[pending[i].idx].kor = lines[i];
      }
      render();
      toast('Translations added');
    } catch (err) {
      console.error(err);
      toast('Translation error');
    } finally {
      getTranslationsLink.classList.remove('disabled');
    }
  };
}

// Load from worksheets via manager (vocab only, require words)
loadWorksheetsLink.onclick = () => {
  const url = '/Teachers/worksheet_manager.html?mode=load&require_words=1';
  window.open(url, 'worksheetManager', 'width=1100,height=800');
};

// Receive worksheet from manager and import words
window.loadWorksheet = function(worksheet) {
  try {
    console.log('Loading worksheet:', worksheet);
    const wordsField = worksheet?.words;
    let rows = [];
    if (Array.isArray(wordsField)) {
      rows = wordsField.map(w => {
        if (typeof w === 'string') {
          const [eng, kor] = w.split(',').map(s => s.trim());
          return newRow({ eng, kor });
        }
        return newRow({
          eng: w.eng || w.en || '',
          kor: w.kor || w.kr || w.translation || '',
          image_url: w.image_url || w.image || '',
          definition: w.definition || ''
        });
      });
    } else if (typeof wordsField === 'string') {
      // Try JSON-parsed array first (to retain images/definitions)
      let parsed = null;
      try { parsed = JSON.parse(wordsField); } catch (_) { /* not JSON */ }
      if (Array.isArray(parsed)) {
        rows = parsed.map(w => {
          if (typeof w === 'string') {
            const [eng, kor] = w.split(',').map(s => s.trim());
            return newRow({ eng, kor });
          }
          const img = w.image_url || w.image || w.img || w.img_url || w.picture || '';
          return newRow({
            eng: w.eng || w.en || '',
            kor: w.kor || w.kr || w.translation || '',
            image_url: img,
            definition: w.definition || ''
          });
        });
      } else {
        // Support newline or comma separated simple strings
        const parts = wordsField.includes('\n') ? wordsField.split('\n') : wordsField.split(',');
        rows = parts.map(s => {
          const [eng, kor] = s.split(',').map(t => (t || '').trim());
          return newRow({ eng, kor });
        }).filter(r => r.eng);
      }
    }
    
    // Apply worksheet-level images from multiple possible sources
    const imageSources = [
      worksheet?.images,           // Direct images field
      worksheet?.image_data,       // Alternative naming
      worksheet?.savedImageData    // From wordtest-style saves
    ].filter(Boolean);
    
    console.log('Available image sources:', imageSources);
    
    for (const imageSource of imageSources) {
      if (imageSource) {
        console.log('Applying images from source:', imageSource);
        applyWorksheetImages(rows, imageSource, wordsField);
      }
    }
    
    if (rows.length === 0) {
      toast('No words found in selected worksheet');
      return;
    }
    
    saveState(); // Save state before loading worksheet
    titleEl.value = worksheet.title || titleEl.value || '';
    list = rows;
    
    // Log final rows with image data for debugging
    console.log('Final rows with images:', rows.map(r => ({ eng: r.eng, has_image: !!r.image_url })));
    
    render();
    // Only auto-fill missing data (don't overwrite existing images)
    (async () => {
      if (enablePicturesEl.checked) await loadImagesForMissingOnly(list, loadingImages, render);
      if (enableDefinitionsEl.checked) await generateDefinitionsForMissing();
    })();
    toast('Imported from Worksheet Manager');
  } catch (e) {
    console.error('Import error', e);
    toast('Import failed');
  }
};

function applyWorksheetImages(rows, imagesField, originalWords) {
  // Use the imported function from images.js
  applyWorksheetImagesFromModule(rows, imagesField, originalWords);
}

saveLink.onclick = async () => {
  const payload = buildPayload();
  if (!payload.title || payload.words.length === 0) {
    toast('Need title and at least 1 word');
    return;
  }
  saveLink.classList.add('disabled');
  try {
    const res = await fetch('/.netlify/functions/supabase_proxy_fixed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'insert_game_data', data: payload })
    });
    const js = await res.json();
    if (js?.success) toast('Saved'); else toast(js?.error || 'Save failed');
  } catch (e) {
    console.error(e);
    toast('Save error');
  } finally {
    saveLink.classList.remove('disabled');
  }
}

// Basic burger menu toggle
(function setupBurger() {
  const toggle = document.getElementById('burger-toggle');
  const menu = document.getElementById('burger-menu');
  if (toggle && menu) toggle.onclick = () => { menu.style.display = (menu.style.display === 'none' || !menu.style.display) ? 'block' : 'none'; };
})();

// Auto behaviors for toggles
enableDefinitionsEl.addEventListener('change', async () => {
  render(); // Always re-render to hide/show definitions
  if (enableDefinitionsEl.checked) {
    await generateDefinitionsForMissing();
  }
});

enablePicturesEl.addEventListener('change', async () => {
  render(); // Always re-render to hide/show images
  if (enablePicturesEl.checked) {
    await loadImagesForMissingOnly(list, loadingImages, render);
  }
});

async function generateDefinitionsForMissing() {
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w) continue;
    if (w.definition && w.definition.trim()) continue;
    await generateDefinitionForRow(i);
  }
}

async function generateDefinitionForRow(idx) {
  const w = list[idx];
  if (!w || !w.eng || !w.kor) return;
  const target = w.eng.trim();
  const prompt = `Write a concise, kid-friendly definition that does NOT include or repeat the word "${target}". Consider the Korean meaning "${w.kor}" as context. Keep it simple for young learners, one short sentence.`;
  try {
    const res = await fetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const js = await res.json();
    let def = (js?.result || '').trim();
    if (!def) return;
    
    // Clean up conversational AI responses - extract just the definition
    def = cleanDefinitionResponse(def);
    if (!def) return;
    // Remove any Korean (Hangul) characters and the exact Korean word if present
    def = def.replace(/[\uAC00-\uD7AF]+/g, '');
    if (w.kor) {
      const esc = w.kor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      def = def.replace(new RegExp(esc, 'g'), '');
    }
    def = def.replace(/\s{2,}/g, ' ').trim();
    
    // Ensure it does not contain the target word (case-insensitive); if it does, attempt a simple fix
    const re = new RegExp(`\\b${escapeRegExp(target)}\\b`, 'i');
    if (re.test(def)) {
      // Remove the target word and trim punctuation
      def = def.replace(re, '').replace(/\s{2,}/g, ' ').replace(/^\W+|\W+$/g, '').trim();
    }
    // Capitalize first letter; ensure it ends with a period
    def = def.charAt(0).toUpperCase() + def.slice(1);
    if (!/[.!?]$/.test(def)) def += '.';
    w.definition = def;
    render();
  } catch (e) {
    console.error(e);
  }
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function cleanDefinitionResponse(text) {
  // Remove conversational AI prefixes and suffixes
  let cleaned = text
    .replace(/^(here\s+is\s+a\s+concise\s+definition\s+for\s+["""][^"""]*["""]\s+without\s+using\s+the\s+word\s+itself:\s*["""]\s*)/i, '')
    .replace(/^(kid-friendly\s+definition:\s*)/i, '')
    .replace(/^(sure[,!]?\s*)?(i['']?ll\s+)?(?:give\s+you\s+)?(?:a\s+)?(?:definition\s+)?(?:for\s+)?(?:that\s+word[.!]?\s*)?/i, '')
    .replace(/^(here['']?s\s+)?(?:a\s+)?(?:definition\s+)?(?:for\s+)?(?:that\s+word[.!]?\s*)?/i, '')
    .replace(/^(the\s+)?(?:definition\s+)?(?:of\s+)?(?:this\s+word\s+)?(?:is[:\s]*)?/i, '')
    .replace(/\s*(?:hope\s+)?(?:this\s+)?(?:helps[!.]?)?$/i, '')
    .replace(/\s*(?:let\s+me\s+know\s+if\s+you\s+need\s+anything\s+else[!.]?)?$/i, '')
    .trim();
  
  // If it starts with quotes, try to extract the quoted content
  if (cleaned.startsWith('"') && cleaned.includes('"', 1)) {
    const match = cleaned.match(/^"([^"]+)"/);
    if (match) cleaned = match[1].trim();
  }
  
  // Remove any remaining conversational fragments
  cleaned = cleaned.replace(/^(well[,\s]*)?/i, '').trim();
  
  return cleaned;
}

async function loadPicturesForMissing() {
  // Deprecated - use loadImagesForMissingOnly from images.js instead
  await loadImagesForMissingOnly(list, loadingImages, render);
}

// File modal: list previously saved game_data and open
openLink.onclick = async () => {
  await populateFileList();
  fileModal.style.display = 'flex';
};
fileModalClose.onclick = () => { fileModal.style.display = 'none'; };
window.addEventListener('click', (e) => { if (e.target === fileModal) fileModal.style.display = 'none'; });

async function populateFileList() {
  fileList.innerHTML = '<div class="status">Loading…</div>';
  try {
    // Reuse supabase_proxy_fixed list via a new lightweight path: list game_data
    const res = await fetch('/.netlify/functions/supabase_proxy_fixed?list=game_data');
    const js = await res.json();
    const rows = js?.data || js || [];
    if (!Array.isArray(rows) || rows.length === 0) {
      fileList.innerHTML = '<div class="status">No saved games yet.</div>';
      return;
    }
    fileList.innerHTML = '';
    rows.forEach(r => {
      const div = document.createElement('div');
      div.className = 'file-row';
      const t = (r.title || 'Untitled');
      const when = r.created_at ? new Date(r.created_at).toLocaleString() : '';
      div.innerHTML = `
        <div><strong>${escapeHtml(t)}</strong><div class="status">${when}</div></div>
        <div class="file-actions">
          <a href="#" data-act="open" data-id="${r.id}">Open</a>
          <a href="#" data-act="rename" data-id="${r.id}">Rename</a>
          <a href="#" data-act="delete" data-id="${r.id}">Delete</a>
        </div>
      `;
      fileList.appendChild(div);
    });
    // Bind actions
    fileList.querySelectorAll('a[data-act]').forEach(a => {
      a.onclick = async (ev) => {
        ev.preventDefault();
        const id = a.dataset.id;
        const act = a.dataset.act;
        if (act === 'open') await openGameData(id);
        else if (act === 'rename') await renameGameData(id);
        else if (act === 'delete') await deleteGameData(id);
      };
    });
  } catch (e) {
    console.error(e);
    fileList.innerHTML = '<div class="status">Error loading files.</div>';
  }
}

async function openGameData(id) {
  try {
    const res = await fetch(`/.netlify/functions/supabase_proxy_fixed?get=game_data&id=${encodeURIComponent(id)}`);
    const js = await res.json();
    const r = js?.data || js;
    if (!r) return;
    // Normalize words: can be array, JSON string, or nested/dictionary shape
    let words = r.words;
    if (typeof words === 'string') {
      try { words = JSON.parse(words); } catch {}
    }
    if (!Array.isArray(words) && words && typeof words === 'object') {
      if (Array.isArray(words.words)) words = words.words;
      else if (Array.isArray(words.data)) words = words.data;
      else if (Array.isArray(words.items)) words = words.items;
      else {
        const vals = Object.keys(words).sort((a,b)=>Number(a)-Number(b)).map(k => words[k]);
        if (vals.length) words = vals;
      }
    }
    if (!Array.isArray(words)) return;

    saveState(); // Save state before opening
    titleEl.value = r.title || '';
    list = (words || []).map(w => {
      if (typeof w === 'string') {
        const parts = w.split(/[,|]/);
        return newRow({ eng: (parts[0]||'').trim(), kor: (parts[1]||'').trim() });
      }
      return newRow({
        eng: w.eng || w.en || w.word || '',
        kor: w.kor || w.kr || w.translation || '',
        image_url: w.image_url || w.image || w.img || w.img_url || w.picture || '',
        definition: w.definition || w.def || w.gloss || w.meaning || ''
      });
    });
    render();
    fileModal.style.display = 'none';
    // Auto-fill missing data based on toggles (preserve existing images)
    (async () => {
      if (enablePicturesEl.checked) await loadImagesForMissingOnly(list, loadingImages, render);
      if (enableDefinitionsEl.checked) await generateDefinitionsForMissing();
    })();
  } catch (e) { console.error(e); }
}

async function renameGameData(id) {
  const t = prompt('New title?');
  if (!t) return;
  await fetch('/.netlify/functions/supabase_proxy_fixed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rename_game_data', id, title: t }) });
  await populateFileList();
}

async function deleteGameData(id) {
  if (!confirm('Delete this saved game?')) return;
  await fetch('/.netlify/functions/supabase_proxy_fixed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete_game_data', id }) });
  await populateFileList();
}

// Initialize Mint AI List Builder now that dependencies exist
initMintAiListBuilder({
  getList: () => list,
  addItems: (items) => {
    saveState();
    const start = list.length;
    items.forEach(it => list.push({ eng: it.eng, kor: it.kor, image_url: '', definition: '' }));
    render();
    return { from: start, to: list.length - 1 };
  },
  render,
  enablePicturesEl,
  enableDefinitionsEl,
  loadingImages,
  generateDefinitionForRow
});

// Initialize Create Game modal
initCreateGameModal(buildPayload);
