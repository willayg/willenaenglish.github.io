// textbox-render.js - Renders and manages worksheet textboxes (fixed & consolidated)

(function() {
  // Render individual textbox
  function renderTextbox(boxData, a4, pageData) {
    const box = document.createElement('div');
    box.className = 'worksheet-textbox' + (boxData.text?.trim() === '' ? ' empty' : '');
    box.contentEditable = 'true';

    // --- External selection frame (Canva-style) ---
    const selectionFrame = document.createElement('div');
    selectionFrame.className = 'textbox-selection-frame';
    selectionFrame.style.position = 'absolute';
    selectionFrame.style.display = 'none';
    selectionFrame.style.pointerEvents = 'none';
    selectionFrame.style.border = '2px solid #4299e1';
    selectionFrame.style.borderRadius = '4px';
    selectionFrame.style.zIndex = 1001;
    selectionFrame.style.background = 'transparent';
    selectionFrame.style.fontSize = '0';
    selectionFrame.style.lineHeight = '0';
    selectionFrame.style.overflow = 'visible';

    // --- Corner resize handles on the selection frame ---
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
      handle.style.cursor =
        corner === 'nw' ? 'nw-resize' :
        corner === 'ne' ? 'ne-resize' :
        corner === 'sw' ? 'sw-resize' : 'se-resize';

      if (corner.includes('n')) handle.style.top = '-6px';
      if (corner.includes('s')) handle.style.bottom = '-6px';
      if (corner.includes('w')) handle.style.left = '-6px';
      if (corner.includes('e')) handle.style.right = '-6px';

      let resizing = false;
      let startX, startY, startWidth, startHeight, startLeft, startTop;

      handle.addEventListener('mousedown', function(e) {
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

        function onMouseMove(e2) {
          if (!resizing) return;
          const dx = e2.clientX - startX;
          const dy = e2.clientY - startY;

          if (corner === 'se') {
            let w = startWidth + dx;
            let h = startHeight + dy;
            if (w < 120) w = 120;
            if (h < 40) h = 40;
            box.style.width = w + 'px';
            box.style.height = h + 'px';
          } else if (corner === 'sw') {
            let w = startWidth - dx;
            let h = startHeight + dy;
            let l = startLeft + dx;
            if (w < 120) {
              l -= (120 - w);
              w = 120;
            }
            if (h < 40) h = 40;
            box.style.width = w + 'px';
            box.style.height = h + 'px';
            box.style.left = l + 'px';
          } else if (corner === 'ne') {
            let w = startWidth + dx;
            let h = startHeight - dy;
            let t = startTop + dy;
            if (w < 120) w = 120;
            if (h < 40) {
              t -= (40 - h);
              h = 40;
            }
            box.style.width = w + 'px';
            box.style.height = h + 'px';
            box.style.top = t + 'px';
          } else if (corner === 'nw') {
            let w = startWidth - dx;
            let h = startHeight - dy;
            let l = startLeft + dx;
            let t = startTop + dy;
            if (w < 120) {
              l -= (120 - w);
              w = 120;
            }
            if (h < 40) {
              t -= (40 - h);
              h = 40;
            }
            box.style.width = w + 'px';
            box.style.height = h + 'px';
            box.style.left = l + 'px';
            box.style.top = t + 'px';
          }

          // Update data model
          boxData.width = box.style.width;
          boxData.height = box.style.height;
          boxData.left = box.style.left;
          boxData.top = box.style.top;

          updateHandlePosition();
          updateSelectionFrame();
        }

        function onMouseUp() {
          resizing = false;
          box.classList.remove('resizing');
          document.body.style.userSelect = '';
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          updateSelectionFrame();
          (window.saveToHistory || window?.worksheetHistory?.saveToHistory)?.('resize textbox');
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });

      selectionFrame.appendChild(handle);
    });

    // --- One-time CSS injections (clean styling + print) ---
    if (!document.getElementById('worksheet-textbox-clean-style')) {
      const style = document.createElement('style');
      style.id = 'worksheet-textbox-clean-style';
      style.innerHTML = `
        .worksheet-textbox:focus { outline: none !important; box-shadow: none !important; }
        .worksheet-textbox:hover { box-shadow: none !important; }
        .worksheet-textbox.selected { box-shadow: none !important; }
        .textbox-selection-frame { transition: opacity 0.2s ease; font-size: 0 !important; line-height: 0 !important; }
        .textbox-selection-frame *, .resize-handle { font-size: 0 !important; line-height: 0 !important; }
        @media print {
          .canva-move-handle { display: none !important; }
          .textbox-selection-frame { display: none !important; }
          .resize-handle { display: none !important; }
        }
      `;
      document.head.appendChild(style);
    }
    if (!document.getElementById('canva-move-handle-fade-style')) {
      const style = document.createElement('style');
      style.id = 'canva-move-handle-fade-style';
      style.innerHTML = `.canva-move-handle{transition:opacity .3s;opacity:0;pointer-events:none}.canva-move-handle.visible{opacity:1;pointer-events:auto}`;
      document.head.appendChild(style);
    }

    // Preserve inline formatting
    if (boxData.html) box.innerHTML = boxData.html;
    else box.innerText = boxData.text || '';

    // --- Base geometry & look ---
    box.setAttribute('data-placeholder', 'Type here...');
    box.style.position = 'absolute';
    box.style.left = boxData.left || '0px';
    box.style.top = boxData.top || '0px';
    if (boxData.width) {
      box.style.width = boxData.width;
      box.style.minWidth = '120px';
    } else {
      box.style.minWidth = '120px';
    }
    box.style.minHeight = '40px';
    box.style.height = boxData.height || '400px';
    box.style.padding = '8px 12px';
    box.style.background = '#fff';

    // Border data attrs
    box.setAttribute('data-border-on', (boxData.borderOn ?? false).toString());
    box.setAttribute('data-border-color', boxData.borderColor || '#e1e8ed');
    box.setAttribute('data-border-width', (boxData.borderWeight ?? 1.5).toString());
    box.setAttribute('data-border-radius', (boxData.borderRadius ?? 4).toString());

    // Fill data attrs
    box.setAttribute('data-fill-on', (boxData.fillOn ?? false).toString());
    box.setAttribute('data-fill-color', boxData.fillColor || '#ffffff');
    box.setAttribute('data-fill-opacity', (boxData.fillOpacity ?? 1).toString());

    // Apply fill if enabled
    if (boxData.fillOn) {
      const fillColor = boxData.fillColor || '#ffffff';
      const op = (boxData.fillOpacity ?? 1);
      let c = fillColor.replace('#', '');
      if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
      const num = parseInt(c, 16);
      box.style.backgroundColor = `rgba(${(num>>16)&255},${(num>>8)&255},${num&255},${op})`;
    }

    // Borders
    if (boxData.borderOn) {
      box.style.borderStyle = 'solid';
      box.style.borderWidth = (boxData.borderWeight ?? 1.5) + 'px';
      box.style.setProperty('border-color', boxData.borderColor || '#e1e8ed', 'important');
    } else {
      box.style.border = 'none';
      box.style.borderWidth = '0px';
      box.style.borderStyle = 'none';
    }

    // Typography & alignment
    box.style.borderRadius = (boxData.borderRadius ?? 4) + 'px';
    box.style.fontFamily = (boxData.fontFamily || 'Poppins');
    box.style.fontSize = (boxData.fontSize || '16px');
    box.style.color = (boxData.color || '#3d3752');
    box.style.fontWeight = (boxData.fontWeight || 'normal');
    box.style.fontStyle = (boxData.fontStyle || 'normal');
    box.style.textDecoration = (boxData.textDecoration || 'none');
    box.style.textAlign = (boxData.textAlign || 'left');
    box.style.setProperty('line-height', boxData.lineHeight || '1.8', 'important');
    box.style.cursor = 'default';
    box.style.boxShadow = 'none';
    box.style.zIndex = 20;
    box.style.resize = 'none';
    box.style.overflow = 'visible';

    // Vertical alignment
    if (!boxData.valign || boxData.valign === 'top') {
      box.style.display = '';
      box.style.alignItems = '';
      box.style.justifyContent = '';
    } else {
      box.style.display = 'flex';
      box.style.flexDirection = 'column';
      box.style.justifyContent = (boxData.valign === 'middle' ? 'center' : 'flex-end');
      box.style.alignItems = 'stretch';
    }

    // --- Canva-like move handle ---
    const dragHandle = document.createElement('div');
    dragHandle.className = 'canva-move-handle';
    dragHandle.setAttribute('tabindex', '0');
    dragHandle.setAttribute('aria-label', 'Drag to move textbox');
    dragHandle.style.position = 'absolute';
    dragHandle.style.width = '64px';
    dragHandle.style.height = '32px';
    dragHandle.style.background = 'transparent';
    dragHandle.style.border = 'none';
    dragHandle.style.borderRadius = '0';
    dragHandle.style.boxShadow = 'none';
    dragHandle.style.cursor = 'grab';
    dragHandle.style.zIndex = 30;
    dragHandle.style.transition = 'background .15s, box-shadow .15s, border .15s';
    dragHandle.style.outline = 'none';
    dragHandle.style.userSelect = 'none';
    dragHandle.style.touchAction = 'none';

    const borderColor = '#87CEEB';
    dragHandle.innerHTML = `<svg width="32" height="32" style="display:block;margin:0 auto;" viewBox="0 0 24 24" fill="none">
      <path d="M12 3L12 21" stroke="${borderColor}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M12 3L9.5 6" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 3L14.5 6" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 21L9.5 18" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M12 21L14.5 18" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M3 12L21 12" stroke="${borderColor}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M3 12L6 9.5" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M3 12L6 14.5" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M21 12L18 9.5" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M21 12L18 14.5" stroke="${borderColor}" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`;

    // Fade behavior
    let fadeTimeout = null;
    function showHandle() {
      if (fadeTimeout) { clearTimeout(fadeTimeout); fadeTimeout = null; }
      dragHandle.classList.add('visible');
    }
    function hideHandle() {
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        dragHandle.classList.remove('visible');
        fadeTimeout = null;
      }, 800);
    }

    function updateHandlePosition() {
      dragHandle.style.left = (box.offsetLeft + box.offsetWidth / 2 - 32) + 'px';
      dragHandle.style.top  = (box.offsetTop + box.offsetHeight + 12) + 'px';
    }

    // Initial placement of handle
    updateHandlePosition();

    // Show/hide triggers
    box.addEventListener('mouseenter', showHandle);
    box.addEventListener('focus', showHandle);
    box.addEventListener('click', showHandle);
    box.addEventListener('mousedown', showHandle);
    dragHandle.addEventListener('mouseenter', showHandle);
    box.addEventListener('mouseleave', () => { if (!box.classList.contains('selected') && !dragHandle.matches(':hover')) hideHandle(); });
    box.addEventListener('blur', () => { if (!box.classList.contains('selected') && !box.matches(':hover') && !dragHandle.matches(':hover')) hideHandle(); });
    dragHandle.addEventListener('mouseleave', () => { if (!box.classList.contains('selected') && !box.matches(':hover')) hideHandle(); });
    hideHandle();

    // --- Snap guides helpers ---
    let vGuide = null, hGuide = null;
    function showGuide(type, pos) {
      let id = 'center-' + type + '-guide';
      let guide = document.getElementById(id);
      if (!guide) {
        guide = document.createElement('div');
        guide.id = id;
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

    // --- Selection frame positioner ---
    function updateSelectionFrame() {
      if (
        box.classList.contains('selected') ||
        box.matches(':hover') ||
        box.classList.contains('hover-highlight') ||
        box.classList.contains('resizing')
      ) {
        const left = box.offsetLeft;
        const top = box.offsetTop;
        const width = box.offsetWidth;
        const height = box.offsetHeight;

        if (width > 0 && height > 0) {
          selectionFrame.style.display = 'block';
          selectionFrame.style.left = (left - 2) + 'px';
          selectionFrame.style.top = (top - 2) + 'px';
          selectionFrame.style.width = (width + 4) + 'px';
          selectionFrame.style.height = (height + 4) + 'px';
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

    // --- Handle-driven dragging (single source of truth for moving) ---
    let handleDragging = false;
    let dragStartX = 0, dragStartY = 0, boxStartLeft = 0, boxStartTop = 0;

    function startDrag(e) {
      e.preventDefault();
      handleDragging = true;
      dragHandle.style.cursor = 'grabbing';
      box.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      if (typeof box.enterDragSelectMode === 'function') {
        box.enterDragSelectMode();
      } else {
        box.contentEditable = 'false';
        box.classList.add('selected');
      }
      updateSelectionFrame();

      if (e.type.startsWith('touch')) {
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;
      } else {
        dragStartX = e.clientX;
        dragStartY = e.clientY;
      }
      boxStartLeft = parseInt(box.style.left) || 0;
      boxStartTop = parseInt(box.style.top) || 0;

      window.addEventListener('mousemove', onDrag);
      window.addEventListener('mouseup', stopDrag);
      window.addEventListener('touchmove', onDrag, { passive: false });
      window.addEventListener('touchend', stopDrag);
    }

    function onDrag(e) {
      if (!handleDragging) return;

      let clientX, clientY;
      if (e.type.startsWith('touch')) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      const dx = clientX - dragStartX;
      const dy = clientY - dragStartY;

      const rect = a4.getBoundingClientRect();
      const boxRect = box.getBoundingClientRect();

      let x = boxStartLeft + dx;
      let y = boxStartTop + dy;

      // Clamp to page
      x = Math.max(0, Math.min(x, rect.width - boxRect.width));
      y = Math.max(0, Math.min(y, rect.height - boxRect.height));

      // Snap to center
      let snappedX = x, snappedY = y;
      if (window.snapToCenterGuides) {
        const pageCenterX = rect.width / 2;
        const pageCenterY = rect.height / 2;
        const boxCenterX = x + boxRect.width / 2;
        const boxCenterY = y + boxRect.height / 2;
        const threshold = 12;

        if (Math.abs(boxCenterX - pageCenterX) < threshold) {
          snappedX = pageCenterX - boxRect.width / 2;
          vGuide = showGuide('v', pageCenterX);
        } else if (vGuide) {
          vGuide.style.display = 'none';
        }

        if (Math.abs(boxCenterY - pageCenterY) < threshold) {
          snappedY = pageCenterY - boxRect.height / 2;
          hGuide = showGuide('h', pageCenterY);
        } else if (hGuide) {
          hGuide.style.display = 'none';
        }
      } else {
        hideGuides();
      }

      box.style.left = snappedX + 'px';
      box.style.top = snappedY + 'px';
      boxData.left = box.style.left;
      boxData.top = box.style.top;

      updateHandlePosition();
      updateSelectionFrame();
    }

    function stopDrag() {
      if (!handleDragging) return;
      handleDragging = false;
      dragHandle.style.cursor = 'grab';
      box.style.cursor = 'move';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', stopDrag);
      window.removeEventListener('touchmove', onDrag);
      window.removeEventListener('touchend', stopDrag);
      hideGuides();
      (window.saveToHistory || window?.worksheetHistory?.saveToHistory)?.('move textbox');
    }

    // Prevent deselect; start drag
    dragHandle.addEventListener('mousedown', function(e) { e.stopPropagation(); startDrag(e); });
    dragHandle.addEventListener('touchstart', function(e) { e.stopPropagation(); startDrag(e); }, { passive: false });

    // Keyboard move via handle
    dragHandle.addEventListener('keydown', function(e) {
      let moved = false;
      const step = e.shiftKey ? 10 : 2;
      let left = parseInt(box.style.left) || 0;
      let top = parseInt(box.style.top) || 0;
      if (e.key === 'ArrowLeft') { box.style.left = (left - step) + 'px'; moved = true; }
      if (e.key === 'ArrowRight') { box.style.left = (left + step) + 'px'; moved = true; }
      if (e.key === 'ArrowUp') { box.style.top = (top - step) + 'px'; moved = true; }
      if (e.key === 'ArrowDown') { box.style.top = (top + step) + 'px'; moved = true; }
      if (moved) {
        boxData.left = box.style.left;
        boxData.top = box.style.top;
        updateHandlePosition();
        updateSelectionFrame();
        (window.saveToHistory || window?.worksheetHistory?.saveToHistory)?.('move textbox');
        e.preventDefault();
      }
    });

    // Attach to DOM
    a4.appendChild(dragHandle);
    a4.appendChild(selectionFrame);

    // --- Setup textbox events (resizing, selection, editing, delete key, etc.) ---
    window.setupTextboxEvents(box, boxData, a4, updateHandlePosition, updateSelectionFrame, pageData);

    return box;
  }

  // Setup event listeners for textbox
  function setupTextboxEvents(box, boxData, a4, updateHandlePosition, updateSelectionFrame, pageData) {
    // Helpers
    function setUserSelect(editing) { box.style.userSelect = editing ? '' : 'none'; }
    function enterDragSelectMode() {
      box.contentEditable = 'false';
      setUserSelect(false);
      box.classList.add('selected');
      updateSelectionFrame && updateSelectionFrame();
    }
    function enterEditMode() {
      box.contentEditable = 'true';
      setUserSelect(true);
      box.classList.remove('selected');
      updateSelectionFrame && updateSelectionFrame();
      setTimeout(() => box.focus(), 0);
    }
    box.enterDragSelectMode = enterDragSelectMode;

    // Auto-resize height on input
    function autoResizeHeight() {
      const min = parseInt(boxData.height || 400, 10);
      box.style.height = 'auto';
      let newH = box.scrollHeight + 4;
      if (newH < min) newH = min;
      box.style.height = newH + 'px';
      boxData.height = box.style.height;
    }

    // Keyboard editing shortcuts (let browser handle paste; simple undo/redo fallback)
    box.addEventListener('keydown', function(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') return; // paste
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { document.execCommand('undo'); e.preventDefault(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { document.execCommand('redo'); e.preventDefault(); return; }
    });

    // Robust edge/corner detection for resize cursors and mousedown
    let resizingRight = false, resizingBottom = false, resizingDiagonal = false, resizingLeft = false, resizingTop = false;
    let startX, startY, startWidth, startHeight, startLeft, startTop;
    let prevWidth = null, prevHeight = null;
    let justFinishedResizing = false;

    box.addEventListener('mousedown', function(e) {
      prevWidth = box.offsetWidth;
      prevHeight = box.offsetHeight;

      if (box.contentEditable === 'false') {
        e.preventDefault();
        setUserSelect(false);
        document.body.style.userSelect = 'none';

        const r = box.getBoundingClientRect();
        const pxX = e.clientX - r.left;
        const pxY = e.clientY - r.top;
        const right = r.width - pxX;
        const bottom = r.height - pxY;
        const left = pxX;
        const top = pxY;
        const EDGE = 18;

        if (right < EDGE && bottom < EDGE) {
          resizingDiagonal = true;
          box.classList.add('resizing');
          startX = e.clientX;
          startY = e.clientY;
          startWidth = box.offsetWidth;
          startHeight = box.offsetHeight;
          return;
        }
        if (right < EDGE && top > EDGE && bottom > EDGE) {
          resizingRight = true;
          box.classList.add('resizing');
          startX = e.clientX;
          startWidth = box.offsetWidth;
          return;
        }
        if (bottom < EDGE && left > EDGE && right > EDGE) {
          resizingBottom = true;
          box.classList.add('resizing');
          startY = e.clientY;
          startHeight = box.offsetHeight;
          return;
        }
        if (left < EDGE && top > EDGE && bottom > EDGE) {
          resizingLeft = true;
          box.classList.add('resizing');
          startX = e.clientX;
          startWidth = box.offsetWidth;
          startLeft = box.offsetLeft;
          return;
        }
        if (top < EDGE && left > EDGE && right > EDGE) {
          resizingTop = true;
          box.classList.add('resizing');
          startY = e.clientY;
          startHeight = box.offsetHeight;
          startTop = box.offsetTop;
          return;
        }
      }
    });

    // Click toggles into edit (unless we just resized)
    box.addEventListener('click', function() {
      if (justFinishedResizing) { justFinishedResizing = false; return; }
      if (box.contentEditable === 'true') return;
      enterEditMode();
    });

    // Initial mode: drag/select
    enterDragSelectMode();

    // Hover highlights for selection frame
    box.addEventListener('mouseenter', function() {
      box.classList.add('hover-highlight');
      updateSelectionFrame && updateSelectionFrame();
    });
    box.addEventListener('mouseleave', function() {
      box.classList.remove('hover-highlight');
      updateSelectionFrame && updateSelectionFrame();
    });

    // Deselect on outside click
    document.addEventListener('mousedown', function(e) {
      const frame = document.querySelector('.textbox-selection-frame');
      const handle = document.querySelector('.canva-move-handle');
      if (
        e.target !== box &&
        e.target !== frame &&
        !(frame && frame.contains(e.target)) &&
        !box.contains(e.target) &&
        e.target !== handle &&
        !(handle && handle.contains(e.target))
      ) {
        if (box.classList.contains('selected')) {
          box.classList.remove('selected');
          updateSelectionFrame && updateSelectionFrame();
        }
        if (box.contentEditable === 'true') {
          enterDragSelectMode();
          box.blur();
        }
      }
    });

    // Blur restores drag/select
    box.addEventListener('blur', function() {
      if (box.contentEditable === 'true') enterDragSelectMode();
      box.style.cursor = 'default';
      updatePlaceholder();
    });

    // Cursors over edges (robust using client coords)
    box.addEventListener('mousemove', function(e) {
      if (box.contentEditable === 'true') { box.style.cursor = 'text'; return; }

      const r = box.getBoundingClientRect();
      const pxX = e.clientX - r.left;
      const pxY = e.clientY - r.top;
      const right = r.width - pxX;
      const bottom = r.height - pxY;
      const left = pxX;
      const top = pxY;
      const EDGE = 18;

      if (right < EDGE && bottom < EDGE) box.style.cursor = 'se-resize';
      else if (right < EDGE && top > EDGE) box.style.cursor = 'e-resize';
      else if (bottom < EDGE && left > EDGE) box.style.cursor = 's-resize';
      else if (left < EDGE && top > EDGE) box.style.cursor = 'w-resize';
      else if (top < EDGE && left > EDGE && right > EDGE) box.style.cursor = 'n-resize';
      else box.style.cursor = 'default';
    });
    box.addEventListener('mouseleave', function() {
      box.style.cursor = (document.activeElement === box ? 'text' : 'default');
    });

    // Resize logic on document mousemove
    document.addEventListener('mousemove', function(e) {
      if (resizingDiagonal) {
        let w = startWidth + (e.clientX - startX);
        let h = startHeight + (e.clientY - startY);
        if (w < 120) w = 120;
        if (h < 40) h = 40;
        box.style.width = w + 'px';
        box.style.height = h + 'px';
        boxData.width = box.style.width; boxData.height = box.style.height;
        updateHandlePosition && updateHandlePosition();
        updateSelectionFrame && updateSelectionFrame();
        return;
      }
      if (resizingRight) {
        let w = startWidth + (e.clientX - startX);
        if (w < 120) w = 120;
        box.style.width = w + 'px';
        boxData.width = box.style.width;
        updateHandlePosition && updateHandlePosition();
        updateSelectionFrame && updateSelectionFrame();
        return;
      }
      if (resizingBottom) {
        let h = startHeight + (e.clientY - startY);
        if (h < 40) h = 40;
        box.style.height = h + 'px';
        boxData.height = box.style.height;
        updateHandlePosition && updateHandlePosition();
        updateSelectionFrame && updateSelectionFrame();
        return;
      }
      if (resizingLeft) {
        let dx = e.clientX - startX;
        let w = startWidth - dx;
        let l = startLeft + dx;
        if (w < 120) { l -= (120 - w); w = 120; }
        box.style.width = w + 'px';
        box.style.left = l + 'px';
        boxData.width = box.style.width;
        boxData.left = box.style.left;
        updateHandlePosition && updateHandlePosition();
        updateSelectionFrame && updateSelectionFrame();
        return;
      }
      if (resizingTop) {
        let dy = e.clientY - startY;
        let h = startHeight - dy;
        let t = startTop + dy;
        if (h < 40) { t -= (40 - h); h = 40; }
        box.style.height = h + 'px';
        box.style.top = t + 'px';
        boxData.height = box.style.height;
        boxData.top = box.style.top;
        updateHandlePosition && updateHandlePosition();
        updateSelectionFrame && updateSelectionFrame();
        return;
      }
    });

    // Mouseup ends any resize
    document.addEventListener('mouseup', function() {
      if (resizingDiagonal || resizingRight || resizingBottom || resizingLeft || resizingTop) {
        justFinishedResizing = true;
        setTimeout(() => { justFinishedResizing = false; }, 100);
        (window.saveToHistory || window?.worksheetHistory?.saveToHistory)?.('resize textbox');
      }
      box.classList.remove('resizing');
      resizingDiagonal = resizingRight = resizingBottom = resizingLeft = resizingTop = false;
      box.style.userSelect = '';
      document.body.style.userSelect = '';
      updateSelectionFrame && updateSelectionFrame();
    });

    // Apply min constraints & save after user mouseup inside box
    box.addEventListener('mouseup', function() {
      if (box.offsetWidth !== prevWidth || box.offsetHeight !== prevHeight) {
        boxData.width = box.offsetWidth + 'px';
        boxData.height = box.offsetHeight + 'px';
        if (box.offsetWidth < 120) { box.style.minWidth = '120px'; boxData.width = '120px'; }
        if (box.offsetHeight < 40) { box.style.minHeight = '40px'; boxData.height = '40px'; }
        (window.saveToHistory || window?.worksheetHistory?.saveToHistory)?.('resize textbox');
      }
    });

    // Placeholder
    function updatePlaceholder() {
      if ((box.innerText || '').trim() === '') box.classList.add('empty');
      else box.classList.remove('empty');
    }
    box.addEventListener('input', function() {
      boxData.text = box.innerText;
      boxData.html = box.innerHTML;
      updatePlaceholder();
      autoResizeHeight();
      window.worksheetState?.getDebouncedSaveTextHistory?.()();
    });
    setTimeout(autoResizeHeight, 0);

    // Track style changes into data model (lightweight)
    box.addEventListener('DOMSubtreeModified', function() {
      if (box.style.fontFamily) boxData.fontFamily = box.style.fontFamily;
      if (box.style.fontSize) boxData.fontSize = box.style.fontSize;
    });

    // Toolbar hooks
    box.addEventListener('focus', function() {
      window.worksheetState?.setLastTextbox?.(box);
      box.style.cursor = 'text';
      updatePlaceholder();
      window.updateToolbarFromBox?.(box);
      window.showTextToolbar?.(box);
    });
    box.addEventListener('click', function() {
      window.worksheetState?.setLastTextbox?.(box);
      window.updateToolbarFromBox?.(box);
      window.showTextToolbar?.(box);
    });

    // Context menu
    box.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      window.showTextboxContextMenu?.(e, box);
    });

    // Global Delete/Backspace for selected, non-editing box
    document.addEventListener('keydown', function(e) {
      const isSelected = box.classList.contains('selected') && box.contentEditable === 'false';
      const isDeleteKey = e.key === 'Delete' || e.key === 'Backspace';
      if (!isSelected || !isDeleteKey) return;

      // Avoid deleting if user is typing in other inputs/contenteditables
      const active = document.activeElement;
      const tag = (active && active.tagName) || '';
      if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
      if (active && active.isContentEditable) return;

      e.preventDefault();

      // Remove DOM (box + its auxiliary nodes on this page)
      try { a4.removeChild(box); } catch(_) {}
      const myHandle = a4.querySelector('.canva-move-handle');
      const myFrame  = a4.querySelector('.textbox-selection-frame');
      try { if (myHandle) a4.removeChild(myHandle); } catch(_) {}
      try { if (myFrame) a4.removeChild(myFrame); } catch(_) {}

      // Remove from data model
      try {
        if (pageData?.boxes && Array.isArray(pageData.boxes)) {
          const idx = pageData.boxes.indexOf(boxData);
          if (idx > -1) pageData.boxes.splice(idx, 1);
        } else {
          const pages = window.worksheetState?.getPages?.();
          if (pages) {
            for (const p of pages) {
              const i = p.boxes?.indexOf(boxData);
              if (i > -1) { p.boxes.splice(i, 1); break; }
            }
          }
        }
      } catch(_) {}

      (window.saveToHistory || window?.worksheetHistory?.saveToHistory)?.('delete textbox');
    }, { capture: true });

    // Keep visuals in sync on viewport changes
    window.addEventListener('resize', function() {
      updateHandlePosition && updateHandlePosition();
      updateSelectionFrame && updateSelectionFrame();
    });

    updatePlaceholder();
  }

  // Export to window for global access
  window.renderTextbox = renderTextbox;
  window.setupTextboxEvents = setupTextboxEvents;
})();
