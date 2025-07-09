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

    // Responsive preview layouts: 2, 4, or 8 per page
    if (currentSettings.layout === '2-card') {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '2vw';
        grid.style.padding = '2vw';
    } else if (currentSettings.layout === '4-card') {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '1.5vw';
        grid.style.padding = '2vw';
    } else if (currentSettings.layout === '8-card') {
        grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '1vw';
        grid.style.padding = '2vw';
    } else {
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridAutoRows = '';
        grid.style.gap = '1.5vw';
        grid.style.padding = '2vw';
    }

    // Generate flashcard HTML with drag-and-drop support
    grid.innerHTML = flashcards.map((card, idx) => generateCardHTML(card, idx)).join('');
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
    // For 2-card mode, wrap image in a box with 6/8 aspect ratio
    let imageHTML;
    if (currentSettings.layout === '2-card') {
        // Image zoom: scale from 0.5 to 2 (default 1)
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
            <div class="flashcard-english">${escapeHtml(card.english)}</div>
            ${currentSettings.showKorean && card.korean ? 
                `<div class="flashcard-korean">${escapeHtml(card.korean)}</div>` : 
                ''
            }
        </div>
    `;

    // For preview: cards fill their grid cell, height is relative to container
    let style = `font-family: ${currentSettings.font}; font-size: ${currentSettings.fontSize}px; border: 2px solid #333; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: white; width: 100%; box-sizing: border-box;`;
    if (currentSettings.layout === '2-card') {
        // 10:5 ratio (taller than wide)
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

    const pageHTML = `
        <div class="flashcard-grid ${gridClass}">
            ${flashcards.map(card => generatePrintCardHTML(card, layout, printImageZoom)).join('')}
        </div>
    `;

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

    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${title}</title>
            <style>
                @page { size: A4 portrait; margin: 0; }
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

function generatePrintCardHTML(card, layout, printImageZoom) {
    let imageHTML;
    if (layout && layout.type === '2-card') {
        imageHTML = `
            <div class="flashcard-imagebox">
                ${card.imageUrl ? `<img src="${card.imageUrl}" alt="${card.english}" style="width:${printImageZoom * 100}%; height:${printImageZoom * 100}%; object-fit:contain;" />` : '<div class="flashcard-placeholder" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#aaa;font-size:14px;">No image</div>'}
            </div>
        `;
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

    // For 2-card layout, add special class for print
    let className = 'flashcard';
    if (layout && layout.type === '2-card') {
        className += ' two-card';
    }

    return `
        <div class="${className}">
            ${imageHTML}
            ${textHTML}
        </div>
    `;
}

function getLayoutConfig(layoutType) {
    switch (layoutType) {
        case '2-card':
            return { columns: 2, cardHeight: 95 * 11, gap: 20, cardsPerPage: 2, type: '2-card' }; // 95vh on A4 is about 1045px, but use 1045 for print
        case '4-card':
            return { columns: 2, cardHeight: 500, gap: 15, cardsPerPage: 4, type: '4-card' };
        case '8-card':
            return { columns: 4, cardHeight: 250, gap: 10, cardsPerPage: 8, type: '8-card' };
        default:
            return { columns: 2, cardHeight: 500, gap: 15, cardsPerPage: 4, type: '4-card' };
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
