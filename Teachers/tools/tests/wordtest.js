document.addEventListener('DOMContentLoaded', () => {
  function updateWordTestPreview() {
    const words = document.getElementById('wordTestWords').value.trim();
    const passage = document.getElementById('wordTestPassage').value.trim();
    const preview = document.getElementById('worksheetPreviewArea-tests');
    const title = document.getElementById('wordTestTitle').value.trim() || "";
    const font = document.getElementById('wordTestFont').value || "'Poppins', sans-serif";
    const fontSizeScale = parseFloat(document.getElementById('wordTestFontSize')?.value || "1");
    const layout = document.getElementById('wordTestLayout')?.value || "default";
    const templateIndex = parseInt(document.getElementById('wordTestTemplate')?.value || "0", 10);
    const template = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[0];
    const instructions = "";
    if (!words || !preview) {
      preview.innerHTML = "<div class='text-gray-400'>Enter or generate some words to preview worksheet.</div>";
      return;
    }

    // Split lines, then split each line into English and Korean
    const wordPairs = words.split('\n').map(line => {
      const [eng, kor] = line.split(',').map(w => w.trim());
      return { eng: eng || '', kor: kor || '' };
    }).filter(pair => pair.eng && pair.kor);

    let puzzle = "";

    if (layout === "4col") {
      const half = Math.ceil(wordPairs.length / 2);
      const left = wordPairs.slice(0, half);
      const right = wordPairs.slice(half);

      while (left.length < right.length) left.push({ eng: "", kor: "" });
      while (right.length < left.length) right.push({ eng: "", kor: "" });

      puzzle = `
        <div style="margin-bottom:18px;"><b>Vocabulary Words (4 Columns):</b>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">#</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">English</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333; border-right:2px solid #333;">Korean</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">#</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">English</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">Korean</th>
              </tr>
            </thead>
            <tbody>
              ${left.map((pair, i) => `
                <tr>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${pair.eng ? (i + 1) : ""}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${pair.eng}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd; border-right:2px solid #333;">${pair.kor}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.eng ? (i + 1 + half) : ""}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.eng || ""}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.kor || ""}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (layout === "images") {
      buildWordTableWithPixabay(wordPairs).then(tableHtml => {
        preview.innerHTML = template.render({
          title,
          instructions,
          puzzle: tableHtml,
          orientation: "portrait"
        });
        applyPreviewFontStyles(preview, font, fontSizeScale);

        // Attach click handler for refresh
        document.querySelectorAll('.pixabay-refresh-img').forEach(img => {
          img.addEventListener('click', async function() {
            const word = this.getAttribute('data-word');
            this.src = await getOpenBayImage(word, true); // true = get next/random image
          });
        });
      });
      return;
    } else if (layout === "4col-images") {
      // Split wordPairs in half for left/right columns
      const half = Math.ceil(wordPairs.length / 2);
      const left = wordPairs.slice(0, half);
      const right = wordPairs.slice(half);

      while (left.length < right.length) left.push({ eng: "", kor: "" });
      while (right.length < left.length) right.push({ eng: "", kor: "" });

      // Fetch images for both left and right columns
      Promise.all([
        Promise.all(left.map(pair => getOpenBayImage(pair.eng))),
        Promise.all(right.map(pair => getOpenBayImage(pair.eng)))
      ]).then(([leftImages, rightImages]) => {
        const tableHtml = `
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">#</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">Image</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">English</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333; border-right:2px solid #333;">Korean</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">#</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">Image</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">English</th>
                <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #333;">Korean</th>
              </tr>
            </thead>
            <tbody>
              ${left.map((pair, i) => `
                <tr>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${pair.eng ? (i + 1) : ""}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">
                    ${leftImages[i] ? `<img src="${leftImages[i]}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;cursor:pointer;" class="pixabay-refresh-img" data-word="${pair.eng}">` : ""}
                  </td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${pair.eng}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd; border-right:2px solid #333;">${pair.kor}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.eng ? (i + 1 + half) : ""}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">
                    ${rightImages[i] ? `<img src="${rightImages[i]}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;cursor:pointer;" class="pixabay-refresh-img" data-word="${right[i]?.eng}">` : ""}
                  </td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.eng || ""}</td>
                  <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.kor || ""}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
        preview.innerHTML = template.render({
          title,
          instructions,
          puzzle: tableHtml,
          orientation: "portrait"
        });
        applyPreviewFontStyles(preview, font, fontSizeScale);

        document.querySelectorAll('.pixabay-refresh-img').forEach(img => {
          img.addEventListener('click', async function() {
            const word = this.getAttribute('data-word');
            this.src = await getOpenBayImage(word, true); // true = get next/random image
          });
        });
      });
      return;
    } else if (layout === "6col-images") {
      const half = Math.ceil(wordPairs.length / 2);
      const left = wordPairs.slice(0, half);
      const right = wordPairs.slice(half);

      while (left.length < right.length) left.push({ eng: "", kor: "" });
      while (right.length < left.length) right.push({ eng: "", kor: "" });

      Promise.all([
        Promise.all(left.map(pair => getOpenBayImage(pair.eng))),
        Promise.all(right.map(pair => getOpenBayImage(pair.eng)))
      ]).then(([leftImages, rightImages]) => {
        const tableHtml = `
          <div style="margin-bottom:18px;"><b>Vocabulary Words (6 Columns with Images):</b>
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333;">#</th>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333;">Image</th>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333;">English</th>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333; border-right:2px solid #333;">Korean</th>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333;">#</th>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333;">Image</th>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333;">English</th>
                  <th style="text-align:left;padding:9px 8px;border-bottom:2px solid #333;">Korean</th>
                </tr>
              </thead>
              <tbody>
                ${left.map((pair, i) => `
                  <tr style="height:80px;">
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd;">${pair.eng ? (i + 1) : ""}</td>
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd;">
                      ${leftImages[i] ? `<img src="${leftImages[i]}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;" class="pixabay-refresh-img" data-word="${pair.eng}">` : ""}
                    </td>
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd;">${pair.eng}</td>
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd; border-right:2px solid #333;">${pair.kor}</td>
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd;">${right[i]?.eng ? (i + 1 + half) : ""}</td>
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd;">
                      ${rightImages[i] ? `<img src="${rightImages[i]}" style="width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;" class="pixabay-refresh-img" data-word="${right[i]?.eng}">` : ""}
                    </td>
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd;">${right[i]?.eng || ""}</td>
                    <td style="padding:12px 8px;border-bottom:1px solid #ddd;">${right[i]?.kor || ""}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
        preview.innerHTML = template.render({
          title,
          instructions,
          puzzle: tableHtml,
          orientation: "portrait"
        });
        applyPreviewFontStyles(preview, font, fontSizeScale);

        // Attach click handler for refresh
        document.querySelectorAll('.pixabay-refresh-img').forEach(img => {
          img.addEventListener('click', async function() {
            const word = this.getAttribute('data-word');
            this.src = await getOpenBayImage(word, true); // true = get next/random image
          });
        });
      });
      return;
    } else {
      // Default layout
      puzzle = `
        ${passage ? `<div style="margin-bottom:18px;"><b>Passage:</b><div style="border:1px solid #ccc;border-radius:6px;padding:8px 12px;background:#f9f9f9;margin-top:4px;">${passage.replace(/\n/g, "<br>")}</div></div>` : ""}
        <div style="margin-bottom:18px;"><b>Vocabulary Words:</b>
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr>
                <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #333;">#</th>
                <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #333;">English</th>
                <th style="text-align:left;padding:6px 12px;border-bottom:2px solid #333;">Korean</th>
              </tr>
            </thead>
            <tbody>
              ${wordPairs.map((pair, i) => `
                <tr>
                  <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${i + 1}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${pair.eng}</td>
                  <td style="padding:8px 12px;border-bottom:1px solid #ddd;">${pair.kor}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    preview.innerHTML = template.render({
      title,
      instructions,
      puzzle,
      orientation: "portrait"
    });
    applyPreviewFontStyles(preview, font, fontSizeScale);

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
    'wordTestFont',
    'wordTestFontSize',
    'wordTestLayout',
    'wordTestTemplate' // <-- add this line
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
                { role: 'user', content: `Extract the ${numWords} most important English vocabulary words from this passage. For each word, provide the Korean translation, formatted as: english, korean (one per line, no numbering):\n\n${passage}` }
              ],
              max_tokens: 200
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

  // Refresh Images Button
  const refreshBtn = document.getElementById('refreshImagesBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Clear all cached images
      Object.keys(imageCache).forEach(key => delete imageCache[key]);
      // Re-render the worksheet preview (assuming you have a function for this)
      updateWordTestPreview();
    });
  }
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

// --- At the top, change imageCache to store arrays:
const imageCache = {}; // { word: { images: [...], index: 0 } }

/*async function getOpenBayImage(query, next = false) {
  if (!query) return "";
  if (!imageCache[query] || next) {
    const res = await fetch(`/.netlify/functions/openbay?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    imageCache[query] = { images: data.images || [], index: 0 };
  }
  // Cycle through images if next==true
  if (next && imageCache[query].images.length > 1) {
    imageCache[query].index = (imageCache[query].index + 1) % imageCache[query].images.length;
  }
  return imageCache[query].images[imageCache[query].index] || "";
}*/

async function buildWordTableWithPixabay(wordPairs) {
  const images = await Promise.all(wordPairs.map(pair => getOpenBayImage(pair.eng)));
  return `
    <table>
      <thead>
        <tr>
          <th>Image</th>
          <th>English</th>
          <th>Korean</th>
        </tr>
      </thead>
      <tbody>
        ${wordPairs.map((pair, i) => `
          <tr>
            <td>${images[i] ? `<img src="${images[i]}" style="width:40px;height:40px;object-fit:cover;cursor:pointer;" class="pixabay-refresh-img" data-word="${pair.eng}">` : ''}</td>
            <td>${pair.eng}</td>
            <td>${pair.kor}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function buildWordTableWithImages(wordPairs) {
  const images = await Promise.all(wordPairs.map(pair => getOpenBayImage(pair.eng)));
  return `
    <table>
      <thead>
        <tr>
          <th>Image</th>
          <th>English</th>
          <th>Korean</th>
        </tr>
      </thead>
      <tbody>
        ${wordPairs.map((pair, i) => `
          <tr>
            <td>${images[i] ? `<img src="${images[i]}" style="width:40px;height:40px;object-fit:cover;cursor:pointer;" class="pixabay-refresh-img" data-word="${pair.eng}">` : ''}</td>
            <td>${pair.eng}</td>
            <td>${pair.kor}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function applyPreviewFontStyles(preview, font, fontSizeScale) {
  preview.style.fontFamily = font;
  preview.style.fontSize = `${fontSizeScale}em`;
}
