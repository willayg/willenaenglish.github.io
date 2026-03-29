// Saved games modal: listing, filtering, pagination, open/delete logic
import { ensureLoadingOverlay, buildSkeletonHTML, showTinyToast } from '../utils/dom-helpers.js';
import { ensureMaterialIcons, buildGameCardHTML } from '../render/file-grid.js';
import { setList, saveState, newRow, setCurrentGameId } from '../state/game-state.js?v=20260328e';
import { cacheCurrentGame } from '../state/game-state.js?v=20260328e';

let fileListRows = [];
let fileListUniqueCount = 0;
let fileListAllMode = false;
let fileListCache = null; // { ts, rows, uniqueCount, key }
const SESSION_CACHE_MAX_AGE_MS = 180000;
const IMAGE_BATCH_SIZE = 10;
const FILE_PAGE_SIZE = 10;
const FILE_PAGE_PULL = 30;
let fileListOffset = 0;
let fileListHasMore = false;

let currentUserProfile = { name: '', username: '' };
let profileInFlight = null;
let imagesEnabled = true;
let activeImageBatchToken = 0;
let warmCacheStarted = false;
let selectedGameIds = new Set();

let modalContext = {
  fileModal: null,
  fileListEl: null,
  titleEl: null,
  toast: (msg) => showTinyToast(msg || ''),
  render: () => {}
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function currentUserNameCandidates() {
  const vals = [currentUserProfile.name, currentUserProfile.username]
    .map(normalizeText)
    .filter(Boolean);
  return Array.from(new Set(vals));
}

function isMyGameRow(row) {
  if (!row) return false;
  const creator = normalizeText(row.creator_name);
  if (!creator || creator === 'system' || creator === 'unknown') return false;
  const mine = currentUserNameCandidates();
  if (!mine.length) return false;
  return mine.includes(creator);
}

async function resolveCurrentUserProfile() {
  if (currentUserNameCandidates().length) return currentUserProfile;
  if (profileInFlight) return profileInFlight;
  profileInFlight = (async () => {
    try {
      const res = await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=get_profile_name&_=' + Date.now(), { cache: 'no-store' });
      if (!res || !res.ok) return currentUserProfile;
      const js = await res.json().catch(() => null);
      currentUserProfile = {
        name: String(js?.name || '').trim(),
        username: String(js?.username || '').trim()
      };
      return currentUserProfile;
    } catch {
      return currentUserProfile;
    } finally {
      profileInFlight = null;
    }
  })();
  return profileInFlight;
}

export function initFileListModal({ fileModal, fileListEl, openLink, fileModalClose, titleEl, toast, render }) {
  if (!fileModal || !fileListEl || !openLink) return;

  modalContext = {
    fileModal,
    fileListEl,
    titleEl,
    toast: typeof toast === 'function' ? toast : (msg) => showTinyToast(msg || ''),
    render: typeof render === 'function' ? render : (() => {})
  };

  if (typeof window !== 'undefined') {
    window.__gbInvalidateFileListCache = () => { fileListCache = null; };
  }

  // Warm the first page in the background so first modal open is much faster.
  if (!warmCacheStarted) {
    warmCacheStarted = true;
    setTimeout(() => {
      fetchAndPaint({ silent: true, reset: true, renderNow: false }).catch(() => {});
    }, 900);
  }

  openLink.onclick = () => {
    fileModal.style.display = 'flex';
    fileListEl.innerHTML = buildSkeletonHTML(8);
    // Always refresh on open so newly saved games appear immediately.
    fileListCache = null;
    populateFileList({ forceFresh: true });
  };
  fileModalClose && (fileModalClose.onclick = () => fileModal.style.display = 'none');
  window.addEventListener('click', (e) => { if (e.target === fileModal) fileModal.style.display = 'none'; });
}

async function populateFileList({ forceFresh = false } = {}) {
  if (!fileListAllMode) {
    await resolveCurrentUserProfile();
  } else {
    // Resolve profile in parallel for metadata text, but do not block list fetch.
    resolveCurrentUserProfile().catch(() => {});
  }
  fileListOffset = 0;
  const modeKey = fileListAllMode ? 'all' : 'mine';
  const userKey = currentUserNameCandidates().join('|');
  const cacheKey = `${modeKey}:${userKey}`;
  const useCache = !forceFresh && fileListCache
    && fileListCache.key === cacheKey
    && (Date.now() - fileListCache.ts) < SESSION_CACHE_MAX_AGE_MS;

  if (useCache) {
    fileListRows = fileListCache.rows.slice();
    fileListUniqueCount = fileListCache.uniqueCount;
    fileListHasMore = fileListRows.length < fileListUniqueCount;
    paintFileList(fileListRows, { cached: true, uniqueCount: fileListUniqueCount });
    fetchAndPaint({ silent: true });
    return;
  }

  await fetchAndPaint({ silent: false, reset: true, renderNow: true });
}

async function fetchAndPaint({ silent, reset = false, renderNow = true }) {
  try {
    if (!fileListAllMode) {
      await resolveCurrentUserProfile();
    }
    const qs = new URLSearchParams({
      limit: String(FILE_PAGE_SIZE),
      offset: String(fileListOffset),
      unique: '1',
      names: '1',
      page_pull: String(FILE_PAGE_PULL)
    });

    if (fileListAllMode) {
      qs.set('all', '1');
    } else {
      const names = currentUserNameCandidates();
      if (!names.length) throw new Error('Unable to resolve current user');
      qs.set('creator_name_any', names.join(','));
    }

    const res = await WillenaAPI.fetch('/.netlify/functions/list_game_data_unique?' + qs.toString());
    if (!res.ok) throw new Error('list status ' + res.status);

    const js = await res.json().catch(() => null);
    const incomingRows = Array.isArray(js?.data) ? js.data : [];
    fileListRows = reset ? incomingRows : fileListRows.concat(incomingRows);
    fileListUniqueCount = js?.unique_count || js?.uniqueCount || fileListRows.length;
    fileListHasMore = fileListRows.length < fileListUniqueCount;

    const modeKey = fileListAllMode ? 'all' : 'mine';
    const userKey = currentUserNameCandidates().join('|');
    fileListCache = { ts: Date.now(), rows: fileListRows.slice(), uniqueCount: fileListUniqueCount, key: `${modeKey}:${userKey}` };

    if (renderNow && modalContext.fileListEl && modalContext.fileListEl.offsetParent !== null) {
      paintFileList(fileListRows, { cached: false, uniqueCount: fileListUniqueCount });
    }
  } catch (e) {
    console.warn('[file-list] load error', e);
    if (!silent && modalContext.fileListEl) {
      modalContext.fileListEl.innerHTML = `<p style="padding:12px;color:#b91c1c;">Error loading games (${e.message}). <button id="retryFileList">Retry</button></p>`;
      const retry = document.getElementById('retryFileList');
      retry && (retry.onclick = () => fetchAndPaint({ silent: false }));
    }
  }
}

function paintFileList(rows, { cached, uniqueCount }) {
  const fileListEl = modalContext.fileListEl;
  if (!fileListEl) return;

  const creators = [...new Set(rows.map(r => String(r?.creator_name || 'Unknown')))].sort();
  const signedInAs = currentUserProfile.name || currentUserProfile.username || 'User';

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
      <label class="saved-games-image-toggle" for="savedGamesImagesToggle">
        <input type="checkbox" id="savedGamesImagesToggle" ${imagesEnabled ? 'checked' : ''} />
        <span>Images</span>
      </label>
      <button id="deleteSelectedGamesBtn" class="btn" style="background:#dc2626;color:#fff;border-color:#dc2626;" disabled>Delete Selected (0)</button>
    </div>
    <div id="gameGrid" class="saved-games-grid"></div>
    <div id="fileListLoadMoreWrap" style="margin-top:12px;display:flex;justify-content:center;"></div>
    <div id="fileListMeta" style="margin-top:8px;font-size:11px;color:#64748b;"></div>`;

  ensureMaterialIcons();

  const grid = document.getElementById('gameGrid');
  const searchInput = document.getElementById('gameSearch');
  const creatorFilter = document.getElementById('creatorFilter');
  const creatorScope = document.getElementById('creatorScope');
  const imagesToggle = document.getElementById('savedGamesImagesToggle');
  const deleteSelectedBtn = document.getElementById('deleteSelectedGamesBtn');
  const loadMoreWrap = document.getElementById('fileListLoadMoreWrap');
  const meta = document.getElementById('fileListMeta');

  const updateDeleteSelectedButton = () => {
    const deletableIds = Array.from(selectedGameIds).filter(id => {
      const row = fileListRows.find(r => r && r.id === id);
      return row && isMyGameRow(row);
    });
    const count = deletableIds.length;
    if (deleteSelectedBtn) {
      deleteSelectedBtn.disabled = count === 0;
      deleteSelectedBtn.textContent = `Delete Selected (${count})`;
    }
    return deletableIds;
  };

  if (deleteSelectedBtn) {
    deleteSelectedBtn.onclick = async () => {
      const ids = updateDeleteSelectedButton();
      if (!ids.length) return;
      const ok = confirm(`Delete ${ids.length} selected game${ids.length === 1 ? '' : 's'}?`);
      if (!ok) return;
      let deleted = 0;
      for (const id of ids) {
        try {
          const res = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy_fixed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete_game_data', id })
          });
          const js = await res.json().catch(() => null);
          if (js?.success) {
            deleted++;
            selectedGameIds.delete(id);
            fileListRows = fileListRows.filter(r => r.id !== id);
          }
        } catch (e) {
          console.warn('[file-list] batch delete error', id, e);
        }
      }
      if (deleted) {
        fileListUniqueCount = Math.max(0, fileListUniqueCount - deleted);
        paintFileList(fileListRows, { cached: false, uniqueCount: fileListUniqueCount });
        modalContext.toast(`Deleted ${deleted}`);
      }
    };
  }

  function applyFilters() {
    const q = normalizeText(searchInput.value);
    const creatorSel = creatorFilter.value;
    const filtered = rows.filter(r => {
      const title = normalizeText(r?.title);
      if (q && !title.includes(q)) return false;
      if (creatorSel && String(r?.creator_name || 'Unknown') !== creatorSel) return false;
      if (!fileListAllMode && !isMyGameRow(r)) return false;
      return true;
    });

    renderList(filtered, grid);
    updateDeleteSelectedButton();

    if (loadMoreWrap) {
      loadMoreWrap.innerHTML = fileListHasMore
        ? '<button id="savedGamesLoadMore" class="btn">Load More</button>'
        : '';
      const loadMoreBtn = document.getElementById('savedGamesLoadMore');
      if (loadMoreBtn) {
        loadMoreBtn.onclick = async () => {
          loadMoreBtn.disabled = true;
          loadMoreBtn.textContent = 'Loading...';
          fileListOffset += FILE_PAGE_SIZE;
          await fetchAndPaint({ silent: false, reset: false });
        };
      }
    }

    if (meta) {
      meta.textContent = `${filtered.length} shown${filtered.length < rows.length ? ' / ' + rows.length : ''} • ${uniqueCount} unique • Signed in as ${signedInAs}` + (cached ? ' (cache)' : '');
    }
  }

  searchInput.oninput = applyFilters;
  creatorFilter.onchange = applyFilters;
  creatorScope.onchange = async () => {
    fileListAllMode = creatorScope.value === 'all';
    fileListEl.innerHTML = buildSkeletonHTML(8);
    await populateFileList();
  };
  imagesToggle.onchange = () => {
    imagesEnabled = !!imagesToggle.checked;
    applyFilters();
  };

  applyFilters();
}

function renderList(list, grid) {
  const frag = document.createDocumentFragment();
  list.forEach(r => {
    const div = document.createElement('div');
    div.className = 'game-card new-style';
    const owned = isMyGameRow(r);
    div.innerHTML = buildGameCardHTML(r, owned, false, currentUserProfile.username || currentUserProfile.name || '');
    frag.appendChild(div);
  });

  grid.replaceChildren(frag);
  normalizeCardControls(grid);
  scheduleImageLoading(grid);

  grid.querySelectorAll('[data-select-id]').forEach(el => {
    const id = el.getAttribute('data-select-id');
    if (id && selectedGameIds.has(id)) el.checked = true;
    el.onclick = (e) => e.stopPropagation();
    el.onchange = (e) => {
      e.stopPropagation();
      const targetId = el.getAttribute('data-select-id');
      if (!targetId) return;
      if (el.checked) selectedGameIds.add(targetId);
      else selectedGameIds.delete(targetId);
      const btn = document.getElementById('deleteSelectedGamesBtn');
      if (btn) {
        const count = Array.from(selectedGameIds).filter(x => {
          const row = fileListRows.find(r => r && r.id === x);
          return row && isMyGameRow(row);
        }).length;
        btn.disabled = count === 0;
        btn.textContent = `Delete Selected (${count})`;
      }
    };
  });

  grid.querySelectorAll('.game-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target && e.target.closest('[data-select-id]')) return;
      const openEl = card.querySelector('[data-open]');
      const id = openEl ? openEl.getAttribute('data-open') : '';
      if (id) openGame(id);
    };
  });
}

function normalizeCardControls(grid) {
  if (!grid) return;

  // Remove legacy per-card delete controls if old markup appears.
  grid.querySelectorAll('.del-btn,[data-del]').forEach(el => el.remove());

  // Ensure every card has a checkbox selector for batch delete.
  grid.querySelectorAll('.game-card').forEach(card => {
    const hasSelector = !!card.querySelector('input[type="checkbox"][data-select-id]');
    if (hasSelector) return;

    const openEl = card.querySelector('[data-open]');
    const id = openEl ? openEl.getAttribute('data-open') : '';
    if (!id) return;

    const anchor = document.createElement('label');
    anchor.className = 'card-check-anchor';
    anchor.title = 'Select for delete';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.setAttribute('data-select-id', id);

    const text = document.createElement('span');
    text.textContent = 'Select';

    anchor.appendChild(cb);
    anchor.appendChild(text);

    const thumb = card.querySelector('.thumb-wrap') || card;
    thumb.appendChild(anchor);
  });
}

function scheduleImageLoading(grid) {
  activeImageBatchToken += 1;
  const token = activeImageBatchToken;
  const wraps = Array.from(grid.querySelectorAll('.thumb-wrap.lazy'));

  if (!imagesEnabled) {
    wraps.forEach(wrap => {
      wrap.classList.add('no-image');
      wrap.classList.remove('loaded', 'error');
    });
    return;
  }

  wraps.forEach(wrap => {
    wrap.classList.remove('no-image');
  });

  let nextIndex = 0;
  let pumping = false;

  const loadThumb = (wrap) => new Promise((resolve) => {
    const img = wrap.querySelector('img');
    const actual = wrap.getAttribute('data-thumb');
    if (!img || !actual) {
      wrap.classList.add('no-image');
      resolve();
      return;
    }
    if (wrap.dataset.loaded === '1' || wrap.classList.contains('loaded')) {
      resolve();
      return;
    }
    img.onload = () => {
      wrap.dataset.loaded = '1';
      wrap.classList.add('loaded');
      resolve();
    };
    img.onerror = () => {
      wrap.classList.add('error');
      resolve();
    };
    img.src = actual;
  });

  const pump = async () => {
    if (pumping || token !== activeImageBatchToken) return;
    pumping = true;
    try {
      const batch = wraps.slice(nextIndex, nextIndex + IMAGE_BATCH_SIZE);
      nextIndex += batch.length;
      await Promise.all(batch.map(loadThumb));
    } finally {
      pumping = false;
    }
  };

  const maybePumpMore = () => {
    if (token !== activeImageBatchToken) return;
    if (nextIndex >= wraps.length) return;
    const container = modalContext.fileListEl;
    if (!container) return;
    const nearBottom = (container.scrollTop + container.clientHeight) >= (container.scrollHeight - 240);
    if (nearBottom) {
      pump();
    }
  };

  void pump();
  const container = modalContext.fileListEl;
  if (!container) return;
  const onScroll = () => maybePumpMore();
  container.onscroll = onScroll;
  setTimeout(() => maybePumpMore(), 120);
}

function rId(el) { return el.getAttribute('data-open') || el.getAttribute('data-del'); }
function ownedGuard(el, fn) { if (el.hasAttribute('disabled')) return; fn(); }

async function openGame(idListKey) {
  const overlay = ensureLoadingOverlay();
  overlay.show('Loading game...');
  try {
    const res = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy_fixed?get=game_data&id=' + encodeURIComponent(idListKey));
    if (!res.ok) throw new Error('open status ' + res.status);
    const js = await res.json().catch(() => null);
    const row = js && js.data ? js.data : js;
    if (!row) throw new Error('no row');

    setCurrentGameId(row.id || idListKey || null);

    let words = row.words;
    if (typeof words === 'string') { try { words = JSON.parse(words); } catch {} }
    if (!Array.isArray(words)) words = [];

    saveState();
    const mapped = words.map(w => {
      if (!w) return null;
      if (typeof w === 'string') {
        const parts = w.split(/[,|]/);
        const eng = (parts[0] || '').trim();
        const kor = (parts[1] || '').trim();
        return eng ? newRow({ eng, kor }) : null;
      }
      return newRow({
        eng: w.eng || w.en || w.word || '',
        kor: w.kor || w.kr || w.translation || '',
        image_url: w.image_url || w.image || w.img || w.img_url || w.picture || '',
        definition: w.definition || w.def || w.meaning || '',
        example: w.example || w.example_sentence || w.sentence || '',
        legacy_sentence: w.legacy_sentence || w.sentence || w.example || '',
        sentences: Array.isArray(w.sentences) ? w.sentences : [],
        primary_sentence_id: w.primary_sentence_id || w.sentence_id || '',
        sentence_mp3: w.sentence_mp3 || '',
        sentence_audio: w.sentence_audio || ''
      });
    }).filter(Boolean);

    setList(mapped);
    if (modalContext.titleEl) modalContext.titleEl.value = row.title || 'Untitled Game';
    modalContext.render();
    if (modalContext.fileModal) modalContext.fileModal.style.display = 'none';
    showTinyToast(mapped.length ? 'Game loaded' : 'Loaded (empty)', { ms: 1300 });
    cacheCurrentGame(modalContext.titleEl?.value || '');
  } catch (e) {
    console.warn('[file-list] open error', e);
    showTinyToast('Open failed', { variant: 'error' });
  } finally {
    overlay.hide();
  }
}

async function deleteGame(id) {
  try {
    const ok = confirm('Delete this game?');
    if (!ok) return;

    const res = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy_fixed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_game_data', id })
    });
    const js = await res.json().catch(() => null);
    if (js?.success) {
      fileListRows = fileListRows.filter(r => r.id !== id);
      paintFileList(fileListRows, { cached: false, uniqueCount: fileListUniqueCount });
      modalContext.toast('Deleted');
    } else {
      modalContext.toast(js?.error || 'Delete failed');
    }
  } catch (e) {
    console.warn(e);
    modalContext.toast('Delete error');
  }
}
