export class PrintManager {
    constructor() {
        this.printWindowFeatures = 'width=800,height=600,scrollbars=yes,resizable=yes';
    }

    printFlashcards(cards, settings) {
        if (!cards || cards.length === 0) {
            alert('No flashcards to print.');
            return;
        }

        const printWindow = window.open('', 'PrintWindow', this.printWindowFeatures);
        if (!printWindow) {
            alert('Pop-up blocked. Please allow pop-ups for this site.');
            return;
        }

        // Inject a script to auto-close after printing
        const printContent = this.generatePrintHTML(cards, settings).replace(
            /<\/body>/i,
            `<script>
                window.addEventListener('afterprint', function() { setTimeout(() => window.close(), 200); });
                // Fallback for browsers that don't fire afterprint
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                  }, 200);
                };
            <\/script></body>`
        );

        printWindow.document.write(printContent);
        printWindow.document.close();
    }

    exportToPDF(cards, settings) {
        // For PDF export, we'll use the same print functionality
        // The user can choose "Save as PDF" in the print dialog
        this.printFlashcards(cards, settings);
    }

    generatePrintHTML(cards, settings) {
        const title = settings.title || 'Flashcards';
        const layout = this.getLayoutConfig(settings.layout);
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${title}</title>
                <style>
                    ${this.getPrintStyles(settings, layout)}
                </style>
            </head>
            <body>
                <div class="print-container">
                    ${this.generatePrintHeader(title)}
                    ${this.generatePrintContent(cards, settings, layout)}
                </div>
            </body>
            </html>
        `;
    }

    getPrintStyles(settings, layout) {
        // Special case for 2-card layout: 2 cards per page, each covers half the page
        if (settings.layout === '2-card') {
            return `
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                html, body {
                    width: 100vw;
                    height: 100vh;
                    background: white;
                }
                .print-container {
                    width: 100vw;
                    height: 100vh;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                }
                .flashcard-grid {
                    display: flex;
                    flex-direction: column;
                    width: 100vw;
                    height: 100vh;
                }
                .flashcard {
                    flex: 1 1 50%;
                    width: 100vw;
                    height: 50vh;
                    box-sizing: border-box;
                    border: 2px solid #222;
                    border-radius: 0;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: white;
                    page-break-inside: avoid;
                }
                .flashcard-image {
                    max-width: 90%;
                    max-height: 60%;
                    object-fit: contain;
                    margin-bottom: 8px;
                }
                .flashcard-text {
                    width: 100%;
                    text-align: center;
                }
                .flashcard-english {
                    font-size: 2.5vw;
                    font-weight: 600;
                    color: #222;
                    margin-bottom: 4px;
                }
                .flashcard-korean {
                    font-size: 2vw;
                    color: #666;
                }
                .flashcard-placeholder {
                    width: 100%;
                    height: 80px;
                    background: #f0f0f0;
                    border: 2px dashed #ccc;
                    border-radius: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    font-size: 18px;
                    margin-bottom: 8px;
                }
                .page-break {
                    page-break-before: always;
                }
            `;
        }
        // Default for other layouts
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: ${settings.font || 'Poppins'}, sans-serif;
                font-size: ${settings.fontSize || 18}px;
                line-height: 1.4;
                color: #333;
                background: white;
            }
            
            .print-container {
                max-width: 210mm;
                margin: 0 auto;
                padding: 15mm;
            }
            
            .print-header {
                text-align: center;
                margin-bottom: 20px;
                padding-bottom: 10px;
                border-bottom: 2px solid #333;
            }
            
            .print-header h1 {
                font-size: 24px;
                font-weight: 600;
                margin-bottom: 5px;
            }
            
            .print-header .subtitle {
                font-size: 14px;
                color: #666;
            }
            
            .flashcard-grid {
                display: grid;
                grid-template-columns: repeat(${layout.columns}, 1fr);
                gap: ${layout.gap}px;
                margin-top: 20px;
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
            
            .flashcard-image {
                max-width: 100%;
                max-height: ${settings.imageOnly ? '100%' : '60%'};
                object-fit: contain;
                border-radius: 4px;
                margin-bottom: ${settings.imageOnly ? '0' : '8px'};
            }
            
            .flashcard-text {
                width: 100%;
                ${settings.imageOnly ? 'display: none;' : ''}
            }
            
            .flashcard-english {
                font-size: ${settings.fontSize}px;
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
            }
            
            .flashcard-korean {
                font-size: ${Math.round(settings.fontSize * 0.85)}px;
                color: #666;
                ${settings.showKorean ? '' : 'display: none;'}
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
            
            .page-break {
                page-break-before: always;
            }
            
            .name-date-line {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
                display: flex;
                justify-content: space-between;
                font-size: 14px;
                color: #666;
            }
            
            .name-date-line div {
                border-bottom: 1px solid #333;
                padding-bottom: 2px;
                min-width: 150px;
            }
            
            @media print {
                .print-container {
                    max-width: 100%;
                    padding: 10mm;
                }
                
                .flashcard {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                
                .flashcard-image {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
            }
        `;
    }

    getLayoutConfig(layoutType) {
        switch (layoutType) {
            case '2-card':
                return { columns: 2, cardHeight: 250, gap: 20, cardsPerPage: 2 };
            case '4-card':
                return { columns: 2, cardHeight: 200, gap: 15, cardsPerPage: 4 };
            case '8-card':
                return { columns: 4, cardHeight: 160, gap: 10, cardsPerPage: 8 };
            default:
                return { columns: 2, cardHeight: 200, gap: 15, cardsPerPage: 4 };
        }
    }

    generatePrintHeader(title) {
        // Remove all print header/title/subtitle for print view
        return '';
    }

    generatePrintContent(cards, settings, layout) {
        const cardsPerPage = layout.cardsPerPage;
        const pages = [];
        
        // Split cards into pages
        for (let i = 0; i < cards.length; i += cardsPerPage) {
            const pageCards = cards.slice(i, i + cardsPerPage);
            pages.push(pageCards);
        }
        
        return pages.map((pageCards, pageIndex) => {
            const pageBreak = pageIndex > 0 ? 'page-break' : '';
            return `
                <div class="${pageBreak}">
                    <div class="flashcard-grid">
                        ${pageCards.map(card => this.generatePrintCard(card, settings)).join('')}
                    </div>
                    ${this.generateNameDateLine()}
                </div>
            `;
        }).join('');
    }

    generatePrintCard(card, settings) {
        let imageHTML = '';
        if (card.imageUrl) {
            if (settings.imageOnly) {
                imageHTML = `<img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image" style="height: 100%; width: 100%; object-fit: cover;">`;
            } else {
                imageHTML = `<img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image">`;
            }
        } else if (!settings.imageOnly) {
            imageHTML = `<div class="flashcard-placeholder">No image</div>`;
        }

        let textHTML = '';
        if (!settings.imageOnly) {
            textHTML = `
                <div class="flashcard-text">
                    <div class="flashcard-english">${this.escapeHtml(card.english)}</div>
                    ${settings.showKorean && card.korean ? 
                        `<div class="flashcard-korean">${this.escapeHtml(card.korean)}</div>` : 
                        ''
                    }
                </div>
            `;
        }

        return `
            <div class="flashcard">
                ${imageHTML}
                ${textHTML}
            </div>
        `;
    }

    generateNameDateLine() {
        // Remove name/date line for print view
        return '';
    }

    waitForImages(printWindow) {
        return new Promise((resolve) => {
            const images = printWindow.document.querySelectorAll('img');
            if (images.length === 0) {
                resolve();
                return;
            }

            let loadedCount = 0;
            const checkComplete = () => {
                loadedCount++;
                if (loadedCount === images.length) {
                    setTimeout(resolve, 100); // Small delay to ensure rendering
                }
            };

            images.forEach(img => {
                if (img.complete) {
                    checkComplete();
                } else {
                    img.onload = checkComplete;
                    img.onerror = checkComplete;
                }
            });

            // Fallback timeout
            setTimeout(resolve, 3000);
        });
    }

    // Create a study version (without answers)
    printStudyVersion(cards, settings) {
        const studySettings = {
            ...settings,
            showKorean: false,
            imageOnly: false
        };

        this.printFlashcards(cards, studySettings);
    }

    // Create answer key
    printAnswerKey(cards, settings) {
        const answerSettings = {
            ...settings,
            showKorean: true,
            imageOnly: false
        };

        this.printFlashcards(cards, answerSettings);
    }

    // Print individual cards (large format)
    printLargeCards(cards, settings) {
        const largeSettings = {
            ...settings,
            layout: '2-card',
            fontSize: Math.round(settings.fontSize * 1.5)
        };

        this.printFlashcards(cards, largeSettings);
    }

    // Print blank template
    printBlankTemplate(count = 8, settings) {
        const blankCards = Array(count).fill(null).map((_, index) => ({
            english: '',
            korean: '',
            imageUrl: null
        }));

        this.printFlashcards(blankCards, settings);
    }

    // Generate PDF blob for programmatic use
    async generatePDFBlob(cards, settings) {
        // This would require a PDF library like jsPDF
        // For now, we'll return the HTML content
        return new Blob([this.generatePrintHTML(cards, settings)], { type: 'text/html' });
    }

    // Export to various formats
    exportToCSV(cards, settings) {
        const csvContent = [
            ['English', 'Korean', 'Has Image'].join(','),
            ...cards.map(card => [
                `"${card.english}"`,
                `"${card.korean || ''}"`,
                card.imageUrl ? 'Yes' : 'No'
            ].join(','))
        ].join('\n');

        this.downloadFile(csvContent, 'flashcards.csv', 'text/csv');
    }

    exportToTXT(cards, settings) {
        const txtContent = cards.map(card => {
            let line = card.english;
            if (card.korean) {
                line += ` - ${card.korean}`;
            }
            if (card.imageUrl) {
                line += ' [Image]';
            }
            return line;
        }).join('\n');

        this.downloadFile(txtContent, 'flashcards.txt', 'text/plain');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Print preview functionality
    showPrintPreview(cards, settings) {
        const previewWindow = window.open('', 'PrintPreview', this.printWindowFeatures);
        if (!previewWindow) {
            alert('Pop-up blocked. Please allow pop-ups for this site.');
            return;
        }

        const previewContent = this.generatePrintHTML(cards, settings);
        previewWindow.document.write(previewContent);
        previewWindow.document.close();
    }

    // Get print statistics
    getPrintStats(cards, settings) {
        const layout = this.getLayoutConfig(settings.layout);
        const pagesNeeded = Math.ceil(cards.length / layout.cardsPerPage);
        const cardsWithImages = cards.filter(card => card.imageUrl).length;
        const cardsWithoutImages = cards.length - cardsWithImages;

        return {
            totalCards: cards.length,
            pagesNeeded,
            cardsPerPage: layout.cardsPerPage,
            cardsWithImages,
            cardsWithoutImages,
            layout: settings.layout,
            estimatedPrintTime: Math.ceil(pagesNeeded * 0.5) // minutes
        };
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
