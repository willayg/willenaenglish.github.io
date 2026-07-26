import { state } from './state.js';
import { enableImageDragAndDrop, renderImage, getImageUrl, getPlaceholderImage } from './images.js';
import { hideRandomLetters } from './behaviors.js';
import { generateWorksheetHTML as rendererGenerateWorksheetHTML } from './renderer.js';
import { generateMatchingWorksheetHTML } from './matching-renderer.js';

const currentWords = state.currentWords;
const currentSettings = state.currentSettings;
const MATCHING_LAYOUTS = ['picture-matching', 'eng-kor-matching'];
const IMAGE_LAYOUTS = ['picture-list','picture-list-2col','picture-quiz','picture-quiz-5col','picture-matching','6col-images','5col-images','eng-kor-matching'];

export async function updatePreview() {
    window.currentSettings = state.currentSettings;
    const previewArea = document.getElementById('previewArea');
    const title = document.getElementById('titleInput')?.value || 'Worksheet Title';
    if (!previewArea) return;

    if (currentWords.length === 0) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Add some words to see the preview</p></div>';
        return;
    }

    if (IMAGE_LAYOUTS.includes(currentSettings.layout)) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Loading worksheet...</p></div>';
        await new Promise(resolve => setTimeout(resolve, 60));
    }

    previewArea.innerHTML = await generateWorksheetHTML(title, currentWords);
    ensurePreviewHint(previewArea);
    enableImageDragAndDrop(updatePreview);
    addWordCellInteractivity(previewArea);
}

export async function updatePreviewPreservingImages() {
    const previewArea = document.getElementById('previewArea');
    const title = document.getElementById('titleInput')?.value || 'Worksheet Title';
    if (!previewArea) return;

    if (currentWords.length === 0) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Add some words to see the preview</p></div>';
        return;
    }

    const existingImages = new Map();
    previewArea.querySelectorAll('.image-drop-zone').forEach(zone => {
        const word = zone.getAttribute('data-word');
        const index = zone.getAttribute('data-index');
        const image = zone.querySelector('img');
        if (word && index !== null && image) existingImages.set(`${word.toLowerCase()}_${index}`, image.src);
    });

    previewArea.innerHTML = await generateWorksheetHTML(title, currentWords);
    ensurePreviewHint(previewArea);

    previewArea.querySelectorAll('.image-drop-zone').forEach(zone => {
        const word = zone.getAttribute('data-word');
        const index = zone.getAttribute('data-index');
        const image = zone.querySelector('img');
        if (!word || index === null || !image) return;
        const key = `${word.toLowerCase()}_${index}`;
        const saved = existingImages.get(key) || window.savedImageData?.[key]?.src;
        if (saved) image.src = saved;
    });

    enableImageDragAndDrop(updatePreviewPreservingImages);
    addWordCellInteractivity(previewArea);
}

export async function updatePreviewStyles() {
    window.currentSettings = state.currentSettings;
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;

    const previewRoot = previewArea.querySelector('.worksheet-preview');
    if (!previewRoot) return updatePreview();

    if ((currentSettings.testMode && currentSettings.testMode !== 'none') || IMAGE_LAYOUTS.includes(currentSettings.layout)) {
        return updatePreviewPreservingImages();
    }

    try {
        previewRoot.style.fontFamily = currentSettings.font;
        previewRoot.style.fontSize = `${currentSettings.fontSize}px`;
        previewRoot.querySelectorAll('table').forEach(table => {
            table.style.fontFamily = currentSettings.font;
            table.style.fontSize = `${currentSettings.fontSize}px`;
        });
        previewRoot.querySelectorAll('th, td, div').forEach(element => {
            if (!element.classList.contains('image-drop-zone') && !element.querySelector('.image-drop-zone')) {
                element.style.fontFamily = currentSettings.font;
            }
        });
        previewRoot.querySelectorAll('.image-drop-zone img').forEach(image => {
            if (!image.hasAttribute('data-custom-size')) {
                image.style.width = `${currentSettings.imageSize}px`;
                image.style.height = `${currentSettings.imageSize}px`;
            }
        });
        previewRoot.querySelectorAll('.image-drop-zone div[style*="font-size"]').forEach(element => {
            element.style.fontSize = `${Math.round(currentSettings.imageSize * 0.8)}px`;
        });
        previewRoot.querySelectorAll('.image-drop-zone div[style*="width"]').forEach(element => {
            if (!element.style.fontSize) {
                element.style.width = `${currentSettings.imageSize}px`;
                element.style.height = `${currentSettings.imageSize}px`;
            }
        });
    } catch (error) {
        console.warn('updatePreviewStyles fallback due to error:', error);
        return updatePreviewPreservingImages();
    }
}

function ensurePreviewHint(previewArea) {
    if (!previewArea || sessionStorage.getItem('waPreviewHintShown') === '1') return;
    if (window.getComputedStyle(previewArea).position === 'static') previewArea.style.position = 'relative';

    const hint = document.createElement('div');
    hint.id = 'preview-helper-hint';
    hint.className = 'print-hide';
    hint.textContent = 'Tip: Left-click a word to edit, right-click to delete';
    Object.assign(hint.style, {
        position: 'absolute', left: '8px', top: '8px', background: 'rgba(36,159,230,.9)', color: '#fff',
        padding: '6px 10px', borderRadius: '6px', fontSize: '12px', zIndex: '20', opacity: '0',
        pointerEvents: 'none', transition: 'opacity .18s cubic-bezier(.4,0,.2,1)'
    });
    previewArea.appendChild(hint);
    requestAnimationFrame(() => {
        hint.style.opacity = '1';
        setTimeout(() => {
            hint.style.opacity = '0';
            sessionStorage.setItem('waPreviewHintShown', '1');
        }, 4000);
    });
}

function addWordCellInteractivity(previewArea) {
    if (!previewArea || previewArea.dataset.wordCellHandlers === '1') return;
    previewArea.dataset.wordCellHandlers = '1';

    const countDuplicates = (language, value) => {
        const normalised = (value || '').trim().toLowerCase();
        return normalised && currentWords.filter(word => (word[language] || '').trim().toLowerCase() === normalised).length > 1;
    };

    previewArea.addEventListener('contextmenu', event => {
        const cell = event.target.closest('.word-cell');
        if (!cell || !previewArea.contains(cell)) return;
        event.preventDefault();
        const index = Number.parseInt(cell.dataset.index, 10);
        if (!Number.isInteger(index) || !currentWords[index]) return;
        state.undoStack.push(JSON.parse(JSON.stringify(currentWords)));
        if (state.undoStack.length > 50) state.undoStack.shift();
        currentWords.splice(index, 1);
        syncTextarea();
        updatePreviewPreservingImages();
    });

    previewArea.addEventListener('click', event => {
        if (event.button !== 0) return;
        const cell = event.target.closest('.word-cell');
        if (!cell || !previewArea.contains(cell) || cell.querySelector('input')) return;
        const index = Number.parseInt(cell.dataset.index, 10);
        const language = cell.dataset.lang;
        if (!Number.isInteger(index) || !currentWords[index] || !['eng', 'kor'].includes(language)) return;

        const originalValue = currentWords[index][language] || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalValue;
        Object.assign(input.style, { width: '90%', background: 'transparent', border: '1px solid #ccc', fontSize: 'inherit', fontFamily: 'inherit' });
        cell.replaceChildren(input);
        input.focus();

        let completed = false;
        const finish = save => {
            if (completed) return;
            completed = true;
            if (save) {
                state.undoStack.push(JSON.parse(JSON.stringify(currentWords)));
                if (state.undoStack.length > 50) state.undoStack.shift();
                currentWords[index][language] = input.value.trim();
                syncTextarea();
            }
            const value = save ? currentWords[index][language] : originalValue;
            const duplicate = countDuplicates(language, value);
            cell.innerHTML = `${duplicate ? '<span class="dup-overlay-screen" style="position:absolute;inset:0;background:rgba(255,140,0,.25);pointer-events:none;z-index:1;"></span>' : ''}<span style="position:relative;z-index:2;">${value || '______'}</span>`;
        };

        input.addEventListener('blur', () => finish(true));
        input.addEventListener('keydown', keyEvent => {
            if (keyEvent.key === 'Enter') finish(true);
            if (keyEvent.key === 'Escape') finish(false);
        });
    });
}

function syncTextarea() {
    const textarea = document.getElementById('wordListTextarea');
    if (textarea) textarea.value = currentWords.map(word => `${word.eng}, ${word.kor}`).join('\n');
}

export async function generateWorksheetHTML(title, wordPairs) {
    const generateWorksheetHeader = async headerTitle => {
        let logoSrc;
        try { logoSrc = new URL('../../../Assets/Images/color-logo1.png', window.location.href).href; }
        catch (_) { logoSrc = '../../../Assets/Images/color-logo1.png'; }
        return `<div class="worksheet-header" style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:12px;">
                <img src="${logoSrc}" alt="Willena" style="height:70px;width:auto;display:block;" class="worksheet-logo">
                <h2 class="title" style="margin:0;font-family:${currentSettings.font};font-size:${Math.max(18, currentSettings.fontSize + 6)}px;">${String(headerTitle || '')}</h2>
            </div>
            <div class="worksheet-header-fields" style="display:flex;gap:32px;margin-top:8px;align-items:center;">
                <div style="font-size:15px;font-family:${currentSettings.font};color:#444;">Name: <span style="display:inline-block;min-width:120px;border-bottom:1px solid #bbb;">&nbsp;</span></div>
                <div style="font-size:15px;font-family:${currentSettings.font};color:#444;">Date: <span style="display:inline-block;min-width:100px;border-bottom:1px solid #bbb;">&nbsp;</span></div>
            </div>
        </div>`;
    };

    if (MATCHING_LAYOUTS.includes(currentSettings.layout)) {
        const maskedPairs = wordPairs.map(pair => {
            if (currentSettings.testMode === 'hide-eng') return { eng: '', kor: pair.kor, _originalEng: pair.eng };
            if (currentSettings.testMode === 'hide-kor') return { eng: pair.eng, kor: '', _originalEng: pair.eng };
            if (currentSettings.testMode === 'hide-all') return { eng: '', kor: '', _originalEng: pair.eng };
            return { eng: pair.eng, kor: pair.kor, _originalEng: pair.eng };
        });
        return generateMatchingWorksheetHTML({
            layout: currentSettings.layout,
            title,
            wordPairs: maskedPairs,
            settings: currentSettings,
            renderImage,
            getImageUrl,
            generateHeader: generateWorksheetHeader
        });
    }

    return rendererGenerateWorksheetHTML(
        title,
        wordPairs,
        currentSettings,
        hideRandomLetters,
        renderImage,
        generateWorksheetHeader,
        getImageUrl,
        getPlaceholderImage
    );
}
