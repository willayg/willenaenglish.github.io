// mint-ai-vocab-core.js: Core AI functions and modal logic for vocabulary generation
(function() {
  // Language options and selections
  const langOptions = [
    { value: 'en', label: 'English', flag: 'mint-ai/flags/en.svg' },
    { value: 'ko', label: 'Korean', flag: 'mint-ai/flags/kr.svg' },
    { value: 'ja', label: 'Japanese', flag: 'mint-ai/flags/jp.svg' },
    { value: 'zh', label: 'Chinese', flag: 'mint-ai/flags/cn.svg' },
    { value: 'es', label: 'Spanish', flag: 'mint-ai/flags/es.svg' }
  ];
  
  let selectedTargetLang = 'en';
  let selectedStudentLang = 'ko';
  let userManuallyChangedLayout = false;
  let currentExtractionMode = 'translation'; // 'translation' | 'definition' | 'words'

  // Load WordListManager if not already available
  async function ensureWordListManager() {
    if (window.WordListManager) return;
    
    try {
      // Try to load the script dynamically
      const script = document.createElement('script');
      script.src = 'mint-ai/word-list-manager.js';
      document.head.appendChild(script);
      
      // Wait for script to load
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
      });
      
      // Initialize after loading
      if (window.WordListManager) {
        window.WordListManager.init();
      }
    } catch (error) {
      console.warn('Could not load WordListManager:', error);
    }
  }
  
  // Ensure WordListManager is loaded when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureWordListManager);
  } else {
    ensureWordListManager();
  }

  // Helper: Parse word list textarea into array of {eng, kor}
  function parseWordList(text) {
    return text.split('\n').map(line => {
      // Remove leading numbers and dots, e.g. '1. bird' -> 'bird'
      let cleaned = line.replace(/^\s*\d+\.?\s*/, '');
      const commaIndex = cleaned.indexOf(',');
      if (commaIndex === -1) {
        // No comma, treat whole line as English
        return { eng: cleaned.trim(), kor: '' };
      }
      const eng = cleaned.slice(0, commaIndex).trim();
      const kor = cleaned.slice(commaIndex + 1).trim();
      if (!eng) return null;
      return { eng, kor };
    }).filter(Boolean);
  }

  // AI extraction (uses same endpoint as wordtest)
  async function extractWordsWithAI(passage, numWords, difficulty, extractionMode = 'translation') {
    // Use selectedStudentLang to get the language label
    const lang = langOptions.find(l => l.value === selectedStudentLang)?.label || 'Korean';
    
    // Check if we're running locally
    const isLocal = !window.location.hostname.includes('netlify') && 
                   (window.location.hostname === 'localhost' || 
                    window.location.protocol === 'file:');
    
    if (isLocal) {
      console.log('🧪 Running locally - returning sample extracted vocab');
      return generateSampleExtractedVocab(passage, numWords, difficulty, extractionMode, lang);
    }
    
    // Craft prompt based on extraction mode
    let userPrompt = '';
    if (extractionMode === 'definition') {
      userPrompt = `Extract exactly ${numWords} ${difficulty} English words or phrases from the passage below. For each, provide the English word, then a comma, then a short, simple English definition suitable for English learners. Return each pair on a new line in the format: word, definition. Do not include numbering or any extra text.\n\nPassage:\n${passage}`;
    } else if (extractionMode === 'words') {
      userPrompt = `Extract exactly ${numWords} ${difficulty} English words or phrases from the passage below. Return ONLY the English words, one per line. No numbering, no commas, no extra commentary.\n\nPassage:\n${passage}`;
    } else {
      userPrompt = `Extract exactly ${numWords} ${difficulty} English words or phrases from the passage below. For each, provide the English, then a comma, then the ${lang} translation. Return each pair on a new line in the format: english, ${lang.toLowerCase()}. Do not include numbering or any extra text.\n\nPassage:\n${passage}`;
    }
    
    try {
      const resp = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful teaching assistant.' },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 1200
          }
        })
      });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      
      const data = await resp.json();
      return data.data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('❌ AI extraction failed:', error);
      throw new Error(`AI extraction failed: ${error.message}`);
    }
  }

  // Sample extraction for local testing
  function generateSampleExtractedVocab(passage, numWords, difficulty, extractionMode, lang) {
    // Extract some common words as a demo
    const words = passage.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const uniqueWords = [...new Set(words)].slice(0, numWords);
    
    if (extractionMode === 'definition') {
      return uniqueWords.map(word => `${word}, a word from the passage`).join('\n');
    } else if (extractionMode === 'words') {
      return uniqueWords.join('\n');
    } else {
      return uniqueWords.map(word => `${word}, [${lang} translation]`).join('\n');
    }
  }

  // AI topic generation
  async function generateWordsFromTopic(topic, numWords, difficulty, extractionMode = 'translation') {
    // Use selectedStudentLang to get the language label
    const lang = langOptions.find(l => l.value === selectedStudentLang)?.label || 'Korean';
    
    // Craft prompt based on extraction mode
    let userPrompt = '';
    if (extractionMode === 'definition') {
      userPrompt = `Generate exactly ${numWords} ${difficulty} English words related to the topic "${topic}". For each word, provide the English word, then a comma, then a short, simple English definition suitable for English learners. Return each pair on a new line in the format: word, definition. Do not include numbering or any extra text.`;
    } else if (extractionMode === 'words') {
      userPrompt = `Generate exactly ${numWords} ${difficulty} English words related to the topic "${topic}". Return ONLY the English words, one per line. No numbering, no commas, no extra commentary. Make the words appropriate for English language learners.`;
    } else {
      userPrompt = `Generate exactly ${numWords} ${difficulty} English words related to the topic "${topic}". For each word, provide the English, then a comma, then the ${lang} translation. Return each pair on a new line in the format: english, ${lang.toLowerCase()}. Make the words appropriate for English language learners.`;
    }
    
    try {
      const resp = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful teaching assistant creating vocabulary lists for English language learners.' },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 1200
          }
        })
      });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      
      const data = await resp.json();
      return data.data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('❌ AI generation failed:', error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  // Sample vocab generator for local testing
  function generateSampleVocab(topic, numWords, difficulty, extractionMode, lang) {
    const sampleData = {
      animals: {
        translation: ['cat, 고양이', 'dog, 개', 'bird, 새', 'fish, 물고기', 'rabbit, 토끼', 'horse, 말', 'cow, 소', 'pig, 돼지', 'sheep, 양', 'lion, 사자'],
        definition: ['cat, a small furry pet animal that says meow', 'dog, a loyal pet animal that barks', 'bird, an animal that can fly and has wings', 'fish, an animal that lives in water', 'rabbit, a small animal with long ears that hops'],
        words: ['cat', 'dog', 'bird', 'fish', 'rabbit', 'horse', 'cow', 'pig', 'sheep', 'lion']
      },
      food: {
        translation: ['apple, 사과', 'banana, 바나나', 'rice, 쌀', 'bread, 빵', 'water, 물', 'milk, 우유', 'egg, 달걀', 'meat, 고기', 'vegetable, 야채', 'fruit, 과일'],
        definition: ['apple, a red or green round fruit', 'banana, a long yellow fruit', 'rice, small white grains that are cooked', 'bread, food made from flour and baked', 'water, clear liquid that we drink'],
        words: ['apple', 'banana', 'rice', 'bread', 'water', 'milk', 'egg', 'meat', 'vegetable', 'fruit']
      },
      school: {
        translation: ['book, 책', 'pen, 펜', 'pencil, 연필', 'desk, 책상', 'chair, 의자', 'teacher, 선생님', 'student, 학생', 'classroom, 교실', 'homework, 숙제', 'test, 시험'],
        definition: ['book, something you read with pages', 'pen, a tool for writing with ink', 'pencil, a tool for writing that can be erased', 'desk, a table where you study', 'chair, something you sit on'],
        words: ['book', 'pen', 'pencil', 'desk', 'chair', 'teacher', 'student', 'classroom', 'homework', 'test']
      }
    };
    
    // Find matching topic or use generic words
    const topicKey = Object.keys(sampleData).find(key => 
      topic.toLowerCase().includes(key) || key.includes(topic.toLowerCase())
    ) || 'school';
    
    const words = sampleData[topicKey][extractionMode] || sampleData[topicKey]['translation'];
    return words.slice(0, numWords).join('\n');
  }

  // Auto-title generation function
  async function generateTitle(userInput, mode) {
    try {
      const resp = await WillenaAPI.fetch('/.netlify/functions/openai_proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: 'chat/completions',
          payload: {
            model: 'gpt-3.5-turbo',
            messages: [
              { role: 'system', content: 'You are a helpful teaching assistant. Generate concise, appropriate titles for vocabulary worksheets.' },
              { role: 'user', content: `Create a short, catchy title (max 50 characters) for a vocabulary worksheet about "${userInput}". Do not mention any languages. Just return the title, nothing else.` }
            ],
            max_tokens: 50
          }
        })
      });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }
      
      const data = await resp.json();
      return data.data.choices?.[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('❌ Title generation failed:', error);
      throw new Error(`Title generation failed: ${error.message}`);
    }
  }

  // Fallback title generation
  function generateFallbackTitle(userInput, mode, numWords) {
    if (!userInput) return '';
    
    // Capitalize first letter of each word
    const formatted = userInput.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
    
    // Truncate if too long
    const truncated = formatted.length > 35 ? formatted.substring(0, 32) + '...' : formatted;
    
    if (mode === 'text') {
      return `Words from "${truncated}"`;
    } else {
      const wordText = numWords && numWords !== 10 ? ` — ${numWords} words` : '';
      return `${truncated} Vocabulary${wordText}`;
    }
  }

  // Recent Lists Modal Functions
  function showRecentListsModal() {
    const modal = document.getElementById('recent-lists-modal');
    if (!modal) return;
    
    // Always refresh the list when opening
    populateRecentLists();
    modal.style.display = 'flex';
    
    // Set up close handlers
    const closeBtn = document.getElementById('close-recent-lists');
    const closeXBtn = document.getElementById('close-recent-lists-x');
    
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';
    if (closeXBtn) closeXBtn.onclick = () => modal.style.display = 'none';
    
    // Close on background click
    modal.onclick = function(e) {
      if (e.target === modal) modal.style.display = 'none';
    };
  }
  
  function populateRecentLists() {
    const container = document.getElementById('recent-lists-container');
    if (!container) {
      console.log('Recent lists container not found');
      return;
    }
    
    const lists = window.WordListManager.getAllWordLists();
    console.log('Loading', lists.length, 'saved word lists:', lists);
    
    if (lists.length === 0) {
      container.innerHTML = '<p style="color:#666;text-align:center;padding:20px;">No saved word lists yet</p>';
      return;
    }
    
    let html = '';
    lists.slice(0, 10).forEach((list, index) => { // Show only first 10
      console.log(`List ${index + 1}:`, list.title, '|', list.id);
      html += `
        <div style="border:1px solid #ddd;border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer;background:#f9f9f9;" onclick="loadWordList('${list.id}')">
          <div style="font-weight:600;color:#333;">${list.title}</div>
          <div style="font-size:0.85em;color:#666;">${new Date(list.metadata.updatedAt).toLocaleDateString()}</div>
          <div style="font-size:0.75em;color:#999;margin-top:5px;">${list.wordList.split('\n').length} words</div>
        </div>
      `;
    });
    
    container.innerHTML = html;
    console.log('Recent lists populated with HTML:', html.length, 'characters');
  }
  
  function loadWordList(listId) {
    const list = window.WordListManager.getWordList(listId);
    if (!list) return;
    
    // Fill the modal with the saved list
    const titleInput = document.getElementById('vocab-title');
    const wordlistInput = document.getElementById('vocab-wordlist');
    
    if (titleInput) titleInput.value = list.title;
    if (wordlistInput) {
      wordlistInput.value = list.wordList;
      // Trigger input event to update preview
      wordlistInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Mark as used for recent lists ordering
    window.WordListManager.markAsUsed(listId);
    
    // Close the recent lists modal
    const modal = document.getElementById('recent-lists-modal');
    if (modal) modal.style.display = 'none';
    
    console.log('Loaded word list:', list.title);
    
    // Refresh recent lists for next time
    setTimeout(() => {
      populateRecentLists();
    }, 100);
  }

  // Export core functions and variables
  window.MintAIVocabCore = {
    langOptions,
    selectedTargetLang,
    selectedStudentLang,
    userManuallyChangedLayout,
    currentExtractionMode,
    parseWordList,
    extractWordsWithAI,
    generateWordsFromTopic,
    generateTitle,
    generateFallbackTitle,
    showRecentListsModal,
    populateRecentLists,
    loadWordList,
    // Getters and setters for shared state
    getSelectedTargetLang: () => selectedTargetLang,
    setSelectedTargetLang: (lang) => { selectedTargetLang = lang; },
    getSelectedStudentLang: () => selectedStudentLang,
    setSelectedStudentLang: (lang) => { selectedStudentLang = lang; },
    getUserManuallyChangedLayout: () => userManuallyChangedLayout,
    setUserManuallyChangedLayout: (changed) => { userManuallyChangedLayout = changed; },
    getCurrentExtractionMode: () => currentExtractionMode,
    setCurrentExtractionMode: (mode) => { currentExtractionMode = mode; }
  };

  // Make loadWordList globally available
  window.loadWordList = loadWordList;
})();
