// textbox.js - Text Box Operations Management

(function() {
  // Text box operations
  function copyTextbox(box) {
    if (!box) return;
    
    // Find the box data in the data model
    const pageEls = document.querySelectorAll('.page-preview-a4');
    for (let pageIdx = 0; pageIdx < pageEls.length; pageIdx++) {
      const boxes = pageEls[pageIdx].querySelectorAll('.worksheet-textbox');
      for (let boxIdx = 0; boxIdx < boxes.length; boxIdx++) {
        if (boxes[boxIdx] === box && window.worksheetState.getPages()[pageIdx] && window.worksheetState.getPages()[pageIdx].boxes[boxIdx]) {
          // Deep copy the box data
          window.worksheetState.setClipboardData(JSON.parse(JSON.stringify(window.worksheetState.getPages()[pageIdx].boxes[boxIdx])));
          console.log('Text box copied to clipboard');
          
          // Reset paste counter for new copy operation
          window.pasteCounter = 0;
          
          // Visual feedback
          box.style.outline = '2px solid #4CAF50';
          setTimeout(() => {
            box.style.outline = '';
          }, 500);
          
          return;
        }
      }
    }
  }

  function cutTextbox(box) {
    if (!box) return;
    copyTextbox(box);
    deleteTextbox(box);
  }

  function deleteTextbox(box) {
    if (!box) return;
    
    // Save current state before deletion
    if (window.saveToHistory) {
      window.saveToHistory('delete textbox');
    }
    
    // Find and remove the box from the data model
    const pageEls = document.querySelectorAll('.page-preview-a4');
    for (let pageIdx = 0; pageIdx < pageEls.length; pageIdx++) {
      const boxes = pageEls[pageIdx].querySelectorAll('.worksheet-textbox');
      for (let boxIdx = 0; boxIdx < boxes.length; boxIdx++) {
        if (boxes[boxIdx] === box && window.worksheetState.getPages()[pageIdx] && window.worksheetState.getPages()[pageIdx].boxes[boxIdx]) {
          window.worksheetState.getPages()[pageIdx].boxes.splice(boxIdx, 1);
          if (window.worksheetState.getLastTextbox() === box) {
            window.worksheetState.setLastTextbox(null);
          }
          if (window.renderPages) {
            window.renderPages();
          }
          console.log('Text box deleted');
          return;
        }
      }
    }
  }

  function pasteTextbox() {
    if (!window.worksheetState.getClipboardData()) {
      console.log('No text box in clipboard');
      return;
    }
    
    // Save current state before pasting
    if (window.saveToHistory) {
      window.saveToHistory('paste textbox');
    }
    
    // Find the selected page or use the last page
    const selected = document.querySelector('.page-preview-a4.selected');
    const pagesEls = document.querySelectorAll('.page-preview-a4');
    if (!pagesEls.length) return;
    
    const pageEl = selected || pagesEls[pagesEls.length - 1];
    const pageIdx = Array.from(pagesEls).indexOf(pageEl);
    if (pageIdx === -1) return;
    
    // Create a copy of the clipboard data
    const newBoxData = JSON.parse(JSON.stringify(window.worksheetState.getClipboardData()));
    
    // Initialize or increment paste counter for smart positioning
    if (!window.pasteCounter) window.pasteCounter = 0;
    window.pasteCounter++;
    
    // Try to use cursor position if available, otherwise use smart offset
    if (window.lastContextMenuPosition) {
      // Convert screen coordinates to page-relative coordinates
      const pageRect = pageEl.getBoundingClientRect();
      const relativeX = window.lastContextMenuPosition.x - pageRect.left;
      const relativeY = window.lastContextMenuPosition.y - pageRect.top;
      
      // Ensure the textbox stays within page bounds
      const maxX = pageRect.width - 100; // Leave some margin
      const maxY = pageRect.height - 50; // Leave some margin
      
      newBoxData.left = Math.max(0, Math.min(relativeX, maxX)) + 'px';
      newBoxData.top = Math.max(0, Math.min(relativeY, maxY)) + 'px';
      
      console.log('Pasting textbox at cursor position:', relativeX, relativeY);
      
      // Clear the stored position
      window.lastContextMenuPosition = null;
      // Reset paste counter since we're using explicit positioning
      window.pasteCounter = 0;
    } else {
      // Smart offset behavior - create a staggered pattern
      const baseOffsetX = 25;
      const baseOffsetY = 25;
      const maxStagger = 5; // Reset pattern after 5 pastes
      
      const staggerIndex = (window.pasteCounter - 1) % maxStagger;
      const offsetX = baseOffsetX * (staggerIndex + 1);
      const offsetY = baseOffsetY * (staggerIndex + 1);
      
      const originalLeft = parseInt(newBoxData.left) || 0;
      const originalTop = parseInt(newBoxData.top) || 0;
      
      // Apply smart offset
      let newLeft = originalLeft + offsetX;
      let newTop = originalTop + offsetY;
      
      // Ensure the textbox stays within page bounds (rough estimate)
      const pageRect = pageEl.getBoundingClientRect();
      const maxX = pageRect.width - 120; // Leave margin for textbox width
      const maxY = pageRect.height - 80; // Leave margin for textbox height
      
      // If we'd go off the right or bottom, wrap to a new row/column
      if (newLeft > maxX) {
        newLeft = originalLeft + baseOffsetX;
        newTop = originalTop + offsetY + baseOffsetY;
      }
      if (newTop > maxY) {
        newLeft = originalLeft + offsetX;
        newTop = originalTop + baseOffsetY;
      }
      
      newBoxData.left = newLeft + 'px';
      newBoxData.top = newTop + 'px';
      
      console.log(`Pasting textbox with smart offset (${staggerIndex + 1}/${maxStagger}):`, newLeft, newTop);
    }
    
    // Add to the page
    if (!window.worksheetState.getPages()[pageIdx]) {
      window.worksheetState.getPages()[pageIdx] = { boxes: [] };
    }
    window.worksheetState.getPages()[pageIdx].boxes.push(newBoxData);

    // Re-render to show the new box
    if (window.renderPages) {
      window.renderPages();

      // After rendering, find the newly pasted textbox and initialize its styles/attributes
      setTimeout(() => {
        // Find all textboxes on the page
        const pageEls = document.querySelectorAll('.page-preview-a4');
        const pageEl = pageEls[pageIdx];
        if (!pageEl) return;
        // Find the last textbox (should be the pasted one)
        const textboxes = pageEl.querySelectorAll('.worksheet-textbox');
        if (!textboxes.length) return;
        const newTextbox = textboxes[textboxes.length - 1];
        if (!newTextbox) return;

        // --- FIX: Mark new textbox as selected and focus it ---
        document.querySelectorAll('.worksheet-textbox.selected').forEach(tb => tb.classList.remove('selected'));
        newTextbox.classList.add('selected');
        if (typeof newTextbox.focus === 'function') newTextbox.focus();
        
        // Update the lastTextbox state to point to the newly pasted textbox
        if (window.worksheetState && window.worksheetState.setLastTextbox) {
          window.worksheetState.setLastTextbox(newTextbox);
        }
        // --- END FIX ---

        // Set color, border, and fill styles from data attributes if present
        // Font color
        if (newBoxData.color) newTextbox.style.color = newBoxData.color;
        // Border color
        if (newBoxData['data-border-color']) {
          newTextbox.setAttribute('data-border-color', newBoxData['data-border-color']);
          newTextbox.style.borderColor = newBoxData['data-border-color'];
        }
        // Fill color
        if (newBoxData['data-fill-color']) {
          newTextbox.setAttribute('data-fill-color', newBoxData['data-fill-color']);
        }
        // Fill on
        if (newBoxData['data-fill-on']) {
          newTextbox.setAttribute('data-fill-on', newBoxData['data-fill-on']);
        }
        // Fill opacity
        if (newBoxData['data-fill-opacity']) {
          newTextbox.setAttribute('data-fill-opacity', newBoxData['data-fill-opacity']);
        }

        // Re-apply fill style if needed
        if (newTextbox.getAttribute('data-fill-on') === 'true' && newTextbox.getAttribute('data-fill-color')) {
          const fillOpacity = parseFloat(newTextbox.getAttribute('data-fill-opacity')) || 1;
          let c = newTextbox.getAttribute('data-fill-color').replace('#', '');
          if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
          const num = parseInt(c, 16);
          newTextbox.style.backgroundColor = `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${fillOpacity})`;
        }

        // Optionally, update color pickers to reflect this textbox
        if (window.worksheetColorPicker && window.worksheetColorPicker.updateColorPickersFromSelection) {
          window.worksheetColorPicker.updateColorPickersFromSelection(newTextbox);
        }
        
        console.log('Textbox pasted and selected successfully');
      }, 0);
    }
    console.log('Text box pasted');
  }

  // Create context menu for text box operations
  function createContextMenu() {
    // Remove existing context menu if any
    const existingMenu = document.getElementById('context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.style.cssText = `
      position: fixed;
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      padding: 8px 0;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      min-width: 120px;
      display: none;
    `;

    const menuItems = [
      { text: 'Undo', action: 'undo' },
      { text: 'Redo', action: 'redo' },
      { text: '---', action: 'separator' },
      { text: 'Copy', action: 'copy' },
      { text: 'Cut', action: 'cut' },
      { text: 'Paste', action: 'paste' },
      { text: 'Delete', action: 'delete' }
    ];

    menuItems.forEach(item => {
      if (item.action === 'separator') {
        const separator = document.createElement('div');
        separator.style.cssText = `
          height: 1px;
          background: #eee;
          margin: 4px 0;
        `;
        menu.appendChild(separator);
        return;
      }
      
      const menuItem = document.createElement('div');
      menuItem.className = 'context-item';
      menuItem.dataset.action = item.action;
      menuItem.style.cssText = `
        padding: 8px 16px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: #333;
      `;
      menuItem.textContent = item.text;
      
      menuItem.addEventListener('mouseenter', () => {
        if (!menuItem.classList.contains('disabled')) {
          menuItem.style.backgroundColor = '#f0f0f0';
        }
      });
      
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = '';
      });
      
      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);

    // Hide menu when clicking outside
    document.addEventListener('click', function hideMenu(e) {
      if (!menu.contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', hideMenu);
      }
    });

    return menu;
  }

  // Show context menu for textbox
  function showTextboxContextMenu(e, textbox) {
    e.preventDefault();
    const contextMenu = createContextMenu();
    
    // Enable/disable menu items based on context
    const undoItem = contextMenu.querySelector('[data-action="undo"]');
    const redoItem = contextMenu.querySelector('[data-action="redo"]');
    const copyItem = contextMenu.querySelector('[data-action="copy"]');
    const cutItem = contextMenu.querySelector('[data-action="cut"]');
    const deleteItem = contextMenu.querySelector('[data-action="delete"]');
    const pasteItem = contextMenu.querySelector('[data-action="paste"]');
    
    // Undo/Redo availability based on history
    if (window.getHistoryInfo) {
      const historyInfo = window.getHistoryInfo();
      undoItem.classList.toggle('disabled', !historyInfo.canUndo);
      redoItem.classList.toggle('disabled', !historyInfo.canRedo);
    } else {
      undoItem.classList.add('disabled');
      redoItem.classList.add('disabled');
    }
    
    // Copy, cut, delete are available if a textbox is selected
    if (textbox) {
      copyItem.classList.remove('disabled');
      cutItem.classList.remove('disabled');
      deleteItem.classList.remove('disabled');
    } else {
      copyItem.classList.add('disabled');
      cutItem.classList.add('disabled');
      deleteItem.classList.add('disabled');
    }
    
    // Paste is available if clipboard has data
    pasteItem.classList.toggle('disabled', !window.worksheetState.getClipboardData());
    
    // Add disabled styling
    contextMenu.querySelectorAll('.disabled').forEach(item => {
      item.style.opacity = '0.5';
      item.style.cursor = 'not-allowed';
    });
    
    // Position menu
    contextMenu.style.left = e.clientX + 'px';
    contextMenu.style.top = e.clientY + 'px';
    contextMenu.style.display = 'block';
    
    // Adjust position if menu goes off-screen
    setTimeout(() => {
      const rect = contextMenu.getBoundingClientRect();
      if (rect.right > window.innerWidth) {
        contextMenu.style.left = (e.clientX - rect.width) + 'px';
      }
      if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = (e.clientY - rect.height) + 'px';
      }
    }, 0);
    
    // Handle menu clicks
    contextMenu.onclick = function(event) {
      const action = event.target.closest('.context-item')?.dataset.action;
      if (!action || event.target.closest('.disabled')) return;
      
      switch(action) {
        case 'undo':
          if (window.undo) window.undo();
          break;
        case 'redo':
          if (window.redo) window.redo();
          break;
        case 'copy':
          if (textbox) copyTextbox(textbox);
          break;
        case 'cut':
          if (textbox) cutTextbox(textbox);
          break;
        case 'paste':
          pasteTextbox();
          break;
        case 'delete':
          if (textbox) deleteTextbox(textbox);
          break;
      }
      contextMenu.style.display = 'none';
    };
  }

  // Utility function to find textbox in data model and update property
  function updateBoxData(box, property, value) {
    // Find the box in the data model and update it
    const pageEls = document.querySelectorAll('.page-preview-a4');
    for (let pageIdx = 0; pageIdx < pageEls.length; pageIdx++) {
      const boxes = pageEls[pageIdx].querySelectorAll('.worksheet-textbox');
      for (let boxIdx = 0; boxIdx < boxes.length; boxIdx++) {
        if (boxes[boxIdx] === box && window.worksheetState.getPages()[pageIdx] && window.worksheetState.getPages()[pageIdx].boxes[boxIdx]) {
          window.worksheetState.getPages()[pageIdx].boxes[boxIdx][property] = value;
          return;
        }
      }
    }
  }


  // Duplicate textbox: add a new box to the data model, re-render, and select
  function duplicateTextbox(box) {
    if (!box) return;
    const pageEls = document.querySelectorAll('.page-preview-a4');
    for (let pageIdx = 0; pageIdx < pageEls.length; pageIdx++) {
      const boxes = pageEls[pageIdx].querySelectorAll('.worksheet-textbox');
      for (let boxIdx = 0; boxIdx < boxes.length; boxIdx++) {
        if (boxes[boxIdx] === box && window.worksheetState.getPages()[pageIdx] && window.worksheetState.getPages()[pageIdx].boxes[boxIdx]) {
          const origData = window.worksheetState.getPages()[pageIdx].boxes[boxIdx];
          const newBoxData = JSON.parse(JSON.stringify(origData));
          const origLeft = parseInt(newBoxData.left) || 0;
          const origTop = parseInt(newBoxData.top) || 0;
          newBoxData.left = (origLeft + 32) + 'px';
          newBoxData.top = (origTop + 32) + 'px';
          if (window.saveToHistory) window.saveToHistory('duplicate textbox');
          window.worksheetState.getPages()[pageIdx].boxes.push(newBoxData);
          if (window.renderPages) {
            window.renderPages();
            requestAnimationFrame(() => {
              const pageEl = document.querySelectorAll('.page-preview-a4')[pageIdx];
              if (!pageEl) return;
              const textboxes = pageEl.querySelectorAll('.worksheet-textbox');
              if (!textboxes.length) return;
              const newTextbox = textboxes[textboxes.length - 1];
              window.lastCreatedTextbox = newTextbox;
              document.querySelectorAll('.worksheet-textbox.selected').forEach(tb => tb.classList.remove('selected'));
              newTextbox.classList.add('selected');
              if (typeof newTextbox.focus === 'function') newTextbox.focus();
              if (window.worksheetState && window.worksheetState.setLastTextbox) {
                window.worksheetState.setLastTextbox(newTextbox);
              }
              if (window.selectTextbox) {
                window.selectTextbox(newTextbox);
              }
              if (window.updateSelectionFrame) {
                window.updateSelectionFrame(newTextbox);
              }
              if (window.updateHandlePosition) {
                window.updateHandlePosition(newTextbox);
              }
              // Do not show toolbar here; let caller decide
            });
          }
          return;
        }
      }
    }
  }

  // Create the global textbox operations object
  window.worksheetTextbox = {
    copyTextbox,
    cutTextbox,
    deleteTextbox,
    pasteTextbox,
    duplicateTextbox,
    createContextMenu,
    showTextboxContextMenu,
    updateBoxData
  };

  // Make functions globally available for backward compatibility
  window.copyTextbox = copyTextbox;
  window.cutTextbox = cutTextbox;
  window.deleteTextbox = deleteTextbox;
  window.pasteTextbox = pasteTextbox;
  window.duplicateTextbox = duplicateTextbox;
  window.createContextMenu = createContextMenu;
  window.showTextboxContextMenu = showTextboxContextMenu;
  window.updateBoxData = updateBoxData;
})();
