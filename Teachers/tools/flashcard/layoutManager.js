export class LayoutManager {
    constructor() {
        this.layouts = {
            '2-card': { columns: 2, cardWidth: 250, cardHeight: 200 },
            '4-card': { columns: 2, cardWidth: 200, cardHeight: 180 },
            '8-card': { columns: 4, cardWidth: 150, cardHeight: 160 }
        };
    }

    updateLayout(gridElement, cards, settings) {
        if (!gridElement || !cards || cards.length === 0) return;

        const layout = this.layouts[settings.layout] || this.layouts['4-card'];
        
        // Apply layout classes
        gridElement.className = `flashcard-grid layout-${settings.layout}`;
        
        // Calculate card dimensions based on settings
        const baseCardSize = layout.cardWidth;
        const sizeMultiplier = settings.cardSize / 200; // 200 is the default slider value
        const cardWidth = Math.round(baseCardSize * sizeMultiplier);
        const cardHeight = Math.round(layout.cardHeight * sizeMultiplier);

        // Generate cards HTML
        gridElement.innerHTML = cards.map((card, index) => 
            this.generateCardHTML(card, index, settings, cardWidth, cardHeight)
        ).join('');

        // Apply custom CSS for responsive sizing
        this.applyCustomStyles(gridElement, settings, cardWidth, cardHeight);
    }

    generateCardHTML(card, index, settings, cardWidth, cardHeight) {
        const imageOnlyClass = settings.imageOnly ? 'image-only' : '';
        const style = `width: ${cardWidth}px; height: ${cardHeight}px; font-family: ${settings.font}; font-size: ${settings.fontSize}px;`;
        
        let imageHTML = '';
        if (card.imageUrl) {
            if (settings.imageOnly) {
                imageHTML = `<img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image" style="height: 100%; width: 100%; object-fit: cover;">`;
            } else {
                imageHTML = `<img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image">`;
            }
        } else {
            if (!settings.imageOnly) {
                imageHTML = `<div class="flashcard-placeholder">📷 No image</div>`;
            }
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
            <div class="flashcard ${imageOnlyClass}" 
                 data-card-index="${index}" 
                 style="${style}">
                <div class="image-drop-hint">Drop image here</div>
                ${imageHTML}
                ${textHTML}
            </div>
        `;
    }

    applyCustomStyles(gridElement, settings, cardWidth, cardHeight) {
        // Remove any existing custom style element
        const existingStyle = document.getElementById('flashcard-custom-styles');
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new style element
        const style = document.createElement('style');
        style.id = 'flashcard-custom-styles';
        
        const layout = this.layouts[settings.layout] || this.layouts['4-card'];
        const gap = Math.max(10, Math.round(cardWidth * 0.08)); // Responsive gap
        
        style.textContent = `
            .flashcard-grid.layout-${settings.layout} {
                grid-template-columns: repeat(${layout.columns}, ${cardWidth}px);
                gap: ${gap}px;
                justify-content: center;
            }
            
            .flashcard-grid .flashcard {
                width: ${cardWidth}px !important;
                height: ${cardHeight}px !important;
            }
            
            .flashcard-grid .flashcard-image {
                max-height: ${settings.imageOnly ? '100%' : Math.round(cardHeight * 0.6)}px;
            }
            
            .flashcard-grid .flashcard-english {
                font-size: ${settings.fontSize}px;
            }
            
            .flashcard-grid .flashcard-korean {
                font-size: ${Math.round(settings.fontSize * 0.85)}px;
            }
        `;
        
        document.head.appendChild(style);
    }

    // Get layout configuration for print
    getLayoutConfig(layoutType) {
        return this.layouts[layoutType] || this.layouts['4-card'];
    }

    // Calculate optimal grid size for given container
    calculateOptimalLayout(containerWidth, containerHeight, cardCount, aspectRatio = 1.2) {
        const layouts = [];
        
        // Try different column configurations
        for (let cols = 1; cols <= Math.min(8, cardCount); cols++) {
            const rows = Math.ceil(cardCount / cols);
            const cardWidth = (containerWidth - (cols - 1) * 20) / cols; // 20px gap
            const cardHeight = cardWidth * aspectRatio;
            const totalHeight = rows * cardHeight + (rows - 1) * 20;
            
            if (totalHeight <= containerHeight && cardWidth >= 100) {
                layouts.push({
                    columns: cols,
                    rows: rows,
                    cardWidth: Math.floor(cardWidth),
                    cardHeight: Math.floor(cardHeight),
                    totalHeight: totalHeight,
                    efficiency: (cardCount / (cols * rows)) * (cardWidth / 300) // Preference for larger cards
                });
            }
        }
        
        // Return layout with best efficiency
        return layouts.sort((a, b) => b.efficiency - a.efficiency)[0];
    }

    // Generate print-optimized layout
    generatePrintLayout(cards, settings) {
        const layout = this.getLayoutConfig(settings.layout);
        const cardsPerPage = this.getCardsPerPage(settings.layout);
        const pages = [];
        
        for (let i = 0; i < cards.length; i += cardsPerPage) {
            const pageCards = cards.slice(i, i + cardsPerPage);
            pages.push({
                cards: pageCards,
                startIndex: i
            });
        }
        
        return pages;
    }

    getCardsPerPage(layoutType) {
        switch (layoutType) {
            case '2-card': return 2;
            case '4-card': return 4;
            case '8-card': return 8;
            default: return 4;
        }
    }

    // Create layout selector options
    getLayoutOptions() {
        return [
            { value: '2-card', label: '2 Card Mode (Landscape)', description: '2 large cards side by side' },
            { value: '4-card', label: '4 Card Mode (Portrait)', description: '2x2 grid of medium cards' },
            { value: '8-card', label: '8 Card Mode (Portrait)', description: '4x2 grid of small cards' }
        ];
    }

    // Validate layout settings
    validateLayoutSettings(settings) {
        const errors = [];
        
        if (!this.layouts[settings.layout]) {
            errors.push('Invalid layout type');
        }
        
        if (settings.cardSize < 50 || settings.cardSize > 500) {
            errors.push('Card size must be between 50 and 500');
        }
        
        if (settings.fontSize < 6 || settings.fontSize > 72) {
            errors.push('Font size must be between 6 and 72');
        }
        
        return errors;
    }

    // Get recommended layout for card count
    getRecommendedLayout(cardCount) {
        if (cardCount <= 2) return '2-card';
        if (cardCount <= 4) return '4-card';
        return '8-card';
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Get layout dimensions for external use
    getLayoutDimensions(layoutType, cardSize = 200) {
        const layout = this.layouts[layoutType] || this.layouts['4-card'];
        const sizeMultiplier = cardSize / 200;
        
        return {
            columns: layout.columns,
            cardWidth: Math.round(layout.cardWidth * sizeMultiplier),
            cardHeight: Math.round(layout.cardHeight * sizeMultiplier),
            gap: Math.max(10, Math.round(layout.cardWidth * sizeMultiplier * 0.08))
        };
    }

    // Create responsive breakpoints
    createResponsiveRules(settings) {
        const layout = this.layouts[settings.layout];
        const baseCardWidth = layout.cardWidth * (settings.cardSize / 200);
        
        return {
            desktop: {
                minWidth: '1200px',
                columns: layout.columns,
                cardWidth: baseCardWidth
            },
            tablet: {
                maxWidth: '1199px',
                minWidth: '768px',
                columns: Math.max(2, layout.columns - 1),
                cardWidth: baseCardWidth * 0.9
            },
            mobile: {
                maxWidth: '767px',
                columns: Math.min(2, layout.columns),
                cardWidth: baseCardWidth * 0.8
            }
        };
    }
}
