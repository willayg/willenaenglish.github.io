import { state } from './state.js?v=20260923-imgstate2';
import { updatePreview, updatePreviewPreservingImages } from './preview.js?v=20260923-imgstate2';
import { resetImageState } from './images.js?v=20260923-imgstate2';
import {
    highlightDuplicates as worksheetHighlightDuplicates,
    getCurrentWorksheetData as worksheetGetCurrentWorksheetData,
    loadWorksheet as worksheetLoadWorksheet,
    updateCurrentWordsFromTextarea as worksheetUpdateCurrentWordsFromTextarea
} from './worksheet.js?v=20260923-imgstate2';

const currentWords = state.currentWords;
const currentSettings = state.currentSettings;

export function getCurrentWorksheetData() {
    return worksheetGetCurrentWorksheetData(currentWords, currentSettings);
}

export function loadWorksheet(worksheet) {
    const result = worksheetLoadWorksheet(worksheet, currentWords, currentSettings);
    if (result) {
        currentWords.length = 0;
        if (Array.isArray(result.currentWords)) currentWords.push(...result.currentWords);
        if (result.currentSettings && typeof result.currentSettings === 'object') {
            Object.assign(currentSettings, result.currentSettings);
        }
    }
    // Force images to reload for this worksheet (do not keep previous alternatives)
    resetImageState();
    updateCurrentWordsFromTextarea();
    worksheetHighlightDuplicates();
    updatePreview();
}

export function updateCurrentWordsFromTextarea() {
    const updated = worksheetUpdateCurrentWordsFromTextarea();
    currentWords.length = 0;
    if (Array.isArray(updated)) currentWords.push(...updated);
}

export function clearAll() {
    currentWords.length = 0;
    const ta = document.getElementById('wordListTextarea');
    if (ta) ta.value = '';
    const duplicateWarning = document.getElementById('duplicateWarning');
    if (duplicateWarning) duplicateWarning.style.display = 'none';
    updatePreview();
}

// Kept for backward compatibility. Rendering now reads window.savedImageData directly.
export function restoreSavedImages() {
    return;
}
