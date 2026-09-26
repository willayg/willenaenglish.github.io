// Word Worksheet Generator - Slim entry point
// Keep this file tiny: wire up globals and bootstrap the app.

import { initWordtest } from './init.js?v=20260926-assign1';
import { updatePreview } from './preview.js?v=20260923-imgstate2';
import { printFile, generatePDF } from './print.js?v=20260923-imgstate2';
import { getCurrentWorksheetData, loadWorksheet } from './worksheet_integration.js?v=20260923-imgstate2';
import { cycleImage, setSelectedImage } from './images.js?v=20260923-imgstate2';

// Expose a minimal surface for inline handlers and external pages
window.cycleImage = (word, index) => cycleImage(word, index, updatePreview);
window.getCurrentWorksheetData = getCurrentWorksheetData;
window.loadWorksheet = loadWorksheet;
window.printFile = printFile;
window.generatePDF = generatePDF;
// Backward-compat hooks used by inline scripts in the HTML
window.updatePreview = updatePreview;
window.updateWordtestPreview = updatePreview;
window.wordtestSetSelectedImage = (word, index, imageUrl) => {
	try { setSelectedImage(word, index, imageUrl); } catch (_) {}
};

// Bootstrap
initWordtest();
