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
const saveLink = document.getElementById('saveLink'); // new quick Save (silent overwrite)
const saveAsLink = document.getElementById('saveAsLink');
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
const enableExamplesEl = document.getElementById('enableExamples');
const statusEl = document.getElementById('status');
const fileModal = document.getElementById('fileModal');
const fileList = document.getElementById('fileList');
const fileModalClose = document.getElementById('fileModalClose');

// State
let list = [];
let currentGameId = null; // tracks last opened/saved game id for quick Save
let loadingImages; // from image system

// Undo/Redo functionality
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STACK = 50;

// Initialize image system
const imageSystem = initImageSystem();
loadingImages = imageSystem.loadingImages;

// Default: enable pictures, definitions, and examples
if (enablePicturesEl) enablePicturesEl.checked = true;
if (enableDefinitionsEl) enableDefinitionsEl.checked = true;
if (enableExamplesEl) enableExamplesEl.checked = true;

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
    definition: data.definition || '',
    example: data.example || data.example_sentence || ''
  };
}

function render() {
  rowsEl.innerHTML = '';
  // If images, definitions, or examples are disabled, add classes to the table for CSS hiding
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
    if (enableExamplesEl && !enableExamplesEl.checked) {
      wordTable.classList.add('hide-examples');
    } else {
      wordTable.classList.remove('hide-examples');
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
          <textarea class="row-input def-textarea" data-field="definition" data-idx="${i}" rows="3" placeholder="Definition (optional)">${escapeHtml(w.definition || '')}</textarea>
          <button class="btn small refresh-btn" data-action="refresh-def" data-idx="${i}" title="Regenerate definition">↻</button>
        </div>
      </td>
      <td>
        <div style="display:flex; gap:8px; align-items:center;">
          <textarea class="row-input ex-textarea" data-field="example" data-idx="${i}" rows="3" placeholder="Example sentence (auto)">${escapeHtml(w.example || '')}</textarea>
          <button class="btn small refresh-btn" data-action="refresh-example" data-idx="${i}" title="Regenerate example">↻</button>
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
          definition: (w && w.definition) || '',
          example: (w && (w.example || w.example_sentence)) || ''
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
                definition: w.definition || '',
                example: w.example || w.example_sentence || ''
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
          definition: w.definition || '',
          example: w.example || w.example_sentence || ''
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
      // Auto examples after initial render
      (async ()=>{ await generateExamplesForMissing(); })();
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

  // Refresh definition
  rowsEl.querySelectorAll('[data-action="refresh-def"]').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      btn.disabled = true;
      btn.textContent = '…';
      try {
        await generateDefinitionForRow(idx);
      } finally {
        btn.disabled = false;
        btn.textContent = '↻';
      }
    };
  });

  // Refresh example
  rowsEl.querySelectorAll('[data-action="refresh-example"]').forEach(btn => {
    btn.onclick = async () => {
      const idx = parseInt(btn.dataset.idx, 10);
      btn.disabled = true;
      btn.textContent = '…';
      try {
        await generateExampleForRow(idx, true);
      } finally {
        btn.disabled = false;
        btn.textContent = '↻';
      }
    };
  });

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

// Tiny top-right toast for brief status (e.g., 500ms "Saved"), or longer error
function showTinyToast(msg, { variant = 'success', ms = 500 } = {}) {
  let el = document.getElementById('tinyToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tinyToast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = [
      'position:fixed',
      'top:12px',
      'right:12px',
      'background:#10b981',
      'color:#fff',
      'padding:8px 12px',
      'border-radius:9999px',
      'font:600 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif',
      'box-shadow:0 6px 20px rgba(0,0,0,.18)',
      'z-index:100000',
      'opacity:0',
      'transform:translateY(-6px)',
      'transition:opacity .12s ease, transform .12s ease',
      'display:none'
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  if (variant === 'error') el.style.background = '#ef4444';
  else if (variant === 'warn') el.style.background = '#f59e0b';
  else el.style.background = '#10b981';
  // show
  el.style.display = 'block';
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  });
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => { if (el.style.opacity === '0') el.style.display = 'none'; }, 160);
  }, Math.max(200, ms | 0));
}

// Network helpers: resilient JSON fetch with retry for transient dev resets
async function fetchJSONSafe(url, init, opts = {}) {
  const { retryOnNetwork = true, retryDelayMs = 700 } = opts;
  try {
    const res = await fetch(url, init);
    // Read text first so we can report useful errors on non-JSON responses
    let text = '';
    try { text = await res.text(); } catch {}
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    if (!res.ok) {
      const msg = (data && (data.error || data.message)) || text || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data ?? {};
  } catch (err) {
    const msg = String(err && err.message || err || '');
    // Retry once on network-style errors seen in Netlify dev (connection reset / failed to fetch)
    if (retryOnNetwork && /Failed to fetch|NetworkError|ERR_CONNECTION_RESET|load failed|TypeError: NetworkError/i.test(msg)) {
      await new Promise(r => setTimeout(r, retryDelayMs));
      return fetchJSONSafe(url, init, { retryOnNetwork: false, retryDelayMs });
    }
    throw err;
  }
}


function buildPayload() {
  // Ensure each word carries a legacy_sentence for Sentence Mode.
  const vowels = /^[aeiou]/i;
  function fallbackSentence(w){
    const eng = (w.eng||'').trim();
    if(!eng) return '';
    // If multi-word phrase, simple pattern:
    if(eng.includes(' ')) return `I can ${eng}.`;
    const art = vowels.test(eng) ? 'an' : 'a';
    // Choose between two simple templates for a little variation
    if(/ing$/i.test(eng)) return `They are ${eng}.`;
    return `This is ${art} ${eng}.`;
  }
  function chooseLegacySentence(w){
    // 1. Pre-existing legacy_sentence (if user loaded an older game)
    if(w.legacy_sentence && /\w+\s+\w+\s+\w+/.test(w.legacy_sentence)) return w.legacy_sentence.trim();
    // 2. Example with >=3 tokens
    if(w.example && /\w+\s+\w+\s+\w+/.test(w.example)) return w.example.trim();
    // 3. Definition (take first clause up to 14 words)
    if(w.definition){
      const words = w.definition.trim().split(/\s+/).slice(0,14);
      if(words.length >=3){
        let def = words.join(' ');
        def = def.replace(/\s+$/,'');
        if(!/[.!?]$/.test(def)) def += '.';
        return def;
      }
    }
    // 4. Generated fallback
    return fallbackSentence(w);
  }
  return {
    title: titleEl.value || 'Untitled Game',
    gameImage: document.getElementById('gameImageZone').querySelector('img')?.src || '',
    words: list.map(w => ({
      eng: w.eng || '',
      kor: w.kor || '',
      image_url: w.image_url || '',
      definition: w.definition || '',
      example: w.example || '',
      // Always provide a legacy_sentence so Sentence Mode never empties out.
      legacy_sentence: chooseLegacySentence(w)
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
  window.open(url, 'worksheetManager', 'width=1200px,height=800px, left=20px,');
};

// Receive worksheet from manager and import words
window.loadWorksheet = function(worksheet) {
  try {
    console.log('Loading worksheet:', worksheet);
    const wordsField = worksheet?.words;
    let rows = [];
    // Attempt to auto-load a title from common worksheet properties
    try {
      const possibleTitle = (worksheet && (worksheet.title || worksheet.name || worksheet.worksheet_title || worksheet.game_title || worksheet.sheet_title)) || '';
      if (possibleTitle && titleEl) {
        titleEl.value = possibleTitle;
      }
    } catch (e) { /* non-fatal */ }
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
  list = rows;
    
    // Log final rows with image data for debugging
    console.log('Final rows with images:', rows.map(r => ({ eng: r.eng, has_image: !!r.image_url })));
    
    render();
    // Only auto-fill missing data (don't overwrite existing images)
    (async () => {
      if (enablePicturesEl.checked) await loadImagesForMissingOnly(list, loadingImages, render);
      if (enableDefinitionsEl.checked) await generateDefinitionsForMissing();
      await generateExamplesForMissing();
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

// Quick Save (silent): overwrite if currentGameId, else open Save As modal to name the file
saveLink.onclick = async () => {
  const payload = buildPayload();
  if (!payload.title || payload.words.length === 0) {
    toast('Need title and at least 1 word');
    return;
  }
  // First-time save in this session/file -> open Save As modal to set the title and create the record
  if (!currentGameId) {
    // Pre-fill modal title from current input
    const titleField = document.getElementById('saveGameTitle');
    if (titleField) titleField.value = titleEl.value || '';
    const statusBox = document.getElementById('saveModalStatus'); if (statusBox) statusBox.textContent = '';
    const modal = document.getElementById('saveModal');
    ensureRegenerateAudioCheckbox();
    if (modal) modal.style.display = 'flex';
    return;
  }
  // Otherwise, overwrite silently
  saveLink.classList.add('disabled');
  try {
    const body = { action: 'update_game_data', id: currentGameId, data: payload };
    const js = await fetchJSONSafe('/.netlify/functions/supabase_proxy_fixed', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (js?.success) {
      showTinyToast('Saved', { ms: 500 });
    } else {
      showTinyToast(js?.error || 'Save failed', { variant: 'error', ms: 3000 });
    }
  } catch (e) {
    console.error(e);
    showTinyToast('Save error', { variant: 'error', ms: 3000 });
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

enableExamplesEl.addEventListener('change', async () => {
  render(); // Always re-render to hide/show examples
  if (enableExamplesEl.checked) {
    await generateExamplesForMissing();
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
  // After filling definitions, opportunistically fill examples
  await generateExamplesForMissing();
}

async function generateExamplesForMissing() {
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w) continue;
    if (w.example && w.example.trim()) continue;
    await generateExampleForRow(i);
  }
}

async function generateExampleForRow(idx, force = false) {
  const w = list[idx];
  if (!w || !w.eng) return;
  if (!force && w.example && w.example.trim()) return;
  const target = w.eng.trim();
  const prompt = `Write one short simple English sentence for beginner ESL students using the word "${target}". Keep it positive, concrete, and 5-12 words. Avoid quotes, explanations, or extra text. Output only the sentence.`;
  try {
    const res = await fetch('/.netlify/functions/openai_proxy', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
    const js = await res.json();
    let sent = (js?.result || '').trim();
    if (!sent) return;
    sent = sent.replace(/^\s*[-*•]?\s*\d+[).]\s*/, '').replace(/^"|"$/g,'').trim();
    // Capitalize & end punctuation
    sent = sent.charAt(0).toUpperCase() + sent.slice(1);
    if (!/[.!?]$/.test(sent)) sent += '.';
    w.example = sent;
    render();
  } catch(e) { console.error(e); }
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
openLink.onclick = () => {
  // Show modal immediately for instant feedback
  fileModal.style.display = 'flex';
  // Kick off (non-blocking) population
  populateFileList();
};
fileModalClose.onclick = () => { fileModal.style.display = 'none'; };
window.addEventListener('click', (e) => { if (e.target === fileModal) fileModal.style.display = 'none'; });

// Save modal
const saveModal = document.getElementById('saveModal');
const saveModalClose = document.getElementById('saveModalClose');
saveModalClose.onclick = () => { saveModal.style.display = 'none'; };
window.addEventListener('click', (e) => { if (e.target === saveModal) saveModal.style.display = 'none'; });

// Save As (open modal flow)
saveAsLink.onclick = () => {
  document.getElementById('saveGameTitle').value = titleEl.value || '';
  const statusBox = document.getElementById('saveModalStatus'); if (statusBox) statusBox.textContent = '';
  ensureRegenerateAudioCheckbox();
  saveModal.style.display = 'flex';
};

const confirmSave = document.getElementById('confirmSave');
// --- Audio helpers (minimal, adapted from create-game-modal.js / tts.js) ---
function isLocalHost() { return typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname); }
function preferredVoice() { try { const id = localStorage.getItem('ttsVoiceId'); return id && id.trim() ? id.trim() : null; } catch { return null; } }

// Ensure a 'Regenerate audio' checkbox exists in Save modal and reflect saved preference
function ensureRegenerateAudioCheckbox(){
  try {
    const boxId = 'regenerateAudioCheckbox';
    const statusBox = document.getElementById('saveModalStatus');
    const container = statusBox && statusBox.parentElement ? statusBox.parentElement : document.getElementById('saveModal');
    if (!container) return;
    let row = document.getElementById('regenerateAudioRow');
    if (!row) {
      row = document.createElement('div');
      row.id = 'regenerateAudioRow';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0 2px 0;';
      row.innerHTML = `
        <input type="checkbox" id="${boxId}" style="transform:translateY(1px);" />
        <label for="${boxId}" style="font-size:13px;color:#334155;cursor:pointer;">Regenerate audio for all words (overwrite)</label>
      `;
      // Insert above the status box if available, else append to modal
      if (statusBox && statusBox.parentElement) {
        statusBox.parentElement.insertBefore(row, statusBox);
      } else {
        container.appendChild(row);
      }
    }
    const cb = document.getElementById(boxId);
    const saved = localStorage.getItem('gb_regenerate_audio') === '1';
    if (cb) {
      cb.checked = saved;
      cb.onchange = () => {
        try { localStorage.setItem('gb_regenerate_audio', cb.checked ? '1' : '0'); } catch {}
      };
    }
  } catch {}
}

async function checkExistingAudioKeys(keys) {
  if (!Array.isArray(keys) || !keys.length) return {};
  const endpoints = isLocalHost()
    ? ['/.netlify/functions/get_audio_urls', 'http://localhost:9000/.netlify/functions/get_audio_urls']
    : ['/.netlify/functions/get_audio_urls'];
  let lastErr = null;
  for (const url of endpoints) {
    try {
      const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words: keys }) };
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) init.signal = AbortSignal.timeout(12000);
      const res = await fetch(url, init);
      if (res.ok) {
        const data = await res.json();
        return data && data.results ? data.results : {};
      } else {
        lastErr = new Error(`get_audio_urls ${res.status}`);
      }
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('get_audio_urls failed');
}

async function callTTSProxy(payload) {
  const endpoints = isLocalHost()
    ? ['/.netlify/functions/eleven_labs_proxy', 'http://localhost:9000/.netlify/functions/eleven_labs_proxy']
    : ['/.netlify/functions/eleven_labs_proxy'];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) return await res.json();
    } catch (e) { /* try next */ }
  }
  throw new Error('All TTS endpoints failed');
}

async function uploadAudioFile(key, audioBase64) {
  const endpoints = isLocalHost()
    ? ['/.netlify/functions/upload_audio', 'http://localhost:9000/.netlify/functions/upload_audio']
    : ['/.netlify/functions/upload_audio'];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word: key, fileDataBase64: audioBase64 }) });
      if (res.ok) { const r = await res.json(); return r.url; }
    } catch (e) { /* try next */ }
  }
  throw new Error('Upload failed');
}

async function ensureAudioForWordsAndSentences(wordsList, examplesMap, opts = {}) {
  // wordsList: array of plain target words (strings)
  // examplesMap: { normalizedWord: exampleSentence }
  const normalizeForKey = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const words = (wordsList || []).map(w => normalizeForKey(w)).filter(Boolean);
  // Map back from normalized key to the original display word to avoid TTS saying "underscore"
  const originalByKey = {};
  (wordsList || []).forEach(orig => {
    const k = normalizeForKey(orig);
    if (k) originalByKey[k] = String(orig);
  });
  // Deterministic variety: pick a template based on a stable hash of the word
  function hash32(str){
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function generatePrefixedSentence(original){
    const w = String(original || '').replace(/\s+/g, ' ').trim();
    // Templates inspired by your previous set; {w} will be replaced with the word
    const templates = [
      'This one is {w}.',
      'The word is {w}.',
      '{w} is the word.',
      'The word you want is {w}.',
      "Now, let's do {w}.",
      'How about {w}?',
      'Do you know {w}?',
      'This word is {w}.',
      "The word I'm looking for is {w}.",
      '{w} is the one that I want.'
    ];
    const idx = templates.length ? (hash32(w) % templates.length) : 0;
    return templates[idx].replace('{w}', w);
  }
  const { maxWorkers = 3, onInit, onProgress, onDone, force = false } = opts || {};
  if (!words.length && (!examplesMap || Object.keys(examplesMap).length === 0)) {
    if (typeof onInit === 'function') onInit(0);
    if (typeof onDone === 'function') onDone();
    return { ensuredWords: [], ensuredSentences: [] };
  }

  // 1) Check existing word audio
  const wordKeys = words.slice();
  // Ensure a sentence clip for EVERY word: use provided example sentence when available, otherwise a prefixed sentence
  const sentenceKeys = words.map(w => `${w}_sentence`);

  let missingWordKeys = wordKeys.slice();
  let missingSentenceKeys = sentenceKeys.slice();
  if (!force) {
    const combinedKeys = Array.from(new Set([].concat(wordKeys, sentenceKeys)));
    let existing = {};
    try { existing = await checkExistingAudioKeys(combinedKeys); } catch (e) { console.warn('checkExistingAudioKeys failed', e); existing = {}; }
    missingWordKeys = wordKeys.filter(w => { const info = existing[w]; return !(info && info.exists && info.url); });
    missingSentenceKeys = sentenceKeys.filter(k => { const info = existing[k]; return !(info && info.exists && info.url); });
  }

  // Progress accounting
  let totalTasksForProgress = 0;
  let completedTasksForProgress = 0;

  // Helper to generate-and-upload for a set of tasks
  async function runGeneration(tasks, generatorFn) {
    const failures = [];
    const buckets = Array.from({ length: Math.min(maxWorkers || 3, tasks.length) }, () => []);
    tasks.forEach((t, i) => buckets[i % buckets.length].push(t));
    await Promise.all(buckets.map(async (bucket) => {
      for (const task of bucket) {
        try {
          // Skip tasks that have no usable text
          if (!task || !task.text || !String(task.text).trim()) {
            failures.push(task);
          } else {
            const payload = await generatorFn(task);
            // Only upload when we actually received non-empty audio
            if (payload && typeof payload.audio === 'string' && payload.audio.trim()) {
              await uploadAudioFile(task.key, payload.audio);
            } else {
              failures.push(task);
            }
          }
        } catch (e) {
          console.warn('Generation/upload failed for', task, e);
          failures.push(task);
        }
        // Update progress after each task completes (success or failure)
        completedTasksForProgress++;
        if (typeof onProgress === 'function') onProgress(completedTasksForProgress, totalTasksForProgress);
      }
    }));
    return failures;
  }

  // Prepare word generation tasks: always use the standard prefixed sentence logic for variety
  const wordTasks = missingWordKeys.map(k => {
    // Use the original word text for speech, not the normalized key
    const orig = (originalByKey[k] || k || '').toString().replace(/_/g, ' ').trim();
    return { key: k, text: generatePrefixedSentence(orig) };
  });

  // Filter out any blank word tasks (safety)
  const filteredWordTasks = wordTasks.filter(t => t && t.text && String(t.text).trim());

  // Prepare sentence generation tasks: use examplesMap value as text, key is `${word}_sentence`
  const sentenceTasks = missingSentenceKeys.map(k => {
    const base = String(k).replace(/_sentence$/i, '');
    // examplesMap keys may be raw words; normalize lookup
    const lookup = Object.keys(examplesMap || {}).find(orig => normalizeForKey(orig) === base);
    let text = '';
    if (lookup) {
      text = String(examplesMap[lookup] || '').trim();
    }
    // If no example sentence is provided, synthesize a clear prefixed sentence for the word
    if (!text) {
      // Find the original (un-normalized) word for nicer output
      const original = (wordsList || []).find(w => normalizeForKey(w) === base) || base.replace(/_/g, ' ');
      text = generatePrefixedSentence(original);
    }
    return { key: k, text };
  });

  // Filter out any blank sentence tasks (safety)
  const filteredSentenceTasks = sentenceTasks.filter(t => t && t.text && String(t.text).trim());

  // Initialize progress totals and notify
  const totalForWords = filteredWordTasks.length;
  const totalForSentences = filteredSentenceTasks.length;
  totalTasksForProgress = totalForWords + totalForSentences;
  if (typeof onInit === 'function') onInit(totalTasksForProgress);

  // Run generation for words then sentences
  if (filteredWordTasks.length) {
    await runGeneration(filteredWordTasks, async (task) => {
      const voice = preferredVoice();
      // Use Eleven v3 (alpha) for word clarity and expressiveness
      return await callTTSProxy({ text: task.text, voice_id: voice, model_id: 'eleven_v3' });
    });
  }
  if (filteredSentenceTasks.length) {
    await runGeneration(filteredSentenceTasks, async (task) => {
      const voice = preferredVoice();
      // Use Eleven Turbo v2.5 for fast sentence generation
      return await callTTSProxy({ text: task.text, voice_id: voice, model_id: 'eleven_turbo_v2_5' });
    });
  }

  if (typeof onDone === 'function') onDone();

  return { ensuredWords: wordKeys, ensuredSentences: sentenceKeys };
}

// --- End audio helpers ---

// --- Sentence ID upgrade (builder-local) ------------------------------------
// NOTE: create-game-modal has its own ensureSentenceIds, but when saving directly
// from this builder (main.js) we never invoked the batch sentence function, so
// nothing was inserted in the sentences table. This local helper fixes that gap.
async function ensureSentenceIdsBuilder(wordObjs){
  try {
    if(!Array.isArray(wordObjs) || !wordObjs.length) return { inserted:0 };
    // Select targets that have legacy_sentence/example AND lack primary_sentence_id & sentences[]
    const norm = s => (s||'').trim().replace(/\s+/g,' ');
    const targets = wordObjs.filter(w=> !w.primary_sentence_id && !Array.isArray(w.sentences) && (w.legacy_sentence || w.example));
    if(!targets.length) return { inserted:0 };
    const map = new Map();
    for (const w of targets){
      const raw = w.legacy_sentence || w.example || '';
      if(raw && raw.split(/\s+/).length >= 3){
        const n = norm(raw);
        if(n && !map.has(n)) map.set(n, { text:n, words:[w.eng].filter(Boolean) });
      }
    }
    if(!map.size) return { inserted:0 };
    const payload = { action:'upsert_sentences_batch', sentences: Array.from(map.values()) };
    const res = await fetch('/.netlify/functions/upsert_sentences_batch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const js = await res.json().catch(()=>null);
    if(js && js.audio){
      console.debug('[SentenceUpgrade][builder][audio] summary', js.audio);
    }
    if(js && js.audio_status){
      console.debug('[SentenceUpgrade][builder][audio_status sample]', js.audio_status.slice(0,5));
    }
    if(js && js.env){
      console.debug('[SentenceUpgrade][builder][env]', js.env);
    }
    if(!js || !js.success || !Array.isArray(js.sentences)){
      console.debug('[SentenceUpgrade][builder] batch failed', { status: res.status, ok: res.ok, body: js });
      return { inserted:0, backend:false };
    }
  const byText = new Map(js.sentences.map(r=> [norm(r.text), r]));
    let applied=0;
    for (const w of targets){
      const raw = w.legacy_sentence || w.example || '';
      const rec = byText.get(norm(raw));
      if(rec && rec.id){
        const sentObj = { id: rec.id, text: rec.text };
        if (rec.audio_key) sentObj.audio_key = rec.audio_key;
        w.sentences = [sentObj];
        w.primary_sentence_id = rec.id; applied++; }
    }
    console.debug('[SentenceUpgrade][builder] applied', { applied, totalTargets: targets.length, unique: map.size, meta: js.meta });
    return { inserted: applied };
  } catch(e){ console.debug('[SentenceUpgrade][builder] error', e?.message); return { inserted:0, error:true }; }
}

confirmSave.onclick = async () => {
  let title = document.getElementById('saveGameTitle').value.trim();
  if (!title) { toast('Need title'); return; }
  const currentUid = getCurrentUserId();
  let existingRow = null;
  try {
    // Fetch only this user's games with same title (lightweight filter client-side)
    const listRes = await fetch('/.netlify/functions/list_game_data_unique?limit=50&offset=0&created_by=' + encodeURIComponent(currentUid));
    if (listRes.ok) {
      const js = await listRes.json();
      const all = Array.isArray(js.data) ? js.data : [];
      existingRow = all.find(r => r.title && r.title.trim().toLowerCase() === title.toLowerCase());
    }
  } catch (e) { console.warn('Duplicate check failed', e); }

  if (existingRow) {
    // Offer overwrite / increment / cancel
    const choice = await new Promise(resolve => {
      const modal = document.createElement('div');
      modal.style.position='fixed'; modal.style.inset='0'; modal.style.background='rgba(0,0,0,0.45)'; modal.style.zIndex='99999';
      modal.innerHTML = `<div style="background:#fff;max-width:420px;margin:10% auto;padding:20px;border-radius:12px;font-family:sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.25);">
        <h3 style="margin-top:0;">Title Exists</h3>
        <p style="font-size:14px;color:#334155;line-height:1.4;">You already have a game named <strong>${escapeHtml(title)}</strong>. What would you like to do?</p>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
          <button id="dupOverwrite" class="btn primary" style="width:100%;">Overwrite Existing</button>
          <button id="dupIncrement" class="btn" style="width:100%;background:#f1f5f9;">Save as Incremented Name</button>
          <button id="dupCancel" class="btn" style="width:100%;background:#fee2e2;color:#b91c1c;">Cancel</button>
        </div>
      </div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', e => {
        if (e.target.id === 'dupOverwrite') { resolve('overwrite'); modal.remove(); }
        else if (e.target.id === 'dupIncrement') { resolve('increment'); modal.remove(); }
        else if (e.target.id === 'dupCancel') { resolve('cancel'); modal.remove(); }
        else if (e.target === modal) { resolve('cancel'); modal.remove(); }
      });
    });
    if (choice === 'cancel') { toast('Save cancelled'); return; }
    if (choice === 'increment') {
      // Append (2), (3), ... style until unique for this user
      const base = title.replace(/\s*\(\d+\)$/, '').trim();
      let n = 2; let newTitle = `${base} (${n})`;
      // Re-pull list to ensure up-to-date (optional but safer)
      try {
        const listRes2 = await fetch('/.netlify/functions/list_game_data_unique?limit=200&offset=0&created_by=' + encodeURIComponent(currentUid));
        if (listRes2.ok) {
          const js2 = await listRes2.json();
          const titlesLower = new Set((js2.data||[]).map(r=> (r.title||'').toLowerCase()));
          while (titlesLower.has(newTitle.toLowerCase()) && n < 200) { n++; newTitle = `${base} (${n})`; }
        }
      } catch {}
      title = newTitle;
      document.getElementById('saveGameTitle').value = title;
      existingRow = null; // we will insert as new
    }
    // If overwrite chosen, keep existingRow for update action.
    if (choice === 'overwrite') {
      // proceed with update later
    }
  }

  const payload = buildPayload();
  payload.title = title;
  confirmSave.classList.add('disabled');
  try {
    // Ensure created_by is attached (checks multiple keys, reusing getCurrentUserId logic)
    try {
      let uid = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || localStorage.getItem('id') || sessionStorage.getItem('id') || localStorage.getItem('userId') || sessionStorage.getItem('userId');
      if (!uid && typeof getCurrentUserId === 'function') uid = getCurrentUserId();
      if (uid) payload.created_by = uid;
    } catch {}

    // NEW: Ensure sentence IDs (batch insert) before audio so future modes can resolve sentence_id.
    try {
      const statusBox = document.getElementById('saveModalStatus'); if(statusBox) statusBox.textContent = 'Linking sentences…';
      await ensureSentenceIdsBuilder(payload.words);
    } catch(e){ console.debug('[SentenceUpgrade][builder] sentence id ensure failed', e?.message); }

    // Prepare and ensure audio files for words and example sentences (legacy word + word_sentence clips)
    try {
      const statusBox = document.getElementById('saveModalStatus');
      const words = payload.words.map(w => w.eng).filter(Boolean);
      const examplesMap = {};
      if (enableExamplesEl && enableExamplesEl.checked) {
        for (const w of payload.words) {
          if (w && w.eng && w.example && String(w.example).trim()) {
            const key = String(w.eng).trim();
            examplesMap[key] = String(w.example).trim();
          }
        }
      }
      if (words.length || Object.keys(examplesMap).length) {
        // Build a tiny progress bar inside the status box
        let barWrap = statusBox && statusBox.querySelector('.gb-save-bar');
        if (!barWrap && statusBox) {
          statusBox.innerHTML = '<div class="gb-save-bar" style="position:relative;height:10px;background:#e6eaef;border-radius:6px;overflow:hidden;margin:6px 0 2px 0;"><div class="gb-save-bar-fill" style="height:100%;width:0;background:#67e2e6;transition:width .2s ease;"></div></div><div class="gb-save-bar-txt" style="font-size:12px;color:#64748b;margin-top:2px;">Preparing audio…</div>';
          barWrap = statusBox.querySelector('.gb-save-bar');
        }
        const barFill = statusBox ? statusBox.querySelector('.gb-save-bar-fill') : null;
        const barTxt = statusBox ? statusBox.querySelector('.gb-save-bar-txt') : null;

        const maxWorkers = isLocalHost() ? 1 : 3;
        const force = (localStorage.getItem('gb_regenerate_audio') === '1');
        await ensureAudioForWordsAndSentences(words, examplesMap, {
          maxWorkers,
          force,
          onInit: (total) => {
            if (barTxt) barTxt.textContent = total ? `Ensuring audio files… (0/${total})` : 'Ensuring audio files…';
            if (barFill) barFill.style.width = '0%';
          },
          onProgress: (done, total) => {
            const pct = total ? Math.round((done / total) * 100) : 0;
            if (barFill) barFill.style.width = pct + '%';
            if (barTxt) barTxt.textContent = total ? `Ensuring audio files… (${done}/${total})` : `Ensuring audio files…`;
          },
          onDone: () => {
            if (barTxt) barTxt.textContent = 'Audio ready';
            if (barFill) barFill.style.width = '100%';
          }
        });
      }
    } catch (e) {
      console.warn('Audio ensure failed, continuing to save game', e);
      const statusBox = document.getElementById('saveModalStatus'); if (statusBox) statusBox.textContent = 'Audio step failed (continuing)';
    }
    console.debug('[BuilderSave] sentence linking + audio ensure complete; proceeding to persist game_data');
    let saveAction = 'insert_game_data';
    let postBody = { action: saveAction, data: payload };
    if (existingRow) {
      saveAction = 'update_game_data';
      postBody = { action: saveAction, id: existingRow.id, data: payload };
    }
    const js = await fetchJSONSafe('/.netlify/functions/supabase_proxy_fixed', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(postBody)
    });
    if (js?.success) {
      const statusBox = document.getElementById('saveModalStatus'); if (statusBox) statusBox.textContent = existingRow ? 'Overwritten' : 'Saved';
      // After a successful Save As (insert or overwrite), try to set currentGameId for future quick saves
      try {
        if (existingRow && existingRow.id) {
          currentGameId = existingRow.id;
        } else {
          const who = getCurrentUserId();
          const r = await fetch('/.netlify/functions/list_game_data_unique?limit=1&offset=0&created_by=' + encodeURIComponent(who));
          const j = await r.json();
          const row = Array.isArray(j.data) && j.data[0] ? j.data[0] : null;
          if (row && row.title && row.title.trim().toLowerCase() === (title || '').toLowerCase()) currentGameId = row.id;
        }
      } catch {}
      toast(existingRow ? 'Game overwritten' : 'Game saved');
      saveModal.style.display = 'none';
    } else {
      const statusBox = document.getElementById('saveModalStatus'); if (statusBox) statusBox.textContent = js?.error || 'Save failed';
      toast(js?.error || 'Save failed');
    }
  } catch (e) {
    console.error(e);
    toast('Save error');
  } finally {
    confirmSave.classList.remove('disabled');
  }
};


let fileListLoading = false;
let fileListOffset = 0;
let fileListRows = [];
let fileListUniqueCount = 0;
let fileListUid = '';
let fileListAllMode = false; // when true, show all users' games
const LOAD_LIMIT = 10;

// Deletion / selection helpers
let selectedGameIds = new Set();
let pendingDeleteBatches = []; // each: { ids:Set, rows:[], timeoutId, finalized:false }
const DELETE_UNDO_MS = 5000;

function ensureSnackbarContainer(){
  if(document.getElementById('gameUndoSnackbar')) return;
  const bar = document.createElement('div');
  bar.id = 'gameUndoSnackbar';
  bar.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#334155;color:#fff;padding:10px 16px;border-radius:30px;display:none;align-items:center;gap:12px;box-shadow:0 4px 18px -2px rgba(0,0,0,.35);font:14px system-ui, sans-serif;z-index:999999;';
  bar.innerHTML = '<span class="snack-msg"></span><button class="snack-undo" style="background:#0ea5e9;color:#fff;border:none;padding:6px 14px;border-radius:20px;font-weight:600;cursor:pointer;">Undo</button><span class="snack-timer" style="font-size:11px;opacity:.75;min-width:32px;text-align:right;"></span>';
  document.body.appendChild(bar);
}

function showUndoSnackbar(message, onUndo, onExpire){
  ensureSnackbarContainer();
  const bar = document.getElementById('gameUndoSnackbar');
  const msg = bar.querySelector('.snack-msg');
  const undoBtn = bar.querySelector('.snack-undo');
  const timerEl = bar.querySelector('.snack-timer');
  msg.textContent = message;
  let remaining = Math.ceil(DELETE_UNDO_MS/1000);
  timerEl.textContent = remaining + 's';
  bar.style.display = 'flex';
  let done = false;
  const intId = setInterval(()=>{
    remaining--; if(remaining<=0){ clearInterval(intId); }
    if(remaining>=0) timerEl.textContent = remaining + 's';
  },1000);
  function finish(expired){
    if(done) return; done=true; clearInterval(intId); bar.style.display='none';
    if(expired){ onExpire && onExpire(); } else { onUndo && onUndo(); }
  }
  undoBtn.onclick = () => finish(false);
  const timeoutId = setTimeout(()=> finish(true), DELETE_UNDO_MS);
  return { cancel:()=>{ finish(false); }, timeoutId };
}

function clearSelection(){
  selectedGameIds.clear();
  const grid = document.getElementById('gameGrid');
  if(grid){ grid.querySelectorAll('.game-card.selected').forEach(el=> el.classList.remove('selected')); }
  updateBatchDeleteButton();
}

function toggleSelectCard(card, id){
  if(!id) return; 
  if(selectedGameIds.has(id)) { selectedGameIds.delete(id); card.classList.remove('selected'); }
  else { selectedGameIds.add(id); card.classList.add('selected'); }
  updateBatchDeleteButton();
}

function ensureBatchDeleteButton(){
  const existing = document.getElementById('batchDeleteBtn');
  if(existing) return existing;
  const container = fileList.querySelector('div'); // first controls row
  if(!container) return null;
  const btn = document.createElement('button');
  btn.id='batchDeleteBtn';
  btn.textContent='Delete Selected (0)';
  btn.style.cssText='display:none;background:#dc2626;color:#fff;border:none;padding:8px 14px;border-radius:6px;cursor:pointer;font-weight:600;';
  btn.onclick = ()=> triggerBatchDelete();
  container.appendChild(btn);
  return btn;
}

function updateBatchDeleteButton(){
  const btn = ensureBatchDeleteButton();
  if(!btn) return;
  const count = selectedGameIds.size;
  if(count>0){ btn.style.display='inline-block'; btn.textContent = `Delete Selected (${count})`; }
  else { btn.style.display='none'; }
}

function triggerBatchDelete(){
  if(!selectedGameIds.size) return;
  const ids = Array.from(selectedGameIds);
  // Only delete rows the user owns
  const uid = getCurrentUserId();
  const ownedIds = ids.filter(id=> {
    const row = fileListRows.find(r=> r.id===id);
    return row && (!row.created_by || row.created_by === uid); // allow unowned or owned
  });
  if(!ownedIds.length){ toast('No owned games selected'); clearSelection(); return; }
  performPendingDelete(new Set(ownedIds));
  clearSelection();
}

function markCardsPending(ids){
  const grid = document.getElementById('gameGrid');
  if(!grid) return;
  ids.forEach(id=> {
    const card = grid.querySelector(`.game-card [data-open="${id}"]`)?.closest('.game-card');
    if(card){
      card.classList.add('pending-delete');
      if(!card.querySelector('.pending-overlay')){
        const ov = document.createElement('div');
        ov.className='pending-overlay';
        ov.style.cssText='position:absolute;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;border-radius:12px;backdrop-filter:blur(2px);';
        ov.innerHTML='<div class="spinner" style="width:32px;height:32px;border:4px solid #94a3b8;border-top-color:#38bdf8;border-radius:50%;animation:spin .8s linear infinite"></div>';
        card.style.position='relative';
        card.appendChild(ov);
      }
    }
  });
  // inject spinner keyframes once
  if(!document.getElementById('pendingDeleteStyles')){
    const style = document.createElement('style');
    style.id='pendingDeleteStyles';
    style.textContent='@keyframes spin{to{transform:rotate(360deg)}} .game-card.selected{outline:3px solid #0ea5e9;}';
    document.head.appendChild(style);
  }
}

function removeCardsImmediately(ids){
  // remove DOM nodes
  const grid = document.getElementById('gameGrid');
  if(!grid) return;
  ids.forEach(id=> {
    const card = grid.querySelector(`.game-card [data-open="${id}"]`)?.closest('.game-card');
    if(card){ card.remove(); }
  });
}

function performPendingDelete(idSet){
  const ids = Array.from(idSet);
  const rows = ids.map(id=> fileListRows.find(r=> r.id===id)).filter(Boolean);
  if(!rows.length) return;
  markCardsPending(idSet);
  // Show snackbar with undo, delay actual deletion network call until expiry
  const batch = { ids: idSet, rows, finalized:false, timeoutId:null };
  pendingDeleteBatches.push(batch);
  const { timeoutId } = showUndoSnackbar(ids.length===1 ? 'Game deleted' : ids.length+' games deleted', ()=>{
    // Undo: restore visual state
    batch.finalized=true; // mark consumed
    // Remove overlays
    ids.forEach(id=>{
      const card = document.querySelector(`.game-card [data-open="${id}"]`)?.closest('.game-card');
      if(card){ card.classList.remove('pending-delete'); const ov=card.querySelector('.pending-overlay'); if(ov) ov.remove(); }
    });
    toast('Restore');
  }, async ()=>{
    if(batch.finalized) return; // already undone
    batch.finalized=true;
    // Remove from fileListRows
    ids.forEach(id=> {
      const idx = fileListRows.findIndex(r=> r.id===id);
      if(idx!==-1) fileListRows.splice(idx,1);
    });
    removeCardsImmediately(idSet);
    // Repaint meta / filters
    paintFileList(fileListRows, { cached:true, initial:false, uniqueCount:fileListUniqueCount });
    // Now call backend deletion sequentially
    for(const id of ids){
      try {
        const res = await fetch('/.netlify/functions/supabase_proxy_fixed', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete_game_data', id }) });
        const js = await res.json();
        if(!js?.success){ console.warn('Delete failed', id, js); }
      } catch(e){ console.warn('Delete error', id, e); }
    }
    toast(ids.length===1 ? 'Deleted' : 'Deleted '+ids.length+' games');
  });
  batch.timeoutId = timeoutId;
}

async function populateFileList() {
  fileListOffset = 0;
  fileListRows = [];
  fileListUniqueCount = 0;
  fileListUid = getCurrentUserId();
  fileListAllMode = false; // reset to user scope on explicit populate
  await loadFileListPage(true);
}

async function loadFileListPage(isInitial) {
  if (fileListLoading) return;
  fileListLoading = true;
  const uid = fileListUid;
  // When no uid, still attempt to fetch system (NULL created_by) rows
  const baseUrl = '/.netlify/functions/list_game_data_unique?limit=' + LOAD_LIMIT + '&offset=' + fileListOffset;
  let url;
  if (fileListAllMode) {
    url = baseUrl + '&all=1&unique=0';
  } else {
    url = uid ? (baseUrl + '&created_by=' + encodeURIComponent(uid) + '&include_null=1') : (baseUrl + '&include_null=1');
  }
  const res = await fetch(url);
  if (!res.ok) {
    fileList.innerHTML = '<div class="status">Error loading games (status ' + res.status + '). Make sure Netlify dev server is running.</div>';
    fileListLoading = false;
    return;
  }
  const js = await res.json();
  const rows = Array.isArray(js?.data) ? js.data : [];
  const countFromResp = (js.unique === 0 ? js.total_count : (js.unique_count || js.total_count)) || rows.length;
  if (isInitial) {
    fileListRows = rows;
    fileListUniqueCount = countFromResp;
    paintFileList(fileListRows, { cached: false, initial: true, uniqueCount: fileListUniqueCount });
  } else {
    fileListRows = fileListRows.concat(rows);
    paintFileList(fileListRows, { cached: false, initial: false, uniqueCount: fileListUniqueCount });
  }
  // Show/hide Load More button
  const loadMoreBtn = document.getElementById('loadMoreFilesBtn');
  if (loadMoreBtn) {
    if (fileListRows.length < fileListUniqueCount) {
      loadMoreBtn.style.display = '';
      loadMoreBtn.disabled = false;
    } else {
      loadMoreBtn.style.display = 'none';
    }
  }
  fileListLoading = false;
}

const loadMoreBtn = document.getElementById('loadMoreFilesBtn');
if (loadMoreBtn) {
  loadMoreBtn.onclick = async () => {
    if (fileListLoading) return;
    fileListOffset += LOAD_LIMIT;
    await loadFileListPage(false);
  };
}

// Helper function for client-side deduplication
function dedupeByTitle(rows) {
  const byTitle = new Map();
  for (const r of rows || []) {
    if (!r || !r.title) continue;
    const k = r.title.trim().toLowerCase();
    if (!k) continue;
    // Keep first occurrence (assuming newest first order)
    if (!byTitle.has(k)) byTitle.set(k, r);
  }
  return Array.from(byTitle.values())
    .sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
}

// dedupeByTitle removed (handled server-side)

function getCurrentUserId(){
  try {
    // Check multiple possible storage keys
    const possibleKeys = [
      'user_id', 'id', 'userId', 'current_user_id', 'currentUserId',
      'sb_user_id', 'supabase_user_id', 'auth_user_id'
    ];
    
    // Check localStorage first
    for (const key of possibleKeys) {
      const value = localStorage.getItem(key);
      if (value && value.trim()) {
        console.log('[getCurrentUserId] Found user ID in localStorage:', key, value.substring(0, 8) + '...');
        return value.trim();
      }
    }
    
    // Check sessionStorage
    for (const key of possibleKeys) {
      const value = sessionStorage.getItem(key);
      if (value && value.trim()) {
        console.log('[getCurrentUserId] Found user ID in sessionStorage:', key, value.substring(0, 8) + '...');
        return value.trim();
      }
    }
    
    // Try to extract from Supabase auth cookie
    try {
      const cookieHeader = document.cookie;
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        if (key && value) acc[key] = decodeURIComponent(value);
        return acc;
      }, {});
      
      const accessToken = cookies['sb_access'] || cookies['sb-access-token'];
      if (accessToken) {
        // Decode JWT to get user ID
        const parts = accessToken.split('.');
        if (parts.length >= 2) {
          const base64url = parts[1];
          const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
          const json = atob(base64);
          const payload = JSON.parse(json);
          if (payload.sub) {
            console.log('[getCurrentUserId] Found user ID in JWT cookie:', payload.sub.substring(0, 8) + '...');
            return payload.sub;
          }
        }
      }
    } catch (e) {
      console.warn('[getCurrentUserId] Error extracting from cookie:', e);
    }
    
    console.warn('[getCurrentUserId] No user ID found in any storage location');
    return '';
  } catch (e) { 
    console.error('[getCurrentUserId] Error:', e);
    return ''; 
  }
}

function paintFileList(initialRows, { cached, initial, uniqueCount }) {
  // Show all rows loaded so far (pagination outside). No slicing so user can see pages appended.
  const rows = initialRows;
  const creators = [...new Set(rows.map(r => r.creator_name || 'Unknown'))].sort();
  fileList.innerHTML = `
    <div style="margin-bottom: 12px; display: flex; gap: 8px;">
      <input type="text" id="gameSearch" placeholder="Search games by title..." style="flex:1;padding:8px;border:1px solid #ccc;border-radius:4px;" />
      <select id="creatorScope" style="padding:8px;border:1px solid #ccc;border-radius:4px;">
        <option value="mine" ${fileListAllMode ? '' : 'selected'}>My Games</option>
        <option value="all" ${fileListAllMode ? 'selected' : ''}>All Users</option>
      </select>
      <select id="creatorFilter" style="padding:8px;border:1px solid #ccc;border-radius:4px;">
        <option value="">All Creators</option>
        ${creators.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>
    </div>
  <div id="gameGrid" class="saved-games-grid"></div>
    <div id="fileListMeta" style="margin-top:8px;font-size:11px;color:#64748b;"></div>`;

  const grid = document.getElementById('gameGrid');
  const searchInput = document.getElementById('gameSearch');
  const creatorFilter = document.getElementById('creatorFilter');
  const creatorScope = document.getElementById('creatorScope');
  const meta = document.getElementById('fileListMeta');
  let currentQuery = '';
  let currentCreator = '';

  ensureMaterialIcons();

  // Minimal helpers for actions (open/rename/delete). These call existing API endpoints.
  async function openGameData(id){
    try {
      const res = await fetch('/.netlify/functions/supabase_proxy_fixed?get=game_data&id=' + encodeURIComponent(id));
      if(!res.ok){
        console.error('[game-builder] openGameData fetch failed', res.status, id);
        toast('Open failed ('+res.status+')');
        return;
      }
      const js = await res.json();
      if (js?.data) {
        // Load into builder
        const gd = js.data;
        currentGameId = gd.id || id || null;
        if (Array.isArray(gd.words)) {
          saveState();
          list = gd.words.map(w => newRow({ eng: w.eng || w.en || '', kor: w.kor || w.translation || w.kr || '', image_url: (w.image_url || w.image || w.img || ''), definition: w.definition, example: w.example || w.example_sentence }));
          if (titleEl) titleEl.value = gd.title || 'Untitled Game';
          render();
          toast('Game loaded');
          fileModal.style.display = 'none';
        }
      } else {
        toast('Load failed');
      }
    } catch(e){ console.error(e); toast('Load error'); }
  }
  async function renameGameData(id){
    const newTitle = prompt('New title?');
    if(!newTitle) return;
    try {
      const res = await fetch('/.netlify/functions/supabase_proxy_fixed', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'rename_game_data', id, title:newTitle }) });
      const js = await res.json();
      if(js?.success){ toast('Renamed'); refreshFileList('gb_file_list_v3'); }
      else toast(js?.error||'Rename failed');
    } catch(e){ console.error(e); toast('Rename error'); }
  }
  async function deleteGameData(id){
    if(!confirm('Delete this game?')) return;
    // Optimistic UI: remove from local array + DOM immediately
    try {
      const idx = fileListRows.findIndex(r => r.id === id);
      let removed = null;
      if (idx !== -1) {
        removed = fileListRows.splice(idx,1)[0];
      }
      const cardEl = document.querySelector('.game-card .card-body[data-open="'+id+'"], .game-card [data-open="'+id+'"]');
      if (cardEl) {
        const card = cardEl.closest('.game-card');
        if (card) { card.style.opacity='0.4'; card.style.transition='opacity .25s'; setTimeout(()=> card.remove(), 250); }
      }
      // Re-render filtered view quickly (without refetch)
      // We reuse current filter function by directly calling paintFileList again.
      paintFileList(fileListRows, { cached: true, initial: false, uniqueCount: fileListUniqueCount });

      const res = await fetch('/.netlify/functions/supabase_proxy_fixed', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete_game_data', id }) });
      const js = await res.json();
      if(js?.success){ toast('Deleted'); }
      else {
        toast(js?.error||'Delete failed');
        // Rollback if we removed it
        if (removed) {
          fileListRows.splice(idx,0,removed);
          paintFileList(fileListRows, { cached: true, initial: false, uniqueCount: fileListUniqueCount });
        }
      }
    } catch(e){ console.error(e); toast('Delete error'); }
  }

  function ensureMaterialIcons(){
    if(document.getElementById('materialIconsLink')) return;
    const link = document.createElement('link');
    link.id = 'materialIconsLink';
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  function renderList(list) {
    const frag = document.createDocumentFragment();
    const currentUid = getCurrentUserId();
    list.forEach(r => {
      const when = r.created_at ? new Date(r.created_at).toLocaleDateString() : '';
      const div = document.createElement('div');
      div.className = 'game-card new-style';
      if(selectedGameIds.has(r.id)) div.classList.add('selected');
      const owned = !r.created_by || r.created_by === currentUid;
  // Use explicit game_image, then derived first_image_url from backend, then legacy image_url
  const imageUrl = r.game_image || r.first_image_url || r.image_url || '';
      const placeholderSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#f1f5f9"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-size="16" fill="#94a3b8">Loading...</text></svg>';
      const placeholder = 'data:image/svg+xml;utf8,' + encodeURIComponent(placeholderSVG);
      div.innerHTML = `
        <div class="thumb-wrap tall lazy" data-id="${r.id}" data-thumb="${imageUrl}">
          <div class="img-spinner"></div>
          <img alt="Game Image" src="${placeholder}" loading="lazy" />
        </div>
        <div class="card-body" data-open="${r.id}">
          <h4 class="g-title renameable" data-rename="${r.id}">${escapeHtml(r.title || 'Untitled')}</h4>
          <div class="g-meta-row">
            <div style="display:flex;flex-direction:column;align-items:flex-start;">
              <p class="g-creator">${r.creator_name || 'Unknown'}</p>
              <p class="g-date">${when}</p>
            </div>
            <button class="del-btn" title="${owned?'Delete':'Not owner'}" data-del="${r.id}" ${owned?'':'disabled style="opacity:.35;cursor:not-allowed;"'}><span class="material-icons" style="font-size:19px;">delete</span></button>
          </div>
        </div>`;
      frag.appendChild(div);
    });
    grid.replaceChildren(frag);
    // Title click -> rename (direct binding kept for prompt UX)
    grid.querySelectorAll('[data-rename]').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const id = el.getAttribute('data-rename');
        renameGameData(id);
      });
    });

    // Delete button (direct binding to avoid delegation accidental propagation side-effects)
    grid.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if(btn.disabled) return; // not owner
        const id = btn.getAttribute('data-del');
        performPendingDelete(new Set([id]));
      });
    });

    // Delegated click: make entire card (including image) open unless clicking delete or title (rename)
    if(!grid.dataset.openBound){
      grid.addEventListener('click', e => {
        const del = e.target.closest('.del-btn');
        if(del) return; // delete handled separately
        const title = e.target.closest('[data-rename]');
        if(title) return; // rename handled separately
        const card = e.target.closest('.game-card');
        if(!card) return;
        const id = card.querySelector('[data-open]')?.getAttribute('data-open');
        if(!id) return;
        if(e.shiftKey){
          e.preventDefault();
          toggleSelectCard(card, id);
          return;
        }
        openGameData(id);
      });
      grid.dataset.openBound = '1';
    }

    setupLazyImages();
  }

  function setupLazyImages(){
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          const wrap = entry.target;
          observer.unobserve(wrap);
          const img = wrap.querySelector('img');
            const actual = wrap.getAttribute('data-thumb');
            if(actual){
              const tmp = new Image();
              tmp.onload = () => {
                img.src = actual; wrap.classList.add('loaded');
              };
              tmp.onerror = () => { wrap.classList.add('error'); };
              tmp.src = actual;
            } else {
              // try secondary thumb endpoint
              const id = wrap.getAttribute('data-id');
              fetch('/.netlify/functions/supabase_proxy_fixed?get=game_thumb&id=' + encodeURIComponent(id))
                .then(r=>r.json())
                .then(js=>{
                  if(js.thumb){
                    const t = new Image();
                    t.onload=()=>{ img.src = js.thumb; wrap.classList.add('loaded'); };
                    t.onerror=()=> wrap.classList.add('error');
                    t.src = js.thumb;
                  } else {
                    wrap.classList.add('no-image');
                  }
                }).catch(()=>wrap.classList.add('error'));
            }
        }
      });
    }, { rootMargin:'200px 0px', threshold:0.01 });
    document.querySelectorAll('.thumb-wrap.lazy').forEach(wrap => observer.observe(wrap));
  }

  function applyFilters() {
    const filtered = rows.filter(r =>
      (r.title || '').toLowerCase().includes(currentQuery) &&
      (!currentCreator || (r.creator_name || 'Unknown') === currentCreator)
    );
    renderList(filtered);
    meta.textContent = `Showing ${filtered.length} of ${uniqueCount || rows.length} saves${fileListAllMode ? ' (All Users)' : ''}`;
  }

  searchInput.addEventListener('input', () => { currentQuery = searchInput.value.toLowerCase(); applyFilters(); });
  creatorFilter.addEventListener('change', () => { currentCreator = creatorFilter.value; applyFilters(); });
  // Auto-select current user if present
  try {
    if (!fileListAllMode) {
      const nonSystem = creators.filter(c => c !== 'System' && c !== 'Unknown');
      if (nonSystem.length === 1) {
        creatorFilter.value = nonSystem[0];
        currentCreator = nonSystem[0];
      }
    }
  } catch {}
  applyFilters();

  creatorScope.addEventListener('change', async () => {
    const val = creatorScope.value;
    fileListAllMode = (val === 'all');
    fileListOffset = 0; fileListRows = []; fileListUniqueCount = 0;
    fileListLoading = false; // reset
    await loadFileListPage(true);
  });
  updateBatchDeleteButton();
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
