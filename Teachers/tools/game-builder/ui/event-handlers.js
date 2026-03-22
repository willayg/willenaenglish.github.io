// Event handlers - Wire toolbar buttons and UI actions
import { showTinyToast, ensureLoadingOverlay } from '../utils/dom-helpers.js';
import { DEFAULTS } from '../constants.js';
import { generateDefinition, generateExample } from '../services/ai-service.js?v=20260322n';
import { openSaveAsModal, handleSaveAsConfirm, showFileModal } from './modals.js';
import { ensureAudioForWordsAndSentences } from '../services/audio-service.js';
import { prepareAndUploadImagesIfNeeded, saveGameData } from '../services/file-service.js?v=20260322n';

/**
 * Quick save handler (silent overwrite if ID exists, else open Save As)
 */
export async function handleQuickSave(ev, buildPayload, getCurrentGameId, setCurrentGameId, titleEl, toast, options = {}) {
  const { silent = false } = options || {};
  const title = titleEl.value || DEFAULTS.TITLE;
  const gameImage = document.getElementById('gameImageZone').querySelector('img')?.src || '';
  const payload = buildPayload(title, gameImage);
  const currentGameId = getCurrentGameId();
  
  if (!payload.title || payload.words.length === 0) {
    if (!silent) toast('Need title and at least 1 word');
    return { success: false, error: 'Need title and at least 1 word' };
  }
  
  // First-time save -> open modal
  if (!currentGameId) {
    if (silent) {
      return { success: false, requiresInitialSave: true, error: 'No current file id' };
    }
    const saveModalEl = document.getElementById('saveModal');
    const saveModalStatusEl = document.getElementById('saveModalStatus');
    openSaveAsModal(titleEl, saveModalEl, saveModalStatusEl);
    return { success: false, requiresInitialSave: true };
  }
  
  // Otherwise overwrite
  const saveLink = document.getElementById('saveLink');
  if (saveLink) saveLink.classList.add('disabled');
  
  try {
    await prepareAndUploadImagesIfNeeded(payload, currentGameId, { force: !!(ev && ev.shiftKey) });
    const js = await saveGameData(payload, currentGameId);
    if (js?.success && js?.id && typeof setCurrentGameId === 'function' && js.id !== currentGameId) {
      setCurrentGameId(js.id);
    }
    
    if (js?.success) {
      if (!silent) showTinyToast('Saved', { ms: 500 });
      // Fire-and-forget ensure missing audio (non-force) after successful save
      try {
        const words = (payload.words || []).map(w => w.eng).filter(Boolean);
        const examplesMap = Object.fromEntries((payload.words || []).filter(w => w.eng && w.example).map(w => [w.eng, w.example]));
        // slight delay to keep UI responsive
        setTimeout(() => {
          ensureAudioForWordsAndSentences(words, examplesMap, { force: false })
            .catch(e => console.debug('[quickSave][audio] skipped', e?.message));
        }, 50);
      } catch (e) { console.debug('[quickSave][audio] init error', e?.message); }
      return { success: true, id: js?.id || currentGameId };
    } else {
      if (!silent) showTinyToast(js?.error || 'Save failed', { variant: 'error', ms: 3000 });
      return { success: false, error: js?.error || 'Save failed' };
    }
  } catch (e) {
    console.error(e);
    if (!silent) showTinyToast('Save error', { variant: 'error', ms: 3000 });
    return { success: false, error: e?.message || 'Save error' };
  } finally {
    if (saveLink) saveLink.classList.remove('disabled');
  }
}

/**
 * Preview button handler
 */
export function handlePreview(buildPayload, titleEl) {
  const title = titleEl.value || DEFAULTS.TITLE;
  const gameImage = document.getElementById('gameImageZone').querySelector('img')?.src || '';
  const data = buildPayload(title, gameImage);
  console.log('Preview JSON', data);
  alert(JSON.stringify(data, null, 2));
}

/**
 * Add word button handler
 */
export function handleAddWord(saveState, getList, setList, newRow, render) {
  const current = getList();
  saveState();
  const updated = [...current, newRow()];
  setList(updated);
  render();
}

/**
 * Undo button handler
 */
export function handleUndo(undoState, render) {
  undoState();
  render();
}

/**
 * Redo button handler
 */
export function handleRedo(redoState, render) {
  redoState();
  render();
}

/**
 * Get translations for missing Korean words
 */
export async function handleGetTranslations(getList, setList, render, toast) {
  const list = getList();
  const targets = list.filter(w => w.eng && !w.kor);
  if (!targets.length) { toast('No words need translation'); return; }
  toast('Translating...');
  const overlay = ensureLoadingOverlay();
  overlay.show('Translating ' + targets.length + ' words...');
  try {
    // Build a single prompt asking for a JSON array mapping english->korean
    const words = targets.map(w => w.eng.trim()).slice(0, 50); // safety cap
    const prompt = `Provide Korean translations for these English words as compact JSON array of objects with keys eng and kor only. No commentary. Words: ${words.join(', ')}`;
    const res = await fetch(ENDPOINTS.TRANSLATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    const js = await res.json().catch(()=>null);
    let result = js?.result || js?.data?.choices?.[0]?.message?.content || '';
    // Attempt to extract JSON
    let parsed = null;
    const match = result.match(/\[[\s\S]*\]/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch {}
    } else {
      try { parsed = JSON.parse(result); } catch {}
    }
    if (Array.isArray(parsed)) {
      const map = new Map(parsed.filter(o=>o && o.eng).map(o=>[o.eng.toLowerCase(), o.kor]));
      for (const w of targets) {
        const tr = map.get(w.eng.toLowerCase());
        if (tr && !w.kor) w.kor = tr;
      }
      setList([...list]);
      render();
      toast('Translated');
    } else {
      console.warn('[translate] Could not parse JSON from OpenAI result', result);
      toast('Translate parse fail');
    }
  } catch (e) {
    console.error(e);
    toast('Translation error');
  } finally { overlay.hide(); }
}

/**
 * Generate definitions for rows missing them
 */
export async function handleGenerateDefinitions(getList, setList, render, toast) {
  const list = getList();
  const missing = list.filter(w => w.eng && !w.definition);
  if (!missing.length) {
    toast('No definitions needed');
    return;
  }
  
  toast('Generating definitions...');
  const overlay = ensureLoadingOverlay();
  overlay.show('Generating ' + missing.length + ' definitions...');
  
  try {
    for (const w of missing) {
      const def = await generateDefinition(w.eng);
      if (def) w.definition = def;
    }
    setList([...list]);
    render();
    toast('Definitions complete');
  } catch (e) {
    console.error(e);
    toast('Definition error');
  } finally {
    overlay.hide();
  }
}

/**
 * Generate examples for rows missing them
 */
export async function handleGenerateExamples(getList, setList, render, toast) {
  const list = getList();
  const missing = list.filter(w => w.eng && !w.example);
  if (!missing.length) {
    toast('No examples needed');
    return;
  }
  
  toast('Generating examples...');
  const overlay = ensureLoadingOverlay();
  overlay.show('Generating ' + missing.length + ' examples...');
  
  try {
    for (const w of missing) {
      const ex = await generateExample(w.eng);
      if (ex) w.example = ex;
    }
    setList([...list]);
    render();
    toast('Examples complete');
  } catch (e) {
    console.error(e);
    toast('Example error');
  } finally {
    overlay.hide();
  }
}
