// Worksheet import service
import { newRow, saveState, setList, getList } from '../state/game-state.js';
import { loadImagesForMissingOnly } from '../images.js';
import { ensureLoadingOverlay } from '../utils/dom-helpers.js';

export function loadWorksheetIntoBuilder(worksheet, { titleEl, enablePicturesEl, enableDefinitionsEl, enableExamplesEl, generateDefinitionsForMissing, generateExamplesForMissing, loadingImages, render, toast }) {
  try {
    const wordsField = worksheet?.words;
    let rows = [];
    try {
      const possibleTitle = (worksheet && (worksheet.title || worksheet.name || worksheet.worksheet_title || worksheet.game_title || worksheet.sheet_title)) || '';
      if (possibleTitle && titleEl) titleEl.value = possibleTitle;
    } catch {}

    if (Array.isArray(wordsField)) {
      rows = wordsField.map(w => normaliseWord(w)).filter(Boolean);
    } else if (typeof wordsField === 'string') {
      let parsed = null; try { parsed = JSON.parse(wordsField); } catch {}
  if (Array.isArray(parsed)) rows = parsed.map(w => normaliseWord(w)).filter(Boolean);
      else {
        const parts = wordsField.includes('\n') ? wordsField.split('\n') : wordsField.split(',');
        rows = parts.map(s => {
          const [eng, kor] = s.split(',').map(t => (t || '').trim());
            return newRow({ eng, kor });
        }).filter(r => r.eng);
      }
    }

    if (rows.length === 0) { toast('No words found in selected worksheet'); return; }

    saveState();
    setList(rows);
    render();
    (async () => {
      const list = getList();
      if (enablePicturesEl?.checked) await loadImagesForMissingOnly(list, loadingImages, render);
      if (enableDefinitionsEl?.checked) await generateDefinitionsForMissing();
      if (enableExamplesEl?.checked) await generateExamplesForMissing();
    })();
    toast('Imported from Worksheet Manager');
  } catch (e) {
    console.error('[worksheet-service] import error', e);
    toast('Import failed');
  }
}

function normaliseWord(w){
  if (!w) return null;
  if (typeof w === 'string') {
    const [eng, kor] = w.split(',').map(s => s.trim());
    return newRow({ eng, kor });
  }
  const img = w.image_url || w.image || w.img || w.img_url || w.picture || '';
  return newRow({
    eng: w.eng || w.en || '',
    kor: w.kor || w.kr || w.translation || '',
    image_url: img,
    definition: w.definition || '',
    example: w.example || ''
  });
}
