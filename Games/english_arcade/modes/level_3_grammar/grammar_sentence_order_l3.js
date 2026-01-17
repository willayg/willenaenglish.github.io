// Level 3 - Sentence Order Mode (chunk-based)
// Breaks sentences into 2-3 word contiguous chunks. Player taps chunks to assemble
// the target sentence in order. Audio plays after completing each sentence.
// Supports: past_simple_irregular, be_going_to, past_simple_regular, past_vs_future, all_tenses

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { renderGrammarSummary } from '../grammar_summary.js';
import { FN } from '../../scripts/api-base.js';
import { openNowLoadingSplash } from '../unscramble_splash.js';

let state = null;
let activeSentenceAudio = null;
const sentenceAudioCache = new Map();
const MODE = 'grammar_sentence_order';
const DEFAULT_FILE = 'data/grammar/level3/past_simple_irregular.json';

// --- Audio helpers for Level 3 grammar ---
function normalizeForGrammarKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildGrammarAudioCandidates(item) {
  const candidates = [];
  const seen = new Set();
  const add = (key) => { if (!key || seen.has(key)) return; seen.add(key); candidates.push(key); };
  const idBase = normalizeForGrammarKey(item?.id);
  const wordBase = normalizeForGrammarKey(item?.word || item?.base);
  const articleBase = normalizeForGrammarKey(item?.article);
  if (idBase) add(`${idBase}_grammar`);
  if (wordBase && articleBase) add(`${wordBase}_${articleBase}_grammar`);
  if (wordBase) add(`${wordBase}_grammar`);
  return candidates;
}

async function hydrateGrammarAudio(items) {
  if (!Array.isArray(items) || !items.length) return;
  const candidateMap = new Map();
  const allCandidates = new Set();
  items.forEach((item) => {
    const candidates = buildGrammarAudioCandidates(item);
    if (!candidates.length) return;
    candidateMap.set(item, candidates);
    candidates.forEach((key) => allCandidates.add(key));
  });
  if (!candidateMap.size) return;
  const words = Array.from(allCandidates);
  let results = null;
  try {
    const endpoint = FN('get_audio_urls');
    const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) };
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      init.signal = AbortSignal.timeout(10000);
    }
    const res = await fetch(endpoint, init);
    if (res.ok) {
      const data = await res.json();
      if (data && data.results && typeof data.results === 'object') results = data.results;
    }
  } catch (err) { console.debug('[SentenceOrderL3] audio lookup error', err?.message); }
  if (!results) return;
  candidateMap.forEach((candidates, item) => {
    for (const key of candidates) {
      const lower = key?.toLowerCase?.();
      const variants = [key, lower, `${key}.mp3`, lower ? `${lower}.mp3` : null];
      const info = variants.map((v) => (v ? results[v] : null)).find((r) => r && r.exists && r.url);
      if (info) { item.sentenceAudioUrl = info.url; item.audio_key = key; break; }
    }
  });
}

function playSentenceAudio(item) {
  if (!item) return;
  const url = item.sentenceAudioUrl;
  if (activeSentenceAudio) {
    try { activeSentenceAudio.pause(); } catch {}
    try { activeSentenceAudio.currentTime = 0; } catch {}
    activeSentenceAudio = null;
  }
  if (url) {
    try {
      let audio = sentenceAudioCache.get(url);
      if (!audio) { audio = new Audio(url); audio.preload = 'auto'; sentenceAudioCache.set(url, audio); }
      activeSentenceAudio = audio;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {}
  }
}
// --- End audio helpers ---

// Detect grammar type from filename
function detectGrammarType(filePath) {
  const path = (filePath || '').toLowerCase();
  if (path.includes('be_going_to')) return 'be_going_to';
  if (path.includes('past_simple_regular')) return 'past_regular';
  if (path.includes('past_vs_future')) return 'past_vs_future';
  if (path.includes('past_vs_present_vs_future') || path.includes('all_tense')) return 'all_tenses';
  if (path.includes('tense_question')) return 'tense_questions';
  // Will future/questions: sentence-based with "will" patterns
  if (path.includes('will_future')) return 'will_future';
  if (path.includes('will_questions')) return 'will_questions';
  // Modal verbs: have to, want to, like to
  if (path.includes('have_to')) return 'have_to';
  if (path.includes('want_to')) return 'want_to';
  if (path.includes('like_to')) return 'like_to';
  return 'past_irregular';
}

function shuffle(arr) {
  return Array.isArray(arr) ? arr.slice().sort(() => Math.random() - 0.5) : [];
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function displayifySentence(s) {
  // Collapse spaces, trim, capitalize first letter, always end with a full stop.
  let t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  // Capitalize first letter
  t = t.charAt(0).toUpperCase() + t.slice(1);
  // Ensure a full stop at the end
  if (!/[.?!]$/.test(t)) t = t + '.';
  return t;
}

function chunkSentence(sentence) {
  // Normalize whitespace and split into words
  const words = String(sentence || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (!words.length) return [];

  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const remaining = words.length - i;
    // Choose 2 or 3-word chunks; ensure we don't leave a single word at the end
    let size = remaining <= 3 ? remaining : (Math.random() < 0.4 ? 3 : 2);
    if (remaining - size === 1) {
      // Avoid leaving a single word; shift size up or down
      if (size === 2 && remaining >= 3) size = 3;
      else if (size === 3 && remaining >= 4) size = 2;
    }
    const piece = words.slice(i, i + size).join(' ');
    chunks.push(piece);
    i += size;
  }
  return chunks;
}

export async function startGrammarSentenceOrderL3({ containerId = 'gameArea', grammarFile, grammarName, grammarConfig, onQuit, onComplete, playSFX } = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Show loading splash with Korean text "Unscramble the sentences"
  let splashController = null;
  try {
    splashController = openNowLoadingSplash(document.body, {
      text: '문장을 순서대로 배열하세요',  // "Unscramble the sentences" in Korean
      subtitle: grammarName || 'Sentence Order'
    });
    if (splashController && splashController.readyPromise) {
      await splashController.readyPromise;
    }
  } catch (e) {
    console.debug('[SentenceOrderL3] splash display failed', e?.message);
  }

  state = {
    grammarFile: grammarFile || DEFAULT_FILE,
    grammarName: grammarName || null,
    grammarConfig: grammarConfig || {},
    grammarType: detectGrammarType(grammarFile || DEFAULT_FILE),
    score: 0,
    index: 0,
    container,
    sessionId: null,
    list: [],
    attempted: 0,
    onQuit,
    onComplete,
  };

  try {
    // Load list
    const base = new URL('../../', import.meta.url);
    const url = new URL(state.grammarFile, base);
    const res = await fetch(url.href, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load grammar list');
    const data = await res.json();
    state.list = Array.isArray(data) ? data.filter(Boolean) : [];
  } catch (err) {
    console.error('[SentenceOrderL3] Failed to load list', err);
    state.list = [];
  }

  // Start a session for progress tracking
  try {
    // Use grammarFile path for session tracking to match homework assignment list_key
    state.sessionId = startSession({
      mode: MODE,
      listName: state.grammarFile || state.grammarName || null,
      wordList: state.list.map(it => (it.past || it.base || it.word || it.en) ).filter(Boolean),
      meta: { category: 'grammar', grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 }
    });
  } catch (e) {
    console.debug('[sentence_order_l3] startSession failed', e?.message);
    state.sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  }

  if (!state.list.length) {
    container.innerHTML = '<div style="padding:20px">No Level 3 grammar content found.</div>';
    if (onComplete) onComplete(state);
    return;
  }

  state.list = shuffle(state.list);
  
  // Hydrate audio URLs for sentence playback after answer
  try {
    await hydrateGrammarAudio(state.list);
  } catch (err) {
    console.debug('[sentence_order_l3] Audio hydrate failed', err?.message);
  }
  
  // Hide loading splash before rendering the first round
  if (splashController && typeof splashController.hide === 'function') {
    try {
      splashController.hide();
    } catch (e) {
      console.debug('[SentenceOrderL3] splash hide failed', e?.message);
    }
  }
  
  renderRound();

  function renderRound() {
    const item = state.list[state.index];
    if (!item) return finish();

    const target = (item.exampleSentence || item.en || item.past || item.base || '').trim();
    const koHint = (item.exampleSentenceKo || item.ko || '').trim();
    const chunks = chunkSentence(target);
    // Save canonical target for checking (normalize: remove punctuation, lowercase, collapse spaces)
    const canonicalTarget = target.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

    // Shuffle chunks for the UI pool
    const shuffled = shuffle(chunks.slice());

      container.innerHTML = `
        <div style="padding:22px 18px;display:flex;flex-direction:column;min-height:100%;font-family:'Poppins',Arial,sans-serif;position:relative;">
          <div style="text-align:center;margin-bottom:8px;color:#19777e;font-weight:700;">${escapeHtml(state.grammarName || 'Sentence Order')}</div>
          ${koHint ? `<div style="text-align:center;margin-bottom:14px;color:#21b5c0;font-weight:600;font-size:1.05rem;">${escapeHtml(koHint)}</div>` : ''}
          <div id="so-target" style="height:3.6rem;line-height:1.2;border-radius:12px;border:2px dashed #e0e0e0;background:#fff;padding:12px;margin-bottom:24px;display:flex;align-items:center;justify-content:center;overflow:hidden;"> </div>
          <div id="so-pool" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;align-items:center;min-height:160px;">
          ${shuffled.map((c, i) => {
            // option chips: remove trailing punctuation and lowercase
            const clean = String(c).replace(/[.?!,;:]+$/g, '').toLowerCase();
            return `<button class="so-chunk" data-chunk-index="${i}" data-chunk-raw="${escapeHtml(clean)}" style="padding:11px 13px;border-radius:14px;border:3px solid #ff6fb0;background:#fff;color:#ff6fb0;font-weight:700;cursor:pointer;font-size:1.1rem;min-width:92px;">${escapeHtml(clean)}</button>`;
          }).join('')}
          </div>
          <button id="so-submit" class="so-floating-check" style="position:absolute;top:65%;left:50%;transform:translate(-50%,-50%) scale(0.6);opacity:0;pointer-events:none;font-size:clamp(1.95rem,3.8vw,2.9rem);padding:26px 62px;border-radius:40px;letter-spacing:0.8px;font-weight:800;background:#ff7a1a;color:#fff;border:3px solid #ff7a1a;box-shadow:0 18px 45px -10px rgba(0,0,0,0.35),0 0 0 4px rgba(255,122,26,0.15);transition:opacity 0.4s ease,transform 0.5s cubic-bezier(0.16,0.8,0.24,1);cursor:pointer;">Check</button>
          <div id="so-feedback" style="min-height:3.6rem;margin-top:28px;text-align:center;"></div>
        </div>
      `;

    const pool = container.querySelector('#so-pool');
    const targetEl = container.querySelector('#so-target');
    const submitBtn = container.querySelector('#so-submit');
    const feedbackArea = container.querySelector('#so-feedback');

    // Make all buttons in this view use Poppins and increase font size by ~10%
    try {
      Array.from(container.querySelectorAll('button')).forEach(b => { b.style.fontFamily = "'Poppins', Arial, sans-serif"; b.style.fontSize = '1.1rem'; });
    } catch (e) {}
    const totalChunks = shuffled.length;

    const selection = [];

    // Show/hide check button based on whether all chunks are placed
    function updateSubmitVisibility() {
      if (selection.length === totalChunks) {
        submitBtn.style.opacity = '1';
        submitBtn.style.transform = 'translate(-50%, -50%) scale(1)';
        submitBtn.style.pointerEvents = 'auto';
      } else {
        submitBtn.style.opacity = '0';
        submitBtn.style.transform = 'translate(-50%, -50%) scale(0.6)';
        submitBtn.style.pointerEvents = 'none';
      }
    }

    function updateTargetDisplay() {
      // Render assembled selection as a single flowing sentence (display-only)
      const assembled = selection.join(' ').replace(/\s+/g, ' ').trim();
      // Format for display (capitalize + full stop)
      const disp = displayifySentence(assembled);
      // Only update the text and text styling to avoid layout shifts
      targetEl.textContent = disp;
      targetEl.style.fontWeight = '700';
      targetEl.style.color = '#374151';
      // keep all other sizing/spacing defined in the template to prevent resizing
    }

    pool.querySelectorAll('.so-chunk').forEach((btn) => {
      btn.addEventListener('click', () => {
        const txt = btn.dataset.chunkRaw || btn.textContent.trim();
        // Add to selection and hide the chunk from pool
        selection.push(txt);
        btn.disabled = true;
        btn.style.opacity = '0.45';
        updateTargetDisplay();
        updateSubmitVisibility();
      });
    });
    updateSubmitVisibility();

    // Allow removing last selected chunk by clicking target area
    targetEl.addEventListener('click', () => {
      if (!selection.length) return;
      const removed = selection.pop();
      // Re-enable first matching disabled button in pool (matching on data-chunk-raw)
      const reBtn = Array.from(pool.querySelectorAll('.so-chunk')).find(b => (b.dataset.chunkRaw || b.textContent.trim()) === removed && b.disabled);
      if (reBtn) { reBtn.disabled = false; reBtn.style.opacity = '1'; }
      updateTargetDisplay();
      updateSubmitVisibility();
    });

    submitBtn.addEventListener('click', () => {
      const assembled = selection.join(' ').replace(/\s+/g,' ').trim();
      const normalizedAssembled = assembled.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const isCorrect = normalizedAssembled === canonicalTarget;
      state.attempted += 1;
      if (isCorrect) state.score += 1;
      // Log a single attempt for this assembled sentence
      try {
        logAttempt({
          session_id: state.sessionId,
          mode: MODE,
          word: canonicalTarget,
          is_correct: !!isCorrect,
          answer: assembled,
          correct_answer: canonicalTarget,
          points: isCorrect ? 1 : 0,
          attempt_index: state.index,
          round: state.index + 1,
          extra: { category: 'grammar', grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 }
        });
      } catch (e) {}

      // Show feedback: if correct, simple green message; if wrong, show user's assembled answer (red)
      // with the correct answer underneath (green). Wait slightly longer before advancing on wrong.
      const fb = document.createElement('div');
      fb.style.textAlign = 'center';
      fb.style.marginTop = '8px';
      fb.style.fontWeight = '700';

      // Play SFX if available
      try {
        if (typeof playSFX === 'function') playSFX(isCorrect ? 'correct' : 'wrong');
        else if (window && window.WordArcade && typeof window.WordArcade.playSFX === 'function') window.WordArcade.playSFX(isCorrect ? 'correct' : 'wrong');
        else if (typeof window !== 'undefined' && typeof window.playSFX === 'function') window.playSFX(isCorrect ? 'correct' : 'wrong');
      } catch (e) {}

      // Play sentence audio after feedback (short delay for SFX to finish)
      setTimeout(() => { playSentenceAudio(item); }, 300);

      // Hide the check button after submission
      submitBtn.style.opacity = '0';
      submitBtn.style.pointerEvents = 'none';

      if (isCorrect) {
        fb.style.color = '#2e7d32';
        fb.textContent = 'Correct!';
        try { feedbackArea.innerHTML = ''; feedbackArea.appendChild(fb); } catch (e) { container.querySelector('#so-target').after(fb); }
        setTimeout(() => {
          state.index += 1;
          renderRound();
        }, 2000); // Increased timeout to allow audio to play
      } else {
        // Wrong: show assembled (red) and correct (green) beneath, and require user to press Next
        const userLine = document.createElement('div');
        userLine.textContent = displayifySentence(assembled) || '(no answer)';
        userLine.style.color = '#d32f2f';
        userLine.style.fontWeight = '700';
        userLine.style.marginBottom = '6px';

        const correctLine = document.createElement('div');
        // display original nicely formatted target (capitalize + full stop)
        const targetDisplay = target.replace(/\s+/g, ' ').trim();
        correctLine.textContent = displayifySentence(targetDisplay);
        correctLine.style.color = '#2e7d32';
        correctLine.style.fontWeight = '700';

        // Next button for wrong-case (pauses until player advances)
        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next ▶';
        // Place Next button at bottom center of the screen
        nextBtn.style.position = 'fixed';
        nextBtn.style.left = '50%';
        nextBtn.style.bottom = 'calc(env(safe-area-inset-bottom, 0px) + 18px)';
        nextBtn.style.transform = 'translateX(-50%)';
        nextBtn.style.zIndex = '1200';
        nextBtn.style.padding = '10px 18px';
        nextBtn.style.borderRadius = '12px';
        nextBtn.style.border = '2px solid #21b5c0';
        nextBtn.style.background = '#fff';
        nextBtn.style.color = '#ff66c4';
        nextBtn.style.fontWeight = '700';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.boxShadow = '0 6px 16px rgba(33,181,192,0.12)';
        nextBtn.style.fontFamily = "'Poppins', Arial, sans-serif";

        fb.appendChild(userLine);
        fb.appendChild(correctLine);
        fb.appendChild(nextBtn);
        try { feedbackArea.innerHTML = ''; feedbackArea.appendChild(fb); } catch (e) { container.querySelector('#so-target').after(fb); }

        // Hide check button while waiting for Next
        submitBtn.style.opacity = '0';
        submitBtn.style.pointerEvents = 'none';

        nextBtn.addEventListener('click', () => {
          try { fb.remove(); } catch (e) {}
          state.index += 1;
          renderRound();
        });
      }
    });

    // Add quit button (fixed position at bottom)
    if (!document.getElementById('grammarL3QuitBtn')) {
      const quitBtn = document.createElement('button');
      quitBtn.id = 'grammarL3QuitBtn';
      quitBtn.type = 'button';
      quitBtn.className = 'wa-quit-btn';
      quitBtn.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);border:none;background:transparent;cursor:pointer;z-index:9999;padding:8px;';
      quitBtn.innerHTML = '<img src="./assets/Images/icons/quit-game.svg" alt="Quit" style="width:28px;height:28px;"/>';
      quitBtn.onclick = () => { quitBtn.remove(); window.history.back(); };
      document.body.appendChild(quitBtn);
    }
  }

  function finish() {
    // End session
    try {
      // Use grammarFile path for session tracking to match homework assignment list_key
      endSession(state.sessionId, {
        mode: MODE,
        summary: { score: state.score, total: state.list.length, correct: state.score, points: state.score, category: 'grammar', grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 },
        listName: state.grammarFile || state.grammarName || null,
        wordList: state.list.map(it => it.past || it.base || it.word || it.en).filter(Boolean),
        meta: { grammarFile: state.grammarFile, grammarName: state.grammarName, level: 3 }
      });
    } catch (e) {}
    // Remove any stray quit buttons
    try {
      const btn = document.getElementById('grammarL3QuitBtn');
      if (btn) btn.remove();
      document.querySelectorAll('.wa-quit-btn, [title="Quit"]').forEach(b => b.remove());
    } catch {}
    const gameArea = document.getElementById('gameArea');
    renderGrammarSummary({ gameArea, score: state.score, total: state.list.length, ctx: { grammarFile: state.grammarFile, grammarName: state.grammarName } });
    if (state && typeof state.onComplete === 'function') state.onComplete(state);
  }
}

export function stopGrammarSentenceOrderL3() { state = null; }

export default { start: startGrammarSentenceOrderL3, stop: stopGrammarSentenceOrderL3 };
