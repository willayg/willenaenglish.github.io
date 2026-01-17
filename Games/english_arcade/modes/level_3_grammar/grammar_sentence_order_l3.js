// Level 3 - Sentence Order Mode (chunk-based)
// Breaks sentences into 2-3 word contiguous chunks. Player taps chunks to assemble
// the target sentence in order. Audio plays after completing each sentence.
// Supports: past_simple_irregular, be_going_to, past_simple_regular, past_vs_future, all_tenses

import { startSession, logAttempt, endSession } from '../../../../students/records.js';
import { renderGrammarSummary } from '../grammar_summary.js';
import { FN } from '../../scripts/api-base.js';
import { openNowLoadingSplash } from '../unscramble_splash.js';
import { playSFX } from '../../sfx.js';

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

function injectSentenceOrderStyles() {
  if (document.getElementById('sentenceOrderL3Styles')) return;
  const style = document.createElement('style');
  style.id = 'sentenceOrderL3Styles';
  style.textContent = `
  .sentence-order-mode { font-family:Poppins,system-ui,sans-serif; animation:smFade .5s ease; }
  .sentence-order-mode .sm-header { display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 16px; flex-wrap:wrap; }
  .sentence-order-mode .sm-title { font-weight:800;color:#19777e;font-size:clamp(1rem,2vw,1.25rem); letter-spacing:.5px; }
  .sentence-order-mode .sm-counter { font-size:.75rem;font-weight:700;background:#e6f7f8;color:#19777e;padding:6px 12px;border-radius:20px;letter-spacing:.5px; border:1px solid #b9d9db; }
  .sentence-order-mode .sm-header-right { display:flex;align-items:center;gap:8px; }
  .sentence-order-mode .sm-score { font-size:.7rem;font-weight:800;background:#19777e;color:#fff;padding:6px 10px;border-radius:18px;letter-spacing:.5px; box-shadow:0 2px 8px rgba(0,0,0,0.15); }
  .sentence-order-mode .sm-box { position:relative;background:#f7f7fa;border:2px solid #d0d8e0;border-radius:20px;padding:22px 20px 20px;min-height:210px;display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 28px -4px rgba(74, 141, 146, 0.08); }
  .sentence-order-mode .sm-section-label { font-size:.65rem;font-weight:700; letter-spacing:.9px; color:#19777e; text-transform:uppercase; }
  .sentence-order-mode .sm-construct { min-height:54px; display:flex;flex-wrap:wrap;gap:10px; padding:4px 2px 2px; }
  .sentence-order-mode .sm-construct-line { background:#ffffff;border:1px solid #d0d8e0; border-radius:14px; min-height:56px; padding:12px 14px; display:flex;align-items:center;flex-wrap:wrap; gap:8px; font-size:1.05rem; line-height:1.35; font-weight:600; color:#0f172a; }
  .sentence-order-mode .sm-construct-line.sm-correct { box-shadow:0 0 0 3px #0d948888; border-color:#19777e; }
  .sentence-order-mode .sm-word-frag { background:#19777e; color:#fff; padding:6px 12px; border-radius:12px; position:relative; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600; font-size:.95rem; box-shadow:0 2px 8px rgba(0,0,0,0.18); animation:fragPop .35s ease; }
  .sentence-order-mode .sm-word-frag:focus-visible { outline:3px solid #19777e; outline-offset:3px; }
  .sentence-order-mode .sm-line-placeholder { opacity:.5; font-weight:500; font-size:.9rem; letter-spacing:.5px; }
  .sentence-order-mode .sm-tokens { justify-content:center; display:flex;flex-wrap:wrap;gap:10px; margin-top:2px; }
  .sentence-order-mode .sm-hint { text-align:center; color:#94a3b8; font-size:.92rem; margin-top:6px; }
  @keyframes fragPop { 0% { transform:scale(.4); opacity:0;} 70% { transform:scale(1.08); opacity:1;} 100% { transform:scale(1); opacity:1;} }
  .sentence-order-mode .sm-divider { height:1px; background:#d0d8e0; margin:2px 0 4px; }
  .sentence-order-mode .sm-feedback { min-height:24px; font-size:.85rem; font-weight:600; letter-spacing:.3px; }
  .sentence-order-mode .sm-chip { --sm-bg:#ffffff; --sm-border:#d0d8e0; --sm-color:#0f172a; position:relative; font:inherit; font-weight:600; font-size:.95rem; padding:10px 16px; border:2px solid var(--sm-border); background:var(--sm-bg); color:var(--sm-color); border-radius:16px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; line-height:1.1; box-shadow:0 3px 10px rgba(0,0,0,0.05); transition:background .25s, transform .25s, box-shadow .25s, border-color .25s; }
  .sentence-order-mode .sm-chip:hover:not(:disabled){ background:#f2fbfc; border-color:#19777e; }
  .sentence-order-mode .sm-chip:active:not(:disabled){ transform:scale(.92); }
  .sentence-order-mode .sm-chip:disabled { opacity:.3; cursor:default; }
  .sentence-order-mode .sm-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:4px; }
  .sentence-order-mode .flex-spacer { flex:1; }
  .sentence-order-mode .sm-btn { font:inherit; font-weight:800; letter-spacing:.3px; font-size:.95rem; border:2px solid transparent; color:#fff; padding:13px 28px; border-radius:16px; cursor:pointer; position:relative; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 14px -4px rgba(0,0,0,0.16); transition:box-shadow .22s, transform .22s, filter .22s; }
  .sentence-order-mode .sm-btn:hover { box-shadow:0 6px 20px -4px rgba(0,0,0,0.2); transform:translateY(-2px); }
  .sentence-order-mode .sm-btn:active { transform:scale(.96); box-shadow:0 4px 12px -4px rgba(0,0,0,0.2); }
  .sentence-order-mode .sm-btn.submit { background:#ff7a1a; border-color:#ff7a1a; }
  .sentence-order-mode .sm-btn.submit:hover { background:#ff8c3a; border-color:#ff8c3a; }
  .sentence-order-mode .sm-btn.primary { background:#19777e; border-color:#19777e; }
  .sentence-order-mode .sm-btn.primary:hover { background:#248b86; border-color:#248b86; }
  .sentence-order-mode .sm-btn.ghost { color:#19777e; border:2px solid #19777e; background:#fff; padding:10px 18px; box-shadow:0 2px 10px rgba(0,0,0,0.08); }
  .sentence-order-mode .sm-btn.ghost:hover { background:#f7f7fa; border-color:#248b86; }
  .sentence-order-mode #soSubmit.so-floating { position:absolute; top:calc(50% + 50px); left:50%; transform:translate(-50%,-50%) scale(.6); opacity:0; pointer-events:none; font-size:clamp(2.2rem,4vw,3.2rem); padding:30px 68px; border-radius:48px; letter-spacing:.9px; font-weight:800; background:#ff7a1a; color:#fff; border:3px solid #ff7a1a; box-shadow:0 22px 55px -12px rgba(0,0,0,0.4),0 0 0 5px rgba(255,122,26,0.18); backdrop-filter:blur(4px); transition:opacity .45s ease, transform .55s cubic-bezier(.16,.8,.24,1); }
  .sentence-order-mode #soSubmit.so-floating:hover { background:#ff8c3a; border-color:#ff8c3a; }
  .sentence-order-mode #soSubmit.so-floating-visible { opacity:1; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
  .sentence-order-mode #soSubmit.so-button-explode { animation:soButtonExplode 1.8s cubic-bezier(.34,.1,.68,-.55) forwards; }
  .sentence-order-mode #soSubmit.so-button-melt { animation:soButtonMelt 1.3s ease-in forwards; }
  .sentence-order-mode .so-confetti { position:fixed; width:14px; height:14px; pointer-events:none; border-radius:50%; }
  .sentence-order-mode .so-confetti.correct { animation:soConfetti 2.8s ease-out forwards; }
  .sentence-order-mode .so-confetti.wrong { animation:soMelt 1.2s ease-in forwards; }
  @keyframes soButtonExplode {
    0% { opacity:1; transform:translate(-50%,-50%) scale(1) rotate(0deg); }
    100% { opacity:0; transform:translate(-50%,-50%) scale(0) rotate(360deg); filter:blur(12px); }
  }
  @keyframes soButtonMelt {
    0% { opacity:1; transform:translate(-50%,-50%) scaleY(1) scaleX(1); }
    50% { opacity:0.8; transform:translate(-50%,-50%) scaleY(0.6) scaleX(1.1); }
    100% { opacity:0; transform:translate(-50%,-120%) scaleY(0.1) scaleX(1.3); filter:blur(10px); }
  }
  @keyframes soConfetti {
    0% { opacity:1; transform:translate(0,0) rotate(0deg) scale(1); }
    100% { opacity:0; transform:translate(var(--tx),var(--ty)) rotate(720deg) scale(0.2); }
  }
  @keyframes soMelt {
    0% { opacity:1; transform:translateY(0) scaleX(1) scaleY(1); }
    50% { opacity:0.9; }
    100% { opacity:0; transform:translateY(120px) scaleX(0.2) scaleY(0.5); filter:blur(8px); }
  }
  .cgm-mode-root { display:flex; flex-direction:column; min-height:100vh; }
  @keyframes smFade { 0% { opacity:0;} 100% { opacity:1;} }
  `;
  document.head.appendChild(style);
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
  // Remove punctuation and lowercase for cleaner display
  const cleanSentence = String(sentence || '')
    .trim()
    .replace(/[.!?;:,]/g, '') // Remove punctuation
    .toLowerCase()
    .replace(/\s+/g, ' ');
  
  const words = cleanSentence.split(' ').filter(Boolean);
  if (!words.length) return [];
  
  // Less than 3 words: return as-is (single-word or multi-word chunks are OK for short sentences)
  if (words.length < 3) return words;
  
  // 3-5 words: split into chunks, allow single words
  if (words.length <= 5) {
    const chunkSize = Math.ceil(words.length / 3);
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '));
    }
    return chunks;
  }
  
  // 6+ words: use 2-3 word chunks to avoid single-word pieces
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const remaining = words.length - i;
    let size = 2; // Default 2-word chunks for longer sentences
    
    // Use 3-word chunks when we have plenty of words left
    if (remaining >= 5) {
      size = 3;
    }
    
    // If only 1 word left, merge with previous chunk
    if (remaining === 1 && chunks.length > 0) {
      const last = chunks.pop();
      chunks.push((last + ' ' + words[i]).trim());
      break;
    }
    
    chunks.push(words.slice(i, i + size).join(' '));
    i += size;
  }
  
  return chunks.length >= 3 ? chunks : words; // Fallback to word-by-word if something goes wrong
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

    injectSentenceOrderStyles();
    container.innerHTML = '';
    container.classList.add('cgm-mode-root');
    
    const wrap = document.createElement('div');
    wrap.className = 'sentence-order-mode';
    wrap.innerHTML = `
      <div class="sm-header">
        <div class="sm-title">Sentence Order</div>
        <div class="sm-header-right">
          <div class="sm-counter">${state.index + 1} / ${state.list.length}</div>
          <div class="sm-score">${state.score} pts</div>
        </div>
      </div>
      <div class="sm-box fade-in">
        <div class="sm-section-label">Build the sentence:</div>
        <div id="soConstruct" class="sm-construct sm-construct-line" aria-label="Your assembled sentence" role="presentation"><span class="sm-line-placeholder">Tap words below…</span></div>
        <div class="sm-divider"></div>
        <div id="soTokens" class="sm-tokens" aria-label="Available chunks" role="list"></div>
        ${koHint ? `<div id="soHint" class="sm-hint">${escapeHtml(koHint)}</div>` : ''}
        <div id="soFeedback" class="sm-feedback" aria-live="polite"></div>
        <div class="sm-actions">
          <button id="soClear" class="sm-btn ghost" type="button">Reset</button>
          <div class="flex-spacer"></div>
          <button id="soSubmit" class="sm-btn submit so-floating" type="button">Check</button>
        </div>
      </div>
    `;
    container.appendChild(wrap);

    const pool = wrap.querySelector('#soTokens');
    const constructEl = wrap.querySelector('#soConstruct');
    const submitBtn = wrap.querySelector('#soSubmit');
    const feedbackArea = wrap.querySelector('#soFeedback');
    const clearBtn = wrap.querySelector('#soClear');
    const totalChunks = shuffled.length;

    const selection = [];

    // Show/hide check button based on whether all chunks are placed
    function updateSubmitVisibility() {
      if (selection.length === totalChunks) {
        submitBtn.classList.add('so-floating-visible');
      } else {
        submitBtn.classList.remove('so-floating-visible');
      }
    }

    function updateTargetDisplay() {
      // Render assembled selection with inline word fragments
      constructEl.innerHTML = '';
      if (selection.length === 0) {
        constructEl.innerHTML = '<span class="sm-line-placeholder">Tap words below…</span>';
      } else {
        selection.forEach((chunk, idx) => {
          const frag = document.createElement('span');
          frag.className = 'sm-word-frag';
          frag.textContent = chunk;
          frag.style.cursor = 'pointer';
          frag.title = 'Click to remove';
          frag.addEventListener('click', () => {
            selection.splice(idx, 1);
            updateTargetDisplay();
            updateSubmitVisibility();
            enableAllChunks();
          });
          constructEl.appendChild(frag);
        });
      }
    }

    function enableAllChunks() {
      pool.querySelectorAll('.sm-chip').forEach(btn => {
        btn.disabled = false;
      });
    }

    // Render chunk buttons with sm-chip styling
    shuffled.forEach((chunk, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sm-chip';
      btn.textContent = chunk;
      btn.dataset.chunkIdx = idx;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        selection.push(chunk);
        btn.disabled = true;
        updateTargetDisplay();
        updateSubmitVisibility();
      });
      pool.appendChild(btn);
    });

    clearBtn.addEventListener('click', () => {
      selection.length = 0;
      updateTargetDisplay();
      updateSubmitVisibility();
      enableAllChunks();
      feedbackArea.textContent = '';
    });

    updateTargetDisplay();
    updateSubmitVisibility();

    submitBtn.addEventListener('click', () => {
      const assembled = selection.join(' ').replace(/\s+/g, ' ').trim();
      const normalizedAssembled = assembled.replace(/[^\w\s]|_/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
      const isCorrect = normalizedAssembled === canonicalTarget;
      state.attempted += 1;
      if (isCorrect) state.score += 1;

      // Log attempt
      try {
        logAttempt({
          session_id: state.sessionId,
          mode: MODE,
          word: (item.past || item.base || item.word || canonicalTarget),
          is_correct: !!isCorrect,
          answer: assembled,
          correct_answer: target,
          points: isCorrect ? 1 : 0,
          extra: { variant: 'l3_sentence_order', level: 3 }
        });
      } catch (e) {
        console.debug('[SentenceOrderL3] logAttempt failed', e?.message);
      }

      // Play SFX immediately
      try {
        if (typeof playSFX === 'function') playSFX(isCorrect ? 'correct' : 'wrong');
      } catch (e) { 
        console.debug('[SentenceOrderL3] SFX failed', e?.message); 
      }

      // Disable interactions during feedback
      submitBtn.disabled = true;
      pool.querySelectorAll('.sm-chip').forEach(b => { b.disabled = true; });
      clearBtn.disabled = true;

      if (isCorrect) {
        constructEl.classList.add('sm-correct');
        feedbackArea.style.color = '#2e7d32';
        feedbackArea.textContent = '✓ Correct!';
        
        // Button explodes
        submitBtn.classList.add('so-button-explode');
        
        playSentenceAudio(item);
        setTimeout(() => {
          state.index += 1;
          renderRound();
        }, 2800);
      } else {
        feedbackArea.style.color = '#c62828';
        feedbackArea.textContent = '✗ Try again';
        
        // Button melts
        submitBtn.classList.add('so-button-melt');
        
        setTimeout(() => {
          feedbackArea.textContent = '';
          constructEl.classList.remove('sm-correct');
          submitBtn.classList.remove('so-button-melt');
          submitBtn.disabled = false;
          clearBtn.disabled = false;
          pool.querySelectorAll('.sm-chip').forEach(b => { b.disabled = false; });
        }, 1500);
      }
    });
    
    
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
