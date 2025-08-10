// textbox-main.js
// Orchestrator for textbox modules

(function() {
  function renderTextbox(boxData, a4, pageData) {
    // Create the core textbox element
    const box = window.textboxCore.createTextboxElement(boxData);
    
    // Create a shared updateHandlePosition function that will be set by the drag module
    let updateHandlePosition = function() {};
    
    // Add resize handles and selection frame first
    const resizeResult = window.textboxResize.addResizeHandles(box, boxData, a4, () => updateHandlePosition());
    const { selectionFrame, updateSelectionFrame } = resizeResult;
    
    // Add drag handle (needs updateSelectionFrame, returns updateHandlePosition)
    const dragResult = window.textboxDrag.addDragHandle(box, boxData, a4, updateSelectionFrame);
    const { dragHandle, updateHandlePosition: actualUpdateHandlePosition } = dragResult;
    
    // Set the actual function
    updateHandlePosition = actualUpdateHandlePosition;
    
    // Setup events (needs access to both drag and resize functions)
    const eventsResult = window.textboxEvents.setupTextboxEvents(box, boxData, a4, updateHandlePosition, updateSelectionFrame, selectionFrame, dragHandle);
    
    // Connect the snap function between modules
    if (eventsResult && eventsResult.snapToCenter && dragResult.setSnapFunction) {
      dragResult.setSnapFunction(eventsResult.snapToCenter, eventsResult.hideGuides);
    }
    
    // Add the textbox to the page
    a4.appendChild(box);
    
    return box;
  }
  
  // Legacy function for backward compatibility
  function setupTextboxEvents(box, boxData, a4, updateHandlePosition, updateSelectionFrame, selectionFrame, dragHandle) {
    return window.textboxEvents.setupTextboxEvents(box, boxData, a4, updateHandlePosition, updateSelectionFrame, selectionFrame, dragHandle);
  }
  
  // Export to window for global access
  window.renderTextbox = renderTextbox;
  window.setupTextboxEvents = setupTextboxEvents;
})();
