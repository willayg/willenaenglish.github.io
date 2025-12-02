// contextmenu.js - Context Menu System
// Handles all context menu functionality for the worksheet builder

(function() {
  'use strict';
  
  // Context Menu System Module
  const contextMenuModule = {
    
    /**
     * Initialize the preview area context menu
     * Sets up right-click functionality for the main preview area
     */
    initializePreviewContextMenu: function() {
      const previewArea = document.getElementById('page-preview-area');
      if (!previewArea) return;
      
      previewArea.addEventListener('contextmenu', function(e) {
        // Only trigger if not right-clicking a textbox or page controls
        if (e.target.closest('.worksheet-textbox') || e.target.closest('.page-controls')) return;
        
        e.preventDefault();
        
        // Store cursor position for paste functionality
        window.lastContextMenuPosition = {
          x: e.clientX,
          y: e.clientY
        };
        
        const contextMenu = window.worksheetTextbox.createContextMenu();
        
        // Only enable paste, disable all other actions for preview area
        contextMenu.querySelectorAll('.context-item').forEach(item => {
          if (item.dataset.action === 'paste') {
            item.classList.toggle('disabled', !window.worksheetState.getClipboardData());
          } else {
            item.classList.add('disabled');
          }
        });
        
        // Position the context menu
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
        
        // Handle context menu actions
        contextMenu.onclick = function(event) {
          const action = event.target.dataset.action;
          if (action === 'paste' && !event.target.classList.contains('disabled')) {
            window.worksheetTextbox.pasteTextbox();
          }
          contextMenu.style.display = 'none';
        };
      });
    },
    
    /**
     * Hide all visible context menus
     */
    hideContextMenus: function() {
      const contextMenus = document.querySelectorAll('.context-menu');
      contextMenus.forEach(menu => {
        menu.style.display = 'none';
      });
    },
    
    /**
     * Position a context menu near the cursor, adjusting for viewport boundaries
     * @param {HTMLElement} menu - The context menu element
     * @param {number} x - Mouse X position
     * @param {number} y - Mouse Y position
     */
    positionContextMenu: function(menu, x, y) {
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.style.display = 'block';
      
      // Adjust position if menu goes off-screen
      setTimeout(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
          menu.style.top = (y - rect.height) + 'px';
        }
      }, 0);
    },
    
    /**
     * Initialize all context menu systems
     */
    initialize: function() {
      this.initializePreviewContextMenu();
      
      // Global click handler to hide context menus when clicking elsewhere
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.context-menu')) {
          this.hideContextMenus();
        }
      });
      
      // Hide context menus on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.hideContextMenus();
        }
      });
    }
  };
  
  // Expose module to global scope
  window.worksheetContextMenu = contextMenuModule;
  
})();
