import { state } from './state.js';
import { enableImageDragAndDrop, renderImage, getImageUrl, getPlaceholderImage } from './images.js';
import { hideRandomLetters } from './behaviors.js';
import { generateWorksheetHTML as rendererGenerateWorksheetHTML } from './renderer.js';

const currentWords = state.currentWords;
const currentSettings = state.currentSettings;

export async function updatePreview() {
    const previewArea = document.getElementById('previewArea');
    const title = document.getElementById('titleInput').value || 'Worksheet Title';
    if (!previewArea) return;

    if (currentWords.length === 0) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Add some words to see the preview</p></div>';
        return;
    }

    const imageBasedLayouts = ['picture-list','picture-list-2col','picture-quiz','picture-quiz-5col','picture-matching','6col-images','5col-images'];
    if (imageBasedLayouts.includes(currentSettings.layout)) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Loading images...</p></div>';
        await new Promise(r => setTimeout(r, 100));
    }

    const worksheetHTML = await generateWorksheetHTML(title, currentWords);
    previewArea.innerHTML = worksheetHTML;
    ensurePreviewHint(previewArea);
    enableImageDragAndDrop(updatePreview);
    addWordCellInteractivity(previewArea);
}

export async function updatePreviewPreservingImages() {
    const previewArea = document.getElementById('previewArea');
    const title = document.getElementById('titleInput').value || 'Worksheet Title';
    if (!previewArea) return;

    if (currentWords.length === 0) {
        previewArea.innerHTML = '<div class="preview-placeholder"><p>Add some words to see the preview</p></div>';
        return;
    }

    const existingImages = new Map();
    previewArea.querySelectorAll('.image-drop-zone img').forEach(img => {
        const word = img.getAttribute('data-word');
        if (word) existingImages.set(word, img.src);
    });

    const worksheetHTML = await generateWorksheetHTML(title, currentWords);
    previewArea.innerHTML = worksheetHTML;
    ensurePreviewHint(previewArea);

    previewArea.querySelectorAll('.image-drop-zone img').forEach(img => {
        const word = img.getAttribute('data-word');
        if (word && existingImages.has(word)) img.src = existingImages.get(word);
    });

    enableImageDragAndDrop(updatePreviewPreservingImages);
    addWordCellInteractivity(previewArea);
}

// Efficient preview update that preserves images or updates styles in place
export async function updatePreviewStyles() {
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;

    // If no preview yet, render it fresh
    const previewRoot = previewArea.querySelector('.worksheet-preview');
    if (!previewRoot) {
        return updatePreview();
    }

    // If test mode hides or masks text, rebuild while preserving images
    if (currentSettings.testMode && currentSettings.testMode !== 'none') {
        return updatePreviewPreservingImages();
    }

    // Certain layouts depend on gap/size for structure; rebuild to reflect changes
    const imageBasedLayouts = ['picture-list','picture-list-2col','picture-quiz','picture-quiz-5col','picture-matching','6col-images','5col-images'];
    if (imageBasedLayouts.includes(currentSettings.layout)) {
        return updatePreviewPreservingImages();
    }

    // Otherwise, update styles in place without regenerating HTML
    try {
        previewRoot.style.fontFamily = currentSettings.font;
        previewRoot.style.fontSize = currentSettings.fontSize + 'px';

        const tables = previewRoot.querySelectorAll('table');
        tables.forEach(table => {
            table.style.fontFamily = currentSettings.font;
            table.style.fontSize = currentSettings.fontSize + 'px';
        });

        const textElements = previewRoot.querySelectorAll('th, td, div');
        textElements.forEach(el => {
            if (!el.classList.contains('image-drop-zone') && !el.querySelector('.image-drop-zone')) {
                el.style.fontFamily = currentSettings.font;
            }
        });

        // Update image sizes only if not custom-resized
        const images = previewRoot.querySelectorAll('.image-drop-zone img');
        images.forEach(img => {
            if (!img.hasAttribute('data-custom-size')) {
                img.style.width = currentSettings.imageSize + 'px';
                img.style.height = currentSettings.imageSize + 'px';
            }
        });

        // Update emoji placeholders (font-size based)
        const emojiEls = previewRoot.querySelectorAll('.image-drop-zone div[style*="font-size"]');
        emojiEls.forEach(el => {
            el.style.fontSize = Math.round(currentSettings.imageSize * 0.8) + 'px';
        });

        // Update generic placeholders with width/height inline styles
        const placeholders = previewRoot.querySelectorAll('.image-drop-zone div[style*="width"]');
        placeholders.forEach(el => {
            if (!el.style.fontSize) {
                el.style.width = currentSettings.imageSize + 'px';
                el.style.height = currentSettings.imageSize + 'px';
            }
        });
    } catch (e) {
        console.warn('updatePreviewStyles fallback due to error:', e);
        return updatePreviewPreservingImages();
    }
}

// Helper overlay: show once per session for ~4s and do not reappear
function ensurePreviewHint(previewArea) {
    if (!previewArea) return;
    const onceKey = 'waPreviewHintShown';
    if (sessionStorage.getItem(onceKey) === '1') return;

    // Make container relative for absolute overlay
    const cs = window.getComputedStyle(previewArea);
    if (cs.position === 'static') {
        previewArea.style.position = 'relative';
    }

    let hint = previewArea.querySelector('#preview-helper-hint');
    if (!hint) {
        hint = document.createElement('div');
        hint.id = 'preview-helper-hint';
        hint.className = 'print-hide';
        hint.textContent = 'Tip: Left-click a word to edit, right-click to delete';
        hint.style.position = 'absolute';
        hint.style.left = '8px';
        hint.style.top = '8px';
        hint.style.background = 'rgba(36, 159, 230, 0.9)';
        hint.style.color = '#fff';
        hint.style.padding = '6px 10px';
        hint.style.borderRadius = '6px';
        hint.style.fontSize = '12px';
        hint.style.zIndex = '20';
        hint.style.opacity = '0';
        hint.style.pointerEvents = 'none';
        hint.style.transition = 'opacity .18s cubic-bezier(.4,0,.2,1)';
        previewArea.appendChild(hint);
    }

    // Show once
    requestAnimationFrame(() => {
        hint.style.opacity = '1';
        setTimeout(() => {
            hint.style.opacity = '0';
            sessionStorage.setItem(onceKey, '1');
        }, 4000);
    });
}

// Add interactive editing and deletion to word cells in the preview
function addWordCellInteractivity(previewArea) {
    if (!previewArea) return;
    const cw = currentWords;

    function isDuplicateEng(eng) {
        const v = (eng || '').trim().toLowerCase();
        if (!v) return false;
        let count = 0;
        for (const w of cw) if (w.eng && w.eng.trim().toLowerCase() === v) count++;
        return count > 1;
    }
    function isDuplicateKor(kor) {
        const v = (kor || '').trim().toLowerCase();
        if (!v) return false;
        let count = 0;
        for (const w of cw) if (w.kor && w.kor.trim().toLowerCase() === v) count++;
        return count > 1;
    }

    // Remove any previous inline handlers
    previewArea.oncontextmenu = null;
    previewArea.onclick = null;

    // Right-click: delete word
    previewArea.addEventListener('contextmenu', (e) => {
        const cell = e.target.closest('.word-cell');
        if (cell && previewArea.contains(cell)) {
            e.preventDefault();
            const idx = parseInt(cell.getAttribute('data-index'));
            if (isNaN(idx)) return;
            // Undo snapshot
            state.undoStack.push(JSON.parse(JSON.stringify(cw)));
            if (state.undoStack.length > 50) state.undoStack.shift();
            // Delete
            cw.splice(idx, 1);
            // Sync textarea
            const ta = document.getElementById('wordListTextarea');
            if (ta) ta.value = cw.map(w => `${w.eng}, ${w.kor}`).join('\n');
            // Re-render preserving images
            updatePreviewPreservingImages();
        }
    });

    // Left-click: inline edit
    previewArea.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        const cell = e.target.closest('.word-cell');
        if (!cell || !previewArea.contains(cell)) return;
        if (cell.querySelector('input')) return;
        const idx = parseInt(cell.getAttribute('data-index'));
        const lang = cell.getAttribute('data-lang');
        if (isNaN(idx) || !lang) return;

        const currentVal = (cw[idx] && cw[idx][lang]) || '';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentVal;
        input.style.width = '90%';
        input.style.background = 'transparent';
        input.style.border = '1px solid #ccc';
        input.style.fontSize = 'inherit';
        input.style.fontFamily = 'inherit';
        cell.innerHTML = '';
        cell.appendChild(input);
        input.focus();

        const saveEdit = () => {
            state.undoStack.push(JSON.parse(JSON.stringify(cw)));
            if (state.undoStack.length > 50) state.undoStack.shift();
            cw[idx][lang] = input.value.trim();
            const ta = document.getElementById('wordListTextarea');
            if (ta) ta.value = cw.map(w => `${w.eng}, ${w.kor}`).join('\n');
            const isDup = lang === 'eng' ? isDuplicateEng(input.value.trim()) : isDuplicateKor(input.value.trim());
            const content = input.value.trim() || '______';
            const overlay = isDup ? '<span class="dup-overlay-screen" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,140,0,0.25);pointer-events:none;z-index:1;"></span>' : '';
            const highlighted = `<span style="position:relative;display:inline-block;width:100%;">${overlay}<span style="position:relative;z-index:2;">${content}</span></span>`;
            cell.innerHTML = highlighted;
        };
        const cancelEdit = () => {
            const originalValue = cw[idx][lang] || '______';
            const isDup = lang === 'eng' ? isDuplicateEng(originalValue) : isDuplicateKor(originalValue);
            const overlay = isDup ? '<span class="dup-overlay-screen" style="position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,140,0,0.25);pointer-events:none;z-index:1;"></span>' : '';
            const highlighted = `<span style=\"position:relative;display:inline-block;width:100%;\">${overlay}<span style=\"position:relative;z-index:2;\">${originalValue}</span></span>`;
            cell.innerHTML = highlighted;
        };
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e2) => {
            if (e2.key === 'Enter') saveEdit();
            else if (e2.key === 'Escape') cancelEdit();
        });
    });
}

export async function generateWorksheetHTML(title, wordPairs) {
    // Minimal header generator to keep renderer decoupled
    const generateWorksheetHeader = async (hdrTitle) => {
        const safeTitle = (hdrTitle || '').toString();
        return `
            <div class="worksheet-header" style="margin-bottom: 12px;">
                <div style="display:flex;align-items:baseline;gap:12px;">
                    <h2 class="title" style="margin:0;font-family:${currentSettings.font};font-size:${Math.max(18, currentSettings.fontSize + 6)}px;">${safeTitle}</h2>
                </div>
            </div>
        `;
    };
    return await rendererGenerateWorksheetHTML(
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
