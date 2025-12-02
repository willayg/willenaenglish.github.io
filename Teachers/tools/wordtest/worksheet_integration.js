import { state } from './state.js';
import { updatePreview, updatePreviewPreservingImages } from './preview.js';
import { resetImageState } from './images.js';
import {
    highlightDuplicates as worksheetHighlightDuplicates,
    getCurrentWorksheetData as worksheetGetCurrentWorksheetData,
    loadWorksheet as worksheetLoadWorksheet,
    updateCurrentWordsFromTextarea as worksheetUpdateCurrentWordsFromTextarea
} from './worksheet.js';

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
    updatePreview().then(() => restoreSavedImages());
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

// Restore saved images after load
export function restoreSavedImages() {
    if (!window.savedImageData) return;
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;
    const dropZones = previewArea.querySelectorAll('.image-drop-zone');
    dropZones.forEach(zone => {
        const word = zone.getAttribute('data-word');
        const dataIndex = zone.getAttribute('data-index');
        if (word && dataIndex !== null) {
            const key = `${word.toLowerCase()}_${dataIndex}`;
            const savedImage = window.savedImageData[key];
            if (savedImage) {
                if (savedImage.src === 'emoji' && savedImage.emoji) {
                    const emojiSize = Math.max(currentSettings.imageSize * 0.8, 20);
                    zone.innerHTML = `<div style="font-size: ${emojiSize}px; line-height: 1; display: flex; align-items: center; justify-content: center; width: ${currentSettings.imageSize}px; height: ${currentSettings.imageSize}px;">${savedImage.emoji}</div>`;
                } else if (savedImage.src && savedImage.src !== 'emoji') {
                    const img = zone.querySelector('img');
                    if (img) {
                        img.src = savedImage.src;
                    } else {
                        zone.innerHTML = `<img src="${savedImage.src}" style="width:${currentSettings.imageSize}px;height:${currentSettings.imageSize}px;object-fit:cover;border-radius:8px;" data-word="${word}" data-index="${dataIndex}">`;
                    }
                }
            }
        }
    });
    window.savedImageData = null;
}
