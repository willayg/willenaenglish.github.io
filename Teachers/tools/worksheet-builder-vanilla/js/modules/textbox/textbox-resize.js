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
  selectionFrame.style.touchAction = 'none';
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
  handle.style.touchAction = 'none';
      handle.style.cursor = corner.includes('n') && corner.includes('w') ? 'nw-resize' :
                           corner.includes('n') && corner.includes('e') ? 'ne-resize' :
                           corner.includes('s') && corner.includes('w') ? 'sw-resize' : 'se-resize';
      
      // Position corner handles
      if (corner.includes('n')) handle.style.top = '-6px';
      if (corner.includes('s')) handle.style.bottom = '-6px';
      if (corner.includes('w')) handle.style.left = '-6px';
      if (corner.includes('e')) handle.style.right = '-6px';
      
      // Unified resize logic for corners and edges
      let resizing = false;
      let startX, startY, startWidth, startHeight, startLeft, startTop;
      function resizePointerDown(e, which) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        box.classList.add('resizing');
        startX = e.clientX;
        startY = e.clientY;
        startWidth = box.offsetWidth;
        startHeight = box.offsetHeight;
        startLeft = box.offsetLeft;
        startTop = box.offsetTop;
        document.body.style.userSelect = 'none';
        function onPointerMove(ev) {
          if (!resizing) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          let newWidth = startWidth, newHeight = startHeight;
          let newLeft = startLeft, newTop = startTop;
          if (which.includes('e')) newWidth = Math.max(CONFIG.MIN_WIDTH, startWidth + dx);
          if (which.includes('s')) newHeight = Math.max(CONFIG.MIN_HEIGHT, startHeight + dy);
          if (which.includes('w')) { newWidth = Math.max(CONFIG.MIN_WIDTH, startWidth - dx); newLeft = startLeft + (startWidth - newWidth); }
          if (which.includes('n')) { newHeight = Math.max(CONFIG.MIN_HEIGHT, startHeight - dy); newTop = startTop + (startHeight - newHeight); }
          box.style.width = newWidth + 'px';
          box.style.height = newHeight + 'px';
          box.style.left = newLeft + 'px';
          box.style.top = newTop + 'px';
          boxData.width = box.style.width;
          boxData.height = box.style.height;
          boxData.left = box.style.left;
          boxData.top = box.style.top;
          updateSelectionFrame();
          if (updateHandlePosition) updateHandlePosition();
        }
        function onPointerUp() {
          resizing = false;
          box.classList.remove('resizing');
          document.body.style.userSelect = '';
          document.removeEventListener('pointermove', onPointerMove);
          document.removeEventListener('pointerup', onPointerUp);
          document.removeEventListener('pointercancel', onPointerUp);
          updateSelectionFrame();
          window.saveToHistory && window.saveToHistory('resize textbox');
        }
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', onPointerUp);
        document.addEventListener('pointercancel', onPointerUp);
      }
      handle.addEventListener('pointerdown', function(e) { resizePointerDown(e, corner); });
      selectionFrame.appendChild(handle);
    });
    
    // Add side edge handles
    const sides = ['n', 'e', 's', 'w'];
    sides.forEach(side => {
      const handle = document.createElement('div');
      handle.className = `resize-handle side-${side}`;
      handle.style.position = 'absolute';
      handle.style.background = '#fff';
      handle.style.border = '2px solid #4299e1';
      handle.style.borderRadius = '50%';
  handle.style.pointerEvents = 'auto';
  handle.style.touchAction = 'none';
      handle.style.cursor = side + '-resize';
      
      // Position and size side handles
      if (side === 'n' || side === 's') {
        handle.style.width = '8px';
        handle.style.height = '8px';
        handle.style.left = '50%';
        handle.style.transform = 'translateX(-50%)';
        if (side === 'n') handle.style.top = '-6px';
        if (side === 's') handle.style.bottom = '-6px';
      } else {
        handle.style.width = '8px';
        handle.style.height = '8px';
        handle.style.top = '50%';
        handle.style.transform = 'translateY(-50%)';
        if (side === 'w') handle.style.left = '-6px';
        if (side === 'e') handle.style.right = '-6px';
      }
      
  handle.addEventListener('pointerdown', function(e) { resizePointerDown(e, side); });
  selectionFrame.appendChild(handle);
    });
    
    // Add edge detection for selection frame borders
    function edgeAt(element, e, hit = 18) {
      const rect = element.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const right = rect.width - x;
      const bottom = rect.height - y;
      
      if (x < hit && y < hit) return 'nw';
      if (right < hit && y < hit) return 'ne';
      if (x < hit && bottom < hit) return 'sw';
      if (right < hit && bottom < hit) return 'se';
      if (right < hit && y > hit && y < rect.height - hit) return 'e';
      if (x < hit && y > hit && y < rect.height - hit) return 'w';
      if (bottom < hit && x > hit && x < rect.width - hit) return 's';
      if (y < hit && x > hit && x < rect.width - hit) return 'n';
      return '';
    }
    
    function cursorFor(edge) {
      const cursors = {
        'e': 'e-resize', 'w': 'w-resize', 's': 's-resize', 'n': 'n-resize',
        'se': 'se-resize', 'ne': 'ne-resize', 'sw': 'sw-resize', 'nw': 'nw-resize'
      };
      return cursors[edge] || 'default';
    }
    
    // Enable pointer events and edge detection on selection frame
    selectionFrame.addEventListener('pointermove', function(e) {
      if (!box.classList.contains('resizing')) {
        const edge = edgeAt(selectionFrame, e);
        selectionFrame.style.cursor = cursorFor(edge);
      }
    });
    
    selectionFrame.addEventListener('pointerdown', function(e) {
      const edge = edgeAt(selectionFrame, e);
      if (!edge) return;
      
      e.preventDefault();
      e.stopPropagation();
      box.classList.add('resizing');
      
      let startX = e.clientX;
      let startY = e.clientY;
      let startWidth = box.offsetWidth;
      let startHeight = box.offsetHeight;
      let startLeft = box.offsetLeft;
      let startTop = box.offsetTop;
      document.body.style.userSelect = 'none';
      
      function onPointerMove(ev) {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        let newWidth = startWidth, newHeight = startHeight;
        let newLeft = startLeft, newTop = startTop;

        if (edge.includes('e')) newWidth = Math.max(CONFIG.MIN_WIDTH, startWidth + dx);
        if (edge.includes('s')) newHeight = Math.max(CONFIG.MIN_HEIGHT, startHeight + dy);
        if (edge.includes('w')) { 
          newWidth = Math.max(CONFIG.MIN_WIDTH, startWidth - dx); 
          newLeft = startLeft + (startWidth - newWidth);
        }
        if (edge.includes('n')) { 
          newHeight = Math.max(CONFIG.MIN_HEIGHT, startHeight - dy); 
          newTop = startTop + (startHeight - newHeight);
        }

        box.style.width = newWidth + 'px';
        box.style.height = newHeight + 'px';
        box.style.left = newLeft + 'px';
        box.style.top = newTop + 'px';

        boxData.width = box.style.width;
        boxData.height = box.style.height;
        boxData.left = box.style.left;
        boxData.top = box.style.top;

        updateSelectionFrame();
        if (updateHandlePosition) updateHandlePosition();
      }

      function onPointerUp() {
        box.classList.remove('resizing');
        document.body.style.userSelect = '';
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', onPointerUp);
        document.removeEventListener('pointercancel', onPointerUp);
        updateSelectionFrame();
        if (window.saveToHistory) window.saveToHistory('resize textbox');
      }

      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', onPointerUp);
      document.addEventListener('pointercancel', onPointerUp);
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
      // Show selection frame when textbox is selected, being resized, OR being edited
      if (box.classList.contains('selected') || 
          box.classList.contains('resizing') ||
          box.contentEditable === 'true') {
        // Get textbox position and dimensions
        const left = box.offsetLeft;
        const top = box.offsetTop;
        const width = box.offsetWidth;
        const height = box.offsetHeight;
        // Show selection frame if we have valid dimensions (position can be 0,0)
        if (width > 0 && height > 0) {
          selectionFrame.style.display = 'block';
          selectionFrame.style.left = (left - 2) + 'px';
          selectionFrame.style.top = (top - 2) + 'px';
          selectionFrame.style.width = (width + 4) + 'px';
          selectionFrame.style.height = (height + 4) + 'px';
          selectionFrame.style.pointerEvents = 'none'; // Never let the frame swallow clicks
          // Only reparent if not resizing
          if (!box.classList.contains('resizing') && selectionFrame.parentNode && selectionFrame.parentNode.lastChild !== selectionFrame) {
            selectionFrame.parentNode.appendChild(selectionFrame);
          }
        } else {
          selectionFrame.style.display = 'none';
          selectionFrame.style.pointerEvents = 'none';
        }
      } else {
        selectionFrame.style.display = 'none';
        selectionFrame.style.pointerEvents = 'none';
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
