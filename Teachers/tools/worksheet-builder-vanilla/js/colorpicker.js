// colorpicker.js - iro.js Color Picker Integration with Tailwind Palette

(function() {
  
  // Tailwind CSS color palette (selected colors)
  const tailwindColors = [
    '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB', '#F3F4F6', '#FFFFFF',
    '#7F1D1D', '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2', '#FEF2F2',
    '#92400E', '#D97706', '#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#FEF3C7', '#FFFBEB',
    '#365314', '#65A30D', '#84CC16', '#A3E635', '#BEF264', '#D9F99D', '#ECFCCB', '#F7FFEE',
    '#064E3B', '#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5', '#ECFDF5',
    '#0F766E', '#0D9488', '#14B8A6', '#5EEAD4', '#99F6E4', '#CCFBF1', '#F0FDFA', '#F7FEFC',
    '#0C4A6E', '#0284C7', '#0EA5E9', '#38BDF8', '#7DD3FC', '#BAE6FD', '#E0F2FE', '#F0F9FF',
    '#1E3A8A', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE', '#EFF6FF',
    '#581C87', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD', '#DDD6FE', '#EDE9FE', '#F5F3FF',
    '#86198F', '#C026D3', '#D946EF', '#E879F9', '#F0ABFC', '#F8BBD9', '#FCE7F3', '#FDF4FF',
    '#9F1239', '#E11D48', '#F43F5E', '#FB7185', '#FDA4AF', '#FECDD3', '#FEE2E2', '#FFF1F2'
  ];

  let fontColorPicker = null;
  let borderColorPicker = null;
  let fillColorPicker = null;

  // Helper function to create color swatches
  function createColorSwatches(container, onColorSelect) {
    container.innerHTML = '';
    tailwindColors.forEach(color => {
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: ${color};
        border: 1px solid #e1e8ed;
        border-radius: 4px;
        cursor: pointer;
        transition: transform 0.1s;
      `;
      // Prevent swatch clicks from deselecting the textbox
      swatch.addEventListener('mousedown', e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      });
      swatch.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onColorSelect(color);
      });
      swatch.addEventListener('mouseenter', () => {
        swatch.style.transform = 'scale(1.1)';
      });
      swatch.addEventListener('mouseleave', () => {
        swatch.style.transform = 'scale(1)';
      });
      container.appendChild(swatch);
    });
    // Prevent container clicks from bubbling up
    container.addEventListener('mousedown', e => e.stopPropagation());
    container.addEventListener('click', e => e.stopPropagation());
  }

  // Helper function to close all color pickers
  function closeAllColorPickers() {
    const pickers = [
      'pt-fontcolor-picker',
      'modal-border-color-picker', 
      'modal-fill-color-picker'
    ];
    pickers.forEach(id => {
      const picker = document.getElementById(id);
      if (picker) {
        picker.style.display = 'none';
        
        // If font color picker was moved to body, restore it to original container
        if (id === 'pt-fontcolor-picker' && picker.parentElement === document.body) {
          const container = document.getElementById('pt-fontcolor-container');
          if (container) {
            container.appendChild(picker);
            picker.style.position = '';
            picker.style.left = '';
            picker.style.top = '';
            picker.style.zIndex = '15000';
          }
        }
      }
    });
  }

  // Close pickers when clicking outside
  document.addEventListener('click', (e) => {
    // Don't close if clicking on color picker elements
    const isColorPickerClick = e.target.closest('[id$="-color-container"], [id$="-color-picker"], [id$="-color-preview"]') ||
                              e.target.closest('.worksheet-textbox');
    if (!isColorPickerClick) {
      closeAllColorPickers();
    }
  });

  // Initialize font color picker
  function initializeFontColorPicker() {
    console.log('Initializing font color picker...');
    const preview = document.getElementById('pt-fontcolor-preview');
    const picker = document.getElementById('pt-fontcolor-picker');
    const container = document.getElementById('pt-fontcolor-container');
    
    console.log('Font color elements:', { preview, picker, container });
    
    if (!preview || !picker || !container) {
      console.error('Font color picker elements not found!');
      return;
    }

    // Create swatches
    const swatchContainer = picker.querySelector('div[style*="grid-template-columns"]');
    console.log('Swatch container:', swatchContainer);
    
    if (swatchContainer) {
      createColorSwatches(swatchContainer, (color) => {
        console.log('Font color selected:', color);
        updateFontColor(color);
        closeAllColorPickers();
      });
      console.log('Color swatches created successfully');
    }

    // Show/hide picker on preview click
    preview.addEventListener('mousedown', e => e.stopPropagation());
    preview.addEventListener('click', (e) => {
      console.log('Font color preview clicked');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeAllColorPickers();
      const isVisible = picker.style.display === 'block';
      
      if (isVisible) {
        picker.style.display = 'none';
        // Reset to original parent if moved
        if (picker.parentElement === document.body && container) {
          container.appendChild(picker);
          picker.style.position = '';
          picker.style.left = '';
          picker.style.top = '';
          picker.style.zIndex = '15000';
        }
      } else {
        // Move picker to body to ensure it appears above all modals
        document.body.appendChild(picker);
        
        // Position relative to the preview button
        const rect = preview.getBoundingClientRect();
        picker.style.position = 'fixed';
        picker.style.left = rect.left + 'px';
        picker.style.top = (rect.bottom + 5) + 'px';
        picker.style.zIndex = '100000'; // Higher than any modal
        picker.style.display = 'block';
      }
      console.log('Font color picker visibility:', picker.style.display);
    });
    
    // Also stop propagation on the picker itself
    picker.addEventListener('mousedown', e => e.stopPropagation());
    picker.addEventListener('click', e => e.stopPropagation());
    
    console.log('Font color picker initialized successfully');
  }

  // Initialize border color picker
  function initializeBorderColorPicker() {
    const preview = document.getElementById('modal-border-color-preview');
    const picker = document.getElementById('modal-border-color-picker');
    
    if (!preview || !picker) {
      console.log('Border color picker elements not found');
      return;
    }

    // Create swatches
    const swatchContainer = document.getElementById('modal-border-color-swatches');
    console.log('Border swatch container:', swatchContainer);
    
    if (swatchContainer) {
      createColorSwatches(swatchContainer, (color) => {
        console.log('Border color selected:', color);
        updateBorderColor(color);
        closeAllColorPickers();
      });
      console.log('Border color swatches created successfully');
    }

    // Show/hide picker on preview click
    preview.addEventListener('mousedown', e => e.stopPropagation());
    preview.addEventListener('click', (e) => {
      console.log('Border color preview clicked');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeAllColorPickers();
      const isVisible = picker.style.display === 'block';
      picker.style.display = isVisible ? 'none' : 'block';
      console.log('Border color picker visibility:', picker.style.display);
    });
    
    // Also stop propagation on the picker itself
    picker.addEventListener('mousedown', e => e.stopPropagation());
    picker.addEventListener('click', e => e.stopPropagation());
  }

  // Initialize fill color picker
  function initializeFillColorPicker() {
    const preview = document.getElementById('modal-fill-color-preview');
    const picker = document.getElementById('modal-fill-color-picker');
    
    if (!preview || !picker) {
      console.log('Fill color picker elements not found');
      return;
    }

    // Create swatches
    const swatchContainer = document.getElementById('modal-fill-color-swatches');
    console.log('Fill swatch container:', swatchContainer);
    
    if (swatchContainer) {
      createColorSwatches(swatchContainer, (color) => {
        console.log('Fill color selected:', color);
        updateFillColor(color);
        closeAllColorPickers();
      });
      console.log('Fill color swatches created successfully');
    }

    // Show/hide picker on preview click
    preview.addEventListener('mousedown', e => e.stopPropagation());
    preview.addEventListener('click', (e) => {
      console.log('Fill color preview clicked');
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeAllColorPickers();
      const isVisible = picker.style.display === 'block';
      picker.style.display = isVisible ? 'none' : 'block';
      console.log('Fill color picker visibility:', picker.style.display);
    });
    
    // Also stop propagation on the picker itself
    picker.addEventListener('mousedown', e => e.stopPropagation());
    picker.addEventListener('click', e => e.stopPropagation());
  }

  // Update font color
  function updateFontColor(color) {
    console.log('Updating font color to:', color);
    const preview = document.getElementById('pt-fontcolor-preview');
    if (preview) {
      preview.style.backgroundColor = color;
    }

    // Find the active textbox - prioritize .selected class
    let selectedTextbox = document.querySelector('.worksheet-textbox.selected');
    
    // If no selected textbox, try focus or lastTextbox state
    if (!selectedTextbox) {
      selectedTextbox = document.querySelector('.worksheet-textbox:focus') ||
                       (window.worksheetState && window.worksheetState.getLastTextbox()) ||
                       document.activeElement;
    }
    
    // Last resort: find any textbox, but prefer the most recently created one
    if (!selectedTextbox || !selectedTextbox.classList.contains('worksheet-textbox')) {
      const allTextboxes = document.querySelectorAll('.worksheet-textbox');
      selectedTextbox = allTextboxes[allTextboxes.length - 1];
    }
    
    console.log('Selected textbox:', selectedTextbox);
    
    if (selectedTextbox && selectedTextbox.classList.contains('worksheet-textbox')) {
      console.log('Applying color to textbox');
      selectedTextbox.style.color = color;
      
      // Also apply to any selected text if there is any
      if (window.getSelection) {
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if (selectedTextbox.contains(range.commonAncestorContainer)) {
            document.execCommand('foreColor', false, color);
          }
        }
      }
      
      // Save to history if available
      if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
        window.worksheetHistory.saveToHistory('change font color');
      }
    } else {
      console.log('No textbox found to apply color to');
    }
  }

  // Update border color
  function updateBorderColor(color) {
    console.log('Updating border color to:', color);
    const preview = document.getElementById('modal-border-color-preview');
    if (preview) {
      preview.style.backgroundColor = color;
    }

    // Find the active textbox - prioritize .selected class
    let selectedTextbox = document.querySelector('.worksheet-textbox.selected');
    
    // If no selected textbox, try focus or lastTextbox state
    if (!selectedTextbox) {
      selectedTextbox = document.querySelector('.worksheet-textbox:focus') ||
                       (window.worksheetState && window.worksheetState.getLastTextbox()) ||
                       document.activeElement;
    }
    
    // Last resort: find any textbox, but prefer the most recently created one
    if (!selectedTextbox || !selectedTextbox.classList.contains('worksheet-textbox')) {
      const allTextboxes = document.querySelectorAll('.worksheet-textbox');
      selectedTextbox = allTextboxes[allTextboxes.length - 1];
    }
    
    console.log('Selected textbox for border:', selectedTextbox);
    
    if (selectedTextbox && selectedTextbox.classList.contains('worksheet-textbox')) {
      console.log('Applying border color to textbox');
      selectedTextbox.setAttribute('data-border-color', color);
      const borderOn = selectedTextbox.getAttribute('data-border-on') !== 'false';
      if (borderOn) {
        selectedTextbox.style.borderColor = color;
      }
      
      // Save to history if available
      if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
        window.worksheetHistory.saveToHistory('change border color');
      }
    } else if (selectedTextbox && selectedTextbox.classList.contains('worksheet-header')) {
      console.log('Applying border color to header');
      selectedTextbox.setAttribute('data-border-color', color);
      const borderOn = selectedTextbox.getAttribute('data-border-on') !== 'false';
      if (borderOn) {
        selectedTextbox.style.borderColor = color;
      }
      
      // Save to history if available
      if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
        window.worksheetHistory.saveToHistory('change header border color');
      }
    } else {
      console.log('No textbox or header found to apply border color to');
    }
  }

  // Update fill color
  function updateFillColor(color) {
    console.log('Updating fill color to:', color);
    const preview = document.getElementById('modal-fill-color-preview');
    if (preview) {
      preview.style.backgroundColor = color;
    }

    // Find the active textbox - prioritize .selected class
    let selectedTextbox = document.querySelector('.worksheet-textbox.selected');
    
    // If no selected textbox, try focus or lastTextbox state
    if (!selectedTextbox) {
      selectedTextbox = document.querySelector('.worksheet-textbox:focus') ||
                       (window.worksheetState && window.worksheetState.getLastTextbox()) ||
                       document.activeElement;
    }
    
    // Last resort: find any textbox, but prefer the most recently created one
    if (!selectedTextbox || !selectedTextbox.classList.contains('worksheet-textbox')) {
      const allTextboxes = document.querySelectorAll('.worksheet-textbox');
      selectedTextbox = allTextboxes[allTextboxes.length - 1];
    }
    
    console.log('Selected textbox for fill:', selectedTextbox);
    
    if (selectedTextbox && selectedTextbox.classList.contains('worksheet-textbox')) {
      console.log('Applying fill color to textbox');
      selectedTextbox.setAttribute('data-fill-color', color);
      const fillOn = selectedTextbox.getAttribute('data-fill-on') === 'true';
      if (fillOn) {
        const fillOpacity = parseFloat(selectedTextbox.getAttribute('data-fill-opacity')) || 1;
        // Convert hex to rgba
        let c = color.replace('#', '');
        if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
        const num = parseInt(c, 16);
        selectedTextbox.style.backgroundColor = `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${fillOpacity})`;
      }
      
      // Save to history if available
      if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
        window.worksheetHistory.saveToHistory('change fill color');
      }
    } else {
      console.log('No textbox found to apply fill color to');
    }
  }

  // Update color picker values when textbox selection changes
  function updateColorPickersFromSelection(textbox) {
    if (!textbox) return;

    // Update font color picker
    const fontColor = textbox.style.color || '#5EEAD4';
    const fontPreview = document.getElementById('pt-fontcolor-preview');
    if (fontPreview) {
      fontPreview.style.backgroundColor = fontColor;
    }
    if (fontColorPicker) {
      fontColorPicker.color.hexString = fontColor;
    }

    // Update border color picker
    const borderColor = textbox.getAttribute('data-border-color') || '#e1e8ed';
    const borderPreview = document.getElementById('modal-border-color-preview');
    if (borderPreview) {
      borderPreview.style.backgroundColor = borderColor;
    }
    if (borderColorPicker) {
      borderColorPicker.color.hexString = borderColor;
    }

    // Update fill color picker
    const fillColor = textbox.getAttribute('data-fill-color') || '#ffffff';
    const fillPreview = document.getElementById('modal-fill-color-preview');
    if (fillPreview) {
      fillPreview.style.backgroundColor = fillColor;
    }
    if (fillColorPicker) {
      fillColorPicker.color.hexString = fillColor;
    }
  }

  // Initialize all color pickers
  function initialize() {
    console.log('Initializing color pickers...');
    
    // Initialize font color picker immediately (don't wait for iro.js)
    initializeFontColorPicker();
    
    // Listen for textbox selection changes
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('worksheet-textbox')) {
        setTimeout(() => updateColorPickersFromSelection(e.target), 10);
      }
    });
    
    console.log('Color picker initialization complete');
  }

  // Initialize border and fill pickers when modal is opened
  function initializeModalPickers() {
    console.log('Initializing modal color pickers...');
    
    // Check if modal elements exist before initializing
    if (document.getElementById('modal-border-color-preview')) {
      initializeBorderColorPicker();
    }
    
    if (document.getElementById('modal-fill-color-preview')) {
      initializeFillColorPicker();
    }
  }

  // Export functions
  window.worksheetColorPicker = {
    initialize,
    initializeModalPickers,
    updateColorPickersFromSelection,
    updateFontColor,
    updateBorderColor,
    updateFillColor
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
