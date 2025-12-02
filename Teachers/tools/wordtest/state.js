// Centralized state for Word Worksheet tool
// Export a singleton state object so all modules share the same references.

export const state = {
    currentWords: [],
    currentSettings: {
        font: 'Arial',
        fontSize: 15,
        layout: 'default',
        imageGap: 25,
        imageSize: 50,
        testMode: 'none', // 'none', 'hide-eng', 'hide-kor', 'hide-random-letters'
        numLettersToHide: 1
    },
    undoStack: []
};
