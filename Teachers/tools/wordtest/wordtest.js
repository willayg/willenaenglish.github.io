// Word Worksheet Generator - Slim entry point
// Keep this file tiny: wire up globals and bootstrap the app.

import { initWordtest } from './init.js';
import { updatePreview } from './preview.js';
import { printFile, generatePDF } from './print.js';
import { getCurrentWorksheetData, loadWorksheet } from './worksheet_integration.js';
import { cycleImage } from './images.js';

// Expose a minimal surface for inline handlers and external pages
window.cycleImage = (word, index) => cycleImage(word, index, updatePreview);
window.getCurrentWorksheetData = getCurrentWorksheetData;
window.loadWorksheet = loadWorksheet;
window.printFile = printFile;
window.generatePDF = generatePDF;
// Backward-compat hooks used by inline scripts in the HTML
window.updatePreview = updatePreview;
window.updateWordtestPreview = updatePreview;

// Bootstrap
initWordtest();
