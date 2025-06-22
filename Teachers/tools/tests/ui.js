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
    const imageType = document.getElementById('wordTestImageType')?.value || "all";
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
                <td class="toggle-word" data-index="${i}" data-lang="eng" style="padding:8px;border-bottom:1px solid #ddd;">${pair.eng}</td>
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
      // Fetch images for all words (left and right)
      const leftImages = await Promise.all(left.map(pair => getPixabayImage(pair.eng)));
      const rightImages = await Promise.all(right.map(pair => getPixabayImage(pair.eng)));

      function getImageCycleArray(word, imageUrl) {
        const emoticons = getEmoticonsForWord(word);
        if (imageType === "emoticon") return emoticons;
        if (imageType === "photo") return [imageUrl];
        // "all": emoticons first, then image if available
        return emoticons.concat(imageUrl && imageUrl.startsWith('http') ? [imageUrl] : []);
      }

      const tableHtml = `
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">#</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Image</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Word</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">#</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Image</th>
              <th style="padding:8px 8px;border-bottom:2px solid #333;">Word</th>
            </tr>
          </thead>
          <tbody>
            ${left.map((pair, i) => {
              const leftCycle = getImageCycleArray(pair.eng, leftImages[i]);
              const rightCycle = getImageCycleArray(right[i]?.eng, rightImages[i]);
              return `
                <tr>
                  <td style="padding:18px 8px; min-height:48px;">${i + 1}</td>
                  <td style="padding:18px 8px; min-height:48px;">
                    <span class="cycle-img" 
                      data-word="${pair.eng}" 
                      data-index="${i}" 
                      data-side="left"
                      data-cycle='${JSON.stringify(leftCycle)}'
                      data-cycle-pos="0"
                      style="font-size:2em;cursor:pointer;">
                      ${leftCycle[0] && leftCycle[0].startsWith("http")
                        ? `<img src="${leftCycle[0]}" style="width:40px;height:40px;object-fit:cover;">`
                        : leftCycle[0] || ""}
                    </span>
                  </td>
                  <td class="toggle-word" data-index="${i}" data-lang="eng" style="padding:18px 8px; min-height:48px;">${pair.eng}</td>
                  <td style="padding:18px 8px; min-height:48px;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                  <td style="padding:18px 8px; min-height:48px;">
                    <span class="cycle-img" 
                      data-word="${right[i]?.eng}" 
                      data-index="${i}" 
                      data-side="right"
                      data-cycle='${JSON.stringify(rightCycle)}'
                      data-cycle-pos="0"
                      style="font-size:2em;cursor:pointer;">
                      ${rightCycle[0] && rightCycle[0].startsWith("http")
                        ? `<img src="${rightCycle[0]}" style="width:40px;height:40px;object-fit:cover;">`
                        : rightCycle[0] || ""}
                    </span>
                  </td>
                  <td class="toggle-word" data-index="${i + half}" data-lang="eng" style="padding:18px 8px; min-height:48px;">${right[i]?.eng || ""}</td>
                </tr>
              `;
            }).join('')}
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

      // Image/emoticon cycler
      document.querySelectorAll('.cycle-img').forEach(span => {
        span.addEventListener('click', function() {
          let cycle = JSON.parse(this.getAttribute('data-cycle'));
          let pos = parseInt(this.getAttribute('data-cycle-pos'), 10) || 0;
          pos = (pos + 1) % cycle.length;
          this.setAttribute('data-cycle-pos', pos);
          // Update display
          if (cycle[pos] && cycle[pos].startsWith("http")) {
            this.innerHTML = `<img src="${cycle[pos]}" style="width:40px;height:40px;object-fit:cover;">`;
          } else {
            this.innerHTML = cycle[pos] || "";
          }
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

function getEmoticon(word) {
  if (/apple/i.test(word)) return "🍎";
  if (/dog/i.test(word)) return "🐶";
  if (/cat/i.test(word)) return "🐱";
  // ...add more if you want...
  return "⭐"; // fallback
}