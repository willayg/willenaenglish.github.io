document.addEventListener('DOMContentLoaded', () => {
  const makeWordListBtn = document.getElementById('makeWordListBtn');
  if (!makeWordListBtn) return;

  makeWordListBtn.addEventListener('click', () => {
    const words = document.getElementById('wordTestWords').value.trim();
    const passage = document.getElementById('wordTestPassage').value.trim();
    const preview = document.getElementById('worksheetPreviewArea-tests');
    const title = document.getElementById('wordTestTitle').value.trim() || "Word Test Worksheet";
    const font = document.getElementById('wordTestFont').value || "'Poppins', sans-serif";
    if (!words || !preview) {
      alert("Please enter or generate some words first.");
      return;
    }

    // Split lines, then split each line into English and Korean
    const wordPairs = words.split('\n').map(line => {
      const [eng, kor] = line.split(',').map(w => w.trim());
      return { eng: eng || '', kor: kor || '' };
    }).filter(pair => pair.eng && pair.kor);

    const puzzle = `
      ${passage ? `<div style="margin-bottom:18px;"><b>Passage:</b><div style="border:1px solid #ccc;border-radius:6px;padding:8px 12px;background:#f9f9f9;margin-top:4px;">${passage.replace(/\n/g, "<br>")}</div></div>` : ""}
      <div style="margin-bottom:18px;"><b>Vocabulary Words:</b>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #333;">English</th>
              <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #333;">Korean</th>
            </tr>
          </thead>
          <tbody>
            ${wordPairs.map(pair => `
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${pair.eng}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${pair.kor}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Use your worksheet template
    const template = window.worksheetTemplates?.[0];
    const instructions = "Study the English and Korean words below.";
    preview.innerHTML = template.render({
      title,
      instructions,
      puzzle,
      orientation: "portrait"
    });

    // Apply font to worksheet preview
    preview.style.fontFamily = font;

    // Optionally, scale the preview
    if (typeof scaleWorksheetPreview === "function") scaleWorksheetPreview();

    // Dynamically load Google Fonts if needed
    if (font.includes('Poppins') && !document.getElementById('font-poppins')) {
      const link = document.createElement('link');
      link.id = 'font-poppins';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css?family=Poppins:400,700&display=swap';
      document.head.appendChild(link);
    }
    if (font.includes('Glacial Indifference') && !document.getElementById('font-glacial')) {
      const link = document.createElement('link');
      link.id = 'font-glacial';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css?family=Glacial+Indifference&display=swap';
      document.head.appendChild(link);
    }
    if (font.includes('Roboto') && !document.getElementById('font-roboto')) {
      const link = document.createElement('link');
      link.id = 'font-roboto';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css?family=Roboto:400,700&display=swap';
      document.head.appendChild(link);
    }
    if (font.includes('Nanum Gothic') && !document.getElementById('font-nanum')) {
      const link = document.createElement('link');
      link.id = 'font-nanum';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css?family=Nanum+Gothic&display=swap';
      document.head.appendChild(link);
    }
    if (font.includes('Noto Sans KR') && !document.getElementById('font-noto-kr')) {
      const link = document.createElement('link');
      link.id = 'font-noto-kr';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css?family=Noto+Sans+KR&display=swap';
      document.head.appendChild(link);
    }
  });
});

function scaleWorksheetPreview() {
  const wrapper = document.getElementById('worksheetPreviewWrapper');
  const preview = document.getElementById('worksheetPreviewArea-tests');
  if (!wrapper || !preview) return;

  // A4 size in px
  const a4Width = 794;
  const a4Height = 1123;

  // Get available space
  const wrapperWidth = wrapper.clientWidth;
  const wrapperHeight = wrapper.clientHeight;

  // Calculate scale to fit
  const scale = Math.min(
    wrapperWidth / a4Width,
    wrapperHeight / a4Height,
    1 // never upscale, only downscale
  );

  preview.style.transform = `scale(${scale})`;
}

// Call scaleWorksheetPreview on window resize
window.addEventListener('resize', scaleWorksheetPreview);