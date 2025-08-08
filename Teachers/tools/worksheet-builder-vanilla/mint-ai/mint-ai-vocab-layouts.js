// mint-ai-vocab-layouts.js: Handles rendering of vocab box layouts for Mint AI Vocab Modal
// Exported as window.MintAIVocabLayouts for global access
(function() {
  // Add CSS for loading spinner animation
  if (!document.getElementById('vocab-layouts-css')) {
    const style = document.createElement('style');
    style.id = 'vocab-layouts-css';
    style.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .image-container:hover .click-instructions {
        opacity: 1;
      }
      .image-container:hover {
        background-color: #f0f8ff;
        border-radius: 4px;
      }
    `;
    document.head.appendChild(style);
  }
  // Table style presets
  const tableStylePresets = [
    {
      id: 'numbered',
      name: 'Numbered',
      th: "padding:8px 12px;background:white;border:none;border-bottom:2px solid #333;font-weight:700;color:#333;text-align:left;box-sizing:border-box;",
      tdLeft: "padding:8px 12px;border:none;font-weight:600;box-sizing:border-box;background:white;color:#333;",
      tdRight: "padding:8px 12px;border:none;color:#333;box-sizing:border-box;background:white;",
      tdNumber: "padding:8px 8px;border:none;font-weight:700;color:#333;text-align:center;box-sizing:border-box;background:white;width:50px;min-width:50px;",
      table: "width:100%;table-layout:fixed;border-collapse:collapse;",
      hasNumbers: true
    },
    {
      id: 'classic',
      name: 'Classic',
      th: "padding:12px 16px;background:#f8fafd;border:2px solid #93cbcf;font-weight:700;color:#00897b;text-align:left;width:50%;box-sizing:border-box;",
      tdLeft: "padding:10px 16px;border:1px solid #e1e8ed;border-bottom:1px solid #d1d8dd;font-weight:600;width:50%;box-sizing:border-box;",
      tdRight: "padding:10px 16px;border:1px solid #e1e8ed;border-bottom:1px solid #d1d8dd;color:#666;width:50%;box-sizing:border-box;",
      table: "width:100%;table-layout:fixed;border-collapse:collapse;",
      hasNumbers: false
    },
    {
      id: 'modern',
      name: 'Modern',
      th: "padding:12px 16px;background:#e3f2fd;border:2px solid #1976d2;font-weight:700;color:#1976d2;text-align:center;width:50%;box-sizing:border-box;",
      tdLeft: "padding:10px 16px;border:1px solid #bbdefb;font-weight:600;width:50%;box-sizing:border-box;background:#f5faff;",
      tdRight: "padding:10px 16px;border:1px solid #bbdefb;color:#1976d2;width:50%;box-sizing:border-box;background:#f5faff;",
      table: "width:100%;table-layout:fixed;border-collapse:separate;border-spacing:0 4px;",
      hasNumbers: false
    },
    {
      id: 'bold',
      name: 'Bold',
      th: "padding:12px 16px;background:#222;border:2px solid #ffb300;font-weight:700;color:#ffb300;text-align:center;width:50%;box-sizing:border-box;",
      tdLeft: "padding:10px 16px;border:2px solid #222;font-weight:700;width:50%;box-sizing:border-box;background:#fffde7;",
      tdRight: "padding:10px 16px;border:2px solid #222;color:#222;width:50%;box-sizing:border-box;background:#fffde7;",
      table: "width:100%;table-layout:fixed;border-collapse:collapse;",
      hasNumbers: false
    }
  ];

  function getTableStylePresets() {
    return tableStylePresets.map(({id, name}) => ({id, name}));
  }

  function renderSideBySideWithStyle(words, styleId) {
    const preset = tableStylePresets.find(p => p.id === styleId) || tableStylePresets[0];
    const minRows = 5;
    const numEmpty = Math.max(0, minRows - words.length);
    
    if (preset.hasNumbers) {
      // Numbered table layout
      const tableRows = words.map((w, index) =>
        `<tr>` +
        `<td style="${preset.tdNumber}" contenteditable="false">${index + 1}</td>` +
        `<td style="${preset.tdLeft}" contenteditable="true">${w.eng}</td>` +
        `<td style="${preset.tdRight}" contenteditable="true">${w.kor || ''}</td>` +
        `</tr>`
      ).join('');
      const emptyRows = Array(numEmpty).fill().map((_, index) =>
        `<tr>` +
        `<td style="${preset.tdNumber}" contenteditable="false">${words.length + index + 1}</td>` +
        `<td style="${preset.tdLeft}" contenteditable="true"></td>` +
        `<td style="${preset.tdRight}" contenteditable="true"></td>` +
        `</tr>`
      ).join('');
      return `<table style="${preset.table}">` +
        `<thead><tr>` +
        `<th style="${preset.tdNumber}" contenteditable="false"></th>` +
        `<th style="${preset.th}" contenteditable="true">English</th>` +
        `<th style="${preset.th}" contenteditable="true">Korean</th>` +
        `</tr></thead><tbody>` +
        tableRows + emptyRows +
        '</tbody></table>';
    } else {
      // Regular two-column layout
      const tableRows = words.map(w =>
        `<tr>` +
        `<td style="${preset.tdLeft}" contenteditable="true">${w.eng}</td>` +
        `<td style="${preset.tdRight}" contenteditable="true">${w.kor || ''}</td>` +
        `</tr>`
      ).join('');
      const emptyRows = Array(numEmpty).fill().map(() =>
        `<tr>` +
        `<td style="${preset.tdLeft}" contenteditable="true"></td>` +
        `<td style="${preset.tdRight}" contenteditable="true"></td>` +
        `</tr>`
      ).join('');
      return `<table style="${preset.table}">` +
        `<thead><tr>` +
        `<th style="${preset.th}" contenteditable="true">English</th>` +
        `<th style="${preset.th}" contenteditable="true">L2</th>` +
        `</tr></thead><tbody>` +
        tableRows + emptyRows +
        '</tbody></table>';
    }
  }

  function renderSideBySide(words) {
    // Default to numbered preset
    return renderSideBySideWithStyle(words, 'numbered');
  }

  function renderBasic(words) {
    return `<ul style="list-style:disc inside;line-height:2.2;font-family:'Poppins',Arial,sans-serif;">` +
      words.map(w => `<li style="margin-bottom:8px;"><b>${w.eng}</b>${w.kor ? ' — ' + w.kor : ''}</li>`).join('') + '</ul>';
  }

  function renderCards(words) {
    return `<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;font-family:"Poppins",Arial,sans-serif;'>` +
      words.map(w => 
        `<div style='border:2px solid #e1e8ed;border-radius:12px;padding:16px;text-align:center;background:#fafbfc;'>` +
        `<div style='font-size:1.1em;font-weight:700;color:#00897b;margin-bottom:8px;'>${w.eng}</div>` +
        `<div style='color:#666;font-size:0.95em;'>${w.kor || ''}</div>` +
        `</div>`
      ).join('') + '</div>';
  }

  function renderPictureCards(words) {
    const cardsHtml = `<div class="picture-matching-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:var(--image-gap,10px);width:100%;height:100%;box-sizing:border-box;font-family:'Poppins',Arial,sans-serif;">` +
      words.map((w, index) => 
        `<div class="image-drop-zone" data-word="${w.eng}" style="border:2px solid #e1e8ed;border-radius:8px;padding:8px;text-align:center;background:#fafbfc;position:relative;min-height:140px;display:flex;flex-direction:column;justify-content:space-between;">` +
        `<div class="image-container" style="flex:1;display:flex;align-items:center;justify-content:center;margin-bottom:8px;cursor:pointer;" onclick="openPixabaySearch('${w.eng}')">` +
        `<div class="image-loading-spinner" style="width:20px;height:20px;border:2px solid #f3f3f3;border-top:2px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>` +
        `</div>` +
        `<div style="text-align:center;">` +
        `<div style="font-size:0.9em;font-weight:600;color:#333;margin-bottom:4px;">${w.eng}</div>` +
        `<div style="font-size:0.8em;color:#666;">${w.kor || ''}</div>` +
        `</div>` +
        `<div class="click-instructions" style="position:absolute;top:-25px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:4px 8px;border-radius:4px;font-size:11px;white-space:nowrap;opacity:0;transition:opacity 0.3s ease;pointer-events:none;z-index:15;">Click to search Pixabay</div>` +
        `</div>`
      ).join('') + '</div>';
    
    // Load images after rendering
    setTimeout(() => {
      words.forEach((w, index) => {
        if (w.eng) {
          loadImageForWord(w.eng, index);
        }
      });
    }, 100);
    
    return cardsHtml;
  }

  // Helper function to get placeholder image (similar to wordtest.js)
  function getPlaceholderImage(index, word = null) {
    // Simple placeholder service with random colors
    const colors = ['4299e1', '48bb78', 'ed8936', 'e53e3e', '9f7aea', '38b2ac'];
    const color = colors[index % colors.length];
    const text = word ? encodeURIComponent(word) : `${index + 1}`;
    return `https://via.placeholder.com/150x100/${color}/ffffff?text=${text}`;
  }

  // Function to open Pixabay search in a new window
  function openPixabaySearch(word) {
    if (!word) return;
    
    // Open Pixabay search in a new window on the left side
    const pixabayUrl = `https://pixabay.com/images/search/${encodeURIComponent(word)}/`;
    const windowFeatures = 'width=800,height=600,left=0,top=100,scrollbars=yes,resizable=yes';
    
    window.open(pixabayUrl, '_blank', windowFeatures);
  }

  // Make the function globally available
  window.openPixabaySearch = openPixabaySearch;

  // Load image for a specific word by index
  async function loadImageForWord(word, index) {
    if (!word) return;
    
    try {
      console.log('Loading image for:', word, 'at index:', index);
      
      // Find the card element by word
      const cardElement = document.querySelector(`[data-word="${word}"]`);
      if (!cardElement) {
        console.log('Card element not found for word:', word);
        return;
      }
      
      const imageContainer = cardElement.querySelector('.image-container');
      if (!imageContainer) {
        console.log('Image container not found for word:', word);
        return;
      }
      
      // Use Netlify function exactly like wordtest.js files
      const url = `/.netlify/functions/pixabay?q=${encodeURIComponent(word)}&image_type=photo&safesearch=true&order=popular&per_page=5&page=${Math.floor(Math.random()*5)+1}`;
      console.log('Fetching URL:', url);
      
      const res = await fetch(url);
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        console.error('Fetch failed:', res.status, res.statusText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('Response data:', data);
      
      if (data.images && data.images.length > 0) {
        // Use the first image from the images array
        const imageUrl = data.images[0];
        console.log('Using image URL:', imageUrl);
        imageContainer.innerHTML = `<img src="${imageUrl}" alt="${word}" style="width:100%;height:auto;object-fit:contain;max-height:100px;border-radius:4px;" crossorigin="anonymous" onerror="this.src='${getPlaceholderImage(index, word)}'">`;
      } else {
        console.log('No images found in response');
        // No images found, use placeholder
        const placeholderUrl = getPlaceholderImage(index, word);
        imageContainer.innerHTML = `<img src="${placeholderUrl}" alt="${word}" style="width:100%;height:auto;object-fit:contain;max-height:100px;border-radius:4px;" crossorigin="anonymous">`;
      }
    } catch (error) {
      console.error('Error fetching image for word:', word, error);
      // Fall back to placeholder
      const placeholderUrl = getPlaceholderImage(index, word);
      const cardElement = document.querySelector(`[data-word="${word}"]`);
      if (cardElement) {
        const imageContainer = cardElement.querySelector('.image-container');
        if (imageContainer) {
          imageContainer.innerHTML = `<img src="${placeholderUrl}" alt="${word}" style="width:100%;height:auto;object-fit:contain;max-height:100px;border-radius:4px;" crossorigin="anonymous">`;
        }
      }
    }
  }

  // Image search function (to be called when clicking on cards)
  async function searchImageForWord(word, cardElement) {
    if (!word) return;
    
    try {
      // Show loading spinner
      const imageContainer = cardElement.querySelector('.image-container');
      imageContainer.innerHTML = '<div class="image-loading-spinner" style="width:20px;height:20px;border:2px solid #f3f3f3;border-top:2px solid #3498db;border-radius:50%;animation:spin 1s linear infinite;"></div>';
      
      console.log('Searching for image:', word);
      
      // Use Netlify function exactly like wordtest.js files
      const url = `/.netlify/functions/pixabay?q=${encodeURIComponent(word)}&image_type=photo&safesearch=true&order=popular&per_page=5&page=${Math.floor(Math.random()*5)+1}`;
      console.log('Fetching URL:', url);
      
      const res = await fetch(url);
      console.log('Response status:', res.status);
      
      if (!res.ok) {
        console.error('Fetch failed:', res.status, res.statusText);
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log('Response data:', data);
      
      if (data.images && data.images.length > 0) {
        // Use the first image from the images array
        const imageUrl = data.images[0];
        console.log('Using image URL:', imageUrl);
        imageContainer.innerHTML = `<img src="${imageUrl}" alt="${word}" style="width:100%;height:auto;object-fit:contain;max-height:100px;border-radius:4px;" crossorigin="anonymous" onerror="this.src='${getPlaceholderImage(0, word)}'">`;
      } else {
        console.log('No images found in response');
        // No images found, keep placeholder
        const placeholderUrl = getPlaceholderImage(0, word);
        imageContainer.innerHTML = `<img src="${placeholderUrl}" alt="${word}" style="width:100%;height:auto;object-fit:contain;max-height:100px;border-radius:4px;" crossorigin="anonymous">`;
      }
    } catch (error) {
      console.error('Error fetching image for word:', word, error);
      // Fall back to placeholder
      const placeholderUrl = getPlaceholderImage(0, word);
      const imageContainer = cardElement.querySelector('.image-container');
      imageContainer.innerHTML = `<img src="${placeholderUrl}" alt="${word}" style="width:100%;height:auto;object-fit:contain;max-height:100px;border-radius:4px;" crossorigin="anonymous">`;
    }
  }

  // Make the search function globally available
  window.searchImageForWord = searchImageForWord;

  function renderDoubleList(words) {
    // Use default numbered style for double list
    return renderDoubleListWithStyle(words, 'numbered');
  }

  function renderDoubleListWithStyle(words, styleId) {
    // Get the style preset
    const preset = tableStylePresets.find(p => p.id === styleId) || tableStylePresets[0];
    
    // Split words into two columns (left: first half, right: second half)
    const half = Math.ceil(words.length / 2);
    const left = words.slice(0, half);
    const right = words.slice(half);
    // Pad columns to equal length with minimum 6 rows
    const maxRows = Math.max(left.length, right.length, 6);
    while (left.length < maxRows) left.push({eng: '', kor: ''});
    while (right.length < maxRows) right.push({eng: '', kor: ''});
    
    // Use preset styles but force center alignment for double list
    const tdNum = (preset.tdNumber || 'padding:8px 8px;border:none;font-weight:700;color:#333;text-align:center;box-sizing:border-box;background:white;width:38px;min-width:38px;').replace(/text-align:[^;]+;?/, 'text-align:center;');
    // Add right border to the last cell of the left section and left border to the first cell of the right section
    const borderBetween = 'border-left:2.5px solid #333;';
    const tdLeft = (preset.tdLeft || 'padding:8px 12px;border:none;font-weight:600;box-sizing:border-box;background:white;color:#333;').replace(/text-align:[^;]+;?/, '') + 'text-align:center;border-bottom:1px solid #e8e8e8;';
    const tdRight = (preset.tdRight || 'padding:8px 12px;border:none;color:#333;box-sizing:border-box;background:white;').replace(/text-align:[^;]+;?/, '') + 'text-align:center;border-bottom:1px solid #e8e8e8;';
    // Make header underline a single continuous line across all columns with light grey background
    const th = (preset.th || 'padding:8px 12px;background:white;border:none;font-weight:700;color:#333;text-align:left;box-sizing:border-box;').replace(/text-align:[^;]+;?/, 'text-align:center;').replace(/border-bottom:[^;]+;?/, '').replace(/background:[^;]+;?/, 'background:#f5f5f5;');
    
    let rows = '';
    for (let i = 0; i < maxRows; i++) {
      const leftHasContent = left[i].eng || left[i].kor;
      const rightHasContent = right[i].eng || right[i].kor;
      rows += `<tr>` +
        `<td style="${tdNum}" contenteditable="false">${leftHasContent ? (i+1) : ''}</td>` +
        `<td style="${tdLeft}" contenteditable="true">${left[i].eng||''}</td>` +
        `<td style="${tdRight};border-right:2.5px solid #333;" contenteditable="true">${left[i].kor||''}</td>` +
        `<td style="${tdNum};${borderBetween}" contenteditable="false">${rightHasContent ? (i+1+half) : ''}</td>` +
        `<td style="${tdLeft}" contenteditable="true">${right[i].eng||''}</td>` +
        `<td style="${tdRight}" contenteditable="true">${right[i].kor||''}</td>` +
        `</tr>`;
    }
    return `<table style="${preset.table}">` +
      `<thead><tr>` +
        `<th style="${tdNum};border-bottom:2.5px solid #333;background:#f5f5f5;" contenteditable="false"></th>` +
        `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="true">English</th>` +
        `<th style="${th};border-right:2.5px solid #333;border-bottom:2.5px solid #333;" contenteditable="true">Korean</th>` +
        `<th style="${tdNum};${borderBetween};border-bottom:2.5px solid #333;background:#f5f5f5;" contenteditable="false"></th>` +
        `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="true">English</th>` +
        `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="true">Korean</th>` +
      `</tr></thead><tbody>` + rows + `</tbody></table>`;
  }

  function renderPreview(words, format) {
    if (!words.length) return '<div style="color:#aaa;font-size:1.1em;">No words to preview.</div>';
    switch(format) {
      case 'sidebyside': return renderSideBySide(words);
      case 'basic': return renderBasic(words);
      case 'cards': return renderCards(words);
      case 'doublelist': return renderDoubleList(words);
      case 'picturecards': return renderPictureCards(words);
      default:
        return '<div style="color:#aaa;">Unknown format: ' + format + '</div>';
    }
  }

  window.MintAIVocabLayouts = {
    renderPreview,
    renderSideBySide,
    renderSideBySideWithStyle,
    getTableStylePresets,
    renderBasic,
    renderCards,
    renderPictureCards,
    renderDoubleList,
    renderDoubleListWithStyle
  };
  
  console.log('MintAIVocabLayouts loaded successfully:', window.MintAIVocabLayouts);
})();
