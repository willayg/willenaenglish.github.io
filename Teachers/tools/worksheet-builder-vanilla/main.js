// main.js - Vanilla Worksheet Builder

// Import state management, history system, and textbox operations
// Note: Using script tag import for now to maintain compatibility









function addPage() {
  if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
    window.worksheetHistory.saveToHistory('add page');
  }
  window.worksheetState.getPages().push({ boxes: [] });
  if (window.worksheetRender && window.worksheetRender.renderPages) {
    window.worksheetRender.renderPages();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize all application event systems and modules
  if (window.worksheetEvents) {
    window.worksheetEvents.initialize();
  }
});
