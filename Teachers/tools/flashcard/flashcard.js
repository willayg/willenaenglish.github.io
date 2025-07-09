import { CardManager } from './cardManager.js';
import { LayoutManager } from './layoutManager.js';
import { ImageManager } from './images.js';
import { DataManager } from './dataManager.js';
import { PrintManager } from './printManager.js';

class FlashcardApp {
    constructor() {
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
        const dropOverlay = document.getElementById('dropOverlay');
        const previewArea = document.getElementById('previewArea');

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        document.addEventListener('dragenter', () => {
            dropOverlay.classList.add('active');
        });

        document.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || e.relatedTarget.nodeName === 'HTML') {
                dropOverlay.classList.remove('active');
            }
        });

        document.addEventListener('drop', (e) => {
            dropOverlay.classList.remove('active');
            const files = Array.from(e.dataTransfer.files);
            if (files.length > 0) {
                this.imageManager.handleDroppedFiles(files);
            }
        });

        // Card-specific drag and drop
        previewArea.addEventListener('dragover', (e) => {
            const flashcard = e.target.closest('.flashcard');
            if (flashcard) {
                flashcard.classList.add('dragover');
            }
        });

        previewArea.addEventListener('dragleave', (e) => {
            const flashcard = e.target.closest('.flashcard');
            if (flashcard && !flashcard.contains(e.relatedTarget)) {
                flashcard.classList.remove('dragover');
            }
        });

        previewArea.addEventListener('drop', (e) => {
            const flashcard = e.target.closest('.flashcard');
            if (flashcard) {
                flashcard.classList.remove('dragover');
                const files = Array.from(e.dataTransfer.files);
                if (files.length > 0) {
                    const cardIndex = parseInt(flashcard.dataset.cardIndex);
                    this.imageManager.handleCardImageDrop(files[0], cardIndex);
                }
            }
        });
    }

    changeFontSize(delta) {
        const input = document.getElementById('fontSizeInput');
        const currentSize = parseInt(input.value);
        const newSize = Math.max(8, Math.min(72, currentSize + delta));
        input.value = newSize;
        this.updatePreview();
    }

    generateCards() {
        const wordList = document.getElementById('wordListInput').value.trim();
        if (!wordList) {
            alert('Please enter some words to generate cards.');
            return;
        }

        const words = wordList.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        this.cardManager.generateCards(words);
        this.updateCardList();
        this.updatePreview();
    }

    addImages() {
        this.imageManager.addImagesWithAI(this.cardManager.cards);
        this.updatePreview();
    }

    clearCards() {
        this.cardManager.clearCards();
        this.updateCardList();
        this.updatePreview();
    }

    refreshImages() {
        this.imageManager.refreshImages(this.cardManager.cards);
        this.updatePreview();
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
    }

    getSettings() {
        return {
            font: document.getElementById('fontSelect').value,
            fontSize: parseInt(document.getElementById('fontSizeInput').value),
            layout: document.getElementById('layoutSelect').value,
            cardSize: parseInt(document.getElementById('cardSizeSlider').value),
            showKorean: document.getElementById('showKoreanToggle').checked,
            imageOnly: document.getElementById('imageOnlyToggle').checked,
            title: document.getElementById('titleInput').value.trim()
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FlashcardApp();
});

export { FlashcardApp };