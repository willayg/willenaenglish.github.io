// state.js - Core Data & State Management

// State: array of pages and orientation
let pages = [{ boxes: [] }];
let orientation = 'portrait'; // 'portrait' or 'landscape'
let lastTextbox = null;

// Clipboard for text box operations
let clipboardData = null;

// Debounce function for text input history saving
let textInputTimeout = null;
function debouncedSaveTextHistory() {
  clearTimeout(textInputTimeout);
  textInputTimeout = setTimeout(() => {
    // Import the saveToHistory function from history module
    if (window.saveToHistory) {
      window.saveToHistory('text edit');
    }
  }, 1000); // Save after 1 second of no typing
}

// Getters and setters for state management
const state = {
  // Pages management
  getPages() {
    return pages;
  },
  
  setPages(newPages) {
    pages = newPages;
    window.pages = pages;
  },
  
  addPage() {
    pages.push({ boxes: [] });
    window.pages = pages;
  },
  
  removePage(index) {
    if (pages.length > 1 && index >= 0 && index < pages.length) {
      pages.splice(index, 1);
      window.pages = pages;
    }
  },
  
  // Orientation management
  getOrientation() {
    return orientation;
  },
  
  setOrientation(newOrientation) {
    orientation = newOrientation;
  },
  
  // Last textbox management
  getLastTextbox() {
    return lastTextbox;
  },
  
  setLastTextbox(textbox) {
    lastTextbox = textbox;
  },
  
  // Clipboard management
  getClipboardData() {
    return clipboardData;
  },
  
  setClipboardData(data) {
    clipboardData = data;
  },
  
  // Text input timeout management
  getDebouncedSaveTextHistory() {
    return debouncedSaveTextHistory;
  }
};

// Make state available globally
window.worksheetState = state;

// Initialize global pages reference
window.pages = pages;

// Export for ES6 modules (if needed)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = state;
}
