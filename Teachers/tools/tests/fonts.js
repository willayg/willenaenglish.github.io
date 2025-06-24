export function applyPreviewFontStyles(preview, font, fontSizeScale) {
  preview.style.fontFamily = font;
  preview.style.fontSize = `${fontSizeScale}em`;
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