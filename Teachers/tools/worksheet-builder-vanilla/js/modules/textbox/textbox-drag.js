// textbox-drag.js
// Drag handle logic for worksheet textboxes (lean version)

(function () {
  const CONFIG = {
    KEYBOARD_STEP_SMALL: 2,
    KEYBOARD_STEP_LARGE: 10
  };

  // One-time CSS for handle fade + print hide
  (function ensureGlobalStyles() {
    if (!document.getElementById('canva-move-handle-fade-style')) {
      const style = document.createElement('style');
      style.id = 'canva-move-handle-fade-style';
      style.textContent = `
        .canva-move-handle { transition: opacity 0.3s; opacity: 0; pointer-events: none; }
        .canva-move-handle.visible { opacity: 1; pointer-events: auto; }
        @media print { .canva-move-handle { display: none !important; } }
      `;
      document.head.appendChild(style);
    }
  })();

  function addDragHandle(box, boxData, a4, updateSelectionFrame) {
    // handle element
    const dragHandle = document.createElement('div');
    dragHandle.className = 'canva-move-handle';
    dragHandle.setAttribute('tabindex', '0');
    dragHandle.setAttribute('role', 'button');
    dragHandle.setAttribute('aria-label', 'Drag to move textbox');

    // visual + behavior
    dragHandle.style.position = 'absolute';
    dragHandle.style.width = '40px';
    dragHandle.style.height = '40px';
    dragHandle.style.background = 'transparent';
    dragHandle.style.border = 'none';
    dragHandle.style.cursor = 'grab';
    dragHandle.style.zIndex = 30;
    dragHandle.style.transition = 'background 0.15s, box-shadow 0.15s, border 0.15s';
    dragHandle.style.outline = 'none';
    dragHandle.style.userSelect = 'none';
    dragHandle.style.touchAction = 'none';

    const borderColor = '#87CEEB';
    dragHandle.innerHTML = `<svg width="20" height="20" style="display:block;margin:0 auto;" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2L10 18" stroke="${borderColor}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M10 2L7.8 4.2" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M10 2L12.2 4.2" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M10 18L7.8 15.8" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M10 18L12.2 15.8" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M2 10L18 10" stroke="${borderColor}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M2 10L4.2 7.8" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M2 10L4.2 12.2" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M18 10L15.8 7.8" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M18 10L15.8 12.2" stroke="${borderColor}" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`;

    // fade logic
    let fadeTimeout = null;
    const showHandle = () => {
      if (fadeTimeout) { clearTimeout(fadeTimeout); fadeTimeout = null; }
      dragHandle.classList.add('visible');
    };
    const hideHandle = () => {
      if (fadeTimeout) clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        dragHandle.classList.remove('visible');
        fadeTimeout = null;
      }, 800);
    };

    // initial position helpers
    function ensureBoxPosDefaults() {
      let l = parseInt(box.style.left); if (isNaN(l)) l = box.offsetLeft || 0;
      let t = parseInt(box.style.top);  if (isNaN(t)) t = box.offsetTop  || 0;
      box.style.left = l + 'px';
      box.style.top  = t + 'px';
      boxData.left = box.style.left;
      boxData.top  = box.style.top;
    }

    function updateHandlePosition() {
      if (!box.offsetParent) return;
      dragHandle.style.left = (box.offsetLeft + box.offsetWidth / 2 - 32) + 'px';
      dragHandle.style.top  = (box.offsetTop + box.offsetHeight + 12) + 'px';
    }

    // hover/focus show-hide
    box.addEventListener('pointerenter', showHandle);
    box.addEventListener('focus', showHandle);
    box.addEventListener('click', showHandle);
    box.addEventListener('pointerdown', showHandle);
    box.addEventListener('pointerup', () => { if (box.classList.contains('selected')) showHandle(); });
    dragHandle.addEventListener('pointerenter', showHandle);

    const maybeHide = () => {
      if (!box.classList.contains('selected') && !box.matches(':hover') && !dragHandle.matches(':hover')) hideHandle();
    };
    box.addEventListener('pointerleave', maybeHide);
    box.addEventListener('blur', maybeHide);
    dragHandle.addEventListener('pointerleave', maybeHide);

    hideHandle();

    // drag state
    let snapToCenter = null;
    let hideGuides = null;
    let handleDragging = false;
    let dragStartX = 0, dragStartY = 0, boxStartLeft = 0, boxStartTop = 0;
    let movedDuringDrag = false;
    let rafPending = false;

    function clamp(left, top) {
      const maxLeft = a4.clientWidth - box.offsetWidth;
      const maxTop  = a4.clientHeight - box.offsetHeight;
      return [
        Math.max(0, Math.min(left, maxLeft)),
        Math.max(0, Math.min(top,  maxTop))
      ];
    }

    function applyPosition(newLeft, newTop) {
      if (snapToCenter) {
        const snap = snapToCenter(newLeft + 'px', newTop + 'px', box.offsetWidth, box.offsetHeight);
        box.style.left = snap.left;
        box.style.top  = snap.top;
      } else {
        box.style.left = newLeft + 'px';
        box.style.top  = newTop + 'px';
      }
      boxData.left = box.style.left;
      boxData.top  = box.style.top;
      updateHandlePosition();
      if (updateSelectionFrame) updateSelectionFrame();
    }

    function startDrag(e) {
      e.preventDefault();
      ensureBoxPosDefaults();

      handleDragging = true;
      movedDuringDrag = false;
      dragHandle.style.cursor = 'grabbing';
      box.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';

      dragStartX = e.clientX;
      dragStartY = e.clientY;
      boxStartLeft = parseInt(box.style.left) || 0;
      boxStartTop  = parseInt(box.style.top)  || 0;

      if (typeof box.enterDragSelectMode === 'function') {
        box.enterDragSelectMode();
      } else {
        box.contentEditable = false;
        box.classList.add('selected');
      }

      if (dragHandle.setPointerCapture && e.pointerId != null) {
        try { dragHandle.setPointerCapture(e.pointerId); } catch {}
      }

      window.addEventListener('pointermove', onDrag, { passive: false });
      window.addEventListener('pointerup', stopDrag, { passive: false });
      window.addEventListener('pointercancel', stopDrag, { passive: false });
    }

    function onDrag(e) {
      if (!handleDragging) return;
      e.preventDefault();

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      let newLeft = boxStartLeft + dx;
      let newTop  = boxStartTop  + dy;
      [newLeft, newTop] = clamp(newLeft, newTop);

      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => {
        applyPosition(newLeft, newTop);
        movedDuringDrag = true;
        rafPending = false;
      });
    }

    function stopDrag(e) {
      if (!handleDragging) return;
      handleDragging = false;

      dragHandle.style.cursor = 'grab';
      box.style.cursor = 'move';
      document.body.style.userSelect = '';

      window.removeEventListener('pointermove', onDrag);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);

      if (dragHandle.releasePointerCapture && e && e.pointerId != null) {
        try { dragHandle.releasePointerCapture(e.pointerId); } catch {}
      }

      if (hideGuides) hideGuides();
      if (movedDuringDrag && window.saveToHistory) window.saveToHistory('move textbox');
      movedDuringDrag = false;
    }

    // start drag from handle
    dragHandle.addEventListener('pointerdown', function (e) {
      e.stopPropagation();
      startDrag(e);
    });

    // keyboard move with clamp + snap
    dragHandle.addEventListener('keydown', function (e) {
      const step = e.shiftKey ? CONFIG.KEYBOARD_STEP_LARGE : CONFIG.KEYBOARD_STEP_SMALL;
      const keyMap = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (e.key === 'Escape' && handleDragging) {
        // cancel drag feel
        handleDragging = false;
        dragHandle.style.cursor = 'grab';
        box.style.cursor = 'move';
        document.body.style.userSelect = '';
        if (hideGuides) hideGuides();
        e.preventDefault();
        return;
      }
      if (!(e.key in keyMap)) return;

      ensureBoxPosDefaults();
      let left = parseInt(box.style.left) || 0;
      let top  = parseInt(box.style.top)  || 0;

      const [dx, dy] = keyMap[e.key];
      let newLeft = left + dx;
      let newTop  = top  + dy;
      [newLeft, newTop] = clamp(newLeft, newTop);

      applyPosition(newLeft, newTop);
      if (window.saveToHistory) window.saveToHistory('move textbox');
      e.preventDefault();
    });

    // keep handle glued on content resize
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(updateHandlePosition);
      ro.observe(box);
    }

    // initial placement
    ensureBoxPosDefaults();
    a4.appendChild(dragHandle);
    updateHandlePosition();
    hideHandle();

    function setSnapFunction(snapFunc, hideGuidesFunc) {
      snapToCenter = snapFunc || null;
      hideGuides = hideGuidesFunc || null;
    }

    return { dragHandle, updateHandlePosition, setSnapFunction };
  }

  window.textboxDrag = { addDragHandle };
})();
