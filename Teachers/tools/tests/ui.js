import { buildWordTableWithPixabay, maskWordPairs, hideRandomLetters } from './worksheet.js';
import { applyPreviewFontStyles, loadGoogleFont, scaleWorksheetPreview } from './fonts.js';
import { getPixabayImage, clearImageCache, imageCache } from './images.js';
import { extractWordsWithAI } from './ai.js';

const hiddenWords = {};

// Duplicate Highlighter - Shows teachers if there are duplicate words
function highlightDuplicates() {
  const wordsTextarea = document.getElementById('wordTestWords');
  if (!wordsTextarea) return;
  
  const words = wordsTextarea.value.trim();
  
  if (!words) {
    const duplicateWarning = document.getElementById('duplicateWarning');
    if (duplicateWarning) {
      duplicateWarning.style.display = 'none';
    }
    return;
  }
  
  const lines = words.split('\n').filter(line => line.trim());
  const englishWords = {};
  const duplicates = new Set();
  
  // Find duplicates
  lines.forEach((line, index) => {
    const [eng] = line.split(',').map(w => w?.trim());
    if (eng) {
      const lowerEng = eng.toLowerCase();
      if (englishWords[lowerEng]) {
        duplicates.add(lowerEng);
        duplicates.add(englishWords[lowerEng].word.toLowerCase());
      } else {
        englishWords[lowerEng] = { word: eng, index };
      }
    }
  });
  
  // Show duplicate warning if any found
  const duplicateWarning = document.getElementById('duplicateWarning');
  if (duplicates.size > 0) {
    const duplicateList = Array.from(duplicates).join(', ');
    if (duplicateWarning) {
      duplicateWarning.innerHTML = `⚠️ Duplicate words found: <strong>${duplicateList}</strong>`;
      duplicateWarning.style.display = 'block';
      duplicateWarning.style.color = '#d97706';
      duplicateWarning.style.backgroundColor = '#fef3c7';
      duplicateWarning.style.padding = '8px';
      duplicateWarning.style.borderRadius = '4px';
      duplicateWarning.style.border = '1px solid #f59e0b';
      duplicateWarning.style.marginBottom = '10px';
    }
    console.log('Duplicates found:', duplicateList);
  } else {
    if (duplicateWarning) {
      duplicateWarning.style.display = 'none';
    }
  }
}

// Helper function to find duplicate words
function findDuplicateWords(wordPairs) {
  const englishWords = {};
  const duplicates = new Set();
  
  wordPairs.forEach((pair, index) => {
    const lowerEng = pair.eng.toLowerCase();
    if (englishWords[lowerEng]) {
      duplicates.add(lowerEng);
      duplicates.add(englishWords[lowerEng].word.toLowerCase());
    } else {
      englishWords[lowerEng] = { word: pair.eng, index };
    }
  });
  
  return duplicates;
}

document.addEventListener('DOMContentLoaded', () => {
  async function updateWordTestPreview() {
    const words = document.getElementById('wordTestWords').value.trim();
    const passage = document.getElementById('wordTestPassage').value.trim();
    const preview = document.getElementById('worksheetPreviewArea-tests');
    const title = document.getElementById('wordTestTitle').value.trim() || "";
    const font = document.getElementById('wordTestFont').value || "'Poppins', sans-serif";
    const fontSizeSliderEl = document.getElementById('wordTestFontSize'); // Changed from wordTestFontSizeSlider
    const fontSizeScale = fontSizeSliderEl ? parseFloat(fontSizeSliderEl.value) : 1;
    let layout = document.getElementById('wordTestLayout')?.value || "4col"; // Default layout is "4col" (Two Lists Side by Side)
    const templateIndex = parseInt(document.getElementById('wordTestTemplate')?.value || "5", 10);
    const template = window.worksheetTemplates?.[templateIndex] || window.worksheetTemplates[5];
    const instructions = "";
    const testMode = document.getElementById('wordTestMode')?.value || "none";
    let numLettersToHide = 1;
    if (testMode === 'hide-random-letters') {
      const numInput = document.getElementById('numLettersToHide');
      if (numInput) {
        numLettersToHide = parseInt(numInput.value, 10) || 1;
      }
    }
    if (!words || !preview) {
      preview.innerHTML = "<div class='text-gray-400'>Enter or generate some words to preview worksheet.</div>";
      return;
    }

    // Sanitize and filter words to remove unwanted prefixes like numbers, dots, or asterisks
    const lines = words.split('\n').filter(line => {
      const trimmedLine = line.trim();
      return trimmedLine && trimmedLine.includes(',');
    });

    const sanitizedWords = lines.map(line => {
      // Remove unwanted prefixes (e.g., numbers, dots, asterisks)
      const cleanedLine = line.replace(/^\s*[\d*]+[.)]?\s*/, '');
      const parts = cleanedLine.split(',');
      if (parts.length < 2) return null;

      const eng = parts[0].trim();
      const kor = parts[1].trim();

      // Filter out common prompt words/phrases that might leak in
      const promptWords = ['generate', 'create', 'make', 'words', 'vocabulary', 'list', 'english', 'korean', 'please', 'can you', 'help', 'assistant'];
      const isPromptPollution = promptWords.some(word => 
        eng.toLowerCase().includes(word) || kor.toLowerCase().includes(word)
      );

      // Ensure English contains only valid characters and Korean contains Korean characters
      const validEng = /^[a-zA-Z0-9\s\-']+$/.test(eng);
      const validKor = /[가-힣]/.test(kor);

      if (!isPromptPollution && validEng && validKor && eng.length > 0 && kor.length > 0) {
        return { eng, kor };
      }
      return null;
    }).filter(pair => pair !== null);

    const wordPairs = sanitizedWords.map(pair => ({
      eng: pair.eng.replace(/[^a-zA-Z0-9\s\-']/g, '').trim(),
      kor: pair.kor.replace(/[^가-힣\s]/g, '').trim()
    })).filter(pair => pair.eng && pair.kor);

    // Find duplicates for highlighting
    const duplicateWords = findDuplicateWords(wordPairs);
    
    // Helper function to get cell style with duplicate highlighting
    const getCellStyle = (word, baseStyle) => {
      const isDuplicate = duplicateWords.has(word.toLowerCase());
      const duplicateStyle = isDuplicate ? 'background-color: #ea580c !important; color: white !important;' : '';
      return `${baseStyle}${duplicateStyle}`;
    };

    // Mask words based on test mode
    const maskedPairs = maskWordPairs(wordPairs, testMode, numLettersToHide);

    // Render table (example for images layout)
    if (layout === "images") {
      // Get slider values for image size and gap
      const imageSize = document.getElementById('testImageSizeSlider')?.value || 80;
      const imageGap = document.getElementById('testImageGapSlider')?.value || 16;
      // Pass imageSize to builder, and inject image size and gap after rendering
      let tableHtml = await buildWordTableWithPixabay(wordPairs, maskedPairs, imageSize);
      // Inject image size into all <img> tags and gap as padding-bottom on all <td> in non-header rows
      tableHtml = tableHtml.replace(/<img([^>]*)style="([^"]*)"/g, (match, attrs, style) => {
        // Ensure width and height are set from slider
        let newStyle = style.replace(/width:\d+px;/, '').replace(/height:\d+px;/, '');
        newStyle = `width:${imageSize}px;height:${imageSize}px;` + newStyle;
        return `<img${attrs}style="${newStyle}"`;
      });
      // Add padding-bottom to all <td> in non-header rows for vertical gap
      tableHtml = tableHtml.replace(/<tr(.*?)>(.*?)<\/tr>/gs, (match, attrs, inner) => {
        // Only add gap if not header row
        if (attrs.includes('th')) return match;
        // Add padding-bottom to all <td>
        const newInner = inner.replace(/<td(.*?)>/g, (tdMatch, tdAttrs) => `<td${tdAttrs} style=\"padding-bottom:${imageGap}px;\">`);
        return `<tr${attrs}>${newInner}</tr>`;
      });
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
      attachWordLockingHandlers();
      return;
    }

    // --- BASIC TABLE LAYOUT ---
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
                <td class="toggle-word" data-index="${i}" data-lang="eng" style="${getCellStyle(pair.eng, 'padding:8px;border-bottom:1px solid #ddd;')}">
                  ${pair.eng ? pair.eng : ""}
                </td>
                <td class="toggle-word" data-index="${i}" data-lang="kor" style="${getCellStyle(pair.kor, 'padding:8px;border-bottom:1px solid #ddd;')}">${pair.kor}</td>
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
      attachWordLockingHandlers();
      return;
    }

    // --- TWO LISTS LAYOUT (SIDE BY SIDE) ---
    if (layout === "4col") {
      const half = Math.ceil(maskedPairs.length / 2);
      const left = maskedPairs.slice(0, half);
      const right = maskedPairs.slice(half);
      // Pad right side to match left side length
      while (right.length < left.length) {
        right.push({ eng: "", kor: "" });
      }
      const tableHtml = `
        <table class="two-lists-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:5%;">
            <col style="width:25%;">
            <col style="width:25%;">
            <col style="width:3%;"> <!-- For the vertical divider -->
            <col style="width:5%;">
            <col style="width:25%;">
            <col style="width:25%;">
          </colgroup>
          <thead>
            <tr>
              <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">#</th>
              <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">English</th>
              <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">Korean</th>
              <th style="background:transparent;border:none;padding:0;"></th>
              <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">#</th>
              <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">English</th>
              <th style="padding:8px;border-bottom:2px solid #333;text-align:center;">Korean</th>
            </tr>
          </thead>
          <tbody>
            ${left.map((pair, i) => `
              <tr>
                <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${i + 1}</td>
                <td class="toggle-word" data-index="${i}" data-lang="eng" style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${pair.eng}</td>
                <td class="toggle-word" data-index="${i}" data-lang="kor" style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${pair.kor}</td>
                <td style="border-left:2px solid #e0e0e0;background:transparent;border-bottom:none;padding:0;"></td>
                <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                <td class="toggle-word" data-index="${i + half}" data-lang="eng" style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${right[i]?.eng || ""}</td>
                <td class="toggle-word" data-index="${i + half}" data-lang="kor" style="padding:8px;border-bottom:1px solid #ddd;text-align:center;">${right[i]?.kor || ""}</td>
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
      attachWordLockingHandlers();
      return;
    }    // --- SIX COLUMN WITH IMAGES LAYOUT ---
    // --- PICTURE TEST LAYOUT (6 COLUMNS WITH IMAGES) ---
    if (layout === "6col-images") {
      // Get controls for Picture Test - use available controls or defaults
      const imageSize = document.getElementById('testImageSizeSlider')?.value || 80;
      const imageGap = document.getElementById('testImageGapSlider')?.value || 16;
      const rowHeight = 60; // Fixed row height for Picture Test
      const textSize = 1; // Fixed text size for Picture Test
      const testMode = document.getElementById('wordTestMode')?.value || "none";
      const numLettersToHide = parseInt(document.getElementById('numLettersToHide')?.value || "1", 10);

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
          case "hide-random-letters":
            return hideRandomLetters(text, numLettersToHide);
          case "hide-random-letter":
            return text.split('').map((char, idx) => {
              if (idx === 0) return char;
              if (char.match(/[a-zA-Z]/) && Math.random() < 0.4) {
                return '_';
              }
              return char;
            }).join('');
          default:
            return text;
        }
      };

      const tableHtml = `
        <table class="picture-test-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">
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
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">#</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">Image</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">English</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">Korean</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">#</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">Image</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">English</th>
              <th style="padding:4px 2px;border-bottom:2px solid #333;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">Korean</th>
            </tr>
          </thead>
          <tbody>
            ${left.map((pair, i) => `
              <tr class="picture-test-row" style="height:${Math.max(rowHeight, parseInt(imageSize) + 12)}px;">
                <td class="picture-test-number" style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;vertical-align:middle;font-size:${0.85 * textSize}em;">${i + 1}</td>
                <td class="picture-test-image-cell" style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;vertical-align:middle;">
                  ${leftImages[i] && leftImages[i].startsWith('http')
                    ? `<img src="${leftImages[i]}" style="max-width:90%;width:${imageSize}px;height:${imageSize}px;object-fit:cover;cursor:pointer;border-radius:3px;border:1px solid #ccc;display:block;margin:0 auto;" class="pixabay-refresh-img picture-test-img" data-word="${wordPairs[i].eng}">`
                    : (leftImages[i] ? `<span style="font-size:1.5em;">${leftImages[i]}</span>` : '')}
                </td>
                <td class="toggle-word picture-test-text" data-index="${i}" data-lang="eng" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">${applyTestMode(pair.eng)}</td>
                <td class="toggle-word picture-test-text" data-index="${i}" data-lang="kor" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">${pair.kor}</td>
                <td class="picture-test-number" style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;vertical-align:middle;font-size:${0.85 * textSize}em;">${i + 1 + half <= maskedPairs.length ? i + 1 + half : ""}</td>
                <td class="picture-test-image-cell" style="padding:2px 1px;border-bottom:1px solid #ddd;text-align:center;vertical-align:middle;">
                  ${rightImages[i] && rightImages[i].startsWith('http')
                    ? `<img src="${rightImages[i]}" style="max-width:90%;width:${imageSize}px;height:${imageSize}px;object-fit:cover;cursor:pointer;border-radius:3px;border:1px solid #ccc;display:block;margin:0 auto;" class="pixabay-refresh-img picture-test-img" data-word="${wordPairs[i + half]?.eng}">`
                    : (rightImages[i] ? `<span style="font-size:1.5em;">${rightImages[i]}</span>` : '')}
                </td>
                <td class="toggle-word picture-test-text" data-index="${i + half}" data-lang="eng" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">${applyTestMode(right[i]?.eng || "")}</td>
                <td class="toggle-word picture-test-text" data-index="${i + half}" data-lang="kor" style="padding:2px 4px;border-bottom:1px solid #ddd;font-size:${0.9 * textSize}em;text-align:center;vertical-align:middle;">${right[i]?.kor || ""}</td>
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
          this.src = await getPixabayImage(word, true);
        });
      });
      attachWordLockingHandlers();
      return;
    }    // --- PICTURE QUIZ LAYOUT ---
    if (layout === "picture-quiz") {
      // Get images for all words (limit to 12)
      const limitedWordPairs = wordPairs.slice(0, 12);
      const wordImages = await Promise.all(limitedWordPairs.map(pair => getPixabayImage(pair.eng)));
      // Use testImageSizeSlider and testImageGapSlider for size and vertical gap
      const imageSize = document.getElementById('testImageSizeSlider')?.value || 140;
      const imageGap = document.getElementById('testImageGapSlider')?.value || 16;
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
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); row-gap: ${imageGap}px; column-gap: 25px; justify-items: center; align-items: start;">
          ${limitedWordPairs.map((pair, i) => `
            <div style="text-align: center; padding: 10px; display: flex; flex-direction: column; align-items: center;">
              <div style="margin-bottom: 15px; display: flex; justify-content: center; align-items: center;">
                ${wordImages[i] && wordImages[i].startsWith('http')
                  ? `<img src="${wordImages[i]}" style="width:${imageSize}px;height:${imageSize}px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid #ddd;" class="pixabay-refresh-img" data-word="${pair.eng}">`
                  : (wordImages[i] ? `<span style="font-size:4em;">${wordImages[i]}</span>` : `<div style="width:${imageSize}px;height:${imageSize}px;background:#f0f0f0;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;font-size:14px;">${pair.eng}</div>`)}
              </div>
              <div style="width: 120px; border-bottom: 2px solid #333; height: 25px; display: flex; align-items: end;"></div>
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
      // Use testImageSizeSlider and testImageGapSlider for size and vertical gap
      const imageSize = document.getElementById('testImageSizeSlider')?.value || 80;
      const imageGap = document.getElementById('testImageGapSlider')?.value || 16;
      // Shuffle the words for the right column to create a matching challenge
      const shuffledWords = [...limitedWordPairs].sort(() => Math.random() - 0.5);
      // Calculate consistent spacing based on number of items and vertical gap
      const itemHeight = Math.max(parseInt(imageSize) + 20, 60);
      const totalHeight = limitedWordPairs.length * itemHeight + (limitedWordPairs.length - 1) * parseInt(imageGap);
      const tableHtml = `        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 700px; margin: 0 auto; padding: 20px;">
          <!-- Left column - Images -->
          <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${imageGap}px;">
            ${limitedWordPairs.map((pair, i) => `
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px; margin-bottom: ${i < limitedWordPairs.length - 1 ? imageGap : 0}px;">
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
          <div style="width: 35%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; row-gap: ${imageGap}px;">
            ${shuffledWords.map((pair, i) => `
              <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px; margin-bottom: ${i < shuffledWords.length - 1 ? imageGap : 0}px;">
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
      applyPreviewFontStyles(preview, font, fontSizeScale);
      document.querySelectorAll('.pixabay-refresh-img').forEach(img => {
        img.addEventListener('click', async function() {
          const word = this.getAttribute('data-word');
          this.src = await getPixabayImage(word, true);
        });
      });
      return;
    }
    // --- PICTURE LIST LAYOUT ---
    if (layout === "picture-list") {
      // Get controls for picture list
      const imageSize = document.getElementById('testImageSizeSlider')?.value || 100;
      const imageGap = document.getElementById('testImageGapSlider')?.value || 20;
      const testMode = document.getElementById('wordTestMode')?.value || "none";
      const numLettersToHide = parseInt(document.getElementById('numLettersToHide')?.value || "1", 10);

      // Get images for all words
      const wordImages = await Promise.all(wordPairs.map(pair => getPixabayImage(pair.eng)));

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
          case "hide-random-letters":
            return hideRandomLetters(text, numLettersToHide);
          case "hide-random-letter":
            return text.split('').map((char, idx) => {
              if (idx === 0) return char;
              if (char.match(/[a-zA-Z]/) && Math.random() < 0.4) {
                return '_';
              }
              return char;
            }).join('');
          default:
            return text;
        }
      };

      const tableHtml = `
        <table class="picture-list-table" style="width:100%;border-collapse:collapse;table-layout:fixed;">
          <colgroup>
            <col style="width:8%;">   <!-- # column -->
            <col style="width:30%;">  <!-- Image column -->
            <col style="width:31%;">  <!-- English column -->
            <col style="width:31%;">  <!-- Korean column -->
          </colgroup>
          <thead>
            <tr>
              <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;vertical-align:middle;font-weight:bold;">#</th>
              <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;vertical-align:middle;font-weight:bold;">Picture</th>
              <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;vertical-align:middle;font-weight:bold;">English</th>
              <th style="padding:12px 8px;border-bottom:2px solid #333;font-size:1.1em;text-align:center;vertical-align:middle;font-weight:bold;">Korean</th>
            </tr>
          </thead>
          <tbody>
            ${wordPairs.map((pair, i) => `
              <tr class="picture-list-row" style="min-height:${Math.max(120, parseInt(imageSize) + 40)}px;">
                <td class="picture-list-number" style="padding:15px 8px;border-bottom:1px solid #ddd;text-align:center;vertical-align:middle;font-size:1.1em;font-weight:500;">${i + 1}</td>
                <td class="picture-list-image-cell" style="padding:15px 8px;border-bottom:1px solid #ddd;text-align:center;vertical-align:middle;">
                  ${wordImages[i] && wordImages[i].startsWith('http')
                    ? `<img src="${wordImages[i]}" style="max-width:90%;width:${imageSize}px;height:${imageSize}px;object-fit:cover;cursor:pointer;border-radius:8px;border:2px solid #ddd;display:block;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.1);" class="pixabay-refresh-img picture-list-img" data-word="${pair.eng}">`
                    : (wordImages[i] ? `<span style="font-size:2em;">${wordImages[i]}</span>` : `<div style="width:${imageSize}px;height:${imageSize}px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;border-radius:8px;border:2px solid #ddd;margin:0 auto;font-size:14px;color:#666;">${pair.eng}</div>`)}
                </td>
                <td class="toggle-word picture-list-text" data-index="${i}" data-lang="eng" style="padding:15px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;vertical-align:middle;line-height:1.4;font-weight:500;">${applyTestMode(pair.eng)}</td>
                <td class="toggle-word picture-list-text" data-index="${i}" data-lang="kor" style="padding:15px 12px;border-bottom:1px solid #ddd;font-size:1.1em;text-align:center;vertical-align:middle;line-height:1.4;font-weight:500;">${pair.kor}</td>
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
          this.src = await getPixabayImage(word, true);
        });
      });
      attachWordLockingHandlers();
      return;
    }

    // --- ENGLISH-KOREAN MATCHING LAYOUT ---
    if (layout === "eng-kor-matching") {
      // Get controls for matching layout
      const imageGap = document.getElementById('testImageGapSlider')?.value || 20;
      const testMode = document.getElementById('wordTestMode')?.value || "none";
      
      // Limit to reasonable number of words for matching (8-12 works well)
      const limitedWordPairs = wordPairs.slice(0, 12);
      
      // Shuffle the Korean words to create a matching challenge
      const shuffledKoreanWords = [...limitedWordPairs].map(pair => pair.kor).sort(() => Math.random() - 0.5);
      
      // Calculate consistent spacing
      const itemHeight = 50;
      const totalHeight = limitedWordPairs.length * itemHeight + (limitedWordPairs.length - 1) * parseInt(imageGap);
      
      const tableHtml = `        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; max-width: 800px; margin: 0 auto; padding: 30px 20px;">
          <!-- Left column - English words -->
          <div style="width: 40%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; gap: ${imageGap}px;">
            <div style="text-align: center; font-weight: bold; font-size: 1.2em; margin-bottom: 20px; color: #2e2b3f;">
              English
            </div>
            ${limitedWordPairs.map((pair, i) => `
              <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; height: ${itemHeight}px; margin-bottom: ${i < limitedWordPairs.length - 1 ? imageGap : 0}px;">
                <div style="padding: 15px 20px; background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; min-height: 50px; font-size: 1.1em;">
                  <span class="toggle-word" data-index="${i}" data-lang="eng" style="width: 100%; text-align: center;">${pair.eng}</span>
                </div>
                <div style="width: 20px; height: 20px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
              </div>
            `).join('')}
          </div>
          
          <!-- Middle section - connecting space -->
          <div style="width: 20%; min-height: ${totalHeight}px; position: relative; display: flex; align-items: center; justify-content: center;">
            <div style="color: #999; font-size: 16px; text-align: center; font-style: italic; line-height: 1.4;">
              Draw lines<br>to match<br>the words
            </div>
          </div>
          
          <!-- Right column - Korean words (shuffled) -->
          <div style="width: 40%; display: flex; flex-direction: column; justify-content: space-between; min-height: ${totalHeight}px; gap: ${imageGap}px;">
            <div style="text-align: center; font-weight: bold; font-size: 1.2em; margin-bottom: 20px; color: #2e2b3f;">
              한국어 (Korean)
            </div>
            ${shuffledKoreanWords.map((korWord, i) => `
              <div style="display: flex; align-items: center; justify-content: flex-start; gap: 15px; height: ${itemHeight}px; margin-bottom: ${i < shuffledKoreanWords.length - 1 ? imageGap : 0}px;">
                <div style="width: 20px; height: 20px; border: 3px solid #333; border-radius: 50%; background: white; flex-shrink: 0;"></div>
                <div style="padding: 15px 20px; background: #fff3cd; border: 2px solid #ffeaa7; border-radius: 8px; font-weight: 600; display: flex; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); flex: 1; min-height: 50px; font-size: 1.1em;">
                  <span style="width: 100%; text-align: center;">${korWord}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <!-- Instructions at the bottom -->
        <div style="margin-top: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; font-size: 0.9em; color: #666;">
          <strong>Instructions:</strong> Draw lines to connect each English word with its Korean translation.
        </div>
      `;
      
      preview.innerHTML = template.render({
        title,
        instructions: "",
        puzzle: tableHtml,
        orientation: "portrait"
      });
      applyPreviewFontStyles(preview, font, fontSizeScale);
      attachWordLockingHandlers();
      return;
    }

    // Optionally, scale the preview
    scaleWorksheetPreview();

    // Dynamically load Google Fonts if needed
    loadGoogleFont(font);

    // Attach click handlers for editing and deleting words
    attachWordLockingHandlers();
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
      } else if (layoutSelect.value === 'six-column-images-layout') {
        pictureTestControls.style.display = 'block';
      }
      
      // Show/hide remix button for Picture Matching and English-Korean Matching
      if (layoutSelect.value === 'picture-matching' || layoutSelect.value === 'eng-kor-matching') {
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

  // Set up font size slider in control panel (no duplicate creation needed)
  const fontSizeDropdown = document.getElementById('wordTestFontSize');
  const fontSizeSlider = document.getElementById('wordTestFontSize'); // Same ID as slider in control panel
  
  if (fontSizeSlider) {
    fontSizeSlider.addEventListener('input', () => {
      updateWordTestPreview();
    });
    // Set initial value
    fontSizeSlider.value = '1';
  }

  // Set up font dropdown in control panel
  const fontSelect = document.getElementById('wordTestFont');
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      updateWordTestPreview();
    });
  }

  // Set up image gap slider
  const imageGapSlider = document.getElementById('testImageGapSlider');
  if (imageGapSlider) {
    imageGapSlider.addEventListener('input', () => {
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
    'wordTestLayout',
    'wordTestTemplate',
    'wordTestMode',
    'numLettersToHide',
    'pictureQuizImageSize',
    'lineSpacingSlider',
    'pictureTestImageSize',
    'pictureTestRowHeight',
    'pictureTestTextSize',
    'pictureTestMode',
    'wordTestFontSize', // Changed from wordTestFontSizeSlider
    'testImageSizeSlider',
    'testImageGapSlider'
  ].forEach(id => {
    const el = document.getElementById(id);if (el) {
      el.addEventListener('input', updateWordTestPreview);
      el.addEventListener('change', updateWordTestPreview);
    }
  });

  // Show/hide the number of letters input based on test mode
  const modeSelect = document.getElementById('wordTestMode');
  const numGroup = document.getElementById('numLettersToHideGroup');
  if (modeSelect && numGroup) {
    modeSelect.addEventListener('change', function() {
      numGroup.style.display = (modeSelect.value === 'hide-random-letters') ? 'block' : 'none';
      updateWordTestPreview();
    });
    // Initial state
    numGroup.style.display = (modeSelect.value === 'hide-random-letters') ? 'block' : 'none';
  }

  // AI Extract Words for Word Test - Difficulty-based extraction 
  const extractBtn = document.getElementById('extractWordTestWordsBtn');
  if (extractBtn) {
    extractBtn.onclick = async () => {
      const passage = document.getElementById('wordTestPassage').value.trim();
      const numWords = parseInt(document.getElementById('wordTestNumWords').value || 10);
      const difficulty = document.getElementById('wordTestDifficulty')?.value || 'medium';
      if (!passage) return alert("Please paste a passage.");
      
      // Get existing words - all words are preserved by default now
      const existingWords = document.getElementById('wordTestWords').value.trim();
      const existingPairs = existingWords.split('\n').map(line => {
        const [eng, kor] = line.split(',').map(w => w?.trim());
        return { eng: eng || '', kor: kor || '' };
      }).filter(pair => pair.eng && pair.kor);
      
      // All existing words are preserved (they act as "locked" by default)
      const preservedPairs = existingPairs;
      
      // Calculate how many new words we need
      const wordsToExtract = Math.max(1, numWords - preservedPairs.length);
      
      extractBtn.disabled = true;
      
      try {
        const allNewPairs = [];
        const existingWordsText = preservedPairs.map(p => p.eng.toLowerCase()).join(', ');
        let difficultWordsCount = 0; // Track for logging
        
        // Check if this is a difficult level (best1 or best2) vs easier levels (word list)
        const isDifficultLevel = difficulty === 'best1' || difficulty === 'best2';
        
        if (isDifficultLevel) {
          // Two-phase extraction for difficult levels (best1 and best2)
          extractBtn.textContent = "Extracting difficult words...";
          
          // Phase 1: Extract difficult words first (60% of needed words)
          difficultWordsCount = Math.ceil(wordsToExtract * 0.6);
          if (difficultWordsCount > 0) {
            const difficultPrompt = `From this passage, extract exactly ${difficultWordsCount} DIFFICULT English vocabulary words with Korean translations. Format: english, korean (one per line). Avoid these existing words: ${existingWordsText}. Focus on advanced, complex, or challenging vocabulary that would test students' knowledge.

Passage: ${passage}`;
            
            const difficultWords = await extractWordsWithAI(difficultPrompt, difficultWordsCount, 'difficult');
            const difficultPairs = difficultWords.trim().split('\n').map(line => {
              const [eng, kor] = line.split(',').map(w => w?.trim());
              return { eng: eng || '', kor: kor || '' };
            }).filter(pair => pair.eng && pair.kor);
            
            allNewPairs.push(...difficultPairs);
          }
          
          // Phase 2: Extract intermediate words for remaining slots
          const remainingCount = wordsToExtract - allNewPairs.length;
          if (remainingCount > 0) {
            extractBtn.textContent = "Extracting intermediate words...";
            
            const usedWordsText = [...preservedPairs, ...allNewPairs].map(p => p.eng.toLowerCase()).join(', ');
            const intermediatePrompt = `From this passage, extract exactly ${remainingCount} INTERMEDIATE English vocabulary words with Korean translations. Format: english, korean (one per line). Avoid these existing words: ${usedWordsText}. Focus on moderately challenging vocabulary suitable for intermediate learners.

Passage: ${passage}`;
            
            const intermediateWords = await extractWordsWithAI(intermediatePrompt, remainingCount, 'intermediate');
            const intermediatePairs = intermediateWords.trim().split('\n').map(line => {
              const [eng, kor] = line.split(',').map(w => w?.trim());
              return { eng: eng || '', kor: kor || '' };
            }).filter(pair => pair.eng && pair.kor);
            
            allNewPairs.push(...intermediatePairs);
          }
        } else {
          // Simple extraction for easier levels (word list and other levels)
          extractBtn.textContent = "Extracting words...";
          
          const levelLabel = difficulty === 'word-list' ? 'BASIC' : 'COMMON';
          const simplePrompt = `From this passage, extract exactly ${wordsToExtract} ${levelLabel} English vocabulary words with Korean translations. Format: english, korean (one per line). Avoid these existing words: ${existingWordsText}. Focus on simple, everyday vocabulary that students can easily understand and learn.

Passage: ${passage}`;
          
          const simpleWords = await extractWordsWithAI(simplePrompt, wordsToExtract, difficulty);
          const simplePairs = simpleWords.trim().split('\n').map(line => {
            const [eng, kor] = line.split(',').map(w => w?.trim());
            return { eng: eng || '', kor: kor || '' };
          }).filter(pair => pair.eng && pair.kor);
          
          allNewPairs.push(...simplePairs);
        }
        
        // Filter out any duplicates that might have slipped through
        const existingEngWords = new Set(preservedPairs.map(p => p.eng.toLowerCase()));
        const filteredNewPairs = allNewPairs.filter(pair => 
          !existingEngWords.has(pair.eng.toLowerCase()) && 
          pair.eng && pair.kor
        );
        
        // Combine preserved pairs with new pairs
        const allPairs = [...preservedPairs, ...filteredNewPairs];
        
        // Convert back to text format
        const combinedWords = allPairs.map(pair => `${pair.eng}, ${pair.kor}`).join('\n');
        
        document.getElementById('wordTestWords').value = combinedWords;
        updateWordTestPreview();
        highlightDuplicates(); // Check for duplicates after extraction
        
        if (isDifficultLevel) {
          console.log(`Two-phase extraction complete: ${preservedPairs.length} preserved, ${filteredNewPairs.length} new words (${difficultWordsCount} difficult, ${filteredNewPairs.length - difficultWordsCount} intermediate)`);
        } else {
          console.log(`Simple extraction complete: ${preservedPairs.length} preserved, ${filteredNewPairs.length} new words`);
        }
        
      } catch (e) {
        console.error('AI extraction error:', e);
        alert("AI extraction failed. Please try again.");
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

  // Remix Button for Picture Matching and English-Korean Matching
  const remixBtn = document.getElementById('remixMatchingBtn');
  if (remixBtn) {
    remixBtn.addEventListener('click', () => {
      updateWordTestPreview(); // This will re-shuffle the words
    });
  }
  // Scale on window resize
  window.addEventListener('resize', scaleWorksheetPreview);

  // Set up event listeners for sliders in control panel (they're now in HTML)
  const testImageSizeSlider = document.getElementById('testImageSizeSlider');
  const testImageGapSlider = document.getElementById('testImageGapSlider');
  
  if (testImageSizeSlider) {
    testImageSizeSlider.addEventListener('input', () => {
      updateWordTestPreview();
    });
  }
  
  if (testImageGapSlider) {
    testImageGapSlider.addEventListener('input', () => {
      updateWordTestPreview();
    });
  }

  // Add duplicate warning element if it doesn't exist
  const wordsTextarea = document.getElementById('wordTestWords');
  if (wordsTextarea && !document.getElementById('duplicateWarning')) {
    const warningDiv = document.createElement('div');
    warningDiv.id = 'duplicateWarning';
    warningDiv.style.display = 'none';
    wordsTextarea.parentNode.insertBefore(warningDiv, wordsTextarea);
  }

  // Add Clear All button if it doesn't exist
  if (!document.getElementById('clearAllBtn')) {
    const extractBtn = document.getElementById('extractWordTestWordsBtn');
    if (extractBtn) {
      const clearAllBtn = document.createElement('button');
      clearAllBtn.id = 'clearAllBtn';
      clearAllBtn.textContent = 'Clear All';
      clearAllBtn.className = 'bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded ml-2';
      clearAllBtn.style.marginLeft = '10px';
      extractBtn.parentNode.insertBefore(clearAllBtn, extractBtn.nextSibling);
    }
  }

  // Clear All Button - Deletes everything in the word list
  const clearAllBtn = document.getElementById('clearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.onclick = () => {
      if (confirm('Are you sure you want to delete all words? This action cannot be undone.')) {
        document.getElementById('wordTestWords').value = '';
        updateWordTestPreview();
        console.log('All words cleared');
      }
    };
  }

  // Check for duplicates whenever words change
  if (wordsTextarea) {
    wordsTextarea.addEventListener('input', highlightDuplicates);
    wordsTextarea.addEventListener('change', highlightDuplicates);
  }

  // Function to attach word editing and deletion handlers
  function attachWordLockingHandlers() {
    console.log('=== ATTACH WORD EDITING/DELETION HANDLERS CALLED ===');
    const preview = document.getElementById('worksheetPreviewArea-tests');
    console.log('Preview element:', preview);
    
    const cells = document.querySelectorAll('.toggle-word');
    console.log('Found', cells.length, 'toggle-word cells');
    
    cells.forEach((cell, index) => {
      console.log(`Processing cell ${index}:`, cell.textContent.trim(), cell);
      
      // Remove any existing event listeners by cloning the node
      const newCell = cell.cloneNode(true);
      cell.parentNode.replaceChild(newCell, cell);
      
      // Make cell look clickable
      newCell.style.cursor = 'pointer';
      newCell.style.setProperty('cursor', 'pointer', 'important');
      newCell.title = 'Left-click to edit, Right-click to delete word pair';
      
      // Left click to edit inline
      newCell.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Don't edit if already editing
        if (this.querySelector('input')) return;
        
        const originalText = this.textContent.trim();
        console.log('Cell clicked for editing:', originalText);
        
        // Create input field
        const input = document.createElement('input');
        input.type = 'text';
        input.value = originalText;
        input.style.width = '100%';
        input.style.border = '1px solid #ccc';
        input.style.padding = '2px';
        input.style.fontSize = 'inherit';
        input.style.fontFamily = 'inherit';
        
        // Replace cell content with input
        this.innerHTML = '';
        this.appendChild(input);
        input.focus();
        input.select();
        
        // Save on Enter or blur
        const saveEdit = () => {
          const newText = input.value.trim();
          if (newText !== originalText) {
            updateWordInTextarea(originalText, newText, this);
          }
          this.textContent = newText || originalText;
        };
        
        // Cancel on Escape
        const cancelEdit = () => {
          this.textContent = originalText;
        };
        
        input.addEventListener('blur', saveEdit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            input.blur();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        });
      });
      
      // Right click to delete entire word pair
      newCell.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Cell right-clicked for deletion:', this.textContent.trim());
        
        // Get the data-index from this cell
        const cellIndex = parseInt(this.getAttribute('data-index'));
        const cellLang = this.getAttribute('data-lang');
        
        console.log(`Cell info: index=${cellIndex}, lang=${cellLang}`);
        
        if (!isNaN(cellIndex)) {
          // Get current words from textarea
          const wordsTextarea = document.getElementById('wordTestWords');
          const currentWords = wordsTextarea.value.trim();
          const lines = currentWords.split('\n').filter(line => line.trim());
          
          // Check if the index is valid
          if (cellIndex >= 0 && cellIndex < lines.length) {
            // Remove the word pair at this index
            const deletedLine = lines[cellIndex];
            lines.splice(cellIndex, 1);
            
            wordsTextarea.value = lines.join('\n');
            
            // Update the preview
            updateWordTestPreview();
            
            console.log(`Deleted word pair at index ${cellIndex}: ${deletedLine}`);
          } else {
            console.log(`Invalid index ${cellIndex} for deletion`);
          }
        } else {
          console.log('Could not determine cell index for deletion');
        }
      });
    });
  }

  // Helper function to update a word in the textarea when edited inline
  function updateWordInTextarea(originalText, newText, clickedCell) {
    const wordsTextarea = document.getElementById('wordTestWords');
    const currentWords = wordsTextarea.value.trim();
    
    // Get the data-index and data-lang from the clicked cell
    const cellIndex = parseInt(clickedCell.getAttribute('data-index'));
    const cellLang = clickedCell.getAttribute('data-lang');
    
    console.log(`Updating word: index=${cellIndex}, lang=${cellLang}, original="${originalText}", new="${newText}"`);
    
    if (!isNaN(cellIndex)) {
      const lines = currentWords.split('\n').filter(line => line.trim());
      
      // Check if the index is valid
      if (cellIndex >= 0 && cellIndex < lines.length) {
        const line = lines[cellIndex];
        const [eng, kor] = line.split(',').map(w => w.trim());
        
        // Update the appropriate part based on language
        let newEng = eng;
        let newKor = kor;
        
        if (cellLang === 'eng') {
          newEng = newText;
        } else if (cellLang === 'kor') {
          newKor = newText;
        }
        
        // Replace the line in the textarea
        lines[cellIndex] = `${newEng}, ${newKor}`;
        wordsTextarea.value = lines.join('\n');
        
        // Update the preview
        updateWordTestPreview();
        
        console.log(`Updated word pair at index ${cellIndex}: ${eng}, ${kor} -> ${newEng}, ${newKor}`);
      } else {
        console.log(`Invalid index ${cellIndex} for editing`);
      }
    } else {
      console.log('Could not determine cell index for editing');
    }
  }

  // Difficulty dropdown update
  const difficultyDropdown = document.getElementById('wordTestDifficulty');
  if (difficultyDropdown) {
    // Update dropdown options dynamically
    difficultyDropdown.innerHTML = `
      <option value="easy">Easy</option>
      <option value="medium">Medium</option>
      <option value="hard">Hard</option>
      <option value="x">X Hard</option>
    `;
  }

  // Remove references to Clear Locks and Test Locking buttons
  const clearLocksBtn = document.getElementById('clearLocksBtn');
  const testLockingBtn = document.getElementById('testLockingBtn');
  if (clearLocksBtn) clearLocksBtn.remove();
  if (testLockingBtn) testLockingBtn.remove();

  // Ensure handlers are attached after rendering toggle-word elements
  attachWordLockingHandlers();
}); // End of DOMContentLoaded