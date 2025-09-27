// Sentence Mode (Unscramble – Phase 1)
// ---------------------------------------------------------------------------
// Provides a single mechanic: Sentence Unscramble with partial‑credit scoring.
// Scoring rubric (position accuracy after single attempt):
//   100% correct => 3 points
//    80–99%      => 2 points
//    60–79%      => 1 point
//    <60%        => 0 points
// Each sentence logs one attempt via records.js with extra metadata (pct, token stats).
// Word key logged as `${eng}__sentence` (fallback sentence_{n} if eng missing).
// Future mechanics (Fill Blank, Completion, Chunk) will extend this module.
// ---------------------------------------------------------------------------

import { startSession, logAttempt, endSession } from '../../../students/records.js';
// Sentence ID Upgrade Layer (additive, backward compatible)
// Supports optional structure: sentences: [ { id, text?, audio_key? } ], primary_sentence_id
// Normalization chooses a primary sentence + sentence_id; legacy `sentence` retained.
// Audio resolution order per item:
//  1. explicit audio_key
//  2. sent_<sentence_id>.mp3 (heuristic)
//  3. legacy <eng>_SENTENCE.mp3 via lambda
//  4. runtime TTS
// Logging now includes extra.sentence_id when present.
// LEGACY FALLBACK POLICY:
//   We intentionally keep using legacy_sentence / example-derived sentences if no sentence_id yet.
//   normalizeWordsToSentenceItems promotes example -> legacy_sentence -> sentence for gameplay.
//   After builder upgrades insert sentence IDs, items gain sentences:[{id}] + primary_sentence_id.
//   Removal of legacy fields will be a separate migration once metrics show minimal fallback use.

// Normalize incoming word objects to a unified sentence item structure.
// Accepts legacy shape: { eng, sentence }
// And upgraded: { eng, legacy_sentence, sentences:[{id,text,audio_key,weight}], primary_sentence_id }
function normalizeWordsToSentenceItems(list){
  return (list||[]).map(raw=>{
    if(!raw || typeof raw!== 'object') return null;
    const item = { ...raw };
    // Legacy compatibility
    if (!item.sentence && item.legacy_sentence) item.sentence = item.legacy_sentence;
    // If upgraded structure present choose primary sentence
    if (Array.isArray(item.sentences) && item.sentences.length){
      let chosen = null;
      if (item.primary_sentence_id){
        chosen = item.sentences.find(s=>s.id === item.primary_sentence_id) || null;
      }
      if (!chosen){
        // simple weight heuristic then fallback first
        chosen = item.sentences.slice().sort((a,b)=> (b.weight||1) - (a.weight||1))[0];
      }
      if (chosen){
        item.sentence_id = chosen.id;
        // Always prefer authoritative DB sentence text over legacy fallback
        if (chosen.text) item.sentence = chosen.text;
        if (chosen.audio_key && !item.audio_key) item.audio_key = chosen.audio_key;
      }
    }
    return item;
  }).filter(Boolean);
}

// Fetch audio URLs with multi-tier fallback: audio_key -> sent_<id>.mp3 -> legacy get_audio_urls lambda.
async function enrichSentenceAudioIDAware(items){
  if (!items || !items.length) return;
    // 1. If any have audio_key try to form a usable URL. IMPORTANT: previously we blindly used the raw key
    //    which produced a relative path (404) when no bucket base was defined, blocking fallback because
    //    playSentenceAudio saw a URL and returned early. Now: only set sentenceAudioUrl if we are confident
    //    it is fetchable (absolute URL OR we have a base). Otherwise we leave it unset so later heuristics
    //    (sentence_id -> heuristic / signed lookup) or legacy fallback can run.
    items.forEach(it=>{
      if(!it || !it.audio_key) return;
      const key = String(it.audio_key).trim();
      if(/^https?:/i.test(key)){
        it.sentenceAudioUrl = key;
        return;
      }
      // key looks like an object name (e.g., sent_<uuid>.mp3) – only build URL if base present
      if (window.__SENT_AUDIO_BASE){
        it.sentenceAudioUrl = window.__SENT_AUDIO_BASE.replace(/\/$/,'') + '/' + key;
      } else {
        // Leave unset; we'll attempt sentence_id heuristic/signed fetch OR legacy fallback.
        // Mark for diagnostics
        it._pendingKeyOnly = true;
      }
    });
  // 2. Try heuristic sent_<id>.mp3 if sentence_id present and no url yet
  const needHeuristic = items.filter(it=> !it.sentenceAudioUrl && it.sentence_id);
  if (needHeuristic.length && window.__SENT_AUDIO_BASE){
    needHeuristic.forEach(it=>{ it.sentenceAudioUrl = `${window.__SENT_AUDIO_BASE.replace(/\/$/,'')}/sent_${it.sentence_id}.mp3`; });
  }
  // 2b. If still missing and we DO have sentence_ids, try signed URL function (no base set scenario)
  const stillMissing = items.filter(it=> !it.sentenceAudioUrl && it.sentence_id);
  if (stillMissing.length){
    try {
      const uniqueIds = Array.from(new Set(stillMissing.map(it=> it.sentence_id)));
      const r = await fetch('/.netlify/functions/get_sentence_audio_urls', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sentence_ids: uniqueIds }) });
      if (r.ok){
        const data = await r.json().catch(()=>null);
        if(data && data.success && data.results){
          stillMissing.forEach(it=>{
            const rec = data.results[it.sentence_id];
            if(rec && rec.exists && rec.url){ it.sentenceAudioUrl = rec.url; it.audio_key = rec.key || it.audio_key; }
          });
        }
      }
    } catch(e){ console.debug('[SentenceMode] sentence id audio signed fetch failed', e?.message); }
  }
  // 3. Collect which still lack URL and have eng for legacy lambda
  const legacyNeed = items.filter(it=> !it.sentenceAudioUrl && it.eng);
  if (!legacyNeed.length) return;
  try {
    const keys = Array.from(new Set(legacyNeed.map(i=> `${i.eng}_SENTENCE`)));
    const r = await fetch('/.netlify/functions/get_audio_urls', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ words: keys }) });
    if (r.ok){
      const data = await r.json();
      if (data && data.results){
        legacyNeed.forEach(it=>{
          const k = `${it.eng}_SENTENCE`.toLowerCase();
            const rec = data.results[k] || data.results[k.toUpperCase()] || data.results[k.toLowerCase()];
            if (rec && rec.exists && rec.url){ it.sentenceAudioUrl = rec.url; }
        });
      }
    }
  } catch(e){ console.debug('[SentenceMode] legacy audio fetch failed', e?.message); }
}

export function run(ctx){
  const root = ctx.gameArea || document.getElementById('gameStage') || document.body; if(!root) return console.error('[SentenceMode] Missing root');
  // Normalize & filter items (replaces earlier legacy-only block)
  let items = normalizeWordsToSentenceItems(ctx.wordList || []);
  items = items.filter(w => w && w.sentence && typeof w.sentence === 'string' && w.sentence.trim().split(/\s+/).length >= 3);
  items = shuffle(items.slice());
  if(!items.length){ root.innerHTML = renderErrorBox('No sentences available for this list. Add sentence examples first.'); return; }
  // Audio enrichment (ID-aware + legacy). Proceed regardless of outcome.
  enrichSentenceAudioIDAware(items).finally(()=>{ showModeMenu(); });
  let index = 0;
  let sentencesCorrect = 0; // count fully correct sentences
  let totalPoints = 0;      // accumulated partial-credit points
  let sessionId = null;     // session identifier for logging
  // Track mistakes for post-session review
  let unscrambleMissed = []; // indices of sentences not 100% correct
  let fillBlankMissed = [];  // indices of fill-gap rounds not perfect
  // Review state flags & saved lists (prevent premature restoration causing extra rounds)
  let inUnscrambleReview = false;
  let inFillBlankReview = false;
  let savedUnscrambleItems = null;
  let savedFillBlankItems = null;
  // Broken Sentence (chunk) tracking
  let brokenMissed = [];
  let inBrokenReview = false;
  let savedBrokenItems = null;
  let brokenIndex = 0; // separate pointer
  let brokenCorrectSentences = 0;
  let brokenPoints = 0;
  let brokenSessionId = null;

  function startUnscramble(){
    root.innerHTML = '';
    root.classList.add('cgm-mode-root');
    const wrap = document.createElement('div');
    wrap.className = 'sentence-mode';
      injectStylesOnce();
        wrap.innerHTML = `
        <div class="sm-header">
          <div class="sm-title">Sentence Unscramble</div>
          <div class="sm-header-right">
            <div id="smCounter" class="sm-counter">1 / ${items.length}</div>
            <div id="smScore" class="sm-score" aria-label="Points earned this session">0 pts</div>
          </div>
        </div>
        <div id="smSentenceBox" class="sm-box fade-in">
          <div class="sm-section-label">Build the sentence:</div>
          <div id="smConstruct" class="sm-construct sm-construct-line" aria-label="Your assembled sentence" role="presentation"><span class="sm-line-placeholder">Tap words below…</span></div>
          <div class="sm-divider"></div>
          <div id="smTokens" class="sm-tokens" aria-label="Available words" role="list"></div>
          <div id="smFeedback" class="sm-feedback" aria-live="polite"></div>
          <div class="sm-actions">
            <button id="smReplay" class="sm-btn ghost audio" type="button">🔊 Sentence</button>
            <button id="smClear" class="sm-btn ghost" type="button">Reset</button>
            <div class="flex-spacer"></div>
            <button id="smSubmit" class="sm-btn primary" type="button">Check</button>
            <button id="smNext" class="sm-btn accent" type="button" style="display:none;">Next ▶</button>
          </div>
          <div class="sm-back-link" data-nav="menu">← Back</div>
        </div>`;
    root.appendChild(wrap);

    // Begin a session (non-blocking if startSession unavailable)
    try { sessionId = startSession({ mode: 'full_sentence_mode', wordList: items, listName: ctx?.listName || null }); } catch(e){ console.debug('[SentenceMode] startSession skipped', e?.message); }
    renderRound();
    // Back link navigation
    const backLink = root.querySelector('.sm-back-link[data-nav="menu"]');
    if (backLink){ backLink.addEventListener('click', ()=>{ showModeMenu(); }); }
  }

  function showModeMenu(){
    injectStylesOnce();
    // Allow URL variant override (?variant=unscramble)
    const params = new URLSearchParams(location.search);
    const variant = params.get('variant');
    if (variant === 'unscramble') { startUnscramble(); return; }
    if (variant === 'fillblank') { startFillBlank(); return; }
    if (variant === 'broken') { startBrokenSentence(); return; }
    root.innerHTML = `
      <div class="sm-mode-menu">
        <div class="sm-mode-card">
          <h2 class="sm-mode-title">Sentence Practice</h2>
          <p class="sm-mode-desc">Choose a sentence activity:</p>
          <div class="sm-mode-options">
            <button type="button" class="sm-mode-btn" data-variant="broken">Broken Sentence</button>
            <button type="button" class="sm-mode-btn" data-variant="unscramble">Unscramble Sentence</button>
            <button type="button" class="sm-mode-btn" data-variant="fillblank">Fill in the Blank</button>
          </div>
        </div>
      </div>`;
    root.querySelectorAll('.sm-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-variant');
        if (v === 'broken') { startBrokenSentence(); return; }
        if (v === 'unscramble') startUnscramble();
        if (v === 'fillblank') startFillBlank();
      });
    });
  }

  // --- Broken Sentence Mode (phrase chunks) ---
  function startBrokenSentence(){
    // Pre-compute chunks lazily per item if not yet (with safety so one bad sentence doesn't break mode)
    items.forEach(it=>{ 
      if(!it._chunks){ 
        try { it._chunks = chunkSentence(it.sentence); } catch(e){ console.warn('[SentenceMode][Broken] chunkSentence failed', e?.message); it._chunks = [it.sentence]; }
      }
    });
    root.innerHTML = '';
    root.classList.add('cgm-mode-root');
    const wrap = document.createElement('div');
    wrap.className='sentence-mode';
    injectStylesOnce();
    wrap.innerHTML = `
      <div class="sm-header">
        <div class="sm-title">Broken Sentence</div>
        <div class="sm-header-right">
          <div id="bsCounter" class="sm-counter">1 / ${items.length}</div>
          <div id="bsScore" class="sm-score">0 pts</div>
        </div>
      </div>
      <div id="bsBox" class="sm-box fade-in">
        <div class="sm-section-label">Rebuild the sentence (chunks):</div>
        <div id="bsConstruct" class="sm-construct sm-construct-line"><span class="sm-line-placeholder">Tap chunks below…</span></div>
        <div class="sm-divider"></div>
        <div id="bsTokens" class="sm-tokens" aria-label="Chunks" role="list"></div>
        <div id="bsFeedback" class="sm-feedback" aria-live="polite"></div>
        <div class="sm-actions">
          <button id="bsReplay" class="sm-btn ghost audio" type="button">🔊 Sentence</button>
          <button id="bsClear" class="sm-btn ghost" type="button">Reset</button>
          <div class="flex-spacer"></div>
          <button id="bsSubmit" class="sm-btn primary" type="button">Check</button>
          <button id="bsNext" class="sm-btn accent" type="button" style="display:none;">Next ▶</button>
        </div>
        <div class="sm-back-link" data-nav="menu">← Back</div>
      </div>`;
    root.appendChild(wrap);
    // Start session (new mode key)
    try { brokenSessionId = startSession({ mode: 'broken_sentence_mode', wordList: items, listName: ctx?.listName || null }); } catch {}
    brokenIndex = 0; brokenCorrectSentences = 0; brokenPoints = 0;
    renderBrokenRound();
    const backLink = root.querySelector('.sm-back-link[data-nav="menu"]'); if(backLink) backLink.addEventListener('click', ()=>showModeMenu());
  }

  function renderBrokenRound(){
    const item = items[brokenIndex];
    if (!item){ return showBrokenSummary(); }
    const counter = root.querySelector('#bsCounter'); if(counter) counter.textContent = `${brokenIndex+1} / ${items.length}`;
    const constructEl = root.querySelector('#bsConstruct');
    const tokensEl = root.querySelector('#bsTokens');
    const feedbackEl = root.querySelector('#bsFeedback');
    const submitBtn = root.querySelector('#bsSubmit');
    const nextBtn = root.querySelector('#bsNext');
    const replayBtn = root.querySelector('#bsReplay');
    const clearBtn = root.querySelector('#bsClear');
    constructEl.innerHTML = '<span class="sm-line-placeholder">Tap chunks below…</span>';
    tokensEl.innerHTML='';
    feedbackEl.textContent='';
    submitBtn.style.display='';
    nextBtn.style.display='none';
    submitBtn.classList.add('sm-floating');
    submitBtn.classList.remove('sm-floating-visible');
    let locked = false;
    const chunks = (item._chunks||[]).slice();
    // Sanitize for display: lowercase & strip trailing period if sentence end only
    const displayChunks = chunks.map(c=>{
      let d = c.trim();
      if (/^[A-Z]/.test(d)) d = d.charAt(0).toLowerCase()+d.slice(1); // lower initial cap
      // remove final period/!/? if it's the only punctuation at end
      if (/^[^.!?]+[.!?]$/.test(d)) d = d.replace(/[.!?]$/,'');
      return d;
    });
    // Use displayChunks for user interaction; keep original chunks for correctness order but compare normalized
    const shuffled = shuffle(chunks.slice());
    function updateSubmitVisibility(){
      if (locked) return;
      const placed = Array.from(constructEl.querySelectorAll('[data-chunk]')).length;
      if (placed === chunks.length){ submitBtn.classList.add('sm-floating-visible'); }
      else submitBtn.classList.remove('sm-floating-visible');
    }
    window.__bsUpdateSubmit = updateSubmitVisibility;
    shuffled.forEach((chunk,idx) => {
      const btn = document.createElement('button');
      btn.type='button'; btn.className='sm-chip';
      // map original chunk to its sanitized version for display
      const originalIndex = chunks.indexOf(chunk);
      const disp = originalIndex>-1 ? displayChunks[originalIndex] : chunk;
      btn.textContent = disp;
      btn.dataset.chunk = chunk; // keep original text in dataset for correctness mapping
      btn.addEventListener('click',()=>{
        if(locked) return;
        btn.disabled = true;
        addChunkToLine(chunk, btn);
        updateSubmitVisibility();
      });
      tokensEl.appendChild(btn);
    });
    updateSubmitVisibility();
    submitBtn.onclick = ()=>{
      if (locked) return;
      const attempt = Array.from(constructEl.querySelectorAll('[data-chunk]')).map(el=>el.getAttribute('data-chunk'));
      if (attempt.length !== chunks.length){
        feedbackEl.textContent='Complete the sentence.'; feedbackEl.style.color='#b45309'; return;
      }
      let correctPos = 0;
      for (let i=0;i<chunks.length;i++){ if (attempt[i] === chunks[i]) correctPos++; }
      const pct = Math.round((correctPos / chunks.length) * 100);
      const pts = pointsForPercent(pct);
      locked = true;
      Array.from(tokensEl.querySelectorAll('button')).forEach(b=>b.disabled=true);
      const perfect = pct === 100;
      if (perfect){
        brokenCorrectSentences++; feedbackEl.textContent='Correct!'; feedbackEl.style.color='#065f46'; playSfx('right');
        constructEl.classList.add('sm-correct');
      } else {
        if (pct >= 80) playSfx('almost'); else playSfx('wrong');
        feedbackEl.textContent='Answer Shown'; feedbackEl.style.color='#b91c1c';
        constructEl.classList.add('sm-incorrect');
        // reveal correct order
        constructEl.innerHTML='';
        chunks.forEach(ch=>{
          const span = document.createElement('span');
          span.className='sm-word-frag sm-word-inline sm-solution';
          // show sanitized reveal too
          let d = ch.trim(); if (/^[A-Z]/.test(d)) d = d.charAt(0).toLowerCase()+d.slice(1); d = d.replace(/[.!?]$/,'');
          span.textContent=d;
          constructEl.appendChild(span);
        });
        if (!inBrokenReview) brokenMissed.push(brokenIndex);
      }
      brokenPoints += pts;
      const scoreEl = root.querySelector('#bsScore'); if(scoreEl) scoreEl.textContent = `${brokenPoints} pts`;
      // Log
      try {
        const wordKey = (items[brokenIndex]?.eng ? `${items[brokenIndex].eng}__broken` : `broken_${brokenIndex+1}`);
        logAttempt({
          session_id: brokenSessionId,
          mode: 'broken_sentence_mode',
          word: wordKey,
          is_correct: perfect,
          answer: attempt.join(' | '),
          correct_answer: chunks.join(' | '),
          points: pts,
          attempt_index: brokenIndex,
          round: brokenIndex+1,
          extra: { pct, chunks_total: chunks.length, chunks_correct: correctPos, sentence: item.sentence, attempt_chunks: attempt, sentence_id: item.sentence_id || null }
        });
      } catch(e){}
      submitBtn.classList.remove('sm-floating-visible'); submitBtn.style.display='none'; nextBtn.style.display='';
    };
    nextBtn.onclick = ()=>{ brokenIndex++; renderBrokenRound(); };
    clearBtn.onclick = ()=>{ if(!locked) renderBrokenRound(); };
    replayBtn.onclick = ()=>{ playSentenceAudio(item); };
    setTimeout(()=>playSentenceAudio(item), 150);
  }

  function addChunkToLine(chunk, originBtn){
    const constructEl = root.querySelector('#bsConstruct'); if(!constructEl) return;
    const placeholder = constructEl.querySelector('.sm-line-placeholder'); if(placeholder) placeholder.remove();
    const span = document.createElement('span');
    span.className='sm-word-frag sm-word-inline';
    span.textContent=chunk;
    span.setAttribute('data-chunk', chunk);
    span.tabIndex=0;
    span.addEventListener('click',()=>{ span.remove(); originBtn.disabled=false; originBtn.focus(); if(!constructEl.querySelector('[data-chunk]')) addPlaceholder(constructEl); if(window.__bsUpdateSubmit) window.__bsUpdateSubmit(); });
    span.addEventListener('keydown', (e)=>{ if(['Backspace','Delete','Enter',' '].includes(e.key)){ e.preventDefault(); span.click(); }});
    constructEl.appendChild(span);
    if(window.__bsUpdateSubmit) window.__bsUpdateSubmit();
  }

  function showBrokenSummary(){
    const pct = items.length ? Math.round((brokenCorrectSentences / items.length) * 100) : 0;
    try { endSession(brokenSessionId, { mode:'broken_sentence_mode', summary:{ total: items.length, correct: brokenCorrectSentences, points: brokenPoints, pct }}); } catch {}
    const heading = inBrokenReview ? 'Review Complete' : 'Nice Work!';
    root.innerHTML = `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:Poppins,system-ui;padding:34px 26px 38px;background:linear-gradient(165deg,#ffffff,#f2fbfc);border:2px solid #93cbcf;border-radius:24px;box-shadow:0 8px 28px -4px rgba(8,70,74,0.18);position:relative;">
      <div class="sm-back-link" data-nav="menu" style="position:absolute;left:10px;bottom:6px;">← Back to Sentence Menu</div>
      <h2 style="margin:0 0 14px;font-size:1.6rem;color:#19777e;font-weight:800;">${heading}</h2>
      <div style="font-size:1rem;color:#334155;margin-bottom:8px;">You completed ${items.length} sentence${items.length===1?'':'s'}.</div>
      <div style="font-size:.95rem;color:#334155;margin-bottom:4px;">Fully Correct: <strong>${brokenCorrectSentences}</strong> / ${items.length} (${pct}%)</div>
      <div style="font-size:.95rem;color:#334155;margin-bottom:14px;">Points Earned: <strong>${brokenPoints}</strong></div>
      <div class="sm-summary-actions">
        ${inBrokenReview ? '' : '<button class="sm-summary-btn" data-act="replay">Play Again</button>'}
        <button class="sm-summary-btn" data-act="menu">${inBrokenReview ? 'Done' : 'Start Menu'}</button>
      </div>
    </div>`;
    const sumRoot = root.querySelector('.sm-summary-actions');
    if(sumRoot){
      if(!inBrokenReview){ const replay = sumRoot.querySelector('[data-act="replay"]'); if(replay) replay.addEventListener('click',()=>location.reload()); }
      sumRoot.querySelector('[data-act="menu"]').addEventListener('click',()=>showModeMenu());
      if(!inBrokenReview && brokenMissed.length){
        const btn = document.createElement('button');
        btn.className='sm-summary-btn'; btn.textContent='Fix Mistakes';
        btn.addEventListener('click',()=>startBrokenReview());
        sumRoot.appendChild(btn);
      }
    }
    const backLink = root.querySelector('.sm-back-link[data-nav="menu"]'); if(backLink) backLink.addEventListener('click',()=>showModeMenu());
    if (inBrokenReview && savedBrokenItems){
      items = savedBrokenItems; savedBrokenItems=null; inBrokenReview=false;
    }
  }

  function startBrokenReview(){
    if(!brokenMissed.length) return;
    const missed = brokenMissed.map(i=>items[i]).filter(Boolean);
    if(!missed.length) return;
    savedBrokenItems = items; items = missed; inBrokenReview = true; brokenMissed=[];
    brokenIndex = 0; brokenCorrectSentences = 0; brokenPoints = 0;
    startBrokenSentence();
  }

  // --- Fill Blank Mode (single blank per sentence) ---
  function startFillBlank(){
    // Multi-gap: remove up to 4 words; student restores correct order.
    root.innerHTML = '';
    root.classList.add('cgm-mode-root');
    const wrap = document.createElement('div');
    wrap.className = 'sentence-mode';
    injectStylesOnce();
    wrap.innerHTML = `
      <div class="sm-header">
        <div class="sm-title">Fill the Gaps (4)</div>
        <div class="sm-header-right">
          <div id="fbCounter" class="sm-counter">1 / ${items.length}</div>
          <div id="fbScore" class="sm-score" aria-label="Points earned this session">0 pts</div>
        </div>
      </div>
      <div id="fbBox" class="sm-box fade-in">
        <div class="sm-section-label">Restore the missing words (order matters):</div>
        <div id="fbSentence" class="sm-construct-line" style="min-height:68px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:1.05rem;font-weight:600;color:#0f172a;"></div>
        <div class="sm-divider"></div>
        <div id="fbChoices" class="sm-tokens" aria-label="Missing words" role="list" style="display:flex;flex-wrap:wrap;justify-content:center;gap:14px;"></div>
        <div id="fbFeedback" class="sm-feedback" aria-live="polite"></div>
        <div class="sm-actions">
          <button id="fbReplay" class="sm-btn ghost audio" type="button">🔊 Sentence</button>
          <button id="fbSubmit" class="sm-btn primary sm-floating" type="button">Check</button>
          <div class="flex-spacer"></div>
          <button id="fbNext" class="sm-btn accent" type="button" style="display:none;">Next ▶</button>
        </div>
        <div class="sm-back-link" data-nav="menu">← Back</div>
      </div>`;
    root.appendChild(wrap);
    let fbIndex = 0;
    let fbPoints = 0; // total points across all rounds (1 per correctly placed gap)
    let fbCorrectFull = 0; // count of rounds where all gaps correct
    let fbSessionId = null;
    // Back link
    const fbBack = root.querySelector('.sm-back-link[data-nav="menu"]');
    if (fbBack){ fbBack.addEventListener('click', ()=>{ showModeMenu(); }); }
    try { fbSessionId = startSession({ mode: 'fill_blank_sentence_mode', wordList: items, listName: ctx?.listName || null }); } catch {}

    function renderFbRound(){
      const item = items[fbIndex];
      if (!item){ return showFbSummary(); }
      const counter = root.querySelector('#fbCounter'); if(counter) counter.textContent = `${fbIndex+1} / ${items.length}`;
      const sentenceEl = root.querySelector('#fbSentence');
      const choicesEl = root.querySelector('#fbChoices');
      const feedbackEl = root.querySelector('#fbFeedback');
      const nextBtn = root.querySelector('#fbNext');
      const replayBtn = root.querySelector('#fbReplay');
      const submitBtn = root.querySelector('#fbSubmit');
      feedbackEl.textContent=''; nextBtn.style.display='none';
      // Reset submit button visibility state each round
      submitBtn.style.display='';
      submitBtn.classList.add('sm-floating');
      submitBtn.classList.remove('sm-floating-visible');
      choicesEl.innerHTML=''; sentenceEl.innerHTML='';
      let locked = false;
      const tokens = tokenize(item.sentence);
      // Select up to 4 candidate indices (words, len>=3) randomly
      const candidateIdx = tokens.map((t,i)=>({t,i})).filter(o=>/^[A-Za-z']{3,}$/.test(o.t)).map(o=>o.i);
      shuffle(candidateIdx);
      const removedIdx = candidateIdx.slice(0, Math.min(4, candidateIdx.length || 1));
      removedIdx.sort((a,b)=>a-b); // order for mapping to original sentence order
      const removedWords = removedIdx.map(i=>tokens[i]);
      // Build sentence with placeholders
      const placeholderMap = new Map(); // slot index -> element
      let gapSlot = 0;
      tokens.forEach((tok,i)=>{
        if (removedIdx.includes(i)){
          const span = document.createElement('span');
          span.className='fb-gap';
          span.setAttribute('data-slot', gapSlot);
          span.textContent='____';
          span.addEventListener('click', ()=>{ if (locked) return; if (!span.dataset.word) return; // remove filled
            const w = span.dataset.word; delete span.dataset.word; span.textContent='____'; span.classList.remove('filled');
            // re-enable chip
            const chip = choicesEl.querySelector(`button[data-word="${CSS.escape(w)}"]`);
            if (chip){ chip.disabled=false; }
            updateSubmitVisibility();
          });
          placeholderMap.set(gapSlot, span);
          gapSlot++;
          sentenceEl.appendChild(span);
        } else {
          const span = document.createElement('span');
          span.textContent = tok;
          span.style.margin='0 4px 4px 0';
          sentenceEl.appendChild(span);
        }
      });
      // Build chips (shuffled removed words)
      const choiceWords = shuffle(removedWords.slice());
      choiceWords.forEach(w=>{
        const btn = document.createElement('button');
        btn.type='button'; btn.className='sm-chip'; btn.textContent=w; btn.dataset.word=w;
        btn.addEventListener('click', ()=>{
          if (locked) return;
          // find first empty placeholder
          for (const span of placeholderMap.values()){
            if (!span.dataset.word){
              span.dataset.word = w; span.textContent=w; span.classList.add('filled'); btn.disabled=true; break;
            }
          }
          updateSubmitVisibility();
        });
        choicesEl.appendChild(btn);
      });

      function updateSubmitVisibility(){
        if (locked) return;
        const allFilled = Array.from(placeholderMap.values()).every(s=>!!s.dataset.word);
        if (allFilled){ submitBtn.classList.add('sm-floating-visible'); }
        else { submitBtn.classList.remove('sm-floating-visible'); }
      }

      function evaluate(){
        locked = true; submitBtn.classList.remove('sm-floating-visible'); submitBtn.style.display='none'; nextBtn.style.display='';
        let correctCount = 0; const userWords = []; const perWordCorrect=[];
        placeholderMap.forEach((span,slot)=>{
          const targetWord = removedWords[slot];
          const userWord = span.dataset.word || '';
          userWords.push(userWord);
          if (userWord === targetWord){
            correctCount++; perWordCorrect.push(true); span.classList.add('correct');
          } else { perWordCorrect.push(false); span.classList.add('incorrect'); span.textContent = targetWord; }
        });
        fbPoints += correctCount;
        if (correctCount === removedWords.length){
          fbCorrectFull++; playSfx('right'); feedbackEl.style.color='#065f46'; feedbackEl.textContent = 'Perfect!';
        } else if (correctCount/removedWords.length >= .75){
          playSfx('almost'); feedbackEl.style.color='#0d5d63'; feedbackEl.textContent = `${correctCount} / ${removedWords.length} correct`;
        } else {
          playSfx('wrong'); feedbackEl.style.color='#b91c1c'; feedbackEl.textContent = `${correctCount} / ${removedWords.length} correct`;
        }
        if (correctCount !== removedWords.length) fillBlankMissed.push(fbIndex);
        // During review we do not re-log mistakes (prevents infinite review loops)
        if (inFillBlankReview && correctCount !== removedWords.length) {
          // Do not push back into fillBlankMissed when reviewing
          fillBlankMissed = fillBlankMissed.filter(i => i !== fbIndex);
        }
        const scoreEl = root.querySelector('#fbScore'); if(scoreEl) scoreEl.textContent = `${fbPoints} pts`;
        // Enable replay & play audio AFTER evaluation only
        replayBtn.disabled = false;
        playSentenceAudio(item);
        // Logging
        try {
          const wordKey = (items[fbIndex]?.eng ? `${items[fbIndex].eng}__fillblank` : `fillblank_${fbIndex+1}`);
          logAttempt({
            session_id: fbSessionId,
            mode: 'fill_blank_sentence_mode',
            word: wordKey,
            is_correct: correctCount === removedWords.length,
            answer: userWords.join(' '),
            correct_answer: removedWords.join(' '),
            points: correctCount,
            attempt_index: fbIndex,
            round: fbIndex+1,
            extra: { sentence: item.sentence, removed_indices: removedIdx, removed_words: removedWords, user_words: userWords, per_word_correct: perWordCorrect, correct_count: correctCount, sentence_id: item.sentence_id || null }
          });
        } catch(e){ console.debug('[FillBlankMulti] logAttempt failed', e?.message); }
      }

      // Disable replay initially (silent start) and only enable after evaluate
      replayBtn.disabled = true;
      replayBtn.onclick = ()=>{ if (!replayBtn.disabled) playSentenceAudio(item); };
      submitBtn.onclick = evaluate;
      nextBtn.onclick = ()=>{ fbIndex++; renderFbRound(); };
    }

    function showFbSummary(){
      // Percentage now based on fully perfect rounds
      const pct = items.length ? Math.round((fbCorrectFull / items.length) * 100) : 0;
      try { endSession(fbSessionId, { mode:'fill_blank_sentence_mode', summary:{ total: items.length, perfect: fbCorrectFull, points: fbPoints, pct }}); } catch {}
      const heading = inFillBlankReview ? 'Review Complete' : 'Fill Gaps Complete';
      root.innerHTML = `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:Poppins,system-ui;padding:34px 26px 38px;background:linear-gradient(165deg,#ffffff,#f2fbfc);border:2px solid #93cbcf;border-radius:24px;box-shadow:0 8px 28px -4px rgba(8,70,74,0.18);position:relative;">
        <div class="sm-back-link" data-nav="menu" style="position:absolute;left:10px;bottom:6px;">← Back to Sentence Menu</div>
        <h2 style="margin:0 0 14px;font-size:1.6rem;color:#19777e;font-weight:800;">${heading}</h2>
        <div style="font-size:1rem;color:#334155;margin-bottom:8px;">You completed ${items.length} round${items.length===1?'':'s'}.</div>
        <div style="font-size:.95rem;color:#334155;margin-bottom:4px;">Perfect Rounds: <strong>${fbCorrectFull}</strong> / ${items.length} (${pct}%)</div>
        <div style="font-size:.95rem;color:#334155;margin-bottom:14px;">Points (1 per correct word): <strong>${fbPoints}</strong></div>
        <div class="sm-summary-actions">
          ${inFillBlankReview ? '' : '<button class="sm-summary-btn" data-act="replay">Play Again</button>'}
          <button class="sm-summary-btn" data-act="menu">${inFillBlankReview ? 'Done' : 'Start Menu'}</button>
        </div>
      </div>`;
      const sumRoot = root.querySelector('.sm-summary-actions');
      if (sumRoot){
        if (!inFillBlankReview){
          const replayBtn = sumRoot.querySelector('[data-act="replay"]');
          if (replayBtn) replayBtn.addEventListener('click',()=>location.reload());
        }
        sumRoot.querySelector('[data-act="menu"]').addEventListener('click',()=>{ showModeMenu(); });
        if (!inFillBlankReview && fillBlankMissed.length){
          const btn = document.createElement('button');
          btn.className='sm-summary-btn';
          btn.textContent='Fix Mistakes';
          btn.addEventListener('click', ()=>{ startFillBlankReview(); });
          sumRoot.appendChild(btn);
        }
      }
      const backLink = root.querySelector('.sm-back-link[data-nav="menu"]'); if(backLink) backLink.addEventListener('click',()=>showModeMenu());
      // If we're finishing a review, restore original items list
      if (inFillBlankReview && savedFillBlankItems){
        items = savedFillBlankItems;
        savedFillBlankItems = null;
        inFillBlankReview = false;
      }
    }
    renderFbRound();
  }

  function renderRound(){
    const item = items[index];
    if (!item){
      showSummary();
      return;
    }
    const counter = root.querySelector('#smCounter');
    if (counter) counter.textContent = `${index+1} / ${items.length}`;

    const constructEl = root.querySelector('#smConstruct');
    const tokensEl = root.querySelector('#smTokens');
    const feedbackEl = root.querySelector('#smFeedback');
    const submitBtn = root.querySelector('#smSubmit');
    const nextBtn = root.querySelector('#smNext');
    const replayBtn = root.querySelector('#smReplay');
    const clearBtn = root.querySelector('#smClear');
    if (!constructEl || !tokensEl) return;

    feedbackEl.textContent = '';
    submitBtn.style.display = '';
    nextBtn.style.display = 'none';
    constructEl.innerHTML = '';
    tokensEl.innerHTML = '';

    const correctTokens = tokenize(item.sentence);
    const shuffled = shuffle(correctTokens.slice());
    let roundLocked = false; // once checked, cannot modify / re-log

    // Prepare floating submit button (hidden until all tokens placed)
    submitBtn.classList.add('sm-floating');
    submitBtn.classList.remove('sm-floating-visible');
    function updateSubmitVisibility(){
      if (roundLocked) return;
      const placed = currentConstructTokens(constructEl).length;
      if (placed === correctTokens.length){
        submitBtn.classList.add('sm-floating-visible');
      } else {
        submitBtn.classList.remove('sm-floating-visible');
      }
    }
    // expose updater for add/remove token handlers
    window.__smUpdateSubmit = updateSubmitVisibility;

            shuffled.forEach(tok => {
              const btn = document.createElement('button');
              btn.type='button';
              btn.className='sm-chip';
              btn.textContent = tok;
              btn.addEventListener('click', () => {
                if (roundLocked) return; // prevent interaction after locked
                btn.disabled = true;
                addTokenToLine(tok, btn);
                  updateSubmitVisibility();
              });
              tokensEl.appendChild(btn);
            });

          // Initial check (will keep hidden until filled)
          updateSubmitVisibility();

          submitBtn.onclick = () => {
            if (roundLocked) return; // already checked
            const attemptTokens = currentConstructTokens(constructEl);
            if (attemptTokens.length !== correctTokens.length){
              feedbackEl.textContent = 'Complete the sentence.';
              feedbackEl.style.color = '#b45309';
              return;
            }
            const attemptNorm = normalizeSentence(attemptTokens.join(' '));
            const correctNorm = normalizeSentence(correctTokens.join(' '));
            const ok = attemptNorm === correctNorm;
            // Compute accuracy percentage (tokens in correct position)
            let tokens_correct = 0;
            for (let i=0;i<correctTokens.length;i++){ if (attemptTokens[i] === correctTokens[i]) tokens_correct++; }
            const tokens_total = correctTokens.length;
            const pct = Math.round((tokens_correct / tokens_total) * 100);
            const awardedPoints = pointsForPercent(pct);
            roundLocked = true;
            // disable all remaining token buttons
            Array.from(tokensEl.querySelectorAll('button')).forEach(b=> b.disabled = true);
            if (ok){
              feedbackEl.textContent = 'Correct!';
              feedbackEl.style.color = '#065f46';
              sentencesCorrect++;
              constructEl.classList.add('sm-correct');
              playSfx('right');
            } else {
              // Play 'almost' if high accuracy (>=80%) but not perfect, otherwise wrong
              if (pct >= 80) {
                playSfx('almost');
              } else {
                playSfx('wrong');
              }
              feedbackEl.textContent = 'Answer Shown';
              feedbackEl.style.color = '#b91c1c';
              constructEl.classList.add('sm-incorrect');
              // Replace line with correct sentence visually
              constructEl.innerHTML = '';
              correctTokens.forEach(tok => {
                const span = document.createElement('span');
                span.className = 'sm-word-frag sm-word-inline sm-solution';
                span.textContent = tok;
                constructEl.appendChild(span);
              });
              if (!inUnscrambleReview) unscrambleMissed.push(index);
            }
            // Accumulate partial-credit points
            totalPoints += awardedPoints;
            updateHeaderScore();
				try {
					const wordKey = (items[index]?.eng ? `${items[index].eng}__sentence` : `sentence_${index+1}`);
          logAttempt({
            session_id: sessionId,
            mode: 'full_sentence_mode',
            word: wordKey,
            is_correct: ok,
            answer: attemptNorm,
            correct_answer: correctNorm,
            points: awardedPoints,
            attempt_index: index,
            round: index + 1,
            extra: { pct, tokens_total, tokens_correct, sentence: items[index].sentence, sentence_id: items[index].sentence_id || null }
          });
				} catch(e){ console.debug('[SentenceMode] logAttempt failed', e?.message); }
				// Hide floating Check, then show Next
				submitBtn.classList.remove('sm-floating-visible');
				submitBtn.style.display='none';
				nextBtn.style.display='';
				// header already updated above
			};

		nextBtn.onclick = () => { index++; renderRound(); };
		clearBtn.onclick = () => { if(!roundLocked) renderRound(); };
		replayBtn.onclick = () => { playSentenceAudio(item); };

		// Autoplay after slight delay
		setTimeout(()=>{ playSentenceAudio(item); }, 150);
	}

	function showSummary(){
		const pct = items.length ? Math.round((sentencesCorrect / items.length) * 100) : 0;
		try { endSession(sessionId, { mode: 'full_sentence_mode', summary: { total: items.length, correct: sentencesCorrect, points: totalPoints, pct } }); } catch {}
		const heading = inUnscrambleReview ? 'Review Complete' : 'Great Job!';
		root.innerHTML = `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:Poppins,system-ui;padding:34px 26px 38px;background:linear-gradient(165deg,#ffffff,#f2fbfc);border:2px solid #93cbcf;border-radius:24px;box-shadow:0 8px 28px -4px rgba(8,70,74,0.18);position:relative;">
			<div class="sm-back-link" data-nav="menu" style="position:absolute;left:10px;bottom:6px;">← Back to Sentence Menu</div>
			<h2 style="margin:0 0 14px;font-size:1.6rem;color:#19777e;font-weight:800;">${heading}</h2>
			<div style="font-size:1rem;color:#334155;margin-bottom:8px;">You completed ${items.length} sentence${items.length===1?'':'s'}.</div>
			<div style="font-size:.95rem;color:#334155;margin-bottom:4px;">Fully Correct: <strong>${sentencesCorrect}</strong> / ${items.length} (${pct}%)</div>
			<div style="font-size:.95rem;color:#334155;margin-bottom:14px;">Points Earned: <strong>${totalPoints}</strong></div>
			<div class="sm-summary-actions">
				${inUnscrambleReview ? '' : '<button class="sm-summary-btn" data-act="replay">Play Again</button>'}
				<button class="sm-summary-btn" data-act="menu">${inUnscrambleReview ? 'Done' : 'Start Menu'}</button>
			</div>
		</div>`;
		// Summary button wiring
		const sumRoot = root.querySelector('.sm-summary-actions');
		if (sumRoot){
			if (!inUnscrambleReview){
				const replay = sumRoot.querySelector('[data-act="replay"]');
				if (replay) replay.addEventListener('click',()=>location.reload());
			}
			sumRoot.querySelector('[data-act="menu"]').addEventListener('click',()=>{ showModeMenu(); });
			if (!inUnscrambleReview && unscrambleMissed.length){
				const btn = document.createElement('button');
				btn.className='sm-summary-btn';
				btn.textContent='Fix Mistakes';
				btn.addEventListener('click', ()=>{ startUnscrambleReview(); });
				sumRoot.appendChild(btn);
			}
		}
		const backLink = root.querySelector('.sm-back-link[data-nav="menu"]'); if(backLink) backLink.addEventListener('click',()=>showModeMenu());
		// If we just finished a review restore original items
		if (inUnscrambleReview && savedUnscrambleItems){
			items = savedUnscrambleItems;
			savedUnscrambleItems = null;
			inUnscrambleReview = false;
		}
	}

	// Helpers
		function tokenize(sentence){
		return sentence
			.replace(/[\u2018\u2019]/g, "'")
			.replace(/[\u201C\u201D]/g, '"')
			.trim()
			// Split on space but keep basic punctuation attached to preceding word
			.split(/\s+/)
			.filter(Boolean);
	}
		function normalizeSentence(s){
			return s.replace(/\s+/g,' ') // collapse spaces
							.replace(/\s([,;.?!])/g,'$1') // remove space before punctuation if any
							.trim();
		}
		function currentConstructTokens(constructEl){
			return Array.from(constructEl.querySelectorAll('[data-token]')).map(el=>el.getAttribute('data-token'));
		}
		function addTokenToLine(tok, originBtn){
			const constructEl = root.querySelector('#smConstruct');
			if (!constructEl) return;
			const placeholder = constructEl.querySelector('.sm-line-placeholder');
			if (placeholder) placeholder.remove();
				const span = document.createElement('span');
				span.className = 'sm-word-frag sm-word-inline';
				span.textContent = tok;
				span.setAttribute('data-token', tok);
				span.tabIndex = 0;
					span.addEventListener('click', () => { span.remove(); originBtn.disabled = false; originBtn.focus(); if (!constructEl.querySelector('[data-token]')) addPlaceholder(constructEl); if (window.__smUpdateSubmit) window.__smUpdateSubmit(); });
				span.addEventListener('keydown', (e)=>{ if (e.key==='Backspace' || e.key==='Delete' || e.key==='Enter' || e.key===' ') { e.preventDefault(); span.click(); } });
				constructEl.appendChild(span);
				if (window.__smUpdateSubmit) window.__smUpdateSubmit();
		}
		function addPlaceholder(constructEl){
			const pl = document.createElement('span');
			pl.className='sm-line-placeholder';
			pl.textContent='Tap words below…';
			constructEl.appendChild(pl);
		}
		// Enhance addTokenToLine to notify visibility updater after add & on removal
		// (We keep the existing implementation above; only extend behavior)

		// Chunker for Broken Sentence mode (lightweight heuristic)
		function chunkSentence(sentence){
			const tokens = tokenize(sentence);
			if (tokens.length <= 6){
				// force at least 2 chunks if possible by splitting mid point
				if (tokens.length >=4){ return [tokens.slice(0, Math.ceil(tokens.length/2)).join(' '), tokens.slice(Math.ceil(tokens.length/2)).join(' ')]; }
				return [sentence.trim()];
			}
			const isPrep = w=>/^(in|on|at|with|for|to|from|over|under|into|of|by|after|before|around|between|through|during)$/i.test(w);
			const isDet = w=>/^(the|a|an|this|that|these|those|my|your|his|her|their|our)$/i.test(w);
			const isConj = w=>/^(and|but|or|so|yet)$/i.test(w);
			const baseVerbSet = new Set(['want','visit','see','like','love','need','go','come','learn','study','watch','play','read','write','make','have','get','take','give','eat','drink','speak','talk','live','travel']);
			const isVerb = w=>/^(am|is|are|was|were|be|been|being|do|does|did|has|have|had|will|would|can|could|should|might|must)$/i.test(w)
				|| baseVerbSet.has(w.toLowerCase())
				|| /[a-z]+(ing|ed|s)$/i.test(w);
			let chunks=[]; let buf=[]; let seenMain=false;
			function flush(){ if(buf.length){ chunks.push(buf.join(' ')); buf=[]; } }
			for (let i=0;i<tokens.length;i++){
				let raw = tokens[i]; let core = raw.replace(/[,.;!?]$/,'');
				if (raw === ','){ flush(); continue; }
				if (!seenMain){
					buf.push(raw);
					if (isVerb(core)){ seenMain=true; // absorb trailing adverb
						if(tokens[i+1] && /ly$/i.test(tokens[i+1])){ buf.push(tokens[++i]); }
						flush();
					}
				} else if (isPrep(core)){
					flush(); buf.push(raw);
					while(i+1<tokens.length){
						const look = tokens[i+1].replace(/[,.;!?]$/,'');
						if (isPrep(look) || isConj(look) || isVerb(look)) break;
						buf.push(tokens[++i]);
					}
					flush();
				} else if (isConj(core)) {
					flush(); buf.push(raw); flush();
				} else {
					buf.push(raw);
				}
			}
			flush();
			chunks = chunks.map(c=>c.replace(/\s+/g,' ').trim()).filter(Boolean);
			if (chunks.length > 6){
				for (let i=0;i<chunks.length-1 && chunks.length>6;i++){
					if (chunks[i].split(' ').length===1){
						chunks[i] = chunks[i] + ' ' + chunks[i+1];
						chunks.splice(i+1,1); i=-1;
					}
				}
			}
			if (chunks.length < 2){
				let fallbackChunks = [];
				const conjSplit = /( because | and | but )/i;
				if (conjSplit.test(sentence)){
					const parts = sentence.split(/\b(because|and|but)\b/i);
					if (parts.length >=3){
						const first = (parts[0]||'').trim();
						const second = (parts.slice(1).join(' ')).trim();
						if (first && second) fallbackChunks = [first, second];
					}
				}
				if (!fallbackChunks.length){
					const mid = Math.floor(tokens.length/2);
					fallbackChunks = [tokens.slice(0,mid).join(' '), tokens.slice(mid).join(' ')];
				}
				chunks = fallbackChunks;
			}

			// --- Refinement: ensure adequate number of chunks for longer sentences ---
			const desired = (function(len){
				if (len >= 20) return 5;
				if (len >= 14) return 4;
				if (len >= 10) return 4; // user request: sentence like example should become 4 chunks
				if (len >= 9) return 3;
				return 2;
			})(tokens.length);
			if (chunks.length < desired){
				chunks = refineChunks(chunks, tokens, desired);
			}
			return chunks;
		}

		function refineChunks(current, tokens, target){
      // Hoisted verb set (was previously scoped only inside chunkSentence causing ReferenceError here)
      const baseVerbSet = new Set(['want','visit','see','like','love','need','go','come','learn','study','watch','play','read','write','make','have','get','take','give','eat','drink','speak','talk','live','travel']);
			let chunks = current.slice();
			// Avoid infinite loops
			const canSplit = chunk => chunk.split(/\s+/).length >= 4; // need at least 4 words to split into two >=2
			while (chunks.length < target){
				// pick longest splittable chunk
				let idx = -1; let maxLen=0;
				for (let i=0;i<chunks.length;i++){
					const words = chunks[i].split(/\s+/).length;
					if (words > maxLen && canSplit(chunks[i])){ maxLen = words; idx = i; }
				}
				if (idx === -1) break; // nothing splittable
				const chunkWords = chunks[idx].split(/\s+/);
				// Prefer split at discourse markers inside chunk
				let splitAt = -1;
				for (let j=1;j<chunkWords.length-1;j++){
					if (/^(because|and|but|so|that)$/i.test(chunkWords[j])){ splitAt = j; break; }
					// split before an infinitive 'to <verb>' chain for clearer semantic grouping
					if (chunkWords[j].toLowerCase() === 'to' && j+1 < chunkWords.length){
						const next = chunkWords[j+1].toLowerCase();
						if (baseVerbSet.has(next) || /[a-z]+(ing|ed|s)$/i.test(next)){ splitAt = j; break; }
					}
				}
				if (splitAt === -1){ splitAt = Math.round(chunkWords.length/2); }
				// Ensure both sides >=2 tokens if possible
				if (splitAt < 2 || (chunkWords.length - splitAt) < 2){
					if (chunkWords.length >=6){ splitAt = 3; } else { splitAt = Math.max(2, Math.min(chunkWords.length-2, splitAt)); }
				}
				const left = chunkWords.slice(0,splitAt).join(' ');
				const right = chunkWords.slice(splitAt).join(' ');
				// Replace
				chunks.splice(idx,1,left,right);
			}
			return chunks;
		}
	function shuffle(arr){ for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()* (i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
	function arraysEqualLoose(a,b){ if (a.length!==b.length) return false; for (let i=0;i<a.length;i++){ if(a[i]!==b[i]) return false; } return true; }
	function pointsForPercent(p){ if (p>=100) return 3; if (p>=80) return 2; if (p>=60) return 1; return 0; }
	function updateHeaderScore(){ const el = root.querySelector('#smScore'); if (el) el.textContent = `${totalPoints} pts`; }

	function playSentenceAudio(item){
    // Robust playback with fallback on async rejection or load error.
    if (item.sentenceAudioUrl){
      try {
        const a = new Audio(item.sentenceAudioUrl);
        // If the source 404s we want onerror to trigger fallback.
        let fellBack = false;
        const fallback = (reason)=>{
          if (fellBack) return; fellBack = true;
          console.warn('[SentenceMode] sentence audio failed, falling back to TTS', reason?.message || reason, item.sentenceAudioUrl);
          if (ctx.playTTS) ctx.playTTS(item.sentence);
        };
        a.onerror = (ev)=> fallback(ev instanceof Event ? new Error('audio error event') : ev);
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(err=> fallback(err));
        return; // do not run TTS immediately; wait for success/failure
      } catch(e){
        console.warn('[SentenceMode] sentence audio immediate play exception', e);
        // proceed to fallback below
      }
    }
    // No usable sentenceAudioUrl OR playback failed synchronously
    if (ctx.playTTS){ ctx.playTTS(item.sentence); }
	}

	function playSfx(kind){
		try {
			// Single cache init
			if(!playSfx.cache){
				const BASE = '/Games/Word%20Arcade/assets/audio/'; // encode space
				const manifest = {
					right: 'right-answer.mp3',
					wrong: 'wrong-answer.mp3',
					almost: 'kinda-right-answer.mp3'
				};
				playSfx.cache = {};
				for (const [k,f] of Object.entries(manifest)){
					const a = new Audio(BASE + f);
					a.preload = 'auto';
					a.volume = 0.85;
					playSfx.cache[k] = a;
				}
			}
			const a = playSfx.cache[kind];
			if(!a) return;
			a.currentTime = 0;
			const p = a.play();
			if (p && typeof p.catch === 'function') {
				p.catch(err=>{
					if (err && !playSfx._warned && (err.name === 'NotAllowedError' || /gesture/i.test(err.message||''))){
						playSfx._warned = true;
						console.debug('[SentenceMode] Audio blocked until user gesture.');
					}
				});
			}
		} catch(e){ /* swallow */ }
	}

// Fetch sentence audio URLs using existing get_audio_urls lambda.
// We send the derived keys: WORD_SENTENCE (uppercase normalization not enforced server-side presumably).
// LEGACY (pre-sentence-id) audio enrichment kept temporarily for reference.
// NOT invoked anywhere after upgrade; superseded by enrichSentenceAudioIDAware above.
// Safe to remove once migration confidence is 100%.
async function enrichSentenceAudio(items){
	const words = Array.from(new Set(items.map(i => (i.eng||'').trim()).filter(Boolean)));
	if (!words.length) return;
	const keys = words.map(w => `${w}_SENTENCE`);
	const endpoints = [ '/.netlify/functions/get_audio_urls' ];
	let resp = null; let lastErr=null;
	for (const url of endpoints){
		try {
			const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ words: keys }) });
			if (r.ok){ resp = await r.json(); break; }
		} catch(e){ lastErr=e; }
	}
	if (!resp || !resp.results){ if (lastErr) throw lastErr; return; }
	const map = {}; Object.entries(resp.results).forEach(([k,v])=>{ if (v && v.exists && v.url) map[k.toLowerCase()] = v.url; });
	items.forEach(it => {
		const key = `${(it.eng||'').trim()}_SENTENCE`.toLowerCase();
		if (map[key]) it.sentenceAudioUrl = map[key];
	});
	return { found: items.filter(i=>i.sentenceAudioUrl).length };
}

function renderErrorBox(msg){
	return `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:Poppins,system-ui;padding:30px 24px;background:#fff;border:2px solid #fecaca;border-radius:20px;box-shadow:0 10px 32px -6px rgba(0,0,0,0.15);">
		<h2 style="margin:0 0 14px;font-size:1.4rem;color:#b91c1c;font-weight:800;">Sentence Mode</h2>
		<div style="font-size:.95rem;color:#334155;line-height:1.4;">${msg}</div>
	</div>`;
}

// (Phase 2+) Additional mechanics will be added below this line.

function injectStylesOnce(){
	if (document.getElementById('sentenceModeStyles')) return;
	const style = document.createElement('style');
	style.id = 'sentenceModeStyles';
	style.textContent = `
		.sentence-mode { font-family:Poppins,system-ui,sans-serif; animation:smFade .5s ease; }
		/* Mode selection menu */
		.sm-mode-menu { max-width:680px; margin:40px auto; padding:0 14px; font-family:Poppins,system-ui,sans-serif; }
		.sm-mode-card { background:linear-gradient(165deg,#ffffff 60%,#f7fafc 100%); border:2px solid #93cbcf; border-radius:24px; padding:34px 30px 40px; box-shadow:0 8px 28px -4px rgba(8,70,74,0.18); position:relative; overflow:hidden; }
		.sm-mode-card:before { content:''; position:absolute; inset:0; background:radial-gradient(circle at 78% 14%, rgba(218, 238, 240, 0.18), transparent 60%); pointer-events:none; }
		.sm-mode-title { margin:0 0 6px; font-size:clamp(1.5rem,3.6vw,2.2rem); font-weight:800; letter-spacing:.5px; color:#19777e; text-shadow:0 2px 6px rgba(0,0,0,0.08); }
		.sm-mode-desc { margin:0 0 22px; font-size:.95rem; font-weight:500; letter-spacing:.4px; color:#0f3f44; opacity:.85; }
		.sm-mode-options { display:flex; flex-direction:column; gap:18px; }
		.sm-mode-btn { font:inherit; font-weight:700; font-size:clamp(1.05rem,2vw,1.25rem); letter-spacing:.4px; padding:18px 22px; border-radius:20px; border:2px solid #41b6be; background:#ffffff; color:#0f3f44; cursor:pointer; text-align:left; position:relative; box-shadow:0 4px 18px -4px rgba(25,119,126,0.20), 0 0 0 4px rgba(64,182,190,0.12); transition:transform .3s cubic-bezier(.16,.8,.24,1), box-shadow .3s, background .35s; }
		.sm-mode-btn:hover:not(:disabled){ transform:translateY(-4px); box-shadow:0 10px 28px -6px rgba(25,119,126,0.35), 0 0 0 4px rgba(64,182,190,0.25); }
		.sm-mode-btn:active:not(:disabled){ transform:translateY(0) scale(.95); }
		.sm-mode-btn:disabled { opacity:.45; filter:grayscale(.3); cursor:default; }
		.sm-mode-btn:focus-visible { outline:3px solid #22d3ee; outline-offset:4px; }
		.sm-back-link { font-size:.7rem; font-weight:600; letter-spacing:.8px; color:#0f3f44; opacity:.55; cursor:pointer; user-select:none; display:inline-block; margin-top:100px; }
		.sm-back-link:hover { opacity:.85; }
		.sm-back-link:active { opacity:1; }
		/* Summary buttons unify look */
		.sm-summary-actions { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; margin-top:20px; }
		.sm-summary-btn { font:inherit; font-weight:700; font-size:clamp(.9rem,1.9vw,1.05rem); letter-spacing:.4px; padding:14px 22px; border-radius:18px; border:2px solid #41b6be; background:#ffffff; color:#0f3f44; cursor:pointer; position:relative; box-shadow:0 4px 18px -4px rgba(25,119,126,.18); transition:transform .28s, box-shadow .28s, background .3s; }
		.sm-summary-btn:hover { transform:translateY(-3px); box-shadow:0 10px 26px -6px rgba(25,119,126,.28); }
		.sm-summary-btn:active { transform:translateY(0) scale(.94); }
		.sm-summary-btn:focus-visible { outline:3px solid #22d3ee; outline-offset:3px; }
		@media (max-width:640px){ .sm-mode-card { padding:30px 22px 34px; } .sm-mode-btn { padding:16px 18px; } }
		.sentence-mode .sm-header { display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 16px; flex-wrap:wrap; }
		.sentence-mode .sm-title { font-weight:800;color:#0f3f44;font-size:clamp(1rem,2vw,1.25rem); letter-spacing:.5px; }
		.sentence-mode .sm-counter { font-size:.75rem;font-weight:700;background:#e6f7f8;color:#19777e;padding:6px 12px;border-radius:20px;letter-spacing:.5px; }
		.sentence-mode .sm-header-right { display:flex;align-items:center;gap:8px; }
		.sentence-mode .sm-score { font-size:.7rem;font-weight:800;background:#19777e;color:#fff;padding:6px 10px;border-radius:18px;letter-spacing:.5px; box-shadow:0 2px 8px rgba(0,0,0,0.15); }
		.sentence-mode .sm-box { position:relative;background:linear-gradient(165deg,#ffffff,#f2fbfc);border:2px solid #93cbcf;border-radius:24px;padding:22px 20px 20px;min-height:210px;display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 28px -4px rgba(8,70,74,0.18); }
		.sentence-mode .sm-section-label { font-size:.65rem;font-weight:700; letter-spacing:.9px; color:#0d555c; text-transform:uppercase; }
		.sentence-mode .sm-construct { min-height:54px; display:flex;flex-wrap:wrap;gap:10px; padding:4px 2px 2px; }
		.sentence-mode .sm-construct-line { background:#ffffff;border:1px dashed #b9d9db; border-radius:14px; min-height:56px; padding:12px 14px; display:flex;align-items:center;flex-wrap:wrap; gap:8px; font-size:1.05rem; line-height:1.35; font-weight:600; color:#0f172a; }
		.sentence-mode .sm-construct-line.sm-correct { box-shadow:0 0 0 3px #0d948888; border-style:solid; }
		.sentence-mode .sm-word-frag { background:#19777e; color:#fff; padding:6px 12px; border-radius:12px; position:relative; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600; font-size:.95rem; box-shadow:0 2px 8px rgba(0,0,0,0.18); animation:fragPop .35s ease; }
		.sentence-mode .sm-word-frag.sm-word-inline { background:transparent; box-shadow:none; color:#0f172a; padding:0 4px; border-radius:8px; position:relative; font-weight:600; }
		.sentence-mode .sm-word-frag.sm-word-inline:after { content:''; position:absolute; left:0; right:0; bottom:0; height:2px; background:linear-gradient(90deg,#93cbcf,#41b6be); transform:scaleX(0); transform-origin:left; transition:transform .35s ease; }
		.sentence-mode .sm-word-frag.sm-word-inline:hover:after, .sentence-mode .sm-word-frag.sm-word-inline:focus-visible:after { transform:scaleX(1); }
		.sentence-mode .sm-word-frag.sm-word-inline { cursor:pointer; }
		.sentence-mode .sm-word-frag:focus-visible { outline:3px solid #41b6be; outline-offset:3px; }
		.sentence-mode .sm-line-placeholder { opacity:.5; font-weight:500; font-size:.9rem; letter-spacing:.5px; }
		.sentence-mode .sm-tokens { justify-content:center; }
		@keyframes fragPop { 0% { transform:scale(.4); opacity:0;} 70% { transform:scale(1.08); opacity:1;} 100% { transform:scale(1); opacity:1;} }
		.sentence-mode .sm-shake { animation:smShake .48s cubic-bezier(.36,.07,.19,.97); }
		@keyframes smShake { 10%, 90% { transform:translateX(-2px);} 20%, 80% { transform:translateX(4px);} 30%, 50%, 70% { transform:translateX(-6px);} 40%, 60% { transform:translateX(6px);} }
		.sentence-mode .sm-tokens { display:flex;flex-wrap:wrap;gap:10px; margin-top:2px; }
		.sentence-mode .sm-divider { height:1px; background:linear-gradient(90deg,rgba(147,203,207,0) 0%, #93cbcf 18%, #93cbcf 82%, rgba(147,203,207,0) 100%); margin:2px 0 4px; }
		.sentence-mode .sm-feedback { min-height:24px; font-size:.85rem; font-weight:600; letter-spacing:.3px; }
		.sentence-mode .sm-chip { --sm-bg:#ffffff; --sm-border:#cfdbe2; --sm-color:#0f172a; position:relative; font:inherit; font-weight:600; font-size:.95rem; padding:10px 16px; border:2px solid var(--sm-border); background:var(--sm-bg); color:var(--sm-color); border-radius:16px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; line-height:1.1; box-shadow:0 3px 10px rgba(0,0,0,0.05); transition:background .25s, transform .25s, box-shadow .25s, border-color .25s; }
		.sentence-mode .sm-chip:hover:not(:disabled){ background:#f2fbfc; border-color:#41b6be; }
		.sentence-mode .sm-chip:active:not(:disabled){ transform:scale(.92); }
		.sentence-mode .sm-chip:disabled { opacity:.3; cursor:default; }
		.sentence-mode .sm-chip.placed { --sm-bg:#19777e; --sm-border:#19777e; --sm-color:#ffffff; font-weight:700; box-shadow:0 4px 16px -2px rgba(0,0,0,0.25); }
		.sentence-mode .sm-chip.placed:hover { background:#12595f; border-color:#12595f; }
		.sentence-mode .sm-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:4px; }
		.sentence-mode .flex-spacer { flex:1; }
		.sentence-mode .sm-btn { --btn-bg:#0d9488; --btn-bg2:#0d9488; --btn-color:#fff; font:inherit; font-weight:700; letter-spacing:.3px; font-size:.85rem; border:none; background:linear-gradient(140deg,var(--btn-bg),var(--btn-bg2)); color:var(--btn-color); padding:12px 22px; border-radius:16px; cursor:pointer; position:relative; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 16px -4px rgba(0,0,0,0.25); transition:box-shadow .28s, transform .28s, filter .28s; }
		.sentence-mode .sm-btn:hover { box-shadow:0 6px 22px -4px rgba(0,0,0,0.3); transform:translateY(-2px); }
		.sentence-mode .sm-btn:active { transform:scale(.9); box-shadow:0 4px 14px -4px rgba(0,0,0,0.35); }
		.sentence-mode .sm-btn:focus-visible { outline:3px solid #41b6be; outline-offset:3px; }
		.sentence-mode .sm-btn.primary { --btn-bg:#0d9488; --btn-bg2:#0f766e; }
		/* Floating submit button (appears centered when ready) */
		.sentence-mode #smSubmit.sm-floating { position:absolute; top:calc(50% + 50px); left:50%; transform:translate(-50%,-50%) scale(.6); opacity:0; pointer-events:none; font-size:clamp(2.2rem,4vw,3.2rem); padding:30px 68px; border-radius:48px; letter-spacing:.9px; font-weight:800; box-shadow:0 22px 55px -12px rgba(0,0,0,0.4),0 0 0 5px rgba(13,148,136,0.25); backdrop-filter:blur(4px); transition:opacity .45s ease, transform .55s cubic-bezier(.16,.8,.24,1); }
		.sentence-mode #smSubmit.sm-floating-visible { opacity:1; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
		.sentence-mode #smSubmit.sm-floating:active { transform:translate(-50%,-50%) scale(.9); }
		/* Floating submit for Fill Gaps */
		.sentence-mode #fbSubmit.sm-floating { position:absolute; top:calc(50% + 50px); left:50%; transform:translate(-50%,-50%) scale(.6); opacity:0; pointer-events:none; font-size:clamp(2.2rem,4vw,3.2rem); padding:30px 68px; border-radius:48px; letter-spacing:.9px; font-weight:800; box-shadow:0 22px 55px -12px rgba(0,0,0,0.4),0 0 0 5px rgba(13,148,136,0.25); backdrop-filter:blur(4px); transition:opacity .45s ease, transform .55s cubic-bezier(.16,.8,.24,1); }
		.sentence-mode #fbSubmit.sm-floating-visible { opacity:1; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
		.sentence-mode #fbSubmit.sm-floating:active { transform:translate(-50%,-50%) scale(.9); }
		/* Floating submit for Broken Sentence */
		.sentence-mode #bsSubmit.sm-floating { position:absolute; top:calc(50% + 50px); left:50%; transform:translate(-50%,-50%) scale(.6); opacity:0; pointer-events:none; font-size:clamp(2.2rem,4vw,3.2rem); padding:30px 68px; border-radius:48px; letter-spacing:.9px; font-weight:800; box-shadow:0 22px 55px -12px rgba(0,0,0,0.4),0 0 0 5px rgba(13,148,136,0.25); backdrop-filter:blur(4px); transition:opacity .45s ease, transform .55s cubic-bezier(.16,.8,.24,1); }
		.sentence-mode #bsSubmit.sm-floating-visible { opacity:1; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
		.sentence-mode #bsSubmit.sm-floating:active { transform:translate(-50%,-50%) scale(.9); }
		.sentence-mode .sm-btn.accent { --btn-bg:#19777e; --btn-bg2:#155e63; }
		.sentence-mode .sm-btn.ghost { --btn-bg:#ffffff; --btn-bg2:#ffffff; --btn-color:#0f3f44; border:2px solid #93cbcf; padding:10px 18px; box-shadow:0 2px 10px rgba(0,0,0,0.08); }
		.sentence-mode .sm-btn.ghost.audio { border-style:dashed; }
		.sentence-mode .sm-btn.ghost:hover { background:#f2fbfc; }
		.sentence-mode .sm-btn[disabled] { opacity:.35; pointer-events:none; }
		.sentence-mode .fade-in { animation:smPop .6s cubic-bezier(.16,.8,.24,1); }
		/* Multi-gap (Fill Gaps) placeholders */
		.fb-gap { padding:4px 12px; border-radius:12px; background:#fff3cd; border:2px dashed #f59e0b; font-weight:700; letter-spacing:1px; min-width:48px; text-align:center; cursor:pointer; transition:background .3s, border-color .3s, color .3s; }
		.fb-gap.filled { background:#e0f7fa; border-style:solid; border-color:#41b6be; color:#0f172a; }
		.fb-gap.correct { background:#dcfce7; border-color:#16a34a; color:#065f46; }
		.fb-gap.incorrect { background:#fee2e2; border-color:#dc2626; color:#b91c1c; }
		@keyframes smPop { 0% { opacity:0; transform:translateY(12px) scale(.96); } 60% { opacity:1; transform:translateY(0) scale(1.015);} 100% { opacity:1; transform:translateY(0) scale(1);} }
		@keyframes smFade { 0% { opacity:0;} 100% { opacity:1;} }
		@media (max-width:640px){ .sentence-mode .sm-chip { font-size:.9rem; padding:9px 14px; } .sentence-mode .sm-btn { padding:11px 18px; border-radius:14px; } }
	`;
	document.head.appendChild(style);
}

// Review functions
function startUnscrambleReview(){
	if (!unscrambleMissed.length){ return; }
	const missed = unscrambleMissed.map(i=>items[i]).filter(Boolean);
	if (!missed.length) return;
	savedUnscrambleItems = items;
	items = missed;
	inUnscrambleReview = true;
	unscrambleMissed = []; // clear for new review session
	index = 0; sentencesCorrect = 0; totalPoints = 0;
	startUnscramble();
}

function startFillBlankReview(){
	if (!fillBlankMissed.length){ return; }
	const missed = fillBlankMissed.map(i=>items[i]).filter(Boolean);
	if (!missed.length) return;
	savedFillBlankItems = items;
	items = missed;
	inFillBlankReview = true;
	fillBlankMissed = [];
	startFillBlank();
}

} // <-- close run(ctx)

