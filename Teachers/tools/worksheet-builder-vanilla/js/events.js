// events.js - Event Listeners & Application Initialization
// Handles all application-level event listeners and initialization

(function() {
  'use strict';
  
  // Event System Module
  const eventModule = {
    
    /**
     * Initialize border weight control functionality
     */
    initializeBorderControls: function() {
      const borderWeightInput = document.getElementById('dropdown-borderweight');
      if (!borderWeightInput) return;
      
      borderWeightInput.addEventListener('input', function() {
        const lastTextbox = window.worksheetState.getLastTextbox();
        const selectedHeader = document.querySelector('.worksheet-header.selected');
        
        if (lastTextbox) {
          // Update inline style immediately
          lastTextbox.style.borderWidth = borderWeightInput.value + 'px';
          
          // Also update data model for persistence
          const pageIdx = Array.from(document.querySelectorAll('.page-preview-a4')).findIndex(p => p.contains(lastTextbox));
          if (pageIdx >= 0) {
            const boxIdx = Array.from(document.querySelectorAll('.worksheet-textbox')).indexOf(lastTextbox);
            if (boxIdx >= 0 && window.worksheetState.getPages()[pageIdx] && window.worksheetState.getPages()[pageIdx].boxes[boxIdx]) {
              window.worksheetState.getPages()[pageIdx].boxes[boxIdx].borderWeight = borderWeightInput.value;
            }
          }
          
          // Save to history for border weight changes
          if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
            window.worksheetHistory.saveToHistory('change border thickness');
          }
        } else if (selectedHeader) {
          // Update header border weight
          selectedHeader.setAttribute('data-border-width', borderWeightInput.value);
          const borderOn = selectedHeader.getAttribute('data-border-on') !== 'false';
          if (borderOn) {
            selectedHeader.style.borderWidth = borderWeightInput.value + 'px';
          }
          
          // Update header data model for persistence
          const pageIdx = Array.from(document.querySelectorAll('.page-preview-a4')).findIndex(p => p.contains(selectedHeader));
          if (pageIdx >= 0 && window.worksheetState.getPages()[pageIdx] && window.worksheetState.getPages()[pageIdx].header) {
            window.worksheetState.getPages()[pageIdx].header.borderWeight = borderWeightInput.value;
          }
          
          // Save to history for header border weight changes
          if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
            window.worksheetHistory.saveToHistory('change header border thickness');
          }
        }
      });
    },
    
    /**
     * Initialize global keyboard shortcuts
     */
    initializeKeyboardShortcuts: function() {
      document.addEventListener('keydown', function(e) {
        // Handle undo/redo shortcuts globally
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
          if (e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (window.worksheetHistory && window.worksheetHistory.undo) {
              window.worksheetHistory.undo();
            }
            return;
          }
          if (e.key.toLowerCase() === 'y') {
            e.preventDefault();
            if (window.worksheetHistory && window.worksheetHistory.redo) {
              window.worksheetHistory.redo();
            }
            return;
          }
        }
        
        // Only handle textbox shortcuts when a textbox is selected and not editing text
        if (!window.worksheetState.getLastTextbox()) return;
        
        // Check if we're actually editing text content (cursor is inside the textbox)
        const isEditing = document.activeElement === window.worksheetState.getLastTextbox() || window.worksheetState.getLastTextbox().contains(document.activeElement);
        
        // Don't intercept shortcuts when actively editing text content
        if (isEditing && !e.ctrlKey && !e.metaKey) return;
        
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
          switch(e.key.toLowerCase()) {
            case 'c':
              e.preventDefault();
              if (window.worksheetTextbox && window.worksheetTextbox.copyTextbox) {
                window.worksheetTextbox.copyTextbox(window.worksheetState.getLastTextbox());
              }
              break;
            case 'x':
              e.preventDefault();
              if (window.worksheetTextbox && window.worksheetTextbox.cutTextbox) {
                window.worksheetTextbox.cutTextbox(window.worksheetState.getLastTextbox());
              }
              break;
            case 'v':
              e.preventDefault();
              if (window.worksheetTextbox && window.worksheetTextbox.pasteTextbox) {
                window.worksheetTextbox.pasteTextbox();
              }
              break;
          }
        }
        
        // Delete key (when textbox is selected but not editing)
        if (e.key === 'Delete' && !isEditing) {
          e.preventDefault();
          if (window.worksheetTextbox && window.worksheetTextbox.deleteTextbox) {
            window.worksheetTextbox.deleteTextbox(window.worksheetState.getLastTextbox());
          }
        }
      });
    },
    
    /**
     * Initialize page auto-selection based on scroll position
     */
    initializePageAutoSelection: function() {
      function autoSelectVisiblePage() {
        const pages = Array.from(document.querySelectorAll('.page-preview-a4'));
        if (!pages.length) return;
        
        let closest = null;
        let minDist = Infinity;
        const viewportCenter = window.scrollY + window.innerHeight / 2;
        
        pages.forEach(page => {
          const rect = page.getBoundingClientRect();
          const pageCenter = rect.top + window.scrollY + rect.height / 2;
          const dist = Math.abs(pageCenter - viewportCenter);
          if (dist < minDist) {
            minDist = dist;
            closest = page;
          }
        });
        
        if (closest && !closest.classList.contains('selected')) {
          document.querySelectorAll('.page-preview-a4.selected').forEach(p => p.classList.remove('selected'));
          closest.classList.add('selected');
        }
      }
      
      window.addEventListener('scroll', autoSelectVisiblePage, { passive: true });
      window.addEventListener('resize', autoSelectVisiblePage);
      setTimeout(autoSelectVisiblePage, 200);
    },
    
    /**
     * Initialize burger menu functionality
     */
    initializeBurgerMenu: function() {
      const burgerToggle = document.getElementById('burger-toggle');
      const burgerMenu = document.getElementById('burger-menu');
      
      if (!burgerToggle || !burgerMenu) return;
      
      burgerToggle.onclick = () => {
        burgerMenu.style.display = burgerMenu.style.display === 'block' ? 'none' : 'block';
      };
      
      document.addEventListener('click', (e) => {
        if (e.target !== burgerToggle && !burgerMenu.contains(e.target)) {
          burgerMenu.style.display = 'none';
        }
      });
    },
    
    initializeAddPageButton: function() {
      const addPageButton = document.getElementById('add-page-text');
      
      if (!addPageButton) return;
      
      addPageButton.onclick = () => {
        if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
          window.worksheetHistory.saveToHistory('add page');
        }
        window.worksheetState.getPages().push({ boxes: [] });
        if (window.worksheetRender && window.worksheetRender.renderPages) {
          window.worksheetRender.renderPages();
        }
      };
    },
    
    /**
     * Initialize the application
     */
    initializeApplication: function() {
      // Save initial state to history
      if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
        window.worksheetHistory.saveToHistory('initial state');
      }
      
      // Render initial pages
      if (window.worksheetRender && window.worksheetRender.renderPages) {
        window.worksheetRender.renderPages();
      }
      
      // Initialize all other modules
      if (window.worksheetToolbar) {
        window.worksheetToolbar.initializeToolbar();
        window.worksheetToolbar.initializeMenus();
      }
      
      if (window.worksheetContextMenu) {
        window.worksheetContextMenu.initialize();
      }
    },
    
    /**
     * Initialize all event systems
     */
    initialize: function() {
      this.initializeBorderControls();
      this.initializeKeyboardShortcuts();
      this.initializePageAutoSelection();
      this.initializeBurgerMenu();
      this.initializeAddPageButton();
      this.initializeApplication();
    }
  };
  
  // Expose module to global scope
  window.worksheetEvents = eventModule;
  
})();
