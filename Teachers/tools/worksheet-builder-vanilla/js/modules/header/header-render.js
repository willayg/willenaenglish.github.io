// header-render.js - Header rendering logic

function renderHeader(headerData, a4) {
  const headerDiv = document.createElement('div');
  headerDiv.className = 'worksheet-header';
  headerDiv.setAttribute('contenteditable', 'true');
  headerDiv.setAttribute('spellcheck', 'false');
  // Always set fixed width and center
  headerDiv.style.width = '780px';
  headerDiv.style.margin = '0 auto';

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
    e.stopPropagation();
    document.querySelectorAll('.worksheet-header.selected').forEach(h => h.classList.remove('selected'));
    headerDiv.classList.add('selected');
    if (window.updateToolbarFromBox) window.updateToolbarFromBox(headerDiv);
    if (window.openHeaderModal) {
      console.log('Opening header modal from header-render.js click handler');
      window.openHeaderModal();
    }
  });

  return headerDiv;
}

// Export for use in render.js
window.renderHeader = renderHeader;
