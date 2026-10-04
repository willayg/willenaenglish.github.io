import { maskWordPairs as fallbackMaskWordPairs, hideRandomLetters as fallbackHideRandomLetters } from './fallbacks.js';

// Overridable behaviors used across modules
let _maskWordPairs = fallbackMaskWordPairs;
let _hideRandomLetters = fallbackHideRandomLetters;

export function setMaskWordPairs(fn) {
    if (typeof fn === 'function') _maskWordPairs = fn;
}

export function setHideRandomLetters(fn) {
    if (typeof fn === 'function') _hideRandomLetters = fn;
}

export function maskWordPairs(...args) {
    return _maskWordPairs(...args);
}

export function hideRandomLetters(...args) {
    return _hideRandomLetters(...args);
}
