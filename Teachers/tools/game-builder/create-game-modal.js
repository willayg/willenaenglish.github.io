// Create Game Modal (Rebuilt)
// -------------------------------------------------------------
// This version introduces a simple state machine with THREE panels:
// 1. Start Panel: Choose between "Play Live" or "Assign Homework".
// 2. Live Panel: Grid of large mode tiles (all modes active except Level Up).
// 3. Homework Panel: Original form fields (class, due date, etc.) for assignment creation.
//
// All modes are wired except Level Up.
// Selecting a mode creates a live game via a Netlify function and then shows a QR overlay linking to play.html.
// Level Up remains a placeholder with disabled styling for future implementation.
//
// CSS classes added (see styles.css under the Create Game Modal rebuild section):
// .cgm-panel, .cgm-start-panel, .cgm-live-panel, .cgm-homework-panel, .cgm-live-grid,
// .cgm-mode-tile, .cgm-mode-tile.active, .cgm-mode-tile.disabled, etc.
// -------------------------------------------------------------

import { preprocessTTS } from '../../../Games/Word Arcade/tts.js';

// -------------------------------------------------------------
// State & Utility
// -------------------------------------------------------------
let currentPanel = 'start'; // 'start' | 'live' | 'homework'
let selectedLiveMode = null; // will hold e.g., 'multi_choice_eng_to_kor'
let buildPayloadRef = null; // reference to builder's payload function (captured in init)

// Elements (legacy references retained for homework form reuse)
const el = {
  modal: document.getElementById('createGameModal'),
  close: document.getElementById('createGameModalClose'),
  // Homework actions (reuse existing buttons OR will be dynamically injected later if missing)
  save: document.getElementById('createGameSave'),
  live: document.getElementById('createGameLive'), // now repurposed: may be hidden; live launching via mode tile instead
  cancel: document.getElementById('createGameCancel'),
  // Form inputs
  title: document.getElementById('gameTitle'),
  cls: document.getElementById('gameClass'),
  dateDue: document.getElementById('gameDateDue'),
  book: document.getElementById('gameBook'),
  unit: document.getElementById('gameUnit'),
  desc: document.getElementById('gameDescription'),
  imageZone: document.getElementById('gameImageZone'),
  status: document.getElementById('createGameStatus'),
  titleInput: document.getElementById('titleInput'),
  // Panel containers (will be created if not present)
  panelStart: null,
  panelLive: null,
  panelHomework: null,
  liveGrid: null
};

let gameImageUrl = '';

// -------------------------------------------------------------
// Panel Construction Helpers
// -------------------------------------------------------------
function ensurePanels() {
  if (!el.modal) return;
  const body = el.modal.querySelector('.modal-body');
  if (!body) return;

  // Clear existing body content ONLY the first time we rebuild structure
  if (!el.panelStart && !el.panelLive && !el.panelHomework) {
    body.innerHTML = '';

    // START PANEL
    const start = document.createElement('div');
    start.className = 'cgm-panel cgm-start-panel active';
    start.innerHTML = `
      <div style="text-align:center;margin-top:10px;">
        <h3 style="margin:4px 0 14px;font-size:1.35rem;color:#19777e;font-weight:800;">Create Game</h3>
        <p style="margin:0 0 28px;font-size:.9rem;color:#475569;">Choose how you want to use this word list right now.</p>
      </div>
      <div class="cgm-choice-buttons">
        <button class="cgm-choice-btn play" data-action="go-live">Play Live</button>
        <button class="cgm-choice-btn hw" data-action="go-homework">Assign Homework</button>
      </div>
    `;

    // LIVE PANEL
    const live = document.createElement('div');
    live.className = 'cgm-panel cgm-live-panel';
    live.innerHTML = `
      <div class="cgm-live-header">
        <button class="cgm-back-btn" data-action="back-start" aria-label="Back to choice">← Back</button>
        <h4>Select a Live Mode</h4>
        <div style="flex:1;"></div>
      </div>
      <div class="cgm-live-grid" id="cgmLiveGrid"></div>
      <div class="cgm-hint">Active: <strong>All modes except Level Up</strong> (Level Up is a placeholder).</div>
    `;

    // HOMEWORK PANEL
    const hw = document.createElement('div');
    hw.className = 'cgm-panel cgm-homework-panel';
    hw.innerHTML = `
      <div class="cgm-live-header">
        <button class="cgm-back-btn" data-action="back-start" aria-label="Back to choice">← Back</button>
        <h4>Assign Homework</h4>
        <div style="flex:1;"></div>
      </div>
      <form class="cgm-home-form" id="cgmHomeworkForm" autocomplete="off">
        <div class="wide">
          <label style="font-weight:600;font-size:.8rem;letter-spacing:.5px;">Game Title</label>
          <input id="gameTitle" class="input" placeholder="Enter game title" />
        </div>
        <div>
          <label style="font-weight:600;font-size:.8rem;">Class</label>
          <input id="gameClass" class="input" placeholder="e.g., Grade 3A" />
        </div>
        <div>
          <label style="font-weight:600;font-size:.8rem;">Date Due</label>
          <input id="gameDateDue" type="date" class="input" />
        </div>
        <div>
          <label style="font-weight:600;font-size:.8rem;">Book</label>
            <input id="gameBook" class="input" placeholder="English Book 1" />
        </div>
        <div>
          <label style="font-weight:600;font-size:.8rem;">Unit</label>
            <input id="gameUnit" class="input" placeholder="Unit 3" />
        </div>
        <div class="wide">
          <label style="font-weight:600;font-size:.8rem;">Description (optional)</label>
          <textarea id="gameDescription" class="input" style="min-height:70px;resize:vertical;" placeholder="Brief description"></textarea>
        </div>
        <div class="wide">
          <label style="font-weight:600;font-size:.8rem;">Game Image</label>
          <div id="gameImageZone" class="drop-zone"><span class="hint">Click to search • Drag image here</span></div>
        </div>
        <div class="cgm-home-actions wide">
          <span id="createGameStatus" style="flex:1;color:#64748b;font-size:.8rem;align-self:center;"></span>
          <button type="button" id="createGameSave" class="btn primary">Save Assignment</button>
          <button type="button" id="createGameCancel" class="btn">Cancel</button>
        </div>
      </form>
    `;

    body.appendChild(start);
    body.appendChild(live);
    body.appendChild(hw);

    // Update element references that were recreated inside homework form
    el.panelStart = start;
    el.panelLive = live;
    el.panelHomework = hw;
    el.liveGrid = live.querySelector('#cgmLiveGrid');
    el.title = hw.querySelector('#gameTitle');
    el.cls = hw.querySelector('#gameClass');
    el.dateDue = hw.querySelector('#gameDateDue');
    el.book = hw.querySelector('#gameBook');
    el.unit = hw.querySelector('#gameUnit');
    el.desc = hw.querySelector('#gameDescription');
    el.imageZone = hw.querySelector('#gameImageZone');
    el.status = hw.querySelector('#createGameStatus');
    el.save = hw.querySelector('#createGameSave');
    el.cancel = hw.querySelector('#createGameCancel');
  }
}

// Switch visible panel
function showPanel(name) {
  currentPanel = name;
  [el.panelStart, el.panelLive, el.panelHomework].forEach(p => { if (p) p.classList.remove('active'); });
  if (name === 'start' && el.panelStart) el.panelStart.classList.add('active');
  if (name === 'live' && el.panelLive) el.panelLive.classList.add('active');
  if (name === 'homework' && el.panelHomework) el.panelHomework.classList.add('active');
}

// Build live mode tiles (all active except Level Up)
function buildLiveTiles() {
  if (!el.liveGrid) return;
  if (el.liveGrid.childElementCount) return; // build once
  const modes = [
    { key:'multi_choice_eng_to_kor', label:'Multiple Choice', desc:'English → Korean', active:true },
    { key:'picture_multi_choice', label:'Picture Match', desc:'Image → Word', active:true },
    { key:'listening_multi_choice', label:'Listening', desc:'Hear → Choose', active:true },
    { key:'multi_choice_kor_to_eng', label:'Multi Choice', desc:'Korean → English', active:true },
    { key:'easy_picture', label:'Audio → Picture', desc:'Listen then choose', active:true },
    { key:'listen_and_spell', label:'Listen & Spell', desc:'Type what you hear', active:true },
    { key:'spelling', label:'Spelling', desc:'Basic spelling drill', active:true },
    { key:'meaning', label:'Meaning', desc:'Word → Definition', active:true },
    { key:'level_up', label:'Level Up', desc:'Progression mode', active:false }
  ];
  modes.forEach(m => {
    const div = document.createElement('div');
    div.className = 'cgm-mode-tile ' + (m.active ? 'active' : 'disabled');
    div.dataset.mode = m.key;
    div.innerHTML = `
      <div class="cgm-mode-name">${m.label}</div>
      <div class="cgm-mode-desc">${m.desc}</div>
      <div class="cgm-tag">${m.active ? 'PLAY' : 'SOON'}</div>
    `;
    if (m.active) {
      div.addEventListener('click', () => {
        selectedLiveMode = m.key;
        launchLiveMode();
      });
    }
    el.liveGrid.appendChild(div);
  });
}

export function openCreateGameModal() {
  if (!el.modal) return;
  showPanel('start');
  // Prefill title from builder main input
  if (el.title) el.title.value = el.titleInput?.value || '';
  // Reset homework fields
  if (el.cls) el.cls.value = '';
  if (el.dateDue) el.dateDue.value = '';
  if (el.desc) el.desc.value = '';
  const imgInZone = el.imageZone?.querySelector('img');
  gameImageUrl = imgInZone?.getAttribute('src') || '';
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

// -------------------------------------------------------------
// Image Handling
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// Audio helpers (unchanged logic apart from comments grouping)
// -------------------------------------------------------------
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
  // Capture external payload builder for live launches
  buildPayloadRef = buildPayload;
  // Basic close/cancel wiring once panels exist
  if (el.close) el.close.onclick = closeModal;
  if (el.cancel) el.cancel.onclick = closeModal;

  // Pre-build panels and tiles for faster modal opening
  ensurePanels();
  buildLiveTiles();

  // Delegate clicks inside modal for navigation & actions
  document.addEventListener('click', (e) => {
    if (!el.modal || el.modal.style.display !== 'flex') return;
    const startVisible = currentPanel === 'start';
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    if (!action) return;
    if (action === 'go-live') { showPanel('live'); }
    else if (action === 'go-homework') { showPanel('homework'); }
    else if (action === 'back-start') { showPanel('start'); }
  });

  // Homework save handler (assignment creation)
  const attachSave = () => {
    if (!el.save) return;
    if (el.save._bound) return;
    el.save._bound = true;
    el.save.onclick = async () => {
      // Build payload from external builder function
      const data = buildPayload();
      data.modes = data.modes && data.modes.length ? data.modes : ['multi_choice_eng_to_kor'];
      data.gameTitle = el.title?.value?.trim() || 'Untitled Game';
      data.gameClass = el.cls?.value?.trim() || '';
      data.gameDateDue = el.dateDue?.value || '';
      data.gameBook = el.book?.value?.trim() || '';
      data.gameUnit = el.unit?.value?.trim() || '';
      data.gameDescription = el.desc?.value?.trim() || '';
      data.gameImage = gameImageUrl;
      data.class = data.gameClass; data.book = data.gameBook; data.unit = data.gameUnit;
      try { const uid = localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || localStorage.getItem('id') || sessionStorage.getItem('id'); if (uid) data.created_by = uid; } catch {}
      if (!data.title || !Array.isArray(data.words) || !data.words.length) { alert('Need title and at least one word.'); return; }
      try { el.save.disabled = true; const english = data.words.map(w => w.eng).filter(Boolean); await ensureAudioForWords(english); } catch {}
      try {
        setStatus('Saving assignment...');
        const res = await fetch('/.netlify/functions/supabase_proxy_fixed', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'insert_game_data', data }) });
        const js = await res.json();
        if (js?.success) { setStatus('Saved.'); alert('Homework assignment saved.'); closeModal(); }
        else { setStatus('Save failed'); alert('Save failed: ' + (js?.error || 'Unknown error')); }
      } catch (err) { console.error(err); setStatus('Save error'); alert('Save error'); }
      finally { el.save.disabled = false; setStatus(''); }
    };
  };

  // Setup image behaviors after panels exist
  const attachImageHandlers = () => {
    if (!el.imageZone) return;
    if (el.imageZone._bound) return;
    el.imageZone._bound = true;
    el.imageZone.addEventListener('click', () => {
      const term = el.title?.value?.trim() || 'education game';
      const url = `https://pixabay.com/images/search/${encodeURIComponent(term)}/`;
      window.open(url, 'pixabayGameSearch', 'width=900,height=700');
    });
    if (el.title) el.title.addEventListener('blur', () => { const t = el.title.value?.trim(); if (t && !gameImageUrl) searchGameImage(t); });
    el.imageZone.addEventListener('dragover', (ev) => { ev.preventDefault(); el.imageZone.classList.add('dragover'); });
    el.imageZone.addEventListener('dragleave', () => { el.imageZone.classList.remove('dragover'); });
    el.imageZone.addEventListener('drop', (ev) => {
      ev.preventDefault(); el.imageZone.classList.remove('dragover');
      const files = Array.from(ev.dataTransfer.files || []);
      if (files.length) {
        const file = files[0];
        if (file.type && file.type.startsWith('image/')) {
          const r = new FileReader();
          r.onload = (e2) => { gameImageUrl = e2.target.result; updateGameImageDisplay(); };
          r.readAsDataURL(file); return;
        }
      }
      const text = ev.dataTransfer.getData('text/uri-list') || ev.dataTransfer.getData('text/plain');
      if (text && /^https?:\/\//i.test(text.trim())) { gameImageUrl = text.trim(); updateGameImageDisplay(); }
    });
  };

  // Mutation observer to attach handlers once panels built (openCreateGameModal triggers ensurePanels)
  const obs = new MutationObserver(() => {
    if (el.panelHomework && el.save && el.imageZone) {
      attachSave();
      attachImageHandlers();
    }
  });
  if (el.modal) obs.observe(el.modal, { subtree:true, childList:true });
}

// Helper: show QR overlay for a given URL
function showQrForUrl(urlStr) {
  const overlay = document.getElementById('qrOverlay');
  const img = document.getElementById('qrImage');
  const linkBox = document.getElementById('qrLinkBox');
  const copyBtn = document.getElementById('qrCopy');
  const openBtn = document.getElementById('qrOpen');
  const closeBtn = document.getElementById('qrClose');
  if (linkBox) linkBox.textContent = urlStr;
  if (openBtn) openBtn.href = urlStr;
  if (overlay) overlay.style.display = 'flex';
  const providers = [
    `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chld=M|0&chl=${encodeURIComponent(urlStr)}`,
    `https://quickchart.io/qr?text=${encodeURIComponent(urlStr)}&size=300&margin=0`,
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlStr)}`
  ];
  if (img) {
    let idx = 0; const tryNext = () => { if (idx>=providers.length) return; img.src = providers[idx++]; };
    img.onerror = () => tryNext();
    tryNext();
  }
  if (copyBtn) copyBtn.onclick = async () => { try { await navigator.clipboard.writeText(urlStr); setStatus('Link copied'); } catch {} };
  if (closeBtn) closeBtn.onclick = () => { if (overlay) overlay.style.display='none'; };
  // Do NOT close the Create Game modal here; keep it open beneath the QR overlay
}

// Launch selected live mode (generic; all supported except Level Up)
async function launchLiveMode() {
  if (!selectedLiveMode) return;
  if (!buildPayloadRef) { alert('Live launch not ready: missing payload builder.'); return; }
  const data = buildPayloadRef();
  if (!data || !Array.isArray(data.words) || !data.words.length) { alert('No words found. Please add words first.'); return; }
  setStatus('Creating live game...');
  let id = null;
  try {
    const resp = await fetch('/.netlify/functions/live_game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: selectedLiveMode,
        title: data.title || data.gameTitle || data.name || 'Live Game',
        words: data.words,
        config: {},
        ttlMinutes: 180
      })
    });
    const js = await resp.json().catch(()=>null);
    if (!resp.ok || !js || !js.success || !js.id) {
      const detail = js && (js.error || js.details || js.code) || 'Create failed';
      throw new Error(detail);
    }
    id = js.id;
  } catch(e) {
    console.error('Failed to create live game', e);
    setStatus('Live create failed');
    alert('Could not create live game on server. Reason: ' + (e.message || 'unknown error') + '\n\nLikely causes if first time:\n1. The database table live_games was not created yet.\n2. Missing Supabase keys in Netlify dev environment.\n3. Need pgcrypto extension (for gen_random_uuid).');
    return;
  } finally {
    setStatus('');
  }
  const url = new URL(window.location.origin + '/Games/Word Arcade/play.html');
  url.searchParams.set('id', id);
  showQrForUrl(url.toString());
}

// expose launch function if needed elsewhere (optional)
window.__launchLiveMode = launchLiveMode;

