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
// Sentence ID Upgrader (Additive, Safe Fallback)
// -------------------------------------------------------------
// For each word object produced by buildPayload():
//   { eng, kor, example, legacy_sentence?, sentences?, primary_sentence_id? }
// This helper:
//  1. Finds words with legacy_sentence (or example) but no sentences[] / primary_sentence_id.
//  2. Batches unique sentence texts to backend (Netlify supabase proxy) with action 'upsert_sentences_batch'.
//  3. Expects response: { success:true, sentences:[ { text, id } ] }
//  4. Mutates word objects in-place adding: sentences:[{id}], primary_sentence_id: id.
// Fallback: if backend or network fails, silently keep legacy_sentence only (runtime still works via fallback).
// NOTE: Removal of legacy_sentence keys will happen in a later cleanup phase when metrics show near-zero fallback usage.
async function ensureSentenceIds(wordObjs){
  try {
    if(!Array.isArray(wordObjs) || !wordObjs.length) return { inserted:0, reused:0 };
    const targets = wordObjs.filter(w=> !w.primary_sentence_id && !Array.isArray(w.sentences) && (w.legacy_sentence || w.example));
    if(!targets.length) return { inserted:0, reused:0 };
    // Build unique normalized sentence list
    const norm = s=> (s||'').trim().replace(/\s+/g,' ');
    const map = new Map();
    targets.forEach(w=>{ const raw = w.legacy_sentence || w.example || ''; if(raw && raw.split(/\s+/).length>=3){ const n = norm(raw); if(n && !map.has(n)) map.set(n,{ text:n, words:[w.eng].filter(Boolean) }); }});
    if(!map.size) return { inserted:0, reused:0 };
    // Call dedicated Netlify function (bypasses generic proxy which doesn't route this action)
  const payload = { action:'upsert_sentences_batch', sentences: Array.from(map.values()) }; 
  if(opts.skipAudio) payload.skip_audio = true;
    let endpoint = '/.netlify/functions/upsert_sentences_batch';
    try {
      if (window && window.location && window.location.hostname === 'localhost') {
        // Support both netlify dev (8888) and functions:serve (netlify dev rewrites) without change
        const payload = { action:'upsert_sentences_batch', sentences: Array.from(map.values()) };
        if(opts.skipAudio) payload.skip_audio = true;
      }
    } catch {}
    const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    const js = await res.json().catch(()=>null);
    if(js && js.audio){
      console.debug('[SentenceUpgrade][modal][audio] summary', js.audio);
    }
    if(js && js.audio_status){
      console.debug('[SentenceUpgrade][modal][audio_status sample]', js.audio_status.slice(0,5));
    }
    if(js && js.env){
      console.debug('[SentenceUpgrade][modal][env]', js.env);
    }
    if(!js || !js.success || !Array.isArray(js.sentences)){
      console.debug('[SentenceUpgrade] Sentence batch failed or empty', { status: res.status, ok: res.ok, body: js });
      return { inserted:0, reused:0, backend:false };
    }
  const byText = new Map(js.sentences.map(r=>[norm(r.text), r])); // r may include audio_key later
    let applied=0; let missed=0;
    targets.forEach(w=>{
      const raw = w.legacy_sentence || w.example || '';
      const rec = byText.get(norm(raw));
      if(rec && rec.id){
        // Preserve text + audio_key (if backend populated it)
        const sentObj = { id: rec.id, text: rec.text };
        if (rec.audio_key) sentObj.audio_key = rec.audio_key;
        w.sentences = [sentObj];
        w.primary_sentence_id = rec.id;
        applied++;
      } else missed++;
    });
    // If we skipped audio, optionally schedule a background audio generation call (non-blocking)
    if(opts.skipAudio){
      try {
        const needAudio = targets.filter(w=> w.primary_sentence_id && !(w.sentences && w.sentences[0] && w.sentences[0].audio_key));
        if(needAudio.length){
          // Background trigger (no await) to generate audio later without blocking UI
          const triggerPayload = { action:'upsert_sentences_batch', sentences: needAudio.map(w=> ({ text: w.legacy_sentence || w.example || '' })), skip_audio:false };
          fetch('/.netlify/functions/upsert_sentences_batch', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(triggerPayload) }).catch(()=>{});
        }
      } catch{}
    }
  } catch(e){ console.debug('[SentenceUpgrade] ensureSentenceIds failed', e?.message); return { inserted:0, error:true }; }
}

// -------------------------------------------------------------
// Time Battle Settings (duration configuration before launch)
// -------------------------------------------------------------
let tbSettings = { duration: 35 };
function showTimeBattleSettings() {
  // Reuse/create a lightweight overlay inside the modal to keep context
  if (!el.modal) return launchLiveMode();
  let wrap = document.getElementById('tbSettingsOverlay');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'tbSettingsOverlay';
    wrap.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45);z-index:9999;';
    wrap.innerHTML = `
      <div class="tb-settings" style="width:min(420px,92vw);background:#fff;border-radius:20px;border:2px solid #67e2e6;box-shadow:0 12px 40px -4px rgba(0,0,0,.25);font-family:Poppins,system-ui,sans-serif;display:flex;flex-direction:column;max-height:90vh;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid #e6eaef;">
          <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:#19777e;">Time Battle Settings</h3>
          <button id="tbSetClose" style="background:none;border:none;font-size:1.4rem;line-height:1;color:#334155;cursor:pointer;">×</button>
        </div>
        <div style="padding:18px 20px 10px;overflow:auto;">
          <label for="tbDurationInput" style="display:block;font-size:.75rem;font-weight:600;letter-spacing:.5px;color:#19777e;margin-bottom:6px;">DURATION (SECONDS)</label>
          <input id="tbDurationInput" type="number" min="15" max="300" step="5" value="35" style="width:100%;padding:12px 14px;border:2px solid #e2e8f0;border-radius:12px;font-size:1rem;background:#f7fafc;font-family:inherit;font-weight:600;color:#0f172a;" />
          <div style="margin-top:8px;font-size:.7rem;color:#475569;line-height:1.4;">Choose how long each Time Battle round lasts. Typical: 35s. You can set between 15 and 300 seconds.</div>
          <div id="tbDurationError" style="display:none;margin-top:8px;font-size:.75rem;font-weight:600;color:#b91c1c;">Enter a value between 15 and 300.</div>
        </div>
        <div style="padding:14px 18px 18px;display:flex;justify-content:flex-end;gap:10px;">
          <button id="tbSetCancel" class="btn" style="background:#fff;border:2px solid #93cbcf;color:#19777e;font-weight:700;padding:10px 18px;border-radius:14px;cursor:pointer;">Cancel</button>
          <button id="tbSetLaunch" class="btn" style="background:#0d9488;border:2px solid #0d9488;color:#fff;font-weight:800;padding:10px 20px;border-radius:14px;cursor:pointer;">Launch ▶</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
  } else {
    wrap.style.display = 'flex';
  }
  const input = wrap.querySelector('#tbDurationInput');
  if (input) input.value = String(tbSettings.duration || 35);
  const errEl = wrap.querySelector('#tbDurationError');
  const close = () => { wrap.style.display = 'none'; };
  wrap.querySelector('#tbSetClose').onclick = close;
  wrap.querySelector('#tbSetCancel').onclick = close;
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelector('#tbSetLaunch').onclick = () => {
    const raw = Number(input.value);
    if (!Number.isFinite(raw) || raw < 15 || raw > 300) {
      if (errEl) errEl.style.display = 'block';
      input.focus();
      return;
    }
    if (errEl) errEl.style.display = 'none';
    tbSettings.duration = Math.round(raw);
    close();
    launchLiveMode();
  };
}

// -------------------------------------------------------------
// Loading Overlay (spinner + message for live game creation & QR gen)
// -------------------------------------------------------------
let loadingEl = null;
function showLoading(msg = 'Loading...') {
  if (!el.modal) return;
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.className = 'cgm-loading-overlay';
    loadingEl.innerHTML = `
      <div class="cgm-loading-box" role="status" aria-live="polite">
        <div class="cgm-spinner" aria-hidden="true"></div>
        <div class="cgm-loading-msg"></div>
      </div>`;
    el.modal.appendChild(loadingEl);
  }
  const msgBox = loadingEl.querySelector('.cgm-loading-msg');
  if (msgBox) msgBox.textContent = msg;
  loadingEl.style.display = 'flex';
}
function hideLoading() { if (loadingEl) loadingEl.style.display = 'none'; }

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

// Build live mode tiles (grouped horizontally: Full Games vs Mini Games)
function buildLiveTiles() {
  if (!el.liveGrid) return;
  if (el.liveGrid.childElementCount) return; // build once

  // Define groups
  const groups = [
    {
      title: 'Full Games',
      modes: [
        { key:'full_arcade', label:'Full Arcade', desc:'6 Rounds', active:true },
  { key:'full_sentence_mode', label:'Sentence Mode', desc:'Practice sentences', active:true },
        { key:'full_learn_mode', label:'Learn Mode', desc:'Study and review', active:false },
        { key:'time_battle', label:'Time Battle', desc:'Compete in real-time', active:true }
      ]
    },
    {
      title: 'Mini Games',
      modes: [
        { key:'multi_choice_eng_to_kor', label:'Multiple Choice', desc:'English → Korean', active:true },
        { key:'picture_multi_choice', label:'Picture Match', desc:'Image → Word', active:true },
        { key:'listening_multi_choice', label:'Listening', desc:'Hear → Choose', active:true },
        { key:'multi_choice_kor_to_eng', label:'Multi Choice', desc:'Korean → English', active:true },
        { key:'easy_picture', label:'Audio → Picture', desc:'Listen then choose', active:true },
        { key:'listen_and_spell', label:'Listen & Spell', desc:'Type what you hear', active:true },
        { key:'spelling', label:'Spelling', desc:'Basic spelling drill', active:true },
        { key:'matching', label:'Matching', desc:'Match the words', active:true },
        { key:'level_up', label:'Level Up', desc:'Words → Definitions', active:false } // placeholder
      ]
    }
  ];

  // Horizontal container for both groups
  const container = document.createElement('div');
  container.className = 'cgm-group-container';
  el.liveGrid.appendChild(container);

  groups.forEach(group => {
    // Group box
    const box = document.createElement('div');
    box.className = 'cgm-group-box';

    // Header
    const header = document.createElement('div');
    header.className = 'cgm-group-header';
    header.textContent = group.title;
    box.appendChild(header);

    // Mode tiles
    const grid = document.createElement('div');
    grid.className = 'cgm-mode-group';
    group.modes.forEach(m => {
      const div = document.createElement('div');
      div.className = 'cgm-mode-tile ' + (m.active ? 'active' : 'disabled');
      div.dataset.mode = m.key;
      // Remember baseline active so dynamic checks (like images available) can toggle without enabling truly inactive modes
      div.dataset.baselineActive = m.active ? '1' : '0';
      div.innerHTML = `
        <div class="cgm-mode-name">${m.label}</div>
        <div class="cgm-mode-desc">${m.desc}</div>
        <div class="cgm-tag">${m.active ? 'PLAY' : 'SOON'}</div>
      `;
      // Always bind click; guard at runtime based on disabled class so dynamic state works
      div.addEventListener('click', () => {
        if (div.classList.contains('disabled')) {
          // Provide a gentle hint when disabled due to missing requirements
          try {
            const tag = div.querySelector('.cgm-tag');
            if (tag) {
              tag.textContent = tag.textContent || 'UNAVAILABLE';
            }
          } catch {}
          setStatus('This mode is unavailable for the current list.');
          return;
        }
        selectedLiveMode = m.key;
        // Intercept Time Battle to show a settings modal first
        if (m.key === 'time_battle') {
          showTimeBattleSettings();
          return;
        }
        launchLiveMode();
      });
      grid.appendChild(div);
    });
    box.appendChild(grid);
    container.appendChild(box);
  });
}

// Determine if picture-based modes should be disabled based on the current word list images
function updateLiveTilesAvailability() {
  if (!el.liveGrid) return;
  // Identify modes that require word images
  const pictureModes = new Set(['picture_multi_choice', 'easy_picture']);
  let words = [];
  try {
    if (typeof buildPayloadRef === 'function') {
      const payload = buildPayloadRef();
      if (payload && Array.isArray(payload.words)) words = payload.words;
    }
  } catch {}
  const hasMissingImages = words.some(w => !w || !String(w.image_url || '').trim());
  // Toggle tiles
  el.liveGrid.querySelectorAll('.cgm-mode-tile').forEach(tile => {
    const mode = tile.getAttribute('data-mode');
    const baselineActive = tile.getAttribute('data-baseline-active') === '1' || tile.dataset.baselineActive === '1';
    const tag = tile.querySelector('.cgm-tag');
    // Never enable modes that are baseline disabled (e.g., level_up placeholder)
    if (!baselineActive) {
      tile.classList.remove('active');
      tile.classList.add('disabled');
      if (tag) tag.textContent = 'SOON';
      return;
    }
    if (pictureModes.has(mode) && hasMissingImages) {
      tile.classList.remove('active');
      tile.classList.add('disabled');
      tile.title = 'Some words are missing pictures. Add images to use this mode.';
      if (tag) tag.textContent = 'NEEDS IMAGES';
    } else {
      tile.classList.remove('disabled');
      tile.classList.add('active');
      tile.removeAttribute('title');
      if (tag) tag.textContent = 'PLAY';
    }
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
  // Update live modes availability based on current word list (e.g., require pictures for picture modes)
  try { updateLiveTilesAvailability(); } catch {}
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
      try {
        el.save.disabled = true;
        setStatus('Linking sentences...');
        await ensureSentenceIds(data.words); // safe upgrade (silent fallback)
        const english = data.words.map(w => w.eng).filter(Boolean);
        setStatus('Ensuring audio...');
        await ensureAudioForWords(english);
      } catch {}
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
  if (!overlay || !img) return;

  overlay.style.display = 'flex';
  if (linkBox) linkBox.textContent = urlStr;
  if (openBtn) openBtn.href = urlStr;

  // Ensure dedicated stable container
  let container = img.closest('.qr-image-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'qr-image-container';
    if (img.parentElement) {
      img.parentElement.insertBefore(container, img);
      container.appendChild(img);
    } else {
      overlay.appendChild(container);
      container.appendChild(img);
    }
  }

  // Remove any previous spinners
  container.querySelectorAll('.qr-spinner').forEach(s => s.remove());

  // Fresh spinner
  const spinner = document.createElement('div');
  spinner.className = 'qr-spinner';
  container.appendChild(spinner);

  img.classList.add('qr-loading');
  img.classList.remove('qr-error');

  const clear = (isError) => {
    img.classList.remove('qr-loading');
    if (spinner.parentNode) spinner.remove();
    if (isError) img.classList.add('qr-error');
  };

  img.onload = () => clear(false);
  // we will override onerror later for retry logic

  const providers = [
    `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chld=M|0&chl=${encodeURIComponent(urlStr)}`,
    `https://quickchart.io/qr?text=${encodeURIComponent(urlStr)}&size=300&margin=0`,
    `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlStr)}`
  ];
  let idx = 0;
  const tryNext = () => {
    if (idx >= providers.length) { clear(true); return; }
    img.src = providers[idx++];
  };
  img.onerror = () => { tryNext(); };
  tryNext();

  if (copyBtn) {
    copyBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(urlStr); setStatus('Link copied'); } catch {}
    };
  }
  if (closeBtn) {
    closeBtn.onclick = () => { overlay.style.display = 'none'; };
  }

  // Inject single Leaderboard button (opens in new tab). We insert only once.
  const footer = copyBtn && copyBtn.parentElement; // container with Copy Link & Open
  if (footer && !footer.querySelector('#qrLeaderboardBtn')) {
    const lbBtn = document.createElement('button');
    lbBtn.id = 'qrLeaderboardBtn';
    lbBtn.textContent = 'Leaderboard';
    lbBtn.style.cssText = 'background:#19777e;color:#fff;border:1px solid #19777e;border-radius:10px;padding:8px 12px;font-weight:600;cursor:pointer;font-family:Poppins,system-ui,sans-serif;';
    footer.insertBefore(lbBtn, copyBtn); // place directly before Copy Link for prominence
    lbBtn.addEventListener('click', () => {
      const id = (typeof window !== 'undefined' && window.__lastLiveGameId) ? window.__lastLiveGameId : null;
      if (!id) { alert('Session id not ready yet. Launch the game first.'); return; }
      const url = new URL(window.location.origin + '/Games/Word Arcade/leaderboard.html');
      url.searchParams.set('id', id);
      window.open(url.toString(), 'waLeaderboard'+id, 'noopener');
    });
  }
}

// -------------------------------------------------------------
// Leaderboard / Teacher Projector View
// -------------------------------------------------------------
// Flow:
// 1. launchLiveMode -> create game -> store id globally -> showQrForUrl
// 2. Teacher clicks 'Leaderboard' in QR footer -> openTeacherLeaderboard()
// 3. Fullscreen modal with podium (top 5) + link to Teacher View (stats)
// 4. Poll every 3s for best scores via timer_score function
// Extend easily by adding round or live (non-best) modes.

function openTeacherLeaderboard(){
  let modal = document.getElementById('teacherLeaderboardModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'teacherLeaderboardModal';
    modal.style.cssText = 'position:fixed;inset:0;background:#0f172a;display:flex;flex-direction:column;z-index:10000;padding:24px;';
    modal.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h1 style="margin:0;font-size:clamp(1.8rem,4vw,3.6rem);color:#67e2e6;font-family:Poppins,system-ui,sans-serif;font-weight:800;letter-spacing:1px;">Live Leaderboard</h1>
        <button id="tlbClose" style="background:#fff;border:2px solid #67e2e6;color:#0f172a;font-weight:700;padding:10px 18px;border-radius:14px;cursor:pointer;font-family:Poppins,system-ui;">Close</button>
      </div>
      <div id="tlbPodium" style="flex:1;display:flex;flex-direction:column;gap:10px;padding:6px 4px 30px;overflow:hidden;position:relative;">
        <!-- Dynamic ranking rows -->
      </div>
      <div style="position:absolute;left:14px;bottom:10px;font-size:.85rem;color:#93cbcf;font-family:Poppins,system-ui;cursor:pointer;" id="tlbTeacherViewLink">Teacher view</div>`;
    document.body.appendChild(modal);
    modal.querySelector('#tlbClose').onclick = () => { if (modal._lbStop) modal._lbStop(); modal.remove(); };
    modal.querySelector('#tlbTeacherViewLink').onclick = () => showTeacherStatsPanel(modal);

    // Inject CSS (once) for FLIP animated list (stable rows, transform transitions only on movement)
    if (!document.getElementById('tlbListStyles')) {
      const style = document.createElement('style');
      style.id = 'tlbListStyles';
      style.textContent = `
        @keyframes tlbPulse { 0%,100% { box-shadow:0 0 0 0 rgba(103,226,230,0.55);} 50% { box-shadow:0 0 0 14px rgba(103,226,230,0);} }
        @keyframes tlbBump { 0% { transform:scale(1);} 40% { transform:scale(1.07);} 100% { transform:scale(1);} }
        .tlb-row { display:flex;align-items:center;gap:14px;padding:10px 18px;border-radius:18px;background:linear-gradient(90deg,#132033,#0f172a);position:relative;will-change:transform; }
        .tlb-row:nth-child(odd){ background:linear-gradient(90deg,#182a42,#0f172a); }
        .tlb-rank { font-size:clamp(1.05rem,1.5vw,2rem);font-weight:800;color:#67e2e6;width:3.2ch;text-align:right;font-family:Poppins,system-ui; }
        .tlb-medal { font-size:clamp(1.35rem,2vw,2.3rem);width:2.6ch;text-align:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
        .tlb-name { flex:1;font-size:clamp(1.05rem,2vw,2.35rem);font-weight:700;color:#fff;font-family:Poppins,system-ui;line-height:1.12;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
        .tlb-score { font-size:clamp(1.3rem,2.3vw,2.8rem);font-weight:900;color:#ffe082;font-family:Poppins,system-ui;display:flex;align-items:center;gap:10px; }
        .tlb-score.bump { animation:tlbBump .5s ease; }
        .tlb-up, .tlb-down { font-size:clamp(.68rem,0.9vw,1.05rem);font-weight:700;padding:3px 9px;border-radius:22px;line-height:1;letter-spacing:.5px; }
        .tlb-up { background:#065f46;color:#fff; }
        .tlb-down { background:#7f1d1d;color:#fff; }
        .tlb-row.promoted { outline:2px solid #67e2e6; animation:tlbPulse 2.4s ease 0.3s; }
        .tlb-row.demoted { opacity:.9; }
        .tlb-empty { color:#fff;font-size:1.5rem;font-weight:600;font-family:Poppins,system-ui;opacity:.75;padding:30px 10px; }
      `;
      document.head.appendChild(style);
    }
  }
  renderLeaderboardPodium(modal); // initial placeholder
  requestFullscreenSafe(modal);
  beginLeaderboardPolling(modal);
}

// Previous state snapshot for FLIP + change detection
let __prevLeaderboardState = []; // [{ name, score, index }]
let __prevSnapshotKey = '';

function buildRowInner(rankIndex, entry, prevIndex, scoreChanged){
  let medal = '';
  if (rankIndex === 0) medal = '🥇'; else if (rankIndex === 1) medal = '🥈'; else if (rankIndex === 2) medal = '🥉';
  const movedUp = prevIndex !== -1 && prevIndex > rankIndex;
  const movedDown = prevIndex !== -1 && prevIndex < rankIndex;
  const delta = movedUp ? `<span class="tlb-up">▲ ${prevIndex - rankIndex}</span>` : movedDown ? `<span class="tlb-down">▼ ${rankIndex - prevIndex}</span>` : '';
  return `
    <div class="tlb-rank">${rankIndex+1}</div>
    <div class="tlb-medal">${medal}</div>
    <div class="tlb-name">${(entry.name||'Player').replace(/</g,'&lt;')}</div>
    <div class="tlb-score${scoreChanged ? ' bump':''}">${entry.score}${delta}</div>`;
}

function snapshotKey(list){
  return list.map(e=>`${e.name}:${e.score}`).join('|');
}

function renderLeaderboardPodium(modal, entries=[]) {
  const box = modal.querySelector('#tlbPodium');
  if (!box) return;
  if (!entries.length) { box.innerHTML = '<div class="tlb-empty">Waiting for scores…</div>'; __prevLeaderboardState=[]; __prevSnapshotKey=''; return; }
  const top = entries.slice(0,15);
  const key = snapshotKey(top);
  if (key === __prevSnapshotKey) return; // nothing changed; skip all work

  // 1. Capture FIRST positions (FLIP)
  const firstRects = new Map();
  box.querySelectorAll('.tlb-row').forEach(r=>{ firstRects.set(r.dataset.name, r.getBoundingClientRect()); });

  // 2. Build/update rows in-place
  const existing = new Map();
  box.querySelectorAll('.tlb-row').forEach(r=> existing.set(r.dataset.name, r));

  // Track which names used this frame
  const used = new Set();
  top.forEach((entry, newIndex) => {
    const name = entry.name || 'Player';
    let row = existing.get(name);
    const prev = __prevLeaderboardState.find(p => p.name === name);
    const prevIndex = prev ? prev.index : -1;
    const scoreChanged = !!(prev && prev.score !== entry.score);
    if (!row) {
      row = document.createElement('div');
      row.className = 'tlb-row';
      row.dataset.name = name;
      row.innerHTML = buildRowInner(newIndex, entry, prevIndex, scoreChanged);
      // Insert at correct position
      const ref = box.children[newIndex];
      if (ref) box.insertBefore(row, ref); else box.appendChild(row);
      // New rows fade in naturally via transform (start slightly translated)
      row.style.opacity = '0';
      row.style.transform = 'translateY(10px)';
      requestAnimationFrame(()=>{ row.style.transition='opacity .4s ease, transform .45s ease'; row.style.opacity='1'; row.style.transform='translateY(0)'; });
    } else {
      // Update inner HTML (keeps bump class if needed)
      row.innerHTML = buildRowInner(newIndex, entry, prevIndex, scoreChanged);
      // Move to new spot if order changed
      const ref = box.children[newIndex];
      if (ref !== row) {
        box.insertBefore(row, ref);
      }
      // Mark promotions/demotions (visual emphasis only)
      row.classList.remove('promoted','demoted');
      if (prevIndex > newIndex && prevIndex !== -1) row.classList.add('promoted');
      else if (prevIndex < newIndex && prevIndex !== -1) row.classList.add('demoted');
    }
    used.add(name);
  });

  // Remove rows not present now (fade out)
  box.querySelectorAll('.tlb-row').forEach(r=>{
    if (!used.has(r.dataset.name)) {
      r.style.transition='opacity .35s ease, transform .35s ease';
      r.style.opacity='0';
      r.style.transform='translateY(12px)';
      setTimeout(()=>r.remove(), 380);
    }
  });

  // 3. Capture LAST positions & apply FLIP transform
  const lastRects = new Map();
  box.querySelectorAll('.tlb-row').forEach(r=> lastRects.set(r.dataset.name, r.getBoundingClientRect()));
  box.querySelectorAll('.tlb-row').forEach(r=> {
    const name = r.dataset.name;
    const first = firstRects.get(name);
    const last = lastRects.get(name);
    if (!first || !last) return; // new row or removed
    const dx = first.left - last.left;
    const dy = first.top - last.top;
    if (dx || dy) {
      r.style.transition='none';
      r.style.transform=`translate(${dx}px,${dy}px)`;
      requestAnimationFrame(()=> {
        r.style.transition='transform .55s cubic-bezier(.22,.8,.26,.99)';
        r.style.transform='translate(0,0)';
      });
    }
  });

  // 4. Update snapshot
  __prevLeaderboardState = top.map((e,i)=>({ name:e.name, score:e.score, index:i }));
  __prevSnapshotKey = key;
}

function requestFullscreenSafe(el){ try { if (el.requestFullscreen) el.requestFullscreen(); } catch {} }

function beginLeaderboardPolling(modal){
  const sessionId = extractSessionIdFromQr();
  if (!sessionId) return;
  let active = true;
  modal._lbStop = () => { active = false; };
  async function tick(){
    if (!active) return;
    try {
      const url = new URL('/.netlify/functions/timer_score', window.location.origin);
      url.searchParams.set('session_id', sessionId);
      url.searchParams.set('best', '1');
      url.searchParams.set('limit', '20');
      const res = await fetch(url.toString(), { cache:'no-store' });
      const js = await res.json().catch(()=>null);
      if (js && js.success && Array.isArray(js.leaderboard)) renderLeaderboardPodium(modal, js.leaderboard);
    } catch {}
    finally { setTimeout(tick, 3000); }
  }
  tick();
}

function extractSessionIdFromQr(){
  try { return window.__lastLiveGameId || null; } catch { return null; }
}

function showTeacherStatsPanel(modal){
  if (modal.querySelector('#tlbStats')) return; // already open
  const panel = document.createElement('div');
  panel.id = 'tlbStats';
  panel.style.cssText = 'position:absolute;inset:0;background:rgba(15,23,42,0.96);display:flex;flex-direction:column;padding:20px 28px;';
  panel.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">\n      <h2 style=\"margin:0;font-size:clamp(1.4rem,3vw,2.6rem);color:#67e2e6;font-weight:800;font-family:Poppins,system-ui;\">Teacher View</h2>\n      <button id=\"tlbStatsClose\" style=\"background:#fff;border:2px solid #67e2e6;color:#0f172a;font-weight:700;padding:8px 16px;border-radius:12px;cursor:pointer;font-family:Poppins,system-ui;\">Close</button>\n    </div>\n    <div id=\"tlbStatsBody\" style=\"flex:1;overflow:auto;font-family:Poppins,system-ui;color:#e2e8f0;font-size:.95rem;\">Loading…</div>`;
  modal.appendChild(panel);
  panel.querySelector('#tlbStatsClose').onclick = () => panel.remove();
  loadTeacherStats(panel.querySelector('#tlbStatsBody'));
}

async function loadTeacherStats(bodyEl){
  const sessionId = extractSessionIdFromQr();
  if (!sessionId) { bodyEl.textContent = 'No session id.'; return; }
  try {
    const url = new URL('/.netlify/functions/timer_score', window.location.origin);
    url.searchParams.set('session_id', sessionId);
    url.searchParams.set('best', '1');
    url.searchParams.set('limit', '200');
    const res = await fetch(url.toString(), { cache:'no-store' });
    const js = await res.json().catch(()=>null);
    if (!js || !js.success) { bodyEl.textContent = 'Failed to load scores.'; return; }
    const rows = js.leaderboard || [];
    if (!rows.length) { bodyEl.textContent = 'No scores yet.'; return; }
    const avg = (rows.reduce((a,r)=>a+Number(r.score||0),0)/rows.length).toFixed(1);
    const max = rows[0].score;
    bodyEl.innerHTML = `<div style=\"margin-bottom:16px;display:flex;flex-wrap:wrap;gap:18px;\">\n      <div style=\"background:#1e293b;padding:12px 16px;border-radius:12px;min-width:140px;\">\n        <div style=\"font-size:.65rem;font-weight:600;letter-spacing:1px;color:#93cbcf;margin-bottom:4px;\">PLAYERS</div>\n        <div style=\"font-size:1.6rem;font-weight:800;color:#fff;\">${rows.length}</div>\n      </div>\n      <div style=\"background:#1e293b;padding:12px 16px;border-radius:12px;min-width:140px;\">\n        <div style=\"font-size:.65rem;font-weight:600;letter-spacing:1px;color:#93cbcf;margin-bottom:4px;\">TOP SCORE</div>\n        <div style=\"font-size:1.6rem;font-weight:800;color:#fff;\">${max}</div>\n      </div>\n      <div style=\"background:#1e293b;padding:12px 16px;border-radius:12px;min-width:140px;\">\n        <div style=\"font-size:.65rem;font-weight:600;letter-spacing:1px;color:#93cbcf;margin-bottom:4px;\">AVG SCORE</div>\n        <div style=\"font-size:1.6rem;font-weight:800;color:#fff;\">${avg}</div>\n      </div>\n    </div>\n    <table style=\"width:100%;border-collapse:collapse;\">\n      <thead><tr style=\"text-align:left;background:#334155;color:#fff;\">\n        <th style=\"padding:8px 10px;font-weight:600;font-size:.7rem;letter-spacing:.5px;\">#</th>\n        <th style=\"padding:8px 10px;font-weight:600;font-size:.7rem;letter-spacing:.5px;\">Name</th>\n        <th style=\"padding:8px 10px;font-weight:600;font-size:.7rem;letter-spacing:.5px;\">Score</th>\n      </tr></thead>\n      <tbody>\n        ${rows.map((r,i)=>`<tr style=\\"background:${i%2?'#1e293b':'#0f172a'};\\"><td style=\\"padding:6px 10px;color:#93cbcf;font-weight:600;\\">${i+1}</td><td style=\\"padding:6px 10px;\\">${(r.name||'Player').replace(/</g,'&lt;')}</td><td style=\\"padding:6px 10px;font-weight:700;\\">${r.score}</td></tr>`).join('')}\n      </tbody>\n    </table>`;
  } catch {
    bodyEl.textContent = 'Error loading stats.';
  }
}
// Launch selected live mode (generic; all supported except Level Up)
async function launchLiveMode() {
  if (!selectedLiveMode) return;
  if (!buildPayloadRef) { alert('Live launch not ready: missing payload builder.'); return; }
  const data = buildPayloadRef();
  if (!data || !Array.isArray(data.words) || !data.words.length) { alert('No words found. Please add words first.'); return; }
  // Fast path: background sentence linking (skip audio) so UI is not blocked
  try {
    const total = data.words.length;
    const withIds = data.words.filter(w=> w && (w.primary_sentence_id || (Array.isArray(w.sentences) && w.sentences.length))).length;
    if (withIds < total) {
      setStatus('Linking sentences…');
      (async ()=>{ try { await ensureSentenceIds(data.words, { skipAudio:true }); } catch(e){ console.debug('[liveLaunch] bg sentence link failed', e?.message); } })();
    }
  } catch {}
  setStatus('Creating live game...');
  showLoading('Creating live game...');
  let id = null;
  try {
    const resp = await fetch('/.netlify/functions/live_game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: selectedLiveMode,
        title: data.title || data.gameTitle || data.name || 'Live Game',
        words: data.words,
        config: selectedLiveMode === 'time_battle' ? { time_battle: { duration: tbSettings.duration || 35 } } : {},
        ttlMinutes: 180
      })
    });
    const js = await resp.json().catch(()=>null);
    if (!resp.ok || !js || !js.success || !js.id) {
      const detail = js && (js.error || js.details || js.code) || 'Create failed';
      throw new Error(detail);
    }
    id = js.id;
    try { window.__lastLiveGameId = id; } catch {}
  } catch(e) {
    console.error('Failed to create live game', e);
    setStatus('Live create failed');
    hideLoading();
    alert('Could not create live game on server. Reason: ' + (e.message || 'unknown error') + '\n\nLikely causes if first time:\n1. The database table live_games was not created yet.\n2. Missing Supabase keys in Netlify dev environment.\n3. Need pgcrypto extension (for gen_random_uuid).');
    return;
  } finally {
    setStatus('');
  }
  const url = new URL(window.location.origin + '/Games/Word Arcade/play.html');
  url.searchParams.set('id', id);
  url.searchParams.set('src', 'builder');
  // Pass the intended mode explicitly so play-main can force it
  if (selectedLiveMode) url.searchParams.set('mode', selectedLiveMode);
  showLoading('Generating QR code...');
  setTimeout(() => {
    showQrForUrl(url.toString());
    hideLoading();
  }, 30);
}

// expose launch function if needed elsewhere (optional)
window.__launchLiveMode = launchLiveMode;

