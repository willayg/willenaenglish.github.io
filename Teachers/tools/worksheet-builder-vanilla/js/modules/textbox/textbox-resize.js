// textbox-resize.js
// Resize and selection frame logic for worksheet textboxes

(function() {
  // Configuration constants
  const CONFIG = {
    MIN_WIDTH: 120,             // Minimum textbox width
    MIN_HEIGHT: 40              // Minimum textbox height
  };

  function addResizeHandles(box, boxData, a4, updateHandlePosition) {
    // Create external selection frame (Canva-style)
    const selectionFrame = document.createElement('div');
    selectionFrame.className = 'textbox-selection-frame';
    selectionFrame.style.position = 'absolute';
    selectionFrame.style.display = 'none'; // Hidden by default
    selectionFrame.style.pointerEvents = 'none';
    selectionFrame.style.border = '2px solid #4299e1';
    selectionFrame.style.borderRadius = '4px';
    selectionFrame.style.zIndex = 1001; // Always above any textbox or guide (higher than guides at 1000)
    selectionFrame.style.background = 'transparent';
    selectionFrame.style.fontSize = '0'; // Prevent any text rendering
    selectionFrame.style.lineHeight = '0'; // Prevent any text rendering
    selectionFrame.style.overflow = 'visible';
    
    // Add corner resize handles
    const corners = ['nw', 'ne', 'sw', 'se'];
    corners.forEach(corner => {
      const handle = document.createElement('div');
      handle.className = `resize-handle corner-${corner}`;
      handle.style.position = 'absolute';
      handle.style.width = '8px';
      handle.style.height = '8px';
      handle.style.background = '#fff';
      handle.style.border = '2px solid #4299e1';
      handle.style.borderRadius = '50%';
      handle.style.pointerEvents = 'auto';
      handle.style.cursor = corner.includes('n') && corner.includes('w') ? 'nw-resize' :
                           corner.includes('n') && corner.includes('e') ? 'ne-resize' :
                           corner.includes('s') && corner.includes('w') ? 'sw-resize' : 'se-resize';
      
      // Position corner handles
      if (corner.includes('n')) handle.style.top = '-6px';
      if (corner.includes('s')) handle.style.bottom = '-6px';
      if (corner.includes('w')) handle.style.left = '-6px';
      if (corner.includes('e')) handle.style.right = '-6px';
      
      // Add resize functionality to corner handles
      let resizing = false;
      let startX, startY, startWidth, startHeight, startLeft, startTop;
      
      handle.addEventListener('pointerdown', function(e) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        box.classList.add('resizing'); // Add class to keep frame visible
        startX = e.clientX;
        startY = e.clientY;
        startWidth = box.offsetWidth;
        startHeight = box.offsetHeight;
        startLeft = box.offsetLeft;
        startTop = box.offsetTop;
        document.body.style.userSelect = 'none';
        
        function onPointerMove(e) {
          if (!resizing) return;
          
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          
          if (corner === 'se') {
            // Bottom-right: increase width and height
            let newWidth = startWidth + dx;
            let newHeight = startHeight + dy;
            if (newWidth < CONFIG.MIN_WIDTH) newWidth = CONFIG.MIN_WIDTH;
            if (newHeight < CONFIG.MIN_HEIGHT) newHeight = CONFIG.MIN_HEIGHT;
            box.style.width = newWidth + 'px';
            box.style.height = newHeight + 'px';
          } else if (corner === 'sw') {
            // Bottom-left: decrease width from left, increase height
            let newWidth = startWidth - dx;
            let newHeight = startHeight + dy;
            let newLeft = startLeft + dx;
            if (newWidth < CONFIG.MIN_WIDTH) {
              newLeft -= (CONFIG.MIN_WIDTH - newWidth);
              newWidth = CONFIG.MIN_WIDTH;
            }
            if (newHeight < CONFIG.MIN_HEIGHT) newHeight = CONFIG.MIN_HEIGHT;
            box.style.width = newWidth + 'px';
            box.style.height = newHeight + 'px';
            box.style.left = newLeft + 'px';
          } else if (corner === 'ne') {
            // Top-right: increase width, decrease height from top
            let newWidth = startWidth + dx;
            let newHeight = startHeight - dy;
            let newTop = startTop + dy;
            if (newWidth < CONFIG.MIN_WIDTH) newWidth = CONFIG.MIN_WIDTH;
            if (newHeight < CONFIG.MIN_HEIGHT) {
              newTop -= (CONFIG.MIN_HEIGHT - newHeight);
              newHeight = CONFIG.MIN_HEIGHT;
            }
            box.style.width = newWidth + 'px';
            box.style.height = newHeight + 'px';
            box.style.top = newTop + 'px';
          } else if (corner === 'nw') {
            // Top-left: decrease width and height from top-left
            let newWidth = startWidth - dx;
            let newHeight = startHeight - dy;
            let newLeft = startLeft + dx;
            let newTop = startTop + dy;
            if (newWidth < CONFIG.MIN_WIDTH) {
              newLeft -= (CONFIG.MIN_WIDTH - newWidth);
              newWidth = CONFIG.MIN_WIDTH;
            }
            if (newHeight < CONFIG.MIN_HEIGHT) {
              newTop -= (CONFIG.MIN_HEIGHT - newHeight);
              newHeight = CONFIG.MIN_HEIGHT;
            }
            box.style.width = newWidth + 'px';
            box.style.height = newHeight + 'px';
            box.style.left = newLeft + 'px';
            box.style.top = newTop + 'px';
          }
          
          // Update data model
          boxData.width = box.style.width;
          boxData.height = box.style.height;
          boxData.left = box.style.left;
          boxData.top = box.style.top;
          
          updateSelectionFrame();
          // Update drag handle position during resize
          if (updateHandlePosition) updateHandlePosition();
        }
        
        function onPointerUp() {
          resizing = false;
          box.classList.remove('resizing');
          document.body.style.userSelect = '';
          document.removeEventListener('pointermove', onPointerMove);
          document.removeEventListener('pointerup', onPointerUp);
          document.removeEventListener('pointercancel', onPointerUp); // Handle cancel events
          updateSelectionFrame(); // Update frame visibility after resize
          if (window.saveToHistory) window.saveToHistory('resize textbox');
        }
        
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp); // Handle cancel events
      });
      
      selectionFrame.appendChild(handle);
    });
    
    // Add CSS for clean textbox styling (no selection modifications)
    if (!document.getElementById('worksheet-textbox-clean-style')) {
      const style = document.createElement('style');
      style.id = 'worksheet-textbox-clean-style';
      style.innerHTML = `
        .worksheet-textbox:focus {
          outline: none !important;
          box-shadow: none !important;
        }
        .worksheet-textbox:hover {
          box-shadow: none !important;
        }
        .worksheet-textbox.selected {
          box-shadow: none !important;
        }
        .textbox-selection-frame {
          transition: opacity 0.2s ease;
          font-size: 0 !important;
          line-height: 0 !important;
          text-indent: 0 !important;
          letter-spacing: 0 !important;
          word-spacing: 0 !important;
        }
        .textbox-selection-frame * {
          font-size: 0 !important;
          line-height: 0 !important;
        }
        .resize-handle {
          font-size: 0 !important;
          line-height: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }

    a4.appendChild(selectionFrame); // Add selection frame to page
    
    // Function to show/hide and position selection frame
    function updateSelectionFrame() {
      if (box.classList.contains('selected') || 
          box.matches(':hover') || 
          box.classList.contains('hover-highlight') ||
          box.classList.contains('resizing')) {
        
        // Validate textbox has valid position and dimensions before showing frame
        const left = box.offsetLeft;
        const top = box.offsetTop;
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        
        // Only show if textbox has valid position and dimensions
        if (width > 0 && height > 0 && (left > 0 || top > 0 || box.style.left || box.style.top)) {
          selectionFrame.style.display = 'block';
          selectionFrame.style.left = (left - 2) + 'px';
          selectionFrame.style.top = (top - 2) + 'px';
          selectionFrame.style.width = (width + 4) + 'px';
          selectionFrame.style.height = (height + 4) + 'px';
          // Always move selectionFrame to the end so it's above all textboxes
          if (selectionFrame.parentNode && selectionFrame.parentNode.lastChild !== selectionFrame) {
            selectionFrame.parentNode.appendChild(selectionFrame);
          }
        } else {
          selectionFrame.style.display = 'none';
        }
      } else {
        selectionFrame.style.display = 'none';
      }
    }

    // Add print CSS to hide selection frame in print
    if (!document.getElementById('worksheet-print-hide-selection')) {
      const style = document.createElement('style');
      style.id = 'worksheet-print-hide-selection';
      style.innerHTML = `@media print {
        .textbox-selection-frame { display: none !important; }
        .resize-handle { display: none !important; }
      }`;
      document.head.appendChild(style);
    }

    return { selectionFrame, updateSelectionFrame };
  }
  
  window.textboxResize = { addResizeHandles };
})();
