// Saved games browser: all games by default, searchable and filterable by creator name.
import { ensureLoadingOverlay, buildSkeletonHTML, showTinyToast } from '../utils/dom-helpers.js';
import { ensureMaterialIcons, buildGameCardHTML } from '../render/file-grid.js';
import { setList, saveState, newRow, setCurrentGameId, cacheCurrentGame } from '../state/game-state.js?v=20260329f';

const PAGE_SIZE = 100;
const MAX_GAMES = 2000;
const IMAGE_BATCH_SIZE = 16;

let rows = [];
let currentProfile = { name: '', username: '' };
let selectedIds = new Set();
let imagesEnabled = true;
let loadToken = 0;

let context = {
  fileModal: null,
  fileListEl: null,
  titleEl: null,
  toast: (message) => showTinyToast(message || ''),
  render: () => {}
};

function text(value) {
  return String(value || '').trim();
}

function normalized(value) {
  return text(value).toLowerCase();
}

function creatorName(row) {
  return text(row?.creator_name) || 'Unknown';
}

function profileNames() {
  return [...new Set([currentProfile.name, currentProfile.username].map(normalized).filter(Boolean))];
}

function ownedByCurrentProfile(row) {
  const creator = normalized(row?.creator_name);
  return !!creator && creator !== 'unknown' && creator !== 'system' && profileNames().includes(creator);
}

async function loadProfile() {
  try {
    const response = await WillenaAPI.fetch(
      '/.netlify/functions/supabase_auth?action=get_profile_name&_=' + Date.now(),
      { cache: 'no-store' }
    );
    if (!response?.ok) return;
    const data = await response.json().catch(() => null);
    currentProfile = {
      name: text(data?.name),
      username: text(data?.username)
    };
  } catch (error) {
    console.warn('[saved-games] profile lookup failed', error);
  }
}

export function initFileListModal({ fileModal, fileListEl, openLink, fileModalClose, titleEl, toast, render }) {
  if (!fileModal || !fileListEl || !openLink) return;

  context = {
    fileModal,
    fileListEl,
    titleEl,
    toast: typeof toast === 'function' ? toast : context.toast,
    render: typeof render === 'function' ? render : (() => {})
  };

  window.__gbInvalidateFileListCache = () => {
    rows = [];
    selectedIds.clear();
  };

  openLink.onclick = async (event) => {
    event?.preventDefault?.();
    fileModal.style.display = 'flex';
    fileListEl.innerHTML = buildSkeletonHTML(8);
    await loadAllGames();
  };

  if (fileModalClose) fileModalClose.onclick = () => { fileModal.style.display = 'none'; };
  window.addEventListener('click', (event) => {
    if (event.target === fileModal) fileModal.style.display = 'none';
  });
}

async function loadAllGames() {
  const token = ++loadToken;
  selectedIds.clear();
  await loadProfile();

  try {
    const collected = [];
    let offset = 0;
    let expected = Infinity;

    while (collected.length < expected && collected.length < MAX_GAMES) {
      const params = new URLSearchParams({
        all: '1',
        unique: '1',
        names: '1',
        limit: String(PAGE_SIZE),
        offset: String(offset),
        page_pull: String(PAGE_SIZE * 4),
        _: String(Date.now())
      });

      const response = await WillenaAPI.fetch(
        '/.netlify/functions/list_game_data_unique?' + params.toString(),
        { cache: 'no-store' }
      );
      if (!response.ok) throw new Error('status ' + response.status);

      const data = await response.json().catch(() => null);
      const page = Array.isArray(data?.data) ? data.data : [];
      expected = Number(data?.unique_count ?? data?.uniqueCount ?? data?.total_count ?? page.length);
      collected.push(...page);

      if (!page.length || page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    if (token !== loadToken) return;

    const byId = new Map();
    for (const row of collected) {
      const key = text(row?.id) || `${normalized(row?.title)}|${normalized(row?.creator_name)}|${row?.created_at || ''}`;
      if (!byId.has(key)) byId.set(key, row);
    }
    rows = [...byId.values()];
    paint();
  } catch (error) {
    console.warn('[saved-games] load failed', error);
    context.fileListEl.innerHTML = `
      <div style="padding:18px;color:#b91c1c;">
        Could not load saved games (${text(error?.message) || 'unknown error'}).
        <button id="retrySavedGames" class="btn">Retry</button>
      </div>`;
    document.getElementById('retrySavedGames')?.addEventListener('click', loadAllGames);
  }
}

function paint() {
  const fileListEl = context.fileListEl;
  if (!fileListEl) return;

  const creators = [...new Set(rows.map(creatorName))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  fileListEl.innerHTML = `
    <div class="saved-games-controls" style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <input id="gameSearch" type="search" placeholder="Search games by title..." style="flex:1 1 220px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;" />
      <select id="creatorFilter" style="flex:0 1 220px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;">
        <option value="">All teachers</option>
        ${creators.map(name => `<option value="${escapeAttribute(name)}">${escapeHtml(name)}</option>`).join('')}
      </select>
      <label class="saved-games-image-toggle" for="savedGamesImagesToggle">
        <input id="savedGamesImagesToggle" type="checkbox" ${imagesEnabled ? 'checked' : ''} />
        <span>Images</span>
      </label>
      <button id="deleteSelectedGamesBtn" class="btn" style="background:#dc2626;color:#fff;border-color:#dc2626;" disabled>Delete Selected (0)</button>
    </div>
    <div id="gameGrid" class="saved-games-grid"></div>
    <div id="fileListMeta" style="margin-top:10px;font-size:12px;color:#64748b;"></div>`;

  ensureMaterialIcons();

  const search = document.getElementById('gameSearch');
  const creator = document.getElementById('creatorFilter');
  const imageToggle = document.getElementById('savedGamesImagesToggle');
  const deleteButton = document.getElementById('deleteSelectedGamesBtn');

  const apply = () => {
    const query = normalized(search?.value);
    const selectedCreator = text(creator?.value);
    const filtered = rows.filter(row => {
      if (query && !normalized(row?.title).includes(query)) return false;
      if (selectedCreator && creatorName(row) !== selectedCreator) return false;
      return true;
    });

    renderCards(filtered);
    updateDeleteButton(deleteButton);

    const meta = document.getElementById('fileListMeta');
    if (meta) {
      meta.textContent = `${filtered.length} game${filtered.length === 1 ? '' : 's'} shown • ${creators.length} teacher${creators.length === 1 ? '' : 's'}`;
    }
  };

  search?.addEventListener('input', apply);
  creator?.addEventListener('change', apply);
  imageToggle?.addEventListener('change', () => {
    imagesEnabled = !!imageToggle.checked;
    apply();
  });
  deleteButton?.addEventListener('click', deleteSelected);

  apply();
}

function renderCards(list) {
  const grid = document.getElementById('gameGrid');
  if (!grid) return;

  const fragment = document.createDocumentFragment();
  for (const row of list) {
    const card = document.createElement('div');
    card.className = 'game-card new-style';
    const owned = ownedByCurrentProfile(row);
    card.innerHTML = buildGameCardHTML(
      row,
      owned,
      false,
      currentProfile.username || currentProfile.name || ''
    );
    fragment.appendChild(card);
  }
  grid.replaceChildren(fragment);

  grid.querySelectorAll('.del-btn,[data-del]').forEach(element => element.remove());

  grid.querySelectorAll('.game-card').forEach(card => {
    const openElement = card.querySelector('[data-open]');
    const id = text(openElement?.getAttribute('data-open'));
    if (!id) return;

    const row = rows.find(item => text(item?.id) === id);
    if (row && ownedByCurrentProfile(row)) {
      let checkbox = card.querySelector('[data-select-id]');
      if (!checkbox) {
        const label = document.createElement('label');
        label.className = 'card-check-anchor';
        label.innerHTML = `<input type="checkbox" data-select-id="${escapeAttribute(id)}"><span>Select</span>`;
        (card.querySelector('.thumb-wrap') || card).appendChild(label);
        checkbox = label.querySelector('input');
      }
      checkbox.checked = selectedIds.has(id);
      checkbox.addEventListener('click', event => event.stopPropagation());
      checkbox.addEventListener('change', event => {
        event.stopPropagation();
        if (checkbox.checked) selectedIds.add(id);
        else selectedIds.delete(id);
        updateDeleteButton(document.getElementById('deleteSelectedGamesBtn'));
      });
    } else {
      card.querySelectorAll('[data-select-id],.card-check-anchor').forEach(element => element.remove());
    }

    card.addEventListener('click', event => {
      if (event.target.closest('[data-select-id],.card-check-anchor')) return;
      openGame(id);
    });
  });

  loadImages(grid);
}

function loadImages(grid) {
  const wraps = [...grid.querySelectorAll('.thumb-wrap.lazy')];
  if (!imagesEnabled) {
    wraps.forEach(wrap => wrap.classList.add('no-image'));
    return;
  }

  wraps.forEach(wrap => wrap.classList.remove('no-image'));
  let index = 0;
  const next = () => {
    const batch = wraps.slice(index, index + IMAGE_BATCH_SIZE);
    index += batch.length;
    for (const wrap of batch) {
      const image = wrap.querySelector('img');
      const source = wrap.getAttribute('data-thumb');
      if (!image || !source) {
        wrap.classList.add('no-image');
        continue;
      }
      image.onload = () => wrap.classList.add('loaded');
      image.onerror = () => wrap.classList.add('error');
      image.src = source;
    }
    if (index < wraps.length) setTimeout(next, 0);
  };
  next();
}

function updateDeleteButton(button) {
  if (!button) return;
  const deletable = [...selectedIds].filter(id => {
    const row = rows.find(item => text(item?.id) === id);
    return row && ownedByCurrentProfile(row);
  });
  button.disabled = deletable.length === 0;
  button.textContent = `Delete Selected (${deletable.length})`;
}

async function deleteSelected() {
  const ids = [...selectedIds].filter(id => {
    const row = rows.find(item => text(item?.id) === id);
    return row && ownedByCurrentProfile(row);
  });
  if (!ids.length) return;
  if (!confirm(`Delete ${ids.length} selected game${ids.length === 1 ? '' : 's'}?`)) return;

  let deleted = 0;
  for (const id of ids) {
    try {
      const response = await WillenaAPI.fetch('/.netlify/functions/supabase_proxy_fixed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_game_data', id })
      });
      const data = await response.json().catch(() => null);
      if (data?.success) {
        rows = rows.filter(row => text(row?.id) !== id);
        selectedIds.delete(id);
        deleted++;
      }
    } catch (error) {
      console.warn('[saved-games] delete failed', id, error);
    }
  }
  if (deleted) {
    context.toast(`Deleted ${deleted}`);
    paint();
  }
}

async function openGame(id) {
  const overlay = ensureLoadingOverlay();
  overlay.show('Loading game...');
  try {
    const response = await WillenaAPI.fetch(
      '/.netlify/functions/supabase_proxy_fixed?get=game_data&id=' + encodeURIComponent(id)
    );
    if (!response.ok) throw new Error('status ' + response.status);
    const data = await response.json().catch(() => null);
    const row = data?.data || data;
    if (!row) throw new Error('game not found');

    let words = row.words;
    if (typeof words === 'string') {
      try { words = JSON.parse(words); } catch { words = []; }
    }
    if (!Array.isArray(words)) words = [];

    saveState();
    setCurrentGameId(row.id || id);
    setList(words.map(word => {
      if (typeof word === 'string') {
        const [eng = '', kor = ''] = word.split(/[,|]/);
        return newRow({ eng: eng.trim(), kor: kor.trim() });
      }
      return newRow({
        eng: word?.eng || word?.en || word?.word || '',
        kor: word?.kor || word?.kr || word?.translation || '',
        image_url: word?.image_url || word?.image || word?.img || word?.img_url || word?.picture || '',
        definition: word?.definition || word?.def || word?.meaning || '',
        example: word?.example || word?.example_sentence || word?.sentence || '',
        ex_kor: word?.ex_kor || word?.exKor || word?.example_kor || word?.sentence_kor || '',
        legacy_sentence: word?.legacy_sentence || word?.sentence || word?.example || '',
        sentences: Array.isArray(word?.sentences) ? word.sentences : [],
        primary_sentence_id: word?.primary_sentence_id || word?.sentence_id || '',
        sentence_mp3: word?.sentence_mp3 || '',
        sentence_audio: word?.sentence_audio || ''
      });
    }).filter(word => word?.eng));

    if (context.titleEl) context.titleEl.value = row.title || 'Untitled Game';
    context.render();
    context.fileModal.style.display = 'none';
    cacheCurrentGame(context.titleEl?.value || '');
    showTinyToast('Game loaded', { ms: 1300 });
  } catch (error) {
    console.warn('[saved-games] open failed', error);
    showTinyToast('Open failed', { variant: 'error' });
  } finally {
    overlay.hide();
  }
}

function escapeHtml(value) {
  return text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
