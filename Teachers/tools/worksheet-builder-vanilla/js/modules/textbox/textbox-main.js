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
    
    // Store module references on the textbox for global access
    box.__textboxModule__ = {
      updateSelectionFrame,
      updateHandlePosition,
      selectionFrame,
      dragHandle
    };
    
    // Connect the snap function between modules
    if (eventsResult && eventsResult.snapToCenter && dragResult.setSnapFunction) {
      dragResult.setSnapFunction(eventsResult.snapToCenter, eventsResult.hideGuides);
    }
    
    // Add the textbox to the page
    a4.appendChild(box);
    
    // Auto-select the textbox and show selection frame for new textboxes
    // This needs to happen after events are set up and the box is in the DOM
    setTimeout(() => {
      // First, deselect all other textboxes and hide their frames
      document.querySelectorAll('.worksheet-textbox').forEach(otherBox => {
        if (otherBox !== box) {
          otherBox.classList.remove('selected');
          // Force update of selection frames for all other textboxes
          const frames = otherBox.parentNode.querySelectorAll('.textbox-selection-frame');
          frames.forEach(frame => {
            if (frame !== selectionFrame) {
              frame.style.display = 'none';
              frame.style.pointerEvents = 'none';
            }
          });
        }
      });
      
      // Then select this new textbox
      box.classList.add('selected');
      if (typeof updateSelectionFrame === 'function') {
        updateSelectionFrame();
      }
    }, 0);
    
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
