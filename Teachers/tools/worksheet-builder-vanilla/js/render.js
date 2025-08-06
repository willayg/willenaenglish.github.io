// render.js - UI Rendering Management

(function() {
  // Render individual header
  function renderHeader(headerData, a4) {
    const headerDiv = document.createElement('div');
    headerDiv.className = 'worksheet-header';
    headerDiv.setAttribute('contenteditable', 'true');
    headerDiv.setAttribute('spellcheck', 'false');
    
    // Set border data attributes (default to no border for headers)
    headerDiv.setAttribute('data-border-on', (headerData.borderOn !== undefined ? headerData.borderOn : false).toString());
    headerDiv.setAttribute('data-border-color', headerData.borderColor || '#e1e8ed');
    headerDiv.setAttribute('data-border-width', (headerData.borderWeight !== undefined ? headerData.borderWeight : 1.5).toString());
    headerDiv.setAttribute('data-border-radius', (headerData.borderRadius !== undefined ? headerData.borderRadius : 4).toString());
    
    // Set header-specific data attributes for sync function
    headerDiv.setAttribute('data-header-style', headerData.style || 'basic');
    headerDiv.setAttribute('data-header-title', headerData.title || 'Worksheet Title');
    headerDiv.setAttribute('data-header-logo-src', headerData.logoSrc || '../../../../Assets/Images/color-logo.png');
    
    // Generate header HTML based on saved data using centralized templates
    const { style, title, logoSrc } = headerData;
    
    // Use centralized header templates
    const headerHTML = window.headerTemplates 
      ? window.headerTemplates.generateHTML(style, title, logoSrc)
      : `<div style="padding:16px;border-bottom:1px solid #e1e8ed;display:flex;align-items:center;">
          <img src="${logoSrc}" alt="Logo" style="height:32px;margin-right:8px;">
          <span style="font-size:1.1em;font-weight:600;font-family:Poppins,sans-serif;white-space:nowrap;">${title}</span>
          <div style="margin-left:auto;font-size:0.95em;color:#666;font-family:Poppins,sans-serif;white-space:nowrap;">Name: ______ Date: ______</div>
        </div>`;
    
    headerDiv.innerHTML = headerHTML.replace(/\n/g, '');
    
    // Apply border styles if enabled
    if (headerData.borderOn) {
      headerDiv.style.border = `${headerData.borderWeight || 1.5}px solid ${headerData.borderColor || '#e1e8ed'}`;
      headerDiv.style.borderRadius = `${headerData.borderRadius || 4}px`;
    } else {
      headerDiv.style.border = 'none';
    }
    
    // Make header selectable for toolbar and open header modal on click
    headerDiv.addEventListener('click', function(e) {
      // Prevent event bubbling to avoid conflicts with document click handler
      e.stopPropagation();
      
      // Remove selected from other headers
      document.querySelectorAll('.worksheet-header.selected').forEach(h => h.classList.remove('selected'));
      headerDiv.classList.add('selected');
      if (window.updateToolbarFromBox) window.updateToolbarFromBox(headerDiv);

      // Always open header modal when clicking header
      if (window.openHeaderModal) {
        console.log('Opening header modal from render.js click handler');
        window.openHeaderModal();
      }
    });
    
    return headerDiv;
  }

  // Main page rendering function
  function renderPages() {
    // Don't sync here - only sync when explicitly saving to history
    // syncAllTextboxesToDataModel();
    
    const area = document.getElementById('page-preview-area');
    area.innerHTML = '';
    window.worksheetState.getPages().forEach((pageData, idx) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'page-preview-wrapper';
      if (idx === window.worksheetState.getPages().length - 1) wrapper.style.marginBottom = '16px';
      else wrapper.style.marginBottom = '8px';
      const a4 = document.createElement('div');
      a4.className = 'page-preview-a4' + (window.worksheetState.getOrientation() === 'landscape' ? ' landscape' : '');
      a4.style.position = 'relative';
      // Allow page selection
      a4.addEventListener('click', function(e) {
        if (e.target.closest('.page-controls')) return;
        document.querySelectorAll('.page-preview-a4.selected').forEach(p => p.classList.remove('selected'));
        a4.classList.add('selected');
      });

      // Add + and - icons at the top, shown on hover
      const controls = document.createElement('div');
      controls.className = 'page-controls';
      controls.style.position = 'absolute';
      controls.style.top = '8px';
      controls.style.right = '16px';
      controls.style.display = 'flex';
      controls.style.gap = '8px';
      controls.style.opacity = '0';
      controls.style.transition = 'opacity 0.2s';

      // + icon (SVG)
      const plus = document.createElement('button');
      plus.title = 'Add page after';
      plus.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="8" fill="#fff" stroke="#e1e8ed" stroke-width="1.5"/><path d="M9 5.5V12.5" stroke="#4a5568" stroke-width="1.5" stroke-linecap="round"/><path d="M5.5 9H12.5" stroke="#4a5568" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      plus.style.background = 'none';
      plus.style.border = 'none';
      plus.style.padding = '0';
      plus.style.cursor = 'pointer';
      plus.style.transition = 'transform 0.15s, box-shadow 0.15s';
      plus.onmouseenter = () => { plus.style.transform = 'scale(1.12)'; plus.style.boxShadow = '0 4px 16px 0 rgba(60,60,80,0.18)'; };
      plus.onmouseleave = () => { plus.style.transform = 'scale(1)'; plus.style.boxShadow = 'none'; };
      plus.onclick = (e) => {
        e.stopPropagation();
        if (window.saveToHistory) window.saveToHistory('add page');
        window.worksheetState.getPages().splice(idx + 1, 0, { boxes: [] });
        renderPages();
      };

      // - icon (SVG)
      const minus = document.createElement('button');
      minus.title = 'Delete this page';
      minus.innerHTML = `<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="8" fill="#fff" stroke="#e1e8ed" stroke-width="1.5"/><path d="M5.5 9H12.5" stroke="#c53030" stroke-width="1.5" stroke-linecap="round"/></svg>`;
      minus.style.background = 'none';
      minus.style.border = 'none';
      minus.style.padding = '0';
      minus.style.cursor = 'pointer';
      minus.style.transition = 'transform 0.15s, box-shadow 0.15s';
      minus.onmouseenter = () => { minus.style.transform = 'scale(1.12)'; minus.style.boxShadow = '0 4px 16px 0 rgba(197,48,48,0.18)'; };
      minus.onmouseleave = () => { minus.style.transform = 'scale(1)'; minus.style.boxShadow = 'none'; };
      minus.onclick = (e) => {
        e.stopPropagation();
        if (window.worksheetState.getPages().length > 1) {
          if (window.saveToHistory) window.saveToHistory('delete page');
          window.worksheetState.getPages().splice(idx, 1);
          renderPages();
        }
      };

      controls.appendChild(plus);
      controls.appendChild(minus);
      a4.appendChild(controls);

      // Show controls on hover/scroll near top
      a4.addEventListener('mouseenter', () => {
        controls.style.opacity = '1';
      });
      a4.addEventListener('mouseleave', () => {
        controls.style.opacity = '0';
      });

      // Render header for this page if it exists
      if (pageData.header) {
        const headerDiv = renderHeader(pageData.header, a4);
        a4.insertBefore(headerDiv, a4.firstChild);
      }

      // Render all text boxes for this page
      if (Array.isArray(pageData.boxes)) {
        pageData.boxes.forEach((boxData, boxIdx) => {
          const box = renderTextbox(boxData, a4, pageData);
          a4.appendChild(box);
        });
      }

      // (Removed page number at the bottom)
      wrapper.appendChild(a4);
      area.appendChild(wrapper);
      setTimeout(() => {
        if (!document.querySelector('.page-preview-a4.selected')) {
          const first = document.querySelector('.page-preview-a4');
          if (first) first.classList.add('selected');
        }
      }, 0);
    });
    
    // Update orientation icon after pages are rendered
    setTimeout(() => {
      if (window.updateOrientationIcon) {
        window.updateOrientationIcon();
      }
    }, 10);
  }

  // Render individual textbox
  function renderTextbox(boxData, a4, pageData) {
    const box = document.createElement('div');
    box.className = 'worksheet-textbox' + (boxData.text.trim() === '' ? ' empty' : '');
    box.contentEditable = true;
    
    // Use innerHTML to preserve inline formatting, fallback to innerText
    if (boxData.html) {
      box.innerHTML = boxData.html;
    } else {
      box.innerText = boxData.text;
    }
    
    box.setAttribute('data-placeholder', 'Type here...');
    box.style.position = 'absolute';
    box.style.left = boxData.left;
    box.style.top = boxData.top;
    
    // Set actual width/height if specified, but use consistent minimums
    if (boxData.width) {
      box.style.width = boxData.width;
      box.style.minWidth = '120px'; // Always use consistent minimum
    } else {
      box.style.minWidth = '120px';
    }
    
    // Set minHeight for usability, and set initial height from boxData (default 400px)
    box.style.minHeight = '40px';
    box.style.height = boxData.height || '400px';
    
    box.style.padding = '8px 12px';
    box.style.background = '#fff';
    
    // Set data attributes for border controls
    box.setAttribute('data-border-on', (boxData.borderOn !== undefined ? boxData.borderOn : true).toString());
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
    
    // Always apply border thickness, color, and radius, even for empty boxes
    if (boxData.borderOn || box.classList.contains('empty')) {
      box.style.borderStyle = 'solid';
      box.style.borderWidth = (boxData.borderWeight !== undefined ? boxData.borderWeight : 1.5) + 'px';
      box.style.borderColor = boxData.borderColor || '#e1e8ed';
    } else {
      box.style.border = 'none';
    }
    box.style.borderRadius = (typeof boxData.borderRadius !== 'undefined' ? boxData.borderRadius : 4) + 'px';
    box.style.fontFamily = (boxData.fontFamily || 'Poppins');
    box.style.fontSize = (boxData.fontSize || '16px');
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
    box.style.cursor = 'move';
    box.style.boxShadow = 'none';
    box.style.zIndex = 20;
    box.style.resize = 'none';
    box.style.overflow = 'auto';
    
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

    // Add event listeners for textbox functionality
    setupTextboxEvents(box, boxData, a4);
    
    return box;
  }

  // Setup event listeners for textbox
  function setupTextboxEvents(box, boxData, a4) {
    // --- Auto-resize height based on content ---
    function autoResizeHeight() {
      // Only shrink to the initial/default height, not below
      const min = parseInt(boxData.height || 400);
      box.style.height = 'auto';
      let newHeight = box.scrollHeight + 4;
      if (newHeight < min) newHeight = min;
      box.style.height = newHeight + 'px';
      // Update data model with new height
      boxData.height = box.style.height;
    }

    // Enable Ctrl+V (paste), Ctrl+Z (undo), Ctrl+Y (redo) in textboxes
    box.addEventListener('keydown', function(e) {
      // Paste (Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        // Let browser handle paste (contenteditable default)
        // Optionally, you could add custom paste logic here
        return;
      }
      // Undo (Ctrl+Z)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        document.execCommand('undo');
        e.preventDefault();
        return;
      }
      // Redo (Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        document.execCommand('redo');
        e.preventDefault();
        return;
      }
    });
    // Drag and resize logic (all four edges and corners)
    let offsetX, offsetY, dragging = false;
    let resizingRight = false, resizingBottom = false, resizingDiagonal = false, resizingLeft = false, resizingTop = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let prevWidth = null, prevHeight = null;

    // Helper: set user-select CSS
    function setUserSelect(editing) {
      if (editing) {
        box.style.userSelect = '';
      } else {
        box.style.userSelect = 'none';
      }
    }

    // Canva-style: first click selects/drags, second click enables editing
    let isSelected = false;
    let lastClickTime = 0;

    // Helper to enter drag/select mode
    function enterDragSelectMode() {
      box.contentEditable = false;
      setUserSelect(false);
      box.classList.add('selected');
    }
    // Helper to enter edit mode
    function enterEditMode() {
      box.contentEditable = true;
      setUserSelect(true);
      box.classList.remove('selected');
      setTimeout(() => {
        box.focus();
      }, 0);
    }

    box.addEventListener('mousedown', function(e) {
      prevWidth = box.offsetWidth;
      prevHeight = box.offsetHeight;
      
      // Only allow drag/resize if not editing
      if (box.contentEditable === 'false') {
        // Prevent text selection and default behavior immediately
        e.preventDefault();
        setUserSelect(false);
        document.body.style.userSelect = 'none';
        
        // Edge/corner detection for resize
        const right = box.offsetWidth - (e.offsetX || 0);
        const bottom = box.offsetHeight - (e.offsetY || 0);
        
        // Diagonal (bottom-right corner)
        if (right < 18 && bottom < 18) {
          resizingDiagonal = true;
          startX = e.clientX;
          startY = e.clientY;
          startWidth = box.offsetWidth;
          startHeight = box.offsetHeight;
          return;
        }
        // Right edge
        if (right < 18 && bottom >= 18 && e.offsetY > 0 && e.offsetY < box.offsetHeight - 18) {
          resizingRight = true;
          startX = e.clientX;
          startWidth = box.offsetWidth;
          return;
        }
        // Bottom edge
        if (bottom < 18 && right >= 18 && e.offsetX > 0 && e.offsetX < box.offsetWidth - 18) {
          resizingBottom = true;
          startY = e.clientY;
          startHeight = box.offsetHeight;
          return;
        }
        // Left edge
        if (e.offsetX < 18 && bottom >= 18 && e.offsetY > 0 && e.offsetY < box.offsetHeight - 18) {
          resizingLeft = true;
          startX = e.clientX;
          startWidth = box.offsetWidth;
          startLeft = box.offsetLeft;
          return;
        }
        // Top edge
        if (e.offsetY < 18 && right >= 18 && e.offsetX > 0 && e.offsetX < box.offsetWidth - 18) {
          resizingTop = true;
          startY = e.clientY;
          startHeight = box.offsetHeight;
          startTop = box.offsetTop;
          return;
        }
        // Otherwise, drag
        dragging = true;
        offsetX = e.clientX - box.offsetLeft;
        offsetY = e.clientY - box.offsetTop;
      }
    });

    // Toggle between select/drag and edit mode on click
    box.addEventListener('click', function(e) {
      if (box.contentEditable === 'true') return; // Already editing
      enterEditMode();
    });

    // On first render, set to select/drag mode
    enterDragSelectMode();
    isSelected = true;

    // Deselect on click outside
    document.addEventListener('mousedown', function(e) {
      if (e.target !== box && box.contentEditable === 'true') {
        // Reset to drag/select mode when clicking off
        enterDragSelectMode();
        box.blur();
      }
    });

    // Also restore drag/select mode on blur (if not already in drag/select mode)
    box.addEventListener('blur', function() {
      if (box.contentEditable === 'true') {
        // If blur happens while editing, restore drag/select mode
        enterDragSelectMode();
      }
      box.style.cursor = 'move';
      updatePlaceholder();
      // Don't remove selected class on blur - let the toolbar click handler manage selection
    });

    // Change cursor on mousemove for resize zones
    box.addEventListener('mousemove', function(e) {
      if (box.contentEditable === 'true') {
        box.style.cursor = 'text';
        return;
      }
      
      // In drag/select mode, only show resize cursors at the very edges
      const right = box.offsetWidth - (e.offsetX || 0);
      const bottom = box.offsetHeight - (e.offsetY || 0);
      const left = e.offsetX || 0;
      const top = e.offsetY || 0;
      
      // Check for resize zones (18px from edges)
      if (right < 18 && bottom < 18) {
        box.style.cursor = 'se-resize';
      } else if (right < 18 && bottom >= 18 && top > 18) {
        box.style.cursor = 'e-resize';
      } else if (bottom < 18 && right >= 18 && left > 18) {
        box.style.cursor = 's-resize';
      } else if (left < 18 && bottom >= 18 && top > 18) {
        box.style.cursor = 'w-resize';
      } else if (top < 18 && right >= 18 && left > 18) {
        box.style.cursor = 'n-resize';
      } else {
        // Always use move cursor in the center area, regardless of text content
        box.style.cursor = 'move';
      }
    });
    // Restore cursor on mouseleave
    box.addEventListener('mouseleave', function() {
      box.style.cursor = (document.activeElement === box ? 'text' : 'move');
    });

    document.addEventListener('mousemove', function(e) {
      if (resizingDiagonal) {
        let newWidth = startWidth + (e.clientX - startX);
        let newHeight = startHeight + (e.clientY - startY);
        if (newWidth < 120) newWidth = 120;
        if (newHeight < 40) newHeight = 40;
        box.style.width = newWidth + 'px';
        box.style.height = newHeight + 'px';
        boxData.width = box.style.width;
        boxData.height = box.style.height;
        return;
      }
      if (resizingRight) {
        let newWidth = startWidth + (e.clientX - startX);
        if (newWidth < 120) newWidth = 120;
        box.style.width = newWidth + 'px';
        boxData.width = box.style.width;
        return;
      }
      if (resizingBottom) {
        let newHeight = startHeight + (e.clientY - startY);
        if (newHeight < 40) newHeight = 40;
        box.style.height = newHeight + 'px';
        boxData.height = box.style.height;
        return;
      }
      if (resizingLeft) {
        let dx = e.clientX - startX;
        let newWidth = startWidth - dx;
        let newLeft = startLeft + dx;
        if (newWidth < 120) {
          newLeft -= (120 - newWidth);
          newWidth = 120;
        }
        box.style.width = newWidth + 'px';
        box.style.left = newLeft + 'px';
        boxData.width = box.style.width;
        boxData.left = box.style.left;
        return;
      }
      if (resizingTop) {
        let dy = e.clientY - startY;
        let newHeight = startHeight - dy;
        let newTop = startTop + dy;
        if (newHeight < 40) {
          newTop -= (40 - newHeight);
          newHeight = 40;
        }
        box.style.height = newHeight + 'px';
        box.style.top = newTop + 'px';
        boxData.height = box.style.height;
        boxData.top = box.style.top;
        return;
      }
      if (!dragging) return;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      const rect = a4.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      x = Math.max(0, Math.min(x, rect.width - boxRect.width));
      y = Math.max(0, Math.min(y, rect.height - boxRect.height));

      let snappedX = x, snappedY = y;
      let snapV = false, snapH = false;
      if (window.snapToCenterGuides) {
        // Calculate centers
        const pageCenterX = rect.width / 2;
        const pageCenterY = rect.height / 2;
        const boxCenterX = x + boxRect.width / 2;
        const boxCenterY = y + boxRect.height / 2;
        // Snap threshold in px
        const threshold = 12;
        // Vertical (x) center
        if (Math.abs(boxCenterX - pageCenterX) < threshold) {
          snappedX = pageCenterX - boxRect.width / 2;
          vGuide = showGuide('v', pageCenterX);
          snapV = true;
        } else {
          if (vGuide) vGuide.style.display = 'none';
        }
        // Horizontal (y) center
        if (Math.abs(boxCenterY - pageCenterY) < threshold) {
          snappedY = pageCenterY - boxRect.height / 2;
          hGuide = showGuide('h', pageCenterY);
          snapH = true;
        } else {
          if (hGuide) hGuide.style.display = 'none';
        }
      } else {
        hideGuides();
      }
      box.style.left = snappedX + 'px';
      box.style.top = snappedY + 'px';
      // Update data
      boxData.left = box.style.left;
      boxData.top = box.style.top;
    });

    document.addEventListener('mouseup', function() {
      if (resizingDiagonal || resizingRight || resizingBottom || resizingLeft || resizingTop) {
        // Save to history after resizing
        if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
          window.worksheetHistory.saveToHistory('resize textbox');
        }
      }
      resizingDiagonal = false;
      resizingRight = false;
      resizingBottom = false;
      resizingLeft = false;
      resizingTop = false;
      if (dragging) {
        // Save to history after dragging (moving textbox)
        if (window.saveToHistory) window.saveToHistory('move textbox');
      }
      dragging = false;
      box.style.userSelect = '';
      document.body.style.userSelect = '';
      hideGuides();
    });

    // --- Center Snap Guides ---
    let vGuide = null, hGuide = null;
    function showGuide(type, pos) {
      let guide = document.getElementById('center-' + type + '-guide');
      if (!guide) {
        guide = document.createElement('div');
        guide.id = 'center-' + type + '-guide';
        guide.style.position = 'absolute';
        guide.style.zIndex = 1000;
        guide.style.pointerEvents = 'none';
        guide.style.background = 'none';
        guide.style.opacity = '0.22';
        guide.style.border = 'none';
        if (type === 'v') {
          guide.style.width = '0';
          guide.style.height = '100%';
          guide.style.left = pos + 'px';
          guide.style.top = 0;
          guide.style.borderLeft = '2px dashed #8b8bff';
        } else {
          guide.style.height = '0';
          guide.style.width = '100%';
          guide.style.top = pos + 'px';
          guide.style.left = 0;
          guide.style.borderTop = '2px dashed #8b8bff';
        }
        a4.appendChild(guide);
      } else {
        if (type === 'v') guide.style.left = pos + 'px';
        else guide.style.top = pos + 'px';
        guide.style.display = 'block';
      }
      return guide;
    }
    function hideGuides() {
      ['center-v-guide', 'center-h-guide'].forEach(id => {
        const g = document.getElementById(id);
        if (g) g.style.display = 'none';
      });
    }

    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;
      const rect = a4.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();
      x = Math.max(0, Math.min(x, rect.width - boxRect.width));
      y = Math.max(0, Math.min(y, rect.height - boxRect.height));

      let snappedX = x, snappedY = y;
      let snapV = false, snapH = false;
      if (window.snapToCenterGuides) {
        // Calculate centers
        const pageCenterX = rect.width / 2;
        const pageCenterY = rect.height / 2;
        const boxCenterX = x + boxRect.width / 2;
        const boxCenterY = y + boxRect.height / 2;
        // Snap threshold in px
        const threshold = 12;
        // Vertical (x) center
        if (Math.abs(boxCenterX - pageCenterX) < threshold) {
          snappedX = pageCenterX - boxRect.width / 2;
          vGuide = showGuide('v', pageCenterX);
          snapV = true;
        } else {
          if (vGuide) vGuide.style.display = 'none';
        }
        // Horizontal (y) center
        if (Math.abs(boxCenterY - pageCenterY) < threshold) {
          snappedY = pageCenterY - boxRect.height / 2;
          hGuide = showGuide('h', pageCenterY);
          snapH = true;
        } else {
          if (hGuide) hGuide.style.display = 'none';
        }
      } else {
        hideGuides();
      }
      box.style.left = snappedX + 'px';
      box.style.top = snappedY + 'px';
      // Update data
      boxData.left = box.style.left;
      boxData.top = box.style.top;
    });

    document.addEventListener('mouseup', function() {
      if (dragging) {
        // Save to history after dragging (moving textbox)
        if (window.saveToHistory) window.saveToHistory('move textbox');
      }
      dragging = false;
      box.style.userSelect = '';
      document.body.style.userSelect = '';
      hideGuides();
    });
    
    // Only update size if the box was actually resized
    box.addEventListener('mouseup', function() {
      if (box.offsetWidth !== prevWidth || box.offsetHeight !== prevHeight) {
        // Update data model with new dimensions, but don't set minWidth/minHeight to current size
        boxData.width = box.offsetWidth + 'px';
        boxData.height = box.offsetHeight + 'px';
        
        // Keep reasonable minimum sizes for usability, but allow shrinking
        const minWidth = 120; // pixels
        const minHeight = 40; // pixels
        
        // Only update the actual CSS if we're below reasonable minimums
        if (box.offsetWidth < minWidth) {
          box.style.minWidth = minWidth + 'px';
          boxData.width = minWidth + 'px';
        }
        if (box.offsetHeight < minHeight) {
          box.style.minHeight = minHeight + 'px';
          boxData.height = minHeight + 'px';
        }
        
        // Save to history after resizing
        if (window.worksheetHistory && window.worksheetHistory.saveToHistory) {
          window.worksheetHistory.saveToHistory('resize textbox');
        }
      }
    });
    
    // Show placeholder if empty
    function updatePlaceholder() {
      if (box.innerText.trim() === '') {
        box.classList.add('empty');
      } else {
        box.classList.remove('empty');
      }
    }
    
    box.addEventListener('input', function() {
      boxData.text = box.innerText;
      boxData.html = box.innerHTML; // Preserve HTML formatting
      updatePlaceholder();
      autoResizeHeight();
      // Debounced history save for text changes
      if (window.worksheetState.getDebouncedSaveTextHistory) {
        window.worksheetState.getDebouncedSaveTextHistory()();
      }
    });

    // Initial auto-resize on render
    setTimeout(autoResizeHeight, 0);
    
    // Save font family and other style changes to data model
    box.addEventListener('DOMSubtreeModified', function() {
      if (box.style.fontFamily) {
        boxData.fontFamily = box.style.fontFamily;
      }
      if (box.style.fontSize) {
        boxData.fontSize = box.style.fontSize;
      }
    });
    
    // Inline toolbar integration
    box.addEventListener('focus', function() {
      window.worksheetState.setLastTextbox(box);
      box.style.cursor = 'text';
      updatePlaceholder();
      if (window.updateToolbarFromBox) window.updateToolbarFromBox(box);
      if (window.showTextToolbar) window.showTextToolbar(box);
    });
    
    // Also show toolbar on click (for mouse users who don't focus)
    box.addEventListener('click', function() {
      window.worksheetState.setLastTextbox(box);
      if (window.updateToolbarFromBox) window.updateToolbarFromBox(box);
      if (window.showTextToolbar) window.showTextToolbar(box);
    });
    
    // Context menu for text box operations
    box.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      if (window.showTextboxContextMenu) {
        window.showTextboxContextMenu(e, box);
      }
    });
    
    box.addEventListener('blur', function() {
      box.style.cursor = 'move';
      updatePlaceholder();
      // Don't remove selected class on blur - let the toolbar click handler manage selection
    });
    
    updatePlaceholder();
  }

  // Sync DOM textboxes back to data model
  function syncAllTextboxesToDataModel() {
    // For each page
    const pageEls = document.querySelectorAll('.page-preview-a4');
    pageEls.forEach((pageEl, pageIdx) => {
      const boxEls = pageEl.querySelectorAll('.worksheet-textbox');
      const headerEl = pageEl.querySelector('.worksheet-header');
      
      // Ensure the page exists in data model
      if (!window.worksheetState.getPages()[pageIdx]) {
        window.worksheetState.getPages()[pageIdx] = { boxes: [] };
      }
      
      // Update existing boxes and remove any extras from data model
      window.worksheetState.getPages()[pageIdx].boxes = [];
      
      // Sync textboxes
      boxEls.forEach((boxEl, boxIdx) => {
        // Create or update box data from current DOM state
        const boxData = {
          text: boxEl.innerText || '',
          html: boxEl.innerHTML || '',
          left: boxEl.style.left || '0px',
          top: boxEl.style.top || '0px',
          width: boxEl.style.width || boxEl.offsetWidth + 'px',
          height: boxEl.style.height || boxEl.offsetHeight + 'px',
          borderOn: boxEl.getAttribute('data-border-on') === 'true' || true,
          borderColor: boxEl.getAttribute('data-border-color') || '#e1e8ed',
          borderWeight: parseFloat(boxEl.getAttribute('data-border-width')) || 1.5,
          borderRadius: parseInt(boxEl.getAttribute('data-border-radius')) || 4,
          fillOn: boxEl.getAttribute('data-fill-on') === 'true' || false,
          fillColor: boxEl.getAttribute('data-fill-color') || '#ffffff',
          fillOpacity: parseFloat(boxEl.getAttribute('data-fill-opacity')) || 1,
          fontFamily: boxEl.style.fontFamily || 'Poppins',
          fontSize: boxEl.style.fontSize || '16px',
          color: boxEl.style.color || '#3d3752',
          fontWeight: boxEl.style.fontWeight || 'normal',
          fontStyle: boxEl.style.fontStyle || 'normal',
          textDecoration: boxEl.style.textDecoration || 'none',
          textAlign: boxEl.style.textAlign || 'left',
          lineHeight: boxEl.style.lineHeight || '1.8', // Restored with new system
          valign: boxEl.style.justifyContent === 'center' ? 'middle' : 
                  boxEl.style.justifyContent === 'flex-end' ? 'bottom' : 'top'
        };
        
        window.worksheetState.getPages()[pageIdx].boxes.push(boxData);
      });
      
      // Sync header if present
      if (headerEl && window.worksheetState.getPages()[pageIdx]) {
        window.worksheetState.getPages()[pageIdx].header = {
          style: headerEl.getAttribute('data-header-style') || window.worksheetState.getPages()[pageIdx].header?.style || 'basic',
          title: headerEl.getAttribute('data-header-title') || window.worksheetState.getPages()[pageIdx].header?.title || 'Worksheet Title',
          logoSrc: headerEl.getAttribute('data-header-logo-src') || window.worksheetState.getPages()[pageIdx].header?.logoSrc || '../../../../Assets/Images/color-logo.png',
          borderOn: headerEl.getAttribute('data-border-on') === 'true',
          borderColor: headerEl.getAttribute('data-border-color') || '#e1e8ed',
          borderWeight: parseFloat(headerEl.getAttribute('data-border-width')) || 1.5,
          borderRadius: parseInt(headerEl.getAttribute('data-border-radius')) || 4
        };
      }
    });
  }

  // Add page function
  function addPage() {
    if (window.saveToHistory) window.saveToHistory('add page');
    window.worksheetState.getPages().push({ boxes: [] });
    renderPages();
    // Ensure orientation icon is updated after adding page
    setTimeout(() => {
      if (window.updateOrientationIcon) {
        window.updateOrientationIcon();
      }
    }, 50);
  }

  // Create the global rendering object
  window.worksheetRender = {
    renderPages,
    renderTextbox,
    setupTextboxEvents,
    syncAllTextboxesToDataModel,
    addPage
  };

  // Make functions globally available for backward compatibility
  window.renderPages = renderPages;
  window.syncAllTextboxesToDataModel = syncAllTextboxesToDataModel;
  window.addPage = addPage;
})();
