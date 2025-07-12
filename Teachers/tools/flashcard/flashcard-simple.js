// Feedback modal loader for burger menu integration
window.showFeedbackModal = function() {
  // Prevent multiple modals
  if (document.getElementById('feedback-modal-bg')) return;
  // Try to find the template in DOM first
  let template = document.getElementById('feedback-modal-template');
  if (!template) {
    // If not found, fetch and inject it
    fetch('/Teachers/components/feedback-modal.html')
      .then(resp => resp.text())
      .then(html => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        document.body.appendChild(tempDiv.firstElementChild);
        showFeedbackModal(); // Call again now that template is present
      });
    return;
  }
  // Clone and show modal
  const modalNode = template.content.cloneNode(true);
  document.body.appendChild(modalNode);
  // Add close/cancel handlers
  const bg = document.getElementById('feedbackModalBg');
  if (!bg) return;
  const closeBtn = bg.querySelector('#feedbackModalCloseBtn');
  const cancelBtn = bg.querySelector('#feedbackCancelBtn');
  function closeModal() { bg.remove(); }
  if (closeBtn) closeBtn.onclick = closeModal;
  if (cancelBtn) cancelBtn.onclick = closeModal;
  // Optional: focus textarea
  const textarea = bg.querySelector('textarea');
  if (textarea) textarea.focus();

  // Feedback submit handler
  const submitBtn = bg.querySelector('#feedbackSubmitBtn');
  if (submitBtn) {
    submitBtn.onclick = async function() {
      const feedbackText = textarea.value.trim();
      if (!feedbackText) {
        alert('Please enter your feedback.');
        textarea.focus();
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';
      // Prepare feedback payload
      // Gather tool state (settings)
      let toolState = {};
      try {
        toolState = {
          font: document.getElementById('fontSelect')?.value,
          fontSize: document.getElementById('fontSizeInput')?.value,
          layout: document.getElementById('layoutSelect')?.value,
          imageZoom: document.getElementById('imageZoomSlider')?.value,
          showKorean: document.getElementById('showKoreanToggle')?.checked,
          imageOnly: document.getElementById('imageOnlyToggle')?.checked,
          title: document.getElementById('titleInput')?.value,
          wordList: document.getElementById('wordListInput')?.value,
        };
      } catch (e) { toolState = {}; }
      const payload = {
        feedback: feedbackText,
        module: 'flashcard',
        page_url: window.location.pathname,
        tool_state: toolState,
        user_id: null // Optionally set if you have auth
      };
      try {
        const resp = await fetch('/.netlify/functions/supabase_proxy?feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'insert_feedback',
            data: payload
          })
        });
        const result = await resp.json();
        if (resp.ok && result.success) {
          submitBtn.textContent = 'Sent!';
          setTimeout(closeModal, 900);
        } else {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Send';
          alert('Error sending feedback: ' + (result.error || 'Unknown error'));
        }
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send';
        alert('Network error: ' + err.message);
      }
    };
  }
};
// Simple flashcard app without ES6 modules (like wordtest2.js)
let flashcards = [];
let currentSettings = {
    font: 'Poppins',
    fontSize: 18,
    layout: '4-card',
    imageZoom: 1,
    showKorean: false,
    imageOnly: false,
    title: ''
};

// Initialize when DOM loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('Flashcard app loading...');
    
    // Set up event listeners
    setupEventListeners();
    updatePreview();
    
    console.log('Flashcard app loaded');
});

function setupEventListeners() {
    // Action buttons
    document.getElementById('printBtn').addEventListener('click', printFlashcards);
    document.getElementById('generateCardsBtn').addEventListener('click', generateCards);
    document.getElementById('clearCardsBtn').addEventListener('click', clearCards);
    
    // Settings changes
    document.getElementById('fontSelect').addEventListener('change', updatePreview);
    document.getElementById('fontSizeInput').addEventListener('input', updatePreview);
    document.getElementById('layoutSelect').addEventListener('change', updatePreview);
    document.getElementById('showKoreanToggle').addEventListener('change', updatePreview);
    document.getElementById('imageOnlyToggle').addEventListener('change', updatePreview);
    document.getElementById('titleInput').addEventListener('input', updatePreview);
    const imageZoomInput = document.getElementById('imageZoomSlider');
    if (imageZoomInput) imageZoomInput.addEventListener('input', updatePreview);
}

function generateCards() {
    const wordListText = document.getElementById('wordListInput').value.trim();
    if (!wordListText) {
        alert('Please enter some words first.');
        return;
    }
    
    // Parse words (one per line)
    const words = wordListText.split('\n')
        .map(word => word.trim())
        .filter(word => word.length > 0);
    
    // Create flashcard objects
    flashcards = words.map(word => ({
        english: word,
        korean: '',
        imageUrl: null
    }));
    
    updateCardList();
    updatePreview();
    
    // Fetch images for each card as soon as generated
    flashcards.forEach((card, idx) => {
        fetchImageForCard(idx);
    });
}

async function fetchImageForCard(index) {
    const card = flashcards[index];
    if (!card) return;
    const query = card.english;
    try {
        const res = await fetch('/.netlify/functions/pixabay?q=' + encodeURIComponent(query));
        const data = await res.json();
        if (data.images && data.images.length > 0) {
            card.imageUrl = data.images[0];
        } else {
            card.imageUrl = null;
        }
    } catch (e) {
        card.imageUrl = null;
    }
    updateCardList();
    updatePreview();
}

function clearCards() {
    flashcards = [];
    updateCardList();
    updatePreview();
}

function updateCardList() {
    const cardCount = document.getElementById('cardCount');
    const cardList = document.getElementById('cardList');
    
    cardCount.textContent = `${flashcards.length} cards`;
    
    if (flashcards.length === 0) {
        cardList.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No cards generated yet</p>';
        return;
    }
    
    cardList.innerHTML = flashcards.map((card, index) => `
        <div class="card-item">
            <span class="card-text">${card.english}</span>
            <button class="delete-btn" onclick="deleteCard(${index})">×</button>
        </div>
    `).join('');
}

function deleteCard(index) {
    flashcards.splice(index, 1);
    updateCardList();
    updatePreview();
}

function updatePreview() {
    // Get current settings
    currentSettings = {
        font: document.getElementById('fontSelect').value,
        fontSize: parseInt(document.getElementById('fontSizeInput').value),
        layout: document.getElementById('layoutSelect').value,
        imageZoom: parseFloat(document.getElementById('imageZoomSlider') ? document.getElementById('imageZoomSlider').value : 1),
        showKorean: document.getElementById('showKoreanToggle').checked,
        imageOnly: document.getElementById('imageOnlyToggle').checked,
        title: document.getElementById('titleInput').value.trim()
    };

    const placeholder = document.getElementById('previewPlaceholder');
    const grid = document.getElementById('flashcardGrid');

    if (flashcards.length === 0) {
        placeholder.style.display = 'block';
        grid.style.display = 'none';
        return;
    }

    placeholder.style.display = 'none';
    grid.style.display = 'grid';

    // Responsive preview layouts: 1, 1x2-portrait, 2, 4, or 8 per page
    if (currentSettings.layout === '1-card') {
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.alignItems = 'center';
        grid.style.justifyContent = 'flex-start';
        grid.style.gap = '5vh';
        grid.style.padding = '4vw 0';
        grid.style.height = 'auto';
    } else if (currentSettings.layout === '1x2-portrait') {
        grid.style.display = 'flex';
        grid.style.flexDirection = 'column';
        grid.style.alignItems = 'center';
        grid.style.justifyContent = 'flex-start';
        grid.style.gap = '4vh';
        grid.style.padding = '3vw 0';
        grid.style.height = 'auto';
    } else if (currentSettings.layout === '2-card') {
        grid.style.display = '';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '2vw';
        grid.style.padding = '2vw';
        grid.style.height = '';
        grid.style.alignItems = '';
        grid.style.justifyItems = '';
    } else if (currentSettings.layout === '4-card') {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '1.5vw';
        grid.style.padding = '2vw';
        grid.style.height = '';
        grid.style.alignItems = '';
        grid.style.justifyItems = '';
    } else if (currentSettings.layout === '8-card') {
        grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '1vw';
        grid.style.padding = '2vw';
        grid.style.height = '';
        grid.style.alignItems = '';
        grid.style.justifyItems = '';
    } else {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '1.5vw';
        grid.style.padding = '2vw';
        grid.style.height = '';
        grid.style.alignItems = '';
        grid.style.justifyItems = '';
    }

    // Generate flashcard HTML with drag-and-drop support
    grid.innerHTML = flashcards.map((card, idx) => generateCardHTML(card, idx)).join('');
    if (currentSettings.layout === '1-card') {
        document.querySelectorAll('.flashcard').forEach(card => {
            card.style.margin = '5vh 0';
        });
    } else if (currentSettings.layout === '1x2-portrait') {
        document.querySelectorAll('.flashcard').forEach(card => {
            card.style.margin = '4vh 0';
        });
    }
    // Add drag-and-drop listeners to each card
    flashcards.forEach((card, idx) => {
        const cardElem = document.getElementById('flashcard-' + idx);
        if (!cardElem) return;
        cardElem.addEventListener('dragover', function(e) {
            e.preventDefault();
            cardElem.style.background = '#f0f0f0';
        });
        cardElem.addEventListener('dragleave', function(e) {
            cardElem.style.background = '';
        });
        cardElem.addEventListener('drop', function(e) {
            e.preventDefault();
            cardElem.style.background = '';
            const files = Array.from(e.dataTransfer.files);
            const imageFile = files.find(file => file.type.startsWith('image/'));
            if (imageFile) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    card.imageUrl = ev.target.result;
                    updateCardList();
                    updatePreview();
                };
                reader.readAsDataURL(imageFile);
            }
        });
    });
}

function generateCardHTML(card, idx) {
    // For 1-card and 2-card mode, wrap image in a box with 6/8 aspect ratio or large preview
    let imageHTML;
    if (currentSettings.layout === '1-card') {
        const zoom = currentSettings.imageZoom || 1;
        imageHTML = `
            <div class="flashcard-imagebox" style="width: 60vw; max-width: 600px; aspect-ratio: 6/8; background: #f8f8f8; display: flex; align-items: center; justify-content: center; border-radius: 12px; margin-bottom: 24px; overflow: hidden; min-height: 300px;">
                ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.english}" style="width:${zoom*100}%; height:${zoom*100}%; object-fit:contain; transition:width 0.2s,height 0.2s;" />` : '<div class="flashcard-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:18px;">No image</div>'}
            </div>
        `;
    } else if (currentSettings.layout === '1x2-portrait') {
        const zoom = currentSettings.imageZoom || 1;
        imageHTML = `
            <div class="flashcard-imagebox" style="width: 40vw; max-width: 500px; aspect-ratio: 3/1.9; background: #f8f8f8; display: flex; align-items: center; justify-content: center; border-radius: 12px; margin-bottom: 20px; overflow: hidden; min-height: 280px;">
                ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.english}" style="width:${zoom*100}%; height:${zoom*100}%; object-fit:contain; transition:width 0.2s,height 0.2s;" />` : '<div class="flashcard-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:16px;">No image</div>'}
            </div>
        `;
    } else if (currentSettings.layout === '2-card') {
        const zoom = currentSettings.imageZoom || 1;
        imageHTML = `
            <div class="flashcard-imagebox" style="width: 80%; aspect-ratio: 6/8; background: #f8f8f8; display: flex; align-items: center; justify-content: center; border-radius: 6px; margin-bottom: 12px; overflow: hidden;">
                ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.english}" style="width:${zoom*100}%; height:${zoom*100}%; object-fit:contain; transition:width 0.2s,height 0.2s;" />` : '<div class="flashcard-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;">No image</div>'}
            </div>
        `;
    } else {
        imageHTML = card.imageUrl ? 
            `<img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image">` : 
            '<div class="flashcard-placeholder">No image</div>';
    }

    const textHTML = currentSettings.imageOnly ? '' : `
        <div class="flashcard-text">
            <div class="flashcard-english" style="font-size: ${currentSettings.fontSize}px;">${escapeHtml(card.english)}</div>
            ${currentSettings.showKorean && card.korean ? 
                `<div class="flashcard-korean">${escapeHtml(card.korean)}</div>` : 
                ''
            }
        </div>
    `;

    // For preview: cards fill their grid cell, height is relative to container
    let style = `font-family: ${currentSettings.font}; font-size: ${currentSettings.fontSize}px; border: 2px solid #333; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: white; width: 100%; box-sizing: border-box;`;
    if (currentSettings.layout === '1-card') {
        style += ' min-height: 60vh; min-width: 0; max-width: 700px; margin: 0 auto; box-shadow: 0 2px 16px #0001;';
    } else if (currentSettings.layout === '1x2-portrait') {
        style += ' min-height: 45vh; min-width: 0; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 12px #0001;';
    } else if (currentSettings.layout === '2-card') {
        style += ' aspect-ratio: 6/8; min-height: 300px; min-width: 0; max-width: 100%; max-height: 100%;';
    } else if (currentSettings.layout === '4-card') {
        style += ' min-height: 150px; min-width: 0;';
    } else if (currentSettings.layout === '8-card') {
        style += ' min-height: 100px; min-width: 0;';
    } else {
        style += ' min-height: 150px; min-width: 0;';
    }

    return `
        <div class="flashcard" id="flashcard-${idx}" style="${style}" draggable="false">
            ${imageHTML}
            ${textHTML}
            <div style="font-size:10px;color:#aaa;margin-top:4px;">Drag image here</div>
        </div>
    `;
}

function printFlashcards() {
    console.log('Print button clicked');
    
    if (flashcards.length === 0) {
        alert('No flashcards to print.');
        return;
    }
    
    console.log('Opening print window...');
    
    const printWindow = window.open('', 'PrintWindow', 'width=800,height=600,scrollbars=yes,resizable=yes');
    if (!printWindow) {
        alert('Pop-up blocked. Please allow pop-ups for this site.');
        return;
    }
    
    const printContent = generatePrintHTML();
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Auto-print and close
    setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 500);
    }, 200);
    
    console.log('Print window created');
}

function generatePrintHTML() {
    const title = currentSettings.title || 'Flashcards';
    const layout = getLayoutConfig(currentSettings.layout);

    // Split cards into pages
    const cardsPerPage = layout.cardsPerPage;
    const pages = [];

    for (let i = 0; i < flashcards.length; i += cardsPerPage) {
        const pageCards = flashcards.slice(i, i + cardsPerPage);
        pages.push(pageCards);
    }

    // Print: one grid for all cards, no forced page breaks, image zoom applied
    let gridClass = '';
    if (layout.type === '2-card') gridClass = 'two-card';

    const printImageZoom = currentSettings.imageZoom || 1;

    // For 1-card, 1x2-portrait, and 8-card layout, cards per page
    let pageHTML = '';
    if (layout.type === '1-card') {
        pageHTML = flashcards.map(card => `
            <div class="flashcard-grid one-card" style="page-break-after: always;">
                ${generatePrintCardHTML(card, layout, printImageZoom)}
            </div>
        `).join('');
    } else if (layout.type === '1x2-portrait') {
        for (let i = 0; i < flashcards.length; i += 2) {
            const pageCards = flashcards.slice(i, i + 2);
            pageHTML += `
                <div class="flashcard-grid one-x2-portrait" style="page-break-after: always;">
                    ${pageCards.map(card => generatePrintCardHTML(card, layout, printImageZoom)).join('')}
                </div>
            `;
        }
    } else if (layout.type === '8-card') {
        for (let i = 0; i < flashcards.length; i += 8) {
            const pageCards = flashcards.slice(i, i + 8);
            pageHTML += `
                <div class="flashcard-grid eight-card" style="page-break-after: always; grid-template-columns: repeat(4, 1fr); grid-template-rows: repeat(2, 1fr);">
                    ${pageCards.map(card => generatePrintCardHTML(card, layout, printImageZoom)).join('')}
                </div>
            `;
        }
    } else {
        pageHTML = `
            <div class="flashcard-grid ${gridClass}">
                ${flashcards.map(card => generatePrintCardHTML(card, layout, printImageZoom)).join('')}
            </div>
        `;
    }

    // Custom CSS for 2-card layout, using cm for print accuracy
    const twoCardCSS = `
        @media print {
            .flashcard-grid.two-card {
                display: grid;
                grid-template-columns: 10.1cm 10.1cm;
                grid-auto-rows: 14.1cm;
                gap: 0.3cm;
                padding: 0.5cm 0.3cm 0.5cm 0.3cm;
                page-break-inside: avoid;
                height: 28.7cm;
                box-sizing: border-box;
            }
            .flashcard.two-card {
                width: 10.1cm;
                height: 14.1cm;
                min-width: 10.1cm;
                min-height: 14.1cm;
                max-width: 10.1cm;
                max-height: 14.1cm;
                margin: 0;
                page-break-inside: avoid;
            }
        }
    `;

    // Custom CSS for 1-card layout
    const oneCardCSS = `
        @media print {
            .flashcard-grid.one-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                min-width: 100vw;
                padding: 0;
                page-break-after: always;
            }
            .flashcard.one-card {
                width: 90vw;
                height: 90vh;
                min-width: 18cm;
                min-height: 24cm;
                max-width: 100vw;
                max-height: 100vh;
                margin: auto;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
        }
    `;

    // Custom CSS for 1x2 portrait layout
    const oneX2PortraitCSS = `
        @media print {
            .flashcard-grid.one-x2-portrait {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
                min-width: 100vw;
                padding: 0;
                page-break-after: always;
            }
            .flashcard.one-x2-portrait {
                width: 90vw;
                height: 44vh;
                min-width: 18cm;
                min-height: 11.5cm;
                max-width: 100vw;
                max-height: 50vh;
                margin: auto;
                page-break-inside: avoid;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
        }
    `;

    // Set landscape orientation for 8-card mode
    const pageOrientation = layout.type === '8-card' ? 'A4 landscape' : 'A4 portrait';
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                @page { size: ${pageOrientation}; margin: 0; }
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    font-family: ${currentSettings.font}, sans-serif;
                    font-size: ${currentSettings.fontSize}px;
                    line-height: 1.4;
                    color: #333;
                    background: white;
                }
                
                .flashcard-grid {
                    display: grid;
                    grid-template-columns: repeat(${layout.columns}, 1fr);
                    gap: ${layout.gap}px;
                    padding: 20px;
                }
                
                .flashcard {
                    border: 2px solid #333;
                    border-radius: 8px;
                    padding: 12px;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                    min-height: ${layout.cardHeight}px;
                    page-break-inside: avoid;
                }
                
                .flashcard-imagebox {
                    width: 80%;
                    aspect-ratio: 6/8;
                    background: #f8f8f8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 6px;
                    margin-bottom: 12px;
                    overflow: hidden;
                }
                
                .flashcard-imagebox img {
                    width: ${printImageZoom * 100}%;
                    height: ${printImageZoom * 100}%;
                    object-fit: contain;
                    transition: width 0.2s, height 0.2s;
                }
                
                .flashcard-text {
                    width: 100%;
                }
                
                .flashcard-english {
                    font-size: ${currentSettings.fontSize}px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 4px;
                }
                
                .flashcard-korean {
                    font-size: ${Math.round(currentSettings.fontSize * 0.85)}px;
                    color: #666;
                }
                
                .flashcard-placeholder {
                    width: 100%;
                    height: 80px;
                    background: #f0f0f0;
                    border: 2px dashed #ccc;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    font-size: 14px;
                    margin-bottom: 8px;
                }
                
                @media print {
                    body { margin: 0; }
                    .flashcard-grid { padding: 10mm; }
                }
                
                /* 2-card layout overrides */
                ${twoCardCSS}
                /* 8-card layout overrides */
                @media print {
                    .flashcard-grid.eight-card {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        grid-template-rows: repeat(2, 1fr);
                        gap: 0.5cm;
                        padding: 1cm;
                        width: 100vw;
                        height: 100vh;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                    }
                    .flashcard.eight-card {
                        width: 100%;
                        height: 100%;
                        min-width: 0;
                        min-height: 0;
                        max-width: none;
                        max-height: none;
                        margin: 0;
                        box-sizing: border-box;
                        page-break-inside: avoid;
                        font-size: 1.8vw;
                        padding: 0.5cm;
                    }
                    .flashcard.eight-card .flashcard-imagebox {
                        width: 90%;
                        height: 60%;
                        min-height: 0;
                        max-height: none;
                        margin-bottom: 0.3cm;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        overflow: hidden;
                    }
                    .flashcard.eight-card .flashcard-imagebox img {
                        width: auto !important;
                        height: auto !important;
                        max-width: 100% !important;
                        max-height: 100% !important;
                        object-fit: contain !important;
                        min-width: 0 !important;
                        min-height: 0 !important;
                    }
                    .flashcard.eight-card .flashcard-image {
                        width: auto !important;
                        height: auto !important;
                        max-width: 100% !important;
                        max-height: 60% !important;
                        object-fit: contain !important;
                    }
                }
                /* 1-card layout overrides */
                ${oneCardCSS}
                /* 1x2 portrait layout overrides */
                ${oneX2PortraitCSS}
            </style>
        </head>
        <body>
            ${pageHTML}
            <script>
                window.addEventListener('afterprint', function() { 
                    setTimeout(() => window.close(), 200); 
                });
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    }, 200);
                };
            </script>
        </body>
        </html>
    `;
}

function getLayoutConfig(layoutType) {
    switch (layoutType) {
        case '1-card':
            return { columns: 1, cardHeight: 1000, gap: 0, cardsPerPage: 1, type: '1-card' };
        case '1x2-portrait':
            return { columns: 1, cardHeight: 950, gap: 0, cardsPerPage: 2, type: '1x2-portrait' };
        case '2-card':
            return { columns: 2, cardHeight: 95 * 11, gap: 20, cardsPerPage: 2, type: '2-card' };
        case '4-card':
            return { columns: 2, cardHeight: 500, gap: 15, cardsPerPage: 4, type: '4-card' };
        case '8-card':
            return { columns: 4, cardHeight: 250, gap: 10, cardsPerPage: 8, type: '8-card' };
        default:
            return { columns: 2, cardHeight: 500, gap: 15, cardsPerPage: 4, type: '4-card' };
    }
}

function generatePrintCardHTML(card, layout, printImageZoom) {
    let imageHTML;
    if (layout && layout.type === '2-card') {
        imageHTML = `
            <div class="flashcard-imagebox">
                ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.english}" style="width:${printImageZoom * 100}%; height:${printImageZoom * 100}%; object-fit:contain;" />` : '<div class="flashcard-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;">No image</div>'}
            </div>
        `;
    } else if (layout && layout.type === '1-card') {
        imageHTML = card.imageUrl ? 
            `<img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image" style="max-width:80vw; max-height:60vh; object-fit:contain; margin-bottom:20px;">` : 
            '<div class="flashcard-placeholder" style="min-height:200px;">No image</div>';
    } else if (layout && layout.type === '1x2-portrait') {
        imageHTML = card.imageUrl ? 
            `<div class="flashcard-imagebox" style="width:80%; aspect-ratio:1.414/1; background:#f8f8f8; display:flex; align-items:center; justify-content:center; border-radius:12px; margin-bottom:20px; overflow:hidden; min-height:280px;">
                <img src="${card.imageUrl}" alt="${card.english}" style="width:${printImageZoom * 100}%; height:${printImageZoom * 100}%; object-fit:contain; transition:width 0.2s,height 0.2s;" />
            </div>` : 
            '<div class="flashcard-imagebox" style="width:80%; aspect-ratio:1.414/1; background:#f8f8f8; display:flex; align-items:center; justify-content:center; border-radius:12px; margin-bottom:20px; overflow:hidden; min-height:280px;"><div class="flashcard-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:16px;">No image</div></div>';
    } else {
        imageHTML = card.imageUrl ? 
            `<img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image">` : 
            '<div class="flashcard-placeholder">No image</div>';
    }

    const textHTML = currentSettings.imageOnly ? '' : `
        <div class="flashcard-text">
            <div class="flashcard-english">${escapeHtml(card.english)}</div>
            ${currentSettings.showKorean && card.korean ? 
                `<div class="flashcard-korean">${escapeHtml(card.korean)}</div>` : 
                ''
            }
        </div>
    `;

    // For 2-card, 1-card, 1x2-portrait, or 8-card layout, add special class for print
    let className = 'flashcard';
    if (layout && layout.type === '2-card') {
        className += ' two-card';
    } else if (layout && layout.type === '1-card') {
        className += ' one-card';
    } else if (layout && layout.type === '1x2-portrait') {
        className += ' one-x2-portrait';
    } else if (layout && layout.type === '8-card') {
        className += ' eight-card';
    }

    return `
        <div class="${className}">
            ${imageHTML}
            ${textHTML}
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
