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
    const layout = document.getElementById('wordTestLayout')?.value || "default";    const templateIndex = parseInt(document.getElementById('wordTestTemplate')?.value || "5", 10);
    const template = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[5];
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
    }    // --- 6 COLUMN WITH IMAGES LAYOUT ---
    if (layout === "6col-images") {
      // Get controls for Picture Test
      const imageSize = document.getElementById('pictureTestImageSize')?.value || 55;
      const rowHeight = document.getElementById('pictureTestRowHeight')?.value || 60;
      const textSizeScale = parseFloat(document.getElementById('pictureTestTextSize')?.value || "1.0");
      const testMode = document.getElementById('pictureTestMode')?.value || "none";
      
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

      // Apply test mode transformations to text
      const applyTestMode = (text) => {
        if (!text || testMode === "none") return text;
        
        switch (testMode) {
          case "hide-random":
            return text.split('').map(char => {
              if (char.match(/[a-zA-Z]/) && Math.random() < 0.3) {
                return '_';
              }
              return char;
            }).join('');
          case "hide-vowels":
            return text.replace(/[aeiouAEIOU]/g, '_');
          case "hide-consonants":
            return text.replace(/[bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]/g, '_');
          default:
            return text;
        }
      };

      const tableHtml = `
        <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:5%;">   <!-- # column -->
            <col style="width:20%;">  <!-- Image column -->
            <col style="width:20%;">  <!-- English column -->
            <col style="width:20%;">  <!-- Korean column -->
            <col style="width:5%;">   <!-- # column -->
            <col style="width:20%;">  <!-- Image column -->
            <col style="width:20%;">  <!-- English column -->
            <col style="width:20%;">  <!-- Korean column -->
          </colgroup>
          <thead>
            <tr>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">#</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">Image</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">English</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">Korean</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">#</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">Image</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">English</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSizeScale}em;text-align:center;">Korean</th>
            </tr>
          </thead>
          <tbody>
            ${left.map((pair, i) => `
              <tr style="height:${rowHeight}px;">
                <td style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;font-size:${0.85 * textSizeScale}em;">${i + 1}</td>
                <td style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;">
                  ${leftImages[i] && leftImages[i].startsWith('http')
                    ? `<img src="${leftImages[i]}" style="width:${Math.round(imageSize * 1.8)}px;height:${imageSize}px;object-fit:cover;cursor:pointer;border-radius:3px;border:1px solid #ccc;" class="pixabay-refresh-img" data-word="${wordPairs[i].eng}">`
                    : (leftImages[i] ? `<span style="font-size:1.5em;">${leftImages[i]}</span>` : '')}
                </td>
                <td class="toggle-word" data-index="${i}" data-lang="eng" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSizeScale}em;text-align:center;">${applyTestMode(pair.eng)}</td>
                <td class="toggle-word" data-index="${i}" data-lang="kor" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSizeScale}em;text-align:center;">${pair.kor}</td>
                <td style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;font-size:${0.85 * textSizeScale}em;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                <td style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;">
                  ${rightImages[i] && rightImages[i].startsWith('http')
                    ? `<img src="${rightImages[i]}" style="width:${Math.round(imageSize * 1.8)}px;height:${imageSize}px;object-fit:cover;cursor:pointer;border-radius:3px;border:1px solid #ccc;" class="pixabay-refresh-img" data-word="${wordPairs[i + half]?.eng}">`
                    : (rightImages[i] ? `<span style="font-size:1.5em;">${rightImages[i]}</span>` : '')}
                </td>
                <td class="toggle-word" data-index="${i + half}" data-lang="eng" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSizeScale}em;text-align:center;">${applyTestMode(right[i]?.eng || "")}</td>
                <td class="toggle-word" data-index="${i + half}" data-lang="kor" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSizeScale}em;text-align:center;">${right[i]?.kor || ""}</td>              </tr>
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
        });      });
      return;
    }    // --- PICTURE QUIZ LAYOUT ---
    if (layout === "picture-quiz") {
      // Get images for all words (limit to 12)
      const limitedWordPairs = wordPairs.slice(0, 12);
      const wordImages = await Promise.all(limitedWordPairs.map(pair => getPixabayImage(pair.eng)));
      
      // Get current image size from slider or default
      const imageSize = document.getElementById('pictureQuizImageSize')?.value || 140;
      
      // Check if we should hide English words
      const shouldHideEnglish = testMode === 'hide-eng';
      
      const tableHtml = `
        <!-- Compact Word Box - Hide if English is hidden -->
        ${!shouldHideEnglish ? `
        <div style="margin-bottom: 15px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; background: #f9f9f9;">
          <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: center;">
            ${limitedWordPairs.map(pair => `
              <span style="padding: 2px 6px; background: #fff; border: 1px solid #ddd; border-radius: 3px; font-size: 0.8em;">${pair.eng}</span>
            `).join('')}
          </div>
        </div>
        ` : ''}
        
        <!-- Pictures section -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 25px; justify-items: center; align-items: start;">
          ${limitedWordPairs.map((pair, i) => `
            <div style="text-align: center; padding: 10px; display: flex; flex-direction: column; align-items: center;">
              <div style="margin-bottom: 15px; display: flex; justify-content: center; align-items: center;">
                ${wordImages[i] && wordImages[i].startsWith('http')
                  ? `<img src="${wordImages[i]}" style="width:${imageSize}px;height:${imageSize}px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid #ddd;" class="pixabay-refresh-img" data-word="${pair.eng}">`
                  : (wordImages[i] ? `<span style="font-size:4em;">${wordImages[i]}</span>` : `<div style="width:${imageSize}px;height:${imageSize}px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;font-size:14px;">${pair.eng}</div>`)}
              </div>
              <div style="width: 120px; border-bottom: 2px solid #333; height: 25px; display: flex; align-items: end;">
              </div>
            </div>
          `).join('')}
        </div>
      `;
      
      preview.innerHTML = template.render({
        title,
        instructions: "",
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
    }    // --- PICTURE MATCHING LAYOUT ---
    if (layout === "picture-matching") {
      // Get images for all words (limit to 8 for better layout)
      const limitedWordPairs = wordPairs.slice(0, 8);
      const wordImages = await Promise.all(limitedWordPairs.map(pair => getPixabayImage(pair.eng)));
      
      // Get current image size from slider or default
      const imageSize = document.getElementById('pictureQuizImageSize')?.value || 80;
      
      // Get current line spacing from slider or default
      const lineSpacing = document.getElementById('lineSpacingSlider')?.value || 25;
      
      // Shuffle the words for the right column to create a matching challenge
      const shuffledWords = [...limitedWordPairs].sort(() => Math.random() - 0.5);
      
      // Calculate consistent spacing based on number of items and line spacing
      const itemHeight = Math.max(parseInt(imageSize) + 20, 60);
      const totalHeight = limitedWordPairs.length * itemHeight + (limitedWordPairs.length - 1) * parseInt(lineSpacing);
        const tableHtml = `        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 700px; margin: 0 auto; padding: 20px;">
          <!-- Left column - Images -->
          <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px;">
            ${limitedWordPairs.map((pair, i) => `
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px;">
                <div style="display: flex; align-items: center;">
                  ${wordImages[i] && wordImages[i].startsWith('http')
                    ? `<img src="${wordImages[i]}" style="width:${imageSize}px;height:${imageSize}px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid #ddd;box-shadow:0 2px 4px rgba(0,0,0,0.1);" class="pixabay-refresh-img" data-word="${pair.eng}">`
                    : (wordImages[i] ? `<span style="font-size:${imageSize * 0.8}px;">${wordImages[i]}</span>` : `<div style="width:${imageSize}px;height:${imageSize}px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;font-size:12px;">${pair.eng}</div>`)}
                </div>
                <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
              </div>
            `).join('')}
          </div>
          
          <!-- Middle section - connecting space -->
          <div style="width: 30%; min-height: ${totalHeight}px; position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="color: #ccc; font-size: 14px; text-align: center; font-style: italic;">
              Draw lines<br>to connect
            </div>
          </div>
          
          <!-- Right column - Words -->
          <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px;">
            ${shuffledWords.map((pair, i) => `
              <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px;">
                <div style="width: 16px; height: 16px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                <div style="padding: 12px 16px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); flex: 1;">
                  ${pair.eng}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
      
      preview.innerHTML = template.render({
        title,
        instructions: "",
        puzzle: tableHtml,
        orientation: "portrait"
      });
      applyPreviewFontStyles(preview, font, fontSizeScale);      // Attach click handler for refresh
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
  }  // Picture Quiz Controls
  const layoutSelect = document.getElementById('wordTestLayout');
  const pictureQuizControls = document.getElementById('pictureQuizControls');
  const pictureTestControls = document.getElementById('pictureTestControls');
  const remixMatchingControls = document.getElementById('remixMatchingControls');
  const imageSizeSlider = document.getElementById('pictureQuizImageSize');
  const sizeValueSpan = document.getElementById('pictureSizeValue');

  // Show/hide controls based on layout selection
  if (layoutSelect && pictureQuizControls && pictureTestControls) {
    layoutSelect.addEventListener('change', () => {
      // Hide all control panels first
      pictureQuizControls.style.display = 'none';
      pictureTestControls.style.display = 'none';
      remixMatchingControls.style.display = 'none';
      
      // Show appropriate controls based on layout
      if (layoutSelect.value === 'picture-quiz' || layoutSelect.value === 'picture-matching') {
        pictureQuizControls.style.display = 'block';
      } else if (layoutSelect.value === '6col-images') {
        pictureTestControls.style.display = 'block';
      }
      
      // Show/hide remix button for Picture Matching
      if (layoutSelect.value === 'picture-matching') {
        remixMatchingControls.style.display = 'block';
      }
    });
  }

  // Update size value display and trigger preview update
  if (imageSizeSlider && sizeValueSpan) {
    imageSizeSlider.addEventListener('input', () => {
      sizeValueSpan.textContent = imageSizeSlider.value + 'px';
      updateWordTestPreview();
    });
  }

  // Font size slider with value display
  const fontSizeSlider = document.getElementById('wordTestFontSize');
  const fontSizeValue = document.getElementById('fontSizeValue');
  if (fontSizeSlider && fontSizeValue) {
    fontSizeSlider.addEventListener('input', () => {
      fontSizeValue.textContent = fontSizeSlider.value + 'x';
      updateWordTestPreview();
    });
  }

  // Picture Test Controls
  const pictureTestImageSize = document.getElementById('pictureTestImageSize');
  const pictureTestSizeValue = document.getElementById('pictureTestSizeValue');
  const pictureTestRowHeight = document.getElementById('pictureTestRowHeight');
  const pictureTestRowHeightValue = document.getElementById('pictureTestRowHeightValue');
  const pictureTestTextSize = document.getElementById('pictureTestTextSize');
  const pictureTestTextSizeValue = document.getElementById('pictureTestTextSizeValue');

  if (pictureTestImageSize && pictureTestSizeValue) {
    pictureTestImageSize.addEventListener('input', () => {
      pictureTestSizeValue.textContent = pictureTestImageSize.value + 'px';
      updateWordTestPreview();
    });
  }

  if (pictureTestRowHeight && pictureTestRowHeightValue) {
    pictureTestRowHeight.addEventListener('input', () => {
      pictureTestRowHeightValue.textContent = pictureTestRowHeight.value + 'px';
      updateWordTestPreview();
    });
  }

  if (pictureTestTextSize && pictureTestTextSizeValue) {
    pictureTestTextSize.addEventListener('input', () => {
      pictureTestTextSizeValue.textContent = pictureTestTextSize.value + 'x';
      updateWordTestPreview();
    });
  }
  // Line spacing slider functionality for Picture Matching
  const lineSpacingSlider = document.getElementById('lineSpacingSlider');
  const lineSpacingValue = document.getElementById('lineSpacingValue');
  if (lineSpacingSlider && lineSpacingValue) {
    lineSpacingSlider.addEventListener('input', () => {
      lineSpacingValue.textContent = lineSpacingSlider.value + 'px';
      updateWordTestPreview();
    });
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
    'wordTestMode',
    'pictureQuizImageSize',
    'lineSpacingSlider',
    'pictureTestImageSize',
    'pictureTestRowHeight',
    'pictureTestTextSize',
    'pictureTestMode'
  ].forEach(id => {
    const el = document.getElementById(id);if (el) {
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

  // Make the function globally accessible for loadWorksheet
  window.updateWordTestPreview = updateWordTestPreview;
  // Refresh Images Button
  const refreshBtn = document.getElementById('refreshImagesBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      clearImageCache();
      updateWordTestPreview();
    });
  }

  // Remix Button for Picture Matching
  const remixBtn = document.getElementById('remixMatchingBtn');
  if (remixBtn) {
    remixBtn.addEventListener('click', () => {
      updateWordTestPreview(); // This will re-shuffle the words
    });
  }
  // Scale on window resize
  window.addEventListener('resize', scaleWorksheetPreview);
}); // End of DOMContentLoaded