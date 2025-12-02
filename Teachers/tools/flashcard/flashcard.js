import { CardManager } from './cardManager.js';
import { LayoutManager } from './layoutManager.js';
import { ImageManager } from './images.js';
import { DataManager } from './dataManager.js';
import { PrintManager } from './printManager.js';
import { generateWordsFromTopic } from './ai.js';

console.log('Flashcard app loading...');

class FlashcardApp {
    constructor() {
        console.log('FlashcardApp constructor called');
        this.cardManager = new CardManager();
        this.layoutManager = new LayoutManager();
        this.imageManager = new ImageManager();
        this.dataManager = new DataManager();
        this.printManager = new PrintManager();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSettings();
        this.updatePreview();
        this.checkDevelopmentMode();
    }

    checkDevelopmentMode() {
        // Check if we're in local development - just log it, no UI indicators
        const isLocalDevelopment = window.location.protocol === 'file:' || 
                                 window.location.hostname === 'localhost' || 
                                 window.location.hostname === '127.0.0.1';
        
        if (isLocalDevelopment) {
            console.log('Development mode: Using fallback images');
        }
    }

    setupEventListeners() {
        // Toolbar controls
        document.getElementById('fontSelect').addEventListener('change', () => this.updatePreview());
        document.getElementById('fontSizeInput').addEventListener('input', () => this.updatePreview());
        document.getElementById('decreaseFontBtn').addEventListener('click', () => this.changeFontSize(-1));
        document.getElementById('increaseFontBtn').addEventListener('click', () => this.changeFontSize(1));
        document.getElementById('layoutSelect').addEventListener('change', () => this.updatePreview());
        document.getElementById('cardSizeSlider').addEventListener('input', () => this.updatePreview());
        document.getElementById('showKoreanToggle').addEventListener('change', () => this.updatePreview());
        document.getElementById('imageOnlyToggle').addEventListener('change', () => this.updatePreview());
        document.getElementById('refreshImagesBtn').addEventListener('click', () => this.refreshImages());

        // Sidebar controls
        document.getElementById('titleInput').addEventListener('input', () => this.updatePreview());
        document.getElementById('generateCardsBtn').addEventListener('click', () => this.generateCards());
        document.getElementById('generateFromTopicBtn').addEventListener('click', () => this.generateFromTopic());
        document.getElementById('addImagesBtn').addEventListener('click', () => this.addImages());
        document.getElementById('clearCardsBtn').addEventListener('click', () => this.clearCards());

        // Action buttons
        document.getElementById('loadBtn').addEventListener('click', () => this.loadFlashcards());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveFlashcards());
        document.getElementById('printBtn').addEventListener('click', () => this.printFlashcards());
        document.getElementById('pdfBtn').addEventListener('click', () => this.exportToPDF());

        // Drag and drop
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        // Simple drag and drop - only prevent default behavior
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }

    changeFontSize(delta) {
        const input = document.getElementById('fontSizeInput');
        const currentSize = parseInt(input.value);
        const newSize = Math.max(8, Math.min(72, currentSize + delta));
        input.value = newSize;
        this.updatePreview();
    }

    async generateCards() {
        const wordList = document.getElementById('wordListInput').value.trim();
        if (!wordList) {
            alert('Please enter some words to generate cards.');
            return;
        }

        const words = wordList.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        // Generate cards first
        this.cardManager.generateCards(words);
        this.updateCardList();
        this.updatePreview();
        
        // Start fetching images immediately for all cards
        this.fetchImagesForAllCards();
    }

    async generateFromTopic() {
        const topic = document.getElementById('topicInput').value.trim();
        const count = parseInt(document.getElementById('wordCountSelect').value);
        
        if (!topic) {
            alert('Please enter a topic (e.g., food, animals, colors)');
            return;
        }

        // Show loading state
        const generateBtn = document.getElementById('generateFromTopicBtn');
        const originalText = generateBtn.textContent;
        generateBtn.textContent = 'Generating...';
        generateBtn.disabled = true;

        try {
            console.log(`Generating ${count} words for topic: ${topic}`);
            const words = await generateWordsFromTopic(topic, count);
            
            if (words && words.length > 0) {
                // Update the word list input
                document.getElementById('wordListInput').value = words.join('\n');
                
                // Generate cards immediately
                this.cardManager.generateCards(words);
                this.updateCardList();
                this.updatePreview();
                
                // Start fetching images
                this.fetchImagesForAllCards();
                
                console.log(`Generated ${words.length} words for topic "${topic}":`, words);
            } else {
                alert('No words generated. Try a different topic.');
            }
        } catch (error) {
            console.error('Error generating words from topic:', error);
            alert('Error generating words. Please try again.');
        } finally {
            // Restore button state
            generateBtn.textContent = originalText;
            generateBtn.disabled = false;
        }
    }

    addImages() {
        // This is now just for manual refresh - use the same system
        this.fetchImagesForAllCards();
    }

    clearCards() {
        this.cardManager.clearCards();
        this.updateCardList();
        this.updatePreview();
    }

    refreshImages() {
        // Clear existing images first
        this.cardManager.cards.forEach(card => {
            card.imageUrl = null;
            const cacheKey = card.english.toLowerCase();
            this.imageManager.imageCache.delete(cacheKey);
        });
        
        // Fetch fresh images
        this.fetchImagesForAllCards();
    }

    updateCardList() {
        const cardList = document.getElementById('cardList');
        const cardCount = document.getElementById('cardCount');
        
        cardCount.textContent = `${this.cardManager.cards.length} cards`;
        
        if (this.cardManager.cards.length === 0) {
            cardList.innerHTML = '<p style="color: #718096; font-size: 14px; text-align: center;">No cards generated yet</p>';
            return;
        }

        cardList.innerHTML = this.cardManager.cards.map((card, index) => `
            <div class="card-item">
                <div class="card-item-text">${card.english}</div>
                <div class="card-item-actions">
                    <button class="card-item-btn" onclick="app.editCard(${index})" title="Edit">✏️</button>
                    <button class="card-item-btn" onclick="app.deleteCard(${index})" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    editCard(index) {
        const card = this.cardManager.cards[index];
        const newText = prompt('Edit card text:', card.english);
        if (newText && newText.trim()) {
            this.cardManager.updateCard(index, newText.trim());
            this.updateCardList();
            this.updatePreview();
        }
    }

    deleteCard(index) {
        if (confirm('Are you sure you want to delete this card?')) {
            this.cardManager.deleteCard(index);
            this.updateCardList();
            this.updatePreview();
        }
    }

    updatePreview() {
        const placeholder = document.getElementById('previewPlaceholder');
        const grid = document.getElementById('flashcardGrid');
        
        if (this.cardManager.cards.length === 0) {
            placeholder.style.display = 'block';
            grid.style.display = 'none';
            return;
        }

        placeholder.style.display = 'none';
        grid.style.display = 'grid';
        
        this.layoutManager.updateLayout(grid, this.cardManager.cards, this.getSettings());
        // For 1x2-portrait, force preview area to fill viewport
        const previewArea = document.getElementById('previewArea');
        if (this.getSettings().layout === '1x2-portrait') {
            previewArea.classList.add('full-portrait');
        } else {
            previewArea.classList.remove('full-portrait');
        }
        
        // Enable enhanced drag and drop for the updated cards
        this.setupImageDragAndDrop();
    }

    getSettings() {
        return {
            font: document.getElementById('fontSelect').value,
            fontSize: parseInt(document.getElementById('fontSizeInput').value),
            layout: document.getElementById('layoutSelect').value,
            cardSize: parseInt(document.getElementById('cardSizeSlider') ? document.getElementById('cardSizeSlider').value : 200),
            showKorean: document.getElementById('showKoreanToggle').checked,
            imageOnly: document.getElementById('imageOnlyToggle').checked,
            title: document.getElementById('titleInput').value.trim(),
            imageZoom: parseFloat(document.getElementById('imageZoomSlider') ? document.getElementById('imageZoomSlider').value : 1)
        };
    }

    loadSettings() {
        // Load settings from localStorage or use defaults
        const settings = this.dataManager.loadSettings();
        
        document.getElementById('fontSelect').value = settings.font || 'Poppins';
        document.getElementById('fontSizeInput').value = settings.fontSize || 18;
        document.getElementById('layoutSelect').value = settings.layout || '4-card';
        document.getElementById('cardSizeSlider').value = settings.cardSize || 200;
        document.getElementById('showKoreanToggle').checked = settings.showKorean || false;
        document.getElementById('imageOnlyToggle').checked = settings.imageOnly || false;
    }

    saveSettings() {
        this.dataManager.saveSettings(this.getSettings());
    }

    async loadFlashcards() {
        try {
            const data = await this.dataManager.loadFlashcards();
            if (data) {
                document.getElementById('titleInput').value = data.title || '';
                document.getElementById('wordListInput').value = data.wordList || '';
                this.cardManager.cards = data.cards || [];
                this.updateCardList();
                this.updatePreview();
                
                // Automatically fetch images for cards that don't have them
                this.fetchImagesForAllCards();
            }
        } catch (error) {
            console.error('Error loading flashcards:', error);
            alert('Error loading flashcards. Please try again.');
        }
    }

    async saveFlashcards() {
        try {
            const data = {
                title: document.getElementById('titleInput').value.trim(),
                wordList: document.getElementById('wordListInput').value.trim(),
                cards: this.cardManager.cards
            };
            await this.dataManager.saveFlashcards(data);
            this.saveSettings();
            alert('Flashcards saved successfully!');
        } catch (error) {
            console.error('Error saving flashcards:', error);
            alert('Error saving flashcards. Please try again.');
        }
    }

    printFlashcards() {
        this.printManager.printFlashcards(this.cardManager.cards, this.getSettings());
    }

    exportToPDF() {
        this.printManager.exportToPDF(this.cardManager.cards, this.getSettings());
    }

    // Fetch images for all cards immediately (like wordtest system)
    async fetchImagesForAllCards() {
        const cardsWithoutImages = this.cardManager.cards.filter(card => !card.imageUrl);
        console.log(`Starting to fetch images for ${cardsWithoutImages.length} cards`);
        
        if (cardsWithoutImages.length === 0) return;

        // Fetch images with small delays between requests (like wordtest)
        for (let i = 0; i < cardsWithoutImages.length; i++) {
            const card = cardsWithoutImages[i];
            try {
                console.log(`Fetching image for: ${card.english}`);
                
                // Update preview to show loading state
                this.updatePreview();
                
                await this.imageManager.fetchImageForCard(card);
                
                console.log(`Image fetched for ${card.english}:`, card.imageUrl ? 'SUCCESS' : 'NO IMAGE');
                
                // Update preview immediately when each image loads
                this.updatePreview();
                
                // Small delay to avoid rate limiting (like wordtest)
                if (i < cardsWithoutImages.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                console.error(`Error fetching image for "${card.english}":`, error);
            }
        }
        
        console.log('Finished fetching all images');
    }

    // Add drag and drop to each flashcard
    setupImageDragAndDrop() {
        document.querySelectorAll('.flashcard').forEach(card => {
            const index = parseInt(card.querySelector('.image-drop-zone')?.getAttribute('data-index'));
            
            if (isNaN(index)) return;
            
            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                card.style.border = '3px solid #4299e1';
                card.style.backgroundColor = '#e6f0fa';
            });
            
            card.addEventListener('dragleave', (e) => {
                if (!card.contains(e.relatedTarget)) {
                    card.style.border = '';
                    card.style.backgroundColor = '';
                }
            });
            
            card.addEventListener('drop', (e) => {
                e.preventDefault();
                card.style.border = '';
                card.style.backgroundColor = '';
                
                const files = Array.from(e.dataTransfer.files);
                const imageFile = files.find(file => file.type.startsWith('image/'));
                
                if (imageFile) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.cardManager.setCardImage(index, e.target.result, imageFile);
                        this.updatePreview();
                    };
                    reader.readAsDataURL(imageFile);
                }
            });
        });
    }

    // Add image cycling functionality (like wordtest)
    cycleCardImage(cardIndex) {
        const card = this.cardManager.getCard(cardIndex);
        if (!card) return;
        
        // For now, just trigger a new image fetch
        // In the future, we could implement multiple image alternatives like wordtest
        console.log(`Cycling image for card ${cardIndex}: ${card.english}`);
        
        // Clear current image and fetch a new one
        card.imageUrl = null;
        this.imageManager.fetchImageForCard(card).then(() => {
            this.updatePreview();
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    window.app = new FlashcardApp();
    // Make image cycling available globally for onclick handlers (like wordtest)
    window.cycleCardImage = (index) => window.app.cycleCardImage(index);
    console.log('App initialized');
});

export { FlashcardApp };