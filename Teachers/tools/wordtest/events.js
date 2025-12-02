// events.js - Event handling functions for wordtest

export function setupEventListeners(
    updateFont,
    updateFontSize, 
    updateLayout,
    updateImageGap,
    updateImageSize,
    decreaseFontSize,
    increaseFontSize,
    highlightDuplicates,
    updatePreview,
    clearAllImages,
    refreshImages
) {
    // Font controls
    const fontSelect = document.getElementById('fontSelect');
    const fontSizeInput = document.getElementById('fontSizeInput');
    const layoutSelect = document.getElementById('layoutSelect');
    
    if (fontSelect) {
        fontSelect.addEventListener('change', updateFont);
    }
    
    if (fontSizeInput) {
        fontSizeInput.addEventListener('change', updateFontSize);
    }
    
    if (layoutSelect) {
        layoutSelect.addEventListener('change', updateLayout);
    }
    
    // Image controls
    const imageGapSlider = document.getElementById('imageGapSlider');
    const imageSizeSlider = document.getElementById('imageSizeSlider');
    
    if (imageGapSlider) {
        imageGapSlider.addEventListener('input', updateImageGap);
        imageGapSlider.addEventListener('change', updateImageGap);
    }
    
    if (imageSizeSlider) {
        imageSizeSlider.addEventListener('input', updateImageSize);
        imageSizeSlider.addEventListener('change', updateImageSize);
    }
    
    // Font size buttons
    const decreaseFontBtn = document.getElementById('decreaseFontBtn');
    const increaseFontBtn = document.getElementById('increaseFontBtn');
    
    if (decreaseFontBtn) {
        decreaseFontBtn.addEventListener('click', decreaseFontSize);
    }
    
    if (increaseFontBtn) {
        increaseFontBtn.addEventListener('click', increaseFontSize);
    }
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async (e) => {
            // If Shift is held, clear all images completely.
            if (e.shiftKey) {
                return clearAllImages(updatePreview);
            }
            // Prefer refreshing only failed images first
            try {
                const { refreshFailedImages } = await import('./images.js');
                const refreshed = await refreshFailedImages(updatePreview);
                if (!refreshed || refreshed === 0) {
                    // If none were failed, fall back to fetching more alternatives
                    await refreshImages(updatePreview);
                }
            } catch (_) {
                // Fallback path
                refreshImages(updatePreview);
            }
        });
    }
    
    // Word list textarea
    const wordListTextarea = document.getElementById('wordListTextarea');
    if (wordListTextarea) {
        wordListTextarea.addEventListener('input', highlightDuplicates);
        wordListTextarea.addEventListener('paste', () => {
            setTimeout(highlightDuplicates, 100);
        });
    }
    
    // Save/Load buttons
    const saveBtn = document.getElementById('saveBtn');
    const loadBtn = document.getElementById('loadBtn');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            window.open('/Teachers/worksheet_manager.html?mode=save', 'WorksheetManager', 'width=1200,height=700,resizable=yes,scrollbars=yes');
        });
    }
    
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            window.open('/Teachers/worksheet_manager.html?mode=load', 'WorksheetManager', 'width=1200,height=700,resizable=yes,scrollbars=yes');
        });
    }
}

export function setupAIEventListeners(extractWordsWithAI, updatePreview) {
    const aiButton = document.getElementById('aiExtractBtn');
    const passageInput = document.getElementById('passageInput');
    
    if (aiButton && passageInput) {
        aiButton.addEventListener('click', async function() {
            const passage = passageInput.value.trim();
            if (!passage) {
                alert('Please enter some text first');
                return;
            }
            
            try {
                aiButton.disabled = true;
                aiButton.textContent = 'Extracting...';
                
                const words = await extractWordsWithAI(passage);
                if (words && words.length > 0) {
                    const wordListTextarea = document.getElementById('wordListTextarea');
                    if (wordListTextarea) {
                        const formattedWords = words.map(word => `${word.eng}, ${word.kor}`).join('\n');
                        wordListTextarea.value = formattedWords;
                        updatePreview();
                    }
                }
            } catch (error) {
                console.error('Error extracting words:', error);
                alert('Error extracting words. Please try again.');
            } finally {
                aiButton.disabled = false;
                aiButton.textContent = 'Extract Words with AI';
            }
        });
    }
}
