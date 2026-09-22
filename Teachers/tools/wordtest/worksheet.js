// worksheet.js - Worksheet data management functions
import { cleanWord } from './utils.js?v=20260923-imgstate2';
// Pull current image choices from the images module for robust saving of auto-filled images
import { imageAlternatives, currentImageIndex } from './images.js?v=20260923-imgstate2';

export function highlightDuplicates() {
    const wordsTextarea = document.getElementById('wordListTextarea');
    if (!wordsTextarea) return;
    
    const words = wordsTextarea.value.trim();
    
    if (!words) {
        const duplicateWarning = document.getElementById('duplicateWarning');
        if (duplicateWarning) {
            duplicateWarning.style.display = 'none';
        }
        return;
    }
    
    const lines = words.split('\n').filter(line => line.trim());
    const englishWords = {};
    const duplicates = new Set();
    
    // Find duplicates
    lines.forEach((line, index) => {
        const [eng] = line.split(',').map(w => w?.trim());
        if (eng) {
            const lowerEng = eng.toLowerCase();
            if (englishWords[lowerEng]) {
                duplicates.add(lowerEng);
                duplicates.add(englishWords[lowerEng].word.toLowerCase());
            } else {
                englishWords[lowerEng] = { word: eng, index };
            }
        }
    });
    
    // Show duplicate warning if any found
    const duplicateWarning = document.getElementById('duplicateWarning');
    if (duplicates.size > 0) {
        const duplicateList = Array.from(duplicates).join(', ');
        if (duplicateWarning) {
            duplicateWarning.innerHTML = `⚠️ Duplicate words found: <strong>${duplicateList}</strong>`;
            duplicateWarning.style.display = 'block';
        }
    } else {
        if (duplicateWarning) {
            duplicateWarning.style.display = 'none';
        }
    }
}

export function getCurrentWorksheetData(currentWords, currentSettings) {
    // Collect all relevant worksheet data for saving
    const title = document.getElementById('titleInput')?.value || '';
    const passage = document.getElementById('passageInput')?.value || '';
    const words = (currentWords && Array.isArray(currentWords))
        ? currentWords.map(w => `${w.eng}, ${w.kor}`)
        : (document.getElementById('wordListTextarea')?.value || '').split('\n').filter(w => w.trim());
    
    // Capture the authoritative image state. Preserve R2 metadata when present.
    const imageData = {};
    const wordsArr = Array.isArray(currentWords) ? currentWords : [];
    for (let i = 0; i < wordsArr.length; i++) {
        const eng = (wordsArr[i]?.eng || wordsArr[i]?._originalEng || '').trim();
        if (!eng) continue;
        const key = `${eng.toLowerCase()}_${i}`;
        const saved = window.savedImageData && window.savedImageData[key];
        if (saved && saved.src && saved.src !== 'emoji' && !saved.emoji) {
            imageData[key] = { ...saved, word: eng, index: i };
        }
    }

    // DOM is a fallback only. It may reflect a freshly dropped/selected image before state settles.
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
        previewArea.querySelectorAll('.image-drop-zone').forEach(zone => {
            const word = zone.getAttribute('data-word');
            const dataIndex = zone.getAttribute('data-index');
            const img = zone.querySelector('img');
            if (!word || dataIndex === null || !img || !img.src) return;
            const key = `${word.toLowerCase()}_${dataIndex}`;
            if (!imageData[key] || imageData[key].src !== img.src) {
                imageData[key] = { src: img.src, word, index: parseInt(dataIndex) };
            }
        });
    }

    // Only save worksheet_type, title, passage_text, words, layout, settings, and imageData
    // settings: font, fontSize, imageSize, imageGap, testMode, numLettersToHide, difficulty
    const settings = {
        font: currentSettings.font,
        fontSize: currentSettings.fontSize,
        imageSize: currentSettings.imageSize,
        imageGap: currentSettings.imageGap,
        testMode: currentSettings.testMode,
        numLettersToHide: currentSettings.numLettersToHide,
        difficulty: document.getElementById('difficultySelect')?.value || ''
    };

    const worksheetData = {
        worksheet_type: 'wordtest',
        title,
        passage_text: passage,
        words,
        layout: currentSettings.layout,
        settings: JSON.stringify(settings),
        images: JSON.stringify(imageData)
    };

    // Include user_id if this worksheet was loaded from database (for updates)
    if (window._currentWorksheetId) {
        worksheetData.user_id = window._currentWorksheetId;
    }

    return worksheetData;
}

export function loadWorksheet(worksheet, currentWords, currentSettings) {
    if (!worksheet) return null;
    
    // Store worksheet user_id for updates
    window._currentWorksheetId = worksheet.user_id || null;
    // Store lightweight metadata for auto-fill in save dialog
    window._loadedWorksheetMeta = {
        title: worksheet.title || '',
        book: worksheet.book || '',
        unit: worksheet.unit || '',
        language_point: worksheet.language_point || '',
        notes: worksheet.notes || ''
    };
    
    // Defensive: support both array and string for words
    let wordsArr = [];
    if (Array.isArray(worksheet.words)) {
        wordsArr = worksheet.words;
    } else if (typeof worksheet.words === 'string') {
        wordsArr = worksheet.words.split('\n').filter(w => w.trim());
    }
    // Populate title, passage and words
    if (document.getElementById('titleInput')) document.getElementById('titleInput').value = worksheet.title || '';
    if (document.getElementById('passageInput')) document.getElementById('passageInput').value = worksheet.passage_text || '';
    if (document.getElementById('wordListTextarea')) document.getElementById('wordListTextarea').value = wordsArr.join('\n');

    // Restore difficulty selection if present
    const diffEl = document.getElementById('difficultySelect');
    if (diffEl) {
        const value = worksheet.difficulty || '';
        if (value) {
            if (!Array.from(diffEl.options).some(opt => opt.value === value)) {
                const opt = document.createElement('option');
                opt.value = value;
                opt.textContent = value;
                diffEl.appendChild(opt);
            }
            diffEl.value = value;
        }
    }

    // Restore settings from worksheet.settings (JSON string)
    let settings = {};
    if (worksheet.settings) {
        try {
            settings = typeof worksheet.settings === 'string' ? JSON.parse(worksheet.settings) : worksheet.settings;
        } catch (e) {
            settings = {};
        }
    }
    
    // Restore image data from worksheet.images (JSON string)
    let imageData = {};
    if (worksheet.images) {
        try {
            imageData = typeof worksheet.images === 'string' ? JSON.parse(worksheet.images) : worksheet.images;
            if (imageData && typeof imageData === 'object') {
                imageData = Object.fromEntries(
                    Object.entries(imageData).filter(([, value]) => value && value.src !== 'emoji' && !value.emoji)
                );
            }
        } catch (e) {
            console.warn('Failed to parse image data:', e);
            imageData = {};
        }
    }
    
    // Store image data for later restoration
    window.savedImageData = imageData;
    
    // Restore font
    if (settings.font && document.getElementById('fontSelect')) {
        document.getElementById('fontSelect').value = settings.font;
        currentSettings.font = settings.font;
    }
    
    // Restore font size
    if (settings.fontSize && document.getElementById('fontSizeInput')) {
        document.getElementById('fontSizeInput').value = settings.fontSize;
        currentSettings.fontSize = settings.fontSize;
    }
    
    // Restore image size
    if (settings.imageSize && document.getElementById('imageSizeSlider')) {
        document.getElementById('imageSizeSlider').value = settings.imageSize;
        currentSettings.imageSize = settings.imageSize;
    }
    
    // Restore image gap
    if (settings.imageGap && document.getElementById('imageGapSlider')) {
        document.getElementById('imageGapSlider').value = settings.imageGap;
        currentSettings.imageGap = settings.imageGap;
    }
    
    // Restore test mode
    if (settings.testMode && document.getElementById('testModeSelect')) {
        document.getElementById('testModeSelect').value = settings.testMode;
        currentSettings.testMode = settings.testMode;
        
        // Handle numLettersToHide input visibility
        let numLettersInput = document.getElementById('numLettersToHide');
        if (settings.testMode === 'hide-random-letters') {
            if (!numLettersInput) {
                numLettersInput = document.createElement('input');
                numLettersInput.type = 'number';
                numLettersInput.id = 'numLettersToHide';
                numLettersInput.min = 1;
                numLettersInput.max = 10;
                numLettersInput.style.marginLeft = '8px';
                numLettersInput.style.width = '40px';
                document.getElementById('testModeSelect').parentNode.appendChild(numLettersInput);
                numLettersInput.addEventListener('input', function() {
                    currentSettings.numLettersToHide = parseInt(numLettersInput.value) || 1;
                    // We need access to updatePreview but can't call it from here
                    // This will be handled by the main file
                });
            }
            numLettersInput.value = settings.numLettersToHide || 1;
            currentSettings.numLettersToHide = settings.numLettersToHide || 1;
            numLettersInput.style.display = '';
        } else if (numLettersInput) {
            numLettersInput.style.display = 'none';
        }
    }
    
    // Restore layout
    if (worksheet.layout && document.getElementById('layoutSelect')) {
        document.getElementById('layoutSelect').value = worksheet.layout;
        currentSettings.layout = worksheet.layout;
    }
    
    return { currentWords, currentSettings };
}

export function updateCurrentWordsFromTextarea() {
    const wordsText = document.getElementById('wordListTextarea').value.trim();
    console.log('Updating words from textarea:', wordsText);
    
    if (!wordsText) {
        return [];
    }
    
    const lines = wordsText.split('\n').filter(line => line.trim());
    console.log('Lines found:', lines);
    
    return lines.map(line => {
        if (line.includes(',')) {
            let [eng, kor] = line.split(',').map(w => w?.trim());
            eng = cleanWord(eng);
            return { eng: eng || '', kor: kor || '' };
        } else {
            // Handle single words by duplicating them
            let word = cleanWord(line.trim());
            return { eng: word, kor: word };
        }
    }).filter(word => word.eng && !/^\d+$/.test(word.eng));
}
