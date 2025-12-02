// Fallback implementations for worksheet-related utilities
// These are used when the primary modules are unavailable.

/**
 * Fallback: mask word pairs based on test mode
 * @param {Array<{eng:string, kor:string, [key:string]:any}>} wordPairs
 * @param {"none"|"hide-eng"|"hide-kor"} testMode
 * @param {number} [numLettersToHide]
 * @returns {Array}
 */
export function maskWordPairs(wordPairs, testMode, numLettersToHide = 1) {
    if (testMode === "none") return wordPairs;
    return wordPairs.map(pair => {
        if (testMode === "hide-eng") {
            return { ...pair, eng: "" };
        } else if (testMode === "hide-kor") {
            return { ...pair, kor: "" };
        }
        return pair;
    });
}

/**
 * Fallback: hide random letters in a word, skipping the first character and non-letters
 * @param {string} word
 * @param {number} [numLettersToHide]
 * @returns {string}
 */
export function hideRandomLetters(word, numLettersToHide = 1) {
    if (!word || word.length < 2) return word;

    // Collect positions of letters (A-Z, a-z) excluding first character
    const letterPositions = [];
    for (let i = 1; i < word.length; i++) {
        if (/[a-zA-Z]/.test(word[i])) {
            letterPositions.push(i);
        }
    }

    const actualHideCount = Math.min(numLettersToHide, letterPositions.length);
    const shuffled = [...letterPositions].sort(() => Math.random() - 0.5);
    const positionsToHide = shuffled.slice(0, actualHideCount);

    return word
        .split("")
        .map((ch, idx) => (positionsToHide.includes(idx) ? "_" : ch))
        .join("");
}
