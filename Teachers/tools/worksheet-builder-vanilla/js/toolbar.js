// toolbar.js - Toolbar & Controls Management

(function() {
  
  // Update toolbar from selected textbox or header
  function updateToolbarFromBox(box) {
    if (!box) return;
    
    // Get references to toolbar elements
    const fontSelect = document.getElementById('pt-font');
    const fontSizeInput = document.getElementById('pt-fontsize');
    const boldBtn = document.getElementById('pt-bold');
    const italicBtn = document.getElementById('pt-italic');
    const underlineBtn = document.getElementById('pt-underline');
    const strikeBtn = document.getElementById('pt-strike');
    const fontColorInput = document.getElementById('pt-fontcolor');
    const lineSpacingInput = document.getElementById('pt-linespacing');
    const borderInput = document.getElementById('pt-border');
    
    // Only update if elements exist
    if (fontSelect) fontSelect.value = box.style.fontFamily.replace(/['\"]/g, '').split(',')[0] || 'Poppins';
    if (fontSizeInput) fontSizeInput.value = parseInt(box.style.fontSize) || 13;
    
    // Text formatting
    if (boldBtn) {
      boldBtn.classList.toggle('active', box.style.fontWeight === 'bold' || box.style.fontWeight >= 700);
      boldBtn.style.fontWeight = '700';
      boldBtn.style.fontStyle = 'normal';
      boldBtn.style.textDecoration = 'none';
    }
    if (italicBtn) {
      italicBtn.classList.toggle('active', box.style.fontStyle === 'italic');
      italicBtn.style.fontWeight = '500';
      italicBtn.style.fontStyle = 'italic';
      italicBtn.style.textDecoration = 'none';
    }
    if (underlineBtn) {
      underlineBtn.classList.toggle('active', box.style.textDecoration && box.style.textDecoration.includes('underline'));
      underlineBtn.style.fontWeight = '500';
      underlineBtn.style.fontStyle = 'normal';
      underlineBtn.style.textDecoration = 'underline';
    }
    if (strikeBtn) {
      strikeBtn.classList.toggle('active', box.style.textDecoration && box.style.textDecoration.includes('line-through'));
      strikeBtn.style.fontWeight = '500';
      strikeBtn.style.fontStyle = 'normal';
      strikeBtn.style.textDecoration = 'line-through';
    }
    
    // Font color
    if (fontColorInput) fontColorInput.value = box.style.color || '#000000';
    
    // Line spacing (removed - will be rebuilt from scratch)
    // if (lineSpacingInput && !window.isUpdatingLineSpacing) {
    //   lineSpacingInput.value = box.style.lineHeight ? parseFloat(box.style.lineHeight) : 1.2;
    // }
    
    // Border color (for both textboxes and headers)
    if (borderInput && (box.classList.contains('worksheet-textbox') || box.classList.contains('worksheet-header'))) {
      let borderColor = '#e1e8ed';
      if (box.style.border) {
        const match = box.style.border.match(/(#[0-9a-fA-F]{3,6}|rgb\([^)]+\))/);
        if (match) borderColor = match[1];
      }
      borderInput.value = borderColor;
    }
    
    // Border weight (for both textboxes and headers)
    const borderWeightInput = document.getElementById('dropdown-borderweight');
    if (borderWeightInput && (box.classList.contains('worksheet-textbox') || box.classList.contains('worksheet-header'))) {
      const borderWeight = box.getAttribute('data-border-width') || '1.5';
      borderWeightInput.value = borderWeight;
    }
  }

  // Update textbox from toolbar values (excluding line spacing - handled by event listener)
  function updateBoxFromToolbar(box) {
    if (!box) return;
    
    const fontSelect = document.getElementById('pt-font');
    const fontSizeInput = document.getElementById('pt-fontsize');
    const fontColorInput = document.getElementById('pt-fontcolor');
    const borderInput = document.getElementById('pt-border');
    
    // Font family
    if (fontSelect) {
      box.style.fontFamily = fontSelect.value;
      if (window.updateBoxData) window.updateBoxData(box, 'fontFamily', fontSelect.value);
    }
    // Font size
    if (fontSizeInput) {
      box.style.fontSize = fontSizeInput.value + 'px';
      if (window.updateBoxData) window.updateBoxData(box, 'fontSize', fontSizeInput.value + 'px');
    }
    // Font color
    if (fontColorInput) {
      box.style.color = fontColorInput.value;
      if (window.updateBoxData) window.updateBoxData(box, 'color', fontColorInput.value);
    }
    // Note: Line spacing is handled by its own event listener to support multi-selection
    // Border color
    if (borderInput) {
      box.style.border = '1.5px solid ' + borderInput.value;
      if (window.updateBoxData) window.updateBoxData(box, 'borderColor', borderInput.value);
    }
  }

  // Vertical alignment function
  function setVAlign(valign) {
    if (window.worksheetState.getLastTextbox()) {
      const lastTextbox = window.worksheetState.getLastTextbox();
      lastTextbox.style.verticalAlign = valign;
      if (valign === 'top') {
        lastTextbox.style.display = '';
        lastTextbox.style.alignItems = '';
        lastTextbox.style.justifyContent = '';
      } else {
        lastTextbox.style.display = 'flex';
        lastTextbox.style.flexDirection = 'column';
        lastTextbox.style.justifyContent = valign === 'middle' ? 'center' : 'flex-end';
        lastTextbox.style.alignItems = 'stretch';
      }
      if (window.updateBoxData) window.updateBoxData(lastTextbox, 'valign', valign);
      updateToolbarFromBox(lastTextbox);
      // Save to history for alignment changes
      if (window.saveToHistory) window.saveToHistory('change vertical alignment');
    }
  }

  // Text alignment function
  function setAlign(align) {
    if (window.worksheetState.getLastTextbox()) {
      const lastTextbox = window.worksheetState.getLastTextbox();
      lastTextbox.style.textAlign = align;
      if (window.updateBoxData) window.updateBoxData(lastTextbox, 'textAlign', align);
      updateToolbarFromBox(lastTextbox);
      // Save to history for alignment changes
      if (window.saveToHistory) window.saveToHistory('change text alignment');
    }
  }

  // Bold formatting toggle
  function toggleBold() {
    const lastTextbox = window.worksheetState.getLastTextbox();
    const selectedHeader = document.querySelector('.worksheet-header.selected');
    const targetElement = lastTextbox || selectedHeader;
    
    if (targetElement) {
      const selection = window.getSelection();
      const hasSelection = selection && !selection.isCollapsed && targetElement.contains(selection.anchorNode);
      
      if (hasSelection) {
        // Apply to selected text using execCommand
        document.execCommand('bold', false, null);
        // Save HTML content to preserve inline formatting
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'html', targetElement.innerHTML);
        }
        // Update button state based on current selection
        setTimeout(() => {
          const isActive = document.queryCommandState('bold');
          const boldBtn = document.getElementById('pt-bold');
          if (boldBtn) boldBtn.classList.toggle('active', isActive);
        }, 10);
      } else {
        // Apply to entire element
        const isBold = targetElement.style.fontWeight === 'bold' || targetElement.style.fontWeight >= 700;
        targetElement.style.fontWeight = isBold ? 'normal' : 'bold';
        const boldBtn = document.getElementById('pt-bold');
        if (boldBtn) boldBtn.classList.toggle('active', !isBold);
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'fontWeight', targetElement.style.fontWeight);
        }
        updateToolbarFromBox(targetElement);
      }
      // Save to history for formatting changes
      if (window.saveToHistory) window.saveToHistory('format text (bold)');
    }
  }

  // Italic formatting toggle
  function toggleItalic() {
    const lastTextbox = window.worksheetState.getLastTextbox();
    const selectedHeader = document.querySelector('.worksheet-header.selected');
    const targetElement = lastTextbox || selectedHeader;
    
    if (targetElement) {
      const selection = window.getSelection();
      const hasSelection = selection && !selection.isCollapsed && targetElement.contains(selection.anchorNode);
      
      if (hasSelection) {
        // Apply to selected text using execCommand
        document.execCommand('italic', false, null);
        // Save HTML content to preserve inline formatting
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'html', targetElement.innerHTML);
        }
        // Update button state based on current selection
        setTimeout(() => {
          const isActive = document.queryCommandState('italic');
          const italicBtn = document.getElementById('pt-italic');
          if (italicBtn) italicBtn.classList.toggle('active', isActive);
        }, 10);
      } else {
        // Apply to entire element
        const isItalic = targetElement.style.fontStyle === 'italic';
        targetElement.style.fontStyle = isItalic ? 'normal' : 'italic';
        const italicBtn = document.getElementById('pt-italic');
        if (italicBtn) italicBtn.classList.toggle('active', !isItalic);
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'fontStyle', targetElement.style.fontStyle);
        }
        updateToolbarFromBox(targetElement);
      }
      // Save to history for formatting changes
      if (window.saveToHistory) window.saveToHistory('format text (italic)');
    }
  }

  // Underline formatting toggle
  function toggleUnderline() {
    const lastTextbox = window.worksheetState.getLastTextbox();
    const selectedHeader = document.querySelector('.worksheet-header.selected');
    const targetElement = lastTextbox || selectedHeader;
    
    if (targetElement) {
      const selection = window.getSelection();
      const hasSelection = selection && !selection.isCollapsed && targetElement.contains(selection.anchorNode);
      if (hasSelection) {
        document.execCommand('underline', false, null);
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'html', targetElement.innerHTML);
        }
        setTimeout(() => {
          const isActive = document.queryCommandState('underline');
          const underlineBtn = document.getElementById('pt-underline');
          if (underlineBtn) underlineBtn.classList.toggle('active', isActive);
        }, 10);
      } else {
        // Toggle underline for the whole element, but preserve any existing strikethrough
        let dec = targetElement.style.textDecoration || '';
        const hasUnderline = dec.includes('underline');
        const hasStrike = dec.includes('line-through');
        let newDec = '';
        if (hasUnderline && hasStrike) newDec = 'line-through';
        else if (!hasUnderline && hasStrike) newDec = 'underline line-through';
        else if (hasUnderline && !hasStrike) newDec = '';
        else newDec = 'underline';
        targetElement.style.textDecoration = newDec.trim() || 'none';
        const underlineBtn = document.getElementById('pt-underline');
        if (underlineBtn) underlineBtn.classList.toggle('active', !hasUnderline);
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'textDecoration', targetElement.style.textDecoration);
        }
        updateToolbarFromBox(targetElement);
      }
      if (window.saveToHistory) window.saveToHistory('format text (underline)');
    }
  }

  // Strikethrough formatting toggle
  function toggleStrike() {
    const lastTextbox = window.worksheetState.getLastTextbox();
    const selectedHeader = document.querySelector('.worksheet-header.selected');
    const targetElement = lastTextbox || selectedHeader;
    
    if (targetElement) {
      const selection = window.getSelection();
      const hasSelection = selection && !selection.isCollapsed && targetElement.contains(selection.anchorNode);
      if (hasSelection) {
        document.execCommand('strikeThrough', false, null);
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'html', targetElement.innerHTML);
        }
        setTimeout(() => {
          const isActive = document.queryCommandState('strikeThrough');
          const strikeBtn = document.getElementById('pt-strike');
          if (strikeBtn) strikeBtn.classList.toggle('active', isActive);
        }, 10);
      } else {
        // Toggle strikethrough for the whole element, but preserve any existing underline
        let dec = targetElement.style.textDecoration || '';
        const hasUnderline = dec.includes('underline');
        const hasStrike = dec.includes('line-through');
        let newDec = '';
        if (hasUnderline && hasStrike) newDec = 'underline';
        else if (!hasUnderline && hasStrike) newDec = '';
        else if (hasUnderline && !hasStrike) newDec = 'underline line-through';
        else newDec = 'line-through';
        targetElement.style.textDecoration = newDec.trim() || 'none';
        const strikeBtn = document.getElementById('pt-strike');
        if (strikeBtn) strikeBtn.classList.toggle('active', !hasStrike);
        if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
          window.updateBoxData(targetElement, 'textDecoration', targetElement.style.textDecoration);
        }
        updateToolbarFromBox(targetElement);
      }
      if (window.saveToHistory) window.saveToHistory('format text (strikethrough)');
    }
  }

  // Initialize toolbar event listeners
  function initializeToolbar() {
    // Get toolbar elements
    const fontSelect = document.getElementById('pt-font');
    const fontSizeInput = document.getElementById('pt-fontsize');
    const fontSizeInc = document.getElementById('pt-fontsize-inc');
    const fontSizeDec = document.getElementById('pt-fontsize-dec');
    const boldBtn = document.getElementById('pt-bold');
    const italicBtn = document.getElementById('pt-italic');
    const underlineBtn = document.getElementById('pt-underline');
    const strikeBtn = document.getElementById('pt-strike');
    const fontColorInput = document.getElementById('pt-fontcolor');
    const lineSpacingInput = document.getElementById('pt-linespacing');
    const borderInput = document.getElementById('pt-border');

    // Update orientation icon after toolbar is initialized
    setTimeout(() => {
      updateOrientationIcon();
    }, 50);

    // Format button event listeners
    if (boldBtn) boldBtn.addEventListener('click', toggleBold);
    if (italicBtn) italicBtn.addEventListener('click', toggleItalic);
    if (underlineBtn) underlineBtn.addEventListener('click', toggleUnderline);
    if (strikeBtn) strikeBtn.addEventListener('click', toggleStrike);

    // Font color input
    if (fontColorInput) {
      fontColorInput.addEventListener('input', function() {
        const lastTextbox = window.worksheetState.getLastTextbox();
        const selectedHeader = document.querySelector('.worksheet-header.selected');
        const targetElement = lastTextbox || selectedHeader;
        
        if (targetElement) {
          const selection = window.getSelection();
          const hasSelection = selection && !selection.isCollapsed && targetElement.contains(selection.anchorNode);
          
          if (hasSelection) {
            // Apply to selected text using execCommand
            document.execCommand('foreColor', false, fontColorInput.value);
            // Save HTML content to preserve inline formatting
            if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
              window.updateBoxData(targetElement, 'html', targetElement.innerHTML);
            }
          } else {
            // Apply to entire element
            targetElement.style.color = fontColorInput.value;
            if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
              window.updateBoxData(targetElement, 'color', fontColorInput.value);
            }
          }
          // Save to history for color changes
          if (window.saveToHistory) window.saveToHistory('change font color');
        }
      });
    }

  // Font family select
  if (fontSelect) {
    fontSelect.addEventListener('change', function() {
      const lastTextbox = window.worksheetState.getLastTextbox();
      const selectedHeader = document.querySelector('.worksheet-header.selected');
      const targetElement = lastTextbox || selectedHeader;
      
      if (targetElement) {
        const selection = window.getSelection();
        const hasSelection = selection && !selection.isCollapsed && targetElement.contains(selection.anchorNode);
        
        if (hasSelection) {
          // Apply to selected text using execCommand
          document.execCommand('fontName', false, fontSelect.value);
          // Save HTML content to preserve inline formatting
          if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
            window.updateBoxData(targetElement, 'html', targetElement.innerHTML);
          }
        } else {
          // Apply to entire element
          targetElement.style.fontFamily = fontSelect.value;
          if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
            window.updateBoxData(targetElement, 'fontFamily', fontSelect.value);
          }
        }
        // Save to history for font changes
        if (window.saveToHistory) window.saveToHistory('change font family');
      }
    });
  }

  // Font size input
  if (fontSizeInput) {
    fontSizeInput.addEventListener('input', function() {
      const lastTextbox = window.worksheetState.getLastTextbox();
      const selectedHeader = document.querySelector('.worksheet-header.selected');
      const targetElement = lastTextbox || selectedHeader;
      
      if (targetElement) {
        const selection = window.getSelection();
        const hasSelection = selection && !selection.isCollapsed && targetElement.contains(selection.anchorNode);
        
        if (hasSelection) {
          // Apply to selected text using execCommand
          document.execCommand('fontSize', false, '7'); // HTML font size (1-7 scale)
          // Then override with exact pixel size using CSS
          const selectedElements = targetElement.querySelectorAll('font[size="7"]');
          selectedElements.forEach(el => {
            el.style.fontSize = fontSizeInput.value + 'px';
            el.removeAttribute('size'); // Remove the HTML size attribute
          });
          // Save HTML content to preserve inline formatting
          if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
            window.updateBoxData(targetElement, 'html', targetElement.innerHTML);
          }
        } else {
          // Apply to entire element
          targetElement.style.fontSize = fontSizeInput.value + 'px';
          if (window.updateBoxData && targetElement.classList.contains('worksheet-textbox')) {
            window.updateBoxData(targetElement, 'fontSize', fontSizeInput.value + 'px');
          }
        }
        // Save to history for font size changes
        if (window.saveToHistory) window.saveToHistory('change font size');
      }
    });
  }

    // Font size increment/decrement buttons
    if (fontSizeInc) {
      fontSizeInc.addEventListener('click', function() {
        if (fontSizeInput) {
          fontSizeInput.value = Math.min(72, parseInt(fontSizeInput.value) + 1);
          fontSizeInput.dispatchEvent(new Event('input'));
        }
      });
    }
    if (fontSizeDec) {
      fontSizeDec.addEventListener('click', function() {
        if (fontSizeInput) {
          fontSizeInput.value = Math.max(8, parseInt(fontSizeInput.value) - 1);
          fontSizeInput.dispatchEvent(new Event('input'));
        }
      });
    }

    // Line spacing input (removed - will be rebuilt from scratch)
    // if (lineSpacingInput) {
    //   lineSpacingInput.addEventListener('input', function() {
    //     // Implementation removed
    //   });
    // }

    // Border color input
    if (borderInput) {
      borderInput.addEventListener('input', function() {
        const lastTextbox = window.worksheetState.getLastTextbox();
        if (lastTextbox) {
          updateBoxFromToolbar(lastTextbox);
          // Save to history for border changes
          if (window.saveToHistory) window.saveToHistory('change border color');
        }
      });
    }

    // Click handlers for textbox and header selection
    document.addEventListener('click', function(e) {
      const box = e.target.closest && e.target.closest('.worksheet-textbox');
      const header = e.target.closest && e.target.closest('.worksheet-header');
      const toolbar = document.getElementById('pastel-toolbar');
      const borderModal = e.target.closest('#border-style-modal');
      
      // If clicking a text box, select it
      if (box) {
        window.worksheetState.setLastTextbox(box);
        
        // Handle multi-selection with Ctrl/Cmd key
        if (e.ctrlKey || e.metaKey) {
          // Toggle selection of this box
          box.classList.toggle('selected');
          // Clear header selections
          document.querySelectorAll('.worksheet-header.selected').forEach(b => b.classList.remove('selected'));
        } else {
          // Single selection - clear all others and select this one
          document.querySelectorAll('.worksheet-textbox.selected, .worksheet-header.selected').forEach(b => b.classList.remove('selected'));
          box.classList.add('selected');
        }
        
        updateToolbarFromBox(box);
        return;
      }
      
      // If clicking a header, select it
      if (header) {
        window.worksheetState.setLastTextbox(null); // Clear textbox selection
        // Remove selected class from all other textboxes and headers
        document.querySelectorAll('.worksheet-textbox.selected, .worksheet-header.selected').forEach(b => b.classList.remove('selected'));
        header.classList.add('selected');
        updateToolbarFromBox(header);
        
        // Ensure header modal opens after a small delay to avoid timing issues
        setTimeout(() => {
          if (window.openHeaderModal) {
            console.log('Opening header modal from toolbar.js handler');
            window.openHeaderModal();
          }
        }, 10);
        return;
      }
      
      // If clicking the pastel toolbar or border modal or their children, do NOT deselect
      if ((toolbar && (toolbar === e.target || toolbar.contains(e.target))) ||
          borderModal) {
        return;
      }
      
      // Otherwise, deselect all textboxes and headers
      document.querySelectorAll('.worksheet-textbox.selected, .worksheet-header.selected').forEach(b => b.classList.remove('selected'));
      window.worksheetState.setLastTextbox(null);
    });

    // Focus handlers for textbox selection
    document.addEventListener('focusin', function(e) {
      const box = e.target.closest && e.target.closest('.worksheet-textbox');
      if (box) {
        window.worksheetState.setLastTextbox(box);
        updateToolbarFromBox(box);
      }
    });
  }

  // Initialize menu systems
  function initializeMenus() {
    // Load and setup burger menu
    fetch('/Teachers/components/burger-menu.html')
      .then(r => r.text())
      .then(burgerHtml => {
        // Insert the template into the DOM if not already present
        if (!document.getElementById('burger-menu-template')) {
          const div = document.createElement('div');
          div.innerHTML = burgerHtml;
          document.body.appendChild(div.firstElementChild);
        }
        if (window.insertBurgerMenu) window.insertBurgerMenu('#toolbar-mount');

        // Load File menu
        fetch('/Teachers/components/file_menu.html')
          .then(r => r.text())
          .then(html => {
            const fileMenuMount = document.getElementById('file-menu-mount');
            // Insert the file menu component at the beginning
            fileMenuMount.insertAdjacentHTML('afterbegin', html);

            // Add More button next to File button
            const fileMenuWrapper = fileMenuMount.querySelector('.file-menu-wrapper');
            if (fileMenuWrapper) {
              const moreMenuHtml = `
                <div class="action-link more-menu dropdown" tabindex="0" style="position:relative;display:inline-block;margin-left:16px;">
                  <span class="file-menu-btn" style="font-weight:500;color:#333a44;cursor:pointer;font-family:'Poppins',sans-serif;">More</span>
                  <div class="dropdown-content file-menu-dropdown" style="display:none;position:absolute;left:0;top:100%;background:#fff;min-width:160px;border-radius:0 0 8px 8px;box-shadow:0 8px 32px 0 rgba(60,60,80,0.18);border:1px solid #e1e8ed;z-index:10000;font-family:'Poppins',sans-serif;">
                    <a class="file-menu-item" href="#" id="help-link">Help</a>
                    <a class="file-menu-item" href="#" id="about-link">About</a>
                  </div>
                </div>
              `;
              fileMenuWrapper.insertAdjacentHTML('afterend', moreMenuHtml);
            }

            // Setup File menu dropdown
            const fileBtn = fileMenuMount.querySelector('.file-menu-btn');
            const fileDropdown = fileMenuMount.querySelector('.file-menu-dropdown');
            // Change File button color to dark grey
            if (fileBtn) {
              fileBtn.style.color = '#333a44';
            }
            
            if (fileBtn && fileDropdown) {

              fileBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                // Hide border modal if open
                var borderModal = document.getElementById('border-style-modal');
                if (borderModal && borderModal.style.display !== 'none') {
                  borderModal.style.display = 'none';
                }
                // Close all dropdowns first
                document.querySelectorAll('.dropdown-content').forEach(function(d) { d.style.display = 'none'; });
                fileDropdown.style.display = fileDropdown.style.display === 'block' ? 'none' : 'block';
              });
              
              // Hide dropdown on click outside
              document.addEventListener('mousedown', function hideFileDropdown(e) {
                if (fileDropdown.style.display === 'block' && !fileDropdown.contains(e.target) && e.target !== fileBtn) {
                  fileDropdown.style.display = 'none';
                }
              });
            }

            // Setup More menu dropdown
            function setupDropdown(menuSelector) {
              var menu = document.querySelector(menuSelector);
              if (!menu) return;
              var btn = menu.querySelector('.file-menu-btn');
              var dropdown = menu.querySelector('.dropdown-content');
              if (btn && dropdown) {
                btn.addEventListener('click', function(e) {
                  e.stopPropagation();
              // Hide border modal if open
              var borderModal = document.getElementById('border-style-modal');
              if (borderModal && borderModal.style.display !== 'none') {
                borderModal.style.display = 'none';
              }
              var isOpen = dropdown.style.display === 'block';
                  // Close all dropdowns first
                  document.querySelectorAll('.dropdown-content').forEach(function(d) { d.style.display = 'none'; });
                  dropdown.style.display = isOpen ? 'none' : 'block';
                });
              }
            }
            setupDropdown('.more-menu');

            // Close dropdowns on outside click
            document.addEventListener('mousedown', function(e) {
              if (!e.target.closest('.file-menu-wrapper') && !e.target.closest('.more-menu')) {
                document.querySelectorAll('.dropdown-content').forEach(function(d) { d.style.display = 'none'; });
              }
            });

            // Load page settings modal
            initializePageSettingsModal(fileDropdown);
          });
      });
  }

  // Initialize page settings modal
  function initializePageSettingsModal(fileDropdown) {
    fetch('/Teachers/components/page_settings_modal.html')
      .then(r => r.text())
      .then(modalHtml => {
        document.getElementById('page-settings-modal-mount').innerHTML = modalHtml;

        // Wire up Page Settings menu item
        var pageSettingsBtn = document.getElementById('file-menu-page-settings');
        var modal = document.getElementById('page-settings-modal');

        // Default global if not set
        if (typeof window.snapToCenterGuides === 'undefined') {
          window.snapToCenterGuides = true;
        }

        if (pageSettingsBtn && modal) {
          pageSettingsBtn.onclick = function(e) {
            e.preventDefault();
            modal.style.display = 'flex';
            fileDropdown.style.display = 'none';

            // Sync modal radio to current orientation
            var portraitRadio = modal.querySelector('input[name="page-orientation"][value="portrait"]');
            var landscapeRadio = modal.querySelector('input[name="page-orientation"][value="landscape"]');
            if (portraitRadio && landscapeRadio) {
              if (window.worksheetState.getOrientation() === 'landscape') {
                landscapeRadio.checked = true;
                portraitRadio.checked = false;
              } else {
                portraitRadio.checked = true;
                landscapeRadio.checked = false;
              }
            }

            // Sync snap-to-center-guides checkbox to global
            var snapToggle = modal.querySelector('#snap-center-guides-toggle');
            if (snapToggle) {
              snapToggle.checked = !!window.snapToCenterGuides;
            }
          };
        }

        // Modal close logic
        var closeBtn = document.getElementById('close-page-settings');
        if (closeBtn) {
          closeBtn.onclick = function() {
            modal.style.display = 'none';
          };
        }

        // Save button: set orientation, snap toggle, and close modal
        var saveBtn = document.getElementById('save-page-settings');
        if (saveBtn) {
          saveBtn.onclick = function() {
            const newOrientation = modal.querySelector('input[name="page-orientation"]:checked').value;
            if (newOrientation !== window.worksheetState.getOrientation()) {
              // Save to history for orientation changes
              if (window.saveToHistory) window.saveToHistory('change page orientation');
              window.worksheetState.setOrientation(newOrientation);
              if (window.renderPages) window.renderPages();
              // Update orientation icon in toolbar
              updateOrientationIcon();
            }
            // Save snap-to-center-guides toggle
            var snapToggle = modal.querySelector('#snap-center-guides-toggle');
            if (snapToggle) {
              window.snapToCenterGuides = !!snapToggle.checked;
            }
            modal.style.display = 'none';
          };
        }

        // Click outside modal closes it
        modal.addEventListener('click', function(e) {
          if (e.target === modal) modal.style.display = 'none';
        });
      });
  }

  // Global alignment function for dropdown system
  function setAlignmentGlobal(type, value) {
    const lastTextbox = window.worksheetState.getLastTextbox();
    if (lastTextbox) {
      if (type === 'h') {
        lastTextbox.style.textAlign = value;
        if (window.updateBoxData) window.updateBoxData(lastTextbox, 'textAlign', value);
        // Save to history for alignment changes
        if (window.saveToHistory) window.saveToHistory('change text alignment');
      } else if (type === 'v') {
        setVAlign(value);
      }
    }
  }

  // Update orientation icon when orientation changes
  function updateOrientationIcon() {
    const orientationIcon = document.getElementById('pt-orientation-icon');
    const orientationBtn = document.getElementById('pt-orientation-btn');
    
    if (!orientationIcon || !orientationBtn) return;
    
    // Define icons for portrait and landscape
    const portraitIcon = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="5" y="2" width="10" height="16" rx="1.5" stroke="#4a5568" stroke-width="2" fill="none"/>
        <circle cx="10" cy="15" r="1" fill="#4a5568"/>
      </svg>
    `;
    
    const landscapeIcon = `
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="5" width="16" height="10" rx="1.5" stroke="#4a5568" stroke-width="2" fill="none"/>
        <circle cx="15" cy="10" r="1" fill="#4a5568"/>
      </svg>
    `;
    
    if (window.worksheetState && window.worksheetState.getOrientation) {
      const currentOrientation = window.worksheetState.getOrientation();
      orientationIcon.innerHTML = currentOrientation === 'landscape' ? landscapeIcon : portraitIcon;
      orientationBtn.title = `Switch to ${currentOrientation === 'landscape' ? 'Portrait' : 'Landscape'}`;
    }
  }

  // Create the global toolbar object
  window.worksheetToolbar = {
    updateToolbarFromBox,
    updateBoxFromToolbar,
    setVAlign,
    setAlign,
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleStrike,
    initializeToolbar,
    initializeMenus,
    setAlignmentGlobal,
    updateOrientationIcon
  };

  // Make functions globally available for backward compatibility
  window.updateToolbarFromBox = updateToolbarFromBox;
  window.setAlign = setAlignmentGlobal;
  window.setVAlign = setVAlign;
  window.updateOrientationIcon = updateOrientationIcon;

  // ===========================================
  // NEW LINE SPACING SYSTEM - REBUILT FROM SCRATCH
  // ===========================================
  
  function initializeLineSpacing() {
    console.log('Initializing new line spacing system...');
    const lineSpacingInput = document.getElementById('pt-linespacing');
    
    if (!lineSpacingInput) {
      console.error('Line spacing input not found!');
      return;
    }
    
    lineSpacingInput.addEventListener('input', function(e) {
      console.log('Line spacing changed to:', e.target.value);
      
      // Get all selected textboxes
      const selectedTextboxes = document.querySelectorAll('.worksheet-textbox.selected');
      let targetTextboxes = Array.from(selectedTextboxes);
      
      // If no textboxes are selected, use the last focused one
      if (targetTextboxes.length === 0) {
        const lastTextbox = window.worksheetState?.getLastTextbox();
        if (lastTextbox && lastTextbox.classList.contains('worksheet-textbox')) {
          targetTextboxes = [lastTextbox];
        }
      }
      
      console.log('Target textboxes:', targetTextboxes.length);
      
      // Apply line spacing to all target textboxes
      targetTextboxes.forEach((textbox, index) => {
        textbox.style.setProperty('line-height', e.target.value, 'important');
        console.log(`Applied line-height ${e.target.value} to textbox ${index + 1}`);
        
        // Update data model
        if (window.updateBoxData) {
          window.updateBoxData(textbox, 'lineHeight', e.target.value);
        }
      });
      
      // Save to history
      if (window.saveToHistory) {
        window.saveToHistory('change line spacing');
      }
    });
    
    console.log('Line spacing system initialized successfully');
  }
  
  // Initialize the new line spacing system when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    // Small delay to ensure all other components are loaded
    setTimeout(initializeLineSpacing, 100);
  });
  
  // Also initialize if DOM is already loaded
  if (document.readyState === 'loading') {
    // Will be handled by DOMContentLoaded event above
  } else {
    setTimeout(initializeLineSpacing, 100);
  }
})();
