// mint-ai-pictures-layouts.js: Layouts for MINT AI Picture Activities
// Exports window.MintAIPicturesLayouts with layout rendering functions for picture activities

(function() {
  // Helper: Convert vocab words to picture format and load real images
  function convertWordsToImages(words) {
    if (!Array.isArray(words)) return [];
    return words.map((word, index) => ({
      url: getPlaceholderImage(index, word.eng || word.word || ''),
      alt: word.eng || word.word || '',
      word: word.eng || word.word || '',
      index: index
    }));
  }

  // Helper function to get placeholder image
  function getPlaceholderImage(index, word = null) {
    const colors = ['4299e1', '48bb78', 'ed8936', 'e53e3e', '9f7aea', '38b2ac'];
    const color = colors[index % colors.length];
    const text = word ? encodeURIComponent(word) : `${index + 1}`;
    return `https://via.placeholder.com/150x120/${color}/ffffff?text=${text}`;
  }

  // Load image for a specific word by index
  async function loadImageForWord(word, index, container) {
    if (!word || !container) return;
    
    try {
      // Use Netlify function exactly like wordtest.js files
      const url = `/.netlify/functions/pixabay?q=${encodeURIComponent(word)}&image_type=photo&safesearch=true&order=popular&per_page=5&page=${Math.floor(Math.random()*5)+1}`;
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      
      if (data.images && data.images.length > 0) {
        // Use the first image from the images array
        const imageUrl = data.images[0];
        const imgElement = container.querySelector('img');
        if (imgElement) {
          imgElement.src = imageUrl;
          imgElement.onerror = function() {
            this.src = getPlaceholderImage(index, word);
          };
        }
      } else {
        // No images found, keep placeholder
        const imgElement = container.querySelector('img');
        if (imgElement) {
          imgElement.src = getPlaceholderImage(index, word);
        }
      }
    } catch (error) {
      console.error('Error fetching image for word:', word, error);
      // Fall back to placeholder
      const imgElement = container.querySelector('img');
      if (imgElement) {
        imgElement.src = getPlaceholderImage(index, word);
      }
    }
  }

  // Helper: Render a simple picture grid
  function renderPictureGrid(data, options = {}) {
    const pictures = Array.isArray(data) && data.length > 0 && data[0].url ? data : convertWordsToImages(data);
    const cols = options.cols || 3;
    const cellSize = options.cellSize || 120;
    let html = `<div style="display:grid;grid-template-columns:repeat(${cols},${cellSize}px);gap:16px;justify-content:center;">`;
    pictures.forEach((pic, index) => {
      html += `<div class="picture-container" data-word="${pic.word}" data-index="${index}" style="width:${cellSize}px;height:${cellSize}px;display:flex;align-items:center;justify-content:center;border:1.5px solid #e1e8ed;border-radius:8px;background:#fff;overflow:hidden;">
        <img src="${pic.url}" alt="${pic.alt||''}" style="max-width:100%;max-height:100%;object-fit:contain;" crossorigin="anonymous" />
      </div>`;
    });
    html += '</div>';
    
    // Load real images after rendering
    setTimeout(() => {
      pictures.forEach((pic, index) => {
        if (pic.word) {
          const container = document.querySelector(`[data-word="${pic.word}"][data-index="${index}"]`);
          if (container) {
            loadImageForWord(pic.word, index, container);
          }
        }
      });
    }, 100);
    
    return html;
  }

  // Helper: Render a picture + word matching activity
  function renderPictureMatching(data, options = {}) {
    const pictures = Array.isArray(data) && data.length > 0 && data[0].url ? data : convertWordsToImages(data);
    let html = '<div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">';
    pictures.forEach((pic, index) => {
      html += `<div class="picture-container" data-word="${pic.word}" data-index="${index}" style="display:flex;flex-direction:column;align-items:center;width:140px;">
        <div style="width:120px;height:120px;border:1.5px solid #e1e8ed;border-radius:8px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          <img src="${pic.url}" alt="${pic.alt||''}" style="max-width:100%;max-height:100%;object-fit:contain;" crossorigin="anonymous" />
        </div>
        <div style="margin-top:10px;font-size:1.1em;font-weight:600;letter-spacing:0.5px;">${pic.word||''}</div>
      </div>`;
    });
    html += '</div>';
    
    // Load real images after rendering
    setTimeout(() => {
      pictures.forEach((pic, index) => {
        if (pic.word) {
          const container = document.querySelector(`[data-word="${pic.word}"][data-index="${index}"]`);
          if (container) {
            loadImageForWord(pic.word, index, container);
          }
        }
      });
    }, 100);
    
    return html;
  }

  // Helper: Render a picture labeling activity (empty boxes under pictures)
  function renderPictureLabeling(data, options = {}) {
    const pictures = Array.isArray(data) && data.length > 0 && data[0].url ? data : convertWordsToImages(data);
    let html = '<div style="display:flex;flex-wrap:wrap;gap:24px;justify-content:center;">';
    pictures.forEach((pic, index) => {
      html += `<div class="picture-container" data-word="${pic.word}" data-index="${index}" style="display:flex;flex-direction:column;align-items:center;width:140px;">
        <div style="width:120px;height:120px;border:1.5px solid #e1e8ed;border-radius:8px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;">
          <img src="${pic.url}" alt="${pic.alt||''}" style="max-width:100%;max-height:100%;object-fit:contain;" crossorigin="anonymous" />
        </div>
        <input type="text" style="margin-top:10px;width:100px;padding:4px 8px;font-size:1em;border:1px solid #ccc;border-radius:4px;text-align:center;" placeholder="Label..." />
      </div>`;
    });
    html += '</div>';
    
    // Load real images after rendering
    setTimeout(() => {
      pictures.forEach((pic, index) => {
        if (pic.word) {
          const container = document.querySelector(`[data-word="${pic.word}"][data-index="${index}"]`);
          if (container) {
            loadImageForWord(pic.word, index, container);
          }
        }
      });
    }, 100);
    
    return html;
  }

  // Helper: Render picture cards with images and text (like vocab cards but with pictures)
  function renderPictureCards(data, options = {}) {
    const pictures = Array.isArray(data) && data.length > 0 && data[0].url ? data : convertWordsToImages(data);
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">';
    pictures.forEach((pic, index) => {
      html += `<div class="picture-container" data-word="${pic.word}" data-index="${index}" style="border:2px solid #e1e8ed;border-radius:12px;padding:16px;text-align:center;background:#fafbfc;display:flex;flex-direction:column;">
        <div style="width:120px;height:120px;border:1.5px solid #e1e8ed;border-radius:8px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;margin:0 auto 12px auto;">
          <img src="${pic.url}" alt="${pic.alt||''}" style="max-width:100%;max-height:100%;object-fit:contain;" crossorigin="anonymous" />
        </div>
        <div style="font-size:1.1em;font-weight:700;color:#8b5cf6;margin-bottom:8px;">${pic.word||''}</div>
        <div style="color:#666;font-size:0.95em;">${pic.alt||''}</div>
      </div>`;
    });
    html += '</div>';
    
    // Load real images after rendering
    setTimeout(() => {
      pictures.forEach((pic, index) => {
        if (pic.word) {
          const container = document.querySelector(`[data-word="${pic.word}"][data-index="${index}"]`);
          if (container) {
            loadImageForWord(pic.word, index, container);
          }
        }
      });
    }, 100);
    
    return html;
  }

  // Main API: Compatible with vocab word format {eng, kor} and picture format {url, alt, word}
  window.MintAIPicturesLayouts = {
    renderPreview: function(data, format, options = {}) {
      if (!Array.isArray(data) || !data.length) return '<div style="color:#aaa;">No pictures.</div>';
      if (format === 'grid') return renderPictureGrid(data, options);
      if (format === 'matching') return renderPictureMatching(data, options);
      if (format === 'labeling') return renderPictureLabeling(data, options);
      if (format === 'picturecards') return renderPictureCards(data, options);
      // Default fallback
      return renderPictureGrid(data, options);
    },
    renderPictureGrid,
    renderPictureMatching,
    renderPictureLabeling,
    renderPictureCards
  };
})();
