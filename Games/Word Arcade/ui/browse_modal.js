// Browse Saved Games modal (extracted from main)
// Renders a list of saved game_data rows with thumbnails and emits open(id)

let cachedGames = null;
let cacheTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function showBrowseModal({ onOpen, onClose } = {}) {
  // Ensure a fresh modal structure exists before querying elements
  const existing = document.getElementById('wa-browse-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'wa-browse-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:9999;display:flex;align-items:center;justify-content:center;padding:12px;';

  const modal = document.createElement('div');
  modal.id = 'wa-browse-modal';
  modal.style.cssText = 'width:80vw;max-width:720px;max-height:85vh;background:#fff;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,0.25);overflow:hidden;display:flex;flex-direction:column;font-family:\'Poppins\',Arial,sans-serif;';

  modal.innerHTML = `
    <div id="wa-browse-header" style="position:sticky;top:0;background:#f6feff;border-bottom:2px solid #a9d6e9;z-index:1;">
      <div style="display:flex;align-items:center;gap:8px;justify-content:space-between;padding:10px 12px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <button id="prevPageBtn" title="Previous" style="cursor:pointer;border:1px solid #a9d6e9;background:#fff;color:#19777e;border-radius:8px;padding:6px 10px;font-weight:600;">◀</button>
          <button id="nextPageBtn" title="Next" style="cursor:pointer;border:1px solid #a9d6e9;background:#fff;color:#19777e;border-radius:8px;padding:6px 10px;font-weight:600;">▶</button>
        </div>
        <button id="closeBrowseBtn" aria-label="Close" style="margin-left:auto;cursor:pointer;border:none;background:transparent;color:#19777e;font-size:20px;font-weight:700;">✕</button>
      </div>
      <div style="padding:0 12px 10px 12px;">
        <input id="savedGamesSearch" type="text" placeholder="Search by title" style="width:100%;box-sizing:border-box;border:2px solid #a9d6e9;border-radius:10px;padding:8px 10px;font-size:14px;outline:none;" />
      </div>
    </div>
    <div id="savedGamesList" style="padding:8px 0;overflow:auto;">
      <!-- rows render here -->
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Local state & helpers
  let offset = 0;
  let rows = [];
  let filteredRows = [];
  let lastFetchCount = 0;

  const prevBtn = modal.querySelector('#prevPageBtn');
  const nextBtn = modal.querySelector('#nextPageBtn');
  const listEl = modal.querySelector('#savedGamesList');
  const searchEl = modal.querySelector('#savedGamesSearch');
  const closeBtn = modal.querySelector('#closeBrowseBtn');

  function close() {
    try { overlay.remove(); } catch (e) { /* ignore */ }
    if (typeof onClose === 'function') onClose();
  }
  if (closeBtn) closeBtn.onclick = close;
  function renderList() {
    if (!filteredRows.length) {
      listEl.innerHTML = '<div style="color:#666;text-align:center;padding:8px;">No saved games yet.</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    const colors = ['#21b3be', '#5b7fe5', '#ff6fb0', '#d9923b'];
    filteredRows.forEach((r, i) => {
      const t = r.title || 'Untitled';
      const creator = r.creator_name || r.created_by || 'Unknown';
      let img = r.game_image || r.image || r.img;
      if (!img || img === 'null' || img === 'undefined') {
        img = './assets/Images/icons/browse.svg';
      }
      const color = colors[i % colors.length];
      const rowDiv = document.createElement('div');
      rowDiv.className = 'wa-option sg-row';
      rowDiv.setAttribute('data-id', r.id);
      rowDiv.style.cssText = `display:flex;align-items:center;justify-content:flex-start;gap:10px;width:90%;background:none;border:none;font-size:1.1rem;cursor:pointer;font-family:'Poppins',Arial,sans-serif;color:${color};padding:12px 18px;`;
      const imgEl = document.createElement('img');
      imgEl.src = img;
      imgEl.alt = t;
      imgEl.className = 'wa-icon';
      imgEl.style.cssText = 'width:56px;height:56px;flex-shrink:0;border-radius:12px;object-fit:cover;align-self:center;';
      imgEl.onerror = function() {
        this.onerror = null;
        this.src = './assets/Images/icons/browse.svg';
      };
      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;min-width:0;';
      const titleEl = document.createElement('div');
      titleEl.style.cssText = 'font-weight:600;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:220px;';
      titleEl.textContent = t;
      const byEl = document.createElement('div');
      byEl.style.cssText = 'font-size:0.85em;opacity:0.75;line-height:1.2;';
      byEl.textContent = `by ${creator}`;
      textWrap.appendChild(titleEl);
      textWrap.appendChild(byEl);
      rowDiv.appendChild(imgEl);
      rowDiv.appendChild(textWrap);
      rowDiv.onclick = () => {
        const id = rowDiv.getAttribute('data-id');
        if (id && onOpen) onOpen(id, close);
      };
      fragment.appendChild(rowDiv);
      if (i < filteredRows.length - 1) {
        const hr = document.createElement('hr');
        hr.className = 'wa-rule';
        hr.style.cssText = 'border:0;border-top:2px solid #a9d6e9;margin:6px auto;width:70%;';
        fragment.appendChild(hr);
      }
    });
    listEl.innerHTML = '';
    listEl.appendChild(fragment);
  }
  function updateButtons() {
    if (prevBtn) prevBtn.disabled = offset === 0;
    if (nextBtn) nextBtn.disabled = lastFetchCount < 10;
  }
  if (prevBtn) {
    prevBtn.onclick = () => { if (offset >= 10) fetchPage(offset - 10); };
  }
  if (nextBtn) {
    nextBtn.onclick = () => { if (lastFetchCount === 10) fetchPage(offset + 10); };
  }
  if (searchEl) {
    searchEl.oninput = function() {
      const val = this.value.trim().toLowerCase();
      filteredRows = val ? rows.filter(r => (r.title || '').toLowerCase().includes(val)) : rows;
      renderList();
    };
  }
  async function fetchPage(newOffset = 0) {
    offset = newOffset;
    listEl.innerHTML = '<div style="text-align:center;padding:20px;"><div style="width:24px;height:24px;border:3px solid #ddd;border-top:3px solid #19777e;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div><style>@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}</style></div>';
    let token = null;
    try {
      if (window.WordArcade && typeof window.WordArcade.getAccessToken === 'function') {
        token = await window.WordArcade.getAccessToken();
      }
    } catch {}
    const res = await fetch(`/.netlify/functions/supabase_proxy_fixed?list=game_data&limit=10&offset=${offset}`, {
      cache: 'no-store',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    let js = null;
    try { js = await res.json(); } catch { js = null; }
    if (!res.ok) {
      const msg = (js && (js.error || js.message)) ? String(js.error || js.message) : `HTTP ${res.status}`;
      listEl.innerHTML = `<div style="color:#b23;text-align:center;padding:12px;">${msg}</div>`;
      lastFetchCount = 0; rows = []; filteredRows = []; updateButtons();
      return;
    }
    rows = Array.isArray(js?.data) ? js.data : (Array.isArray(js) ? js : []);
    lastFetchCount = rows.length;
    filteredRows = rows;
    renderList();
    updateButtons();
  }
  fetchPage(0);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
}
}
