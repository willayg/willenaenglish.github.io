export class DataManager {
    constructor() {
        this.supabaseProxyUrl = '/.netlify/functions/supabase_proxy';
        this.localStorageKey = 'flashcard_settings';
    }

    // Settings management (local storage)
    saveSettings(settings) {
        try {
            localStorage.setItem(this.localStorageKey, JSON.stringify(settings));
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem(this.localStorageKey);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.error('Error loading settings:', error);
            return {};
        }
    }

    // Flashcard data management (Supabase)
    async saveFlashcards(data) {
        try {
            // Prepare data for saving
            const worksheet = {
                worksheet_type: 'flashcard',
                title: data.title || 'Untitled Flashcard Set',
                passage_text: data.wordList || '',
                words: data.cards.map(card => card.english),
                layout: 'flashcard',
                settings: {
                    font: data.font || 'Poppins',
                    fontSize: data.fontSize || 18,
                    layout: data.layout || '4-card',
                    cardSize: data.cardSize || 200,
                    showKorean: data.showKorean || false,
                    imageOnly: data.imageOnly || false
                },
                book: '',
                unit: '',
                language_point: '',
                notes: `Flashcard set with ${data.cards.length} cards`,
                imageData: await this.prepareImageData(data.cards)
            };

            const response = await fetch(`${this.supabaseProxyUrl}/save_worksheet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(worksheet)
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Failed to save flashcards');
            }

            return result;
        } catch (error) {
            console.error('Error saving flashcards:', error);
            throw error;
        }
    }

    async loadFlashcards() {
        try {
            // Open the worksheet manager for loading
            const managerWindow = window.open(
                '../../worksheet_manager.html?mode=load', 
                'WorksheetManager', 
                'width=800,height=700'
            );

            // Return a promise that resolves when a worksheet is selected
            return new Promise((resolve, reject) => {
                // Set up a message listener for when the manager window sends data
                const messageHandler = (event) => {
                    if (event.source === managerWindow) {
                        window.removeEventListener('message', messageHandler);
                        
                        if (event.data.type === 'worksheet_selected') {
                            const worksheetData = event.data.worksheet;
                            resolve(this.parseLoadedWorksheet(worksheetData));
                        } else if (event.data.type === 'cancelled') {
                            resolve(null);
                        }
                    }
                };

                window.addEventListener('message', messageHandler);

                // Clean up if window is closed
                const checkClosed = setInterval(() => {
                    if (managerWindow.closed) {
                        clearInterval(checkClosed);
                        window.removeEventListener('message', messageHandler);
                        resolve(null);
                    }
                }, 500);
            });
        } catch (error) {
            console.error('Error loading flashcards:', error);
            throw error;
        }
    }

    parseLoadedWorksheet(worksheetData) {
        try {
            const cards = [];
            
            // Parse words and create cards
            if (worksheetData.words && Array.isArray(worksheetData.words)) {
                worksheetData.words.forEach(word => {
                    cards.push({
                        english: word,
                        korean: '',
                        image: null,
                        imageUrl: null
                    });
                });
            }

            // Restore images if available
            if (worksheetData.imageData) {
                this.restoreImagesFromData(cards, worksheetData.imageData);
            }

            return {
                title: worksheetData.title || '',
                wordList: worksheetData.passage_text || worksheetData.words?.join('\n') || '',
                cards: cards,
                settings: worksheetData.settings || {}
            };
        } catch (error) {
            console.error('Error parsing loaded worksheet:', error);
            return null;
        }
    }

    async prepareImageData(cards) {
        const imageData = {};
        
        for (const card of cards) {
            if (card.imageUrl) {
                try {
                    // If it's a data URL, store directly
                    if (card.imageUrl.startsWith('data:')) {
                        imageData[card.english] = {
                            src: 'data',
                            data: card.imageUrl
                        };
                    } else {
                        // For external URLs, store the URL
                        imageData[card.english] = {
                            src: 'url',
                            data: card.imageUrl
                        };
                    }
                } catch (error) {
                    console.error(`Error preparing image data for ${card.english}:`, error);
                }
            }
        }
        
        return imageData;
    }

    restoreImagesFromData(cards, imageData) {
        if (!imageData) return;
        
        cards.forEach(card => {
            const savedImage = imageData[card.english];
            if (savedImage) {
                if (savedImage.src === 'data' || savedImage.src === 'url') {
                    card.imageUrl = savedImage.data;
                }
            }
        });
    }

    // Export/Import functionality
    exportToJSON(data) {
        const exportData = {
            title: data.title,
            wordList: data.wordList,
            cards: data.cards,
            settings: data.settings,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        return JSON.stringify(exportData, null, 2);
    }

    async exportToFile(data, filename = null) {
        try {
            const jsonData = this.exportToJSON(data);
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename || `flashcards_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error exporting to file:', error);
            throw error;
        }
    }

    async importFromFile(file) {
        try {
            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);
            
            // Validate imported data
            if (!this.validateImportedData(data)) {
                throw new Error('Invalid file format');
            }
            
            return data;
        } catch (error) {
            console.error('Error importing from file:', error);
            throw error;
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    validateImportedData(data) {
        return data && 
               typeof data === 'object' && 
               Array.isArray(data.cards) &&
               data.cards.every(card => 
                   typeof card === 'object' && 
                   typeof card.english === 'string'
               );
    }

    // Auto-save functionality
    enableAutoSave(app, intervalMs = 30000) {
        this.autoSaveInterval = setInterval(() => {
            try {
                const settings = app.getSettings();
                this.saveSettings(settings);
            } catch (error) {
                console.error('Auto-save error:', error);
            }
        }, intervalMs);
    }

    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    // Recent files management
    addToRecentFiles(worksheetData) {
        try {
            const recent = this.getRecentFiles();
            const newItem = {
                id: worksheetData.id || Date.now(),
                title: worksheetData.title,
                date: new Date().toISOString(),
                cardCount: worksheetData.cards?.length || 0
            };
            
            // Remove duplicates and add to front
            const filtered = recent.filter(item => item.id !== newItem.id);
            filtered.unshift(newItem);
            
            // Keep only last 10
            const limited = filtered.slice(0, 10);
            
            localStorage.setItem('flashcard_recent', JSON.stringify(limited));
        } catch (error) {
            console.error('Error adding to recent files:', error);
        }
    }

    getRecentFiles() {
        try {
            const stored = localStorage.getItem('flashcard_recent');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error getting recent files:', error);
            return [];
        }
    }

    clearRecentFiles() {
        try {
            localStorage.removeItem('flashcard_recent');
        } catch (error) {
            console.error('Error clearing recent files:', error);
        }
    }

    // Backup and restore
    createBackup() {
        try {
            const backup = {
                settings: this.loadSettings(),
                recent: this.getRecentFiles(),
                timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('flashcard_backup', JSON.stringify(backup));
            return backup;
        } catch (error) {
            console.error('Error creating backup:', error);
            return null;
        }
    }

    restoreBackup() {
        try {
            const backup = localStorage.getItem('flashcard_backup');
            if (backup) {
                const data = JSON.parse(backup);
                
                if (data.settings) {
                    this.saveSettings(data.settings);
                }
                
                if (data.recent) {
                    localStorage.setItem('flashcard_recent', JSON.stringify(data.recent));
                }
                
                return true;
            }
        } catch (error) {
            console.error('Error restoring backup:', error);
        }
        return false;
    }

    // Get usage statistics
    getUsageStats() {
        try {
            const stats = localStorage.getItem('flashcard_stats');
            return stats ? JSON.parse(stats) : {
                cardsCreated: 0,
                sessionsStarted: 0,
                lastUsed: null
            };
        } catch (error) {
            console.error('Error getting usage stats:', error);
            return { cardsCreated: 0, sessionsStarted: 0, lastUsed: null };
        }
    }

    updateUsageStats(update) {
        try {
            const current = this.getUsageStats();
            const updated = { ...current, ...update, lastUsed: new Date().toISOString() };
            localStorage.setItem('flashcard_stats', JSON.stringify(updated));
        } catch (error) {
            console.error('Error updating usage stats:', error);
        }
    }
}
