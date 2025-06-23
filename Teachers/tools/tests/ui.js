import { buildWordTableWithPixabay, maskWordPairs } from './worksheet.js';
import { applyPreviewFontStyles, loadGoogleFont, scaleWorksheetPreview } from './fonts.js';
import { getPixabayImage, clearImageCache, imageCache } from './images.js';
import { extractWordsWithAI } from './ai.js';

const hiddenWords = {};

document.addEventListener('DOMContentLoaded', () => {
  async function updateWordTestPreview() {
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
    const testMode = document.getElementById('wordTestMode')?.value || "none";
    if (!words || !preview) {
      preview.innerHTML = "<div class='text-gray-400'>Enter or generate some words to preview worksheet.</div>";
      return;
    }

    // Split lines, then split each line into English and Korean
    const wordPairs = words.split('\n').map(line => {
      const [eng, kor] = line.split(',').map(w => w.trim());
      return { eng: eng || '', kor: kor || '' };
    }).filter(pair => pair.eng && pair.kor);

    // Mask words based on test mode
    const maskedPairs = maskWordPairs(wordPairs, testMode);

    // Render table (example for images layout)
    if (layout === "images") {
      const tableHtml = await buildWordTableWithPixabay(maskedPairs);
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
          this.src = await getPixabayImage(word, true);
        });
      });
      return;
    }

    // --- DEFAULT TABLE LAYOUT ---
    if (layout === "default") {
      const tableHtml = `
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <thead>
            <tr>
              <th style="width:10%;padding:8px;border-bottom:2px solid #333;">#</th>
              <th style="width:45%;padding:8px;border-bottom:2px solid #333;">English</th>
              <th style="width:45%;padding:8px;border-bottom:2px solid #333;">Korean</th>
            </tr>
          </thead>
          <tbody>
            ${maskedPairs.map((pair, i) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;">${i + 1}</td>
                <td class="toggle-word" data-index="${i}" data-lang="eng" style="padding:8px;border-bottom:1px solid #ddd;">
                  ${pair.eng ? pair.eng : ""}
                </td>
                <td class="toggle-word" data-index="${i}" data-lang="kor" style="padding:8px;border-bottom:1px solid #ddd;">${pair.kor}</td>
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
      return;
    }

    // --- 4 COLUMN LAYOUT ---
    if (layout === "4col") {
      const half = Math.ceil(maskedPairs.length / 2);
      const left = maskedPairs.slice(0, half);
      const right = maskedPairs.slice(half);
      // Pad right side to match left side length
      while (right.length < left.length) {
        right.push({ eng: "", kor: "" });
      }
      const tableHtml = `
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:7%;">
            <col style="width:28%;">
            <col style="width:28%;">
            <col style="width:2%;"> <!-- For the vertical divider -->
            <col style="width:7%;">
            <col style="width:28%;">
            <col style="width:28%;">
          </colgroup>
          <thead>
            <tr>
              <th>#</th>
              <th>English</th>
              <th>Korean</th>
              <th style="background:transparent;border:none;"></th>
              <th>#</th>
              <th>English</th>
              <th>Korean</th>
            </tr>
          </thead>
          <tbody>
            ${left.map((pair, i) => `
              <tr>
                <td>${i + 1}</td>
                <td class="toggle-word" data-index="${i}" data-lang="eng">${pair.eng}</td>
                <td class="toggle-word" data-index="${i}" data-lang="kor">${pair.kor}</td>
                <td style="border-left:2px solid #e0e0e0;background:transparent;"></td>
                <td>${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                <td class="toggle-word" data-index="${i + half}" data-lang="eng">${right[i]?.eng || ""}</td>
                <td class="toggle-word" data-index="${i + half}" data-lang="kor">${right[i]?.kor || ""}</td>
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
      return;
    }

    // --- 6 COLUMN WITH IMAGES LAYOUT ---
    if (layout === "6col-images") {
      const half = Math.ceil(maskedPairs.length / 2);
      const left = maskedPairs.slice(0, half);
      const right = maskedPairs.slice(half);
      // Pad right side to match left side length
      while (right.length < left.length) {
        right.push({ eng: "", kor: "" });
      }
      // Use original wordPairs for images (not maskedPairs)
      const leftImages = await Promise.all(wordPairs.slice(0, half).map(pair => getPixabayImage(pair.eng)));
      const rightImages = await Promise.all(wordPairs.slice(half).map(pair => getPixabayImage(pair.eng)));

      const tableHtml = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">#</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Image</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">English</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Korean</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">#</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Image</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">English</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Korean</th>
            </tr>
          </thead>
          <tbody>
            ${left.map((pair, i) => `
              <tr>
                <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${i + 1}</td>
                <td style="padding:8px 8px;border-bottom:1px solid #ddd;">
                  ${leftImages[i] && leftImages[i].startsWith('http')
                    ? `<img src="${leftImages[i]}" style="width:55px;height:55px;object-fit:cover;cursor:pointer;" class="pixabay-refresh-img" data-word="${wordPairs[i].eng}">`
                    : (leftImages[i] ? `<span style="font-size:2em;">${leftImages[i]}</span>` : '')}
                </td>
                <td class="toggle-word" data-index="${i}" data-lang="eng" style="padding:8px 8px;border-bottom:1px solid #ddd;">${pair.eng}</td>
                <td class="toggle-word" data-index="${i}" data-lang="kor" style="padding:8px 8px;border-bottom:1px solid #ddd;">${pair.kor}</td>
                <td style="padding:8px 8px;border-bottom:1px solid #ddd;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                <td style="padding:8px 8px;border-bottom:1px solid #ddd;">
                  ${rightImages[i] && rightImages[i].startsWith('http')
                    ? `<img src="${rightImages[i]}" style="width:55px;height:55px;object-fit:cover;cursor:pointer;" class="pixabay-refresh-img" data-word="${wordPairs[i + half]?.eng}">`
                    : (rightImages[i] ? `<span style="font-size:2em;">${rightImages[i]}</span>` : '')}
                </td>
                <td class="toggle-word" data-index="${i + half}" data-lang="eng" style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.eng || ""}</td>
                <td class="toggle-word" data-index="${i + half}" data-lang="kor" style="padding:8px 8px;border-bottom:1px solid #ddd;">${right[i]?.kor || ""}</td>
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

      // Attach click handler for refresh
      document.querySelectorAll('.pixabay-refresh-img').forEach(img => {
        img.addEventListener('click', async function() {
          const word = this.getAttribute('data-word');
          this.src = await getPixabayImage(word, true);
        });
      });
      return;
    }

    // Optionally, scale the preview
    scaleWorksheetPreview();

    // Dynamically load Google Fonts if needed
    loadGoogleFont(font);

    // Attach click-to-hide for words
    document.querySelectorAll('.toggle-word').forEach(cell => {
      cell.addEventListener('click', function() {
        const key = `${this.dataset.index}-${this.dataset.lang}`;
        hiddenWords[key] = !hiddenWords[key];
        updateWordTestPreview();
      });
    });
  }

  // Example save function
  async function saveWorksheet(worksheetData) {
    const { data, error } = await supabase
      .from('worksheets')
      .insert([worksheetData]);
    if (error) {
      console.error('Error saving worksheet:', error);
      // Show error to user
    } else {
      console.log('Worksheet saved:', data);
      // Show success to user
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
    'wordTestTemplate',
    'wordTestMode'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', updateWordTestPreview);
      el.addEventListener('change', updateWordTestPreview);
    }
  });

  // AI Extract Words for Word Test
  const extractBtn = document.getElementById('extractWordTestWordsBtn');
  if (extractBtn) {
    extractBtn.onclick = async () => {
      const passage = document.getElementById('wordTestPassage').value.trim();
      const numWords = document.getElementById('wordTestNumWords').value || 10;
      if (!passage) return alert("Please paste a passage.");
      extractBtn.disabled = true;
      extractBtn.textContent = "Extracting...";
      try {
        const aiWords = await extractWordsWithAI(passage, numWords);
        document.getElementById('wordTestWords').value = aiWords.trim();
        updateWordTestPreview();
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
      clearImageCache();
      updateWordTestPreview();
    });
  }

  // Scale on window resize
  window.addEventListener('resize', scaleWorksheetPreview);
});