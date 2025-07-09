// AI integration for flashcard module
// Uses the same Pixabay proxy as the wordtest module

export async function extractWordsWithAI(text, options = {}) {
    // Placeholder for future AI integration
    // For now, just return basic word extraction
    return extractBasicWords(text, options);
}

function extractBasicWords(text, options = {}) {
    const { maxWords = 20, minLength = 2 } = options;
    
    // Basic word extraction
    const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length >= minLength)
        .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
        .slice(0, maxWords);
    
    return words;
}

export async function translateWord(word, targetLanguage = 'ko') {
    // Placeholder for translation service
    // In a real implementation, this would call a translation API
    console.log(`Translation requested: ${word} -> ${targetLanguage}`);
    return '';
}

export async function generateFlashcardContent(words, options = {}) {
    const { includeTranslations = false, targetLanguage = 'ko' } = options;
    
    const flashcards = [];
    
    for (const word of words) {
        const card = {
            english: word,
            korean: '',
            image: null,
            imageUrl: null
        };
        
        if (includeTranslations) {
            try {
                card.korean = await translateWord(word, targetLanguage);
            } catch (error) {
                console.error(`Translation failed for ${word}:`, error);
            }
        }
        
        flashcards.push(card);
    }
    
    return flashcards;
}

export async function enhanceFlashcards(cards) {
    // Placeholder for AI enhancement
    // Could add definitions, example sentences, etc.
    return cards.map(card => ({
        ...card,
        enhanced: true
    }));
}

export function suggestWords(partialWord, wordList = []) {
    if (!partialWord || partialWord.length < 2) return [];
    
    const lowerPartial = partialWord.toLowerCase();
    return wordList
        .filter(word => word.toLowerCase().startsWith(lowerPartial))
        .slice(0, 10);
}

export function validateWordList(words) {
    const errors = [];
    const warnings = [];
    
    words.forEach((word, index) => {
        if (!word || word.trim().length === 0) {
            errors.push(`Empty word at position ${index + 1}`);
        } else if (word.length < 2) {
            warnings.push(`Very short word "${word}" at position ${index + 1}`);
        } else if (!/^[a-zA-Z\s-]+$/.test(word)) {
            warnings.push(`Non-standard characters in "${word}" at position ${index + 1}`);
        }
    });
    
    // Check for duplicates
    const seen = new Set();
    words.forEach((word, index) => {
        const normalized = word.toLowerCase().trim();
        if (seen.has(normalized)) {
            warnings.push(`Duplicate word "${word}" at position ${index + 1}`);
        }
        seen.add(normalized);
    });
    
    return { errors, warnings };
}

export function analyzeWordDifficulty(word) {
    // Simple difficulty analysis based on length and common patterns
    let difficulty = 'easy';
    
    if (word.length > 8) difficulty = 'hard';
    else if (word.length > 5) difficulty = 'medium';
    
    // Check for complex patterns
    if (/[qxz]/.test(word.toLowerCase())) difficulty = 'hard';
    if (/ph|gh|ch|th|sh/.test(word.toLowerCase())) {
        difficulty = difficulty === 'easy' ? 'medium' : 'hard';
    }
    
    return difficulty;
}

export function categorizeWords(words) {
    const categories = {
        animals: [],
        food: [],
        colors: [],
        numbers: [],
        verbs: [],
        adjectives: [],
        other: []
    };
    
    // Simple categorization based on common word lists
    const animalWords = ['cat', 'dog', 'bird', 'fish', 'horse', 'cow', 'pig', 'sheep', 'lion', 'tiger', 'elephant', 'monkey'];
    const foodWords = ['apple', 'banana', 'bread', 'milk', 'cheese', 'meat', 'rice', 'chicken', 'fish', 'cake'];
    const colorWords = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'orange', 'purple', 'pink', 'brown'];
    const numberWords = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
    const verbWords = ['run', 'walk', 'eat', 'sleep', 'play', 'work', 'study', 'read', 'write', 'sing'];
    
    words.forEach(word => {
        const lowerWord = word.toLowerCase();
        
        if (animalWords.includes(lowerWord)) {
            categories.animals.push(word);
        } else if (foodWords.includes(lowerWord)) {
            categories.food.push(word);
        } else if (colorWords.includes(lowerWord)) {
            categories.colors.push(word);
        } else if (numberWords.includes(lowerWord)) {
            categories.numbers.push(word);
        } else if (verbWords.includes(lowerWord)) {
            categories.verbs.push(word);
        } else {
            categories.other.push(word);
        }
    });
    
    return categories;
}

export function generateWordPairs(words) {
    // Generate related word pairs for matching exercises
    const pairs = [];
    const categories = categorizeWords(words);
    
    Object.entries(categories).forEach(([category, categoryWords]) => {
        if (categoryWords.length >= 2) {
            for (let i = 0; i < categoryWords.length - 1; i += 2) {
                if (categoryWords[i + 1]) {
                    pairs.push({
                        word1: categoryWords[i],
                        word2: categoryWords[i + 1],
                        relationship: category
                    });
                }
            }
        }
    });
    
    return pairs;
}

export function generateStudySchedule(cards, options = {}) {
    const { 
        sessionsPerWeek = 3, 
        cardsPerSession = 10, 
        reviewInterval = 3 
    } = options;
    
    const schedule = [];
    const totalCards = cards.length;
    const cardsPerDay = Math.ceil(totalCards / sessionsPerWeek);
    
    for (let week = 0; week < 4; week++) {
        for (let session = 0; session < sessionsPerWeek; session++) {
            const startIndex = session * cardsPerSession;
            const endIndex = Math.min(startIndex + cardsPerSession, totalCards);
            
            if (startIndex < totalCards) {
                schedule.push({
                    week: week + 1,
                    session: session + 1,
                    cards: cards.slice(startIndex, endIndex),
                    type: week === 0 ? 'learn' : 'review',
                    estimatedTime: Math.ceil(cardsPerSession * 1.5) // minutes
                });
            }
        }
    }
    
    return schedule;
}

export function getWordFrequency(words) {
    // Simple frequency analysis
    const frequency = {};
    
    words.forEach(word => {
        const normalized = word.toLowerCase().trim();
        frequency[normalized] = (frequency[normalized] || 0) + 1;
    });
    
    return Object.entries(frequency)
        .sort(([,a], [,b]) => b - a)
        .map(([word, count]) => ({ word, count }));
}

export function optimizeCardOrder(cards, strategy = 'difficulty') {
    const optimized = [...cards];
    
    switch (strategy) {
        case 'difficulty':
            optimized.sort((a, b) => {
                const diffA = analyzeWordDifficulty(a.english);
                const diffB = analyzeWordDifficulty(b.english);
                const order = { easy: 1, medium: 2, hard: 3 };
                return order[diffA] - order[diffB];
            });
            break;
            
        case 'alphabetical':
            optimized.sort((a, b) => a.english.localeCompare(b.english));
            break;
            
        case 'random':
            for (let i = optimized.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [optimized[i], optimized[j]] = [optimized[j], optimized[i]];
            }
            break;
            
        case 'length':
            optimized.sort((a, b) => a.english.length - b.english.length);
            break;
    }
    
    return optimized;
}