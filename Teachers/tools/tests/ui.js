import { buildWordTableWithPixabay, maskWordPairs, hideRandomLetters } from './worksheet.js';
import { applyPreviewFontStyles, loadGoogleFont, scaleWorksheetPreview } from './fonts.js';
import { getPixabayImage, clearImageCache, imageCache } from './images.js';
import { extractWordsWithAI } from './ai.js';

const hiddenWords = {};
const lockedWords = new Set(); // Track locked words that should be preserved

document.addEventListener('DOMContentLoaded', () => {
  async function updateWordTestPreview() {
    const words = document.getElementById('wordTestWords').value.trim();
    const passage = document.getElementById('wordTestPassage').value.trim();
    const preview = document.getElementById('worksheetPreviewArea-tests');
    const title = document.getElementById('wordTestTitle').value.trim() || "";
    const font = document.getElementById('wordTestFont').value || "'Poppins', sans-serif";
    const fontSizeSliderEl = document.getElementById('wordTestFontSizeSlider');
    const fontSizeScale = fontSizeSliderEl ? parseFloat(fontSizeSliderEl.value) : 1;
    let layout = document.getElementById('wordTestLayout')?.value || "basic-table-layout";    const templateIndex = parseInt(document.getElementById('wordTestTemplate')?.value || "5", 10);
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

    // Split lines, then split each line into English and Korean
    const wordPairs = words.split('\n').map(line => {
      const [eng, kor] = line.split(',').map(w => w.trim());
      return { eng: eng || '', kor: kor || '' };
    }).filter(pair => pair.eng && pair.kor);

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
      // Attach word locking handlers
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
      // Attach word locking handlers
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
      // Attach word locking handlers
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
      // Attach word locking handlers
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
      // Attach word locking handlers
      attachWordLockingHandlers();
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
      // Attach word locking handlers
      attachWordLockingHandlers();
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
      // Attach word locking handlers
      attachWordLockingHandlers();
      return;
    }

    // Optionally, scale the preview
    scaleWorksheetPreview();

    // Dynamically load Google Fonts if needed
    loadGoogleFont(font);

    // Attach click-to-hide for words and word locking (right-click or ctrl+click)
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

  // Replace font size dropdown with a slider
  const fontSizeDropdown = document.getElementById('wordTestFontSize');
  if (fontSizeDropdown && !document.getElementById('wordTestFontSizeSlider')) {
    // Hide the dropdown
    fontSizeDropdown.style.display = 'none';
    // Insert the slider after the dropdown
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'mb-2';
    sliderWrapper.innerHTML = `
      <label for="wordTestFontSizeSlider" class="block font-semibold mb-1">Font Size</label>
      <div class="flex items-center gap-2 mb-2">
        <span style="font-size:0.9em;">Small</span>
        <input type="range" id="wordTestFontSizeSlider" min="0.6" max="2.0" step="0.01" value="1" style="vertical-align:middle; width: 120px;">
        <span id="wordTestFontSizeValue">1.00x</span>
        <span style="font-size:1.2em;">Large</span>
      </div>
    `;
    fontSizeDropdown.parentNode.insertBefore(sliderWrapper, fontSizeDropdown.nextSibling);
    // Listen for slider changes
    const fontSizeSlider = document.getElementById('wordTestFontSizeSlider');
    const fontSizeValue = document.getElementById('wordTestFontSizeValue');
    fontSizeSlider.addEventListener('input', () => {
      fontSizeValue.textContent = parseFloat(fontSizeSlider.value).toFixed(2) + 'x';
      fontSizeDropdown.value = fontSizeSlider.value; // keep in sync for code
      updateWordTestPreview();
    });
    // Sync slider with dropdown value on load
    fontSizeSlider.value = fontSizeDropdown.value || '1';
    fontSizeValue.textContent = parseFloat(fontSizeSlider.value).toFixed(2) + 'x';
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
    'wordTestFontSizeSlider'
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

  // AI Extract Words for Word Test
  const extractBtn = document.getElementById('extractWordTestWordsBtn');
  if (extractBtn) {
    extractBtn.onclick = async () => {
      const passage = document.getElementById('wordTestPassage').value.trim();
      const numWords = document.getElementById('wordTestNumWords').value || 10;
      const difficulty = document.getElementById('wordTestDifficulty')?.value || 'medium';
      if (!passage) return alert("Please paste a passage.");
      
      // Get existing words and preserve locked ones
      const existingWords = document.getElementById('wordTestWords').value.trim();
      const existingPairs = existingWords.split('\n').map(line => {
        const [eng, kor] = line.split(',').map(w => w?.trim());
        return { eng: eng || '', kor: kor || '' };
      }).filter(pair => pair.eng && pair.kor);
      
      // Filter out locked words from existing pairs
      const lockedPairs = existingPairs.filter(pair => 
        lockedWords.has(pair.eng) || lockedWords.has(pair.kor)
      );
      
      // Calculate how many new words we need
      const wordsToExtract = Math.max(1, numWords - lockedPairs.length);
      
      extractBtn.disabled = true;
      extractBtn.textContent = "Extracting...";
      try {
        const aiWords = await extractWordsWithAI(passage, wordsToExtract, difficulty);
        
        // Parse AI-generated words
        const newPairs = aiWords.trim().split('\n').map(line => {
          const [eng, kor] = line.split(',').map(w => w?.trim());
          return { eng: eng || '', kor: kor || '' };
        }).filter(pair => pair.eng && pair.kor);
        
        // Combine locked pairs with new pairs
        const allPairs = [...lockedPairs, ...newPairs];
        
        // Convert back to text format
        const combinedWords = allPairs.map(pair => `${pair.eng}, ${pair.kor}`).join('\n');
        
        document.getElementById('wordTestWords').value = combinedWords;
        updateWordTestPreview();
        
        if (lockedPairs.length > 0) {
          console.log(`Preserved ${lockedPairs.length} locked words, extracted ${newPairs.length} new words`);
        }
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

  // Add image size and gap sliders to the tests panel controls (after layout selector)
  const testsPanel = document.getElementById('panel-tests');
  if (testsPanel && !document.getElementById('testImageSizeSlider')) {
    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'mb-2';
    sliderWrapper.innerHTML = `
      <label for="testImageSizeSlider" class="block font-semibold mb-1">Image Size</label>
      <div class="flex items-center gap-2 mb-2">
        <input type="range" id="testImageSizeSlider" min="40" max="200" value="80" style="vertical-align:middle;">
        <span id="testImageSizeValue">80px</span>
      </div>
      <label for="testImageGapSlider" class="block font-semibold mb-1">Image Gap</label>
      <div class="flex items-center gap-2 mb-2">
        <input type="range" id="testImageGapSlider" min="0" max="80" value="16" style="vertical-align:middle;">
        <span id="testImageGapValue">16px</span>
      </div>
    `;
    // Insert after the layout selector
    const layoutSelect = document.getElementById('wordTestLayout');
    if (layoutSelect && layoutSelect.parentNode) {
      layoutSelect.parentNode.insertBefore(sliderWrapper, layoutSelect.nextSibling);
    } else {
      testsPanel.appendChild(sliderWrapper);
    }
    // Listen for slider changes
    const testImageSizeSlider = document.getElementById('testImageSizeSlider');
    const testImageSizeValue = document.getElementById('testImageSizeValue');
    testImageSizeSlider.addEventListener('input', () => {
      testImageSizeValue.textContent = testImageSizeSlider.value + 'px';
      updateWordTestPreview();
    });
    const testImageGapSlider = document.getElementById('testImageGapSlider');
    const testImageGapValue = document.getElementById('testImageGapValue');
    testImageGapSlider.addEventListener('input', () => {
      testImageGapValue.textContent = testImageGapSlider.value + 'px';
      updateWordTestPreview();
    });
  }

  // Clear Locks Button
  const clearLocksBtn = document.getElementById('clearLocksBtn');
  if (clearLocksBtn) {
    clearLocksBtn.onclick = () => {
      lockedWords.clear();
      updateWordTestPreview();
      console.log('All word locks cleared');
    };
  }

  // Test Locking Button
  const testLockingBtn = document.getElementById('testLockingBtn');
  if (testLockingBtn) {
    testLockingBtn.onclick = () => {
      console.log('=== TESTING WORD LOCKING ===');
      const cells = document.querySelectorAll('.toggle-word');
      console.log('Found', cells.length, 'toggle-word cells for testing');
      
      cells.forEach((cell, index) => {
        const style = window.getComputedStyle(cell);
        console.log(`Cell ${index}: text="${cell.textContent.trim()}", cursor="${style.cursor}", classes="${cell.className}"`);
      });
      
      if (cells.length > 0) {
        console.log('Forcing attachment of handlers...');
        attachWordLockingHandlers();
      }
    };
  }

  // Function to attach word locking handlers
  function attachWordLockingHandlers() {
    console.log('=== ATTACH WORD LOCKING HANDLERS CALLED ===');
    const preview = document.getElementById('worksheetPreviewArea-tests');
    console.log('Preview element:', preview);
    
    const cells = document.querySelectorAll('.toggle-word');
    console.log('Found', cells.length, 'toggle-word cells');
    console.log('Cells:', cells);
    
    cells.forEach((cell, index) => {
      console.log(`Processing cell ${index}:`, cell.textContent.trim(), cell);
      
      // Check current styles
      const computedStyle = window.getComputedStyle(cell);
      console.log(`Cell ${index} cursor style:`, computedStyle.cursor);
      
      // Remove any existing event listeners by cloning the node
      const newCell = cell.cloneNode(true);
      cell.parentNode.replaceChild(newCell, cell);
      
      // Force cursor style
      newCell.style.cursor = 'pointer';
      newCell.style.setProperty('cursor', 'pointer', 'important');
      console.log(`Cell ${index} after setting cursor:`, newCell.style.cursor);
      
      // Left click to lock/unlock words
      newCell.addEventListener('click', function(e) {
        e.stopPropagation();
        console.log('Cell clicked:', this.textContent.trim());
        
        const wordText = this.textContent.trim();
        if (wordText) {
          if (lockedWords.has(wordText)) {
            lockedWords.delete(wordText);
            this.classList.remove('locked');
            this.style.backgroundColor = '';
            this.style.border = '';
            this.title = '';
            console.log('Unlocked word:', wordText);
          } else {
            lockedWords.add(wordText);
            this.classList.add('locked');
            this.style.backgroundColor = '#e3f2fd';
            this.style.border = '2px solid #2196f3';
            this.title = 'Locked - will be preserved during AI extraction';
            console.log('Locked word:', wordText);
          }
          console.log('All locked words:', Array.from(lockedWords));
        }
      });
      
      // Right-click to lock/unlock words
      newCell.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('Cell right-clicked:', this.textContent.trim());
        
        const wordText = this.textContent.trim();
        if (wordText) {
          if (lockedWords.has(wordText)) {
            lockedWords.delete(wordText);
            this.classList.remove('locked');
            this.style.backgroundColor = '';
            this.style.border = '';
            this.title = '';
            console.log('Unlocked word (right-click):', wordText);
          } else {
            lockedWords.add(wordText);
            this.classList.add('locked');
            this.style.backgroundColor = '#e3f2fd';
            this.style.border = '2px solid #2196f3';
            this.title = 'Locked - will be preserved during AI extraction';
            console.log('Locked word (right-click):', wordText);
          }
          console.log('All locked words:', Array.from(lockedWords));
        }
      });
      
      // Apply locked styling if word is already locked
      const wordText = newCell.textContent.trim();
      if (wordText && lockedWords.has(wordText)) {
        newCell.classList.add('locked');
        newCell.style.backgroundColor = '#e3f2fd';
        newCell.style.border = '2px solid #2196f3';
        newCell.title = 'Locked - will be preserved during AI extraction';
      }
      
      // Make sure the cell looks clickable
      newCell.style.cursor = 'pointer';
    });
  }

}); // End of DOMContentLoaded