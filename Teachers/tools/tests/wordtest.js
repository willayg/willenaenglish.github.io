document.addEventListener('DOMContentLoaded', () => {
  function updateWordTestPreview() {
    const words = document.getElementById('wordTestWords').value.trim();
    const passage = document.getElementById('wordTestPassage').value.trim();
    const preview = document.getElementById('worksheetPreviewArea-tests');
    const title = document.getElementById('wordTestTitle').value.trim() || "Word Test Worksheet";
    const font = document.getElementById('wordTestFont').value || "'Poppins', sans-serif";
    if (!words || !preview) {
      preview.innerHTML = "<div class='text-gray-400'>Enter or generate some words to preview worksheet.</div>";
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
  }

  // Button still works (for users who expect it)
  const makeWordListBtn = document.getElementById('makeWordListBtn');
  if (makeWordListBtn) {
    makeWordListBtn.addEventListener('click', updateWordTestPreview);
  }

  // Live update: listen for changes on all relevant fields
  [
    'wordTestWords',
    'wordTestPassage',
    'wordTestTitle',
    'wordTestFont'
    // Add more IDs here if needed
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateWordTestPreview);
      el.addEventListener('change', updateWordTestPreview);
    }
  });

  // --- AI Extract Words for Word Test ---
  const extractBtn = document.getElementById('extractWordTestWordsBtn');
  if (extractBtn) {
    extractBtn.onclick = async () => {
      const passage = document.getElementById('wordTestPassage').value.trim();
      const numWords = document.getElementById('wordTestNumWords').value || 10;
      if (!passage) return alert("Please paste a passage.");
      extractBtn.disabled = true;
      extractBtn.textContent = "Extracting...";
      try {
        const response = await fetch('/.netlify/functions/openai_proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: 'chat/completions',
            payload: {
              model: 'gpt-3.5-turbo',
              messages: [
                { role: 'system', content: 'You are a helpful teaching assistant.' },
                { role: 'user', content: `Extract the ${numWords} most important vocabulary words from this passage (one per line, no numbering):\n\n${passage}` }
              ],
              max_tokens: 100
            }
          })
        });
        const data = await response.json();
        const aiWords = data.data.choices?.[0]?.message?.content || '';
        document.getElementById('wordTestWords').value = aiWords.trim();
        updateWordTestPreview(); // Update preview after AI fills words
      } catch (e) {
        alert("AI extraction failed.");
      }
      extractBtn.disabled = false;
      extractBtn.textContent = "Extract Words with AI";
    };
  }

  // Initial preview on page load
  updateWordTestPreview();
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