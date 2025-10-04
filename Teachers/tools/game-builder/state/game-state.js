// Game State - Word list management, undo/redo, and payload building

// Internal canonical list array. We keep the same array reference so legacy code
// that captured `list` (or window.list) continues to see updates after refactor.
let list = [];
let currentGameId = null;
let undoStack = [];
let redoStack = [];
const MAX_UNDO_STACK = 50;

/**
 * Get current word list
 * @returns {Array} Current list
 */
export function getList() {
  return list;
}

/**
 * Set word list
 * @param {Array} newList - New list to set
 */
export function setList(newList) {
  if (!Array.isArray(newList)) {
    list.length = 0;
    return;
  }
  // Mutate existing array reference
  list.length = 0;
  for (const item of newList) list.push(item);
}

// Direct reference (read-only usage preferred). Allows bridging legacy globals.
export function getListRef() { return list; }

/**
 * Get current game ID
 * @returns {string|null} Current game ID
 */
export function getCurrentGameId() {
  return currentGameId;
}

/**
 * Set current game ID
 * @param {string|null} id - Game ID to set
 */
export function setCurrentGameId(id) {
  currentGameId = id;
}

/**
 * Create a new word row with defaults
 * @param {Object} data - Partial word data
 * @returns {Object} Complete word object
 */
export function newRow(data = {}) {
  return {
    eng: data.eng || '',
    kor: data.kor || '',
    image_url: data.image_url || '',
    definition: data.definition || '',
    example: data.example || data.example_sentence || ''
  };
}

/**
 * Save current state to undo stack
 */
export function saveState() {
  undoStack.push(JSON.parse(JSON.stringify(list)));
  if (undoStack.length > MAX_UNDO_STACK) undoStack.shift();
  redoStack = [];
}

/**
 * Undo last change
 * @returns {boolean} True if undo was performed
 */
export function undo() {
  if (!undoStack.length) return false;
  redoStack.push(JSON.parse(JSON.stringify(list)));
  list = undoStack.pop();
  return true;
}

/**
 * Redo last undo
 * @returns {boolean} True if redo was performed
 */
export function redo() {
  if (!redoStack.length) return false;
  undoStack.push(JSON.parse(JSON.stringify(list)));
  list = redoStack.pop();
  return true;
}

/**
 * Clear all state (words, undo/redo, game ID)
 */
export function clearAllState() {
  list = [];
  currentGameId = null;
  undoStack = [];
  redoStack = [];
}

/**
 * Build game payload for saving
 * @param {string} title - Game title
 * @param {string} gameImageUrl - Cover image URL
 * @returns {Object} Complete game payload
 */
export function buildPayload(title = '', gameImageUrl = '') {
  // Helper: Generate fallback sentence for word
  const vowels = /^[aeiou]/i;
  
  function fallbackSentence(w) {
    const eng = (w.eng || '').trim();
    if (!eng) return '';
    
    if (eng.includes(' ')) return `I can ${eng}.`;
    
    const art = vowels.test(eng) ? 'an' : 'a';
    if (/ing$/i.test(eng)) return `They are ${eng}.`;
    
    return `This is ${art} ${eng}.`;
  }
  
  function chooseLegacySentence(w) {
    // 1. Pre-existing legacy_sentence (if user loaded an older game)
    if (w.legacy_sentence && /\w+\s+\w+\s+\w+/.test(w.legacy_sentence)) {
      return w.legacy_sentence.trim();
    }
    
    // 2. Example with >=3 tokens
    if (w.example && /\w+\s+\w+\s+\w+/.test(w.example)) {
      return w.example.trim();
    }
    
    // 3. Definition (take first clause up to 14 words)
    if (w.definition) {
      const words = w.definition.trim().split(/\s+/).slice(0, 14);
      if (words.length >= 3) {
        let def = words.join(' ');
        def = def.replace(/\s+$/, '');
        if (!/[.!?]$/.test(def)) def += '.';
        return def;
      }
    }
    
    // 4. Generated fallback
    return fallbackSentence(w);
  }
  
  return {
    title: title || 'Untitled Game',
    gameImage: gameImageUrl || '',
    words: list.map(w => ({
      eng: w.eng || '',
      kor: w.kor || '',
      image_url: w.image_url || '',
      definition: w.definition || '',
      example: w.example || '',
      legacy_sentence: chooseLegacySentence(w)
    }))
  };
}

/**
 * Cache current game to session storage
 * @param {string} title - Game title
 */
export function cacheCurrentGame(title = '') {
  try {
    const payload = buildPayload(title);
    sessionStorage.setItem('gb_last_game_v1', JSON.stringify({
      id: currentGameId,
      title: payload.title,
      words: payload.words
    }));
  } catch {}
}

/**
 * Parse word data from various formats
 * @param {*} words - Words in various formats
 * @returns {Array} Normalized word array
 */
export function parseWords(words) {
  if (typeof words === 'string') {
    try {
      words = JSON.parse(words);
    } catch {}
  }
  
  if (!Array.isArray(words) && words && typeof words === 'object') {
    if (Array.isArray(words.words)) words = words.words;
    else if (Array.isArray(words.data)) words = words.data;
    else if (Array.isArray(words.items)) words = words.items;
    else {
      const numKeys = Object.keys(words).filter(k => /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
      if (numKeys.length) words = numKeys.map(k => words[k]);
    }
  }
  
  if (!Array.isArray(words)) return [];
  
  return words.map(w => {
    if (!w) return null;
    
    if (typeof w === 'string') {
      const parts = w.split(/[,|]/);
      const eng = (parts[0] || '').trim();
      const kor = (parts[1] || '').trim();
      return eng ? newRow({ eng, kor }) : null;
    }
    
    return newRow({
      eng: w.eng || w.en || w.word || '',
      kor: w.kor || w.kr || w.translation || '',
      image_url: w.image_url || w.image || w.img || w.img_url || w.picture || '',
      definition: w.definition || w.def || w.meaning || '',
      example: w.example || w.example_sentence || w.sentence || ''
    });
  }).filter(Boolean);
}
