// Word Worksheet Generator JavaScript - Main Controller
// Import modules
import { extractWordsWithAI } from './ai.js';
import { 
    getImageUrl, 
    cycleImage, 
    renderImage, 
    refreshImages, 
    clearAllImages,
    refreshImageForWord,
    enableImageDragAndDrop,
    initializeImageModule
} from './images.js';

// Fallback functions that will be overridden if imports work
let maskWordPairs = function(wordPairs, testMode, numLettersToHide = 1) {
    if (testMode === "none") return wordPairs;
    return wordPairs.map(pair => {
        if (testMode === "hide-eng") {
            return { ...pair, eng: "" };
        } else if (testMode === "hide-kor") {
            return { ...pair, kor: "" };
        }
        return pair;
    });
};

// Enhanced hide random letters function
let hideRandomLetters = function(word, numLettersToHide = 1) {
    if (!word || word.length < 2) return word;
    
    // Get all letter positions (excluding first letter and non-letters)
    const letterPositions = [];
    for (let i = 1; i < word.length; i++) {
        if (/[a-zA-Z]/.test(word[i])) {
            letterPositions.push(i);
        }
    }
    
    // If not enough letters to hide, hide all available
    const actualHideCount = Math.min(numLettersToHide, letterPositions.length);
    
    // Randomly select positions to hide
    const positionsToHide = [];
    const shuffled = [...letterPositions].sort(() => Math.random() - 0.5);
    for (let i = 0; i < actualHideCount; i++) {
        positionsToHide.push(shuffled[i]);
    }
    
    // Replace selected positions with underscores
    return word.split('').map((char, i) => {
        if (positionsToHide.includes(i)) {
            return '_';
        }
        return char;
    }).join('');
};

// Try to import the proper functions
async function loadModules() {
    try {
        const worksheetModule = await import('../tests/worksheet.js');
        maskWordPairs = worksheetModule.maskWordPairs;
        hideRandomLetters = worksheetModule.hideRandomLetters;
        console.log('Worksheet module loaded successfully');
    } catch (error) {
        console.warn('Could not import worksheet.js, using fallback functions');
    }
    
    try {
        const imageModule = await import('../tests/images.js');
        initializeImageModule(imageModule.getPixabayImage, imageModule.imageCache);
        console.log('Images module loaded successfully');
    } catch (error) {
        console.warn('Could not import images.js, using placeholder images');
    }
}

// Global variables
let currentWords = [];
let currentSettings = {
    font: 'Arial',
    fontSize: 15,
    design: 'Design 1',
    layout: 'default',
    imageGap: 25,
    imageSize: 50,
    testMode: 'none', // 'none', 'hide-eng', 'hide-kor', 'hide-random-letters'
    numLettersToHide: 1
};

// Make cycleImage available globally for onclick handlers
window.cycleImage = (word, index) => cycleImage(word, index, updatePreview);

// Right-click image handler removed - no longer loads 5 more images on right-click

// Duplicate detection function
function highlightDuplicates() {
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

// --- Undo stack for worksheet edits ---
let worksheetUndoStack = [];

function pushWorksheetUndo() {
    // Save a deep copy of currentWords
    worksheetUndoStack.push(JSON.parse(JSON.stringify(currentWords)));
    // Limit stack size
    if (worksheetUndoStack.length > 50) worksheetUndoStack.shift();
}

function undoWorksheetEdit() {
    if (worksheetUndoStack.length > 0) {
        currentWords = worksheetUndoStack.pop();
        document.getElementById('wordListTextarea').value = currentWords.map(word => `${word.eng}, ${word.kor}`).join('\n');
        updatePreview();
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    await loadModules(); // Load modules first
    initializeEventListeners();
    makeDraggable();

    // --- FORCE ARIAL FONT FOR TEST MODE CONTROLS ---
    // This will override any global or parent font-family (e.g. Poppins)
    const style = document.createElement('style');
    style.innerHTML = `
        #testModeSelect, #numLettersToHide {
            font-family: Arial !important;
            font-size: 12px !important;
            padding: 2px 6px !important;
            height: 26px !important;
            box-sizing: border-box;
        }
        .image-loading-spinner {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 40px;
            height: 40px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            z-index: 10;
        }
        .image-loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 8px;
            z-index: 9;
        }
        @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
        }
        
        /* Enhanced drag and drop visual feedback */
        .image-drop-zone.drag-success {
            border: 2px solid #48bb78 !important;
            background: #e6fffa !important;
            animation: success-pulse 1.5s ease-in-out;
        }
        
        @keyframes success-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        @keyframes fadeInOut {
            0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
            20% { opacity: 1; transform: translateX(-50%) translateY(0); }
            80% { opacity: 1; transform: translateX(-50%) translateY(0); }
            100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
        
        .drag-instructions {
            position: absolute;
            top: -25px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
            z-index: 15;
        }
        
        .image-drop-zone:hover .drag-instructions {
            opacity: 1;
        }
    `;
    document.head.appendChild(style);

    // Add sample words for testing
   /* const sampleWords = `apple, 사과
dog, 개
cat, 고양이
book, 책
car, 자동차
house, 집`;*/

    document.getElementById('wordListTextarea').value = sampleWords;
    updateCurrentWordsFromTextarea();
    await updatePreview(); // Initial preview
});

// Initialize event listeners
function initializeEventListeners() {
    // Toolbar controls
    document.getElementById('fontSelect').addEventListener('change', updateFont);
    document.getElementById('fontSizeInput').addEventListener('change', updateFontSize);
    document.getElementById('designSelect').addEventListener('change', updateDesign);
    document.getElementById('layoutSelect').addEventListener('change', updateLayout);

    // Image controls with immediate update
    const imageGapSlider = document.getElementById('imageGapSlider');
    const imageSizeSlider = document.getElementById('imageSizeSlider');

    if (imageGapSlider) {
        imageGapSlider.addEventListener('input', updateImageGap);
        imageGapSlider.addEventListener('change', updateImageGap);
    }

    if (imageSizeSlider) {
        imageSizeSlider.max = 200; // Set max to 200
        imageSizeSlider.addEventListener('input', updateImageSize);
        imageSizeSlider.addEventListener('change', updateImageSize);
    }

    // Font size buttons
    document.getElementById('decreaseFontBtn').addEventListener('click', decreaseFontSize);
    document.getElementById('increaseFontBtn').addEventListener('click', increaseFontSize);

    // Toolbar buttons
    document.getElementById('refreshBtn').addEventListener('click', (e) => {
        // If Shift is held, clear all images completely. Otherwise, just add more alternatives
        if (e.shiftKey) {
            clearAllImages(updatePreview);
        } else {
            refreshImages(updatePreview);
        }
    });

    // Test mode dropdown
    const testModeSelect = document.getElementById('testModeSelect');
    if (testModeSelect) {
        testModeSelect.addEventListener('change', function() {
            currentSettings.testMode = testModeSelect.value;
            // Show/hide numLettersToHide input if needed
            let numLettersInput = document.getElementById('numLettersToHide');
            if (currentSettings.testMode === 'hide-random-letters') {
                if (!numLettersInput) {
                    numLettersInput = document.createElement('input');
                    numLettersInput.type = 'number';
                    numLettersInput.id = 'numLettersToHide';
                    numLettersInput.value = currentSettings.numLettersToHide;
                    numLettersInput.min = 1;
                    numLettersInput.max = 10;
                    numLettersInput.style.marginLeft = '8px';
                    numLettersInput.style.width = '40px';
                    testModeSelect.parentNode.appendChild(numLettersInput);
                    numLettersInput.addEventListener('input', function() {
                        currentSettings.numLettersToHide = parseInt(numLettersInput.value) || 1;
                        updatePreviewStyles();
                    });
                } else {
                    numLettersInput.style.display = '';
                }
            } else if (numLettersInput) {
                numLettersInput.style.display = 'none';
            }
            updatePreviewStyles();
        });
    }

    // Top action buttons
    document.getElementById('saveBtn').addEventListener('click', function() {
        window.open('../../worksheet_manager.html?mode=save', 'WorksheetManager', 'width=1200,height=550');
    });
    document.getElementById('loadBtn').addEventListener('click', function() {
        window.open('../../worksheet_manager.html?mode=load', 'WorksheetManager', 'width=1200,height=550');
    });
    document.getElementById('printBtn').addEventListener('click', printFile);
    document.getElementById('pdfBtn').addEventListener('click', generatePDF);

    // Form inputs
    document.getElementById('titleInput').addEventListener('input', updatePreview);
    document.getElementById('passageInput').addEventListener('input', updatePreviewStyles);
    document.getElementById('difficultySelect').addEventListener('change', updatePreviewStyles);
    document.getElementById('wordCountInput').addEventListener('change', updatePreviewStyles);

    // Extract and Clear buttons
    document.getElementById('extractBtn').addEventListener('click', extractWords);
    document.getElementById('clearBtn').addEventListener('click', clearAll);

    // Word list textarea
    const wordListTextarea = document.getElementById('wordListTextarea');
    if (wordListTextarea) {
        wordListTextarea.addEventListener('input', function() {
            updateCurrentWordsFromTextarea();
            highlightDuplicates();
            updatePreview();
        });
        wordListTextarea.addEventListener('change', function() {
            updateCurrentWordsFromTextarea();
            highlightDuplicates();
            updatePreview();
        });
    }
}

// Make floating toolbar non-draggable (but keep in original position)
function makeDraggable() {
    const toolbar = document.getElementById('floatingToolbar');
    if (toolbar) {
        toolbar.style.cursor = 'default';
        toolbar.style.userSelect = 'none';
    }
}

// --- Worksheet Save/Load Integration ---
// Returns a worksheet object for saving (called by worksheet_manager.html)
function getCurrentWorksheetData() {
    // Collect all relevant worksheet data for saving
    const title = document.getElementById('titleInput')?.value || '';
    const passage = document.getElementById('passageInput')?.value || '';
    const words = (currentWords && Array.isArray(currentWords))
        ? currentWords.map(w => `${w.eng}, ${w.kor}`)
        : (document.getElementById('wordListTextarea')?.value || '').split('\n').filter(w => w.trim());
    
    // Capture current image state from the preview
    const imageData = {};
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
        console.log('Preview area found, looking for images...');
        
        // Look for all image drop zones - these have the data attributes
        const dropZones = previewArea.querySelectorAll('.image-drop-zone');
        console.log('Found image drop zones:', dropZones.length);
        
        dropZones.forEach((zone, index) => {
            const word = zone.getAttribute('data-word');
            const dataIndex = zone.getAttribute('data-index');
            console.log(`Drop zone ${index}: word="${word}", index="${dataIndex}"`);
            
            if (word && dataIndex !== null) {
                const key = `${word.toLowerCase()}_${dataIndex}`;
                
                // Check for images inside the drop zone
                const img = zone.querySelector('img');
                if (img) {
                    console.log(`  - Found image with src: ${img.src.substring(0, 100)}...`);
                    imageData[key] = {
                        src: img.src,
                        word: word,
                        index: parseInt(dataIndex)
                    };
                }
                
                // Check for emoji/div elements (but not the drag instructions)
                const emojiDiv = zone.querySelector('div[style*="font-size"]:not(.drag-instructions)');
                if (emojiDiv && !img) { // Only capture emoji if there's no image
                    console.log(`  - Found emoji div: "${emojiDiv.textContent}"`);
                    imageData[key] = {
                        src: 'emoji',
                        emoji: emojiDiv.textContent.trim(),
                        word: word,
                        index: parseInt(dataIndex)
                    };
                }
            }
        });
        
        console.log('Final captured image data for saving:', imageData);
        console.log('Number of images captured:', Object.keys(imageData).length);
    } else {
        console.log('No preview area found!');
    }
    
    // Only save worksheet_type, title, passage_text, words, layout, settings, and imageData
    // settings: font, fontSize, design, imageSize, imageGap, testMode, numLettersToHide
    const settings = {
        font: currentSettings.font,
        fontSize: currentSettings.fontSize,
        design: currentSettings.design,
        imageSize: currentSettings.imageSize,
        imageGap: currentSettings.imageGap,
        testMode: currentSettings.testMode,
        numLettersToHide: currentSettings.numLettersToHide
    };
    
    return {
        worksheet_type: 'wordtest',
        title,
        passage_text: passage,
        words,
        layout: currentSettings.layout,
        settings: JSON.stringify(settings),
        images: JSON.stringify(imageData)
    };
}
window.getCurrentWorksheetData = getCurrentWorksheetData;

// Loads a worksheet object into the UI (called by worksheet_manager.html)
function loadWorksheet(worksheet) {
    if (!worksheet) return;
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
    // Restore design
    if (settings.design && document.getElementById('designSelect')) {
        document.getElementById('designSelect').value = settings.design;
        currentSettings.design = settings.design;
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
                    updatePreview();
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

    // Update currentWords and preview
    updateCurrentWordsFromTextarea();
    highlightDuplicates();
    updatePreview().then(() => {
        // Restore images after preview is updated
        restoreSavedImages();
    });
}
window.loadWorksheet = loadWorksheet;

// Function to restore saved images after loading a worksheet
function restoreSavedImages() {
    if (!window.savedImageData) {
        console.log('No saved image data to restore');
        return;
    }
    
    console.log('Restoring saved images:', window.savedImageData);
    console.log('Number of saved images:', Object.keys(window.savedImageData).length);
    
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) {
        console.log('No preview area found for restoration');
        return;
    }
    
    // Look for all image drop zones
    const dropZones = previewArea.querySelectorAll('.image-drop-zone');
    console.log('Found drop zones for restoration:', dropZones.length);
    
    dropZones.forEach((zone, index) => {
        const word = zone.getAttribute('data-word');
        const dataIndex = zone.getAttribute('data-index');
        console.log(`Restoring drop zone ${index}: word=${word}, index=${dataIndex}`);
        
        if (word && dataIndex !== null) {
            const key = `${word.toLowerCase()}_${dataIndex}`;
            const savedImage = window.savedImageData[key];
            
            if (savedImage) {
                console.log(`Found saved image for ${key}:`, savedImage);
                
                if (savedImage.src === 'emoji' && savedImage.emoji) {
                    // Replace with emoji
                    const emojiSize = Math.max(currentSettings.imageSize * 0.8, 20);
                    zone.innerHTML = `<div style="font-size: ${emojiSize}px; line-height: 1; display: flex; align-items: center; justify-content: center; width: ${currentSettings.imageSize}px; height: ${currentSettings.imageSize}px;">${savedImage.emoji}</div>`;
                    console.log(`Restored emoji: ${savedImage.emoji}`);
                } else if (savedImage.src && savedImage.src !== 'emoji') {
                    // Replace with image
                    const img = zone.querySelector('img');
                    if (img) {
                        img.src = savedImage.src;
                        console.log(`Restored image src: ${savedImage.src}`);
                    } else {
                        // Create new image if none exists
                        zone.innerHTML = `<img src="${savedImage.src}" style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;object-fit:cover;border-radius:8px;" data-word="${word}" data-index="${dataIndex}">`;
                        console.log(`Created new image with src: ${savedImage.src}`);
                    }
                }
            } else {
                console.log(`No saved image found for ${key}`);
            }
        }
    });
    
    // Clear saved image data
    window.savedImageData = null;
    
    console.log('Images restored successfully');
}

// Font and styling functions
function updateFont() {
    currentSettings.font = document.getElementById('fontSelect').value;
    updatePreviewStyles();
}

function updateFontSize() {
    currentSettings.fontSize = parseInt(document.getElementById('fontSizeInput').value);
    updatePreviewStyles();
}

function increaseFontSize() {
    const input = document.getElementById('fontSizeInput');
    input.value = parseInt(input.value) + 1;
    updateFontSize();
}

function decreaseFontSize() {
    const input = document.getElementById('fontSizeInput');
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
        updateFontSize();
    }
}

function updateDesign() {
    currentSettings.design = document.getElementById('designSelect').value;
    updatePreview();
}

function updateImageGap() {
    const slider = document.getElementById('imageGapSlider');
    if (slider) {
        currentSettings.imageGap = parseInt(slider.value);
        console.log('Image gap updated to:', currentSettings.imageGap);
        updatePreviewStyles();
    }
}

function updateImageSize() {
    const slider = document.getElementById('imageSizeSlider');
    if (slider) {
        currentSettings.imageSize = parseInt(slider.value);
        console.log('Image size updated to:', currentSettings.imageSize);
        
        // Force update all image sizes when slider is used
        const previewArea = document.getElementById('previewArea');
        if (previewArea) {
            const images = previewArea.querySelectorAll('.image-drop-zone img');
            images.forEach(img => {
                img.removeAttribute('data-custom-size');
                img.style.width = currentSettings.imageSize + 'px';
                img.style.height = currentSettings.imageSize + 'px';
            });
        }
        
        updatePreviewStyles();
    }
}

function updateLayout() {
    currentSettings.layout = document.getElementById('layoutSelect').value;
    updatePreview();
}

function updateCurrentWordsFromTextarea() {
    const wordsText = document.getElementById('wordListTextarea').value.trim();
    console.log('Updating words from textarea:', wordsText);
    
    if (!wordsText) {
        currentWords = [];
        console.log('No words found, currentWords cleared');
        return;
    }
    
    const lines = wordsText.split('\n').filter(line => line.trim());
    console.log('Lines found:', lines);
    
    // Remove leading numbers, periods, and symbols from English part
    function cleanWord(str) {
        return (str || '').replace(/^\s*\d+\.?\s*/, '').replace(/^[^\w가-힣]+/, '').replace(/\s+$/, '');
    }
    currentWords = lines.map(line => {
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
    
    console.log('Current words updated:', currentWords);
}

function clearAll() {
    currentWords = [];
    document.getElementById('wordListTextarea').value = '';

    // Hide duplicate warning
    const duplicateWarning = document.getElementById('duplicateWarning');
    if (duplicateWarning) {
        duplicateWarning.style.display = 'none';
    }

    updatePreview();
}

// Word extraction functions
async function extractWords() {
    const passage = document.getElementById('passageInput').value;
    const difficulty = document.getElementById('difficultySelect').value;
    const wordCount = parseInt(document.getElementById('wordCountInput').value);

    // --- Topic Input mode (now uses OpenAI API) ---
    if (difficulty === 'Topic Input') {
        const topic = passage.trim();
        if (!topic) {
            alert('Please enter a topic in the passage box.');
            return;
        }
        // Show loading state
        const extractBtn = document.getElementById('extractBtn');
        const originalText = extractBtn.textContent;
        extractBtn.textContent = 'Extracting...';
        extractBtn.disabled = true;

        let newWords = [];
        try {
            // Prompt for topic-based word list (not from a passage)
            const promptContent = `
You are an ESL teacher. Given the topic below, generate a list of exactly ${wordCount} important English words or short phrases related to the topic, suitable for vocabulary study. For each word or phrase, provide the English, then a comma, then the Korean translation. Return each pair on a new line in the format: english, korean

IMPORTANT:
- Do NOT extract from a passage. Instead, select the most relevant and useful words for the topic.
- Avoid duplicates or very similar words.
- Make sure each word/phrase is unique and different from the others.
- Ensure you provide exactly ${wordCount} distinct items.

Topic:
${topic}
`;
            const response = await fetch('/.netlify/functions/openai_proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: 'chat/completions',
                    payload: {
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: 'You are a helpful teaching assistant.' },
                            { role: 'user', content: promptContent }
                        ],
                        max_tokens: 1500
                    }
                })
            });
            const data = await response.json();
            const aiResponse = data.data.choices?.[0]?.message?.content || '';
            if (aiResponse) {
                const lines = aiResponse.split('\n').filter(line => line.trim() && line.includes(','));
                newWords = lines.map(line => line.trim()).filter(line => line);
            }
        } catch (error) {
            console.error('AI topic extraction error:', error);
            alert('Error extracting topic words. Please try again.');
        }

        // Combine with existing words
        const existingWords = document.getElementById('wordListTextarea').value.trim();
        let combinedWords = existingWords;
        if (existingWords && newWords.length > 0) {
            combinedWords = existingWords + '\n' + newWords.join('\n');
        } else if (newWords.length > 0) {
            combinedWords = newWords.join('\n');
        }
        document.getElementById('wordListTextarea').value = combinedWords;
        updateCurrentWordsFromTextarea();
        highlightDuplicates();
        updatePreview();
        extractBtn.textContent = originalText;
        extractBtn.disabled = false;
        return;
    }

    // --- Normal extraction (other modes) ---
    if (!passage.trim()) {
        alert('Please enter a passage first.');
        return;
    }
    try {
        // Show loading state
        const extractBtn = document.getElementById('extractBtn');
        const originalText = extractBtn.textContent;
        extractBtn.textContent = 'Extracting...';
        extractBtn.disabled = true;

        // Get existing words from textarea
        const existingWords = document.getElementById('wordListTextarea').value.trim();

        let newWords = [];

        // Try AI extraction first, fallback to simple extraction
        try {
            const aiResponse = await extractWordsWithAI(passage, wordCount, difficulty);
            if (aiResponse) {
                const lines = aiResponse.split('\n').filter(line => line.trim() && line.includes(','));
                newWords = lines.map(line => line.trim()).filter(line => line);
            }
        } catch (aiError) {
            console.warn('AI extraction failed, using simple extraction:', aiError);
            // Simple fallback extraction
            const words = passage.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/)
                .filter(word => word.length > 2)
                .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
                .slice(0, wordCount);

            newWords = words.map(word => `${word}, ${word}`); // Simple format: word, word
        }

        // Combine with existing words
        let combinedWords = existingWords;
        if (existingWords && newWords.length > 0) {
            combinedWords = existingWords + '\n' + newWords.join('\n');
        } else if (newWords.length > 0) {
            combinedWords = newWords.join('\n');
        }

        // Update textarea
        document.getElementById('wordListTextarea').value = combinedWords;

        // Update current words and preview
        updateCurrentWordsFromTextarea();
        highlightDuplicates();
        updatePreview();

        // Restore button state
        extractBtn.textContent = originalText;
        extractBtn.disabled = false;

    } catch (error) {
        console.error('Error extracting words:', error);
        alert('Error extracting words. Please try again.');

        // Restore button state
        const extractBtn = document.getElementById('extractBtn');
        extractBtn.textContent = 'Extract Words';
        extractBtn.disabled = false;
    }
}

// --- Insert Topic Input as topmost option in difficulty dropdown ---
document.addEventListener('DOMContentLoaded', function() {
    const diffSelect = document.getElementById('difficultySelect');
    // Insert Topic Input as first option if not present
    if (diffSelect && !Array.from(diffSelect.options).some(opt => opt.value === 'Topic Input')) {
        const topicOpt = document.createElement('option');
        topicOpt.value = 'Topic Input';
        topicOpt.textContent = 'Topic Input';
        diffSelect.insertBefore(topicOpt, diffSelect.firstChild);
    }
    // Insert Related Words as second option if not present
    if (diffSelect && !Array.from(diffSelect.options).some(opt => opt.value === 'related')) {
        const relatedOpt = document.createElement('option');
        relatedOpt.value = 'related';
        relatedOpt.textContent = 'Related Words';
        diffSelect.insertBefore(relatedOpt, diffSelect.children[1] || null);
    }
    // Insert Phrases as last option if not present
    if (diffSelect && !Array.from(diffSelect.options).some(opt => opt.value === 'phrases')) {
        const phrasesOpt = document.createElement('option');
        phrasesOpt.value = 'phrases';
        phrasesOpt.textContent = 'Phrases & Idioms';
        diffSelect.appendChild(phrasesOpt);
    }
});

// Preview functions
async function updatePreview() {
    console.log('updatePreview called');
    const previewArea = document.getElementById('previewArea');
    const title = document.getElementById('titleInput').value || 'Worksheet Title';
    
    if (!previewArea) {
        console.error('Preview area not found');
        return;
    }
    
    // Update current words from textarea
    updateCurrentWordsFromTextarea();
    
    console.log('Current words for preview:', currentWords);
    
    if (currentWords.length === 0) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Add some words to see the preview</p></div>';
        return;
    }
    
    // Show loading spinner for image-based layouts
    const layout = currentSettings.layout;
    const imageBasedLayouts = ['picture-list', 'picture-list-2col', 'picture-quiz', 'picture-quiz-5col', 'picture-matching', '6col-images', '5col-images'];
    
    if (imageBasedLayouts.includes(layout)) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Loading images...</p></div>';
        // Small delay to show loading message
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    const worksheetHTML = await generateWorksheetHTML(title, currentWords);
    previewArea.innerHTML = worksheetHTML;
    
    // Enable drag and drop for images
    enableImageDragAndDrop(updatePreview);
    
    // Add interactive editing/deletion to word cells
    addWordCellInteractivity(previewArea);
    console.log('Preview updated');
}

// Efficient preview update that preserves images when only styles change
async function updatePreviewStyles() {
    console.log('updatePreviewStyles called - preserving images');
    const previewArea = document.getElementById('previewArea');
    
    if (!previewArea || !previewArea.querySelector('.worksheet-preview')) {
        // If no preview exists yet, do a full update
        return updatePreview();
    }
    
    // For test mode changes, we need to rebuild the content but preserve images
    const testModeChanged = currentSettings.testMode !== 'none';
    if (testModeChanged) {
        return updatePreviewPreservingImages();
    }
    
    // Update the preview styles without regenerating images
    const worksheetPreview = previewArea.querySelector('.worksheet-preview');
    if (worksheetPreview) {
        // Update font family and size
        worksheetPreview.style.fontFamily = currentSettings.font;
        worksheetPreview.style.fontSize = currentSettings.fontSize + 'px';
        
        // Update all table elements
        const tables = worksheetPreview.querySelectorAll('table');
        tables.forEach(table => {
            table.style.fontFamily = currentSettings.font;
            table.style.fontSize = currentSettings.fontSize + 'px';
        });
        
        // Update all text elements
        const textElements = worksheetPreview.querySelectorAll('th, td, div');
        textElements.forEach(element => {
            // Only update if it's not an image container
            if (!element.classList.contains('image-drop-zone') && 
                !element.querySelector('.image-drop-zone')) {
                element.style.fontFamily = currentSettings.font;
            }
        });
        
        // Update image sizes if they exist - only if explicitly updating size
        const images = worksheetPreview.querySelectorAll('.image-drop-zone img');
        images.forEach(img => {
            // Only update size if the image doesn't have a custom size set
            // or if we're explicitly updating from the size slider
            if (!img.hasAttribute('data-custom-size')) {
                img.style.width = currentSettings.imageSize + 'px';
                img.style.height = currentSettings.imageSize + 'px';
            }
        });
        
        // Update emoji font sizes
        const emojiElements = worksheetPreview.querySelectorAll('.image-drop-zone div[style*="font-size"]');
        emojiElements.forEach(emoji => {
            const newFontSize = currentSettings.imageSize * 0.8;
            emoji.style.fontSize = newFontSize + 'px';
        });
        
        // Update placeholder sizes
        const placeholders = worksheetPreview.querySelectorAll('.image-drop-zone div[style*="width"]');
        placeholders.forEach(placeholder => {
            if (!placeholder.style.fontSize) { // Not an emoji
                placeholder.style.width = currentSettings.imageSize + 'px';
                placeholder.style.height = currentSettings.imageSize + 'px';
            }
        });
        
        // Update grid gaps for image-based layouts
        const gridElements = worksheetPreview.querySelectorAll('.picture-quiz-grid, .picture-cards-grid, .picture-quiz-grid-5col, .picture-cards-grid-5col');
        gridElements.forEach(grid => {
            grid.style.rowGap = currentSettings.imageGap + 'px';
        });
        
        // Update row-gap for flex containers
        const flexContainers = worksheetPreview.querySelectorAll('div[style*="row-gap"]');
        flexContainers.forEach(container => {
            const currentStyle = container.getAttribute('style');
            if (currentStyle) {
                const updatedStyle = currentStyle.replace(/row-gap:\s*\d+px/, `row-gap: ${currentSettings.imageGap}px`);
                container.setAttribute('style', updatedStyle);
            }
        });
        
        // Update word-grid gaps
        const wordGrids = worksheetPreview.querySelectorAll('.word-grid');
        wordGrids.forEach(grid => {
            grid.style.rowGap = currentSettings.imageGap + 'px';
        });
        
        console.log('Styles updated without image refresh');
    }
}

// Update preview while preserving existing images (for word deletion)
async function updatePreviewPreservingImages() {
    console.log('updatePreviewPreservingImages called - rebuilding layout but preserving images');
    const previewArea = document.getElementById('previewArea');
    const title = document.getElementById('titleInput').value || 'Worksheet Title';
    
    if (!previewArea) {
        console.error('Preview area not found');
        return;
    }
    
    // Update current words from textarea
    updateCurrentWordsFromTextarea();
    
    console.log('Current words for preview:', currentWords);
    
    if (currentWords.length === 0) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Add some words to see the preview</p></div>';
        return;
    }
    
    // Store existing images by word
    const existingImages = new Map();
    const existingImageElements = previewArea.querySelectorAll('.image-drop-zone img');
    existingImageElements.forEach(img => {
        const word = img.getAttribute('data-word');
        if (word) {
            existingImages.set(word, img.src);
        }
    });
    
    // Generate worksheet HTML (this will recreate the layout)
    const worksheetHTML = await generateWorksheetHTML(title, currentWords);
    previewArea.innerHTML = worksheetHTML;
    
    // Restore existing images where possible
    const newImageElements = previewArea.querySelectorAll('.image-drop-zone img');
    newImageElements.forEach(img => {
        const word = img.getAttribute('data-word');
        if (word && existingImages.has(word)) {
            img.src = existingImages.get(word);
        }
    });
    
    // Enable drag and drop for images
    enableImageDragAndDrop(updatePreviewPreservingImages);
    
    // Add interactive editing/deletion to word cells
    addWordCellInteractivity(previewArea);
    console.log('Preview updated while preserving images');
}

// Add interactive editing and deletion to word cells in the preview
function addWordCellInteractivity(previewArea) {
    if (!previewArea) return;

    // Remove any previous event listeners
    previewArea.oncontextmenu = null;
    previewArea.onclick = null;

    // Right-click: delete (event delegation)
    previewArea.addEventListener('contextmenu', function(e) {
        const cell = e.target.closest('.word-cell');
        if (cell && previewArea.contains(cell)) {
            e.preventDefault(); // Suppress browser context menu
            const idx = parseInt(cell.getAttribute('data-index'));
            if (isNaN(idx)) return;
            pushWorksheetUndo();
            currentWords.splice(idx, 1);
            // Update textarea to reflect the change
            document.getElementById('wordListTextarea').value = currentWords.map(word => `${word.eng}, ${word.kor}`).join('\n');
            // For word deletion, we need to rebuild the layout but preserve existing images
            updatePreviewPreservingImages();
        }
    });

    // Left-click: edit (event delegation)
    previewArea.addEventListener('click', function(e) {
        if (e.button !== 0) return; // Only respond to left click
        const cell = e.target.closest('.word-cell');
        if (cell && previewArea.contains(cell)) {
            // Prevent multiple editors
            if (cell.querySelector('input')) return;
            const idx = parseInt(cell.getAttribute('data-index'));
            const lang = cell.getAttribute('data-lang');
            if (isNaN(idx) || !lang) return;
            const currentVal = (currentWords[idx] && currentWords[idx][lang]) || '';
            // Create input
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentVal;
            input.style.width = '90%';
            input.style.background = 'transparent';
            input.style.border = '1px solid #ccc';
            input.style.fontSize = 'inherit';
            input.style.fontFamily = 'inherit';
            // Replace cell content with input
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            // Handle save/cancel
            const saveEdit = () => {
                pushWorksheetUndo();
                currentWords[idx][lang] = input.value.trim();
                // Update textarea
                document.getElementById('wordListTextarea').value = currentWords.map(word => `${word.eng}, ${word.kor}`).join('\n');
                updatePreviewPreservingImages();
            };
            input.addEventListener('blur', saveEdit);
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    saveEdit();
                } else if (e.key === 'Escape') {
                    updatePreviewPreservingImages(); // Cancel edit
                }
            });
        }
    });

    // Add Ctrl+Z (undo) support for worksheet edits
    document.addEventListener('keydown', worksheetUndoKeyHandler);

    console.log('Word cell interactivity added to preview area.');
}

function worksheetUndoKeyHandler(e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoWorksheetEdit();
    }
}

// Complete worksheet generation function with all layouts
async function generateWorksheetHTML(title, wordPairs) {
    const style = `
        font-family: ${currentSettings.font};
        font-size: ${currentSettings.fontSize}px;
        line-height: 1.5;
    `;
    
    const layout = currentSettings.layout;
    console.log('Generating worksheet with layout:', layout);
    
    // Apply test mode masking
    let testMode = currentSettings.testMode;
    let numLettersToHide = currentSettings.numLettersToHide || 1;
    let maskedPairs = wordPairs;
    if (testMode === 'hide-eng') {
        maskedPairs = wordPairs.map(pair => ({ eng: '', kor: pair.kor, _originalEng: pair.eng }));
    } else if (testMode === 'hide-kor') {
        maskedPairs = wordPairs.map(pair => ({ eng: pair.eng, kor: '', _originalEng: pair.eng }));
    } else if (testMode === 'hide-all') {
        maskedPairs = wordPairs.map(pair => ({ eng: '', kor: '', _originalEng: pair.eng }));
    } else if (testMode === 'hide-random-letters') {
        maskedPairs = wordPairs.map(pair => ({
            eng: hideRandomLetters(pair.eng, numLettersToHide),
            kor: pair.kor,
            _originalEng: pair.eng
        }));
    } else if (testMode === 'hide-random-lang') {
        maskedPairs = wordPairs.map(pair => {
            if (Math.random() < 0.5) {
                return { eng: '', kor: pair.kor, _originalEng: pair.eng };
            } else {
                return { eng: pair.eng, kor: '', _originalEng: pair.eng };
            }
        });
    } else {
        maskedPairs = wordPairs.map(pair => ({ eng: pair.eng, kor: pair.kor, _originalEng: pair.eng }));
    }

    // --- Duplicate detection for preview highlighting ---
    const engCounts = {};
    const korCounts = {};
    wordPairs.forEach(pair => {
        const eng = (pair.eng || '').trim().toLowerCase();
        const kor = (pair.kor || '').trim().toLowerCase();
        if (eng) engCounts[eng] = (engCounts[eng] || 0) + 1;
        if (kor) korCounts[kor] = (korCounts[kor] || 0) + 1;
    });
    
    function isDuplicateEng(eng) {
        return eng && engCounts[eng.trim().toLowerCase()] > 1;
    }
    function isDuplicateKor(kor) {
        return kor && korCounts[kor.trim().toLowerCase()] > 1;
    }
    
    function highlightCell(content, isDup) {
        const overlay = isDup ? '<span class="dup-overlay-screen" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,140,0,0.25);pointer-events:none;z-index:1;"></span>' : '';
        return `<span style="position:relative;display:inline-block;width:100%;">${overlay}<span style="position:relative;z-index:2;">${content}</span></span>`;
    }

    const printStyle = `<style>@media print { .dup-overlay-screen { display: none !important; } }</style>`;

    // --- BASIC TABLE LAYOUT ---
    if (layout === "default") {
        // For long lists, break into chunks for better page breaks
        const ROWS_PER_CHUNK = 20; // Max rows per table chunk
        let tablesHtml = '';
        
        if (maskedPairs.length <= ROWS_PER_CHUNK) {
            // Single table for shorter lists
            tablesHtml = `
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <thead>
                        <tr>
                            <th style="width:10%;padding:8px;border-bottom:2px solid #333;">#</th>
                            <th style="width:45%;padding:8px;border-bottom:2px solid #333;">English</th>
                            <th style="width:45%;padding:8px;border-bottom:2px solid #333;">Korean</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${maskedPairs.map((pair, i) => {
                            const isDupEng = isDuplicateEng(wordPairs[i]?.eng);
                            const isDupKor = isDuplicateKor(wordPairs[i]?.kor);
                            return `
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${i + 1}</td>
                                <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;cursor:pointer;">${highlightCell(pair.eng || '______', isDupEng)}</td>
                                <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;cursor:pointer;">${highlightCell(pair.kor || '______', isDupKor)}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            // Multiple tables for longer lists
            const chunks = [];
            for (let i = 0; i < maskedPairs.length; i += ROWS_PER_CHUNK) {
                chunks.push(maskedPairs.slice(i, i + ROWS_PER_CHUNK));
            }
            
            tablesHtml = chunks.map((chunk, chunkIndex) => `
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;${chunkIndex > 0 ? 'margin-top:20px;' : ''}">
                    <thead>
                        <tr>
                            <th style="width:10%;padding:8px;border-bottom:2px solid #333;">#</th>
                            <th style="width:45%;padding:8px;border-bottom:2px solid #333;">English</th>
                            <th style="width:45%;padding:8px;border-bottom:2px solid #333;">Korean</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${chunk.map((pair, i) => {
                            const globalIndex = chunkIndex * ROWS_PER_CHUNK + i;
                            const isDupEng = isDuplicateEng(wordPairs[globalIndex]?.eng);
                            const isDupKor = isDuplicateKor(wordPairs[globalIndex]?.kor);
                            return `
                            <tr>
                                <td style="padding:8px;border-bottom:1px solid #ddd;">${globalIndex + 1}</td>
                                <td class="word-cell" data-index="${globalIndex}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;cursor:pointer;">${highlightCell(pair.eng || '______', isDupEng)}</td>
                                <td class="word-cell" data-index="${globalIndex}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;cursor:pointer;">${highlightCell(pair.kor || '______', isDupKor)}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `).join('');
        }
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${printStyle}
                ${tablesHtml}
            </div>
        `;
    }
    
    // --- TWO LISTS LAYOUT (SIDE BY SIDE) ---
    if (layout === "4col") {
        // Single table for all rows, let browser handle page breaks
        const half = Math.ceil(maskedPairs.length / 2);
        const left = maskedPairs.slice(0, half);
        const right = maskedPairs.slice(half);
        while (right.length < left.length) {
            right.push({ eng: "", kor: "" });
        }
        const tableHtml = `
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <colgroup>
                    <col style="width:8%;">
                    <col style="width:23%;">
                    <col style="width:23%;">
                    <col style="width:3%;">
                    <col style="width:8%;">
                    <col style="width:23%;">
                    <col style="width:23%;">
                </colgroup>
                <thead>
                    <tr>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">#</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">English</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">Korean</th>
                        <th style="background:transparent;border:none;padding:0;"></th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">#</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">English</th>
                        <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${left.map((pair, i) => {
                        const isDupEngL = isDuplicateEng(left[i]?.eng);
                        const isDupKorL = isDuplicateKor(left[i]?.kor);
                        const isDupEngR = isDuplicateEng(right[i]?.eng);
                        const isDupKorR = isDuplicateKor(right[i]?.kor);
                        return `
                        <tr>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;white-space:nowrap;">${i + 1}</td>
                            <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(left[i]?.eng || '______', isDupEngL)}</td>
                            <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(left[i]?.kor || '______', isDupKorL)}</td>
                            <td style="border-left:2px solid #e0e0e0;background:transparent;border-bottom:none;padding:0;"></td>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;white-space:nowrap;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                            <td class="word-cell" data-index="${i + half}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(right[i]?.eng || '______', isDupEngR)}</td>
                            <td class="word-cell" data-index="${i + half}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(right[i]?.kor || '______', isDupKorR)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${printStyle}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- PICTURE LIST LAYOUT ---
    if (layout === "picture-list") {
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, currentSettings);
            return {
                ...pair,
                imageUrl,
                index: i
            };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        const rowHeight = Math.max(currentSettings.imageSize + currentSettings.imageGap, 100);
        const cellPadding = Math.max(currentSettings.imageGap / 2, 8);
        
        // Break long picture lists into chunks
        const ROWS_PER_CHUNK = 12; // Max rows per table chunk for picture lists
        let tablesHtml = '';
        
        if (pairsWithImages.length <= ROWS_PER_CHUNK) {
            // Single table for shorter lists
            tablesHtml = `
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:850px;">
                    <colgroup>
                        <col style="width:8%;min-width:60px;">
                        <col style="width:30%;min-width:200px;">
                        <col style="width:31%;min-width:220px;">
                        <col style="width:31%;min-width:220px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">#</th>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">Picture</th>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">English</th>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">Korean</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pairsWithImages.map((pair, i) => {
                            const isDupEng = isDuplicateEng(wordPairs[i]?.eng);
                            const isDupKor = isDuplicateKor(wordPairs[i]?.kor);
                            return `
                            <tr style="min-height:${rowHeight}px;">
                                <td style="padding:${cellPadding}px 8px;border-bottom:1px solid #ddd;text-align:center;font-size:1.1em;font-weight:500;">${i + 1}</td>
                                <td style="padding:${cellPadding}px 8px;border-bottom:1px solid #ddd;text-align:center;">
                                    <div class="image-container" style="display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;">
                                        ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng, pair.kor, currentSettings)}
                                    </div>
                                </td>
                                <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:${cellPadding}px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(pair.eng || '______', isDupEng)}</td>
                                <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:${cellPadding}px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(pair.kor || '______', isDupKor)}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        } else {
            // Multiple tables for longer lists
            const chunks = [];
            for (let i = 0; i < pairsWithImages.length; i += ROWS_PER_CHUNK) {
                chunks.push(pairsWithImages.slice(i, i + ROWS_PER_CHUNK));
            }
            
            tablesHtml = chunks.map((chunk, chunkIndex) => `
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:850px;${chunkIndex > 0 ? 'margin-top:20px;' : ''}">
                    <colgroup>
                        <col style="width:8%;min-width:60px;">
                        <col style="width:30%;min-width:200px;">
                        <col style="width:31%;min-width:220px;">
                        <col style="width:31%;min-width:220px;">
                    </colgroup>
                    <thead>
                        <tr>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">#</th>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">Picture</th>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">English</th>
                            <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;font-weight:bold;">Korean</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${chunk.map((pair, i) => {
                            const globalIndex = chunkIndex * ROWS_PER_CHUNK + i;
                            const isDupEng = isDuplicateEng(wordPairs[globalIndex]?.eng);
                            const isDupKor = isDuplicateKor(wordPairs[globalIndex]?.kor);
                            return `
                            <tr style="min-height:${rowHeight}px;">
                                <td style="padding:${cellPadding}px 8px;border-bottom:1px solid #ddd;text-align:center;font-size:1.1em;font-weight:500;">${globalIndex + 1}</td>
                                <td style="padding:${cellPadding}px 8px;border-bottom:1px solid #ddd;text-align:center;">
                                    <div class="image-container" style="display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;">
                                        ${renderImage(pair.imageUrl, globalIndex, pair._originalEng || pair.eng, pair.kor, currentSettings)}
                                    </div>
                                </td>
                                <td class="word-cell" data-index="${globalIndex}" data-lang="eng" style="position:relative;padding:${cellPadding}px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(pair.eng || '______', isDupEng)}</td>
                                <td class="word-cell" data-index="${globalIndex}" data-lang="kor" style="position:relative;padding:${cellPadding}px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(pair.kor || '______', isDupKor)}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `).join('');
        }
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${printStyle}
                ${tablesHtml}
            </div>
        `;
    }
    
    // --- PICTURE LIST LAYOUT (2 COLUMNS) ---
    if (layout === "picture-list-2col") {
        const half = Math.ceil(maskedPairs.length / 2);
        const left = maskedPairs.slice(0, half);
        const right = maskedPairs.slice(half);
        
        while (right.length < left.length) {
            right.push({ eng: null, kor: null, _originalEng: null, imageUrl: null });
        }
        
        const leftImagePromises = left.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, currentSettings);
            return { ...pair, imageUrl, index: i };
        });
        const leftPairsWithImages = await Promise.all(leftImagePromises);
        
        const rightImagePromises = right.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i + half, false, currentSettings);
            return { ...pair, imageUrl, index: i + half };
        });
        const rightPairsWithImages = await Promise.all(rightImagePromises);
        
        const tableHtml = `
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;min-width:900px;">
                <colgroup>
                    <col style="width:4%;min-width:40px;">
                    <col style="width:15%;min-width:120px;">
                    <col style="width:15%;min-width:120px;">
                    <col style="width:15%;min-width:120px;">
                    <col style="width:2%;min-width:20px;">
                    <col style="width:4%;min-width:40px;">
                    <col style="width:15%;min-width:120px;">
                    <col style="width:15%;min-width:120px;">
                    <col style="width:15%;min-width:120px;">
                </colgroup>
                <thead>
                    <tr>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">#</th>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">Picture</th>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">English</th>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">Korean</th>
                        <th style="background:transparent;border:none;padding:0;"></th>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">#</th>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">Picture</th>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">English</th>
                        <th style="padding:8px;border-bottom:2px solid #333;font-size:1em;text-align:center;font-weight:bold;">Korean</th>
                    </tr>
                </thead>
                <tbody>
                    ${leftPairsWithImages.map((pair, i) => {
                        const isDupEngL = isDuplicateEng(left[i]?.eng);
                        const isDupKorL = isDuplicateKor(left[i]?.kor);
                        const isDupEngR = isDuplicateEng(right[i]?.eng);
                        const isDupKorR = isDuplicateKor(right[i]?.kor);
                        const isBlank = right[i]?.eng === null && right[i]?.kor === null;
                        return `
                        <tr style="min-height:${Math.max(currentSettings.imageSize + currentSettings.imageGap, 100)}px;">
                            <td style="padding:${Math.max(currentSettings.imageGap/2, 5)}px 4px;border-bottom:1px solid #ddd;text-align:center;font-size:1em;font-weight:500;">${i + 1}</td>
                            <td style="padding:${Math.max(currentSettings.imageGap/2, 5)}px 4px;border-bottom:1px solid #ddd;text-align:center;">
                                <div class="image-container" style="display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;">
                                    ${renderImage(pair.imageUrl, i, left[i]?._originalEng || left[i]?.eng, left[i]?.kor, currentSettings)}
                                </div>
                            </td>
                            <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:${Math.max(currentSettings.imageGap/2, 5)}px 8px;border-bottom:1px solid #ddd;font-size:1em;text-align:center;font-weight:500;cursor:pointer;">${isBlank ? '' : highlightCell(left[i]?.eng || '______', isDupEngL)}</td>
                            <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:${Math.max(currentSettings.imageGap/2, 5)}px 8px;border-bottom:1px solid #ddd;font-size:1em;text-align:center;font-weight:500;cursor:pointer;">${isBlank ? '' : highlightCell(left[i]?.kor || '______', isDupKorL)}</td>
                            <td style="border-left:2px solid #e0e0e0;background:transparent;border-bottom:none;padding:0;"></td>
                            <td style="padding:${Math.max(currentSettings.imageGap/2, 5)}px 4px;border-bottom:1px solid #ddd;text-align:center;font-size:1em;font-weight:500;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                            <td style="padding:${Math.max(currentSettings.imageGap/2, 5)}px 4px;border-bottom:1px solid #ddd;text-align:center;">
                                <div class="image-container" style="display:flex;align-items:center;justify-content:center;margin:0 auto;position:relative;">
                                    ${isBlank ? '' : (rightPairsWithImages[i] && rightPairsWithImages[i].imageUrl ? renderImage(rightPairsWithImages[i].imageUrl, i + half, right[i]?._originalEng || right[i]?.eng, right[i]?.kor, currentSettings) : "")}
                                </div>
                            </td>
                            <td class="word-cell" data-index="${i + half}" data-lang="eng" style="position:relative;padding:${Math.max(currentSettings.imageGap/2, 5)}px 8px;border-bottom:1px solid #ddd;font-size:1em;text-align:center;font-weight:500;cursor:pointer;">${isBlank ? '' : highlightCell(right[i]?.eng || '______', isDupEngR)}</td>
                            <td class="word-cell" data-index="${i + half}" data-lang="kor" style="position:relative;padding:${Math.max(currentSettings.imageGap/2, 5)}px 8px;border-bottom:1px solid #ddd;font-size:1em;text-align:center;font-weight:500;cursor:pointer;">${isBlank ? '' : highlightCell(right[i]?.kor || '______', isDupKorR)}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${printStyle}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- PICTURE QUIZ LAYOUT ---
    if (layout === "picture-quiz") {
        try {
            // Remove the 12-card limit to show all images
            const limitedWordPairs = maskedPairs;
            if (!Array.isArray(limitedWordPairs) || limitedWordPairs.length === 0) {
                return `<div class='preview-placeholder'><p>No words available for Picture Quiz layout.</p></div>`;
            }
            
            const pairsWithImages = await Promise.all(limitedWordPairs.map(async (pair, i) => {
                try {
                    const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, currentSettings);
                    return { ...pair, imageUrl, index: i };
                } catch (err) {
                    return { ...pair, imageUrl: getPlaceholderImage(i), index: i };
                }
            }));
            
            // Shuffle word box only
            function shuffleArray(array) {
                const arr = array.slice();
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            }
            const shuffledWordBox = shuffleArray(pairsWithImages);
            const wordBoxHtml = `
                <div style="margin-bottom: 15px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9;">
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;">
                        ${shuffledWordBox.map(pair => `<span style="padding: 2px 6px; background: #fff; border: 1px solid #ddd; border-radius: 3px; font-size: 0.8em;">${pair._originalEng || pair.eng || 'word'}</span>`).join('')}
                    </div>
                </div>
            `;
            
            // Group quiz items for better page breaks (9 items per page)
            const itemsPerPage = 9;
            const pages = [];
            for (let i = 0; i < pairsWithImages.length; i += itemsPerPage) {
                pages.push(pairsWithImages.slice(i, i + itemsPerPage));
            }
            
            const gridHtml = pages.map((pageItems, pageIndex) => `
                <div class="picture-quiz-page" style="page-break-before: ${pageIndex > 0 ? 'always' : 'auto'};">
                    <div class="picture-quiz-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); row-gap: ${currentSettings.imageGap}px; column-gap: 15px; padding: 20px; width: 100%; max-width: 750px; margin: 0 auto; place-items: center;">
                        ${pageItems.map((pair, i) => `
                            <div class="quiz-item" style="text-align: center; padding: 10px; width: 220px; height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
                                <div class="image-container" style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; max-height: 170px; position: relative;">
                                    ${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, currentSettings)}
                                </div>
                                <div style="width: 120px; border-bottom: 2px solid #333; height: 25px; margin-top: 8px;"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            
            const tableHtml = `
                ${wordBoxHtml}
                ${gridHtml}
            `;
            return `
                <div class="worksheet-preview" style="${style}">
                    ${generateWorksheetHeader(title)}
                    ${tableHtml}
                </div>
            `;
        } catch (err) {
            return `<div class='preview-placeholder'><p>Error loading Picture Quiz layout.<br>${err && err.message ? err.message : err}</p></div>`;
        }
    }
    
    // --- 5COL IMAGES LAYOUT (Picture Cards - 5 per row) ---
    if (layout === "5col-images") {
        // Create custom settings for Picture Cards with larger image size
        const pictureCard5Settings = {
            ...currentSettings,
            imageSize: 110  // Use appropriate images for 5-per-row Picture Cards layout
        };
        
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureCard5Settings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        
        const cardWidth = 160;
        const cardHeight = 200;
        const baseGap = Math.max(currentSettings.imageGap, 10);
        const dynamicPadding = Math.max(15, baseGap / 2);
        
        // Use single continuous grid (no artificial page breaks)
        const gridHtml = `
            <div class="picture-cards-grid-5col" style="display: grid; grid-template-columns: repeat(5, 1fr); row-gap: ${baseGap}px; column-gap: 10px; padding: ${dynamicPadding}px; width: 100%; max-width: 900px; margin: 0 auto; place-items: center;">
                ${pairsWithImages.map((pair, i) => {
                    // Show blank only if hide-eng mode is on, otherwise always show English name
                    const showEng = currentSettings.testMode === 'hide-eng' ? '' : (pair.eng || pair._originalEng || '______');
                    return `
                    <div class="picture-card-5col" style="
                        padding: 10px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        width: ${cardWidth}px;
                        height: ${cardHeight}px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        gap: 0;
                    ">
                        <div class="image-container" style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            width: 100%;
                            height: 110px;
                            min-height: 80px;
                            max-height: 120px;
                            margin-bottom: 8px;
                            flex-shrink: 0;
                        ">
                            ${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, pictureCard5Settings)}
                        </div>
                        <div style="width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
                            <div style="font-weight: bold; font-size: 0.95em; margin-bottom: 2px; word-wrap: break-word;">${showEng}</div>
                            <div style="color: #555; font-size: 0.85em; word-wrap: break-word;">${pair.kor || '______'}</div>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${gridHtml}
            </div>
        `;
    }
    
    // --- 6COL IMAGES LAYOUT (Picture Cards - 3 per row) ---
    if (layout === "6col-images") {
        // Create custom settings for Picture Cards with larger image size
        const pictureCardSettings = {
            ...currentSettings,
            imageSize: 150  // Use larger images for Picture Cards layout
        };
        
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, pictureCardSettings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        
        const cardWidth = 220;
        const cardHeight = 260;
        const baseGap = Math.max(currentSettings.imageGap, 15);
        const dynamicPadding = Math.max(20, baseGap / 2);
        
        // Group cards for better page breaks (9 cards per page - 3 rows of 3)
        const cardsPerPage = 9;
        const pages = [];
        for (let i = 0; i < pairsWithImages.length; i += cardsPerPage) {
            pages.push(pairsWithImages.slice(i, i + cardsPerPage));
        }
        
        const gridHtml = pages.map((pageCards, pageIndex) => `
            <div class="picture-cards-page" style="page-break-before: ${pageIndex > 0 ? 'always' : 'auto'};">
                <div class="picture-cards-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); row-gap: ${baseGap}px; column-gap: 15px; padding: ${dynamicPadding}px; width: 100%; max-width: 750px; margin: 0 auto; place-items: center;">
                    ${pageCards.map((pair, i) => {
                        // Show blank only if hide-eng mode is on, otherwise always show English name
                        const showEng = currentSettings.testMode === 'hide-eng' ? '' : (pair.eng || pair._originalEng || '______');
                        return `
                        <div class="picture-card" style="
                            padding: 15px;
                            border: 2px solid #e2e8f0;
                            border-radius: 8px;
                            text-align: center;
                            background: white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            width: ${cardWidth}px;
                            height: ${cardHeight}px;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: space-between;
                        ">
                            <div class="image-container" style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; max-height: 180px; position: relative;">
                                ${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, pictureCardSettings)}
                            </div>
                            <div style="font-weight: bold; font-size: 1em; margin-top: 8px; word-wrap: break-word;">${showEng}</div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `).join('');
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${gridHtml}
            </div>
        `;
    }
    
    // --- PICTURE QUIZ LAYOUT (5 per row) ---
    if (layout === "picture-quiz-5col") {
        try {
            // Remove the limit to show all images
            const limitedWordPairs = maskedPairs;
            if (!Array.isArray(limitedWordPairs) || limitedWordPairs.length === 0) {
                return `<div class='preview-placeholder'><p>No words available for Picture Quiz (5 per row) layout.</p></div>`;
            }
            // Get images for all pairs
            const pairsWithImages = await Promise.all(limitedWordPairs.map(async (pair, i) => {
                try {
                    const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, currentSettings);
                    return { ...pair, imageUrl, index: i };
                } catch (err) {
                    return { ...pair, imageUrl: getPlaceholderImage(i), index: i };
                }
            }));
            // Shuffle word box only
            function shuffleArray(array) {
                const arr = array.slice();
                for (let i = arr.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [arr[i], arr[j]] = [arr[j], arr[i]];
                }
                return arr;
            }
            const shuffledWordBox = shuffleArray(pairsWithImages);
            const wordBoxHtml = `
                <div style="margin-bottom: 10px; padding: 6px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9;">
                    <div style="display: flex; flex-wrap: wrap; gap: 3px; justify-content: center;">
                        ${shuffledWordBox.map(pair => `<span style="padding: 1px 4px; background: #fff; border: 1px solid #ddd; border-radius: 3px; font-size: 0.75em;">${pair._originalEng || pair.eng || 'word'}</span>`).join('')}
                    </div>
                </div>
            `;
            // Group quiz items for better page breaks (20 items per page - 4 rows of 5)
            const itemsPerPage = 20;
            const pages = [];
            for (let i = 0; i < pairsWithImages.length; i += itemsPerPage) {
                pages.push(pairsWithImages.slice(i, i + itemsPerPage));
            }
            // Use normal image gap like other layouts - no more ultra-compact reduction
            const normalGap = Math.max(currentSettings.imageGap, 2);
            const gridHtml = pages.map((pageItems, pageIndex) => `
                <div class="picture-quiz-page-5col" style="page-break-before: ${pageIndex > 0 ? 'always' : 'auto'};">
                    <div class="picture-quiz-grid-5col" style="display: grid; grid-template-columns: repeat(5, 1fr); row-gap: ${normalGap}px; column-gap: 6px; padding: 8px; width: 100%; max-width: 100%; margin: 0 auto; place-items: center;">
                        ${pageItems.map((pair, i) => `
                            <div class="quiz-item-5col" style="text-align: center; padding: 2px; width: 130px; height: 140px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;">
                                <div class="image-container" style="flex: 0 0 auto; display: flex; align-items: center; justify-content: center; width: 100%; height: 90px; position: relative;">
                                    ${renderImage(pair.imageUrl, pair.index, pair._originalEng || pair.eng, pair.kor, currentSettings)}
                                </div>
                                <div style="width: 90px; border-bottom: 2px solid #333; height: 24px; margin-top: 8px; flex-shrink: 0;"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            const tableHtml = `
                ${wordBoxHtml}
                ${gridHtml}
            `;
            return `
                <div class="worksheet-preview" style="${style}">
                    ${generateWorksheetHeader(title, true)}
                    ${printStyle}
                    ${tableHtml}
                </div>
            `;
        } catch (err) {
            return `<div class='preview-placeholder'><p>Error loading Picture Quiz (5 per row) layout.<br>${err && err.message ? err.message : err}</p></div>`;
        }
    }
    
    // --- PICTURE MATCHING LAYOUT ---
    if (layout === "picture-matching") {
        const limitedWordPairs = maskedPairs.slice(0, 10);
        const shuffledEnglish = [...limitedWordPairs].sort(() => Math.random() - 0.5);
        
        const imagePromises = limitedWordPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i, false, currentSettings);
            return { ...pair, imageUrl, index: i };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        
        const itemHeight = Math.max(80, currentSettings.imageGap + 60);
        const actualGap = currentSettings.imageGap;
        const totalHeight = pairsWithImages.length * itemHeight + (pairsWithImages.length - 1) * actualGap;
        
        const tableHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; padding: 20px; min-width: 700px;">
                <div style="width: 40%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${pairsWithImages.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px;">
                            <div style="padding: ${Math.max(10, actualGap/2)}px 15px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; min-height: 60px; justify-content: center;">
                                <div class="image-container" style="display: flex; align-items: center; justify-content: center;">
                                    ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng, pair.kor, currentSettings)}
                                </div>
                            </div>
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                        </div>
                    `).join('')}
                </div>
                <div style="width: 20%; min-height: ${totalHeight}px; position: relative; display: flex; align-items: center; justify-content: center;">
                    <div style="color: #ccc; font-size: 14px; text-align: center; font-style: italic;">
                        Draw lines<br>to connect
                    </div>
                </div>
                <div style="width: 40%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${shuffledEnglish.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px;">
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                            <div style="padding: ${Math.max(10, actualGap/2)}px 15px; background: #fff5f5; border: 2px solid #fed7d7; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1; min-height: 60px;">
                                ${pair.eng || 'word'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${printStyle}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- ENGLISH-KOREAN MATCHING LAYOUT ---
    if (layout === "eng-kor-matching") {
        const limitedWordPairs = maskedPairs.slice(0, 10);
        const shuffledKorean = [...limitedWordPairs].sort(() => Math.random() - 0.5);
        const itemHeight = Math.max(50, currentSettings.imageGap + 30);
        const actualGap = currentSettings.imageGap;
        const totalHeight = limitedWordPairs.length * itemHeight + (limitedWordPairs.length - 1) * actualGap;
        
        const tableHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; padding: 20px; min-width: 700px;">
                <div style="width: 40%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${limitedWordPairs.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px;">
                            <div style="padding: ${Math.max(10, actualGap/2)}px 15px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;">
                                ${pair.eng || 'word'}
                            </div>
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                        </div>
                    `).join('')}
                </div>
                <div style="width: 20%; min-height: ${totalHeight}px; position: relative; display: flex; align-items: center; justify-content: center;">
                    <div style="color: #ccc; font-size: 14px; text-align: center; font-style: italic;">
                        Draw lines<br>to connect
                    </div>
                </div>
                <div style="width: 40%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${actualGap}px;">
                    ${shuffledKorean.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px;">
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                            <div style="padding: ${Math.max(10, actualGap/2)}px 15px; background: #fff5f5; border: 2px solid #fed7d7; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;">
                                ${pair.kor || 'word'}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${tableHtml}
            </div>
        `;
    }
    
    // Default fallback - basic grid layout
    return `
        <div class="worksheet-preview" style="${style}">
            ${generateWorksheetHeader(title)}
            <div class="word-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); row-gap: ${currentSettings.imageGap}px; column-gap: 15px;">
                ${maskedPairs.map((pair, index) => `
                    <div class="word-card" style="
                        padding: 10px;
                        border: 1px solid #ccc;
                        border-radius: 8px;
                        text-align: center;
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    ">
                        <div style="font-weight: bold; margin-bottom: 5px;">${pair.eng || '______'}</div>
                        <div style="color: #666; font-size: 0.9em;">${pair.kor || '______'}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Generate worksheet header with logo, name, and date
function generateWorksheetHeader(title, isUltraCompact = false) {
    const design = currentSettings.design;
    
    let logoHeight, titleSize, labelSize, titleFont, marginBottom, padding;
    
    if (isUltraCompact) {
        // Ultra-compact settings for 5-per-row layout
        logoHeight = '30px';
        titleSize = '18px';
        labelSize = '11px';
        titleFont = 'Arial, sans-serif';
        marginBottom = '15px';
        padding = '8px';
    } else {
        // Regular settings based on design
        switch(design) {
            case 'Design 1':
                logoHeight = '50px';
                titleSize = '24px';
                labelSize = '14px';
                titleFont = 'Arial, sans-serif';
                break;
            case 'Design 2':
                logoHeight = '45px';
                titleSize = '28px';
                labelSize = '16px';
                titleFont = 'Georgia, serif';
                break;
            case 'Design 3':
                logoHeight = '55px';
                titleSize = '22px';
                labelSize = '12px';
                titleFont = 'Poppins, sans-serif';
                break;
            default:
                logoHeight = '50px';
                titleSize = '24px';
                labelSize = '14px';
                titleFont = 'Arial, sans-serif';
        }
        marginBottom = '30px';
        padding = '20px';
    }
    
    // Get the absolute path to the logo for printing
    const logoPath = new URL('../../../Assets/Images/color-logo.png', window.location.href).href;
    
    return `
        <div class="worksheet-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: ${marginBottom}; padding: ${padding}; border-bottom: ${isUltraCompact ? '1px' : '2px'} solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: ${isUltraCompact ? '8px' : '15px'};">
                <img src="${logoPath}" alt="Willena Logo" style="height: ${logoHeight}; width: auto;">
                <h2 style="margin: 0; font-size: ${titleSize}; color: #2d3748; font-family: ${titleFont};">${title}</h2>
            </div>
            <div style="display: flex; flex-direction: column; gap: ${isUltraCompact ? '4px' : '8px'}; min-width: ${isUltraCompact ? '180px' : '220px'};">
                <div style="display: flex; align-items: center; gap: ${isUltraCompact ? '4px' : '8px'};">
                    <span style="font-weight: bold; min-width: ${isUltraCompact ? '40px' : '50px'}; font-size: ${labelSize}; font-family: ${titleFont};">Name:</span>
                    <div style="flex: 1; border-bottom: 2px solid #333; height: ${isUltraCompact ? '16px' : '20px'};"></div>
                </div>
                <div style="display: flex; align-items: center; gap: ${isUltraCompact ? '4px' : '8px'};">
                    <span style="font-weight: bold; min-width: ${isUltraCompact ? '40px' : '50px'}; font-size: ${labelSize}; font-family: ${titleFont};">Date:</span>
                    <div style="flex: 1; border-bottom: 2px solid #333; height: ${isUltraCompact ? '16px' : '20px'};"></div>
                </div>
            </div>
        </div>
    `;
}

// Helper function to get placeholder image (imported from images.js)
function getPlaceholderImage(index, label = null) {
    const displayLabel = label || `Image ${index + 1}`;
    return `<div style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;font-size:14px;color:#666;">
        ${displayLabel}
    </div>`;
}

// Wait for all images in the preview area to load before printing
function waitForPreviewImagesToLoad(timeout = 5000) {
    return new Promise((resolve) => {
        const previewArea = document.getElementById('previewArea');
        if (!previewArea) return resolve();
        const images = previewArea.querySelectorAll('img');
        if (images.length === 0) return resolve();
        let loaded = 0;
        let done = false;
        function checkDone() {
            if (!done && loaded >= images.length) {
                done = true;
                resolve();
            }
        }
        images.forEach((img) => {
            if (img.complete && img.naturalWidth !== 0) {
                loaded++;
                checkDone();
            } else {
                img.addEventListener('load', () => {
                    loaded++;
                    checkDone();
                });
                img.addEventListener('error', () => {
                    loaded++;
                    checkDone();
                });
            }
        });
        // Fallback in case some images never load
        setTimeout(() => {
            if (!done) resolve();
        }, timeout);
    });
}

function printFile() {
    const layout = currentSettings.layout;
    const imageBasedLayouts = ['picture-list', 'picture-list-2col', 'picture-quiz', 'picture-quiz-5col', 'picture-matching', '6col-images', '5col-images'];
    if (imageBasedLayouts.includes(layout)) {
        // Show loading message for image-based layouts
        const loadingMessage = document.createElement('div');
        loadingMessage.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center;">
                <div style="border: 3px solid #f3f3f3; border-top: 3px solid #4299e1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <p style="margin: 0; font-size: 16px; color: #333;">Preparing images for print...</p>
                <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                </style>
            </div>
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;"></div>
        `;
        document.body.appendChild(loadingMessage);
        waitForPreviewImagesToLoad(5000).then(() => {
            document.body.removeChild(loadingMessage);
            performPrint();
        });
    } else {
        performPrint();
    }
}

function performPrint() {
    // Get the preview content
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) {
        alert('No preview content to print');
        return;
    }

    // Get selected font
    const fontSelect = document.getElementById('fontSelect');
    let selectedFont = fontSelect ? fontSelect.value : 'Arial';
    let fontFamilyCSS = selectedFont;
    let googleFontLink = '';
    // Map dropdown value to Google Fonts if needed
    if (selectedFont === 'Poppins') {
        fontFamilyCSS = 'Poppins, Arial, sans-serif';
        googleFontLink = '<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">';
    } else if (selectedFont === 'Caveat') {
        fontFamilyCSS = 'Caveat, Arial, sans-serif';
        googleFontLink = '<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&display=swap" rel="stylesheet">';
    } else if (selectedFont === 'Comic Sans MS') {
        fontFamilyCSS = '"Comic Sans MS", Arial, sans-serif';
    } else if (selectedFont === 'Times New Roman') {
        fontFamilyCSS = '"Times New Roman", Times, serif';
    } else if (selectedFont === 'Calibri') {
        fontFamilyCSS = 'Calibri, Arial, sans-serif';
    } else if (selectedFont === 'Verdana') {
        fontFamilyCSS = 'Verdana, Arial, sans-serif';
    } else if (selectedFont === 'Garamond') {
        fontFamilyCSS = 'Garamond, serif';
    }

    // Check if current layout is a 5-in-a-row layout that benefits from landscape mode
    const currentLayout = document.getElementById('layoutSelect').value;
    const landscapeLayouts = ['5col-images', 'picture-quiz-5col'];
    const isLandscapeLayout = landscapeLayouts.includes(currentLayout);

    // Create a new window for printing with only the preview content
    const printWindow = window.open('', '_blank', 'width=800,height=600');

    // Get the worksheet content
    const worksheetContent = previewArea.innerHTML;

    // Create the print document with proper styling
    const printDocument = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Worksheet</title>
            ${googleFontLink}
            <style>
                @page {
                    size: A4${isLandscapeLayout ? ' landscape' : ''};
                    margin: 0.5in;
                }

                body {
                    font-family: ${fontFamilyCSS};
                    margin: 0;
                    padding: 0;
                    background: white;
                }

                .worksheet-preview {
                    width: 100%;
                    max-width: none;
                    margin: 0;
                    padding: 0;
                    background: white;
                    font-family: ${fontFamilyCSS};
                }

                /* Hide drag instructions and interactive elements for print */
                .drag-instructions,
                .print-hide {
                    display: none !important;
                }
                
                /* Smart page break logic */
                .worksheet-header {
                    page-break-after: avoid;
                    page-break-inside: avoid;
                    margin-bottom: 20px;
                }
                
                /* Allow tables to break across pages for long content */
                table {
                    page-break-inside: auto;
                    border-collapse: collapse;
                    page-break-before: auto;
                    margin-bottom: 10px;
                }
                
                /* Keep table headers with content */
                thead {
                    display: table-header-group;
                    page-break-after: avoid;
                }
                
                /* Allow table rows to break, but avoid breaking within a row */
                tr {
                    page-break-inside: avoid;
                    page-break-before: auto;
                }
                
                /* Ensure first few rows stay with header */
                tbody tr:nth-child(-n+3) {
                    page-break-before: avoid;
                }
                
                /* Prevent orphaned single rows */
                tbody tr:nth-last-child(-n+2) {
                    page-break-before: avoid;
                }
                
                /* Better spacing for chunked tables */
                table:not(:first-of-type) {
                    page-break-before: auto;
                    margin-top: 20px;
                }
                
                /* Better page breaks for picture layouts */
                .picture-cards-page,
                .picture-cards-page,
                .picture-cards-page-5col,
                .picture-quiz-page,
                .picture-quiz-page-5col {
                    page-break-before: auto;
                    page-break-after: auto;
                    /* page-break-inside: avoid;  <-- Allow breaking inside grid for better fill */
                }
                
                .picture-cards-page:not(:first-child),
                .picture-cards-page-5col:not(:first-child),
                .picture-cards-page:not(:first-child),
                .picture-quiz-page:not(:first-child),
                .picture-quiz-page-5col:not(:first-child) {
                    /* Remove forced page breaks for natural grid flow */
                    page-break-before: auto;
                }
                
                /* Image styling for print */
                img {
                    max-width: 100%;
                    height: auto;
                    page-break-inside: avoid;
                }
                
                /* Remove interactive styling */
                .word-cell:hover,
                img:hover {
                    transform: none !important;
                    cursor: default !important;
                }
                
                /* Remove any onclick attributes and interactive elements */
                [onclick] {
                    cursor: default !important;
                    pointer-events: none !important;
                }
                
                /* Ensure proper grid layouts for print */
                .picture-cards-grid,
                .picture-cards-grid-5col,
                .picture-quiz-grid,
                .picture-quiz-grid-5col {
                    display: grid !important;
                    width: 100% !important;
                    margin: 0 auto !important;
                }
                
                /* Ultra-compact header for 5-column layouts */
                .picture-quiz-5col .worksheet-header {
                    margin-bottom: 12px !important;
                    padding: 6px !important;
                    border-bottom: 1px solid #e2e8f0 !important;
                }
                
                .picture-quiz-5col .worksheet-header img {
                    height: 25px !important;
                }
                
                .picture-quiz-5col .worksheet-header h2 {
                    font-size: 16px !important;
                }
                
                .picture-quiz-5col .worksheet-header span {
                    font-size: 10px !important;
                    min-width: 35px !important;
                }
                
                .picture-quiz-5col .worksheet-header div[style*="border-bottom"] {
                    height: 14px !important;
                }
                
                /* Compact word box for 5-column layouts */
                .picture-quiz-5col div[style*="background: #f9f9f9"] {
                    margin-bottom: 8px !important;
                    padding: 4px !important;
                }
                
                .picture-quiz-5col div[style*="background: #f9f9f9"] span {
                    padding: 1px 3px !important;
                    font-size: 0.7em !important;
                }
                
                /* Optimize 5-column layouts for landscape printing */
                .picture-quiz-grid-5col {
                    /* DON'T override row-gap - preserve JavaScript inline styles */
                    column-gap: 4px !important;
                    padding: 6px !important;
                    max-width: 100% !important;
                }
                
                .quiz-item-5col {
                    width: 120px !important;
                    height: 130px !important;
                    padding: 1px !important;
                }
                
                .quiz-item-5col .image-container {
                    height: 80px !important;
                    max-height: 80px !important;
                }
                
                .quiz-item-5col div[style*="border-bottom"] {
                    width: 85px !important;
                    height: 24px !important;
                    margin-top: 8px !important;
                }
                
                /* Ensure cards don't break across pages */
                .picture-card,
                .picture-card-5col,
                .quiz-item,
                .quiz-item-5col {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }
                
                /* Remove duplicate overlay for print */
                .dup-overlay-screen {
                    display: none !important;
                }
            </style>
        </head>
        <body>
            ${worksheetContent}
            <script>
                // Wait for web fonts to load before printing
                function waitForFonts(fontName, callback) {
                    if (document.fonts && fontName) {
                        document.fonts.load('1em ' + fontName).then(function() {
                            document.fonts.ready.then(callback);
                        });
                    } else {
                        setTimeout(callback, 500);
                    }
                }
                window.addEventListener('load', function() {
                    var fontName = ${JSON.stringify(selectedFont)};
                    waitForFonts(fontName, function() {
                        setTimeout(function() {
                            window.print();
                            window.close();
                        }, 100);
                    });
                });
            </script>
        </body>
        </html>
    `;

    // Write the document to the print window
    printWindow.document.write(printDocument);
    printWindow.document.close();
}

function generatePDF() {
    // Direct PDF export using html2pdf.js
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;
    
    // Ensure html2pdf is loaded
    if (typeof html2pdf === 'undefined') {
        // Load the library if not already loaded
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = function() {
            generatePDF(); // Call again after library loads
        };
        document.head.appendChild(script);
        return;
    }
    
    let title = document.getElementById('titleInput')?.value?.trim() || 'worksheet';
    title = title.replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '_');
    
    const opt = {
        margin: 0.5,
        filename: title + '.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(previewArea).save();
}
