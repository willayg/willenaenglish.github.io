import { state } from './state.js';
import { updatePreview, updatePreviewStyles } from './preview.js';
import {
    updateFont as uiUpdateFont,
    updateFontSize as uiUpdateFontSize,
    increaseFontSize as uiIncreaseFontSize,
    decreaseFontSize as uiDecreaseFontSize,
    updateImageGap as uiUpdateImageGap,
    updateImageSize as uiUpdateImageSize,
    updateLayout as uiUpdateLayout
} from './ui.js';

const currentSettings = state.currentSettings;

export function updateFont() { uiUpdateFont(currentSettings, updatePreviewStyles); }
export function updateFontSize() { uiUpdateFontSize(currentSettings, updatePreviewStyles); }
export function increaseFontSize() { uiIncreaseFontSize(updateFontSize); }
export function decreaseFontSize() { uiDecreaseFontSize(updateFontSize); }
export function updateImageGap() { uiUpdateImageGap(currentSettings, updatePreviewStyles); }
export function updateImageSize() { uiUpdateImageSize(currentSettings, updatePreviewStyles); }
export function updateLayout() { uiUpdateLayout(currentSettings, updatePreview); }
