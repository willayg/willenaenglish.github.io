// mint-ai-picture-modal.js - Picture Activity Modal
console.log('🚀 Picture Mode: Loading Picture Activity Modal...');

// Global picture source setting
window.currentPictureSource = 'any'; // Default to Any

// Immediately define the function - no complex structure
window.openPictureActivityModal = function(pictureMode = true, existingTextbox = null) {
    console.log('🎯 Picture Activity Modal called with textbox:', existingTextbox);
    
    // Use the globally set textbox if the passed one is null, for robustness.
    const targetTextbox = existingTextbox || window._currentlySelectedTextbox;
    console.log('Modal is targeting textbox:', targetTextbox);

    // Simple check for existing modal
    if (document.getElementById('picture-activities-modal')) {
        console.log('Modal already exists, closing it to reopen fresh.');
        document.getElementById('picture-activities-modal').remove();
    }
    
    // Simple fetch and display
    fetch('mint-ai/mint-ai-picture-modal.html')
        .then(response => response.text())
        .then(html => {
            console.log('HTML loaded, adding to page...');
            document.body.insertAdjacentHTML('beforeend', html);
            
            const modal = document.getElementById('picture-activities-modal');
            if (modal) {
                console.log('✅ Picture Activity Modal displayed');
                
                // Add close functionality
                const closeBtn = modal.querySelector('#close-picture-modal');
                if (closeBtn) {
                    closeBtn.onclick = function() { modal.remove(); };
                }
                
                // Load dependencies and initialize
                loadDependenciesSimple(modal, pictureMode, existingTextbox);
                
            } else {
                console.error('❌ Picture Activity Modal element not found');
            }
        })
        .catch(error => {
            console.error('❌ Error loading picture modal:', error);
            alert('Error loading Picture Activity Modal: ' + error.message);
        });
};

// Simple dependency loader
async function loadDependenciesSimple(modal, pictureMode, existingTextbox) {
    try {
        console.log('Loading core functionality...');
        
        // Simple initialization
        initializePictureModalSimple(modal, pictureMode, existingTextbox);
        
    } catch (error) {
        console.error('Error loading dependencies:', error);
        setupBasicPictureFunctionality(modal);
    }
}

// Complete modal initialization with all features
function initializePictureModalSimple(modal, pictureMode, existingTextbox) {
    console.log('Initializing picture modal with full functionality...');
    
    // Get all control elements
    const generateBtn = modal.querySelector('#picture-generate-btn');
    const promptInput = modal.querySelector('#picture-prompt-input');
    const uploadArea = modal.querySelector('#picture-upload-area');
    const previewArea = modal.querySelector('#picture-preview-area');
    const numImagesInput = modal.querySelector('#picture-numimages');
    const difficultySelect = modal.querySelector('#picture-difficulty');
    const clearBtn = modal.querySelector('#picture-clear-btn');
    const insertBtn = modal.querySelector('#picture-insert-btn');
    const cancelBtn = modal.querySelector('#picture-cancel-btn');
    const imageListArea = modal.querySelector('#picture-imagelist');
    
    // Setup mode switch (Prompt Input vs Upload Images)
    setupPictureModeSwitch(modal);
    
    // Settings icon (More Options) functionality
    const moreOptionsBtn = modal.querySelector('#picture-more-options-btn');
    const moreOptionsModal = modal.querySelector('#picture-more-options-modal');
    if (moreOptionsBtn && moreOptionsModal) {
        moreOptionsBtn.onclick = function() {
            moreOptionsModal.style.display = 'flex';
        };
        
        const moreOptionsClose = moreOptionsModal.querySelector('#picture-more-options-close');
        if (moreOptionsClose) {
            moreOptionsClose.onclick = function() {
                moreOptionsModal.style.display = 'none';
            };
        }
        
        // Click outside modal to close
        moreOptionsModal.onclick = function(e) {
            if (e.target === moreOptionsModal) {
                moreOptionsModal.style.display = 'none';
            }
        };
    }
    
    // Generate button functionality: Enter prompt → get words → load images
    if (generateBtn && promptInput && previewArea && imageListArea) {
        generateBtn.onclick = async function() {
            const prompt = promptInput.value.trim();
            const numImages = numImagesInput ? parseInt(numImagesInput.value) : 4;
            const difficulty = difficultySelect ? difficultySelect.value : 'simple';
            
            if (!prompt) {
                alert('Please enter a prompt for images.');
                return;
            }
            
            previewArea.innerHTML = '<div style="text-align:center;padding:20px;">Generating words and loading images...</div>';
            imageListArea.value = 'Processing...';
            
            try {
                // Step 1: Generate words from prompt using AI
                const words = await generateWordsFromPrompt(prompt, numImages, difficulty);
                console.log('Generated words:', words);
                
                // Step 2: Load images for each word
                const imageResults = await loadImagesForWords(words);
                console.log('Loaded images:', imageResults);
                
                // Step 3: Display results
                displayPictureResults(previewArea, imageListArea, imageResults);
                
            } catch (error) {
                console.error('Error in generate process:', error);
                previewArea.innerHTML = `<div style='color:red;text-align:center;padding:20px;'>Error: ${error.message}</div>`;
                imageListArea.value = 'Error occurred';
            }
        };
    }
    
    // Clear button functionality
    if (clearBtn && promptInput && previewArea && imageListArea) {
        clearBtn.onclick = function() {
            promptInput.value = '';
            previewArea.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">Preview will appear here...</div>';
            imageListArea.value = '';
        };
    }
    
    // Cancel button functionality
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.remove();
        };
    }
    
    // Insert button functionality
    if (insertBtn && previewArea) {
        insertBtn.onclick = function() {
            const previewContent = previewArea.innerHTML;
            if (previewContent && !previewContent.includes('Preview will appear here')) {
                // Add picture box to worksheet (similar to vocab box)
                addNewPictureBox(previewContent, {
                    prompt: promptInput ? promptInput.value : '',
                    numImages: numImagesInput ? numImagesInput.value : 4,
                    difficulty: difficultySelect ? difficultySelect.value : 'simple'
                });
                modal.remove();
            } else {
                alert('Please generate images first.');
            }
        };
    }
    
    // Initial setup
    if (previewArea) {
        previewArea.innerHTML = '<div style="text-align:center;padding:20px;color:#666;">Preview will appear here...</div>';
    }
}

// Setup picture mode switch (Prompt Input vs Upload Images)
function setupPictureModeSwitch(modal) {
    const promptBtn = modal.querySelector('#picture-prompt-btn');
    const uploadBtn = modal.querySelector('#picture-upload-btn');
    const promptInput = modal.querySelector('#picture-prompt-input');
    const uploadArea = modal.querySelector('#picture-upload-area');
    
    if (promptBtn && uploadBtn && promptInput && uploadArea) {
        promptBtn.onclick = function() {
            // Set prompt mode active
            promptBtn.style.background = '#f59e0b';
            promptBtn.style.color = '#fff';
            uploadBtn.style.background = '#e1e8ed';
            uploadBtn.style.color = '#666';
            
            // Show/hide areas
            promptInput.style.display = 'block';
            uploadArea.style.display = 'none';
        };
        
        uploadBtn.onclick = function() {
            // Set upload mode active
            uploadBtn.style.background = '#f59e0b';
            uploadBtn.style.color = '#fff';
            promptBtn.style.background = '#e1e8ed';
            promptBtn.style.color = '#666';
            
            // Show/hide areas
            promptInput.style.display = 'none';
            uploadArea.style.display = 'block';
        };
    }
}

// Step 1: Generate words from prompt using AI (mock implementation)
async function generateWordsFromPrompt(prompt, numWords, difficulty) {
    console.log('Generating words for prompt:', prompt);
    
    // Mock word generation - in real implementation, this would call an AI API
    const wordSets = {
        'animals': ['cat', 'dog', 'bird', 'fish', 'elephant', 'lion', 'tiger', 'bear'],
        'food': ['apple', 'banana', 'bread', 'milk', 'cheese', 'pizza', 'cake', 'rice'],
        'school': ['book', 'pencil', 'desk', 'teacher', 'student', 'classroom', 'homework', 'test'],
        'kitchen': ['spoon', 'knife', 'plate', 'cup', 'pot', 'stove', 'refrigerator', 'sink'],
        'farm': ['cow', 'pig', 'chicken', 'horse', 'barn', 'tractor', 'field', 'farmer']
    };
    
    // Find matching word set or use default
    let words = [];
    const lowerPrompt = prompt.toLowerCase();
    
    for (const [category, wordList] of Object.entries(wordSets)) {
        if (lowerPrompt.includes(category)) {
            words = wordList.slice(0, numWords);
            break;
        }
    }
    
    // If no match, generate generic words based on prompt keywords
    if (words.length === 0) {
        const promptWords = prompt.split(' ').filter(w => w.length > 2);
        words = promptWords.slice(0, numWords);
        
        // Fill remaining slots with common words if needed
        const commonWords = ['house', 'tree', 'car', 'flower', 'sun', 'moon', 'star', 'cloud'];
        while (words.length < numWords && commonWords.length > 0) {
            const word = commonWords.shift();
            if (!words.includes(word)) {
                words.push(word);
            }
        }
    }
    
    return words.slice(0, numWords);
}

// Step 2: Load images for each word using Netlify function (copied from vocab modal picture list mode)
async function loadImagesForWords(words) {
    console.log('Loading images for words using Netlify function:', words);
    const imageResults = [];
    
    for (const [index, word] of words.entries()) {
        try {
            const wordKey = `${word.toLowerCase()}_${index}`;
            console.log('Loading image for:', word);
            
            // Call Netlify function endpoint for each word (same as vocab modal)
            const response = await fetch(`/.netlify/functions/pixabay?q=${encodeURIComponent(word)}&image_type=photo&safesearch=true&order=popular&per_page=1&page=1`);
            const data = await response.json();
            
            console.log('Pixabay response for', word, ':', data);
            
            if (data.images && data.images.length > 0) {
                imageResults.push({
                    word: word,
                    image: {
                        webformatURL: data.images[0],
                        tags: word
                    },
                    success: true
                });
                console.log('Set image src to:', data.images[0]);
            } else {
                const placeholder = 'https://via.placeholder.com/150x120/f5f5f5/999999?text=No+Image';
                imageResults.push({
                    word: word,
                    image: {
                        webformatURL: placeholder,
                        tags: word
                    },
                    success: false
                });
                console.log('No images found, using placeholder');
            }
        } catch (error) {
            console.error('Error loading image for', word, ':', error);
            const errorPlaceholder = 'https://via.placeholder.com/150x120/f5f5f5/999999?text=Error';
            imageResults.push({
                word: word,
                image: {
                    webformatURL: errorPlaceholder,
                    tags: word
                },
                success: false,
                error: error.message
            });
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return imageResults;
}

// Step 3: Display picture results in grid format
function displayPictureResults(previewArea, imageListArea, imageResults) {
    console.log('Displaying picture results:', imageResults);
    
    // Create grid HTML
    let gridHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:18px;">';
    let imageList = [];

    imageResults.forEach(result => {
        if (result.success && result.image) {
            gridHtml += `
                <div class="picture-grid-item" style="background: url('${result.image.webformatURL}') center center / cover no-repeat, #fff; border-radius:10px; box-shadow:0 2px 8px rgba(60,60,80,0.08); padding:8px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; min-height:120px; height:120px; position:relative;">
                    <div style="background:rgba(255,255,255,0.82); border-radius:7px; padding:6px 12px; font-size:1.05em; color:#333; font-weight:700; text-align:center; position:relative; z-index:2; margin-bottom:8px;">${result.word}</div>
                </div>
            `;
            imageList.push(`${result.word}: ${result.image.webformatURL}`);
        } else {
            gridHtml += `
                <div class="picture-grid-item" style="background:#f8f9fa; border-radius:10px; box-shadow:0 2px 8px rgba(60,60,80,0.08); padding:8px; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; min-height:120px; height:120px; position:relative;">
                    <div style="background:rgba(255,255,255,0.82); border-radius:7px; padding:6px 12px; font-size:1.05em; color:#333; font-weight:700; text-align:center; position:relative; z-index:2; margin-bottom:8px;">${result.word}</div>
                </div>
            `;
            imageList.push(`${result.word}: [No image found]`);
        }
    });

    gridHtml += '</div>';
    previewArea.innerHTML = gridHtml;
    imageListArea.value = imageList.join('\n');
}

// Add new picture box to worksheet
function addNewPictureBox(pictureBoxHTML, modalState) {
    // Find the selected page, or fallback to last page
    const selected = document.querySelector('.page-preview-a4.selected');
    const pagesEls = document.querySelectorAll('.page-preview-a4');
    if (!pagesEls.length) {
        console.error('No pages found');
        return;
    }
    
    const pageEl = selected || pagesEls[pagesEls.length - 1];
    const pageIdx = Array.from(pagesEls).indexOf(pageEl);
    if (pageIdx === -1) {
        console.error('Could not find page index');
        return;
    }
    
    // Calculate position
    const previewRect = pageEl.getBoundingClientRect();
    let left = 80, top = 80;
    const boxWidth = 750, boxHeight = 400;
    
    if (previewRect) {
        const maxLeft = previewRect.width - boxWidth - 20;
        const maxTop = previewRect.height - boxHeight - 20;
        left = Math.min(left, Math.max(20, maxLeft));
        top = Math.min(top, Math.max(20, maxTop));
    }
    
    const boxData = {
        left: left + 'px',
        top: top + 'px',
        width: boxWidth + 'px',
        height: boxHeight + 'px',
        text: pictureBoxHTML,
        html: pictureBoxHTML,
        borderOn: true,
        borderColor: '#e1e8ed',
        borderWeight: 1.5,
        borderRadius: 4,
        lineHeight: '1.8',
        type: 'picture',
        pictureState: modalState
    };
    
    // Save to history before adding new textbox
    if (window.saveToHistory) {
        window.saveToHistory();
    }
    
    if (!window.worksheetState?.getPages()[pageIdx]) {
        console.error('Page state not found');
        return;
    }
    window.worksheetState.getPages()[pageIdx].boxes.push(boxData);
    
    // Re-render to show the new box
    if (window.renderPages) {
        window.renderPages();
    } else {
        console.error('renderPages function not found');
    }
    
    console.log('Added new picture box to page', pageIdx);
}

