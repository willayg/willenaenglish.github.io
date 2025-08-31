import { loadModules } from './loader.js';
import { setupEventListeners, setupAIEventListeners } from './events.js';
import { extractWords } from './word_ops.js';
import { updatePreview, updatePreviewStyles } from './preview.js';
import { clearAll } from './worksheet_integration.js';
import { updateFont, updateFontSize, increaseFontSize, decreaseFontSize, updateImageGap, updateImageSize, updateLayout } from './controls.js';
import { state } from './state.js';
import { printFile, generatePDF } from './print.js';

function makeDraggable() {
    const toolbar = document.getElementById('floatingToolbar');
    if (toolbar) {
        toolbar.style.cursor = 'default';
        toolbar.style.userSelect = 'none';
    }
}

function initTestModeUI() {
    const style = document.createElement('style');
    style.innerHTML = `
        #testModeSelect, #numLettersToHide { font-family: Arial !important; font-size: 12px !important; padding: 2px 6px !important; height: 26px !important; box-sizing: border-box; }
        .image-loading-spinner { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); width:40px; height:40px; border:3px solid #f3f3f3; border-top:3px solid #3498db; border-radius:50%; animation:spin 1s linear infinite; z-index:10; }
        .image-loading-overlay { position:absolute; inset:0; background:rgba(255,255,255,0.8); display:flex; align-items:center; justify-content:center; border-radius:8px; z-index:9; }
        @keyframes spin { 0%{transform:translate(-50%,-50%) rotate(0)} 100%{transform:translate(-50%,-50%) rotate(360deg)} }
        .image-drop-zone.drag-success { border:2px solid #48bb78 !important; background:#e6fffa !important; animation: success-pulse 1.5s ease-in-out; }
        @keyframes success-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
        @keyframes fadeInOut { 0%{opacity:0; transform:translateX(-50%) translateY(-10px);} 20%,80%{opacity:1; transform:translateX(-50%) translateY(0);} 100%{opacity:0; transform:translateX(-50%) translateY(-10px);} }
        .drag-instructions { position:absolute; top:-25px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:4px 8px; border-radius:4px; font-size:11px; white-space:nowrap; opacity:0; transition:opacity .3s; pointer-events:none; z-index:15; }
        .image-drop-zone:hover .drag-instructions { opacity:1; }
    `;
    document.head.appendChild(style);
}

export function initWordtest() {
    const start = async () => {
        await loadModules();
        // Setup UI and events
        setupEventListeners(
            updateFont,
            updateFontSize,
            updateLayout,
            updateImageGap,
            updateImageSize,
            decreaseFontSize,
            increaseFontSize,
            () => {/* highlight handled in renderer */},
            updatePreview,
            () => {/* clearAllImages handled by images.js */},
            () => {/* refreshImages handled by images.js */}
        );
        setupAIEventListeners((...args) => extractWords(...args), updatePreview);
    // Expose updater globally for image error fallback
    window.updatePreview = updatePreview;
        makeDraggable();
        initTestModeUI();

        const testModeSelect = document.getElementById('testModeSelect');
        if (testModeSelect) {
            testModeSelect.addEventListener('change', () => {
                state.currentSettings.testMode = testModeSelect.value;
                let numLettersInput = document.getElementById('numLettersToHide');
                if (state.currentSettings.testMode === 'hide-random-letters') {
                    if (!numLettersInput) {
                        numLettersInput = document.createElement('input');
                        numLettersInput.type = 'number';
                        numLettersInput.id = 'numLettersToHide';
                        numLettersInput.value = state.currentSettings.numLettersToHide;
                        numLettersInput.min = 1; numLettersInput.max = 10; numLettersInput.style.marginLeft = '8px'; numLettersInput.style.width = '40px';
                        testModeSelect.parentNode.appendChild(numLettersInput);
                        numLettersInput.addEventListener('input', () => {
                            state.currentSettings.numLettersToHide = parseInt(numLettersInput.value) || 1;
                            updatePreviewStyles();
                        });
                    } else {
                        numLettersInput.style.display = '';
                    }
                } else if (numLettersInput) {
                    numLettersInput.style.display = 'none';
                }
                updatePreviewStyles();
            });
        }

        const imageSizeSlider = document.getElementById('imageSizeSlider');
        if (imageSizeSlider) imageSizeSlider.max = 200;

        // Wire core action buttons
        const extractBtn = document.getElementById('extractBtn');
        if (extractBtn) {
            extractBtn.addEventListener('click', () => extractWords());
        }
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => clearAll());
        }

        // Difficulty change should update styles (for any future conditional rendering)
        const difficultySelect = document.getElementById('difficultySelect');
        if (difficultySelect) {
            difficultySelect.addEventListener('change', () => {
                // currently impacts AI extraction only, but we re-render to be safe
                updatePreviewStyles();
            });
        }

        const wordListTextarea = document.getElementById('wordListTextarea');
        if (wordListTextarea) {
            wordListTextarea.addEventListener('input', () => {
                const evt = new Event('wordlist:update');
                document.dispatchEvent(evt);
            });
            wordListTextarea.addEventListener('change', () => {
                const evt = new Event('wordlist:update');
                document.dispatchEvent(evt);
            });
        }

    // Top action buttons (use absolute paths for reliability)
        document.getElementById('saveBtn')?.addEventListener('click', () => {
            window.open('/Teachers/worksheet_manager.html?mode=save', 'WorksheetManager', 'width=1200,height=700,resizable=yes,scrollbars=yes');
        });
        document.getElementById('loadBtn')?.addEventListener('click', () => {
            window.open('/Teachers/worksheet_manager.html?mode=load', 'WorksheetManager', 'width=1200,height=700,resizable=yes,scrollbars=yes');
        });
    document.getElementById('printBtn')?.addEventListener('click', () => printFile());
    document.getElementById('pdfBtn')?.addEventListener('click', () => generatePDF());
        // Optional dedicated retry-failed button if present
        const retryFailedBtn = document.getElementById('retryFailedBtn');
        if (retryFailedBtn) {
            retryFailedBtn.addEventListener('click', async () => {
                const { refreshFailedImages } = await import('./images.js');
                await refreshFailedImages(updatePreview);
            });
        }

        if (typeof sampleWords !== 'undefined') {
            const ta = document.getElementById('wordListTextarea');
            if (ta) ta.value = sampleWords;
        }
        document.dispatchEvent(new Event('wordlist:update'));
        await updatePreview();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        // DOM already parsed
        start();
    }
}
