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

// AI topic-based word generation
export async function generateWordsFromTopic(topic, count = 20) {
    try {
        console.log(`Generating ${count} words for topic: ${topic}`);

        // Only treat file:// protocol as local fallback
        const isFileProtocol = window.location.protocol === 'file:';

        if (isFileProtocol) {
            // Use predefined word sets for local file browsing only
            return generateWordsFromTopicLocal(topic, count);
        }

        // Use OpenAI proxy for production
        const response = await fetch('/.netlify/functions/openai_proxy', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                endpoint: 'chat/completions',
                payload: {
                    model: 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant for generating vocabulary lists.' },
                        { role: 'user', content: `Give me a list of exactly ${count} common English words about "${topic}". Only output the words, one per line, no numbering, no explanations.` }
                    ],
                    max_tokens: 256,
                    temperature: 0.7
                }
            })
        });

        if (response.ok) {
            const data = await response.json();
            // OpenAI proxy returns { data: { choices: [...] } }
            const choices = data.data && data.data.choices;
            if (choices && choices[0] && choices[0].message && choices[0].message.content) {
                const words = choices[0].message.content
                    .trim()
                    .split('\n')
                    .map(word => word.trim())
                    .filter(word => word.length > 0)
                    .slice(0, count);
                return words;
            }
        }

        // Fallback to local generation if API fails
        console.log('AI API failed, using local fallback');
        return generateWordsFromTopicLocal(topic, count);

    } catch (error) {
        console.error('Error generating words from topic:', error);
        return generateWordsFromTopicLocal(topic, count);
    }
}

function generateWordsFromTopicLocal(topic, count = 20) {
    const topicWords = {
        food: [
            'apple', 'banana', 'orange', 'grape', 'strawberry', 'bread', 'milk', 'cheese', 'butter', 'egg',
            'chicken', 'beef', 'fish', 'rice', 'pasta', 'pizza', 'sandwich', 'soup', 'salad', 'cake',
            'cookie', 'chocolate', 'ice cream', 'coffee', 'tea', 'water', 'juice', 'potato', 'carrot', 'tomato'
        ],
        animals: [
            'dog', 'cat', 'bird', 'fish', 'rabbit', 'horse', 'cow', 'pig', 'sheep', 'goat',
            'chicken', 'duck', 'elephant', 'lion', 'tiger', 'bear', 'wolf', 'fox', 'deer', 'mouse',
            'rat', 'hamster', 'guinea pig', 'frog', 'snake', 'turtle', 'spider', 'butterfly', 'bee', 'ant'
        ],
        colors: [
            'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'brown', 'black', 'white',
            'gray', 'grey', 'silver', 'gold', 'violet', 'indigo', 'turquoise', 'navy', 'lime', 'maroon',
            'beige', 'tan', 'coral', 'salmon', 'crimson', 'azure', 'cyan', 'magenta', 'olive', 'teal'
        ],
        transportation: [
            'car', 'bus', 'train', 'plane', 'boat', 'ship', 'bicycle', 'motorcycle', 'truck', 'taxi',
            'subway', 'helicopter', 'rocket', 'scooter', 'skateboard', 'rollerblade', 'wagon', 'cart', 'sled', 'canoe',
            'yacht', 'ferry', 'tram', 'van', 'ambulance', 'fire truck', 'police car', 'limousine', 'pickup truck', 'trailer'
        ],
        body: [
            'head', 'face', 'eye', 'nose', 'mouth', 'ear', 'hair', 'neck', 'shoulder', 'arm',
            'hand', 'finger', 'thumb', 'chest', 'back', 'stomach', 'leg', 'knee', 'foot', 'toe',
            'elbow', 'wrist', 'ankle', 'skin', 'teeth', 'tongue', 'lip', 'chin', 'forehead', 'cheek'
        ],
        clothes: [
            'shirt', 'pants', 'dress', 'skirt', 'jacket', 'coat', 'sweater', 'hat', 'cap', 'shoes',
            'socks', 'underwear', 'bra', 'tie', 'belt', 'gloves', 'scarf', 'boots', 'sandals', 'shorts',
            'jeans', 'suit', 'uniform', 'pajamas', 'robe', 'vest', 'cardigan', 'hoodie', 'tank top', 'leggings'
        ],
        house: [
            'house', 'room', 'kitchen', 'bedroom', 'bathroom', 'living room', 'dining room', 'garage', 'garden', 'yard',
            'door', 'window', 'wall', 'floor', 'ceiling', 'roof', 'stairs', 'table', 'chair', 'bed',
            'sofa', 'couch', 'refrigerator', 'stove', 'oven', 'sink', 'toilet', 'shower', 'bathtub', 'mirror'
        ],
        school: [
            'school', 'classroom', 'teacher', 'student', 'book', 'notebook', 'pencil', 'pen', 'eraser', 'ruler',
            'desk', 'chair', 'blackboard', 'whiteboard', 'computer', 'tablet', 'calculator', 'backpack', 'homework', 'test',
            'exam', 'grade', 'lesson', 'subject', 'math', 'science', 'history', 'english', 'art', 'music'
        ],
        nature: [
            'tree', 'flower', 'grass', 'leaf', 'branch', 'root', 'seed', 'fruit', 'forest', 'mountain',
            'river', 'lake', 'ocean', 'sea', 'beach', 'island', 'rock', 'stone', 'sand', 'sky',
            'cloud', 'sun', 'moon', 'star', 'rain', 'snow', 'wind', 'storm', 'rainbow', 'earth'
        ],
        sports: [
            'football', 'basketball', 'baseball', 'tennis', 'soccer', 'golf', 'swimming', 'running', 'cycling', 'skiing',
            'boxing', 'wrestling', 'volleyball', 'hockey', 'cricket', 'badminton', 'ping pong', 'bowling', 'surfing', 'diving',
            'gymnastics', 'dancing', 'yoga', 'martial arts', 'archery', 'fishing', 'hunting', 'hiking', 'climbing', 'skating'
        ]
    };
    
    const topicKey = topic.toLowerCase();
    let words = [];
    
    // Direct topic match
    if (topicWords[topicKey]) {
        words = [...topicWords[topicKey]];
    } else {
        // Partial matches
        for (const [key, wordList] of Object.entries(topicWords)) {
            if (key.includes(topicKey) || topicKey.includes(key)) {
                words = [...wordList];
                break;
            }
        }
        
        // If no match found, combine some common categories
        if (words.length === 0) {
            words = [
                ...topicWords.food.slice(0, 5),
                ...topicWords.animals.slice(0, 5),
                ...topicWords.colors.slice(0, 5),
                ...topicWords.house.slice(0, 5)
            ];
        }
    }
    
    // Shuffle and limit to requested count
    const shuffled = words.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}