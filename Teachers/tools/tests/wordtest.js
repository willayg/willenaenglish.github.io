// Word Worksheet Generator JavaScript

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

let hideRandomLetters = function(word, numLettersToHide = 1) {
    if (!word || word.length < 2) return word;
    return word.split('').map((char, i) => {
        if (i > 0 && /[a-zA-Z]/.test(char) && Math.random() < 0.3) {
            return '_';
        }
        return char;
    }).join('');
};

// Image functions
let getPixabayImage = null;
let imageCache = {};

// Simple emoji map for fallback
const emojiMap = {
    apple: "🍎", dog: "🐶", cat: "🐱", book: "📚", car: "🚗", 
    house: "🏠", tree: "🌳", sun: "☀️", moon: "🌙", star: "⭐",
    water: "💧", fire: "🔥", flower: "🌸", fish: "🐠", bird: "🐦",
    food: "🍎", eat: "🍽️", drink: "🥤", sleep: "😴", run: "🏃",
    walk: "🚶", happy: "😊", sad: "😢", big: "🔍", small: "🔎"
};

// Try to import the proper functions
async function loadModules() {
    try {
        const worksheetModule = await import('./worksheet.js');
        maskWordPairs = worksheetModule.maskWordPairs;
        hideRandomLetters = worksheetModule.hideRandomLetters;
        console.log('Worksheet module loaded successfully');
    } catch (error) {
        console.warn('Could not import worksheet.js, using fallback functions');
    }
    
    try {
        const imageModule = await import('./images.js');
        getPixabayImage = imageModule.getPixabayImage;
        imageCache = imageModule.imageCache;
        console.log('Images module loaded successfully');
    } catch (error) {
        console.warn('Could not import images.js, using placeholder images');
    }
}

// Image cycling state
let imageAlternatives = {}; // Store multiple image options for each word
let currentImageIndex = {}; // Track current image index for each word

// Helper function to get image URL with fallback
async function getImageUrl(word, index, refresh = false) {
    if (!word) return getPlaceholderImage(index);
    
    const wordKey = `${word.toLowerCase()}_${index}`;
    
    // Initialize image alternatives if not exists
    if (!imageAlternatives[wordKey]) {
        imageAlternatives[wordKey] = [];
        currentImageIndex[wordKey] = 0;
    }
    
    // If we need to refresh or don't have alternatives yet, load them
    if (refresh || imageAlternatives[wordKey].length === 0) {
        await loadImageAlternatives(word, wordKey);
    }
    
    // Return current image
    const currentIndex = currentImageIndex[wordKey] || 0;
    return imageAlternatives[wordKey][currentIndex] || getPlaceholderImage(index);
}

// Load multiple image alternatives for a word
async function loadImageAlternatives(word, wordKey) {
    const alternatives = [];
    
    // First, try emoji map
    const emoji = emojiMap[word.toLowerCase()];
    if (emoji) {
        alternatives.push(`<div style="font-size: ${currentSettings.imageSize * 0.8}px; line-height: 1;">${emoji}</div>`);
    }
    
    // Then try Pixabay if available (get multiple images)
    if (getPixabayImage) {
        try {
            // Try to get multiple variations by adding different search terms
            const searchVariations = [
                word,
                `${word} illustration`,
                `${word} icon`,
                `${word} cartoon`,
                `${word} symbol`
            ];
            // Only use the first 5 variations
            for (let i = 0; i < Math.min(searchVariations.length, 5); i++) {
                try {
                    const imageUrl = await getPixabayImage(searchVariations[i], true);
                    if (imageUrl && imageUrl.startsWith('http')) {
                        alternatives.push(imageUrl);
                    } else if (imageUrl && imageUrl.length === 1) {
                        // It's an emoji from Pixabay
                        alternatives.push(`<div style="font-size: ${currentSettings.imageSize * 0.8}px; line-height: 1;">${imageUrl}</div>`);
                    }
                } catch (error) {
                    console.warn('Error getting image variation for:', searchVariations[i], error);
                }
            }
        } catch (error) {
            console.warn('Error getting image alternatives for:', word, error);
        }
    }
    // Add placeholder as last option
    const index = parseInt(wordKey.split('_').pop()) || 0;
    alternatives.push(getPlaceholderImage(index));
    // Ensure we have at least 5 options by adding variations
    while (alternatives.length < 5) {
        alternatives.push(getPlaceholderImage(index, `Option ${alternatives.length + 1}`));
    }
    imageAlternatives[wordKey] = alternatives.slice(0, 5); // Keep only first 5
}

// Cycle to next image for a specific word
function cycleImage(word, index) {
    const wordKey = `${word.toLowerCase()}_${index}`;
    
    if (imageAlternatives[wordKey] && imageAlternatives[wordKey].length > 0) {
        currentImageIndex[wordKey] = (currentImageIndex[wordKey] + 1) % imageAlternatives[wordKey].length;
        updatePreview(); // Refresh the preview to show new image
    }
}

// Make cycleImage available globally for onclick handlers
window.cycleImage = cycleImage;

// Helper function to get placeholder image
function getPlaceholderImage(index, label = null) {
    const displayLabel = label || `Image ${index + 1}`;
    return `<div style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;font-size:14px;color:#666;">
        ${displayLabel}
    </div>`;
}

// Function to refresh all images
async function refreshImages() {
    console.log('Refreshing images...');
    const previewArea = document.getElementById('previewArea');
    if (previewArea) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Loading new images...</p></div>';
    }
    
    // Clear image cache and alternatives
    if (imageCache) {
        Object.keys(imageCache).forEach(key => delete imageCache[key]);
    }
    
    // Clear image alternatives to force reload
    imageAlternatives = {};
    currentImageIndex = {};
    
    // Small delay to show loading message
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update preview with new images
    await updatePreview();
}

// --- Custom Context Menu for Images ---
let imageContextMenu = null;
function showImageContextMenu(e, word, index, kor) {
    hideImageContextMenu();
    imageContextMenu = document.createElement('div');
    imageContextMenu.className = 'custom-image-context-menu';
    imageContextMenu.style.position = 'fixed';
    imageContextMenu.style.zIndex = 9999;
    imageContextMenu.style.top = e.clientY + 'px';
    imageContextMenu.style.left = e.clientX + 'px';
    imageContextMenu.style.background = '#fff';
    imageContextMenu.style.border = '1px solid #bbb';
    imageContextMenu.style.borderRadius = '6px';
    imageContextMenu.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    imageContextMenu.style.minWidth = '180px';
    imageContextMenu.style.fontFamily = 'Arial, sans-serif';
    imageContextMenu.style.fontSize = '15px';
    imageContextMenu.style.padding = '4px 0';
    imageContextMenu.innerHTML = `
        <div class="context-menu-item" data-action="search-again" style="padding:8px 18px;cursor:pointer;">Search again</div>
        <div class="context-menu-item" data-action="search-keyword" style="padding:8px 18px;cursor:pointer;">Search with new keyword</div>
        <div class="context-menu-item" data-action="search-korean" style="padding:8px 18px;cursor:pointer;">Search with Korean</div>
    `;
    document.body.appendChild(imageContextMenu);
    // Handle menu actions
    imageContextMenu.addEventListener('click', async function(ev) {
        const action = ev.target.getAttribute('data-action');
        if (!action) return;
        hideImageContextMenu();
        if (action === 'search-again') {
            await refreshImageForWord(word, index, true); // Always force refresh from Pixabay
        } else if (action === 'search-keyword') {
            const newKeyword = prompt('Enter a new keyword for image search:', word);
            if (newKeyword && newKeyword.trim()) {
                await refreshImageForWord(newKeyword.trim(), index, true);
            }
        } else if (action === 'search-korean') {
            if (kor && kor.trim()) {
                await refreshImageForWord(kor.trim(), index, true);
            } else {
                alert('No Korean translation available for this word.');
            }
        }
    });
    // Hide menu on click elsewhere
    setTimeout(() => {
        document.addEventListener('mousedown', hideImageContextMenu, { once: true });
    }, 0);
}
function hideImageContextMenu() {
    if (imageContextMenu) {
        imageContextMenu.remove();
        imageContextMenu = null;
    }
}
// Helper to refresh images for a single word/index
async function refreshImageForWord(word, index, forceNewKey = false) {
    const wordKey = `${word.toLowerCase()}_${index}`;
    if (forceNewKey) {
        // If searching with a new keyword, reset imageAlternatives and currentImageIndex for this slot
        imageAlternatives[wordKey] = undefined;
        currentImageIndex[wordKey] = 0;
    } else {
        // For search again, just clear alternatives to force reload
        imageAlternatives[wordKey] = undefined;
        currentImageIndex[wordKey] = 0;
    }
    await getImageUrl(word, index, true);
    updatePreview();
}

// Helper function to render an image (with right-click context menu)
function renderImage(imageUrl, index, word = null, kor = null) {
    const clickHandler = word ? `onclick="cycleImage('${word}', ${index})"` : '';
    const clickStyle = word ? 'cursor: pointer; transition: transform 0.2s;' : '';
    const hoverStyle = word ? 'onmouseover="this.style.transform=\'scale(1.05)\'" onmouseout="this.style.transform=\'scale(1)\'"' : '';
    // Add right-click handler for context menu
    const contextHandler = word ? `oncontextmenu="window.handleImageContextMenu && window.handleImageContextMenu(event, '${word.replace(/'/g, "\\'")}', ${index}, '${kor ? kor.replace(/'/g, "\\'") : ''}')"` : '';
    if (imageUrl.startsWith('<div')) {
        // It's an emoji or placeholder div - update font size and add click handler
        if (imageUrl.includes('font-size:')) {
            const updatedImageUrl = imageUrl.replace(/font-size:\s*\d+px/, `font-size: ${currentSettings.imageSize * 0.8}px`);
            if (word) {
                return updatedImageUrl.replace('<div style="', `<div style="cursor: pointer; transition: transform 0.2s; `).replace('>', ` ${clickHandler} ${hoverStyle} ${contextHandler}>`);
            }
            return updatedImageUrl;
        }
        if (word) {
            return imageUrl.replace('<div style="', `<div style="cursor: pointer; transition: transform 0.2s; `).replace('>', ` ${clickHandler} ${hoverStyle} ${contextHandler}>`);
        }
        return imageUrl;
    }
    // It's a real image URL
    return `<img src="${imageUrl}" style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;object-fit:cover;border-radius:8px;border:2px solid #ddd;${clickStyle}" alt="Image ${index + 1}" ${clickHandler} ${hoverStyle} ${contextHandler} title="${word ? `Click to cycle through ${word} images` : ''}">`;
}
// Expose handler globally
window.handleImageContextMenu = function(event, word, index, kor) {
    event.preventDefault();
    showImageContextMenu(event, word, index, kor);
};

// Add context menu CSS
if (!document.getElementById('custom-image-context-menu-style')) {
    const style = document.createElement('style');
    style.id = 'custom-image-context-menu-style';
    style.innerHTML = `
    .custom-image-context-menu {
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        border-radius: 6px;
        background: #fff;
        border: 1px solid #bbb;
        min-width: 180px;
        font-family: Arial, sans-serif;
        font-size: 15px;
        padding: 4px 0;
        position: fixed;
        z-index: 9999;
        animation: fadeInMenu 0.12s;
    }
    .custom-image-context-menu .context-menu-item {
        padding: 8px 18px;
        cursor: pointer;
        transition: background 0.15s;
    }
    .custom-image-context-menu .context-menu-item:hover {
        background: #f0f4ff;
    }
    @keyframes fadeInMenu {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
    }
    `;
    document.head.appendChild(style);
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

// AI Extraction function
async function extractWordsWithAI(passage, numWords = 10, difficulty = 'medium') {
  let promptContent = '';
  switch((difficulty || '').toLowerCase()) {
    case 'related':
      promptContent = `
You are an ESL teacher. Given the passage below, generate a list of exactly ${numWords} English words or short phrases that are conceptually or thematically related to the passage, but do NOT appear in the passage itself. Focus on words that are more advanced or challenging than the vocabulary found in the passage.

Guidelines:
- The words/phrases should be relevant to the topic, ideas, or context of the passage, but must not be present in the passage.
- Prefer academic, literary, or less common vocabulary that would help advanced students expand their knowledge.
- Avoid basic or overly simple words.
- Do NOT include duplicate or very similar words/phrases.
- Ensure you provide exactly ${numWords} distinct items.

For each word or phrase, provide the English, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
    case 'easy':
      promptContent = `
You are an ESL teacher working with beginner English learners. From the passage below, extract exactly ${numWords} simple and useful words that are:

- Basic vocabulary that beginners should learn
- Common everyday words and simple phrases
- High-frequency words that appear often in English
- Simple verbs, nouns, and adjectives
- Basic prepositions (in, on, at, with, etc.)

Focus on words that are:
- 1-2 syllables when possible
- Commonly used in daily conversation
- Essential for basic communication
- Easy to pronounce and remember

IMPORTANT: 
- Avoid complex vocabulary, idioms, or advanced grammar structures
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
    case 'medium':
      promptContent = `
You are an ESL teacher working with intermediate English learners. From the passage below, extract exactly ${numWords} moderately challenging words and phrases that include:

- Intermediate vocabulary (2-3 syllables)
- Common phrasal verbs (look up, turn on, etc.)
- Simple idiomatic expressions
- Useful prepositional phrases
- Common phrasal interjections and phrases (such as "instead of", "according to", "as well as", "in spite of", "in addition to", "as soon as", "in order to", "even though", "as if", "as though", "as long as", "as far as", "in case", "in fact", "in general", "in particular", "by the way", "at least", "at most", "for example", "for instance", "on the other hand", "however", "whenever", etc.)
- Connecting words (however, therefore, although, etc.)

Focus on words and phrases that:
- Are commonly used but not too basic
- Help students express more complex ideas
- Are useful for academic and everyday contexts
- Build on beginner vocabulary

IMPORTANT: 
- Avoid overly simple words or highly advanced terminology
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
    case 'hard':
      promptContent = `
You are an ESL teacher working with advanced English learners. From the passage below, extract exactly ${numWords} challenging and sophisticated words and phrases including:

- Advanced vocabulary and less common words
- All the phrasal verbs you can find (these are of utmost importance)
- Complex phrasal verbs and their variations
- Sophisticated idiomatic expressions
- Advanced prepositional and adverbial phrases
- Prepositional phrases (such as "in spite of", "according to", "in addition to", etc.)
- Connecting words (such as "however", "therefore", "although", "whenever", etc.)
- Conjunctions (such as "even though", "as if", "as though", "as long as", etc.)
- Phrases that include gerunds or infinitives (such as "promise to go", "couldn't stand listening", "look forward to meeting", "decided to leave", etc.)
- Academic and formal language structures
- Complex conjunctions and discourse markers
- Nuanced collocations and expressions

Focus on language that:
- Appears in academic, professional, or literary contexts
- Requires deeper understanding of English nuances
- Helps students sound more fluent and natural
- Challenges students to expand their vocabulary range
- Includes subtle meaning differences and connotations

IMPORTANT: 
- Prioritize all phrasal verbs, multi-word expressions, prepositional phrases, connecting words, conjunctions, phrases with gerunds or infinitives, complex grammar structures, and sophisticated vocabulary
- Do NOT include duplicate words or very similar words
- Make sure each word/phrase is unique and different from the others
- Ensure you provide exactly ${numWords} distinct items

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
    case 'phrases':
      promptContent = `
You are an ESL teacher. From the passage below, extract all the phrases and idioms (not single words) that appear in the text. Focus on:

- Multi-word expressions, collocations, and set phrases
- Idiomatic expressions and figurative language
- Phrasal verbs, prepositional phrases, and common sayings

IMPORTANT:
- Do NOT include simple adjective+noun or noun+noun combinations unless they are idioms, set phrases, or have a figurative/idiomatic meaning (e.g., "big rock" or "empty jar" should NOT be included unless they are part of an idiom)
- Only include phrases and idioms (no single words)
- Each item must be a phrase of two or more words
- Do NOT include duplicate or very similar phrases
- Provide as many unique phrases/idioms as you can find in the passage (up to ${numWords})

For each phrase or idiom, provide the English phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
      break;
    default:
      // Default to medium difficulty
      promptContent = `
You are an ESL teacher working with intermediate English learners. From the passage below, extract exactly ${numWords} moderately challenging words and phrases that include:

- Intermediate vocabulary (2-3 syllables)
- Common phrasal verbs (look up, turn on, etc.)
- Simple idiomatic expressions
- Useful prepositional phrases
- Common collocations (strong coffee, heavy rain)
- Connecting words (however, therefore, although)

For each word or phrase, provide the English word/phrase, then a comma, then the Korean translation.
Return each pair on a new line in the format: english, korean

Passage:
${passage}
      `;
  }

  try {
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
    return data.data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('AI extraction error:', error);
    throw error;
  }
}

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
    `;
    document.head.appendChild(style);

    // Add sample words for testing
    const sampleWords = `apple, 사과
dog, 개
cat, 고양이
book, 책
car, 자동차
house, 집`;

    document.getElementById('wordListTextarea').value = sampleWords;

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
    document.getElementById('refreshBtn').addEventListener('click', refreshImages);

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
                        updatePreview();
                    });
                } else {
                    numLettersInput.style.display = '';
                }
            } else if (numLettersInput) {
                numLettersInput.style.display = 'none';
            }
            updatePreview();
        });
    }

    // Top action buttons
    // Save Worksheet button: open worksheet manager in save mode
    document.getElementById('saveBtn').addEventListener('click', function() {
        window.open('/Teachers/worksheet_manager.html?mode=save', 'WorksheetManager', 'width=600,height=700');
    });
    // Load Worksheet button: open worksheet manager in load mode
    document.getElementById('loadBtn').addEventListener('click', function() {
        window.open('/Teachers/worksheet_manager.html?mode=load', 'WorksheetManager', 'width=800,height=700');
    });
    document.getElementById('printBtn').addEventListener('click', printFile);
    document.getElementById('pdfBtn').addEventListener('click', generatePDF);

    // Form inputs
    document.getElementById('titleInput').addEventListener('input', updatePreview);
    document.getElementById('passageInput').addEventListener('input', updatePreview);
    document.getElementById('difficultySelect').addEventListener('change', updatePreview);
    document.getElementById('wordCountInput').addEventListener('change', updatePreview);

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
    // Only save worksheet_type, title, passage_text, words, layout, and settings
    // settings: font, fontSize, design, imageSize, imageGap, testMode
    const settings = {
        font: currentSettings.font,
        fontSize: currentSettings.fontSize,
        design: currentSettings.design,
        imageSize: currentSettings.imageSize,
        imageGap: currentSettings.imageGap,
        testMode: currentSettings.testMode
    };
    return {
        worksheet_type: 'wordtest',
        title,
        passage_text: passage,
        words,
        layout: currentSettings.layout,
        settings: JSON.stringify(settings)
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
    }
    // Restore layout
    if (worksheet.layout && document.getElementById('layoutSelect')) {
        document.getElementById('layoutSelect').value = worksheet.layout;
        currentSettings.layout = worksheet.layout;
    }

    // Update currentWords and preview
    updateCurrentWordsFromTextarea();
    highlightDuplicates();
    updatePreview();
}
window.loadWorksheet = loadWorksheet;

// Font and styling functions
function updateFont() {
    currentSettings.font = document.getElementById('fontSelect').value;
    updatePreview();
}

function updateFontSize() {
    currentSettings.fontSize = parseInt(document.getElementById('fontSizeInput').value);
    updatePreview();
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
        updatePreview();
    }
}

function updateImageSize() {
    const slider = document.getElementById('imageSizeSlider');
    if (slider) {
        currentSettings.imageSize = parseInt(slider.value);
        console.log('Image size updated to:', currentSettings.imageSize);
        updatePreview();
    }
}

function updateLayout() {
    currentSettings.layout = document.getElementById('layoutSelect').value;
    updatePreview();
}

// No longer needed: test mode is now a dropdown

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

function displayWordList() {
    // This function is now replaced by the textarea
    // Words are displayed directly in the textarea
    const textarea = document.getElementById('wordListTextarea');
    const wordsText = currentWords.map(word => `${word.eng}, ${word.kor}`).join('\n');
    textarea.value = wordsText;
}

function clearAll() {
    currentWords = [];
    // Do not reset title, passageInput, wordCountInput, or difficulty
    // document.getElementById('titleInput').value = '';
    // document.getElementById('passageInput').value = '';
    // document.getElementById('wordCountInput').value = '10';
    // document.getElementById('difficultySelect').value = 'Easy';
    document.getElementById('wordListTextarea').value = '';

    // Hide duplicate warning
    const duplicateWarning = document.getElementById('duplicateWarning');
    if (duplicateWarning) {
        duplicateWarning.style.display = 'none';
    }

    updatePreview();
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
            updatePreview();
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
            input.style.fontSize = 'inherit';
            input.style.fontFamily = 'inherit';
            input.style.textAlign = 'center';
            input.style.background = '#fffbe6';
            input.style.border = '1px solid #ccc';
            input.style.borderRadius = '4px';
            input.style.padding = '2px 4px';
            input.style.boxSizing = 'border-box';
            // Replace cell content
            cell.innerHTML = '';
            cell.appendChild(input);
            input.focus();
            input.select();
            // Save on Enter or blur
            function saveEdit() {
                const newVal = input.value.trim();
                if (newVal !== currentVal) {
                    pushWorksheetUndo();
                    currentWords[idx][lang] = newVal;
                    document.getElementById('wordListTextarea').value = currentWords.map(word => `${word.eng}, ${word.kor}`).join('\n');
                }
                updatePreview();
            }
            input.addEventListener('keydown', function(ev) {
                if (ev.key === 'Enter') {
                    saveEdit();
                } else if (ev.key === 'Escape') {
                    updatePreview();
                }
            });
            input.addEventListener('blur', saveEdit);
        }
    });

    // Add Ctrl+Z (undo) support for worksheet edits
    document.addEventListener('keydown', worksheetUndoKeyHandler);

    // Remove the keydown handler when preview is regenerated
    previewArea.addEventListener('remove', function() {
        document.removeEventListener('keydown', worksheetUndoKeyHandler);
    });

    console.log('Word cell interactivity added to preview area.');
}

function worksheetUndoKeyHandler(e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoWorksheetEdit();
    }
}

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
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Enter words in the word list to see preview</p></div>';
        return;
    }
    
    // Show loading spinner for image-based layouts
    const layout = currentSettings.layout;
    const imageBasedLayouts = ['picture-list', 'picture-list-2col', 'picture-quiz', 'picture-matching', '6col-images'];
    
    if (imageBasedLayouts.includes(layout)) {
        previewArea.innerHTML = `
            <div class="preview-placeholder" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 200px;">
                <div style="border: 3px solid #f3f3f3; border-top: 3px solid #4299e1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 15px;"></div>
                <p>Loading images...</p>
                <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                </style>
            </div>
        `;
    }
    
    const worksheetHTML = await generateWorksheetHTML(title, currentWords);
    previewArea.innerHTML = worksheetHTML;
    // Add interactive editing/deletion to word cells
    addWordCellInteractivity(previewArea);
    console.log('Preview updated');
}

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
    // Find duplicate English and Korean words (case-insensitive, separate)
    const engCounts = {};
    const korCounts = {};
    wordPairs.forEach(pair => {
        const eng = (pair.eng || '').trim().toLowerCase();
        const kor = (pair.kor || '').trim().toLowerCase();
        if (eng) engCounts[eng] = (engCounts[eng] || 0) + 1;
        if (kor) korCounts[kor] = (korCounts[kor] || 0) + 1;
    });
    // Helpers to check if a word is a duplicate
    function isDuplicateEng(eng) {
        return eng && engCounts[eng.trim().toLowerCase()] > 1;
    }
    function isDuplicateKor(kor) {
        return kor && korCounts[kor.trim().toLowerCase()] > 1;
    }
    
    // --- Table cell highlighter for all table-based layouts ---
    function highlightCell(content, isDup) {
        const overlay = isDup ? '<span class="dup-overlay-screen" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,140,0,0.25);pointer-events:none;z-index:1;"></span>' : '';
        return `<span style="position:relative;display:inline-block;width:100%;">${overlay}<span style="position:relative;z-index:2;">${content}</span></span>`;
    }

    // Add print CSS to hide overlays when printing
    const printStyle = `<style>@media print { .dup-overlay-screen { display: none !important; } }</style>`;

    // --- BASIC TABLE LAYOUT ---
    if (layout === "default") {
        const tableHtml = `
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
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${printStyle}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- TWO LISTS LAYOUT (SIDE BY SIDE) ---
    if (layout === "4col") {
        const half = Math.ceil(maskedPairs.length / 2);
        const left = maskedPairs.slice(0, half);
        const right = maskedPairs.slice(half);
        // Pad right side to match left side length
        while (right.length < left.length) {
            right.push({ eng: "", kor: "" });
        }
        
        const tableHtml = `
            <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                <colgroup>
                    <col style="width:5%;">
                    <col style="width:25%;">
                    <col style="width:25%;">
                    <col style="width:3%;">
                    <col style="width:5%;">
                    <col style="width:25%;">
                    <col style="width:25%;">
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
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${i + 1}</td>
                            <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(left[i]?.eng || '______', isDupEngL)}</td>
                            <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:8px;border-bottom:1px solid #ddd;text-align:center;cursor:pointer;">${highlightCell(left[i]?.kor || '______', isDupKorL)}</td>
                            <td style="border-left:2px solid #e0e0e0;background:transparent;border-bottom:none;padding:0;"></td>
                            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
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
            // Always use the original English for image lookup, even if hidden
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i);
            return {
                ...pair,
                imageUrl,
                index: i
            };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        // Use image gap for row height and padding
        const rowHeight = Math.max(currentSettings.imageSize + currentSettings.imageGap, 100);
        const cellPadding = Math.max(currentSettings.imageGap / 2, 8);
        const tableHtml = `
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
                                <div style="display:flex;align-items:center;justify-content:center;margin:0 auto;">
                                    ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng)}
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
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${printStyle}
                ${tableHtml}
            </div>
        `;
    }
    
    // --- PICTURE LIST LAYOUT (2 COLUMNS) ---
    if (layout === "picture-list-2col") {
        console.log('Generating Picture List (2 Columns) layout with', maskedPairs.length, 'words');
        const half = Math.ceil(maskedPairs.length / 2);
        const left = maskedPairs.slice(0, half);
        const right = maskedPairs.slice(half);
        
        // Pad right side to match left side length
        while (right.length < left.length) {
            // Use a special blank marker for empty cells
            right.push({ eng: null, kor: null, _originalEng: null, imageUrl: null });
        }
        const leftImagePromises = left.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i);
            return {
                ...pair,
                imageUrl,
                index: i
            };
        });
        const leftPairsWithImages = await Promise.all(leftImagePromises);
        const rightImagePromises = right.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i + half);
            return {
                ...pair,
                imageUrl,
                index: i + half
            };
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
                                <div style="display:flex;align-items:center;justify-content:center;margin:0 auto;">
                                    ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng)}
                                </div>
                            </td>
                            <td class="word-cell" data-index="${i}" data-lang="eng" style="position:relative;padding:${Math.max(currentSettings.imageGap/2, 5)}px 8px;border-bottom:1px solid #ddd;font-size:1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(left[i]?.eng || '______', isDupEngL)}</td>
                            <td class="word-cell" data-index="${i}" data-lang="kor" style="position:relative;padding:${Math.max(currentSettings.imageGap/2, 5)}px 8px;border-bottom:1px solid #ddd;font-size:1em;text-align:center;font-weight:500;cursor:pointer;">${highlightCell(left[i]?.kor || '______', isDupKorL)}</td>
                            <td style="border-left:2px solid #e0e0e0;background:transparent;border-bottom:none;padding:0;"></td>
                            <td style="padding:${Math.max(currentSettings.imageGap/2, 5)}px 4px;border-bottom:1px solid #ddd;text-align:center;font-size:1em;font-weight:500;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                            <td style="padding:${Math.max(currentSettings.imageGap/2, 5)}px 4px;border-bottom:1px solid #ddd;text-align:center;">
                                <div style="display:flex;align-items:center;justify-content:center;margin:0 auto;">
                                    ${isBlank ? '' : (rightPairsWithImages[i] && rightPairsWithImages[i].imageUrl ? renderImage(rightPairsWithImages[i].imageUrl, i + half, rightPairsWithImages[i]._originalEng || rightPairsWithImages[i].eng) : "")}
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
            const limitedWordPairs = maskedPairs.slice(0, 12);
            if (!Array.isArray(limitedWordPairs) || limitedWordPairs.length === 0) {
                return `<div class='preview-placeholder'><p>No words available for Picture Quiz layout.</p></div>`;
            }
            // Fetch images for each word, fallback to placeholder if error
            const pairsWithImages = await Promise.all(limitedWordPairs.map(async (pair, i) => {
                try {
                    const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i);
                    return { ...pair, imageUrl, index: i };
                } catch (err) {
                    return { ...pair, imageUrl: getPlaceholderImage(i), index: i };
                }
            }));
            // Word box (always shown)
            const wordBoxHtml = `
                <div style="margin-bottom: 15px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9;">
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;">
                        ${pairsWithImages.map(pair => `<span style="padding: 2px 6px; background: #fff; border: 1px solid #ddd; border-radius: 3px; font-size: 0.8em;">${pair._originalEng || pair.eng || 'word'}</span>`).join('')}
                    </div>
                </div>
            `;
            const tableHtml = `
                ${wordBoxHtml}
                <div class="picture-quiz-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); row-gap: ${currentSettings.imageGap}px; column-gap: 15px; padding: 20px; width: 100%; max-width: 750px; margin: 0 auto; place-items: center;">
                    ${pairsWithImages.map((pair, i) => `
                        <div class="quiz-item" style="text-align: center; padding: 10px; width: 220px; height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: space-between;">
                            <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; max-height: 160px;">
                                ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng)}
                            </div>
                            <div style="width: 120px; border-bottom: 2px solid #333; height: 25px; margin-top: 15px;"></div>
                        </div>
                    `).join('')}
                </div>
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
    
    // --- PICTURE MATCHING LAYOUT ---
    if (layout === "picture-matching") {
        const limitedWordPairs = maskedPairs.slice(0, 8);
        const shuffledWords = [...limitedWordPairs].sort(() => Math.random() - 0.5);
        const itemHeight = Math.max(currentSettings.imageSize + 20, 60);
        const totalHeight = limitedWordPairs.length * itemHeight + (limitedWordPairs.length - 1) * currentSettings.imageGap;
        
        const imagePromises = limitedWordPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair.eng, i);
            return {
                ...pair,
                imageUrl,
                index: i
            };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        
        const tableHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; padding: 20px; min-width: 700px;">
                <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${currentSettings.imageGap}px;">
                    ${pairsWithImages.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px;">
                            <div style="display: flex; align-items: center;">
                                ${renderImage(pair.imageUrl, i, pair.eng)}
                            </div>
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                        </div>
                    `).join('')}
                </div>
                <div style="width: 30%; min-height: ${totalHeight}px; position: relative; display: flex; align-items: center; justify-content: center;">
                    <div style="color: #ccc; font-size: 14px; text-align: center; font-style: italic;">
                        Draw lines<br>to connect
                    </div>
                </div>
                <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${currentSettings.imageGap}px;">
                    ${shuffledWords.map((pair, i) => `
                        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px;">
                            <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                            <div style="padding: 12px 16px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;">
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
                ${tableHtml}
            </div>
        `;
    }
    
    // --- IMAGES LAYOUT (Grid with images) --- TEMPORARILY COMMENTED OUT
    /*
    if (layout === "images") {
        const imagePromises = maskedPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair.eng, i);
            return {
                ...pair,
                imageUrl,
                index: i
            };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        
        const gridHtml = `
            <div class="image-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); row-gap: ${Math.max(currentSettings.imageGap, 15)}px; column-gap: 15px; padding: 20px; width: 100%; max-width: 750px; margin: 0 auto; place-items: center;">
                ${pairsWithImages.map((pair, i) => `
                    <div class="image-grid-item" style="
                        padding: 15px;
                        border: 1px solid #e2e8f0;
                        border-radius: 8px;
                        text-align: center;
                        background: white;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        width: 220px;
                        height: 260px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: space-between;
                    ">
                        <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; max-height: 180px;">
                            ${renderImage(pair.imageUrl, i, pair.eng)}
                        </div>
                        <div style="width: 100%; text-align: center; margin-top: 10px;">
                            <div style="font-weight: bold; margin-bottom: 6px; font-size: 1.1em; word-wrap: break-word;">${pair.eng || '______'}</div>
                            <div style="color: #666; font-size: 0.9em; word-wrap: break-word;">${pair.kor || '______'}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${gridHtml}
            </div>
        `;
    }
    */
    
    // --- 6COL IMAGES LAYOUT (Picture Cards) ---
    if (layout === "6col-images") {
        const limitedWordPairs = maskedPairs.slice(0, 12);
        const imagePromises = limitedWordPairs.map(async (pair, i) => {
            const imageUrl = await getImageUrl(pair._originalEng || pair.eng, i);
            return {
                ...pair,
                imageUrl,
                index: i
            };
        });
        const pairsWithImages = await Promise.all(imagePromises);
        // Calculate dynamic padding based on gap size
        const cardWidth = 220;
        const baseGap = Math.max(currentSettings.imageGap, 15);
        const dynamicPadding = Math.max(20, baseGap / 2);
        const gridHtml = `
            <div class="picture-cards-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); row-gap: ${baseGap}px; column-gap: 15px; padding: ${dynamicPadding}px; width: 100%; max-width: 750px; margin: 0 auto; place-items: center;">
                ${pairsWithImages.map((pair, i) => `
                    <div class="picture-card" style="
                        padding: 15px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        text-align: center;
                        background: white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        width: ${cardWidth}px;
                        height: 260px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: space-between;
                    ">
                        <div style="flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; max-height: 180px;">
                            ${renderImage(pair.imageUrl, i, pair._originalEng || pair.eng)}
                        </div>
                        <div style="width: 100%; text-align: center; margin-top: 10px;">
                            <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 6px; word-wrap: break-word;">${pair.eng || '______'}</div>
                            <div style="color: #555; font-size: 0.9em; word-wrap: break-word;">${pair.kor || '______'}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        return `
            <div class="worksheet-preview" style="${style}">
                ${generateWorksheetHeader(title)}
                ${gridHtml}
            </div>
        `;
    }
    
    // --- ENGLISH-KOREAN MATCHING LAYOUT ---
    if (layout === "eng-kor-matching") {
        const limitedWordPairs = maskedPairs.slice(0, 10);
        const shuffledKorean = [...limitedWordPairs].sort(() => Math.random() - 0.5);
        const itemHeight = Math.max(50, currentSettings.imageGap + 30); // Make item height responsive to gap
        const actualGap = currentSettings.imageGap; // Use full image gap value
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
    
    // Default to grid layout for other options
    const displayPairs = currentSettings.testMode ? maskedPairs : wordPairs;
    
    // For any remaining layouts, use a basic grid with images
    const imagePromises = displayPairs.map(async (pair, i) => {
        const imageUrl = await getImageUrl(pair.eng, i);
        return {
            ...pair,
            imageUrl,
            index: i
        };
    });
    const pairsWithImages = await Promise.all(imagePromises);
    
    return `
        <div class="worksheet-preview" style="${style}">
            ${generateWorksheetHeader(title)}
            <div class="word-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); row-gap: ${currentSettings.imageGap}px; column-gap: 15px;">
                ${pairsWithImages.map((pair, index) => {
                    const displayWord = pair.eng || '______';
                    const displayKorean = pair.kor || '______';
                    
                    return `
                        <div class="word-card" style="
                            padding: 15px;
                            border: 1px solid #e2e8f0;
                            border-radius: 8px;
                            text-align: center;
                            background: white;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                        ">
                            <div style="margin-bottom: 12px; display: flex; justify-content: center; align-items: center;">
                                ${renderImage(pair.imageUrl, index, pair.eng)}
                            </div>
                            <div style="font-weight: bold; margin-bottom: 5px;">${displayWord}</div>
                            <div style="color: #666; font-size: 0.9em;">${displayKorean}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// Generate worksheet header with logo, name, and date
function generateWorksheetHeader(title) {
    const design = currentSettings.design;
    
    // Design-specific settings
    let logoHeight, titleSize, labelSize, titleFont;
    
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
    
    return `
        <div class="worksheet-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; padding: 20px; border-bottom: 2px solid #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 15px;">
                <img src="../../../Assets/Images/color-logo.png" alt="Willena Logo" style="height: ${logoHeight}; width: auto;">
                <h2 style="margin: 0; font-size: ${titleSize}; color: #2d3748; font-family: ${titleFont};">${title}</h2>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; min-width: 220px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; min-width: 50px; font-size: ${labelSize}; font-family: ${titleFont};">Name:</span>
                    <div style="flex: 1; border-bottom: 2px solid #333; height: 20px;"></div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: bold; min-width: 50px; font-size: ${labelSize}; font-family: ${titleFont};">Date:</span>
                    <div style="flex: 1; border-bottom: 2px solid #333; height: 20px;"></div>
                </div>
            </div>
        </div>
    `;
}

async function refreshPreview() {
    await updatePreview();
}

// File operations
function loadFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    loadWorksheetData(data);
                } catch (error) {
                    alert('Error loading file: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function saveFile() {
    const data = {
        title: document.getElementById('titleInput').value,
        passage: document.getElementById('passageInput').value,
        difficulty: document.getElementById('difficultySelect').value,
        wordCount: document.getElementById('wordCountInput').value,
        wordList: document.getElementById('wordListTextarea').value,
        settings: currentSettings
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worksheet.json';
    a.click();
    URL.revokeObjectURL(url);
}

function printFile() {
    const layout = currentSettings.layout;
    const imageBasedLayouts = ['picture-list', 'picture-list-2col', 'picture-quiz', 'picture-matching', '6col-images'];
    
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
        
        // Allow a short delay for images to load
        setTimeout(() => {
            document.body.removeChild(loadingMessage);
            performPrint();
        }, 1000);
    } else {
        performPrint();
    }
}

function performPrint() {
    const previewContent = document.getElementById('previewArea').innerHTML;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Word Worksheet</title>
                <style>
                    body { font-family: ${currentSettings.font}; padding: 20px; }
                    .worksheet-preview { max-width: 800px; margin: 0 auto; }
                    .word-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); row-gap: ${currentSettings.imageGap}px; column-gap: 15px; }
                    .word-card { padding: 10px; border: 1px solid #ccc; border-radius: 8px; text-align: center; }
                    @media print { body { margin: 0; } }
                </style>
            </head>
            <body>${previewContent}</body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function generatePDF() {
    // This would require a PDF library like jsPDF
    alert('PDF generation feature would be implemented with jsPDF library');
}

function loadWorksheetData(data) {
    document.getElementById('titleInput').value = data.title || '';
    document.getElementById('passageInput').value = data.passage || '';
    document.getElementById('difficultySelect').value = data.difficulty || 'Easy';
    document.getElementById('wordCountInput').value = data.wordCount || '10';
    
    // Load word list from either new format (wordList) or old format (words)
    if (data.wordList) {
        document.getElementById('wordListTextarea').value = data.wordList;
    } else if (data.words) {
        // Convert old format to new format
        const wordList = data.words.map(word => {
            if (typeof word === 'string') {
                return `${word}, ${word}`;  // Fallback for old single-word format
            } else if (word.eng && word.kor) {
                return `${word.eng}, ${word.kor}`;
            }
            return '';
        }).filter(line => line).join('\n');
        document.getElementById('wordListTextarea').value = wordList;
    }
    
    if (data.settings) {
        currentSettings = { ...currentSettings, ...data.settings };
        updateControlsFromSettings();
    }
    
    // Update current words and preview
    updateCurrentWordsFromTextarea();
    highlightDuplicates();
    updatePreview();
}

function updateControlsFromSettings() {
    document.getElementById('fontSelect').value = currentSettings.font;
    document.getElementById('fontSizeInput').value = currentSettings.fontSize;
    document.getElementById('designSelect').value = currentSettings.design;
    document.getElementById('imageGapSlider').value = currentSettings.imageGap;
    document.getElementById('imageSizeSlider').value = currentSettings.imageSize;
    document.getElementById('layoutSelect').value = currentSettings.layout;
}