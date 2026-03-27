// Modal management - Open/close/save handlers for all modals
import { showTinyToast } from '../utils/dom-helpers.js';
import { getCurrentUserId, ensureSentenceIdsBuilder, saveGameData, findGameByTitle, showTitleConflictModal, generateIncrementedTitle } from '../services/file-service.js?v=20260328a';
import { ensureRegenerateAudioCheckbox, ensureAudioForWordsAndSentences } from '../services/audio-service.js';
import { prepareAndUploadImagesIfNeeded } from '../services/file-service.js?v=20260328a';
import { fetchJSONSafe } from '../utils/network.js';
import { ENDPOINTS } from '../constants.js';
import { syncImagesFromPayload } from '../state/game-state.js';

let saveAsInFlight = false;

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
  if (saveAsInFlight) {
    if (saveModalStatusEl) saveModalStatusEl.textContent = 'Save already in progress...';
    return;
  }
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
  saveAsInFlight = true;
  const firstSave = !getCurrentGameId();

  const operation = (async () => {
    const currentGameId = getCurrentGameId();
    let targetGameId = currentGameId;
    let resolvedTitle = title;
    // Check for title conflict before saving
    const conflict = await findGameByTitle(title);
    if (conflict && conflict.id !== currentGameId) {
      const choice = await showTitleConflictModal(title);
      if (choice === 'cancel') {
        if (saveModalStatusEl) saveModalStatusEl.textContent = 'Save cancelled';
        return;
      }
      if (choice === 'overwrite') {
        targetGameId = conflict.id;
        if (saveModalStatusEl) saveModalStatusEl.textContent = 'Overwriting existing game...';
      }
      if (choice === 'increment') {
        resolvedTitle = await generateIncrementedTitle(title);
        payload.title = resolvedTitle;
        if (titleField) titleField.value = resolvedTitle;
        if (saveModalStatusEl) saveModalStatusEl.textContent = `Saving as ${resolvedTitle}...`;
      }
    }
    
    const sentResult = await ensureSentenceIdsBuilder(payload.words || []);
    console.log('[saveAs] ensureSentenceIdsBuilder result:', sentResult,
      'words with sentence IDs:', (payload.words || []).filter(w => w.primary_sentence_id).length, '/', (payload.words || []).length);

    // Prepare images before save
    await prepareAndUploadImagesIfNeeded(payload, targetGameId, { force: false });
    syncImagesFromPayload(payload);
    
    // Audio generation
    const regenCheckbox = document.getElementById('regenerateAudioCheckbox');
    const shouldRegenerateAudio = !!regenCheckbox?.checked;
    // Build examples map (word -> sentence) from all supported fields
    const examplesMap = Object.fromEntries(
      (payload.words || [])
        .filter(w => w && w.eng)
        .map(w => {
          const sentenceFromArray = Array.isArray(w.sentences) && w.sentences.length
            ? (w.sentences.find(s => typeof s?.text === 'string' && s.text.trim())?.text || '')
            : '';
          const sentence = String(w.example || w.legacy_sentence || sentenceFromArray || '').trim();
          return [w.eng, sentence];
        })
        .filter(([, sentence]) => !!sentence)
    );
    if (saveModalStatusEl) saveModalStatusEl.textContent = shouldRegenerateAudio ? 'Generating audio (force)...' : 'Ensuring audio...';
    try {
      await ensureAudioForWordsAndSentences(
        (payload.words || []).map(w => w.eng).filter(Boolean),
        examplesMap,
        {
          force: shouldRegenerateAudio,
          skipSentenceAudio: true,
          onInit: (total) => { if (saveModalStatusEl) saveModalStatusEl.textContent = (shouldRegenerateAudio? 'Generating':'Ensuring') + ` audio (0/${total})...`; },
          onProgress: (done, total) => { if (saveModalStatusEl) saveModalStatusEl.textContent = (shouldRegenerateAudio? 'Generating':'Ensuring') + ` audio (${done}/${total})...`; },
          onDone: () => { if (saveModalStatusEl) saveModalStatusEl.textContent = 'Audio ready. Saving...'; }
        }
      );
    } catch (e) {
      console.warn('[audio] ensure error', e);
      if (saveModalStatusEl) saveModalStatusEl.textContent = 'Audio step failed, continuing save...';
    }
    
    const result = await saveGameData(payload, targetGameId);
    if (result.success) {
      setCurrentGameId(result.id);
      titleEl.value = resolvedTitle;
      cacheCurrentGame(resolvedTitle);
      if (typeof window !== 'undefined' && typeof window.__gbInvalidateFileListCache === 'function') {
        window.__gbInvalidateFileListCache();
      }
      if (saveModalEl) saveModalEl.style.display = 'none';
      if (typeof window.showSaveCenterMessage === 'function') {
        window.showSaveCenterMessage('Saved', { variant: 'success', ms: 1400 });
      } else {
        showTinyToast('Saved', { ms: 500 });
      }
    } else {
      if (saveModalStatusEl) saveModalStatusEl.textContent = result.error || 'Save failed';
    }
  } catch (e) {
    console.error('[saveAs]', e);
    if (saveModalStatusEl) saveModalStatusEl.textContent = e?.message ? `Save error: ${e.message}` : 'Save error';
  } finally {
    saveAsInFlight = false;
  }
  })();

  if (firstSave && typeof window !== 'undefined' && typeof window.__gbSetFirstSaveCompletionPromise === 'function') {
    window.__gbSetFirstSaveCompletionPromise(operation);
  }
  await operation;
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
