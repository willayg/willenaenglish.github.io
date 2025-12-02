// Saved games modal: listing, filtering, pagination, open/delete logic
import { ensureLoadingOverlay, buildSkeletonHTML, showTinyToast } from '../utils/dom-helpers.js';
import { getCurrentUserId, deleteGameData as deleteGameSvc, loadGameData as loadGameDataSvc } from '../services/file-service.js';
import { ensureMaterialIcons, buildGameCardHTML } from '../render/file-grid.js';
import { getList, setList, saveState, newRow, setCurrentGameId } from '../state/game-state.js';
import { cacheCurrentGame } from '../state/game-state.js';

// Internal state for modal
let fileListRows = [];
let fileListUniqueCount = 0;
let fileListAllMode = false;
let selectedGameIds = new Set();
let fileListCache = null; // { ts, rows, uniqueCount }
const SESSION_CACHE_MAX_AGE_MS = 180000;

export function initFileListModal({ fileModal, fileListEl, openLink, fileModalClose, titleEl, toast, render }) {
  if (!fileModal || !fileListEl || !openLink) return;

  openLink.onclick = () => {
    fileModal.style.display = 'flex';
    fileListEl.innerHTML = buildSkeletonHTML(8);
    populateFileList({ fileListEl, titleEl, toast, render });
  };
  fileModalClose && (fileModalClose.onclick = () => fileModal.style.display = 'none');
  window.addEventListener('click', (e)=> { if (e.target === fileModal) fileModal.style.display = 'none'; });
}

async function populateFileList({ fileListEl, titleEl, toast, render }) {
  const useCache = fileListCache && (Date.now() - fileListCache.ts) < SESSION_CACHE_MAX_AGE_MS;
  if (useCache) {
    fileListRows = fileListCache.rows.slice();
    fileListUniqueCount = fileListCache.uniqueCount;
    paintFileList(fileListRows, { fileListEl, titleEl, toast, render, cached:true, initial:true, uniqueCount:fileListUniqueCount });
    // async refresh in background
    fetchAndPaint({ fileListEl, titleEl, toast, render, silent:true });
    return;
  }
  await fetchAndPaint({ fileListEl, titleEl, toast, render });
}

async function fetchAndPaint({ fileListEl, titleEl, toast, render, silent }) {
  try {
    const qs = new URLSearchParams({ limit:'40', offset:'0', unique:'1', names:'0', page_pull:'40' });
    const res = await WillenaAPI.fetch('/.netlify/functions/list_game_data_unique?' + qs.toString());
    if(!res.ok) throw new Error('list status '+res.status);
    const js = await res.json();
    fileListRows = Array.isArray(js.data)? js.data: [];
    fileListUniqueCount = js.unique_count || js.uniqueCount || 0;
    fileListCache = { ts:Date.now(), rows:fileListRows.slice(), uniqueCount:fileListUniqueCount };
    paintFileList(fileListRows, { fileListEl, titleEl, toast, render, cached:false, initial:true, uniqueCount:fileListUniqueCount });
  } catch(e){
    console.warn('[file-list] load error', e);
    if(!silent) fileListEl.innerHTML = `<p style="padding:12px;color:#b91c1c;">Error loading games (${e.message}). <button id="retryFileList">Retry</button></p>`;
    const retry = document.getElementById('retryFileList');
    retry && (retry.onclick = ()=> fetchAndPaint({ fileListEl, titleEl, toast, render }));
  }
}

function paintFileList(rows, { fileListEl, titleEl, toast, render, cached, initial, uniqueCount }) {
  const creators = [...new Set(rows.map(r => r.creator_name || 'Unknown'))].sort();
  fileListEl.innerHTML = `
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

  ensureMaterialIcons();
  const grid = document.getElementById('gameGrid');
  const searchInput = document.getElementById('gameSearch');
  const creatorFilter = document.getElementById('creatorFilter');
  const creatorScope = document.getElementById('creatorScope');
  const meta = document.getElementById('fileListMeta');

  function applyFilters() {
    const q = (searchInput.value||'').trim().toLowerCase();
    const creatorSel = creatorFilter.value;
    const filtered = rows.filter(r => {
      if(q && !(r.title||'').toLowerCase().includes(q)) return false;
      if(creatorSel && (r.creator_name||'Unknown') !== creatorSel) return false;
      if(!fileListAllMode) {
        const uid = getCurrentUserId();
        if (r.created_by && uid && r.created_by !== uid) return false;
      }
      return true;
    });
    renderList(filtered, grid);
    if(meta) meta.textContent = `${filtered.length} shown${filtered.length<rows.length? ' / '+rows.length:''} • ${uniqueCount} unique` + (cached? ' (cache)':'' );
  }
  searchInput.oninput = applyFilters;
  creatorFilter.onchange = applyFilters;
  creatorScope.onchange = () => { fileListAllMode = creatorScope.value === 'all'; applyFilters(); };
  applyFilters();
}

function renderList(list, grid){
  const frag = document.createDocumentFragment();
  const currentUid = getCurrentUserId();
  list.forEach(r => {
    const div = document.createElement('div');
    div.className = 'game-card new-style';
    const owned = !r.created_by || r.created_by === currentUid;
    div.innerHTML = buildGameCardHTML(r, owned, false, currentUid);
    frag.appendChild(div);
  });
  grid.replaceChildren(frag);
  grid.querySelectorAll('[data-open]').forEach(el => {
    el.onclick = () => openGame(rId(el), list, { titleEl, render });
  });
  grid.querySelectorAll('[data-del]').forEach(el => {
    el.onclick = () => ownedGuard(el, () => deleteGame(rId(el), { toast, render }));
  });
}

function rId(el){ return el.getAttribute('data-open') || el.getAttribute('data-del'); }
function ownedGuard(el, fn){ if(el.hasAttribute('disabled')) return; fn(); }

async function openGame(idListKey, listSnapshot, { titleEl, render }) {
  const overlay = ensureLoadingOverlay(); overlay.show('Loading game…');
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy_fixed?get=game_data&id=' + encodeURIComponent(idListKey));
    if(!res.ok) throw new Error('open status '+res.status);
    const js = await res.json();
    const row = js && js.data ? js.data : js;
    if(!row) throw new Error('no row');
    setCurrentGameId(row.id || idListKey || null);
    let words = row.words;
    if (typeof words === 'string') { try { words = JSON.parse(words); } catch {} }
    if (!Array.isArray(words)) words = [];
    saveState();
    const mapped = words.map(w => {
      if(!w) return null;
      if(typeof w === 'string'){
        const parts = w.split(/[,|]/); const eng=(parts[0]||'').trim(); const kor=(parts[1]||'').trim();
        return eng? newRow({eng, kor}): null;
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
    if(titleEl) titleEl.value = row.title || 'Untitled Game';
    render();
    showTinyToast(mapped.length? 'Game loaded':'Loaded (empty)', { ms:1300 });
    cacheCurrentGame(titleEl?.value||'');
  } catch(e){ console.warn('[file-list] open error', e); showTinyToast('Open failed', { variant:'error'}); }
  finally { overlay.hide(); }
}

async function deleteGame(id, { toast, render }) {
  try {
    const ok = confirm('Delete this game?'); if(!ok) return;
    const res = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy_fixed', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'delete_game_data', id }) });
    const js = await res.json();
    if(js?.success){
      fileListRows = fileListRows.filter(r=> r.id !== id);
      paintFileList(fileListRows, { fileListEl: document.getElementById('fileList'), titleEl, toast, render, cached:false, initial:false, uniqueCount:fileListUniqueCount });
      toast('Deleted');
    } else toast(js?.error||'Delete failed');
  } catch(e){ console.warn(e); toast('Delete error'); }
}
