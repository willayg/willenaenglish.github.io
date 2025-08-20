// mint-ai-vocab-modal-fixed.js - Bulletproof version
console.log('🚀 FIXED VERSION: Loading Mint AI Vocab Modal...');

// Global picture source setting
window.currentPictureSource = 'any'; // Default to Any

// Immediately define the function - no complex structure
window.openVocabBoxModal = function(pictureMode = false, existingTextbox = null) {
    console.log('🎯 FIXED: openVocabBoxModal called with textbox:', existingTextbox);
    
    // Use the globally set textbox if the passed one is null, for robustness.
    const targetTextbox = existingTextbox || window._currentlySelectedTextbox;
    console.log('Modal is targeting textbox:', targetTextbox);

    // Simple check for existing modal
    if (document.getElementById('vocab-box-modal')) {
        console.log('Modal already exists, closing it to reopen fresh.');
        document.getElementById('vocab-box-modal').remove();
    }
    
    // Simple fetch and display
    fetch('mint-ai/mint-ai-vocab-modal.html')
        .then(response => response.text())
        .then(html => {
            console.log('HTML loaded, adding to page...');
            document.body.insertAdjacentHTML('beforeend', html);
            
            const modal = document.getElementById('vocab-box-modal');
            if (modal) {
                console.log('✅ Modal added successfully!');
                
                // Simple close functionality
                const closeBtn = modal.querySelector('#close-vocab-modal');
                const cancelBtn = modal.querySelector('#vocab-cancel-btn');
                
                function closeModal() {
                    modal.remove();
                    window._currentlySelectedTextbox = null; // Clean up global reference
                }
                
                if (closeBtn) closeBtn.onclick = closeModal;
                if (cancelBtn) cancelBtn.onclick = closeModal;
                
                // Add working functionality
                console.log('Setting up modal functionality...');
                
                // Load the core and UI modules, passing the correct textbox.
                loadDependenciesSimple(modal, pictureMode, targetTextbox);
                
            } else {
                console.error('Modal element not found after adding HTML');
            }
        })
        .catch(error => {
            console.error('Error loading modal:', error);
            alert('Error: ' + error.message);
        });
};

// Simple dependency loader
async function loadDependenciesSimple(modal, pictureMode, existingTextbox) {
    try {
        console.log('Loading core functionality...');
        
        // Load the textbox handler first
        await loadScriptSimple('mint-ai/vocab-textbox-handler.js');
        
        // Load the word list manager for recents functionality
        await loadScriptSimple('mint-ai/word-list-manager.js');
        
        // Load scripts one by one
        await loadScriptSimple('mint-ai/mint-ai-vocab-core.js');
        await loadScriptSimple('mint-ai/mint-ai-vocab-ui.js');
        
        console.log('Scripts loaded, initializing...');
        
        // Initialize WordListManager if available
        if (window.WordListManager && typeof window.WordListManager.init === 'function') {
            window.WordListManager.init();
            console.log('✅ WordListManager initialized');
        }
        
        // Simple initialization
        if (window.MintAIVocabCore && window.MintAIVocabUI) {
            initializeModalSimple(modal, pictureMode, existingTextbox);
        } else {
            console.warn('Core modules not available, using basic functionality');
            setupBasicFunctionality(modal);
        }
        
    } catch (error) {
        console.error('Error loading dependencies:', error);
        setupBasicFunctionality(modal);
    }
}

// Helper to load scripts
function loadScriptSimple(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Complete modal initialization with all features
function initializeModalSimple(modal, pictureMode, existingTextbox) {
    console.log('Initializing modal with full functionality...');
    
    const core = window.MintAIVocabCore;
    const ui = window.MintAIVocabUI;
    
    if (!core || !ui) {
        setupBasicFunctionality(modal);
        return;
    }
    
    // Get all control elements
    const generateBtn = modal.querySelector('#vocab-generate-btn');
    const topicInput = modal.querySelector('#vocab-topic-input');
    const passageInput = modal.querySelector('#vocab-passage');
    const wordlistInput = modal.querySelector('#vocab-wordlist');
    const previewArea = modal.querySelector('#vocab-preview-area');
    const formatSelect = modal.querySelector('#vocab-list-format');
    const clearBtn = modal.querySelector('#vocab-clear-btn');
    const insertBtn = modal.querySelector('#vocab-insert-btn');
    const cancelBtn = modal.querySelector('#vocab-cancel-btn');
    
    // Setup UI components
    const updateLangDisplays = ui.setupLanguagePicker(modal);
    const applyFontSettings = ui.setupFontControls(modal, previewArea);
    const modeSwitch = ui.setupModeSwitch(modal);
    const tableStyle = ui.setupTableStyleModal(modal);
    
    // Setup extraction mode buttons (Translation, Definition, Words Only)
    setupExtractionModeButtons(modal);
    
    // Settings icon (More Options) functionality
    const moreOptionsBtn = modal.querySelector('#vocab-more-options-btn');
    const moreOptionsModal = modal.querySelector('#vocab-more-options-modal');
    if (moreOptionsBtn && moreOptionsModal) {
        moreOptionsBtn.onclick = function() {
            // Save current settings when modal opens
            const prevSettings = {
                lang: window.MintAIVocabCore.getSelectedStudentLang(),
                extractionMode: window.MintAIVocabCore.getCurrentExtractionMode(),
                numWords: document.getElementById('vocab-numwords')?.value,
                difficulty: document.getElementById('vocab-difficulty')?.value
            };
            moreOptionsModal.dataset.prevSettings = JSON.stringify(prevSettings);
            moreOptionsModal.style.display = 'flex';
        };
        // OK and Cancel buttons inside modal
        const moreOptionsOk = moreOptionsModal.querySelector('#vocab-more-options-ok');
        const moreOptionsCancel = moreOptionsModal.querySelector('#vocab-more-options-cancel');
        if (moreOptionsOk) {
            moreOptionsOk.onclick = function() {
                moreOptionsModal.style.display = 'none';
            };
        }
        if (moreOptionsCancel) {
            moreOptionsCancel.onclick = function() {
                // Restore previous settings
                const prev = moreOptionsModal.dataset.prevSettings ? JSON.parse(moreOptionsModal.dataset.prevSettings) : null;
                if (prev) {
                    window.MintAIVocabCore.setSelectedStudentLang(prev.lang);
                    window.MintAIVocabCore.setCurrentExtractionMode(prev.extractionMode);
                    if (document.getElementById('vocab-numwords')) document.getElementById('vocab-numwords').value = prev.numWords;
                    if (document.getElementById('vocab-difficulty')) document.getElementById('vocab-difficulty').value = prev.difficulty;
                    // Optionally trigger UI updates if needed
                    if (typeof updateVocabPreview === 'function') updateVocabPreview();
                }
                moreOptionsModal.style.display = 'none';
            };
        }
        // Click outside modal to close
        moreOptionsModal.onclick = function(e) {
            if (e.target === moreOptionsModal) {
                moreOptionsModal.style.display = 'none';
            }
        };
        
        // Picture source selection functionality
        setupPictureSourceButtons(moreOptionsModal);
    }
    
    // Setup layout selection
    const layoutsBtn = modal.querySelector('#vocab-layouts-more-btn'); // Updated to correct ID
    const layoutIconBtns = modal.querySelectorAll('.vocab-layout-icon-btn'); // Individual layout icons
    const layoutsModal = modal.querySelector('#vocab-layouts-modal');
    const layoutsClose = modal.querySelector('#vocab-layouts-close');
    
    // Setup individual layout icon buttons
    if (layoutIconBtns.length > 0) {
        layoutIconBtns.forEach(btn => {
            btn.onclick = function() {
                const layout = this.getAttribute('data-layout');
                console.log('Layout icon clicked:', layout);
                
                // Update hidden select
                const formatSelect = modal.querySelector('#vocab-list-format');
                if (formatSelect) {
                    formatSelect.value = layout;
                    formatSelect.dispatchEvent(new Event('change'));
                    if (window.MintAIVocabCore) {
                        window.MintAIVocabCore.setUserManuallyChangedLayout(true);
                    }
                }
                
                // Update preview
                if (window.updateVocabPreview) {
                    window.updateVocabPreview();
                }
            };
        });
    }
    
    // Setup "More Layouts" button
    if (layoutsBtn && layoutsModal && layoutsClose) {
        layoutsBtn.onclick = function() {
            console.log('More layouts button clicked');
            ui.populateLayoutsModal(modal, pictureMode);
            layoutsModal.style.display = 'flex';
        };
        layoutsClose.onclick = function() {
            layoutsModal.style.display = 'none';
        };
        
        // Also setup click outside to close
        layoutsModal.onclick = function(e) {
            if (e.target === layoutsModal) {
                layoutsModal.style.display = 'none';
            }
        };
    } else {
        console.warn('Layout modal elements not found:', {
            layoutsBtn: !!layoutsBtn,
            layoutsModal: !!layoutsModal,
            layoutsClose: !!layoutsClose
        });
    }
    
    // Preview update function
    window.updateVocabPreview = function() {
        if (!previewArea || !wordlistInput || !formatSelect) return;
        
        const wordlist = wordlistInput.value.trim();
        if (!wordlist) {
            previewArea.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Enter words to see preview</div>';
            return;
        }
        
        try {
            const words = core.parseWordList(wordlist);
            const format = formatSelect.value;
            const l1LabelRaw = core.langOptions.find(l => l.value === core.getSelectedStudentLang())?.label || 'Korean';
            const secondColLabel = core.getCurrentExtractionMode() === 'definition' ? 
                                  (l1LabelRaw === 'Korean' ? 'Definition' : l1LabelRaw) : 
                                  (core.getCurrentExtractionMode() === 'words' ? '' : l1LabelRaw);
            
            // Load layouts if needed
            if (window.MintAIVocabLayouts && window.MintAIVocabLayouts.renderPreview) {
                previewArea.innerHTML = window.MintAIVocabLayouts.renderPreview(words, format, secondColLabel);
            } else {
                // Simple fallback preview
                let html = '<div style="padding: 15px; border: 1px solid #ddd; border-radius: 8px;">';
                html += `<h4 style="margin-top: 0;">Preview (${format})</h4>`;
                words.forEach((word, i) => {
                    html += `<div style="margin: 5px 0; padding: 5px; border-bottom: 1px solid #eee;">`;
                    html += `<strong>${i+1}. ${word.english}</strong>`;
                    if (word.translation) html += ` - ${word.translation}`;
                    html += `</div>`;
                });
                html += '</div>';
                previewArea.innerHTML = html;
            }
            
            // Apply font settings to new content
            setTimeout(applyFontSettings, 10);
            
        } catch (error) {
            console.error('Preview error:', error);
            previewArea.innerHTML = '<div style="padding: 20px; color: #f56565;">Error generating preview</div>';
        }
    };
    
    // Generate/Extract button functionality
    if (generateBtn && topicInput && passageInput && wordlistInput) {
        generateBtn.onclick = async function() {
            const mode = modeSwitch.currentMode();
            let input = '';
            
            if (mode === 'topic') {
                input = topicInput.value.trim();
                if (!input) {
                    alert('Please enter a topic!');
                    return;
                }
            } else {
                input = passageInput.value.trim();
                if (!input) {
                    alert('Please enter some text!');
                    return;
                }
            }
            
            generateBtn.disabled = true;
            const originalText = generateBtn.textContent;
            generateBtn.textContent = mode === 'topic' ? 'Generating...' : 'Extracting...';
            
            try {
                let result = '';
                
                if (mode === 'topic') {
                    const difficulty = modal.querySelector('#vocab-difficulty')?.value || 'easy';
                    const extractionMode = core.getCurrentExtractionMode();
                    result = await core.generateWordsFromTopic(input, 10, difficulty, extractionMode);
                } else {
                    const extractionMode = core.getCurrentExtractionMode();
                    result = await core.extractWordsWithAI(input, extractionMode);
                }
                
                wordlistInput.value = result;
                window.updateVocabPreview();
                
                // Auto-generate title if title field is empty
                const titleInput = modal.querySelector('#vocab-title');
                if (titleInput && !titleInput.value.trim()) {
                    generateBtn.textContent = 'Creating title...';
                    
                    try {
                        // Try AI title generation
                        const aiTitle = await core.generateTitle(input, mode);
                        
                        let finalTitle = '';
                        if (aiTitle) {
                            finalTitle = aiTitle;
                        } else {
                            // Use fallback if AI fails
                            finalTitle = core.generateFallbackTitle(input, mode, 10);
                        }
                        
                        if (finalTitle) {
                            titleInput.value = finalTitle;
                            console.log('✅ Auto-generated title:', finalTitle);
                        }
                    } catch (titleError) {
                        console.warn('Title generation failed:', titleError);
                        // Use fallback title
                        const fallbackTitle = core.generateFallbackTitle(input, mode, 10);
                        if (fallbackTitle) {
                            titleInput.value = fallbackTitle;
                            console.log('✅ Used fallback title:', fallbackTitle);
                        }
                    }
                }
                
            } catch (error) {
                console.error('Generation error:', error);
                alert('Error processing request. Please try again.');
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = originalText;
            }
        };
    }
    
    // Format change triggers preview update
    if (formatSelect) {
        formatSelect.addEventListener('change', window.updateVocabPreview);
    }
    
    // Word list input triggers preview update (with debounce)
    if (wordlistInput) {
        let previewTimeout;
        wordlistInput.addEventListener('input', function() {
            clearTimeout(previewTimeout);
            previewTimeout = setTimeout(window.updateVocabPreview, 300);
        });
    }
    
    // Clear button functionality
    if (clearBtn && wordlistInput && previewArea) {
        clearBtn.onclick = function() {
            wordlistInput.value = '';
            previewArea.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Enter words to see preview</div>';
            if (topicInput) topicInput.value = '';
            if (passageInput) passageInput.value = '';
        };
    }
    
    // Cancel button functionality
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.remove();
        };
    }
    
    // Recent Lists button functionality
    const recentListsBtn = modal.querySelector('#recent-lists-btn');
    if (recentListsBtn) {
        recentListsBtn.onclick = function() {
            console.log('Recent Lists button clicked');
            if (core.showRecentListsModal) {
                core.showRecentListsModal();
            } else {
                console.warn('showRecentListsModal function not available');
                alert('Recent lists feature is not available yet.');
            }
        };
    } else {
        console.warn('Recent Lists button not found');
    }
    
    // Insert button functionality
    if (insertBtn && wordlistInput) {
        insertBtn.onclick = function() {
            const wordlist = wordlistInput.value.trim();
            if (!wordlist) {
                alert('No words to insert!');
                return;
            }
            
            try {
                // Parse words and prepare data
                const words = core.parseWordList(wordlist);
                const format = formatSelect?.value || 'doublelist';
                const title = modal.querySelector('#vocab-title')?.value || '';
                
                if (!words.length) {
                    alert('No valid words found. Please check your word list format.');
                    return;
                }

                // Always save to recents on insert
                if (window.WordListManager && typeof window.WordListManager.saveWordList === 'function') {
                    const finalTitle = title || 'Untitled Word List';
                    window.WordListManager.saveWordList(finalTitle, wordlist, {
                        source: 'insert',
                        timestamp: new Date().toISOString()
                    });
                    console.log('✅ Saved word list to recents:', finalTitle);
                } else {
                    console.warn('❌ WordListManager not available or saveWordList function missing');
                    console.log('WordListManager:', window.WordListManager);
                    console.log('saveWordList function:', window.WordListManager?.saveWordList);
                }
                
                // Generate the HTML content
                let renderedContent = '';
                if (window.MintAIVocabLayouts) {
                    const l1LabelRaw = core.langOptions.find(l => l.value === core.getSelectedStudentLang())?.label || 'Korean';
                    const secondColLabel = core.getCurrentExtractionMode() === 'definition' ? 
                                          (l1LabelRaw === 'Korean' ? 'Definition' : l1LabelRaw) : 
                                          (core.getCurrentExtractionMode() === 'words' ? '' : l1LabelRaw);
                    
                    // Use styled version for side-by-side and double list tables
                    if (format === 'sidebyside' && window.MintAIVocabLayouts.renderSideBySideWithStyle) {
                        renderedContent = window.MintAIVocabLayouts.renderSideBySideWithStyle(
                            words, 
                            tableStyle.getCurrentTableStyle(), 
                            secondColLabel
                        );
                    } else if (format === 'doublelist' && window.MintAIVocabLayouts.renderDoubleListWithStyle) {
                        renderedContent = window.MintAIVocabLayouts.renderDoubleListWithStyle(
                            words, 
                            tableStyle.getCurrentTableStyle(), 
                            secondColLabel
                        );
                    } else if (format === 'matching' && window.MintAIVocabLayouts.renderMatching) {
                        renderedContent = window.MintAIVocabLayouts.renderMatching(words, secondColLabel);
                    } else {
                        renderedContent = window.MintAIVocabLayouts.renderPreview(words, format, secondColLabel);
                    }
                } else {
                    // Fallback if layouts not available
                    renderedContent = '<div>Layout module not loaded</div>';
                }
                
                const vocabBoxHTML = `<div style='padding:12px 18px 8px 18px;'><div style='font-size:1.1em;font-weight:700;margin-bottom:8px;'>${title}</div>${renderedContent}</div>`;
                
                // Create modal state for future editing
                const modalState = {
                    title: title,
                    mode: modeSwitch.currentMode(),
                    extractionMode: core.getCurrentExtractionMode(),
                    topic: modal.querySelector('#vocab-topic-input')?.value || '',
                    passage: modal.querySelector('#vocab-passage')?.value || '',
                    wordlist: wordlist,
                    numWords: parseInt(modal.querySelector('#vocab-numwords')?.value) || 10,
                    difficulty: modal.querySelector('#vocab-difficulty')?.value || 'easy',
                    layout: format,
                    tableStyle: tableStyle.getCurrentTableStyle() || 'numbered',
                    targetLang: core.getSelectedTargetLang() || 'en',
                    studentLang: core.getSelectedStudentLang() || 'ko'
                };
                
                if (existingTextbox) {
                    // Update existing vocab box using the new handler
                    existingTextbox.innerHTML = vocabBoxHTML;
                    
                    // Use VocabTextboxHandler to save state cleanly
                    if (window.VocabTextboxHandler) {
                        window.VocabTextboxHandler.saveVocabState(existingTextbox, modalState);
                    } else {
                        // Fallback to old method
                        existingTextbox.setAttribute('data-vocab-state', JSON.stringify(modalState));
                        existingTextbox.setAttribute('data-type', 'vocab');
                    }
                    
                    if (window.saveToHistory) window.saveToHistory('edit vocab box');
                    // Sync changes back to data model
                    if (window.worksheetRender?.syncAllTextboxesToDataModel) {
                        window.worksheetRender.syncAllTextboxesToDataModel();
                    }
                } else {
                    // Add new vocab box
                    addNewVocabBox(vocabBoxHTML, modalState);
                }
                
                modal.remove();
                
            } catch (error) {
                console.error('Insertion error:', error);
                alert('Error inserting vocab box. Please check your word list.');
            }
        };
    }
    
    // Load layouts module for preview functionality
    loadScriptSimple('mint-ai/mint-ai-vocab-layouts.js').then(() => {
        console.log('Layouts module loaded');
        window.updateVocabPreview();
    }).catch(err => {
        console.warn('Layouts module not available:', err);
        // Preview will use fallback mode
    });
    
    // Restore existing textbox state if editing
    if (existingTextbox) {
        restoreExistingState(modal, existingTextbox, modeSwitch, core, updateLangDisplays);
    }
    
    // Setup auto-save for recent lists
    setupAutoSave(modal, wordlistInput);
    
    // Initial preview
    setTimeout(window.updateVocabPreview, 100);
}

// Setup picture source buttons functionality
function setupPictureSourceButtons(moreOptionsModal) {
    const pictureSourceBtns = moreOptionsModal.querySelectorAll('.picture-source-btn');
    
    if (!pictureSourceBtns || pictureSourceBtns.length === 0) {
        console.warn('Picture source buttons not found');
        return;
    }
    
    console.log('Found picture source buttons:', pictureSourceBtns.length);
    
    function setActiveSource(activeBtn, source) {
        // Reset all buttons
        pictureSourceBtns.forEach(btn => {
            btn.style.background = '#f8fafd';
            btn.style.color = '#19777e';
            btn.setAttribute('aria-pressed', 'false');
        });
        
        // Set active button
        activeBtn.style.background = '#e0f7fa';
        activeBtn.style.color = '#045c63';
        activeBtn.setAttribute('aria-pressed', 'true');
        
        // Update global setting
        window.currentPictureSource = source;
        
        console.log('Picture source set to:', source);
    }
    
    // Setup click handlers for each button
    pictureSourceBtns.forEach(btn => {
        const source = btn.getAttribute('data-source');
        btn.onclick = function() {
            console.log('Picture source button clicked:', source);
            setActiveSource(btn, source);
        };
    });
    
    // Set default to Any (first button)
    const anyBtn = moreOptionsModal.querySelector('.picture-source-btn[data-source="any"]');
    if (anyBtn) {
        setActiveSource(anyBtn, 'any');
    }
}

// Setup extraction mode buttons (Translation, Definition, Words Only)
function setupExtractionModeButtons(modal) {
    const extractionBtns = modal.querySelectorAll('.vocab-extraction-btn'); // Updated to use class
    
    if (!extractionBtns || extractionBtns.length === 0) {
        console.warn('Extraction mode buttons not found');
        return;
    }
    
    console.log('Found extraction buttons:', extractionBtns.length);
    
    function setActiveMode(activeBtn, mode) {
        // Reset all buttons
        extractionBtns.forEach(btn => {
            btn.style.background = '#f8fafd';
            btn.style.color = '#19777e';
            btn.setAttribute('aria-pressed', 'false');
        });
        
        // Set active button
        activeBtn.style.background = '#e0f7fa';
        activeBtn.style.color = '#045c63';
        activeBtn.setAttribute('aria-pressed', 'true');
        
        // Update core mode
        if (window.MintAIVocabCore) {
            window.MintAIVocabCore.setCurrentExtractionMode(mode);
        }
        
        // Update preview if words exist
        if (window.updateVocabPreview) {
            window.updateVocabPreview();
        }
        
        console.log('Extraction mode set to:', mode);
    }
    
    // Setup click handlers for each button
    extractionBtns.forEach(btn => {
        const mode = btn.getAttribute('data-mode');
        btn.onclick = function() {
            console.log('Extraction button clicked:', mode);
            setActiveMode(btn, mode);
        };
    });
    
    // Set default to translation (first button)
    const translationBtn = modal.querySelector('.vocab-extraction-btn[data-mode="translation"]');
    if (translationBtn) {
        setActiveMode(translationBtn, 'translation');
    }
}

// Setup auto-save functionality for recent lists
function setupAutoSave(modal, wordlistInput) {
    const titleInput = modal.querySelector('#vocab-title');
    
    if (wordlistInput) {
        wordlistInput.addEventListener('input', function() {
            const title = titleInput?.value?.trim() || '';
            const wordlist = wordlistInput.value.trim();
            if (wordlist) {
                const finalTitle = title || 'Untitled Word List';
                if (window.WordListManager?.saveWordList) {
                    window.WordListManager.saveWordList(finalTitle, wordlist, {
                        source: 'manual_edit',
                        timestamp: new Date().toISOString()
                    });
                }
            }
        });
    }
}

// Restore existing textbox state if editing
function restoreExistingState(modal, existingTextbox, modeSwitch, core, updateLangDisplays) {
    try {
        console.log('🔄 Using VocabTextboxHandler to restore state...');
        
        // Use the new clean handler to get state
        let savedState = null;
        if (window.VocabTextboxHandler) {
            savedState = window.VocabTextboxHandler.getVocabState(existingTextbox);
            console.log('� Got state from VocabTextboxHandler:', savedState);
        } else {
            console.error('❌ VocabTextboxHandler not available');
            return;
        }
        
        if (!savedState) {
            console.log('❌ Could not get vocab state from handler');
            return;
        }
        
        // Get form elements
        const titleInput = modal.querySelector('#vocab-title');
        const wordlistInput = modal.querySelector('#vocab-wordlist');
        const formatSelect = modal.querySelector('#vocab-list-format');
        const topicInput = modal.querySelector('#vocab-topic-input');
        const passageInput = modal.querySelector('#vocab-passage');
        const numInput = modal.querySelector('#vocab-numwords');
        const diffInput = modal.querySelector('#vocab-difficulty');
        
        // Restore basic fields
        if (savedState.title && titleInput) {
            titleInput.value = savedState.title;
            console.log('✅ Restored title:', savedState.title);
        }
        
        if (savedState.wordlist && wordlistInput) {
            wordlistInput.value = savedState.wordlist;
            console.log('✅ Restored wordlist');
            
            // Trigger preview update after restoring wordlist
            if (typeof window.updateVocabPreview === 'function') {
                console.log('🔄 Triggering preview update after wordlist restore...');
                setTimeout(() => {
                    window.updateVocabPreview();
                    console.log('✅ Preview updated with restored wordlist');
                }, 100);
            } else {
                console.log('⚠️ updateVocabPreview function not available');
            }
        }
        
        if (savedState.layout && formatSelect) {
            formatSelect.value = savedState.layout;
            core.setUserManuallyChangedLayout(true);
            console.log('✅ Restored layout:', savedState.layout);
        }
        
        // Restore numbers and difficulty
        if (savedState.numWords && numInput) {
            numInput.value = savedState.numWords;
        }
        if (savedState.difficulty && diffInput) {
            diffInput.value = savedState.difficulty;
        }
        
        // Restore mode (topic vs text input)
        if (savedState.mode) {
            if (savedState.mode === 'text') {
                modeSwitch.switchToTextMode();
                if (savedState.passage && passageInput) {
                    passageInput.value = savedState.passage;
                    console.log('✅ Restored passage text');
                }
            } else {
                modeSwitch.switchToTopicMode();
                if (savedState.topic && topicInput) {
                    topicInput.value = savedState.topic;
                    console.log('✅ Restored topic:', savedState.topic);
                }
            }
        }
        
        // Restore extraction mode (translation/definition/words)
        if (savedState.extractionMode) {
            core.setCurrentExtractionMode(savedState.extractionMode);
            
            // Update extraction mode buttons
            const extractionBtns = modal.querySelectorAll('.vocab-extraction-btn');
            extractionBtns.forEach(btn => {
                const mode = btn.getAttribute('data-mode');
                if (mode === savedState.extractionMode) {
                    btn.style.background = '#e0f7fa';
                    btn.style.color = '#045c63';
                    btn.setAttribute('aria-pressed', 'true');
                } else {
                    btn.style.background = '#f8fafd';
                    btn.style.color = '#19777e';
                    btn.setAttribute('aria-pressed', 'false');
                }
            });
            console.log('✅ Restored extraction mode:', savedState.extractionMode);
        }
        
        // Restore languages
        if (savedState.targetLang) {
            core.setSelectedTargetLang(savedState.targetLang);
            console.log('✅ Restored target language:', savedState.targetLang);
        }
        if (savedState.studentLang) {
            core.setSelectedStudentLang(savedState.studentLang);
            console.log('✅ Restored student language:', savedState.studentLang);
        }
        
        // Update language displays
        updateLangDisplays();
        
        // Update preview with restored content
        setTimeout(() => {
            if (window.updateVocabPreview) {
                window.updateVocabPreview();
                console.log('✅ Updated preview with restored state');
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ Error restoring vocab state:', error);
    }
}

// Add new vocab box to worksheet
function addNewVocabBox(vocabBoxHTML, modalState) {
    // Find the selected page, or fallback to last page
    const selected = document.querySelector('.page-preview-a4.selected');
    const pagesEls = document.querySelectorAll('.page-preview-a4');
    if (!pagesEls.length) {
        console.warn('No pages found in worksheet');
        return;
    }
    
    const pageEl = selected || pagesEls[pagesEls.length - 1];
    const pageIdx = Array.from(pagesEls).indexOf(pageEl);
    if (pageIdx === -1) {
        console.warn('Could not find page index');
        return;
    }
    
    // Calculate position
    const previewRect = pageEl.getBoundingClientRect();
    let left = 80, top = 80;
    const boxWidth = 750, boxHeight = 400;
    
    if (previewRect) {
        left = Math.max(0, Math.round((previewRect.width - boxWidth) / 2));
        top = Math.max(0, Math.round(previewRect.height * 0.2) - 100);
        
        // Offset for subsequent boxes on the same page
        const pageBoxes = window.worksheetState?.getPages()[pageIdx]?.boxes || [];
        if (pageBoxes.length > 0) {
            top += pageBoxes.length * 40;
        }
    }
    
    const boxData = {
        left: left + 'px',
        top: top + 'px',
        width: boxWidth + 'px',
        height: boxHeight + 'px',
        text: vocabBoxHTML,
        html: vocabBoxHTML,
        borderOn: true,
        borderColor: '#e1e8ed',
        borderWeight: 1.5,
        borderRadius: 4,
        lineHeight: '1.8',
        type: 'vocab',
        vocabState: modalState
    };
    
    // Save to history before adding new textbox
    if (window.saveToHistory) window.saveToHistory('add textbox');
    if (!window.worksheetState?.getPages()[pageIdx]) {
        window.worksheetState.getPages()[pageIdx] = { boxes: [] };
    }
    window.worksheetState.getPages()[pageIdx].boxes.push(boxData);
    
    // Re-render to show the new box
    if (window.renderPages) {
        window.renderPages();
    } else {
        console.warn('renderPages function not available');
    }
    
    console.log('Added new vocab box to page', pageIdx);
}

// Basic functionality fallback
function setupBasicFunctionality(modal) {
    console.log('Setting up basic functionality...');
    
    const previewArea = modal.querySelector('#vocab-preview-area');
    if (previewArea) {
        previewArea.innerHTML = '<div style="padding: 20px; text-align: center; color: #333;"><h3>🎉 Modal is Working!</h3><p>Basic functionality is active. AI generation modules are loading...</p></div>';
    }
};

// Confirm function is defined
console.log('✅ FIXED: Function defined. Type:', typeof window.openVocabBoxModal);

// Test that it's accessible
if (typeof window.openVocabBoxModal === 'function') {
    console.log('✅ FIXED: Function is accessible and ready!');
} else {
    console.error('❌ FIXED: Function definition failed!');
}