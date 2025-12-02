// HTML escaping utility
export function escapeHtml(s) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
// Image handling module for game-builder
// Handles image loading, drag/drop, and restoration from saved data

// Global state
let loadingImages = new Set();
let galleryState = { open:false, targetIndex:null, query:'', page:1, perPage:12, results:[], busy:false, lastFetchTs:0, filter:'all' };

function ensureGalleryElements(){
  if(document.getElementById('pixabayGalleryModal')) return;
  const modal = document.createElement('div');
  modal.id='pixabayGalleryModal';
  modal.style.cssText='position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(15,23,42,.55);z-index:100000;backdrop-filter:blur(2px);';
  modal.innerHTML=`<div style="background:#fff;max-width:960px;width:92%;max-height:88vh;display:flex;flex-direction:column;border-radius:16px;box-shadow:0 10px 40px -6px rgba(0,0,0,.35);overflow:hidden;font:14px system-ui,Arial;">
    <div style="display:flex;flex-direction:column;gap:8px;padding:12px 16px;border-bottom:1px solid #e2e8f0;background:#f8fafc;">
      <div style='display:flex;gap:10px;align-items:center;'>
        <input type="text" id="pgSearch" placeholder="Search images..." style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;" />
        <button id="pgSearchBtn" class="btn" style="background:#0ea5e9;color:#fff;border:none;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;">Search</button>
        <button id="pgClose" class="btn" style="background:#e2e8f0;color:#334155;border:none;padding:8px 14px;border-radius:8px;font-weight:600;cursor:pointer;">Close</button>
      </div>
      <div id='pgFilters' style='display:flex;flex-wrap:wrap;gap:6px;'>
        <button data-f="all" class="pg-filter active">All Images</button>
        <button data-f="photo" class="pg-filter">Photos</button>
        <button data-f="illustration" class="pg-filter">Illustrations</button>
        <button data-f="clip" class="pg-filter">Clip Art</button>
        <button data-f="ai" class="pg-filter">AI</button>
      </div>
    </div>
    <div id="pgResultsWrap" style="padding:14px 16px;overflow:auto;scrollbar-width:thin;flex:1;">
      <div id="pgResults" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;"></div>
      <div id="pgMoreWrap" style="text-align:center;margin:14px 4px 4px 4px;">
        <button id="pgLoadMore" class="btn" style="display:none;background:#334155;color:#fff;border:none;padding:8px 16px;border-radius:24px;font-weight:600;cursor:pointer;">Load More</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  const style = document.createElement('style');
  style.textContent=`#pgResults .pg-item{position:relative;cursor:pointer;border-radius:10px;overflow:hidden;background:#f1f5f9;min-height:90px;display:flex;align-items:center;justify-content:center;}#pgResults .pg-item img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .25s;}#pgResults .pg-item:hover img{transform:scale(1.05);}#pgResults .pg-item.loading:before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0));animation:pgShimmer 1.1s linear infinite;}@keyframes pgShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)} }#pixabayGalleryModal .empty{color:#64748b;text-align:center;margin-top:40px;font-size:15px;font-weight:500;}#pgResults .pg-item.selected:after{content:"✓";position:absolute;top:6px;right:6px;background:#10b981;color:#fff;width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;font-size:13px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.25);}#pgResults .pg-item.err:after{content:"✕";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#b91c1c;font-size:24px;font-weight:700;background:rgba(255,255,255,.8);}#pgResultsWrap::-webkit-scrollbar{width:10px;}#pgResultsWrap::-webkit-scrollbar-track{background:#f1f5f9;}#pgResultsWrap::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:6px;}#pgResultsWrap::-webkit-scrollbar-thumb:hover{background:#94a3b8;}#pgFilters .pg-filter{background:#e2e8f0;border:none;padding:6px 12px;border-radius:20px;font-weight:600;cursor:pointer;font-size:12px;color:#334155;transition:background .15s, color .15s;}#pgFilters .pg-filter.active{background:#0ea5e9;color:#fff;}#pgFilters .pg-filter:hover:not(.active){background:#cbd5e1;}`;
  // Filter buttons
  modal.querySelector('#pgFilters').addEventListener('click', e=> {
    const btn = e.target.closest('.pg-filter'); if(!btn) return;
    const f = btn.getAttribute('data-f'); if(!f) return;
    galleryState.filter = f; // update filter
    // toggle active classes
    modal.querySelectorAll('#pgFilters .pg-filter').forEach(b=> b.classList.toggle('active', b===btn));
    // restart search from page 1 (preserve current query)
    if(galleryState.query){ loadGalleryPage(1, true); }
  });
  document.head.appendChild(style);
  // Wire events
  modal.addEventListener('click', e=> { if(e.target===modal) closeGallery(); });
  modal.querySelector('#pgClose').addEventListener('click', closeGallery);
  modal.querySelector('#pgSearch').addEventListener('keydown', e=> { if(e.key==='Enter'){ startGallerySearch(); }});
  modal.querySelector('#pgSearchBtn').addEventListener('click', startGallerySearch);
  modal.querySelector('#pgLoadMore').addEventListener('click', ()=> loadGalleryPage(galleryState.page+1));
}

function openGallery(index, defaultQuery){
  ensureGalleryElements();
  galleryState.open=true; galleryState.targetIndex=index; galleryState.page=1; galleryState.results=[]; galleryState.query=defaultQuery||'';
  const modal = document.getElementById('pixabayGalleryModal');
  modal.style.display='flex';
  const input = modal.querySelector('#pgSearch'); if(input){ input.value=galleryState.query; setTimeout(()=> input.focus(),50); }
  if(galleryState.query){ startGallerySearch(); }
  else {
    const results = document.getElementById('pgResults'); results.innerHTML='<div class="empty">Type a search term (English) and press Enter.</div>';
  }
}
function closeGallery(){
  galleryState.open=false; galleryState.targetIndex=null; const modal=document.getElementById('pixabayGalleryModal'); if(modal) modal.style.display='none';
}

function startGallerySearch(){
  const modal = document.getElementById('pixabayGalleryModal'); if(!modal) return;
  const q = modal.querySelector('#pgSearch').value.trim();
  galleryState.query=q; galleryState.page=1; galleryState.results=[];
  loadGalleryPage(1, true);
}

async function loadGalleryPage(page, replace){
  if(galleryState.busy) return; if(!galleryState.query){ return; }
  galleryState.busy=true; galleryState.page=page;
  const modal = document.getElementById('pixabayGalleryModal'); const grid = modal.querySelector('#pgResults');
  const moreBtn = modal.querySelector('#pgLoadMore');
  if(replace) grid.innerHTML='';
  // Placeholder skeletons
  const skCount = page===1 ? 12 : 6;
  for(let i=0;i<skCount;i++){ const ph=document.createElement('div'); ph.className='pg-item loading'; grid.appendChild(ph); }
  try {
    const url = new URL('/.netlify/functions/pixabay', window.location.origin);
    url.searchParams.set('q', galleryState.query);
    url.searchParams.set('per_page', galleryState.perPage);
    url.searchParams.set('page', page);
    // Apply filter mappings
    switch(galleryState.filter){
      case 'photo':
        url.searchParams.set('image_type','photo');
        break;
      case 'illustration':
        url.searchParams.set('image_type','illustration');
        break;
      case 'clip': // vector graphics
        url.searchParams.set('image_type','vector');
        break;
      case 'ai':
        // Force illustrations + AI content for better AI coverage (Pixabay surfaces AI mainly under illustrations)
        url.searchParams.set('image_type','illustration');
        url.searchParams.set('content_type','ai');
        break;
      case 'all':
      default:
        url.searchParams.set('image_type','all');
    }
    const res = await fetch(url.toString());
    if(!res.ok){ throw new Error('HTTP '+res.status); }
    const js = await res.json();
    const imgs = Array.isArray(js.images) ? js.images : [];
    if(replace) grid.innerHTML=''; else grid.querySelectorAll('.pg-item.loading').forEach(n=> n.remove());
    if(!imgs.length && page===1){ grid.innerHTML='<div class="empty">No results.</div>'; moreBtn.style.display='none'; }
    else {
      imgs.forEach(src=> {
        const div=document.createElement('div'); div.className='pg-item';
        const img=document.createElement('img'); img.alt=galleryState.query; img.decoding='async'; img.loading='lazy'; img.src=src; div.appendChild(img);
        img.onerror=()=> { div.classList.add('err'); };
        div.addEventListener('click', ()=> selectGalleryImage(src));
        grid.appendChild(div);
      });
      // Show load more if we received a full page (Pixabay per_page length); naive heuristic
      moreBtn.style.display = imgs.length >= galleryState.perPage ? 'inline-block' : 'none';
    }
  } catch(e){
    console.warn('[gallery] fetch error', e); if(replace) grid.innerHTML='<div class="empty">Error loading images.</div>';
  } finally { galleryState.busy=false; }
}

function selectGalleryImage(src){
  if(galleryState.targetIndex==null) return; try {
    if(window.__gameBuilderList){
      const list = window.__gameBuilderList();
      if(Array.isArray(list) && list[galleryState.targetIndex]){
        list[galleryState.targetIndex].image_url = src;
        if(typeof window.__gameBuilderRender==='function') window.__gameBuilderRender();
      }
    }
  } catch(e){ console.warn('apply gallery image failed', e); }
  closeGallery();
}

// Initialize image system
export function initImageSystem() {
  return { loadingImages };
}

// Check if an image URL exists and is valid
export function hasValidImageUrl(imageUrl) {
  if (!imageUrl) return false;
  const trimmed = imageUrl.trim();
  if (!trimmed) return false;
  // Treat proxy + R2-hosted (or any http/https) as valid; data URIs also count (they'll be uploaded later)
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || /\/\.netlify\/functions\/image_proxy\?key=/.test(trimmed);
}

// Apply worksheet images to rows
export function applyWorksheetImages(rows, imagesField, originalWords) {
  try {
    console.log('Applying worksheet images:', imagesField);
    console.log('Rows before applying images:', rows.map(r => ({ eng: r.eng, has_image: !!r.image_url })));
    
    let imgs = imagesField;
    if (typeof imgs === 'string') {
      try { 
        imgs = JSON.parse(imgs); 
        console.log('Parsed images string as JSON:', imgs);
      } catch (_) { 
        console.log('Images field is string but not JSON:', imgs);
        return; // Can't process non-JSON strings
      }
    }
    
    // Handle savedImageData format (from wordtest)
    if (imgs && typeof imgs === 'object' && Object.keys(imgs).some(k => k.includes('_'))) {
      console.log('Processing as savedImageData format (word_index keys)');
      Object.entries(imgs).forEach(([key, imageData]) => {
        const [word, indexStr] = key.split('_');
        const index = parseInt(indexStr, 10);
        if (!isNaN(index) && index < rows.length && imageData) {
          const url = imageData.src || imageData.url || imageData;
          if (typeof url === 'string' && url !== 'emoji') {
            console.log(`Setting image for row ${index} (${rows[index].eng}): ${url}`);
            rows[index].image_url = url;
          }
        }
      });
      return;
    }
    
    // If array of URLs aligned to words
    if (Array.isArray(imgs) && (!imgs.length || typeof imgs[0] === 'string')) {
      console.log('Processing as array of URLs:', imgs);
      for (let i = 0; i < Math.min(rows.length, imgs.length); i++) {
        if (!hasValidImageUrl(rows[i].image_url) && typeof imgs[i] === 'string' && (imgs[i].startsWith('http') || imgs[i].startsWith('data:'))) {
          console.log(`Setting image for row ${i}: ${imgs[i]}`);
          rows[i].image_url = imgs[i];
        }
      }
      return;
    }
    
    // If array of objects
    if (Array.isArray(imgs) && imgs.length && typeof imgs[0] === 'object') {
      console.log('Processing as array of objects:', imgs);
      imgs.forEach(obj => {
        const eng = obj.eng || obj.en || obj.word || '';
        const url = obj.image_url || obj.image || obj.url || obj.src || '';
        if (!eng || !url) return;
        const idx = rows.findIndex(r => (r.eng || '').toLowerCase() === eng.toLowerCase());
        if (idx >= 0 && !hasValidImageUrl(rows[idx].image_url)) {
          console.log(`Setting image for "${eng}": ${url}`);
          rows[idx].image_url = url;
        }
      });
      return;
    }
    
    // If object map: { eng: url } or { eng: {url: ...} }
    if (imgs && typeof imgs === 'object') {
      console.log('Processing as object map:', imgs);
      Object.entries(imgs).forEach(([k, v]) => {
        const url = typeof v === 'string' ? v : (v?.url || v?.image_url || v?.image || v?.src || '');
        if (!url || url === 'emoji') return;
        const idx = rows.findIndex(r => (r.eng || '').toLowerCase() === k.toLowerCase());
        if (idx >= 0 && !hasValidImageUrl(rows[idx].image_url)) {
          console.log(`Setting image for "${k}": ${url}`);
          rows[idx].image_url = url;
        }
      });
    }
    
    console.log('Rows after applying images:', rows.map(r => ({ eng: r.eng, has_image: !!r.image_url })));
  } catch (e) {
    console.error('Error applying worksheet images:', e);
  }
}

// Load a single image from Pixabay for a specific row
export async function loadImageForRow(list, idx, loadingImagesSet, renderCallback) {
  const term = list[idx].eng?.trim();
  if (!term) return;
  
  // Skip if image already exists
  if (hasValidImageUrl(list[idx].image_url)) {
    console.log(`Skipping image load for "${term}" - already has image:`, list[idx].image_url);
    return;
  }
  
  try {
    loadingImagesSet.add(idx);
    renderCallback(); // show spinner
    const url = new URL('/.netlify/functions/pixabay', window.location.origin);
    url.searchParams.set('q', term);
    const res = await fetch(url.toString());
    const js = await res.json();
    const img = js?.images?.[0];
    if (img) {
      list[idx].image_url = img;
      console.log(`Loaded new image for "${term}":`, img);
    }
  } catch (e) {
    console.warn('Pixabay error for', term, e?.message);
  } finally {
    loadingImagesSet.delete(idx);
    renderCallback(); // remove spinner / show image
  }
}

// Load images only for rows that don't have images (preserve existing)
export async function loadImagesForMissingOnly(list, loadingImagesSet, renderCallback) {
  console.log('Loading images only for missing entries...');
  for (let i = 0; i < list.length; i++) {
    if (!hasValidImageUrl(list[i].image_url)) {
      await loadImageForRow(list, i, loadingImagesSet, renderCallback);
    } else {
      console.log(`Preserving existing image for "${list[i].eng}":`, list[i].image_url);
    }
  }
}

// Setup drag and drop for image zones
export function setupImageDropZone(zone, idx, list, renderCallback, escapeHtml, saveStateCallback = null) {
  // Expose accessors for gallery
  if(!window.__gameBuilderList) window.__gameBuilderList = () => list;
  if(!window.__gameBuilderRender) window.__gameBuilderRender = () => renderCallback();
  // Left-click opens Pixabay search window (drag images back)
  zone.addEventListener('click', () => {
    const term = (list[idx]?.eng || '').trim();
    openGallery(idx, term);
  });

  // Drag and drop handling
  zone.addEventListener('dragover', (e) => { 
    e.preventDefault(); 
    zone.classList.add('dragover'); 
  });
  
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('dragover');
  });
  
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    
    // Save state before changing image
    if (saveStateCallback) saveStateCallback();
    
    const files = Array.from(e.dataTransfer.files);
    
    // Handle file drops
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        // Use FileReader to create data URL like wordtest does
        const reader = new FileReader();
        reader.onload = function(ev) {
          list[idx].image_url = ev.target.result;
          console.log(`Dropped file image for "${list[idx].eng}"`);
          renderCallback();
        };
        reader.readAsDataURL(file);
        return;
      }
    }
    
    // Handle URL drops
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
    if (text && /^https?:\/\//i.test(text.trim())) {
      list[idx].image_url = text.trim();
      console.log(`Dropped URL image for "${list[idx].eng}":`, text.trim());
      renderCallback();
    }
  });
}

// Generate the HTML content for image drop zones
export function generateImageDropZoneHTML(word, idx, isLoading, escapeHtml) {
  if (isLoading) {
    return '<div class="spinner"></div>';
  }
  
  if (hasValidImageUrl(word.image_url)) {
    return `<img src="${word.image_url}" alt="${escapeHtml(word.eng)}" />`;
  }
  
  return '<span class="hint">Click to search • Drag an image here</span>';
}
