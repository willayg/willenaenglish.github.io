import { state } from './state.js';
import { waitForPreviewImagesToLoad } from './renderer.js';

const currentSettings = state.currentSettings;

export function printFile() {
    // Open a window immediately on user gesture to avoid popup blockers
    let preOpenedWindow = null;
    try {
        preOpenedWindow = window.open('', '_blank', 'width=800,height=600');
    } catch (e) {
        preOpenedWindow = null;
    }

    const layout = currentSettings.layout;
    const imageBased = ['picture-list','picture-list-2col','picture-quiz','picture-quiz-5col','picture-matching','6col-images','5col-images'];
    const proceed = () => performPrint(preOpenedWindow);

    if (imageBased.includes(layout)) {
        const loadingMessage = document.createElement('div');
        loadingMessage.innerHTML = `
            <div style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; text-align: center;">
                <div style="border: 3px solid #f3f3f3; border-top: 3px solid #4299e1; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <p style="margin: 0; font-size: 16px; color: #333;">Preparing images for print...</p>
                <style>@keyframes spin {0%{transform:rotate(0)}100%{transform:rotate(360deg)}}</style>
            </div>
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;"></div>`;
        document.body.appendChild(loadingMessage);
        waitForPreviewImagesToLoad(5000).then(() => {
            try { document.body.removeChild(loadingMessage); } catch {}
            proceed();
        });
    } else {
        proceed();
    }
}

export function performPrint(preOpenedWindow) {
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) { alert('No preview content to print'); return; }
    const fontSelect = document.getElementById('fontSelect');
    let selectedFont = fontSelect ? fontSelect.value : 'Arial';
    let fontFamilyCSS = selectedFont;
    if (selectedFont === 'Poppins') fontFamilyCSS = 'Poppins, Arial, sans-serif';
    else if (selectedFont === 'Caveat') fontFamilyCSS = 'Caveat, Arial, sans-serif';
    else if (selectedFont === 'Comic Sans MS') fontFamilyCSS = '"Comic Sans MS", Arial, sans-serif';
    else if (selectedFont === 'Times New Roman') fontFamilyCSS = '"Times New Roman", Times, serif';
    else if (selectedFont === 'Calibri') fontFamilyCSS = 'Calibri, Arial, sans-serif';
    else if (selectedFont === 'Verdana') fontFamilyCSS = 'Verdana, Arial, sans-serif';
    else if (selectedFont === 'Garamond') fontFamilyCSS = 'Garamond, serif';
    const currentLayout = document.getElementById('layoutSelect')?.value;
    const isLandscapeLayout = ['5col-images','picture-quiz-5col'].includes(currentLayout);
    // Use the pre-opened window if available; otherwise try to open now
    let printWindow = preOpenedWindow;
    if (!printWindow || printWindow.closed) {
        try { printWindow = window.open('', '_blank', 'width=800,height=600'); } catch (e) { printWindow = null; }
    }
    // Fallback: use a hidden iframe if popup is blocked
    let useIframe = false;
    let iframeEl = null;
    if (!printWindow) {
        useIframe = true;
        iframeEl = document.createElement('iframe');
        iframeEl.style.position = 'fixed';
        iframeEl.style.right = '0';
        iframeEl.style.bottom = '0';
        iframeEl.style.width = '0';
        iframeEl.style.height = '0';
        iframeEl.style.border = '0';
        document.body.appendChild(iframeEl);
    }
    const worksheetContent = previewArea.innerHTML;
    const googleFontLink = '<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Caveat:wght@400;600&family=Luckiest+Guy&family=Pacifico&family=Permanent+Marker&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">';
    const printDocument = `<!DOCTYPE html><html><head><title>Worksheet</title>${googleFontLink}
        <style>
        @page { size: A4${isLandscapeLayout ? ' landscape' : ''}; margin: 0.5in; }
        body { font-family: ${fontFamilyCSS}; margin: 0; padding: 0; background: white; }
        .worksheet-preview { width: 100%; max-width: none; margin: 0; padding: 0; background: white; }
        .drag-instructions, .print-hide { display: none !important; }
        .worksheet-header { page-break-after: avoid; page-break-inside: avoid; margin-bottom: 20px; }
        table { page-break-inside: auto; border-collapse: collapse; page-break-before: auto; margin-bottom: 10px; }
        thead { display: table-header-group; page-break-after: avoid; }
        tr { page-break-inside: avoid; page-break-before: auto; }
        tbody tr:nth-child(-n+3) { page-break-before: avoid; }
        tbody tr:nth-last-child(-n+2) { page-break-before: avoid; }
        table:not(:first-of-type) { page-break-before: auto; margin-top: 20px; }
        .picture-cards-page, .picture-cards-page-5col, .picture-quiz-page, .picture-quiz-page-5col { page-break-before: auto; page-break-after: auto; }
        .picture-cards-page:not(:first-child), .picture-cards-page-5col:not(:first-child), .picture-quiz-page:not(:first-child), .picture-quiz-page-5col:not(:first-child) { page-break-before: auto; }
        img { max-width: 100%; height: auto; page-break-inside: avoid; }
        [onclick] { cursor: default !important; pointer-events: none !important; }
        .picture-cards-grid, .picture-cards-grid-5col, .picture-quiz-grid, .picture-quiz-grid-5col { display: grid !important; width: 100% !important; margin: 0 auto !important; }
        .picture-quiz-5col .worksheet-header { margin-bottom:12px !important; padding:6px !important; border-bottom:1px solid #e2e8f0 !important; }
        .picture-quiz-5col .worksheet-header img { height:25px !important; }
        .picture-quiz-5col .worksheet-header span { font-size:10px !important; min-width:35px !important; }
        .picture-quiz-5col .worksheet-header div[style*="border-bottom"] { height: 14px !important; }
    /* Ensure quiz underlines render in print without relying on backgrounds */
    .quiz-underline, .quiz-underline-5col { display:block; position:relative !important; margin: 0 auto !important; }
    .quiz-underline { height: 22px !important; width: 140px !important; }
    .quiz-underline-5col { height: 20px !important; width: 110px !important; }
    .quiz-underline::after, .quiz-underline-5col::after { content:''; position:absolute; left:0; right:0; bottom:0; border-bottom: 2px solid #000 !important; display:block; }
        .picture-quiz-5col div[style*="background: #f9f9f9"] { margin-bottom:8px !important; padding:4px !important; }
        .picture-quiz-5col div[style*="background: #f9f9f9"] span { padding:1px 3px !important; font-size:0.7em !important; }
        .picture-quiz-grid-5col { column-gap: 4px !important; padding: 6px !important; max-width:100% !important; }
        .quiz-item-5col { width:120px !important; height:130px !important; padding:1px !important; }
        .quiz-item-5col .image-container { height:80px !important; max-height:80px !important; }
        .quiz-item-5col div[style*="border-bottom"] { width:85px !important; height:24px !important; margin-top:8px !important; }
        .picture-card, .picture-card-5col, .quiz-item, .quiz-item-5col { page-break-inside: avoid; break-inside: avoid; }
        .dup-overlay-screen { display:none !important; }
        </style></head><body>${worksheetContent}
        <script>
        function waitForFonts(fontName, cb){ if(document.fonts && fontName){ document.fonts.load('1em '+fontName).then(function(){ document.fonts.ready.then(cb); }); } else { setTimeout(cb, 500); } }
        window.addEventListener('load', function(){ var fontName = ${JSON.stringify(selectedFont)}; waitForFonts(fontName, function(){ setTimeout(function(){ window.print(); window.close(); }, 100); }); });
        </script>
        </body></html>`;
    if (useIframe && iframeEl && iframeEl.contentWindow) {
        const doc = iframeEl.contentWindow.document;
        doc.open();
        doc.write(printDocument);
        doc.close();
        // Trigger print after a short delay to ensure resources are loaded
        setTimeout(() => {
            try { iframeEl.contentWindow.focus(); iframeEl.contentWindow.print(); } catch {}
            setTimeout(() => { try { document.body.removeChild(iframeEl); } catch {} }, 500);
        }, 300);
    } else if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(printDocument);
        printWindow.document.close();
    } else {
        alert('Popup blocked. Please allow popups for this site to print, or use PDF.');
    }
}

export function generatePDF() {
    const previewArea = document.getElementById('previewArea');
    if (!previewArea) return;
    if (typeof html2pdf === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = () => generatePDF();
        document.head.appendChild(script);
        return;
    }
    let title = document.getElementById('titleInput')?.value?.trim() || 'worksheet';
    title = title.replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '_');
    const opt = { margin: 0.5, filename: title + '.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } };
    html2pdf().set(opt).from(previewArea).save();
}
