  // Matching the Meaning layout: two columns, English and L1, for matching
  function renderMatching(words, l1Label = 'Korean') {
    // Shuffle the L1 column for matching activity
    const l1Words = words.map(w => w.kor || '').filter(Boolean);
    const shuffledL1 = l1Words.slice().sort(() => Math.random() - 0.5);
    const minRows = Math.max(5, words.length);
    // Dot style (neutral)
    const dot = '<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:#fff;border:2px solid #444;margin:0 7px;vertical-align:middle;"></span>';
    // Card style
    const cardStyle = 'background:#fff;border:1.5px solid #d1d5db;border-radius:9px;box-shadow:0 1px 4px rgba(60,60,80,0.04);padding:10px 12px;margin-bottom:10px;display:flex;align-items:center;min-height:38px;';
    const wordStyle = 'color:#222;font-weight:600;font-size:1.08em;letter-spacing:0.01em;';
    // Left: word + dot (dot on right), align left
    const engCol = words.map(w => `<div style="${cardStyle}justify-content:flex-start;text-align:left;">`+
      `<span style="${wordStyle}flex:1;text-align:left;">${w.eng}</span>${dot}`+
      `</div>`).concat(Array(Math.max(0, minRows - words.length)).fill(`<div style="${cardStyle}justify-content:flex-start;text-align:left;">&nbsp;</div>`)).join('');
    // Right: dot + word (dot on left), align right
    const l1Col = shuffledL1.map(kor => `<div style="${cardStyle}justify-content:flex-end;text-align:right;">`+
      `${dot}<span style="${wordStyle}flex:1;text-align:right;">${kor}</span>`+
      `</div>`).concat(Array(Math.max(0, minRows - shuffledL1.length)).fill(`<div style="${cardStyle}justify-content:flex-end;text-align:right;">&nbsp;</div>`)).join('');
    return `<div style="display:flex;gap:72px;align-items:flex-start;">
      <div style="flex:1;min-width:120px;">
        <div style="font-weight:700;margin-bottom:6px;text-align:left;color:#222;">English</div>
        <div>${engCol}</div>
      </div>
      <div style="flex:1;min-width:120px;">
        <div style="font-weight:700;margin-bottom:6px;text-align:right;color:#222;">${l1Label}</div>
        <div>${l1Col}</div>
      </div>
    </div>`;
  }
// mint-ai-vocab-layouts.js: Handles rendering of vocab box layouts for Mint AI Vocab Modal
// Exported as window.MintAIVocabLayouts for global access
(function() {
  // Store the chosen images for Picture List layout
  let pictureListImages = {};

  // Add CSS for loading spinner animation
  if (!document.getElementById('vocab-layouts-css')) {
    const style = document.createElement('style');
    style.id = 'vocab-layouts-css';
    style.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0px); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0px); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
      }
      .image-container:hover .click-instructions {
        opacity: 1;
      }
      .image-container:hover {
        background-color: #f0f8ff;
        border-radius: 4px;
      }
      .drag-success {
        animation: pulse 0.5s ease-in-out;
      }
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
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

  function renderSideBySideWithStyle(words, styleId, l1Label = 'Korean') {
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
        `<th style="${preset.th}" contenteditable="true">${l1Label}</th>` +
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
        `<th style="${preset.th}" contenteditable="true">${l1Label}</th>` +
        `</tr></thead><tbody>` +
        tableRows + emptyRows +
        '</tbody></table>';
    }
  }

  function renderSideBySide(words, l1Label = 'Korean') {
    // Default to numbered preset
    return renderSideBySideWithStyle(words, 'numbered', l1Label);
  }

  function renderBasic(words, l1Label = 'Korean') {
    return `<ul style="list-style:disc inside;line-height:2.2;">` +
      words.map(w => `<li style="margin-bottom:8px;"><b>${w.eng}</b>${w.kor ? ' — ' + w.kor : ''}</li>`).join('') + '</ul>';
  }

  function renderCards(words, l1Label = 'Korean') {
    return `<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;'>` +
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
        `<div class="click-instructions" style="position:absolute;top:-25px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:4px 8px;border-radius:4px;font-size:11px;white-space:nowrap;opacity:0;transition:opacity 0.3s ease;pointer-events:none;z-index:15;">Click to search for images</div>` +
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

  // Picture List layout: identical to side-by-side but with image column between number and English
  function renderPictureList(words, l1Label = 'Korean') {
    const preset = tableStylePresets.find(p => p.id === 'numbered');
    if (!preset) {
      console.error('Numbered preset not found');
      return '<div style="color:#ff0000;">Error: Numbered style preset not found</div>';
    }
    
    // Expand words array to minimum 10 items with empty placeholders
    const minRows = Math.max(10, words.length);
    const expandedWords = [...words];
    while (expandedWords.length < minRows) {
      expandedWords.push({ eng: '', kor: '' });
    }
    
    // Table and cell styles from preset
    const tdNum = (preset.tdNumber || 'width:40px;padding:8px;text-align:center;border:none;font-weight:600;background:white;color:#333;box-sizing:border-box;').replace(/text-align:[^;]+;?/, 'text-align:center;') + 'border-bottom:1px solid #e8e8e8;';
    const tdImage = 'width:50px;padding:4px;text-align:center;border:none;background:white;box-sizing:border-box;border-bottom:1px solid #e8e8e8;';
  const tdEng = (preset.tdLeft || 'padding:8px 12px;border:none;font-weight:600;box-sizing:border-box;background:white;color:#333;').replace(/text-align:[^;]+;?/, '') + 'text-align:left !important;border-bottom:1px solid #e8e8e8;';
  const tdKor = (preset.tdRight || 'padding:8px 12px;border:none;color:#333;box-sizing:border-box;background:white;').replace(/text-align:[^;]+;?/, '') + 'text-align:left !important;border-bottom:1px solid #e8e8e8;';
    const th = (preset.th || 'padding:8px 12px;background:white;border:none;font-weight:700;color:#333;text-align:left;box-sizing:border-box;').replace(/text-align:[^;]+;?/, 'text-align:center;').replace(/border-bottom:[^;]+;?/, '').replace(/background:[^;]+;?/, 'background:#f5f5f5;');
    
    let rows = '';
    for (let i = 0; i < expandedWords.length; i++) {
      const word = expandedWords[i];
      const hasContent = word.eng || word.kor;
      rows += `<tr>` +
        `<td style="${tdNum}" contenteditable="false">${hasContent ? (i+1) : ''}</td>` +
        `<td style="${tdImage}" contenteditable="false">` +
          (word.eng ? `<div class="image-drop-zone" data-word="${word.eng}" data-index="${i}" style="margin:0 auto;cursor:pointer;border:1.5px solid #bbb;border-radius:15%;display:flex;align-items:center;justify-content:center;background:#f9f9f9;position:relative;box-shadow:0 2px 8px rgba(60,60,80,0.06);transition:all 0.2s;overflow:hidden;">` +
            `<img src="https://via.placeholder.com/40x40/f5f5f5/999999?text=Loading..." alt="${word.eng}" style="object-fit:cover;border-radius:12%;box-shadow:0 1px 4px rgba(60,60,80,0.08);transition:all 0.2s;" draggable="false">` +
            `</div>` : '') +
        `</td>` +
        `<td style="${tdEng}" contenteditable="true">${word.eng||''}</td>` +
        `<td style="${tdKor}" contenteditable="true">${word.kor||''}</td>` +
        `</tr>`;
    }
    
  const tableHtml = `<style>
      .picture-list-table {
        height: 100%;
        table-layout: fixed;
      }
      .picture-list-table tbody {
        height: 100%;
      }
      .picture-list-table tr {
        height: calc(100% / ${expandedWords.length});
        transition: all 0.2s ease;
      }
      .picture-list-table td {
        vertical-align: middle;
        padding: 4px;
      }
      .picture-list-table .image-drop-zone {
        height: 40px;
        min-height: 25px;
        max-height: 80px;
        width: 40px;
        min-width: 25px;
        max-width: 80px;
        margin: 0 auto;
        transition: all 0.2s ease;
      }
      .picture-list-table .image-drop-zone img {
        width: 100%;
        height: 100%;
      }
    </style>
    <table class="picture-list-table" style="${preset.table}">` +
      `<thead><tr>` +
        `<th style="${tdNum};border-bottom:2.5px solid #333;background:#f5f5f5;" contenteditable="false">#</th>` +
        `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="false"></th>` +
        `<th style="${th};border-bottom:2.5px solid #333;text-align:left !important;" contenteditable="true">English</th>` +
        `<th style="${th};border-bottom:2.5px solid #333;text-align:left !important;" contenteditable="true">${l1Label}</th>` +
      `</tr></thead><tbody>` + rows + `</tbody></table>`;
    
    // Load images after rendering (only one per word)
    setTimeout(() => {
      expandedWords.forEach((word, index) => {
        if (word.eng) {
          // Find the image element
          const zone = document.querySelector(`.image-drop-zone[data-word="${word.eng}"][data-index="${index}"]`);
          if (zone) {
            const img = zone.querySelector('img');
            if (img) {
              const wordKey = `${word.eng.toLowerCase()}_${index}`;
              
              // Check if we already have a chosen image for this word
              if (pictureListImages[wordKey]) {
                console.log('Using saved image for:', word.eng);
                img.src = pictureListImages[wordKey];
              } else {
                console.log('Loading new image for:', word.eng);
                // Load image from Pixabay
                const apiPath = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') : '/.netlify/functions/pixabay';
                fetch(`${apiPath}?q=${encodeURIComponent(word.eng)}&image_type=photo&safesearch=true&order=popular&per_page=1&page=1`)
                  .then(res => res.json())
                  .then(data => {
                    console.log('Pixabay response for', word.eng, ':', data);
                    if (data.images && data.images.length > 0) {
                      img.src = data.images[0];
                      // Save this as the default image
                      pictureListImages[wordKey] = data.images[0];
                      console.log('Set and saved image src to:', data.images[0]);
                    } else {
                      const placeholder = 'https://via.placeholder.com/40x40/f5f5f5/999999?text=No+Image';
                      img.src = placeholder;
                      pictureListImages[wordKey] = placeholder;
                      console.log('No images found, using placeholder');
                    }
                  })
                  .catch(error => {
                    console.error('Error loading image for', word.eng, ':', error);
                    const errorPlaceholder = 'https://via.placeholder.com/40x40/f5f5f5/999999?text=Error';
                    img.src = errorPlaceholder;
                    pictureListImages[wordKey] = errorPlaceholder;
                  });
              }
            }
          }
        }
      });
      // Enable drag-and-drop functionality AFTER images are loaded
      setTimeout(() => {
        enablePictureListDragAndDrop();
        setupPictureListResizeObserver();
      }, 500);
    }, 100);
    
    return tableHtml;
  }

  // Enhanced drag and drop functionality for Picture List images (from wordtest/images.js)
  function enablePictureListDragAndDrop() {
    console.log('Setting up drag and drop for Picture List');
    
    // Add enhanced drag and drop listeners WITHOUT cloning/replacing elements
    document.querySelectorAll('.image-drop-zone').forEach(zone => {
      // Make the zone more visually obvious as a drop target
      zone.style.transition = 'all 0.3s ease';
      zone.title = 'Click to open image search or drag and drop an image here to replace';
      
      // Prevent default drag behaviors on the zone
      zone.addEventListener('dragenter', e => {
        e.preventDefault();
        e.stopPropagation();
      });
      
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('dragover');
        zone.style.border = '2px dashed #4299e1';
        zone.style.backgroundColor = '#e6f0fa';
        zone.style.borderRadius = '8px';
      });
      
      zone.addEventListener('dragleave', e => {
        e.preventDefault();
        e.stopPropagation();
        // Only remove styles if we're actually leaving the zone (not entering child elements)
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('dragover');
          zone.style.border = '1px solid #ddd';
          zone.style.backgroundColor = '#f9f9f9';
          zone.style.borderRadius = '4px';
        }
      });
      
      // Prevent default drag behaviors on the zone
      zone.addEventListener('dragenter', e => {
        e.preventDefault();
        e.stopPropagation();
      });
      
      zone.addEventListener('dragover', e => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.add('dragover');
        zone.style.border = '2px dashed #4299e1';
        zone.style.backgroundColor = '#e6f0fa';
        zone.style.borderRadius = '8px';
      });
      
      zone.addEventListener('dragleave', e => {
        e.preventDefault();
        e.stopPropagation();
        // Only remove styles if we're actually leaving the zone (not entering child elements)
        if (!zone.contains(e.relatedTarget)) {
          zone.classList.remove('dragover');
          zone.style.border = '2px dashed transparent';
          zone.style.backgroundColor = '';
          zone.style.borderRadius = '';
        }
      });
      zone.addEventListener('drop', async e => {
        e.preventDefault();
        e.stopPropagation();
        zone.classList.remove('dragover');
        zone.style.border = '1px solid #ddd';
        zone.style.backgroundColor = '#f9f9f9';
        zone.style.borderRadius = '4px';
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        
        const file = files[0];
        if (!file.type.startsWith('image/')) {
          alert('Please drop an image file (JPG, PNG, GIF, etc.)');
          return;
        }
        
        // Check file size (limit to 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert('Image file is too large. Please use an image smaller than 5MB.');
          return;
        }
        
        const word = zone.getAttribute('data-word');
        const index = zone.getAttribute('data-index');
        
        if (!word || !index) {
          console.error('Invalid word or index for image drop');
          return;
        }
        
        // Show loading indicator
        const img = zone.querySelector('img');
        if (img) {
          img.style.opacity = '0.5';
        }
        
        const reader = new FileReader();
        reader.onload = async function(ev) {
          try {
            const imageDataUrl = ev.target.result;
            
            // Validate the image data
            if (!imageDataUrl || !imageDataUrl.startsWith('data:image/')) {
              throw new Error('Invalid image data');
            }
            
            // Update the image directly
            if (img) {
              img.src = imageDataUrl;
              img.style.opacity = '1';
              img.style.width = '100%';
              img.style.height = '100%';
              img.style.borderRadius = '12%';
              // Save the new image so it persists when inserted
              const wordKey = `${word.toLowerCase()}_${index}`;
              pictureListImages[wordKey] = imageDataUrl;
              console.log(`Updated and saved image for ${word}_${index} via drag and drop`);
            }
            
            // Show success feedback with animation
            zone.classList.add('drag-success');
            zone.style.border = '2px solid #48bb78';
            zone.style.backgroundColor = '#e6fffa';
            
            // Show success message temporarily
            const successMsg = document.createElement('div');
            successMsg.innerHTML = '✅ Image replaced!';
            successMsg.style.cssText = `
              position: absolute;
              top: -25px;
              left: 50%;
              transform: translateX(-50%);
              background: #48bb78;
              color: white;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 10px;
              white-space: nowrap;
              z-index: 20;
              pointer-events: none;
            `;
            zone.style.position = 'relative';
            zone.appendChild(successMsg);
            
            setTimeout(() => {
              zone.classList.remove('drag-success');
              zone.style.border = '1px solid #ddd';
              zone.style.backgroundColor = '#f9f9f9';
              if (successMsg.parentNode) {
                successMsg.parentNode.removeChild(successMsg);
              }
            }, 2000);
            
          } catch (error) {
            console.error('Error processing dropped image:', error);
            alert('Error processing the dropped image. Please try again.');
            if (img) {
              img.style.opacity = '1';
            }
          }
        };
        
        reader.onerror = function() {
          console.error('Error reading dropped file');
          alert('Error reading the dropped file. Please try again.');
          if (img) {
            img.style.opacity = '1';
          }
        };
        
        reader.readAsDataURL(file);
      });
      
      // Add hover effects for better UX
      zone.addEventListener('mouseenter', e => {
        if (!zone.classList.contains('dragover')) {
          zone.style.border = '2px solid #cbd5e0';
          zone.style.backgroundColor = '#f7fafc';
        }
      });
      
      zone.addEventListener('mouseleave', e => {
        if (!zone.classList.contains('dragover')) {
          zone.style.border = '1px solid #ddd';
          zone.style.backgroundColor = '#f9f9f9';
        }
      });
      
      // Add click handler for opening Pixabay gallery
      zone.addEventListener('click', function(e) {
        e.stopPropagation();
        const word = this.getAttribute('data-word');
        if (word) {
          console.log('Opening image search for:', word);
          // Use the updated openPixabaySearch function which handles different sources
          openPixabaySearch(word);
        }
      });
    });
  }

  // Function to clear stored Picture List images (useful when starting fresh)
  function clearPictureListImages() {
    pictureListImages = {};
    console.log('Cleared all stored Picture List images');
  }

  // Function to get current stored images (for debugging)
  function getPictureListImages() {
    return pictureListImages;
  }

  // Helper function to load images specifically for table cells
  async function loadImageForWordInTable(word, index) {
    if (!word) return;
    
    try {
      console.log('Loading table image for:', word, 'at index:', index);
      
      // Find the image container by word
      const imageContainer = document.querySelector(`[data-word="${word}"]`);
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
        imageContainer.innerHTML = `<img src="${imageUrl}" alt="${word}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" crossorigin="anonymous" onerror="this.src='${getPlaceholderImage(index, word)}'">`;
      } else {
        console.log('No images found in response');
        // No images found, use placeholder
        const placeholderUrl = getPlaceholderImage(index, word);
        imageContainer.innerHTML = `<img src="${placeholderUrl}" alt="${word}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" crossorigin="anonymous">`;
      }
    } catch (error) {
      console.error('Error fetching image for word:', word, error);
      // Fall back to placeholder
      const placeholderUrl = getPlaceholderImage(index, word);
      if (imageContainer) {
        imageContainer.innerHTML = `<img src="${placeholderUrl}" alt="${word}" style="width:100%;height:100%;object-fit:cover;border-radius:4px;" crossorigin="anonymous">`;
      }
    }
  }

  // Helper function to get placeholder image (similar to wordtest.js)
  function getPlaceholderImage(index, word = null) {
    // Simple placeholder service with random colors
    const colors = ['4299e1', '48bb78', 'ed8936', 'e53e3e', '9f7aea', '38b2ac'];
    const color = colors[index % colors.length];
    const text = word ? encodeURIComponent(word) : `${index + 1}`;
    return `https://via.placeholder.com/150x100/${color}/ffffff?text=${text}`;
  }

  // Function to open image search in a new window based on selected source
  function openPixabaySearch(word) {
    if (!word) return;
    
    // Get the current picture source setting (default to illustrations if not set)
    const pictureSource = window.currentPictureSource || 'illustrations';
    
    let searchUrl = '';
    let windowTitle = 'ImageSearchWindow';
    switch (pictureSource) {
      case 'any':
        searchUrl = `https://pixabay.com/images/search/${encodeURIComponent(word)}/`;
        windowTitle = 'AnyImageSearchWindow';
        break;
      case 'illustrations':
        searchUrl = `https://pixabay.com/illustrations/search/${encodeURIComponent(word)}/`;
        windowTitle = 'IllustrationSearchWindow';
        break;
      case 'photos':
        searchUrl = `https://pixabay.com/photos/search/${encodeURIComponent(word)}/`;
        windowTitle = 'PhotoSearchWindow';
        break;
      case 'ai':
        searchUrl = `https://lexica.art/?q=${encodeURIComponent(word)}`;
        windowTitle = 'LexicaAISearchWindow';
        break;
      default:
        searchUrl = `https://pixabay.com/images/search/${encodeURIComponent(word)}/`;
        windowTitle = 'AnyImageSearchWindow';
    }
    console.log(`Opening ${pictureSource} search for: ${word}`);
  // Open search in a new window - 25vw wide, tall, positioned far left
  const width = Math.round(window.innerWidth * 0.25);
  const height = Math.round(window.innerHeight * 0.99);
  const windowFeatures = 'width=' + width + ',height=' + height + ',left=0,top=0,scrollbars=yes,resizable=yes';
  window.open(searchUrl, windowTitle, windowFeatures);
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
      const apiPath = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') : '/.netlify/functions/pixabay';
      const url = `${apiPath}?q=${encodeURIComponent(word)}&image_type=photo&safesearch=true&order=popular&per_page=5&page=${Math.floor(Math.random()*5)+1}`;
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
      const apiPath = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') : '/.netlify/functions/pixabay';
      const url = `${apiPath}?q=${encodeURIComponent(word)}&image_type=photo&safesearch=true&order=popular&per_page=5&page=${Math.floor(Math.random()*5)+1}`;
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

function renderDoubleList(words, l1Label = 'Korean') {
  // Use default numbered style for double list
  return renderDoubleListWithStyle(words, 'numbered', l1Label);
}

function renderDoubleListWithStyle(words, styleId, l1Label = 'Korean') {
  // Get the style preset
  const preset = tableStylePresets.find(p => p.id === styleId) || tableStylePresets[0];
  
  // Split words into two columns (left: first half, right: second half)
  const half = Math.ceil(words.length / 2);
  const left = words.slice(0, half);
  const right = words.slice(half);
  // Pad columns to equal length (only as many rows as needed)
  const maxRows = Math.max(left.length, right.length);
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
      `<th style="${th};border-right:2.5px solid #333;border-bottom:2.5px solid #333;" contenteditable="true">${l1Label}</th>` +
      `<th style="${tdNum};${borderBetween};border-bottom:2.5px solid #333;background:#f5f5f5;" contenteditable="false"></th>` +
      `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="true">English</th>` +
      `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="true">${l1Label}</th>` +
    `</tr></thead><tbody>` + rows + `</tbody></table>`;
}

  // Double Picture List layout: like double list, but with image columns after each number
  function renderDoublePictureList(words, l1Label = 'Korean') {
    const preset = tableStylePresets.find(p => p.id === 'numbered') || tableStylePresets[0];
    
    // Split words into two columns (left: first half, right: second half)
    const half = Math.ceil(words.length / 2);
    const left = words.slice(0, half);
    const right = words.slice(half);
    const maxRows = Math.max(left.length, right.length, 6);
    while (left.length < maxRows) left.push({eng: '', kor: ''});
    while (right.length < maxRows) right.push({eng: '', kor: ''});
    
    const tdNum = (preset.tdNumber || 'padding:8px 8px;border:none;font-weight:700;color:#333;text-align:center;box-sizing:border-box;background:white;width:38px;min-width:38px;').replace(/text-align:[^;]+;?/, 'text-align:center;');
    const borderBetween = 'border-left:2.5px solid #333;';
    const tdImage = 'width:50px;padding:4px;text-align:center;border:none;background:white;box-sizing:border-box;border-bottom:1px solid #e8e8e8;';
    const tdEng = (preset.tdLeft || 'padding:8px 12px;border:none;font-weight:600;box-sizing:border-box;background:white;color:#333;').replace(/text-align:[^;]+;?/, '') + 'text-align:left !important;border-bottom:1px solid #e8e8e8;';
    const tdKor = (preset.tdRight || 'padding:8px 12px;border:none;color:#333;box-sizing:border-box;background:white;').replace(/text-align:[^;]+;?/, '') + 'text-align:left !important;border-bottom:1px solid #e8e8e8;';
    const th = (preset.th || 'padding:8px 12px;background:white;border:none;font-weight:700;color:#333;text-align:left;box-sizing:border-box;').replace(/text-align:[^;]+;?/, 'text-align:center;').replace(/border-bottom:[^;]+;?/, '').replace(/background:[^;]+;?/, 'background:#f5f5f5;');
    
    let rows = '';
    for (let i = 0; i < maxRows; i++) {
      const leftHasContent = left[i].eng || left[i].kor;
      const rightHasContent = right[i].eng || right[i].kor;
      rows += `<tr>` +
        `<td style="${tdNum}" contenteditable="false">${leftHasContent ? (i+1) : ''}</td>` +
        `<td style="${tdImage}" contenteditable="false">` +
          (left[i].eng ? `<div class="image-drop-zone" data-word="${left[i].eng}" data-index="left${i}" style="margin:0 auto;cursor:pointer;border:1.5px solid #bbb;border-radius:15%;display:flex;align-items:center;justify-content:center;background:#f9f9f9;position:relative;box-shadow:0 2px 8px rgba(60,60,80,0.06);transition:all 0.2s;overflow:hidden;">` +
            `<img src="https://via.placeholder.com/40x40/f5f5f5/999999?text=Loading..." alt="${left[i].eng}" style="object-fit:cover;border-radius:12%;box-shadow:0 1px 4px rgba(60,60,80,0.08);transition:all 0.2s;" draggable="false">` +
            `</div>` : '') +
        `</td>` +
        `<td style="${tdEng}" contenteditable="true">${left[i].eng||''}</td>` +
        `<td style="${tdKor};border-right:2.5px solid #333;" contenteditable="true">${left[i].kor||''}</td>` +
        `<td style="${tdNum};${borderBetween}" contenteditable="false">${rightHasContent ? (i+1+half) : ''}</td>` +
        `<td style="${tdImage}" contenteditable="false">` +
          (right[i].eng ? `<div class="image-drop-zone" data-word="${right[i].eng}" data-index="right${i}" style="margin:0 auto;cursor:pointer;border:1.5px solid #bbb;border-radius:15%;display:flex;align-items:center;justify-content:center;background:#f9f9f9;position:relative;box-shadow:0 2px 8px rgba(60,60,80,0.06);transition:all 0.2s;overflow:hidden;">` +
            `<img src="https://via.placeholder.com/40x40/f5f5f5/999999?text=Loading..." alt="${right[i].eng}" style="object-fit:cover;border-radius:12%;box-shadow:0 1px 4px rgba(60,60,80,0.08);transition:all 0.2s;" draggable="false">` +
            `</div>` : '') +
        `</td>` +
        `<td style="${tdEng}" contenteditable="true">${right[i].eng||''}</td>` +
        `<td style="${tdKor}" contenteditable="true">${right[i].kor||''}</td>` +
        `</tr>`;
    }
    
    const tableHtml = `<style>
      .double-picture-list-table .image-drop-zone { height: 40px; min-height: 25px; max-height: 80px; width: 40px; min-width: 25px; max-width: 80px; margin: 0 auto; transition: all 0.2s ease; }
      .double-picture-list-table .image-drop-zone img { width: 100%; height: 100%; }
    </style>` +
      `<table class="double-picture-list-table" style="${preset.table}">` +
      `<thead><tr>` +
        `<th style="${tdNum};border-bottom:2.5px solid #333;background:#f5f5f5;" contenteditable="false"></th>` +
        `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="false"></th>` +
        `<th style="${th};border-bottom:2.5px solid #333;text-align:left !important;" contenteditable="true">English</th>` +
        `<th style="${th};border-right:2.5px solid #333;border-bottom:2.5px solid #333;text-align:left !important;" contenteditable="true">${l1Label}</th>` +
        `<th style="${tdNum};${borderBetween};border-bottom:2.5px solid #333;background:#f5f5f5;" contenteditable="false"></th>` +
        `<th style="${th};border-bottom:2.5px solid #333;" contenteditable="false"></th>` +
        `<th style="${th};border-bottom:2.5px solid #333;text-align:left !important;" contenteditable="true">English</th>` +
        `<th style="${th};border-bottom:2.5px solid #333;text-align:left !important;" contenteditable="true">${l1Label}</th>` +
      `</tr></thead><tbody>` + rows + `</tbody></table>`;
    
    // After rendering, load images for each word (left and right)
    setTimeout(() => {
      [...left, ...right].forEach((word, idx) => {
        if (word.eng) {
          const zone = document.querySelector(`.image-drop-zone[data-word="${word.eng}"][data-index="${idx < left.length ? 'left'+idx : 'right'+(idx-left.length)}"]`);
          if (zone) {
            const img = zone.querySelector('img');
            if (img) {
              const wordKey = `${word.eng.toLowerCase()}_${idx < left.length ? 'left'+idx : 'right'+(idx-left.length)}`;
              if (pictureListImages[wordKey]) {
                img.src = pictureListImages[wordKey];
              } else {
                const apiPath = window.WillenaAPI ? window.WillenaAPI.getApiUrl('/.netlify/functions/pixabay') : '/.netlify/functions/pixabay';
                fetch(`${apiPath}?q=${encodeURIComponent(word.eng)}&image_type=photo&safesearch=true&order=popular&per_page=1&page=1`)
                  .then(res => res.json())
                  .then(data => {
                    if (data.images && data.images.length > 0) {
                      img.src = data.images[0];
                      pictureListImages[wordKey] = data.images[0];
                    } else {
                      const placeholder = 'https://via.placeholder.com/40x40/f5f5f5/999999?text=No+Image';
                      img.src = placeholder;
                      pictureListImages[wordKey] = placeholder;
                    }
                  })
                  .catch(() => {
                    const errorPlaceholder = 'https://via.placeholder.com/40x40/f5f5f5/999999?text=Error';
                    img.src = errorPlaceholder;
                    pictureListImages[wordKey] = errorPlaceholder;
                  });
              }
            }
          }
        }
      });
      setTimeout(() => { 
        enablePictureListDragAndDrop(); 
        setupPictureListResizeObserver();
      }, 500);
    }, 100);
    
    return tableHtml;
  }

  function renderPreview(words, format, l1Label) {
    if (!words.length) return '<div style="color:#aaa;font-size:1.1em;">No words to preview.</div>';
    switch(format) {
      case 'sidebyside': return renderSideBySide(words, l1Label);
      case 'basic': return renderBasic(words, l1Label);
      case 'cards': return renderCards(words, l1Label);
      case 'doublelist': return renderDoubleList(words, l1Label);
      case 'picturecards': return renderPictureCards(words, l1Label);
      case 'picturelist': return renderPictureList(words, l1Label);
      case 'doublepicturelist': return renderDoublePictureList(words, l1Label);
      case 'matching': return renderMatching(words, l1Label);
      default:
        return '<div style="color:#aaa;">Unknown format: ' + format + '</div>';
    }
  }

  // Set up ResizeObserver to make images responsive to textbox height changes
  function setupPictureListResizeObserver() {
    const table = document.querySelector('.picture-list-table, .double-picture-list-table');
    if (!table) return;
    
    // Find the parent textbox container
    let textboxContainer = table.closest('.worksheet-textbox');
    if (!textboxContainer) {
      textboxContainer = table.closest('[contenteditable]');
    }
    if (!textboxContainer) return;
    
    console.log('Setting up ResizeObserver for Picture List images');
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const containerHeight = entry.contentRect.height;
        const rowCount = table.querySelectorAll('tbody tr').length;
        
        // Calculate image size based on container height
        const availableHeightPerRow = (containerHeight - 60) / Math.max(rowCount, 1); // 60px for header + padding
        const imageSize = Math.max(25, Math.min(80, availableHeightPerRow - 16)); // clamp between 25-80px
        
        // Update all image drop zones
        const dropZones = table.querySelectorAll('.image-drop-zone');
        dropZones.forEach(zone => {
          zone.style.width = `${imageSize}px`;
          zone.style.height = `${imageSize}px`;
        });
        
        console.log(`Container height: ${containerHeight}px, Image size: ${imageSize}px`);
      }
    });
    
    resizeObserver.observe(textboxContainer);
    
    // Store the observer so it can be cleaned up later
    table.dataset.resizeObserver = 'active';
  }

  window.MintAIVocabLayouts = {
    renderPreview,
    renderSideBySide,
    renderSideBySideWithStyle,
    getTableStylePresets,
    renderBasic,
    renderCards,
    renderPictureCards,
    renderPictureList,
    renderDoubleList,
    renderDoubleListWithStyle,
    renderDoublePictureList,
    renderMatching,
    clearPictureListImages,
    getPictureListImages
  };
  
  console.log('MintAIVocabLayouts loaded successfully:', window.MintAIVocabLayouts);
})();
