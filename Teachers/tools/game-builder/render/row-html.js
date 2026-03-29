// Row rendering - Generate HTML for word table rows
import { generateImageDropZoneHTML } from '../images.js';
import { escapeHtml } from '../utils/dom-helpers.js';

/**
 * Build HTML for a single word row
 * @param {Object} word - Word object
 * @param {number} index - Row index
 * @param {boolean} isLoading - Whether image is loading
 * @returns {string} HTML string
 */
export function buildRowHTML(word, index, isLoading) {
  const dzInner = generateImageDropZoneHTML(word, index, isLoading, escapeHtml);
  return `
    <td>${index + 1}</td>
    <td><input class="row-input" data-field="eng" data-idx="${index}" value="${escapeHtml(word.eng)}" placeholder="English" /></td>
    <td><input class="row-input" data-field="kor" data-idx="${index}" value="${escapeHtml(word.kor)}" placeholder="Korean" /></td>
    <td>
      <div class="drop-zone" data-idx="${index}">
        ${dzInner}
      </div>
    </td>
    <td>
      <div style="display:flex; gap:8px; align-items:center;">
        <textarea class="row-input def-textarea" data-field="definition" data-idx="${index}" rows="3" placeholder="Definition (optional)">${escapeHtml(word.definition || '')}</textarea>
        <button class="btn small refresh-btn" data-action="refresh-def" data-idx="${index}" title="Regenerate definition">↻</button>
      </div>
    </td>
    <td>
      <div class="example-stack-cell">
        <textarea class="row-input ex-textarea" data-field="example" data-idx="${index}" rows="3" placeholder="Example sentence (English)">${escapeHtml(word.example || '')}</textarea>
        <div class="example-row-actions">
          <button class="btn small refresh-btn" data-action="refresh-example" data-idx="${index}" title="Regenerate example">↻</button>
          <button class="btn small play-sentence-btn" data-action="play-sentence" data-idx="${index}" title="Preview sentence audio">
            <span class="play-icon">▶</span>
          </button>
        </div>
        <textarea class="row-input ex-kor-textarea" data-field="ex_kor" data-idx="${index}" rows="2" placeholder="Example sentence (Korean)">${escapeHtml(word.ex_kor || '')}</textarea>
      </div>
    </td>
    <td>
      <button class="btn small icon" title="Remove" aria-label="Remove" data-action="delete" data-idx="${index}">×</button>
    </td>
  `;
}

/**
 * Apply CSS classes to table based on toggle state
 */
export function applyTableToggles(enablePicturesEl, enableDefinitionsEl, enableExamplesEl, enableSentenceKorEl) {
  const wordTable = document.querySelector('.word-table');
  if (!wordTable) return;
  
  if (enablePicturesEl && !enablePicturesEl.checked) {
    wordTable.classList.add('hide-images');
  } else {
    wordTable.classList.remove('hide-images');
  }
  if (enableDefinitionsEl && !enableDefinitionsEl.checked) {
    wordTable.classList.add('hide-definitions');
  } else {
    wordTable.classList.remove('hide-definitions');
  }
  if (enableExamplesEl && !enableExamplesEl.checked) {
    wordTable.classList.add('hide-examples');
  } else {
    wordTable.classList.remove('hide-examples');
  }
  if (enableSentenceKorEl && !enableSentenceKorEl.checked) {
    wordTable.classList.add('hide-example-kor');
  } else {
    wordTable.classList.remove('hide-example-kor');
  }
}
