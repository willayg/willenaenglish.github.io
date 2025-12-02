// history.js - History/Undo System Management

(function() {
  // Private history variables
  let history = [];
  let historyIndex = -1;
  const MAX_HISTORY = 50;

  // Save current state to history
  function saveToHistory(action = 'unknown') {
    // CRITICAL: Sync DOM to data model before saving
    if (window.syncAllTextboxesToDataModel) {
      window.syncAllTextboxesToDataModel();
    }
    
    // Deep clone the current pages state
    const currentState = {
      pages: JSON.parse(JSON.stringify(window.worksheetState.getPages())),
      action: action,
      timestamp: Date.now()
    };
    
    // Remove any future history if we're not at the end
    if (historyIndex < history.length - 1) {
      history = history.slice(0, historyIndex + 1);
      console.log(`Truncated future history. New length: ${history.length}`);
    }
    
    // Add new state
    history.push(currentState);
    historyIndex++;
    
    // Limit history size
    if (history.length > MAX_HISTORY) {
      history = history.slice(-MAX_HISTORY);
      historyIndex = history.length - 1;
    }
    
    console.log(`Saved to history: ${action} (${historyIndex + 1}/${history.length})`);
    console.log(`History debug - Index: ${historyIndex}, Length: ${history.length}, Can undo: ${historyIndex > 0}, Can redo: ${historyIndex < history.length - 1}`);
    console.log('Current state snapshot:', {
      totalPages: window.worksheetState.getPages().length,
      totalBoxes: window.worksheetState.getPages().reduce((sum, page) => sum + (page.boxes ? page.boxes.length : 0), 0),
      firstPageBoxes: window.worksheetState.getPages()[0]?.boxes?.length || 0
    });
  }

  // Undo last action
  function undo() {
    if (historyIndex <= 0) {
      console.log('Nothing to undo');
      return;
    }
    
    historyIndex--;
    const state = history[historyIndex];
    
    // Store current selection info before restoring
    const currentSelection = window.worksheetState.getLastTextbox() ? {
      pageIdx: Array.from(document.querySelectorAll('.page-preview-a4')).findIndex(p => p.contains(window.worksheetState.getLastTextbox())),
      boxIdx: Array.from(document.querySelectorAll('.worksheet-textbox')).indexOf(window.worksheetState.getLastTextbox())
    } : null;
    
    // Restore the state
    window.worksheetState.setPages(JSON.parse(JSON.stringify(state.pages)));
    if (window.renderPages) {
      window.renderPages();
    }
    
    // Try to restore selection if possible
    if (currentSelection && currentSelection.pageIdx >= 0 && currentSelection.boxIdx >= 0) {
      setTimeout(() => {
        const pageEls = document.querySelectorAll('.page-preview-a4');
        if (pageEls[currentSelection.pageIdx]) {
          const boxEls = pageEls[currentSelection.pageIdx].querySelectorAll('.worksheet-textbox');
          if (boxEls[currentSelection.boxIdx]) {
            window.worksheetState.setLastTextbox(boxEls[currentSelection.boxIdx]);
            window.worksheetState.getLastTextbox().classList.add('selected');
            if (window.updateToolbarFromBox) {
              window.updateToolbarFromBox(window.worksheetState.getLastTextbox());
            }
          }
        }
      }, 10);
    }
    
    console.log(`Undid: ${state.action} (${historyIndex + 1}/${history.length})`);
    console.log(`History debug - Index: ${historyIndex}, Length: ${history.length}, Can redo: ${historyIndex < history.length - 1}`);
  }

  // Redo last undone action
  function redo() {
    if (historyIndex >= history.length - 1) {
      console.log('Nothing to redo');
      return;
    }
    
    historyIndex++;
    const state = history[historyIndex];
    
    console.log(`Attempting redo: ${state.action} (index ${historyIndex}/${history.length})`);
    
    // Store current selection info before restoring
    const currentSelection = window.worksheetState.getLastTextbox() ? {
      pageIdx: Array.from(document.querySelectorAll('.page-preview-a4')).findIndex(p => p.contains(window.worksheetState.getLastTextbox())),
      boxIdx: Array.from(document.querySelectorAll('.worksheet-textbox')).indexOf(window.worksheetState.getLastTextbox())
    } : null;
    
    // Restore the state
    window.worksheetState.setPages(JSON.parse(JSON.stringify(state.pages)));
    if (window.renderPages) {
      window.renderPages();
    }
    
    // Try to restore selection if possible
    if (currentSelection && currentSelection.pageIdx >= 0 && currentSelection.boxIdx >= 0) {
      setTimeout(() => {
        const pageEls = document.querySelectorAll('.page-preview-a4');
        if (pageEls[currentSelection.pageIdx]) {
          const boxEls = pageEls[currentSelection.pageIdx].querySelectorAll('.worksheet-textbox');
          if (boxEls[currentSelection.boxIdx]) {
            window.worksheetState.setLastTextbox(boxEls[currentSelection.boxIdx]);
            window.worksheetState.getLastTextbox().classList.add('selected');
            if (window.updateToolbarFromBox) {
              window.updateToolbarFromBox(window.worksheetState.getLastTextbox());
            }
          }
        }
      }, 10);
    }
    
    console.log(`Redid: ${state.action} (${historyIndex + 1}/${history.length})`);
    console.log(`History debug - Index: ${historyIndex}, Length: ${history.length}, Can undo: ${historyIndex > 0}`);
  }

  // Get history info (for debugging or UI)
  function getHistoryInfo() {
    return {
      length: history.length,
      index: historyIndex,
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
      currentAction: history[historyIndex]?.action || 'none'
    };
  }

  // Clear history (useful for reset operations)
  function clearHistory() {
    history = [];
    historyIndex = -1;
    console.log('History cleared');
  }

  // Create the global history management object
  window.worksheetHistory = {
    saveToHistory,
    undo,
    redo,
    getHistoryInfo,
    clearHistory
  };

  // Make functions globally available for backward compatibility
  window.saveToHistory = saveToHistory;
  window.undo = undo;
  window.redo = redo;
})();
