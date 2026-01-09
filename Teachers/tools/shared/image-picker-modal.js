/**
 * Shared Image Picker Modal
 * 
 * A reusable image picker component for Teacher Tools.
 * Fetches images from Pixabay with filter options and displays in a modal grid.
 * 
 * Usage (non-module / inline handlers):
 *   window.SharedImagePicker.open({
 *     query: 'cat',
 *     onSelect: (imageUrl) => { console.log('Selected:', imageUrl); }
 *   });
 * 
 * Usage (ES module):
 *   import { openImagePicker } from '/Teachers/tools/shared/image-picker-modal.js';
 *   openImagePicker({ query: 'cat', onSelect: (url) => {} });
 */

// Wrap in IIFE to avoid polluting global scope, but expose to window
(function() {
  'use strict';
  
  // Modal state
  const modalState = {
    open: false,
    query: '',
    filter: 'all',
    page: 1,
    perPage: 12,
    results: [],
    busy: false,
    onSelect: null,
    context: null // Optional context data passed back to onSelect
  };

// Ensure modal elements exist
function ensureModalElements() {
  if (document.getElementById('sharedImagePickerModal')) return;
  
  const modal = document.createElement('div');
  modal.id = 'sharedImagePickerModal';
  modal.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.55);z-index:100000;backdrop-filter:blur(2px);';
  modal.innerHTML = `
    <div class="sip-container" style="background:#fff;max-width:960px;width:92%;max-height:88vh;display:flex;flex-direction:column;border-radius:16px;box-shadow:0 10px 40px -6px rgba(0,0,0,.35);overflow:hidden;font:14px system-ui,Arial;">
      <div class="sip-header" style="display:flex;flex-direction:column;gap:8px;padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="text" id="sipSearch" placeholder="Search images..." style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;" />
          <button id="sipSearchBtn" style="background:#0ea5e9;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;">Search</button>
          <button id="sipClose" style="background:#e2e8f0;color:#334155;border:none;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;">Close</button>
        </div>
        <div id="sipFilters" style="display:flex;flex-wrap:wrap;gap:6px;">
          <button data-filter="all" class="sip-filter active">All Images</button>
          <button data-filter="photo" class="sip-filter">Photos</button>
          <button data-filter="illustration" class="sip-filter">Illustrations</button>
          <button data-filter="vector" class="sip-filter">Clip Art</button>
          <button data-filter="ai" class="sip-filter">AI Generated</button>
        </div>
      </div>
      <div id="sipResultsWrap" style="padding:14px 16px;overflow:auto;scrollbar-width:thin;flex:1;">
        <div id="sipResults" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;"></div>
        <div id="sipMoreWrap" style="text-align:center;margin:14px 4px 4px 4px;">
          <button id="sipLoadMore" style="display:none;background:#334155;color:#fff;border:none;padding:8px 20px;border-radius:24px;font-weight:600;cursor:pointer;">Load More</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  // Add styles
  const style = document.createElement('style');
  style.id = 'sharedImagePickerStyles';
  style.textContent = `
    #sipResults .sip-item {
      position: relative;
      cursor: pointer;
      border-radius: 10px;
      overflow: hidden;
      background: #f1f5f9;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    #sipResults .sip-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    #sipResults .sip-item img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      transition: transform 0.25s;
    }
    #sipResults .sip-item:hover img {
      transform: scale(1.05);
    }
    #sipResults .sip-item.loading {
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: sipShimmer 1.2s ease-in-out infinite;
    }
    @keyframes sipShimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    #sipResults .sip-item.selected::after {
      content: "✓";
      position: absolute;
      top: 6px;
      right: 6px;
      background: #10b981;
      color: #fff;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    }
    #sipResults .sip-item.error::after {
      content: "✕";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #b91c1c;
      font-size: 24px;
      font-weight: 700;
      background: rgba(255,255,255,0.8);
    }
    .sip-empty {
      color: #64748b;
      text-align: center;
      margin-top: 40px;
      font-size: 15px;
      font-weight: 500;
    }
    #sipResultsWrap::-webkit-scrollbar { width: 10px; }
    #sipResultsWrap::-webkit-scrollbar-track { background: #f1f5f9; }
    #sipResultsWrap::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }
    #sipResultsWrap::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    #sipFilters .sip-filter {
      background: #e2e8f0;
      border: none;
      padding: 6px 12px;
      border-radius: 20px;
      font-weight: 600;
      cursor: pointer;
      font-size: 12px;
      color: #334155;
      transition: background 0.15s, color 0.15s;
    }
    #sipFilters .sip-filter.active {
      background: #0ea5e9;
      color: #fff;
    }
    #sipFilters .sip-filter:hover:not(.active) {
      background: #cbd5e1;
    }
  `;
  if (!document.getElementById('sharedImagePickerStyles')) {
    document.head.appendChild(style);
  }
  
  // Wire events
  modal.addEventListener('click', e => {
    if (e.target === modal) closeImagePicker();
  });
  modal.querySelector('#sipClose').addEventListener('click', closeImagePicker);
  modal.querySelector('#sipSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') startSearch();
  });
  modal.querySelector('#sipSearchBtn').addEventListener('click', startSearch);
  modal.querySelector('#sipLoadMore').addEventListener('click', () => loadPage(modalState.page + 1));
  
  // Filter buttons
  modal.querySelector('#sipFilters').addEventListener('click', e => {
    const btn = e.target.closest('.sip-filter');
    if (!btn) return;
    const filter = btn.dataset.filter;
    if (!filter) return;
    
    modalState.filter = filter;
    modal.querySelectorAll('.sip-filter').forEach(b => b.classList.toggle('active', b === btn));
    
    // Re-search with new filter
    if (modalState.query) {
      loadPage(1, true);
    }
  });
}

/**
 * Open the image picker modal
 * @param {Object} options
 * @param {string} options.query - Initial search query
 * @param {function} options.onSelect - Callback when image is selected: (imageUrl, context) => void
 * @param {any} options.context - Optional context data to pass back to onSelect
 * @param {string} options.filter - Initial filter: 'all', 'photo', 'illustration', 'vector', 'ai'
 */
function openImagePicker(options = {}) {
  ensureModalElements();
  
  modalState.open = true;
  modalState.query = options.query || '';
  modalState.filter = options.filter || 'all';
  modalState.page = 1;
  modalState.results = [];
  modalState.onSelect = options.onSelect || null;
  modalState.context = options.context || null;
  
  const modal = document.getElementById('sharedImagePickerModal');
  modal.style.display = 'flex';
  
  // Set initial filter button state
  modal.querySelectorAll('.sip-filter').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === modalState.filter);
  });
  
  const input = modal.querySelector('#sipSearch');
  if (input) {
    input.value = modalState.query;
    setTimeout(() => input.focus(), 50);
  }
  
  if (modalState.query) {
    startSearch();
  } else {
    const results = document.getElementById('sipResults');
    results.innerHTML = '<div class="sip-empty">Type a search term and press Enter.</div>';
  }
}

/**
 * Close the image picker modal
 */
function closeImagePicker() {
  modalState.open = false;
  modalState.onSelect = null;
  modalState.context = null;
  const modal = document.getElementById('sharedImagePickerModal');
  if (modal) modal.style.display = 'none';
}

function startSearch() {
  const modal = document.getElementById('sharedImagePickerModal');
  if (!modal) return;
  
  const q = modal.querySelector('#sipSearch').value.trim();
  modalState.query = q;
  modalState.page = 1;
  modalState.results = [];
  loadPage(1, true);
}

async function loadPage(page, replace = false) {
  if (modalState.busy || !modalState.query) return;
  
  modalState.busy = true;
  modalState.page = page;
  
  const modal = document.getElementById('sharedImagePickerModal');
  const grid = modal.querySelector('#sipResults');
  const moreBtn = modal.querySelector('#sipLoadMore');
  
  if (replace) grid.innerHTML = '';
  
  // Show loading skeletons
  const skeletonCount = page === 1 ? 12 : 6;
  for (let i = 0; i < skeletonCount; i++) {
    const ph = document.createElement('div');
    ph.className = 'sip-item loading';
    grid.appendChild(ph);
  }
  
  try {
    // Build API URL
    const apiPath = window.WillenaAPI 
      ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') 
      : '/.netlify/functions/pixabay';
    const url = new URL(apiPath, window.location.origin);
    url.searchParams.set('q', modalState.query);
    url.searchParams.set('per_page', modalState.perPage);
    url.searchParams.set('page', page);
    
    // Apply filter
    switch (modalState.filter) {
      case 'photo':
        url.searchParams.set('image_type', 'photo');
        break;
      case 'illustration':
        url.searchParams.set('image_type', 'illustration');
        break;
      case 'vector':
        url.searchParams.set('image_type', 'vector');
        break;
      case 'ai':
        url.searchParams.set('image_type', 'illustration');
        url.searchParams.set('content_type', 'ai');
        break;
      default:
        url.searchParams.set('image_type', 'all');
    }
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    
    const data = await res.json();
    const images = Array.isArray(data.images) ? data.images : [];
    
    // Remove loading skeletons
    if (replace) {
      grid.innerHTML = '';
    } else {
      grid.querySelectorAll('.sip-item.loading').forEach(n => n.remove());
    }
    
    if (!images.length && page === 1) {
      grid.innerHTML = '<div class="sip-empty">No images found. Try a different search term.</div>';
      moreBtn.style.display = 'none';
    } else {
      images.forEach(src => {
        const div = document.createElement('div');
        div.className = 'sip-item';
        
        const img = document.createElement('img');
        img.alt = modalState.query;
        img.decoding = 'async';
        img.loading = 'lazy';
        img.src = src;
        
        img.onerror = () => div.classList.add('error');
        
        div.appendChild(img);
        div.addEventListener('click', () => selectImage(src));
        
        grid.appendChild(div);
      });
      
      // Show "Load More" if we got a full page
      moreBtn.style.display = images.length >= modalState.perPage ? 'inline-block' : 'none';
    }
  } catch (e) {
    console.error('[ImagePicker] fetch error:', e);
    if (replace) {
      grid.innerHTML = '<div class="sip-empty">Error loading images. Please try again.</div>';
    }
  } finally {
    modalState.busy = false;
  }
}

function selectImage(imageUrl) {
  if (typeof modalState.onSelect === 'function') {
    modalState.onSelect(imageUrl, modalState.context);
  }
  closeImagePicker();
}

// Expose globally for non-module usage (inline onclick handlers etc.)
window.SharedImagePicker = {
  open: openImagePicker,
  close: closeImagePicker
};

// Also expose individual functions for compatibility
window.openImagePicker = openImagePicker;
window.closeImagePicker = closeImagePicker;

})(); // End IIFE