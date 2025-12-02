export class CardManager {
    constructor() {
        this.cards = [];
    }

    generateCards(words) {
        this.cards = words.map(word => ({
            english: word,
            korean: '', // Will be filled by translation if needed
            image: null,
            imageUrl: null
        }));
    }

    addCard(english, korean = '', image = null) {
        this.cards.push({
            english,
            korean,
            image,
            imageUrl: null
        });
    }

    updateCard(index, english, korean = '') {
        if (index >= 0 && index < this.cards.length) {
            this.cards[index].english = english;
            this.cards[index].korean = korean;
        }
    }

    deleteCard(index) {
        if (index >= 0 && index < this.cards.length) {
            this.cards.splice(index, 1);
        }
    }

    clearCards() {
        this.cards = [];
    }

    setCardImage(index, imageUrl, imageFile = null) {
        if (index >= 0 && index < this.cards.length) {
            this.cards[index].imageUrl = imageUrl;
            this.cards[index].image = imageFile;
        }
    }

    getCard(index) {
        return index >= 0 && index < this.cards.length ? this.cards[index] : null;
    }

    getCardCount() {
        return this.cards.length;
    }

    getAllCards() {
        return [...this.cards];
    }

    // Parse word list that may contain Korean translations
    parseWordList(wordList) {
        const lines = wordList.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        return lines.map(line => {
            // Check if line contains Korean (basic detection)
            const parts = line.split(/[,\-\/\|]/).map(part => part.trim());
            
            if (parts.length >= 2) {
                // Assume first part is English, second is Korean
                return {
                    english: parts[0],
                    korean: parts[1],
                    image: null,
                    imageUrl: null
                };
            } else {
                return {
                    english: line,
                    korean: '',
                    image: null,
                    imageUrl: null
                };
            }
        });
    }

    generateCardsFromParsedList(wordList) {
        this.cards = this.parseWordList(wordList);
    }

    // Search and filter cards
    searchCards(query) {
        if (!query) return this.cards;
        
        const lowerQuery = query.toLowerCase();
        return this.cards.filter(card => 
            card.english.toLowerCase().includes(lowerQuery) ||
            card.korean.toLowerCase().includes(lowerQuery)
        );
    }

    // Shuffle cards for randomization
    shuffleCards() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    // Sort cards alphabetically
    sortCards(by = 'english') {
        this.cards.sort((a, b) => {
            const aValue = a[by] || '';
            const bValue = b[by] || '';
            return aValue.localeCompare(bValue);
        });
    }

    // Duplicate card
    duplicateCard(index) {
        if (index >= 0 && index < this.cards.length) {
            const card = { ...this.cards[index] };
            this.cards.splice(index + 1, 0, card);
        }
    }

    // Move card position
    moveCard(fromIndex, toIndex) {
        if (fromIndex >= 0 && fromIndex < this.cards.length && 
            toIndex >= 0 && toIndex < this.cards.length && 
            fromIndex !== toIndex) {
            const card = this.cards.splice(fromIndex, 1)[0];
            this.cards.splice(toIndex, 0, card);
        }
    }

    // Get cards without images
    getCardsWithoutImages() {
        return this.cards.filter(card => !card.imageUrl);
    }

    // Get cards with images
    getCardsWithImages() {
        return this.cards.filter(card => card.imageUrl);
    }

    // Validate cards
    validateCards() {
        const errors = [];
        
        this.cards.forEach((card, index) => {
            if (!card.english || card.english.trim().length === 0) {
                errors.push(`Card ${index + 1}: Missing English text`);
            }
        });

        return errors;
    }

    // Export cards to various formats
    exportToCSV() {
        const headers = ['English', 'Korean', 'Has Image'];
        const rows = this.cards.map(card => [
            card.english,
            card.korean || '',
            card.imageUrl ? 'Yes' : 'No'
        ]);

        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        return csvContent;
    }

    exportToJSON() {
        return JSON.stringify(this.cards, null, 2);
    }

    // Import from CSV
    importFromCSV(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) return false; // Need at least header and one data row

        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const englishIndex = headers.findIndex(h => h.toLowerCase().includes('english'));
        const koreanIndex = headers.findIndex(h => h.toLowerCase().includes('korean'));

        if (englishIndex === -1) return false; // Must have English column

        this.cards = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.replace(/"/g, '').trim());
            if (values[englishIndex]) {
                this.cards.push({
                    english: values[englishIndex],
                    korean: koreanIndex !== -1 ? (values[koreanIndex] || '') : '',
                    image: null,
                    imageUrl: null
                });
            }
        }

        return true;
    }
}
