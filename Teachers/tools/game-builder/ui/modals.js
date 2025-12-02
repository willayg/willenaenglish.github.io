// Modal management - Open/close/save handlers for all modals
import { showTinyToast } from '../utils/dom-helpers.js';
import { getCurrentUserId, saveGameData, findGameByTitle, showTitleConflictModal } from '../services/file-service.js';
import { ensureRegenerateAudioCheckbox, ensureAudioForWordsAndSentences } from '../services/audio-service.js';
import { prepareAndUploadImagesIfNeeded } from '../services/file-service.js';
import { fetchJSONSafe } from '../utils/network.js';
import { ENDPOINTS } from '../constants.js';

/**
 * Show edit list modal
 */
export function showEditListModal(editListModal, editListRaw, list) {
  if (!editListModal) return;
  editListRaw.value = list.map(w => `${w.eng || ''}, ${w.kor || ''}`.trim()).join('\n');
  editListModal.style.display = 'flex';
}

/**
 * Hide edit list modal
 */
export function hideEditListModal(editListModal) {
  if (editListModal) editListModal.style.display = 'none';
}

/**
 * Handle save from edit list modal
 */
export function handleEditListSave(editListRaw, newRow, saveState, setList, render, toast, hideModal) {
  if (!editListRaw) return;
  const lines = editListRaw.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const newRows = lines.map(line => {
    const [eng, kor] = line.split(',').map(s => (s || '').trim());
    return newRow({ eng, kor });
  }).filter(r => r.eng);
  
  if (newRows.length) {
    saveState();
    setList(newRows);
    render();
    hideModal();
    toast('List updated');
  } else {
    toast('No valid words');
  }
}

/**
 * Open Save As modal (for new games or explicit "Save As")
 */
export function openSaveAsModal(titleEl, saveModalEl, saveModalStatusEl) {
  const titleField = document.getElementById('saveGameTitle');
  if (titleField) titleField.value = titleEl.value || '';
  if (saveModalStatusEl) saveModalStatusEl.textContent = '';
  ensureRegenerateAudioCheckbox();
  if (saveModalEl) saveModalEl.style.display = 'flex';
}

/**
 * Handle Save As modal confirm
 */
export async function handleSaveAsConfirm(titleEl, buildPayload, getCurrentGameId, setCurrentGameId, toast, cacheCurrentGame, saveModalEl, saveModalStatusEl) {
  const titleField = document.getElementById('saveGameTitle');
  const title = (titleField?.value || '').trim();
  if (!title) {
    if (saveModalStatusEl) saveModalStatusEl.textContent = 'Title required';
    return;
  }
  
  const gameImage = document.getElementById('gameImageZone').querySelector('img')?.src || '';
  const payload = buildPayload(title, gameImage);
  
  if (!payload.words || payload.words.length === 0) {
    if (saveModalStatusEl) saveModalStatusEl.textContent = 'Need at least 1 word';
    return;
  }
  
  if (saveModalStatusEl) saveModalStatusEl.textContent = 'Saving...';
  
  try {
    const currentGameId = getCurrentGameId();
    // Check for title conflict before saving
    const conflict = await findGameByTitle(title);
    if (conflict && conflict.id !== currentGameId) {
      if (saveModalEl) saveModalEl.style.display = 'none';
      await showTitleConflictModal(title, payload, setCurrentGameId, cacheCurrentGame);
      return;
    }
    
    // Prepare images before save
    await prepareAndUploadImagesIfNeeded(payload, currentGameId, { force: false });
    
    // Audio generation
    const regenCheckbox = document.getElementById('regenerateAudioCheckbox');
    const shouldRegenerateAudio = !!regenCheckbox?.checked;
    // Build examples map (word -> example) if examples exist
    const examplesMap = Object.fromEntries(
      (payload.words || [])
        .filter(w => w.eng && w.example)
        .map(w => [w.eng, w.example])
    );
    if (saveModalStatusEl) saveModalStatusEl.textContent = shouldRegenerateAudio ? 'Generating audio (force)...' : 'Ensuring audio...';
    try {
      await ensureAudioForWordsAndSentences(
        (payload.words || []).map(w => w.eng).filter(Boolean),
        examplesMap,
        {
          force: shouldRegenerateAudio,
          onInit: (total) => { if (saveModalStatusEl) saveModalStatusEl.textContent = (shouldRegenerateAudio? 'Generating':'Ensuring') + ` audio (0/${total})...`; },
          onProgress: (done, total) => { if (saveModalStatusEl) saveModalStatusEl.textContent = (shouldRegenerateAudio? 'Generating':'Ensuring') + ` audio (${done}/${total})...`; },
          onDone: () => { if (saveModalStatusEl) saveModalStatusEl.textContent = 'Audio ready. Saving...'; }
        }
      );
    } catch (e) {
      console.warn('[audio] ensure error', e);
      if (saveModalStatusEl) saveModalStatusEl.textContent = 'Audio step failed, continuing save...';
    }
    
    const result = await saveGameData(payload, currentGameId);
    if (result.success) {
      setCurrentGameId(result.id);
      titleEl.value = title;
      cacheCurrentGame(title);
      if (saveModalEl) saveModalEl.style.display = 'none';
      showTinyToast('Saved', { ms: 500 });
    } else {
      if (saveModalStatusEl) saveModalStatusEl.textContent = result.error || 'Save failed';
    }
  } catch (e) {
    console.error('[saveAs]', e);
    if (saveModalStatusEl) saveModalStatusEl.textContent = 'Save error';
  }
}

/**
 * Show file load modal
 */
export function showFileModal(fileModalEl) {
  if (fileModalEl) fileModalEl.style.display = 'flex';
}

/**
 * Hide file load modal
 */
export function hideFileModal(fileModalEl) {
  if (fileModalEl) fileModalEl.style.display = 'none';
}
