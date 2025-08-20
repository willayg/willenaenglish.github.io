// vocab-textbox-handler.js - Handles vocab textbox state management and content parsing
console.log('🚀 Loading Vocab Textbox Handler...');

window.VocabTextboxHandler = {
    
    // Check if a textbox is a vocab box
    isVocabBox(textbox) {
        if (!textbox) return false;
        
        // Method 1: Check attributes
        if (textbox.classList.contains('vocab-box') || 
            textbox.getAttribute('data-type') === 'vocab' ||
            textbox.getAttribute('data-vocab-state')) {
            return true;
        }
        
        // Method 2: Content-based detection (look for vocab table structure)
        const content = textbox.innerHTML;
        const hasVocabTable = content.includes('<table') && 
                             (content.includes('English') || 
                              content.includes('Korean') ||
                              content.includes('Definition'));
        
        if (hasVocabTable) {
            // Mark it as vocab box for future detection
            textbox.setAttribute('data-type', 'vocab');
            textbox.classList.add('vocab-box');
            return true;
        }
        
        return false;
    },
    
    // Extract vocabulary data from textbox content in simple "word,translation" format
    extractVocabData(textbox) {
        console.log('📖 Extracting vocab data from textbox...');
        
        const vocabData = {
            title: '',
            wordPairs: [],
            layout: 'doublelist',
            rawWordlist: ''
        };
        
        try {
            const content = textbox.innerHTML;
            
            // Extract title from the content
            const titleMatch = content.match(/<div[^>]*font-weight:700[^>]*>([^<]+)<\/div>/);
            if (titleMatch) {
                vocabData.title = titleMatch[1].trim();
                console.log('📝 Found title:', vocabData.title);
            }
            
            // Extract word pairs from table rows
            const tableRows = textbox.querySelectorAll('tr');
            if (tableRows.length > 1) {
                console.log('📊 Processing', tableRows.length, 'table rows...');
                
                tableRows.forEach((row, index) => {
                    if (index === 0) return; // Skip header row
                    
                    const cells = row.querySelectorAll('td, th');
                    if (cells.length >= 2) {
                        let english = cells[0]?.textContent?.trim() || '';
                        let translation = cells[1]?.textContent?.trim() || '';
                        
                        // Clean up numbering from English word
                        english = english.replace(/^\d+\.?\s*/, '');
                        
                        // Only add if both words exist and aren't empty
                        if (english && translation && english !== translation) {
                            vocabData.wordPairs.push({ english, translation });
                            console.log(`  ✅ "${english}" → "${translation}"`);
                        }
                    }
                });
            }
            
            // Convert to simple wordlist format: "word,translation"
            vocabData.rawWordlist = vocabData.wordPairs
                .map(pair => `${pair.english}, ${pair.translation}`)
                .join('\n');
            
            // Detect layout type from content structure
            if (content.includes('border-left:2.5px solid') || content.includes('width:50%')) {
                vocabData.layout = 'doublelist';
            } else if (content.includes('sidebyside') || content.includes('side-by-side')) {
                vocabData.layout = 'sidebyside';
            } else {
                vocabData.layout = 'doublelist'; // default
            }
            
            console.log('✅ Extracted vocab data:', {
                title: vocabData.title,
                wordCount: vocabData.wordPairs.length,
                layout: vocabData.layout
            });
            
            return vocabData;
            
        } catch (error) {
            console.error('❌ Error extracting vocab data:', error);
            return vocabData; // Return empty structure
        }
    },
    
    // Create modal state from extracted vocab data
    createModalState(vocabData, options = {}) {
        return {
            title: vocabData.title || options.title || 'Vocabulary',
            wordlist: vocabData.rawWordlist || '',
            layout: vocabData.layout || 'doublelist',
            mode: options.mode || 'topic',
            extractionMode: options.extractionMode || 'translation',
            topic: options.topic || '',
            passage: options.passage || '',
            numWords: vocabData.wordPairs.length || 10,
            difficulty: options.difficulty || 'easy',
            targetLang: options.targetLang || 'en',
            studentLang: options.studentLang || 'ko'
        };
    },
    
    // Get complete state for a vocab textbox (combines extraction + fallbacks)
    getVocabState(textbox) {
        console.log('🔍 Getting complete vocab state for textbox...');
        
        // Try to get saved state first
        const savedStateAttr = textbox.getAttribute('data-vocab-state');
        if (savedStateAttr) {
            try {
                const savedState = JSON.parse(savedStateAttr);
                console.log('✅ Found saved state in data-vocab-state');
                return savedState;
            } catch (error) {
                console.warn('⚠️ Invalid saved state, falling back to content extraction');
            }
        }
        
        // Extract from content as fallback
        const extractedData = this.extractVocabData(textbox);
        const modalState = this.createModalState(extractedData);
        
        // Save the extracted state back to the textbox for future use
        textbox.setAttribute('data-vocab-state', JSON.stringify(modalState));
        console.log('💾 Saved extracted state to textbox');
        
        return modalState;
    },
    
    // Update textbox state after modal changes
    saveVocabState(textbox, modalState) {
        if (!textbox || !modalState) return;
        
        // Ensure the textbox is marked as vocab
        textbox.setAttribute('data-type', 'vocab');
        textbox.classList.add('vocab-box');
        
        // Save the complete state
        textbox.setAttribute('data-vocab-state', JSON.stringify(modalState));
        
        console.log('💾 Saved vocab state to textbox:', modalState.title);
    },
    
    // Enhanced vocab detection for inline toolbar
    detectAndRepairVocabBox(textbox) {
        const isVocab = this.isVocabBox(textbox);
        
        if (isVocab) {
            // Ensure proper attributes are set
            textbox.setAttribute('data-type', 'vocab');
            textbox.classList.add('vocab-box');
            
            // If no saved state, extract and save it
            if (!textbox.getAttribute('data-vocab-state')) {
                const vocabData = this.extractVocabData(textbox);
                const modalState = this.createModalState(vocabData);
                this.saveVocabState(textbox, modalState);
                console.log('🔧 Auto-repaired vocab box state');
            }
        }
        
        return isVocab;
    }
};

console.log('✅ Vocab Textbox Handler loaded successfully');
