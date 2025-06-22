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
  const preview = document.getElementById('worksheetPreviewArea-tests');
  if (!wrapper || !preview) return;
  const a4Width = 794, a4Height = 1123;
  const scale = Math.min(
    wrapper.clientWidth / a4Width,
    wrapper.clientHeight / a4Height,
    1
  );
  preview.style.transform = `scale(${scale})`;
}