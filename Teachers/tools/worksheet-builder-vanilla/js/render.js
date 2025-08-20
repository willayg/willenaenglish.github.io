// render.js - UI Rendering Management

(function() {


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
      if (pageData.header && window.renderHeader) {
        const headerDiv = window.renderHeader(pageData.header, a4);
        a4.insertBefore(headerDiv, a4.firstChild);
      }

      // Render all text boxes for this page
      if (Array.isArray(pageData.boxes)) {
        pageData.boxes.forEach((boxData, boxIdx) => {
          const box = window.renderTextbox(boxData, a4, pageData);
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
          borderOn: boxEl.getAttribute('data-border-on') === 'true',
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
                  boxEl.style.justifyContent === 'flex-end' ? 'bottom' : 'top',
          // Preserve type attribute for vocab boxes
          type: boxEl.getAttribute('data-type') || undefined,
          // Preserve vocab state for vocab boxes
          vocabState: boxEl.getAttribute('data-vocab-state') ? JSON.parse(boxEl.getAttribute('data-vocab-state')) : undefined
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
    syncAllTextboxesToDataModel,
    addPage
  };

  // Make functions globally available for backward compatibility
  window.renderPages = renderPages;
  window.syncAllTextboxesToDataModel = syncAllTextboxesToDataModel;
  window.addPage = addPage;
})();
