export function applyPreviewFontStyles(preview, font, fontSizeScale) {
  // Apply font to the main preview container
  preview.style.setProperty('font-family', font, 'important');
  preview.style.setProperty('font-size', `${fontSizeScale}em`, 'important');
  
  // Apply font to all text elements inside the preview with high specificity
  const textSelectors = [
    'td', 'th', 'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    '.toggle-word', 'table', 'tbody', 'thead', 'tr'
  ];
  
  textSelectors.forEach(selector => {
    const elements = preview.querySelectorAll(selector);
    elements.forEach(element => {
      element.style.setProperty('font-family', font, 'important');
      element.style.setProperty('font-size', `${fontSizeScale}em`, 'important');
    });
  });
  
  // Include the hints/word list div in font application
  const hintsSelector = ['.mb-2'];
  hintsSelector.forEach(selector => {
    const elements = preview.querySelectorAll(selector);
    elements.forEach(element => {
      element.style.setProperty('font-family', font, 'important');
      element.style.setProperty('font-size', `${fontSizeScale}em`, 'important');
    });
  });
}

export function loadGoogleFont(font) {
  const fontMap = {
    "Poppins": "font-poppins",
    "Glacial Indifference": "font-glacial",
    "Roboto": "font-roboto",
    "Nanum Gothic": "font-nanum",
    "Noto Sans KR": "font-noto-kr"
  };
  for (const [name, id] of Object.entries(fontMap)) {
    if (font.includes(name) && !document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css?family=${encodeURIComponent(name)}&display=swap`;
      document.head.appendChild(link);
    }
  }
}

export function scaleWorksheetPreview() {
  const wrapper = document.getElementById('worksheetPreviewWrapper');
  const previews = document.querySelectorAll('.worksheet-preview');
  if (!wrapper) return;
  
  const a4Width = 794;
  const containerWidth = wrapper.clientWidth;
  const scale = Math.min(containerWidth / a4Width, 1);
  
  previews.forEach(preview => {
    if (preview) {
      preview.style.transform = `scale(${scale})`;
      preview.style.transformOrigin = 'top left';
      
      // Adjust wrapper height based on scaled content
      if (!preview.classList.contains('hidden')) {
        const contentHeight = preview.scrollHeight;
        wrapper.style.height = `${Math.max(contentHeight * scale, 1123 * scale)}px`;
      }
    }
  });
}