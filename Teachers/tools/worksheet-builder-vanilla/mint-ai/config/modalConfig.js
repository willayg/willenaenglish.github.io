// word-list-manager.js: Standalone Word List Manager for storing and retrieving vocabulary lists
(function() {
  if (!window.WordListManager) {
    window.WordListManager = {
      // Storage key for localStorage
      STORAGE_KEY: 'vocab_word_lists',
      
      // In-memory cache for performance
      cache: null,
      
      // Initialize the manager (load from localStorage)
      init() {
        this.loadFromStorage();
      },
      
      // Load word lists from localStorage
      loadFromStorage() {
        try {
          const stored = localStorage.getItem(this.STORAGE_KEY);
          this.cache = stored ? JSON.parse(stored) : {};
        } catch (error) {
          console.warn('Failed to load word lists from localStorage:', error);
          this.cache = {};
        }
      },
      
      // Save word lists to localStorage
      saveToStorage() {
        try {
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
        } catch (error) {
          console.error('Failed to save word lists to localStorage:', error);
        }
      },
      
      // Generate a unique ID for a word list
      generateId(title) {
        const timestamp = Date.now();
        const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        return `${sanitizedTitle}_${timestamp}`;
      },
      
      // Save or update a word list
      saveWordList(title, wordList, metadata = {}) {
        if (!title || !wordList) return null;
        
        // Check if a list with this title already exists
        let existingId = this.findByTitle(title);
        let id = existingId || this.generateId(title);
        
        const wordListData = {
          id: id,
          title: title,
          wordList: wordList,
          metadata: {
            ...metadata,
            createdAt: this.cache[id]?.metadata?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            usageCount: (this.cache[id]?.metadata?.usageCount || 0) + (existingId ? 0 : 1)
          }
        };
        
        this.cache[id] = wordListData;
        this.saveToStorage();
        
        console.log(existingId ? 'Updated' : 'Saved', 'word list:', title);
        return id;
      },
      
      // Find a word list by title
      findByTitle(title) {
        for (const [id, data] of Object.entries(this.cache)) {
          if (data.title.toLowerCase() === title.toLowerCase()) {
            return id;
          }
        }
        return null;
      },
      
      // Get a word list by ID
      getWordList(id) {
        return this.cache[id] || null;
      },
      
      // Get all word lists, sorted by most recent
      getAllWordLists() {
        return Object.values(this.cache).sort((a, b) => 
          new Date(b.metadata.updatedAt) - new Date(a.metadata.updatedAt)
        );
      },
      
      // Delete a word list
      deleteWordList(id) {
        if (this.cache[id]) {
          delete this.cache[id];
          this.saveToStorage();
          return true;
        }
        return false;
      },
      
      // Update usage count when a list is used
      markAsUsed(id) {
        if (this.cache[id]) {
          this.cache[id].metadata.usageCount = (this.cache[id].metadata.usageCount || 0) + 1;
          this.cache[id].metadata.lastUsed = new Date().toISOString();
          this.saveToStorage();
        }
      },
      
      // Get recent word lists (most recently used/updated)
      getRecentLists(limit = 10) {
        return this.getAllWordLists().slice(0, limit);
      }
    };
    
    // Initialize immediately
    window.WordListManager.init();
  }
})();
