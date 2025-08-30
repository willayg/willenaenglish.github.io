// Create Game modal functionality
// Collects metadata and ensures audio exists before saving

import { preprocessTTS } from '../../../Games/Word Arcade/tts.js';

// Elements
const el = {
  modal: document.getElementById('createGameModal'),
  close: document.getElementById('createGameModalClose'),
  save: document.getElementById('createGameSave'),
  cancel: document.getElementById('createGameCancel'),
  title: document.getElementById('gameTitle'),
  cls: document.getElementById('gameClass'),
  dateDue: document.getElementById('gameDateDue'),
  book: document.getElementById('gameBook'),
  unit: document.getElementById('gameUnit'),
  desc: document.getElementById('gameDescription'),
  imageZone: document.getElementById('gameImageZone'),
  status: document.getElementById('createGameStatus'),
  titleInput: document.getElementById('titleInput'),
};

let gameImageUrl = '';

export function openCreateGameModal() {
  if (!el.modal) return;
  if (el.title) el.title.value = el.titleInput?.value || '';
  if (el.cls) el.cls.value = '';
  if (el.dateDue) el.dateDue.value = '';
  if (el.book) el.book.value = '';
  if (el.unit) el.unit.value = '';
  if (el.desc) el.desc.value = '';
  gameImageUrl = '';
  setStatus('');
  updateGameImageDisplay();
  el.modal.style.display = 'flex';
}

function closeModal() { if (el.modal) el.modal.style.display = 'none'; }
function setStatus(t) { if (el.status) el.status.textContent = t || ''; }

function updateGameImageDisplay() {
  if (!el.imageZone) return;
  if (gameImageUrl) {
    el.imageZone.innerHTML = `<img src="${gameImageUrl}" alt="Game Image" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" />`;
  } else {
    el.imageZone.innerHTML = '<span class="hint">Click to search • Drag image here</span>';
  }
}

async function searchGameImage(term) {
  if (!term) return;
  try {
    const url = new URL('/.netlify/functions/pixabay', window.location.origin);
    url.searchParams.set('q', term);
    const res = await fetch(url.toString());
    const js = await res.json();
    const img = js?.images?.[0];
    if (img) { gameImageUrl = img; updateGameImageDisplay(); }
  } catch (e) { console.warn('Pixabay error', e?.message); }
}

// Audio helpers
const isLocal = () => typeof window !== 'undefined' && /localhost|127\.0\.0\.1/i.test(window.location.hostname);
function preferredVoice() { try { const id = localStorage.getItem('ttsVoiceId'); return id && id.trim() ? id.trim() : null; } catch { return null; } }

async function checkExistingAudio(words) {
  const endpoints = isLocal()
    ? ['http://localhost:9000/.netlify/functions/get_audio_urls', '/.netlify/functions/get_audio_urls']
    : ['/.netlify/functions/get_audio_urls'];
  let lastErr = null;
  for (const url of endpoints) {
    try {
      const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) };
      if (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) init.signal = AbortSignal.timeout(12000);
      const res = await fetch(url, init);
      if (res.ok) return await res.json();
      lastErr = new Error(`get_audio_urls ${res.status}`);
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('get_audio_urls failed');
}

async function callTTS(payload) {
  const endpoints = isLocal()
    ? ['http://localhost:9000/.netlify/functions/eleven_labs_proxy', '/.netlify/functions/eleven_labs_proxy']
    : ['/.netlify/functions/eleven_labs_proxy'];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) return await res.json();
    } catch { /* try next */ }
  }
  throw new Error('All TTS endpoints failed');
}

async function uploadAudio(word, audioBase64) {
  const endpoints = isLocal()
    ? ['http://localhost:9000/.netlify/functions/upload_audio', '/.netlify/functions/upload_audio']
    : ['/.netlify/functions/upload_audio'];
  for (const url of endpoints) {
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ word, fileDataBase64: audioBase64 }) });
      if (res.ok) { const r = await res.json(); return r.url; }
    } catch { /* try next */ }
  }
  throw new Error('Upload failed');
}

async function ensureAudioForWords(words) {
  const unique = Array.from(new Set((words || []).map(w => String(w || '').trim()).filter(Boolean)));
  if (!unique.length) return { ensured: [], missing: [] };
  setStatus('Checking audio files...');
  const results = await checkExistingAudio(unique);
  const norm = (s) => String(s || '').trim().toLowerCase();
  const map = {}; Object.keys(results?.results || {}).forEach(k => { map[norm(k)] = results.results[k]; });
  const present = []; const missing = [];
  for (const w of unique) { const info = map[norm(w)]; if (info && info.exists && info.url) present.push(w); else missing.push(w); }
  if (!missing.length) return { ensured: present, missing: [] };

  let done = 0; const ensured = [...present]; const failures = []; const maxWorkers = 3;
  async function worker(items) {
    for (const word of items) {
      try {
        setStatus(`Generating audio (${++done}/${missing.length}): ${word}`);
        const text = preprocessTTS(word);
        const data = await callTTS({ text, voice_id: preferredVoice() });
        if (data && data.audio) { const url = await uploadAudio(word, data.audio); if (url) ensured.push(word); else failures.push(word); }
        else failures.push(word);
      } catch { failures.push(word); }
    }
  }
  const buckets = Array.from({ length: Math.min(maxWorkers, missing.length) }, () => []);
  missing.forEach((w, i) => buckets[i % buckets.length].push(w));
  await Promise.all(buckets.map(b => worker(b)));
  return { ensured, missing: failures };
}

export function initCreateGameModal(buildPayload) {
  if (el.close) el.close.onclick = closeModal;
  if (el.cancel) el.cancel.onclick = closeModal;

  if (el.save) el.save.onclick = async () => {
    const data = buildPayload();
    data.gameTitle = el.title?.value?.trim() || 'Untitled Game';
    data.gameClass = el.cls?.value?.trim() || '';
    data.gameDateDue = el.dateDue?.value || '';
    data.gameBook = el.book?.value?.trim() || '';
    data.gameUnit = el.unit?.value?.trim() || '';
    data.gameDescription = el.desc?.value?.trim() || '';
    data.gameImage = gameImageUrl;
    // map to schema names too
    data.class = data.gameClass;
    data.book = data.gameBook;
    data.unit = data.gameUnit;
    try {
      const uid = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || localStorage.getItem('id') || sessionStorage.getItem('id');
      if (uid) data.created_by = uid;
    } catch {}

    if (!data.title || !Array.isArray(data.words) || !data.words.length) {
      alert('Please provide a title and at least one word.');
      return;
    }

    try {
      el.save.disabled = true;
      const english = data.words.map(w => w.eng).filter(Boolean);
      await ensureAudioForWords(english);
    } catch (e) {
      console.warn('Audio prep issue:', e);
    }

    try {
      setStatus('Saving game...');
      const res = await fetch('/.netlify/functions/supabase_proxy_fixed', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'insert_game_data', data })
      });
      const js = await res.json();
      if (js?.success) { setStatus('Saved.'); alert('Game created and saved.'); closeModal(); }
      else { setStatus('Save failed'); alert('Save failed: ' + (js?.error || 'Unknown error')); }
    } catch (e) {
      console.error('Save error', e); setStatus('Save error'); alert('Save error');
    } finally {
      el.save.disabled = false; setStatus('');
    }
  };

  // Image behaviors
  if (el.imageZone) {
    el.imageZone.addEventListener('click', () => {
      const term = el.title?.value?.trim() || 'education game';
      const url = `https://pixabay.com/images/search/${encodeURIComponent(term)}/`;
      window.open(url, 'pixabayGameSearch', 'width=900,height=700');
    });
    if (el.title) el.title.addEventListener('blur', () => { const t = el.title.value?.trim(); if (t && !gameImageUrl) searchGameImage(t); });
    el.imageZone.addEventListener('dragover', (e) => { e.preventDefault(); el.imageZone.classList.add('dragover'); });
    el.imageZone.addEventListener('dragleave', () => { el.imageZone.classList.remove('dragover'); });
    el.imageZone.addEventListener('drop', (e) => {
      e.preventDefault(); el.imageZone.classList.remove('dragover');
      const files = Array.from(e.dataTransfer.files || []);
      if (files.length) { const file = files[0]; if (file.type && file.type.startsWith('image/')) { const r = new FileReader(); r.onload = (ev) => { gameImageUrl = ev.target.result; updateGameImageDisplay(); }; r.readAsDataURL(file); return; } }
      const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (text && /^https?:\/\//i.test(text.trim())) { gameImageUrl = text.trim(); updateGameImageDisplay(); }
    });
  }
}
