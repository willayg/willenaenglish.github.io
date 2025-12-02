// events.js - Event Listeners & Application Initialization (lean)
// Handles application-level event listeners and initialization

(function () {
  'use strict';

  const eventModule = {
    /**
     * Border weight control
     * - Live updates on input
     * - History saved on change (not every keystroke)
     */
    initializeBorderControls: function () {
      const borderWeightInput = document.getElementById('dropdown-borderweight');
      if (!borderWeightInput) return;

      const applyToTextbox = (textbox, value) => {
        if (!textbox) return false;
        textbox.style.borderWidth = value + 'px';

        // Update data model: find page and box index within that page
        const pageEl = textbox.closest('.page-preview-a4');
        if (!pageEl || !window.worksheetState || !window.worksheetState.getPages) return true;

        const pages = window.worksheetState.getPages();
        const pageIdx = Array.from(document.querySelectorAll('.page-preview-a4')).indexOf(pageEl);
        if (pageIdx < 0 || !pages[pageIdx]) return true;

        const boxList = Array.from(pageEl.querySelectorAll('.worksheet-textbox'));
        const boxIdx = boxList.indexOf(textbox);
        if (boxIdx >= 0 && pages[pageIdx].boxes && pages[pageIdx].boxes[boxIdx]) {
          pages[pageIdx].boxes[boxIdx].borderWeight = String(value);
        }
        return true;
      };

      const applyToHeader = (header, value) => {
        if (!header) return false;
        header.setAttribute('data-border-width', String(value));
        const borderOn = header.getAttribute('data-border-on') !== 'false';
        if (borderOn) header.style.borderWidth = value + 'px';

        const pages = window.worksheetState && window.worksheetState.getPages && window.worksheetState.getPages();
        if (!pages) return true;

        const pageIdx = Array.from(document.querySelectorAll('.page-preview-a4')).findIndex(p => p.contains(header));
        if (pageIdx >= 0 && pages[pageIdx] && pages[pageIdx].header) {
          pages[pageIdx].header.borderWeight = String(value);
        }
        return true;
      };

      function liveUpdate() {
        const value = parseInt(borderWeightInput.value, 10) || 0;
        const lastTextbox = window.worksheetState && window.worksheetState.getLastTextbox && window.worksheetState.getLastTextbox();
        const selectedHeader = document.querySelector('.worksheet-header.selected');
        if (lastTextbox) applyToTextbox(lastTextbox, value);
        else if (selectedHeader) applyToHeader(selectedHeader, value);
      }

      function commitHistory() {
        if (!window.worksheetHistory || !window.worksheetHistory.saveToHistory) return;
        const lastTextbox = window.worksheetState && window.worksheetState.getLastTextbox && window.worksheetState.getLastTextbox();
        const selectedHeader = document.querySelector('.worksheet-header.selected');
        if (lastTextbox) window.worksheetHistory.saveToHistory('change border thickness');
        else if (selectedHeader) window.worksheetHistory.saveToHistory('change header border thickness');
      }

      borderWeightInput.addEventListener('input', liveUpdate);
      borderWeightInput.addEventListener('change', commitHistory);
    },

    /**
     * Global keyboard shortcuts
     * - Undo/Redo
     * - Copy/Cut/Paste for textboxes
     * - Delete/Backspace deletes selected or focused-inside textbox when not editing text
     * - Prevents Backspace navigating back a page
     */
    initializeKeyboardShortcuts: function () {
      document.addEventListener('keydown', function (e) {
        // Undo / Redo
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
          const k = e.key.toLowerCase();
          if (k === 'z') {
            e.preventDefault();
            if (window.worksheetHistory && window.worksheetHistory.undo) window.worksheetHistory.undo();
            return;
          }
          if (k === 'y') {
            e.preventDefault();
            if (window.worksheetHistory && window.worksheetHistory.redo) window.worksheetHistory.redo();
            return;
          }
        }

        // Find a target textbox:
        // 1) Prefer visibly selected box
        // 2) Fallback to the box that contains the active element (so clicks inside count)
        const selectedTextbox = document.querySelector('.worksheet-textbox.selected');
        const active = document.activeElement;
        const boxFromFocus = active && active.closest ? active.closest('.worksheet-textbox') : null;
        const targetTextbox = selectedTextbox || boxFromFocus;
        if (!targetTextbox) return;

        // Are we actively editing text inside this box?
        const isEditingInsideTarget =
          active &&
          targetTextbox.contains(active) &&
          (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));

        // If actively editing and no modifiers, let typing be typing
        if (isEditingInsideTarget && !e.ctrlKey && !e.metaKey) {
          return;
        }

        // Copy / Cut / Paste at textbox level (only when not editing text)
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !isEditingInsideTarget) {
          switch (e.key.toLowerCase()) {
            case 'c':
              e.preventDefault();
              if (window.worksheetTextbox?.copyTextbox) {
                window.worksheetTextbox.copyTextbox(targetTextbox);
              }
              break;
            case 'x':
              e.preventDefault();
              if (window.worksheetTextbox?.cutTextbox) {
                window.worksheetTextbox.cutTextbox(targetTextbox);
              }
              break;
            case 'v':
              e.preventDefault();
              if (window.worksheetTextbox?.pasteTextbox) {
                window.worksheetTextbox.pasteTextbox();
              }
              break;
          }
        }

        // Delete like a sane app:
        // - Works with Delete and Backspace
        // - Only when not editing text inside the box
        const isDeleteKey =
          e.key === 'Delete' || e.key === 'Backspace' || e.keyCode === 46 || e.keyCode === 8;

        if (isDeleteKey && !isEditingInsideTarget && !e.altKey && !(e.ctrlKey || e.metaKey)) {
          e.preventDefault(); // block browser back nav on Backspace
          if (window.worksheetTextbox && window.worksheetTextbox.deleteTextbox) {
            window.worksheetTextbox.deleteTextbox(targetTextbox);
            if (window.hideTextToolbar) window.hideTextToolbar();
          }
        }
      });
    },

    /**
     * Simple page zoom controls
     * - Fit to Page: scales all pages to fit in viewport
     * - Actual Size: resets to actual size
     * - Visual only, doesn't affect printing
     */
    initializePageZoom: function() {
      const fitButton = document.getElementById('pt-zoom-fit');
      const actualButton = document.getElementById('pt-zoom-actual');
      
      if (!fitButton || !actualButton) return;
      
      // Store current zoom state globally
      window.currentZoomState = {
        mode: 'actual', // 'actual' or 'fit'
        scale: 1
      };
      
      // Function to calculate and apply fit-to-page zoom
      function applyFitToPage() {
        const previewArea = document.getElementById('page-preview-area');
        const pages = document.querySelectorAll('.page-preview-a4');
        if (!previewArea || !pages.length) return;
        
        // Get the container dimensions
        const containerRect = previewArea.getBoundingClientRect();
        const containerWidth = containerRect.width - 60; // Leave more margin for landscape
        const containerHeight = window.innerHeight - 140; // Leave more space for UI
        
        // Get the first page dimensions (recalculate each time to handle orientation changes)
        const firstPage = pages[0];
        // Reset any existing transform to get true dimensions
        const originalTransform = firstPage.style.transform;
        firstPage.style.transform = 'scale(1)';
        
        // Force reflow and get actual dimensions
        firstPage.offsetHeight; // Force reflow
        const pageWidth = firstPage.offsetWidth;
        const pageHeight = firstPage.offsetHeight;
        
        // Check if in landscape mode for debugging
        const isLandscape = firstPage.classList.contains('landscape');
        
        console.log('Zoom calculation:', {
          containerWidth,
          containerHeight,
          pageWidth,
          pageHeight,
          isLandscape,
          orientation: window.worksheetState?.getOrientation?.()
        });
        
        // Calculate scale to fit
        const scaleX = containerWidth / pageWidth;
        const scaleY = containerHeight / pageHeight;
        const scale = Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
        
        console.log('Scale calculation:', { scaleX, scaleY, finalScale: scale });
        
        // Apply transform to all pages
        pages.forEach(page => {
          page.style.transformOrigin = 'center top';
          page.style.transform = `scale(${scale})`;
          page.setAttribute('data-zoom-scale', scale);
        });
        
        // Update global zoom state
        window.currentZoomState = {
          mode: 'fit',
          scale: scale
        };
        
        // Update button states
        fitButton.style.background = '#22d3ee';
        fitButton.style.color = 'white';
        fitButton.style.borderColor = '#22d3ee';
        actualButton.style.background = 'white';
        actualButton.style.color = '#4a5568';
        actualButton.style.borderColor = '#cbd5e0';
      }
      
      // Function to apply actual size
      function applyActualSize() {
        const pages = document.querySelectorAll('.page-preview-a4');
        pages.forEach(page => {
          page.style.transform = 'scale(1)';
          page.setAttribute('data-zoom-scale', '1');
        });
        
        // Update global zoom state
        window.currentZoomState = {
          mode: 'actual',
          scale: 1
        };
        
        // Update button states
        actualButton.style.background = '#22d3ee';
        actualButton.style.color = 'white';
        actualButton.style.borderColor = '#22d3ee';
        fitButton.style.background = 'white';
        fitButton.style.color = '#4a5568';
        fitButton.style.borderColor = '#cbd5e0';
      }
      
      // Function to restore zoom state after page render
      function restoreZoomState() {
        console.log('Restoring zoom state:', window.currentZoomState);
        const pages = document.querySelectorAll('.page-preview-a4');
        if (!pages.length) return;
        
        if (window.currentZoomState.mode === 'fit') {
          // Recalculate fit to account for any changes
          applyFitToPage();
        } else {
          // Apply actual size
          applyActualSize();
        }
      }
      
      // Fit to Page functionality
      fitButton.addEventListener('click', applyFitToPage);
      
      // Actual Size functionality  
      actualButton.addEventListener('click', applyActualSize);
      
      // Set initial state to Actual Size
      actualButton.click();
      
      // Make functions globally available for external triggers
      window.recalculatePageZoom = applyFitToPage;
      window.restoreZoomState = restoreZoomState;
      
      // Add print media query to reset transforms for printing
      if (!document.getElementById('zoom-print-reset')) {
        const printStyle = document.createElement('style');
        printStyle.id = 'zoom-print-reset';
        printStyle.textContent = `
          @media print {
            .page-preview-a4 {
              transform: none !important;
            }
          }
        `;
        document.head.appendChild(printStyle);
      }
    },

    /**
     * Auto-select the page nearest to viewport center
     * - rAF-throttled scroll/resize handler
     */
    initializePageAutoSelection: function () {
      let rafPending = false;

      function autoSelectVisiblePage() {
        rafPending = false;
        const pages = Array.from(document.querySelectorAll('.page-preview-a4'));
        if (!pages.length) return;

        let closest = null;
        let minDist = Infinity;
        const viewportCenter = window.innerHeight / 2;

        for (const page of pages) {
          const rect = page.getBoundingClientRect();
          const pageCenter = rect.top + rect.height / 2;
          const dist = Math.abs(pageCenter - viewportCenter);
          if (dist < minDist) {
            minDist = dist;
            closest = page;
          }
        }

        if (closest && !closest.classList.contains('selected')) {
          document.querySelectorAll('.page-preview-a4.selected').forEach(p => p.classList.remove('selected'));
          closest.classList.add('selected');
        }
      }

      function onScrollOrResize() {
        if (rafPending) return;
        rafPending = true;
        requestAnimationFrame(autoSelectVisiblePage);
      }

      window.addEventListener('scroll', onScrollOrResize, { passive: true });
      window.addEventListener('resize', onScrollOrResize);
      setTimeout(() => onScrollOrResize(), 200);
    },

    /**
     * Burger menu toggle
     */
    initializeBurgerMenu: function () {
      const burgerToggle = document.getElementById('burger-toggle');
      const burgerMenu = document.getElementById('burger-menu');
      if (!burgerToggle || !burgerMenu) return;

      const toggle = () => {
        burgerMenu.style.display = burgerMenu.style.display === 'block' ? 'none' : 'block';
      };

      burgerToggle.addEventListener('click', toggle);

      document.addEventListener('click', (e) => {
        if (e.target !== burgerToggle && !burgerMenu.contains(e.target)) {
          burgerMenu.style.display = 'none';
        }
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') burgerMenu.style.display = 'none';
      });
    },

    /**
     * Add Page button
     */
    initializeAddPageButton: function () {
      const addPageButton = document.getElementById('add-page-text');
      if (!addPageButton) return;

      addPageButton.addEventListener('click', () => {
        if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
          window.worksheetHistory.saveToHistory('add page');
        }
        const pages = window.worksheetState && window.worksheetState.getPages && window.worksheetState.getPages();
        if (pages) pages.push({ boxes: [] });

        if (window.worksheetRender && window.worksheetRender.renderPages) {
          window.worksheetRender.renderPages();
        }
      });
    },

    /**
     * App init: history snapshot, render, toolbars, context menu
     */
    initializeApplication: function () {
      if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
        window.worksheetHistory.saveToHistory('initial state');
      }
      if (window.worksheetRender && window.worksheetRender.renderPages) {
        window.worksheetRender.renderPages();
      }
      if (window.worksheetToolbar) {
        if (window.worksheetToolbar.initializeToolbar) window.worksheetToolbar.initializeToolbar();
        if (window.worksheetToolbar.initializeMenus) window.worksheetToolbar.initializeMenus();
      }
      if (window.worksheetContextMenu && window.worksheetContextMenu.initialize) {
        window.worksheetContextMenu.initialize();
      }
    },

    /**
     * Wire up everything
     */
    initialize: function () {
      this.initializeBorderControls();
      this.initializeKeyboardShortcuts();
      this.initializePageZoom();
      this.initializePageAutoSelection();
      this.initializeBurgerMenu();
      this.initializeAddPageButton();
      this.initializeApplication();
    }
  };

  // Expose module
  window.worksheetEvents = eventModule;
})();
