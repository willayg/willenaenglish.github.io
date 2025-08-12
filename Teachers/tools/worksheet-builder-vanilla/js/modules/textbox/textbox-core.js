// textbox-core.js
// Core textbox creation and basic styling logic

(function() {
  // Configuration constants
  const CONFIG = {
    MIN_WIDTH: 120,             // Minimum textbox width
    MIN_HEIGHT: 40,             // Minimum textbox height  
    DEFAULT_HEIGHT: 400         // Default textbox height
  };

  function createTextboxElement(boxData) {
    const box = document.createElement('div');
    box.className = 'worksheet-textbox' + (boxData.text && boxData.text.trim() === '' ? ' empty' : '');
    box.contentEditable = true;
    box.setAttribute('data-placeholder', 'Type here...');
    box.style.position = 'absolute';
    box.style.left = boxData.left;
    box.style.top = boxData.top;
    
    // Set actual width/height if specified, but use consistent minimums
    if (boxData.width) {
      box.style.width = boxData.width;
      box.style.minWidth = CONFIG.MIN_WIDTH + 'px'; // Always use consistent minimum
    } else {
      box.style.minWidth = CONFIG.MIN_WIDTH + 'px';
    }
    
    // Set minHeight for usability, and set initial height from boxData (default height)
    box.style.minHeight = CONFIG.MIN_HEIGHT + 'px';
    const defaultHeight = CONFIG.DEFAULT_HEIGHT + 'px';
    box.style.height = boxData.height || defaultHeight;
    
    // Store initial height for consistent auto-resize behavior
    // This prevents the minimum height from shrinking when user manually resizes
    if (!boxData.initialHeight) {
      boxData.initialHeight = boxData.height || defaultHeight;
    }
    
    box.style.padding = '8px 12px';
    box.style.background = '#fff';
    
    // Set data attributes for border controls
    box.setAttribute('data-border-on', (boxData.borderOn !== undefined ? boxData.borderOn : false).toString());
    box.setAttribute('data-border-color', boxData.borderColor || '#e1e8ed');
    box.setAttribute('data-border-width', (boxData.borderWeight !== undefined ? boxData.borderWeight : 1.5).toString());
    box.setAttribute('data-border-radius', (boxData.borderRadius !== undefined ? boxData.borderRadius : 4).toString());
    
    // Set data attributes for fill controls
    box.setAttribute('data-fill-on', (boxData.fillOn !== undefined ? boxData.fillOn : false).toString());
    box.setAttribute('data-fill-color', boxData.fillColor || '#ffffff');
    box.setAttribute('data-fill-opacity', (boxData.fillOpacity !== undefined ? boxData.fillOpacity : 1).toString());
    
    // Apply fill if enabled
    if (boxData.fillOn) {
      const fillColor = boxData.fillColor || '#ffffff';
      const fillOpacity = boxData.fillOpacity !== undefined ? boxData.fillOpacity : 1;
      // Convert hex to rgba
      let c = fillColor.replace('#', '');
      if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
      const num = parseInt(c, 16);
      box.style.backgroundColor = `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${fillOpacity})`;
    }
    
    // Only apply border if borderOn is true
    if (boxData.borderOn) {
      box.style.borderStyle = 'solid';
      box.style.borderWidth = (boxData.borderWeight !== undefined ? boxData.borderWeight : 1.5) + 'px';
      box.style.setProperty('border-color', boxData.borderColor || '#e1e8ed', 'important');
    } else {
      box.style.border = 'none';
      box.style.borderWidth = '0px';
      box.style.borderStyle = 'none';
    }
    
    box.style.borderRadius = (typeof boxData.borderRadius !== 'undefined' ? boxData.borderRadius : 4) + 'px';
    box.style.fontFamily = (boxData.fontFamily || 'Poppins');
    box.style.fontSize = (boxData.fontSize || '13px');
    box.style.color = (boxData.color || '#3d3752');
    box.style.fontWeight = (boxData.fontWeight || 'normal');
    box.style.fontStyle = (boxData.fontStyle || 'normal');
    box.style.textDecoration = (boxData.textDecoration || 'none');
    box.style.textAlign = (boxData.textAlign || 'left');
    
    // Apply line spacing with !important to override any CSS conflicts
    if (boxData.lineHeight) {
      box.style.setProperty('line-height', boxData.lineHeight, 'important');
    } else {
      box.style.setProperty('line-height', '1.8', 'important'); // Default line spacing
    }
    
    box.style.cursor = 'default';
    box.style.boxShadow = 'none';
    box.style.zIndex = 20;
    box.style.resize = 'none';
    box.style.overflow = 'visible';
    
    // Vertical alignment
    if (boxData.valign === 'top' || !boxData.valign) {
      box.style.display = '';
      box.style.alignItems = '';
      box.style.justifyContent = '';
    } else {
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.justifyContent = boxData.valign === 'middle' ? 'center' : 'flex-end';
      box.style.alignItems = 'stretch';
    }
    
    // Use innerHTML to preserve inline formatting, fallback to innerText
    if (boxData.html) {
      box.innerHTML = boxData.html;
    } else {
      box.innerText = boxData.text;
    }
    
    return box;
  }
  
  window.textboxCore = { createTextboxElement };
})();
