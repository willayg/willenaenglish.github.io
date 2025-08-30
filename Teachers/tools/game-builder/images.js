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

// Initialize image system
export function initImageSystem() {
  return { loadingImages };
}

// Check if an image URL exists and is valid
export function hasValidImageUrl(imageUrl) {
  return imageUrl && imageUrl.trim() && imageUrl !== '';
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
  // Left-click opens Pixabay search window (drag images back)
  zone.addEventListener('click', () => {
    const term = encodeURIComponent(list[idx]?.eng || '');
    const url = `https://pixabay.com/images/search/${term}/`;
    // Reuse the same window name so it refreshes instead of opening multiple windows
    window.open(url, 'pixabaySearch', 'width=900,height=700');
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
