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
import { showTinyToast, ensureLoadingOverlay, buildSkeletonHTML } from './utils/dom-helpers.js';
import { fetchJSONSafe, timedJSONFetch, recordPerfSample, isLocalHost } from './utils/network.js';
import { escapeRegExp, cleanDefinitionResponse, normalizeForKey, capitalize, ensurePunctuation } from './utils/validation.js';
import { generateExample, generateDefinition } from './services/ai-service.js';
import { 
  preferredVoice, 
  checkExistingAudioKeys, 
  callTTSProxy, 
  uploadAudioFile, 
  ensureAudioForWordsAndSentences,
  ensureRegenerateAudioCheckbox
} from './services/audio-service.js';
import { 
  getCurrentUserId,
  ensureSentenceIdsBuilder,
  prepareAndUploadImagesIfNeeded,
  saveGameData,
  loadGameData,
  deleteGameData,
  listGameData,
  findGameByTitle,
  generateIncrementedTitle,
  showTitleConflictModal
} from './services/file-service.js';
import {
  getList,
  setList,
  getCurrentGameId,
  setCurrentGameId,
  newRow,
  saveState,
  undo as undoState,
  redo as redoState,
  clearAllState,
  buildPayload,
  cacheCurrentGame,
  parseWords
} from './state/game-state.js';
// Legacy global bridge: some pre-refactor modules and inline code still expect
// window.list / window.currentGameId to exist. Keep them synchronized with the
// state module without changing existing references.
if (!window.list) Object.defineProperty(window, 'list', {
  get() { return getList(); },
  set(v) { setList(v); }
});
if (!('currentGameId' in window)) Object.defineProperty(window, 'currentGameId', {
  get() { return getCurrentGameId(); },
  set(v) { setCurrentGameId(v); }
});
// Phase 3: Render & UI extraction
import { buildRowHTML, applyTableToggles } from './render/row-html.js';
import { ensureMaterialIcons, buildGameCardHTML, buildFileListHTML } from './render/file-grid.js';
import { 
  showEditListModal as showEditListModalUI, 
  hideEditListModal as hideEditListModalUI,
  handleEditListSave,
  openSaveAsModal,
  handleSaveAsConfirm,
  showFileModal as showFileModalUI,
  hideFileModal as hideFileModalUI
} from './ui/modals.js';
import {
  handleQuickSave,
  handlePreview,
  handleAddWord,
  handleUndo,
  handleRedo,
  handleGetTranslations,
  handleGenerateDefinitions,
  handleGenerateExamples
} from './ui/event-handlers.js';
import { ENDPOINTS, STORAGE_KEYS, ACTIONS, DEFAULTS, TOAST_DURATION } from './constants.js';
import { initFileListModal } from './ui/file-list.js';
import { loadWorksheetIntoBuilder } from './services/worksheet-service.js';

// Early toast shim: ensures calls before actual toast util wiring don't throw
const toast = (function(){
  if (typeof window !== 'undefined') {
    if (typeof window.toast === 'function') return (...a) => window.toast(...a);
    // Provide a minimal window.toast so later code assigning it still works
    window.toast = function(msg){
      try { showTinyToast(msg); } catch { console.log('[toast]', msg); }
    };
    return (...a) => window.toast(...a);
  }
  // Non-browser fallback
  return (...a) => console.log('[toast]', ...a);
})();

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
// Re-upload Images link removed (logic now auto-handled on save)
const editListLink = document.getElementById('editListLink');
const editListModal = document.getElementById('editListModal');
const editListModalClose = document.getElementById('editListModalClose');
const editListRaw = document.getElementById('editListRaw');
const editListSave = document.getElementById('editListSave');
const editListCancel = document.getElementById('editListCancel');
// Edit List modal wiring
if (editListLink) editListLink.onclick = (e) => { e.preventDefault(); showEditListModalUI(editListModal, editListRaw, getList()); };
if (editListModalClose) editListModalClose.onclick = () => hideEditListModalUI(editListModal);
if (editListCancel) editListCancel.onclick = () => hideEditListModalUI(editListModal);
if (editListSave) editListSave.onclick = () => {
  handleEditListSave(editListRaw, newRow, saveState, setList, render, toast, () => hideEditListModalUI(editListModal));
};

const getTranslationsLink = document.getElementById('getTranslationsLink');
const enablePicturesEl = document.getElementById('enablePictures');
const enableDefinitionsEl = document.getElementById('enableDefinitions');
const enableExamplesEl = document.getElementById('enableExamples');
const statusEl = document.getElementById('status');
const fileModal = document.getElementById('fileModal');
const fileList = document.getElementById('fileList');
const fileModalClose = document.getElementById('fileModalClose');

// State now managed by state/game-state.js module
// Access via getList(), setList(), getCurrentGameId(), setCurrentGameId()
let loadingImages; // from image system
// Bootstrap user id early (improves created_by reliability on first save). Attempts a whoami call once.
(async function bootstrapUserId(){
  try {
    // Skip if already present
    const existing = localStorage.getItem('user_id') || localStorage.getItem('id') || sessionStorage.getItem('user_id');
    if(existing && existing.trim()) return;
    const res = await fetch('/.netlify/functions/supabase_proxy_fixed?action=whoami', { credentials:'include' });
    if(!res.ok) return; // silent fail
    const js = await res.json().catch(()=>null);
    if(js && js.success && js.user_id){
      try { localStorage.setItem('user_id', js.user_id); } catch {}
      console.debug('[whoami/bootstrap] stored user_id', js.user_id);
    }
  } catch(e){ console.debug('[whoami/bootstrap] failed', e?.message); }
})();
// Disabled: prior auto session restore removed intentionally (user wants clean slate on refresh)
// (Left placeholder so future re-enable logic has an anchor.)
try { sessionStorage.removeItem('gb_last_game_v1'); } catch {}
// Add Clear All button (now placed in top toolbar markup, fallback create if missing)
let clearAllBtn = document.getElementById('clearAllGameData');
if(!clearAllBtn){
  const rightBar = document.querySelector('.top-menu .toolbar-right') || document.querySelector('.top-menu') || document.body;
  // insert dot if existing items present
  if(rightBar && rightBar.children.length){
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = '•';
    rightBar.appendChild(dot);
  }
  clearAllBtn = document.createElement('a');
  clearAllBtn.id = 'clearAllGameData';
  clearAllBtn.className = 'link danger';
  clearAllBtn.textContent = 'Clear All';
  rightBar.appendChild(clearAllBtn);
}
clearAllBtn.addEventListener('click', () => {
  if(!confirm('This will erase ALL unsaved game data (words, title, session cache). Continue?')) return;
  // Reset in-memory state via state module
  setList([]);
  setCurrentGameId(null);
  if(titleEl) titleEl.value = '';
  // Remove session & legacy storage keys
  try { sessionStorage.removeItem('gb_last_game_v1'); } catch {}
  const lsKeys = [
    'gameBuilderWordList','gb_regenerate_audio','worksheetTitle','user_id','id','userId','gb_image_folder_v1'
  ];
  lsKeys.forEach(k=>{ try { localStorage.removeItem(k); } catch {} });
  try { sessionStorage.removeItem('gb_image_folder_v1'); } catch {}
  // Clear any image placeholders referencing past session (basic rerender)
  render();
  toast('All game builder data cleared');
});

// Undo/Redo functionality now in state/game-state.js

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
// Add Word button wiring
if (addWordLink) {
  addWordLink.onclick = (e) => {
    e.preventDefault();
    handleAddWord(saveState, getList, setList, newRow, render);
  };
}
// Get Translations button wiring
if (getTranslationsLink) {
  getTranslationsLink.onclick = (e) => {
    e.preventDefault();
    handleGetTranslations(getList, setList, render, toast);
  };
}
// NOTE: Re-upload button removed; images now auto-processed during every Save / Save As.

// Undo/Redo keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { 
    e.preventDefault(); 
    if (undoState()) {
      render();
      toast('Undone');
    }
  }
  else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { 
    e.preventDefault(); 
    if (redoState()) {
      render();
      toast('Redone');
    }
  }
});

// newRow function now imported from state/game-state.js

// Initialize saved games modal (Load)
initFileListModal({
  fileModal,
  fileListEl: fileList,
  openLink,
  fileModalClose,
  titleEl,
  toast,
  render
});

function render() {
  const list = getList();
  rowsEl.innerHTML = '';
  // If we don't have a real public base (placeholder) rewrite any direct R2 API endpoints to proxy form for visibility
  try {
    const placeholder = !window.R2_PUBLIC_BASE || /your-r2-public-domain/i.test(window.R2_PUBLIC_BASE);
    if (placeholder) {
      for (const w of list) {
        if (!w || !w.image_url || /\/\.netlify\/functions\/image_proxy\?/.test(w.image_url)) continue;
        const m = w.image_url.match(/^https?:\/\/[^/]+\.r2\.cloudflarestorage\.com\/([^/]+)\/(.+)$/i);
        if (m) {
          const key = m[2];
            if (/^(words|cover)\//.test(key)) {
              w.image_url = '/.netlify/functions/image_proxy?key=' + encodeURIComponent(key);
            } else {
              // Legacy prefix normalization: strip leading images/ or public/
              const cleaned = key.replace(/^(?:images\/)+/i,'').replace(/^(?:public\/)+/i,'');
              if (/^(words|cover)\//.test(cleaned)) {
                w.image_url = '/.netlify/functions/image_proxy?key=' + encodeURIComponent(cleaned);
              }
            }
        }
      }
    }
    // Normalization: If public base is set WITHOUT bucket (correct form), but URLs still contain '/images/words/...' because of earlier double bucket, strip first 'images/'
    if (!placeholder && window.R2_PUBLIC_BASE && !/\/$/.test(window.R2_PUBLIC_BASE)) {
      const base = window.R2_PUBLIC_BASE.replace(/\/$/, '');
      for (const w of list) {
        if (!w || !w.image_url) continue;
        // Strip /images/ from absolute R2 URLs (bucket name shouldn't be in public URL path)
        if (w.image_url.startsWith(base + '/images/words/')) {
          w.image_url = base + '/' + w.image_url.substring((base + '/images/').length);
          console.log('[builder] Stripped /images/ from word image_url:', w.image_url.substring(0, 80));
        }
        if (w.image_url.startsWith(base + '/images/cover/')) {
          w.image_url = base + '/' + w.image_url.substring((base + '/images/').length);
          console.log('[builder] Stripped /images/ from cover image_url:', w.image_url.substring(0, 80));
        }
      }
      // Also check game cover image
      if (gameImage && typeof gameImage === 'string' && gameImage.startsWith(base + '/images/cover/')) {
        gameImage = base + '/' + gameImage.substring((base + '/images/').length);
        console.log('[builder] Stripped /images/ from gameImage:', gameImage.substring(0, 80));
      }
    }
  } catch(e){ console.warn('Image URL rewrite check failed', e); }
  // Apply table toggles
  applyTableToggles(enablePicturesEl, enableDefinitionsEl, enableExamplesEl);
  
  list.forEach((w, i) => {
    const tr = document.createElement('tr');
    const isLoading = loadingImages.has(i);
    tr.innerHTML = buildRowHTML(w, i, isLoading);
    rowsEl.appendChild(tr);
  });
  // Image error fallback to proxy (auto-retry on direct R2 failures)
  try {
    rowsEl.querySelectorAll('.drop-zone img').forEach(img => {
      if (!img.__fallbackHooked) {
        img.addEventListener('error', () => {
          const failing = img.getAttribute('src');
          if (/^https?:\/\/pub-[^/]+\.r2\.dev\//.test(failing) && !/\.netlify\/functions\/image_proxy/.test(failing)) {
            try {
              const parts = failing.split(/\/+/).slice(3);
              if (parts.length >= 2) {
                const key = parts.slice(1).join('/').replace(/^(?:images\/)+/i,'').replace(/^(?:public\/)+/i,'');
                if (/^(words|cover)\//.test(key)) {
                  img.src = '/.netlify/functions/image_proxy?key=' + encodeURIComponent(key);
                }
              }
            } catch {}
          }
        });
        img.__fallbackHooked = true;
      }
    });
  } catch {}
  bindRowEvents();
}

function bindRowEvents(){
  const list = getList();
  // Inputs and textareas
  rowsEl.querySelectorAll('input.row-input, textarea.row-input').forEach(el => {
    let originalValue = el.value;
    el.addEventListener('input', () => {
      const idx = parseInt(el.dataset.idx,10);
      const field = el.dataset.field;
      if(list[idx]) list[idx][field] = el.value;
    });
    el.addEventListener('focus', () => { originalValue = el.value; });
    el.addEventListener('blur', () => {
      if(el.value !== originalValue){ saveState(); }
    });
  });
  // Delete buttons
  rowsEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.idx,10);
      saveState();
      list.splice(idx,1);
      render();
    };
  });
  // Drop zones
  rowsEl.querySelectorAll('.drop-zone').forEach(zone => {
    const idx = parseInt(zone.dataset.idx,10);
    setupImageDropZone(zone, idx, list, render, escapeHtml, saveState);
  });
  // Refresh definition/example buttons
  rowsEl.querySelectorAll('[data-action="refresh-def"]').forEach(btn => {
    btn.onclick = async () => { const idx = parseInt(btn.dataset.idx,10); await generateDefinitionForRow(idx, true); };
  });
  rowsEl.querySelectorAll('[data-action="refresh-example"]').forEach(btn => {
    btn.onclick = async () => { const idx = parseInt(btn.dataset.idx,10); await generateExampleForRow(idx, true); };
  });
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
  } catch (e) {
    console.warn('Import from Word Builder failed:', e);
  }
})();

// File list logic extracted to ui/file-list.js (initFileListModal)

// Defer toast resolution until call time to avoid ReferenceError if builder invoked early
window.loadWorksheet = (ws) => {
  const resolvedToast = (typeof toast === 'function')
    ? toast
    : (window.toast || ((msg) => console.log('[toast]', msg)));
  return loadWorksheetIntoBuilder(ws, {
    titleEl,
    enablePicturesEl,
    enableDefinitionsEl,
    enableExamplesEl,
    generateDefinitionsForMissing,
    generateExamplesForMissing,
    loadingImages,
    render,
    toast: resolvedToast
  });
};

function applyWorksheetImages(rows, imagesField, originalWords) {
  // Use the imported function from images.js
  applyWorksheetImagesFromModule(rows, imagesField, originalWords);
}

// Quick Save (silent): overwrite if currentGameId, else open Save As modal
saveLink.onclick = (ev) => handleQuickSave(ev, buildPayload, getCurrentGameId, titleEl, toast);

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
    const list = getList();
    await loadImagesForMissingOnly(list, loadingImages, render);
  }
});

async function generateDefinitionsForMissing() {
  const list = getList();
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
  const list = getList();
  for (let i = 0; i < list.length; i++) {
    const w = list[i];
    if (!w) continue;
    if (w.example && w.example.trim()) continue;
    await generateExampleForRow(i);
  }
}

// AI generation wrappers using services/ai-service.js
async function generateExampleForRow(idx, force = false) {
  const list = getList();
  const w = list[idx];
  if (!w || !w.eng) return;
  if (!force && w.example && w.example.trim()) return;
  
  const example = await generateExample(w.eng);
  if (example) {
    w.example = example;
    render();
  }
}

async function generateDefinitionForRow(idx) {
  const list = getList();
  const w = list[idx];
  if (!w || !w.eng) return;
  
  const definition = await generateDefinition(w.eng, w.kor || '');
  if (definition) {
    w.definition = definition;
    render();
  }
}

// escapeRegExp and cleanDefinitionResponse now imported from utils/validation.js

async function loadPicturesForMissing() {
  // Deprecated - use loadImagesForMissingOnly from images.js instead
  const list = getList();
  await loadImagesForMissingOnly(list, loadingImages, render);
}

// File modal: list previously saved game_data and open
openLink.onclick = () => {
  // Show modal immediately with skeleton for instant feedback
  fileModal.style.display = 'flex';
  if (fileList) {
    fileList.innerHTML = buildSkeletonHTML(8);
  }
  // Kick off (non-blocking) population (may use cache)
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
// Audio helpers now fully imported from services/audio-service.js
// uploadAudioFile, ensureAudioForWordsAndSentences, ensureSentenceIdsBuilder) 
// now imported from services/audio-service.js and services/file-service.js

if (confirmSave) {
  confirmSave.onclick = (ev) => handleSaveAsConfirm(titleEl, buildPayload, getCurrentGameId, setCurrentGameId, toast, cacheCurrentGame, saveModal, saveModalStatus);
}


let fileListLoading = false;
let fileListOffset = 0;
let fileListRows = [];
let fileListUniqueCount = 0;
let fileListUid = '';
let fileListAllMode = false; // when true, show all users' games
const LOAD_LIMIT = 10;
// --- Saved games modal caching & skeleton ---
let fileListCache = null; // { ts, rows, uniqueCount }
// Extended cache: 3 min in-session + optional 5 min persistent localStorage (stale-while-revalidate)
const SESSION_CACHE_MAX_AGE_MS = 180000; // 3 minutes
const PERSIST_CACHE_MAX_AGE_MS = 300000; // 5 minutes
const PERSIST_CACHE_KEY = 'gb_file_list_cache_v2';

// --- Performance instrumentation now imported from utils/network.js ---
// Helper to run a quick head-style warm measurement (head=1 avoids image logic)
async function measureListEndpointOnce(params = {}) {
  const qs = new URLSearchParams({ limit:'10', offset:'0', head:'1', unique:'1', names:'0', page_pull:'10', ...params });
  const { meta } = await timedJSONFetch('list(head)', '/.netlify/functions/list_game_data_unique?' + qs.toString());
  recordPerfSample(meta);
  return meta;
}
// Optional baseline capture (3 head + 1 full) triggered once per page load.
if (!window.__gbPerfBaselineScheduled) {
  window.__gbPerfBaselineScheduled = true;
  setTimeout(async () => {
    try {
      for (let i = 0; i < 3; i++) { 
        await measureListEndpointOnce({ run: String(i+1) }); 
      }
      await timedJSONFetch('list(full)', '/.netlify/functions/list_game_data_unique?limit=10&offset=0&unique=1&names=0&page_pull=40');
    } catch (e) { 
      console.debug('[GB-PERF] baseline capture error', e); 
    }
  }, 2500);
}
// buildSkeletonHTML now imported from utils/dom-helpers.js

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
  style.textContent='@keyframes gbOverlaySpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} .game-card.selected{outline:3px solid #0ea5e9;}';
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
  // Single delete: show inline countdown overlay on the card instead of global snackbar
  if(ids.length===1){
    const id = ids[0];
    const card = document.querySelector(`.game-card [data-open="${id}"]`)?.closest('.game-card');
    if(card){
      let overlay = card.querySelector('.pending-overlay');
      if(!overlay){
        overlay = document.createElement('div');
        overlay.className='pending-overlay';
        overlay.style.cssText='position:absolute;inset:0;background:rgba(15,23,42,.55);display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:12px;backdrop-filter:blur(2px);gap:10px;';
        card.appendChild(overlay);
      } else {
        overlay.innerHTML='';
      }
      const msg = document.createElement('div');
      msg.style.cssText='color:#fff;font-weight:600;font-size:14px;';
      msg.textContent='Game deleted';
      const countdown = document.createElement('div');
      countdown.style.cssText='color:#cbd5e1;font-size:12px;letter-spacing:.5px;';
      let remaining = Math.ceil(DELETE_UNDO_MS/1000);
      countdown.textContent = 'Undo in '+remaining+'s';
      const undoBtn = document.createElement('button');
      undoBtn.textContent='Undo';
      undoBtn.style.cssText='background:#0ea5e9;color:#fff;border:none;padding:6px 14px;border-radius:20px;font-weight:600;cursor:pointer;font-size:13px;';
      overlay.innerHTML='';
      overlay.appendChild(msg); overlay.appendChild(countdown); overlay.appendChild(undoBtn);
      let finished=false;
      const intId = setInterval(()=>{ remaining--; if(remaining<=0){ clearInterval(intId); } if(remaining>=0) countdown.textContent='Undo in '+remaining+'s'; },1000);
      const finalize = async (expired)=>{
        if(finished) return; finished=true; clearInterval(intId);
        if(!expired){
          // Undo: remove overlay and restore
            card.classList.remove('pending-delete');
            const ov=card.querySelector('.pending-overlay'); if(ov) ov.remove();
            toast('Restore');
            return;
        }
        // Expired -> commit deletion
        const idx = fileListRows.findIndex(r=> r.id===id);
        if(idx!==-1) fileListRows.splice(idx,1);
        removeCardsImmediately(new Set([id]));
        paintFileList(fileListRows, { cached:true, initial:false, uniqueCount:fileListUniqueCount });
        try {
          const res = await fetch('/.netlify/functions/supabase_proxy_fixed', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete_game_data', id }) });
          const js = await res.json(); if(!js?.success){ console.warn('Delete failed', id, js); }
        } catch(e){ console.warn('Delete error', id, e); }
        toast('Deleted');
      };
      undoBtn.onclick=()=> finalize(false);
      setTimeout(()=> finalize(true), DELETE_UNDO_MS);
      return; // single delete handled
    }
  }
  // Multi-delete: retain original snackbar batch behavior
  const batch = { ids: idSet, rows, finalized:false, timeoutId:null };
  pendingDeleteBatches.push(batch);
  const { timeoutId } = showUndoSnackbar(ids.length===1 ? 'Game deleted' : ids.length+' games deleted', ()=>{
    batch.finalized=true;
    ids.forEach(id=>{
      const card = document.querySelector(`.game-card [data-open="${id}"]`)?.closest('.game-card');
      if(card){ card.classList.remove('pending-delete'); const ov=card.querySelector('.pending-overlay'); if(ov) ov.remove(); }
    });
    toast('Restore');
  }, async ()=>{
    if(batch.finalized) return; batch.finalized=true;
    ids.forEach(id=> { const idx = fileListRows.findIndex(r=> r.id===id); if(idx!==-1) fileListRows.splice(idx,1); });
    removeCardsImmediately(idSet);
    paintFileList(fileListRows, { cached:true, initial:false, uniqueCount:fileListUniqueCount });
    for(const id of ids){
      try {
        const res = await fetch('/.netlify/functions/supabase_proxy_fixed', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete_game_data', id }) });
        const js = await res.json(); if(!js?.success){ console.warn('Delete failed', id, js); }
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
  // Attempt session cache reuse
  try {
    // Prefer fresh session cache
    const rawSession = sessionStorage.getItem('gb_file_list_cache_v1');
    if(rawSession){
      const parsed = JSON.parse(rawSession);
      if(parsed && Array.isArray(parsed.rows) && (Date.now()-parsed.ts) < SESSION_CACHE_MAX_AGE_MS){
        fileListRows = parsed.rows; fileListUniqueCount = parsed.uniqueCount || parsed.rows.length;
        paintFileList(fileListRows, { cached:true, initial:true, uniqueCount:fileListUniqueCount });
        loadFileListPage(true); // SWR refresh
        return;
      }
    }
    // Fallback to persistent localStorage (can be stale)
    const rawPersist = localStorage.getItem(PERSIST_CACHE_KEY);
    if(rawPersist){
      const parsedP = JSON.parse(rawPersist);
      if(parsedP && Array.isArray(parsedP.rows)){
        const age = Date.now() - parsedP.ts;
        if(age < PERSIST_CACHE_MAX_AGE_MS){
          fileListRows = parsedP.rows; fileListUniqueCount = parsedP.uniqueCount || parsedP.rows.length;
          paintFileList(fileListRows, { cached:true, initial:true, uniqueCount:fileListUniqueCount });
          loadFileListPage(true); // refresh in background
          return;
        } else {
          // Show stale immediately (SWR) then refresh
          fileListRows = parsedP.rows; fileListUniqueCount = parsedP.uniqueCount || parsedP.rows.length;
          paintFileList(fileListRows, { cached:true, initial:true, uniqueCount:fileListUniqueCount });
          loadFileListPage(true);
          return;
        }
      }
    }
  } catch{}
  await loadFileListPage(true);
}

async function loadFileListPage(isInitial) {
  if (fileListLoading) return;
  fileListLoading = true;
  const uid = fileListUid;
  // When no uid, still attempt to fetch system (NULL created_by) rows
  const baseUrl = '/.netlify/functions/list_game_data_unique?limit=' + LOAD_LIMIT + '&offset=' + fileListOffset + '&page_pull=' + (LOAD_LIMIT*4) + '&names=0';
  let url;
  if (fileListAllMode) {
    url = baseUrl + '&all=1&unique=0';
  } else {
    url = uid ? (baseUrl + '&created_by=' + encodeURIComponent(uid) + '&include_null=1') : (baseUrl + '&include_null=1');
  }
  // Timeout guard (8s)
  const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
  if(ac){ setTimeout(()=> { if(!ac.signal.aborted) ac.abort(); }, 8000); }
  // Long-load UX indicator after 700ms if skeleton still present
  const slowTimer = setTimeout(()=>{
    try {
      if(fileList && fileList.querySelector('.saved-games-grid') && fileList.querySelector('.game-card.skeleton')){
        const meta = document.getElementById('fileListMeta');
        if(meta) meta.textContent = 'Fetching games… (still working)';
      }
    } catch{}
  },700);
  const t0 = performance.now();
  let ttfbMs = 0; let totalMs = 0; let sizeBytes = 0; let js=null; let status=0; let ok=false;
  try {
    const res = await fetch(url, ac? { signal: ac.signal } : undefined);
    status = res.status;
    ttfbMs = performance.now() - t0; // approximation
    const text = await res.text();
    sizeBytes = text.length;
    try { js = JSON.parse(text); } catch(parseErr){ console.warn('[game-builder] parse error list response', parseErr); }
    ok = res.ok;
    totalMs = performance.now() - t0;
  } catch(e){
    totalMs = performance.now() - t0;
    console.warn('[game-builder] fetch error list', e);
  }
  clearTimeout(slowTimer);
  recordPerfSample({ label: 'list(ui)', ttfbMs, totalMs, sizeBytes, status, error: ok?undefined:'fetch-failed' });
  if(!ok || !js){
    fileList.innerHTML = '<div class="status">Error loading games (status ' + status + '). <button id="retryListBtn" class="btn">Retry</button></div>';
    const retry = document.getElementById('retryListBtn');
    if(retry){ retry.onclick = ()=> { fileListLoading=false; loadFileListPage(isInitial); }; }
    fileListLoading = false; return;
  }
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
  // Persist cache (SWR) only for initial full loads
  try {
    if(isInitial){
      const cacheObj = { ts: Date.now(), rows: fileListRows, uniqueCount: fileListUniqueCount };
      sessionStorage.setItem('gb_file_list_cache_v1', JSON.stringify(cacheObj));
      localStorage.setItem(PERSIST_CACHE_KEY, JSON.stringify(cacheObj));
    }
  } catch{}
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

// getCurrentUserId removed (now imported from services/file-service.js)

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
    const overlay = ensureLoadingOverlay();
    overlay.show('Loading game…');
    try {
      const res = await fetch('/.netlify/functions/supabase_proxy_fixed?get=game_data&id=' + encodeURIComponent(id));
      if(!res.ok){
        console.error('[game-builder] openGameData fetch failed', res.status, id);
        toast('Open failed ('+res.status+')');
        overlay.hide();
        return;
      }
      const js = await res.json();
      const row = js && js.data ? js.data : js;
      if(!row){ toast('Load failed'); return; }
  setCurrentGameId(row.id || id || null);
      let words = row.words;
      if (typeof words === 'string') {
        try { words = JSON.parse(words); } catch {}
      }
      if(!Array.isArray(words) && words && typeof words === 'object') {
        if(Array.isArray(words.words)) words = words.words;
        else if(Array.isArray(words.data)) words = words.data;
        else if(Array.isArray(words.items)) words = words.items;
        else {
          const numKeys = Object.keys(words).filter(k=>/^\d+$/.test(k)).sort((a,b)=>Number(a)-Number(b));
          if(numKeys.length) words = numKeys.map(k=> words[k]);
        }
      }
      if(!Array.isArray(words)) {
        console.warn('[game-builder] Unexpected words shape', row.words);
        toast('Game has no words');
        return;
      }
      saveState();
      const mapped = words.map(w => {
        if(!w) return null;
        if(typeof w === 'string'){
          const parts = w.split(/[,|]/);
          const eng = (parts[0]||'').trim();
          const kor = (parts[1]||'').trim();
          return eng ? newRow({ eng, kor }) : null;
        }
        return newRow({
          eng: w.eng || w.en || w.word || '',
          kor: w.kor || w.kr || w.translation || '',
          image_url: w.image_url || w.image || w.img || w.img_url || w.picture || '',
          definition: w.definition || w.def || w.meaning || '',
          example: w.example || w.example_sentence || w.sentence || ''
        });
      }).filter(Boolean);
      setList(mapped);
      if (titleEl) titleEl.value = row.title || 'Untitled Game';
      render();
      toast(mapped.length ? 'Game loaded' : 'Loaded (empty)');
      fileModal.style.display = 'none';
      cacheCurrentGame();
    } catch(e){ console.error(e); toast('Load error'); }
    finally { try { overlay.hide(); } catch{} }
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
        if (removed) { fileListRows.splice(idx,0,removed); }
      }
    } catch(e){ console.error(e); toast('Delete error'); }
  }

  function renderList(list) {
    const frag = document.createDocumentFragment();
    const currentUid = getCurrentUserId();
    list.forEach(r => {
      const div = document.createElement('div');
      div.className = 'game-card new-style';
      if(selectedGameIds.has(r.id)) div.classList.add('selected');
      const owned = !r.created_by || r.created_by === currentUid;
      const isSelected = selectedGameIds.has(r.id);
      div.innerHTML = buildGameCardHTML(r, owned, isSelected, currentUid);
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
        if(!entry.isIntersecting) return;
        const wrap = entry.target; observer.unobserve(wrap);
        const img = wrap.querySelector('img');
        const actual = wrap.getAttribute('data-thumb');
        if(!actual){ wrap.classList.add('no-image'); return; }
        img.src = actual;
        img.onload = () => wrap.classList.add('loaded');
        img.onerror = () => {
          if(/^(https?:\/\/)/.test(actual) && !/\.netlify\/functions\/image_proxy/.test(actual)){
            try {
              const base = (window.R2_PUBLIC_BASE||'').replace(/\/$/, '');
              if(base && actual.startsWith(base+'/')){
                const key = actual.substring(base.length+1);
                let normKey2 = key.replace(/^(?:images\/)+/i,'').replace(/^(?:public\/)+/i,'');
                const prox = '/.netlify/functions/image_proxy?key=' + encodeURIComponent(normKey2);
                img.src = prox;
                img.onload = () => wrap.classList.add('loaded');
                img.onerror = () => wrap.classList.add('error');
                return;
              }
            } catch{}
          }
          wrap.classList.add('error');
        };
      });
    }, { rootMargin:'150px 0px', threshold:0.01 });
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

// --- Prefetch & Warm-Up -------------------------------------------------------
// After main UI is stable, warm the list endpoint so first manual open is instant.
if(!window.__gbPrefetchScheduled){
  window.__gbPrefetchScheduled = true;
  window.addEventListener('load', () => {
    // Warm-up HEAD-style (head=1) quickly
    setTimeout(()=>{ try { fetch('/.netlify/functions/list_game_data_unique?limit=1&offset=0&head=1&unique=1&page_pull=1', { cache:'no-store' }); } catch{} }, 1200);
    // Full prefetch if no fresh session cache exists
    setTimeout(()=>{
      try {
        const raw = sessionStorage.getItem('gb_file_list_cache_v1');
        if(!raw){ populateFileList(); }
      } catch{}
    }, 2500);
  });
}
// -----------------------------------------------------------------------------
