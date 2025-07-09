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
                imageHTML = `
                    <div class="image-drop-zone" data-word="${card.english}" data-index="${index}" style="position: relative;">
                        <div class="drag-instructions">Drag & drop image here or click to cycle</div>
                        <img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image" style="height: 100%; width: 100%; object-fit: cover; cursor: pointer;" onclick="window.cycleCardImage?.(${index})">
                    </div>
                `;
            } else {
                imageHTML = `
                    <div class="image-drop-zone" data-word="${card.english}" data-index="${index}" style="position: relative;">
                        <div class="drag-instructions">Drag & drop image here or click to cycle</div>
                        <img src="${card.imageUrl}" alt="${card.english}" class="flashcard-image" style="cursor: pointer;" onclick="window.cycleCardImage?.(${index})">
                    </div>
                `;
            }
        } else {
            // Show loading spinner if image is being loaded, placeholder if not
            const imageManager = window.app?.imageManager;
            const isLoading = imageManager && imageManager.loadingImages && imageManager.loadingImages.has(card.english);
            
            if (isLoading) {
                imageHTML = `
                    <div class="image-drop-zone" data-word="${card.english}" data-index="${index}" style="position: relative;">
                        <div class="flashcard-loading" style="
                            width: 100%;
                            height: 120px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: #f8f9fa;
                            border-radius: 8px;
                            position: relative;
                        ">
                            <div class="loading-spinner" style="
                                width: 24px;
                                height: 24px;
                                border: 3px solid #e9ecef;
                                border-top: 3px solid #007bff;
                                border-radius: 50%;
                                animation: spin 1s linear infinite;
                            "></div>
                            <div style="position: absolute; bottom: 8px; font-size: 12px; color: #666;">
                                Loading ${card.english}...
                            </div>
                        </div>
                    </div>
                `;
            } else if (!settings.imageOnly) {
                imageHTML = `
                    <div class="image-drop-zone" data-word="${card.english}" data-index="${index}" style="position: relative;">
                        <div class="drag-instructions">Drag & drop image here</div>
                        <div class="flashcard-placeholder">No image</div>
                    </div>
                `;
            }
        }

        let textHTML = '';
        if (!settings.imageOnly) {
            textHTML = `
                <div class="flashcard-text">
                    <div class="flashcard-english">${this.escapeHtml(card.english)}</div>
                    ${settings.showKorean && card.korean ? `<div class="flashcard-korean">${this.escapeHtml(card.korean)}</div>` : ''}
                </div>
            `;
        }

        return `
            <div class="flashcard ${imageOnlyClass}" style="${style}">
                ${imageHTML}
                ${textHTML}
            </div>
        `;
    }

    applyCustomStyles(gridElement, settings, cardWidth, cardHeight) {
        const layout = this.layouts[settings.layout] || this.layouts['4-card'];
        
        // Remove any existing custom styles
        let styleId = 'flashcard-custom-styles';
        let existingStyle = document.getElementById(styleId);
        if (existingStyle) {
            existingStyle.remove();
        }

        // Create new custom styles
        const style = document.createElement('style');
        style.id = styleId;
        
        // Determine grid columns based on layout
        let columns = layout.columns;
        if (settings.layout === '2-card') columns = 1; // Stack vertically for printing
        if (settings.layout === '8-card') columns = 4;
        
        style.textContent = `
            .flashcard-grid.layout-${settings.layout} {
                grid-template-columns: repeat(${columns}, 1fr);
                gap: 20px;
                justify-items: center;
            }
            
            .flashcard-grid.layout-${settings.layout} .flashcard {
                width: ${cardWidth}px !important;
                height: ${cardHeight}px !important;
                font-family: ${settings.font} !important;
                font-size: ${settings.fontSize}px !important;
            }
            
            .flashcard-grid.layout-${settings.layout} .flashcard-image {
                ${settings.imageOnly ? `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                ` : `
                    width: 100%;
                    height: 120px;
                    object-fit: cover;
                `}
            }

            .flashcard-grid.layout-${settings.layout} .flashcard.image-only {
                padding: 0;
            }

            .flashcard-grid.layout-${settings.layout} .flashcard.image-only .flashcard-image {
                border-radius: 8px;
            }

            @media print {
                .flashcard-grid.layout-${settings.layout} {
                    ${settings.layout === '2-card' ? 'grid-template-columns: 1fr 1fr;' : ''}
                    gap: 10px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
