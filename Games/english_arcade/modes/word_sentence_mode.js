// Word Sentence Mode — Standalone Unscramble
// ---------------------------------------------------------------------------
// A minimal, self-contained mode that only runs Sentence Unscramble.
// No internal mode menu, no "fix mistakes" review flow, and no cross-mode
// navigation. Includes intro splash, partial-credit scoring, per-round logging,
// and robust sentence audio resolution compatible with R2 word_sentence.mp3.
// ---------------------------------------------------------------------------

import { startSession, logAttempt, endSession } from '../../../students/records.js';

// Normalize incoming word objects to a unified sentence item structure.
// Accepts legacy shape: { eng, sentence }
// Extended to pull sentence text from common example fields (ex, example, etc.).
function normalizeWordsToSentenceItems(list){
  return (list||[]).map(raw=>{
    if(!raw || typeof raw!== 'object') return null;
    const item = { ...raw };
    // Legacy compatibility
    if (!item.sentence && item.legacy_sentence) item.sentence = item.legacy_sentence;
    // Additional compatibility: pull from common example fields
    if (!item.sentence) {
      const pickFirstString = (arr)=> (Array.isArray(arr) ? arr.find(v=> typeof v === 'string' && v.trim()) : null);
      const pickFirstTextObj = (arr)=> (Array.isArray(arr) ? (arr.find(v=> v && typeof v.text === 'string' && v.text.trim())?.text || null) : null);
      const candidates = [];
      if (typeof item.example === 'string') candidates.push(item.example);
      if (typeof item.ex === 'string') candidates.push(item.ex);
      if (typeof item.example_sentence === 'string') candidates.push(item.example_sentence);
      if (typeof item.sentence_example === 'string') candidates.push(item.sentence_example);
      if (typeof item.ex_sentence === 'string') candidates.push(item.ex_sentence);
      if (Array.isArray(item.sentences)){
        const sStr = pickFirstString(item.sentences);
        const sObj = pickFirstTextObj(item.sentences);
        if (sStr) candidates.push(sStr);
        if (sObj) candidates.push(sObj);
      }
      if (Array.isArray(item.examples)){
        const eStr = pickFirstString(item.examples);
        const eObj = pickFirstTextObj(item.examples);
        if (eStr) candidates.push(eStr);
        if (eObj) candidates.push(eObj);
      }
      if (!item.sentence && item.sentence && typeof item.sentence === 'object'){
        const s = item.sentence.text || item.sentence.en || item.sentence.eng;
        if (typeof s === 'string' && s.trim()) candidates.push(s);
      }
      const chosen = candidates.find(s => typeof s === 'string' && s.trim());
      if (chosen) item.sentence = chosen.trim();
    }
    // Optional audio compat: if sentence_mp3 or sentence_audio present, seed sentenceAudioUrl/audio_key
    if (!item.sentenceAudioUrl && typeof item.sentence_mp3 === 'string'){
      const mp3 = item.sentence_mp3.trim();
      if (/^https?:/i.test(mp3)) item.sentenceAudioUrl = mp3; else item.audio_key = item.audio_key || mp3;
    }
    if (!item.sentenceAudioUrl && typeof item.sentence_audio === 'string'){
      const mp3 = item.sentence_audio.trim();
      if (/^https?:/i.test(mp3)) item.sentenceAudioUrl = mp3; else item.audio_key = item.audio_key || mp3;
    }
    // Map common Korean translation fields to a unified sentence_kor (for hint display)
    if (!item.sentence_kor){
      const korCandidates = [item.sentence_kor, item.sentenceKor, item.ex_kor, item.example_kor, item.kor_sentence, item.korean_sentence, item.korean, item.kor, item.ko, item.translation_ko, item.translationKor];
      const foundKor = korCandidates.find(v => typeof v === 'string' && v.trim());
      if (foundKor) item.sentence_kor = String(foundKor).trim();
    }
    // If upgraded structure present choose primary sentence
    if (Array.isArray(item.sentences) && item.sentences.length){
      let chosen = null;
      if (item.primary_sentence_id){
        chosen = item.sentences.find(s=>s.id === item.primary_sentence_id) || null;
      }
      if (!chosen){
        chosen = item.sentences.slice().sort((a,b)=> (b.weight||1) - (a.weight||1))[0];
      }
      if (chosen){
        item.sentence_id = chosen.id;
        if (chosen.text) item.sentence = chosen.text;
        if (chosen.audio_key && !item.audio_key) item.audio_key = chosen.audio_key;
        // Carry over Korean translation from chosen sentence if present
        if (!item.sentence_kor){
          const ck = (chosen.ko || chosen.kor || chosen.korean || chosen.translation_ko);
          if (typeof ck === 'string' && ck.trim()) item.sentence_kor = ck.trim();
        }
      }
    }
    return item;
  }).filter(Boolean);
}

// Fetch audio URLs with multi-tier fallback: audio_key -> sent_<id>.mp3 -> direct <eng>_sentence.mp3 via R2 base -> legacy get_audio_urls lambda.
async function enrichSentenceAudioIDAware(items){
  if (!items || !items.length) return;
  const SENT_BASE = (window.__SENT_AUDIO_BASE && String(window.__SENT_AUDIO_BASE).trim())
    || (window.R2_PUBLIC_BASE && String(window.R2_PUBLIC_BASE).trim())
    || '';
  const hasBase = !!SENT_BASE;
  const baseClean = hasBase ? SENT_BASE.replace(/\/$/, '') : '';
  const normWord = (w)=> String(w||'')
    .trim()
    .toLowerCase()
    .replace(/\s+/g,'_')
    .replace(/[^a-z0-9_\-]/g,'');
  // 1) Use explicit audio_key when absolute or build with base
  items.forEach(it=>{
    if(!it || it.sentenceAudioUrl) return;
    if(!it.audio_key) return;
    const key = String(it.audio_key).trim();
    if(/^https?:/i.test(key)){
      it.sentenceAudioUrl = key; return;
    }
    if (hasBase){ it.sentenceAudioUrl = baseClean + '/' + key; }
  });
  // 2) Heuristic by sentence_id
  const needHeuristic = items.filter(it=> !it.sentenceAudioUrl && it.sentence_id);
  if (needHeuristic.length && hasBase){
    needHeuristic.forEach(it=>{ it.sentenceAudioUrl = `${baseClean}/sent_${it.sentence_id}.mp3`; });
  }
  // 2b) Signed URL fetch for sentence_ids
  const stillMissing = items.filter(it=> !it.sentenceAudioUrl && it.sentence_id);
  if (stillMissing.length){
    try {
      const uniqueIds = Array.from(new Set(stillMissing.map(it=> it.sentence_id)));
      const r = await WillenaAPI.fetch('/.netlify/functions/get_sentence_audio_urls', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sentence_ids: uniqueIds }) });
      if (r.ok){
        const data = await r.json().catch(()=>null);
        if(data && data.success && data.results){
          stillMissing.forEach(it=>{
            const rec = data.results[it.sentence_id];
            if(rec && rec.exists && rec.url){ it.sentenceAudioUrl = rec.url; it.audio_key = rec.key || it.audio_key; }
          });
        }
      }
    } catch(e){ console.debug('[WordSentenceMode] signed fetch failed', e?.message); }
  }
  // 2c) Direct <word>_sentence.mp3 via base
  const needWordBase = items.filter(it=> !it.sentenceAudioUrl && it.eng && hasBase);
  if (needWordBase.length){
    needWordBase.forEach(it=>{
      const key = `${normWord(it.eng)}_sentence.mp3`;
      it.sentenceAudioUrl = `${baseClean}/${key}`;
      it.audio_key = it.audio_key || `${normWord(it.eng)}_sentence`;
    });
  }
  // 3) Legacy lambda fallback: try WORD_SENTENCE and word_sentence
  const legacyNeed = items.filter(it=> !it.sentenceAudioUrl && it.eng);
  if (legacyNeed.length){
    try {
      // Fix #3: Optimize batching - only request unique words, not every variant
      const uniqueWords = Array.from(new Set(legacyNeed.map(i=> i.eng)));
      const keys = uniqueWords.flatMap(word => [
        `${word}_SENTENCE`,
        `${normWord(word)}_sentence`
      ]);
      const r = await WillenaAPI.fetch('/.netlify/functions/get_audio_urls', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ words: keys }) });
      if (r.ok){
        const data = await r.json();
        if (data && data.results){
          legacyNeed.forEach(it=>{
            const kUpper = `${it.eng}_SENTENCE`;
            const kLowerSnake = `${normWord(it.eng)}_sentence`;
            const rec = data.results[kUpper] || data.results[kLowerSnake] || data.results[kUpper.toLowerCase()] || data.results[kUpper.toUpperCase()];
            if (rec && rec.exists && rec.url){ it.sentenceAudioUrl = rec.url; }
          });
        }
      }
    } catch(e){ console.debug('[WordSentenceMode] legacy audio fetch failed', e?.message); }
  }
}

export function run(ctx){
  // Prefer #gameArea (Word Arcade surface), then legacy #gameStage, then body
  const root = ctx.gameArea || document.getElementById('gameArea') || document.getElementById('gameStage') || document.body; 
  if(!root) return console.error('[WordSentenceMode] Missing root');
  const sessionModeId = ctx?.sessionMode || 'word_sentence_mode';
  const layout = ctx?.sentenceLayout || {};
  const onSentenceQuit = (typeof ctx?.onSentenceQuit === 'function') ? ctx.onSentenceQuit : null;
  // Normalize & filter items
  let items = normalizeWordsToSentenceItems(ctx.wordList || []);
  items = items.filter(w => w && w.sentence && typeof w.sentence === 'string' && w.sentence.trim().split(/\s+/).length >= 3);
  items = shuffle(items.slice());
  if(!items.length){ root.innerHTML = renderErrorBox('No sentences available for this list. Add sentence examples first.'); return; }

  // Declare state variables first (before calling functions that use them)
  let index = 0;
  let sentencesCorrect = 0;
  let totalPoints = 0;
  let sessionId = null;

  // Splash then start
  function showIntroThenStart(){
    if (layout.skipIntro) {
      try { startUnscramble(); } catch(e){ console.error('[WordSentenceMode] start failed', e); root.innerHTML = renderErrorBox('Could not start sentence mode.'); }
      return;
    }
    const introTitle = layout.hideTitle ? '' : (layout.customTitle || 'Sentence Unscramble');
    // Fix #4: Add loading spinner during background audio fetch
    root.innerHTML = `
      <div id="wsIntro" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;margin:0 auto;height:40vh;opacity:1;transition:opacity .6s ease;">
        <div style="font-size:clamp(1.5rem,6vw,4.5rem);font-weight:800;color:#19777e;text-align:center;max-width:90%;margin:0 auto;margin-bottom:30px;">
          ${introTitle}
        </div>
        <div style="width:40px;height:40px;border:4px solid #d0d8e0;border-top:4px solid #19777e;border-radius:50%;animation:wsLoadingSpin 0.8s linear infinite;"></div>
      </div>`;
    // Add spinner animation if not already present
    if (!document.getElementById('wsLoadingSpinStyles')) {
      const style = document.createElement('style');
      style.id = 'wsLoadingSpinStyles';
      style.textContent = '@keyframes wsLoadingSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
      document.head.appendChild(style);
    }
    setTimeout(()=>{
      const intro = document.getElementById('wsIntro');
      if (intro) intro.style.opacity = '0';
      setTimeout(()=>{ try { startUnscramble(); } catch(e){ console.error('[WordSentenceMode] start failed', e); root.innerHTML = renderErrorBox('Could not start sentence mode.'); } }, 600);
    }, 700);
  }

  // Preflight: resolve sentence_ids server-side (fast, idempotent) so audio can be disambiguated per sentence.
  // This uses the existing Netlify function upsert_sentences_batch with skip_audio=true (no generation at runtime).
  // Show intro immediately (non-blocking), fetch audio in background
  showIntroThenStart();
  
  // Background audio enrichment (non-blocking) - doesn't wait for intro
  (async () => {
    try {
      // Fix #2: Skip ID resolution if audio_keys are already present (faster for grammar data)
      const needsIdResolution = items.some(it => !it.sentence_id && !it.audio_key && it.sentence);
      if (needsIdResolution) {
        await resolveSentenceIdsIfMissing(items);
      }
    } catch(e){ console.debug('[WordSentenceMode] resolveSentenceIdsIfMissing failed', e?.message); }
    try {
      await enrichSentenceAudioIDAware(items);
    } catch(e){ console.debug('[WordSentenceMode] enrichSentenceAudio failed', e?.message); }
  })();

  function exitToMenu() {
    // Always try browser back first if possible
    if (window.history && window.history.length > 1) {
      window.history.back();
      // Give browser a moment to navigate, but if it doesn't, fallback after a short delay
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          fallbackQuit();
        }
      }, 500);
      return;
    }
    fallbackQuit();
  }

  function fallbackQuit() {
    // Always make sure quit button is visible if present
    const quitBtn = document.getElementById('wa-quit-btn') || document.getElementById('smQuitBtn') || document.getElementById('grammarQuitBtn');
    if (quitBtn) quitBtn.style.display = '';
    if (typeof ctx?.onSummaryExit === 'function') {
      ctx.onSummaryExit();
      return;
    }
    if (onSentenceQuit) {
      onSentenceQuit();
      return;
    }
    if (ctx?.sessionMode && String(ctx.sessionMode).startsWith('grammar_') && window.WordArcade?.startGrammarModeSelector) {
      window.WordArcade.startGrammarModeSelector();
      return;
    }
    if (window.WordArcade?.startModeSelector) {
      window.WordArcade.startModeSelector();
      return;
    }
    if (window.WordArcade?.quitToOpening) {
      window.WordArcade.quitToOpening(true);
      return;
    }
    if (typeof ctx?.showOpeningButtons === 'function') {
      ctx.showOpeningButtons(true);
      return;
    }
  }

  function startUnscramble(){
    root.innerHTML = '';
    root.classList.add('cgm-mode-root');
    injectStylesOnce();
    root.classList.toggle('sm-center-root', !!layout.centerContent);
    const wrap = document.createElement('div');
    wrap.className = 'sentence-mode';
    const headerClasses = ['sm-header'];
    if (layout.hideTitle) headerClasses.push('sm-header-no-title');
    const titleHtml = layout.hideTitle ? '' : `<div class="sm-title">${layout.customTitle || 'Sentence Unscramble'}</div>`;
    const headerHtml = `
      <div class="${headerClasses.join(' ')}">
        ${titleHtml}
        <div class="sm-header-right">
          <div id="smCounter" class="sm-counter">1 / ${items.length}</div>
          <div id="smScore" class="sm-score" aria-label="Points earned this session">0 pts</div>
        </div>
      </div>`;
    wrap.innerHTML = `
      ${headerHtml}
      <div id="smSentenceBox" class="sm-box fade-in">
        <div class="sm-section-label">Build the sentence:</div>
        <div id="smConstruct" class="sm-construct sm-construct-line" aria-label="Your assembled sentence" role="presentation"><span class="sm-line-placeholder">Tap words below…</span></div>
  <div class="sm-divider"></div>
  <div id="smTokens" class="sm-tokens" aria-label="Available words" role="list"></div>
  <div id="smHint" class="sm-hint" aria-live="polite"></div>
  <div id="smFeedback" class="sm-feedback" aria-live="polite"></div>
        <div class="sm-actions">
          <button id="smReplay" class="sm-btn ghost audio" type="button">▶ Play</button>
          <button id="smClear" class="sm-btn ghost" type="button">Reset</button>
          <div class="flex-spacer"></div>
          <button id="smSubmit" class="sm-btn submit" type="button">Check</button>
          <button id="smNext" class="sm-btn ghost" type="button" style="display:none;">Next ▶</button>
        </div>
      </div>`;
    root.appendChild(wrap);

    if (layout.showQuitButton) {
      const quitBtn = document.createElement('button');
      const quitLabel = layout.quitButtonLabel || 'Quit Game';
      quitBtn.type = 'button';
      quitBtn.id = layout.quitButtonId || 'smQuitBtn';
      quitBtn.className = 'sentence-mode-quit-btn wa-quit-btn';
      quitBtn.setAttribute('aria-label', quitLabel);
      quitBtn.innerHTML = `
        <span class="wa-sr-only">${quitLabel}</span>
        <img src="./assets/Images/icons/quit-game.svg" alt="" aria-hidden="true" class="wa-quit-icon" />
      `;
      quitBtn.addEventListener('click', exitToMenu);
      root.appendChild(quitBtn);
    }

  const startMeta = {};
  if (ctx?.grammarFile) startMeta.grammarFile = ctx.grammarFile;
  if (ctx?.grammarName) startMeta.grammarName = ctx.grammarName;
  if (Object.keys(startMeta).length) startMeta.category = 'grammar';

  try { sessionId = startSession({ mode: sessionModeId, wordList: items, listName: ctx?.listName || null, meta: Object.keys(startMeta).length ? startMeta : undefined }); } catch(e){ console.debug('[WordSentenceMode] startSession skipped', e?.message); }
    renderRound();
  }

  function renderRound(){
    const item = items[index];
    if (!item){ showSummary(); return; }
    const counter = root.querySelector('#smCounter'); if (counter) counter.textContent = `${index+1} / ${items.length}`;

  const constructEl = root.querySelector('#smConstruct');
  const tokensEl = root.querySelector('#smTokens');
  const hintEl = root.querySelector('#smHint');
  const feedbackEl = root.querySelector('#smFeedback');
    const submitBtn = root.querySelector('#smSubmit');
    const nextBtn = root.querySelector('#smNext');
    const replayBtn = root.querySelector('#smReplay');
    const clearBtn = root.querySelector('#smClear');
    if (!constructEl || !tokensEl) return;

    feedbackEl.textContent = '';
    // Update hint display (light gray Korean translation if available)
    if (hintEl){
      const hintTxt = getKoreanHint(item);
      hintEl.textContent = hintTxt || '';
      hintEl.style.display = hintTxt ? '' : 'none';
    }
    submitBtn.style.display = '';
    nextBtn.style.display = 'none';
    constructEl.innerHTML = '';
    tokensEl.innerHTML = '';

    const correctTokens = tokenize(item.sentence);
    const shuffled = shuffle(correctTokens.slice());
    let roundLocked = false;

    submitBtn.classList.add('sm-floating');
    submitBtn.classList.remove('sm-floating-visible');
    function updateSubmitVisibility(){
      if (roundLocked) return;
      const placed = currentConstructTokens(constructEl).length;
      if (placed === correctTokens.length) submitBtn.classList.add('sm-floating-visible');
      else submitBtn.classList.remove('sm-floating-visible');
    }
    window.__wsUpdateSubmit = updateSubmitVisibility;

    shuffled.forEach(tok => {
      const btn = document.createElement('button');
      btn.type='button'; btn.className='sm-chip'; btn.textContent = tok;
      btn.addEventListener('click', () => {
        if (roundLocked) return;
        btn.disabled = true;
        addTokenToLine(tok, btn);
        updateSubmitVisibility();
      });
      tokensEl.appendChild(btn);
    });
    updateSubmitVisibility();

    submitBtn.onclick = () => {
      if (roundLocked) return;
      const attemptTokens = currentConstructTokens(constructEl);
      if (attemptTokens.length !== correctTokens.length){
        feedbackEl.textContent = 'Complete the sentence.'; feedbackEl.style.color = '#b45309'; return;
      }
      const attemptNorm = normalizeSentence(attemptTokens.join(' '));
      const correctNorm = normalizeSentence(correctTokens.join(' '));
      const ok = attemptNorm === correctNorm;
      let tokens_correct = 0; for (let i=0;i<correctTokens.length;i++){ if (attemptTokens[i] === correctTokens[i]) tokens_correct++; }
      const tokens_total = correctTokens.length; const pct = Math.round((tokens_correct / tokens_total) * 100);
      const awardedPoints = pointsForPercent(pct);
      roundLocked = true;
      Array.from(tokensEl.querySelectorAll('button')).forEach(b=> b.disabled = true);
      if (ok){
        feedbackEl.textContent = 'Correct!'; feedbackEl.style.color = '#065f46'; sentencesCorrect++; constructEl.classList.add('sm-correct'); playSfx('right');
      } else {
        if (pct >= 80) playSfx('almost'); else playSfx('wrong');
        feedbackEl.textContent = 'Answer Shown'; feedbackEl.style.color = '#b91c1c'; constructEl.classList.add('sm-incorrect');
        constructEl.innerHTML = '';
        correctTokens.forEach(tok => { const span = document.createElement('span'); span.className = 'sm-word-frag sm-word-inline sm-solution'; span.textContent = tok; constructEl.appendChild(span); });
      }
      totalPoints += awardedPoints; updateHeaderScore();
      try {
        const wordKey = (items[index]?.eng ? `${items[index].eng}__sentence` : `sentence_${index+1}`);
  logAttempt({ session_id: sessionId, mode: sessionModeId, word: wordKey, is_correct: ok, answer: attemptNorm, correct_answer: correctNorm, points: awardedPoints, attempt_index: index, round: index + 1, extra: { pct, tokens_total, tokens_correct, sentence: items[index].sentence, sentence_id: items[index].sentence_id || null } });
      } catch(e){ console.debug('[WordSentenceMode] logAttempt failed', e?.message); }
      submitBtn.classList.remove('sm-floating-visible'); submitBtn.style.display='none'; nextBtn.style.display='';
    };

    nextBtn.onclick = () => { index++; renderRound(); };
    clearBtn.onclick = () => { if(!roundLocked) renderRound(); };
    replayBtn.onclick = () => { playSentenceAudio(item); };
    setTimeout(()=>{ playSentenceAudio(item); }, 150);
  }

  function showSummary(){
  const pct = items.length ? Math.round((sentencesCorrect / items.length) * 100) : 0;
  const maxPoints = items.length * 2;
  // Persist score in the same shape other modes use so mode selector can compute %
  const endMeta = {};
  if (ctx?.grammarFile) endMeta.grammarFile = ctx.grammarFile;
  if (ctx?.grammarName) endMeta.grammarName = ctx.grammarName;
  if (Object.keys(endMeta).length) endMeta.category = 'grammar';
  
  try { endSession(sessionId, { 
    mode: sessionModeId, 
    summary: { score: totalPoints, total: maxPoints, correct: sentencesCorrect, points: totalPoints, pct, grammarFile: ctx?.grammarFile, grammarName: ctx?.grammarName },
    listName: ctx?.listName || null,
    wordList: items,
    meta: Object.keys(endMeta).length ? endMeta : undefined
  }); } catch {}
    try {
      // Fire global event so stars overlay can appear like other modes
      const ev = new CustomEvent('wa:session-ended', { detail: { summary: { score: totalPoints, total: maxPoints } } });
      window.dispatchEvent(ev);
    } catch {}
    root.innerHTML = `<div class="ending-screen" style="padding:40px 18px;text-align:center;">
      <h2 style="color:#41b6beff;font-size:2em;margin-bottom:18px;">Sentence Game Over!</h2>
      <div style="font-size:1.3em;margin-bottom:12px;">Your Score: <span style="color:#19777e;font-weight:700;">${totalPoints} / ${maxPoints}</span></div>
      <button id="playAgainBtn" style="display:none;font-size:1.1em;padding:12px 28px;border-radius:12px;background:#93cbcf;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;">Play Again</button>
      ${document.getElementById('gameStage') ? '' : `<button id="tryMoreBtn" style="font-size:1.05em;padding:10px 22px;border-radius:12px;background:#f59e0b;color:#fff;font-weight:700;border:none;box-shadow:0 2px 8px rgba(60,60,80,0.08);cursor:pointer;margin-left:12px;">Return</button>`}
    </div>`;
    const playAgainBtn = document.getElementById('playAgainBtn');
    if (playAgainBtn) playAgainBtn.onclick = () => location.reload();
    const tryMoreBtn = document.getElementById('tryMoreBtn');
    if (tryMoreBtn) tryMoreBtn.onclick = exitToMenu;
  }

  // Helpers
  function tokenize(sentence){
    return sentence
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }
  function normalizeSentence(s){
    return s.replace(/\s+/g,' ').replace(/\s([,;.?!])/g,'$1').trim();
  }
  function currentConstructTokens(constructEl){
    return Array.from(constructEl.querySelectorAll('[data-token]')).map(el=>el.getAttribute('data-token'));
  }
  function addTokenToLine(tok, originBtn){
    const constructEl = root.querySelector('#smConstruct'); if (!constructEl) return;
    const placeholder = constructEl.querySelector('.sm-line-placeholder'); if (placeholder) placeholder.remove();
    const span = document.createElement('span');
    span.className = 'sm-word-frag sm-word-inline';
    span.textContent = tok;
    span.setAttribute('data-token', tok);
    span.tabIndex = 0;
    span.addEventListener('click', () => { span.remove(); originBtn.disabled = false; originBtn.focus(); if (!constructEl.querySelector('[data-token]')) addPlaceholder(constructEl); if (window.__wsUpdateSubmit) window.__wsUpdateSubmit(); });
    span.addEventListener('keydown', (e)=>{ if (e.key==='Backspace' || e.key==='Delete' || e.key==='Enter' || e.key===' ') { e.preventDefault(); span.click(); } });
    constructEl.appendChild(span);
    if (window.__wsUpdateSubmit) window.__wsUpdateSubmit();
  }
  function addPlaceholder(constructEl){
    const pl = document.createElement('span'); pl.className='sm-line-placeholder'; pl.textContent='Tap words below…'; constructEl.appendChild(pl);
  }

  function getKoreanHint(item){
    if (!item) return '';
    const cands = [item.sentence_kor, item.sentenceKor, item.ex_kor, item.example_kor, item.kor_sentence, item.korean_sentence, item.korean, item.kor, item.ko];
    const chosen = cands.find(v=> typeof v === 'string' && v.trim());
    if (chosen) return String(chosen).trim();
    if (Array.isArray(item.sentences) && item.sentences.length){
      const s = (item.primary_sentence_id ? item.sentences.find(x=>x.id === item.primary_sentence_id) : null) || item.sentences[0];
      const kv = s?.ko || s?.kor || s?.korean || s?.translation_ko;
      if (typeof kv === 'string' && kv.trim()) return kv.trim();
    }
    return '';
  }

  function shuffle(arr){ for (let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()* (i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }
  function pointsForPercent(p){ if (p>=100) return 2; if (p>=80) return 1; if (p>=60) return 1; return 0; }
  function updateHeaderScore(){ const el = root.querySelector('#smScore'); if (el) el.textContent = `${totalPoints} pts`; }

  function playSentenceAudio(item){
    if (playSentenceAudio.isPlaying) return;
    if (item.sentenceAudioUrl){
      try {
        const a = new Audio(item.sentenceAudioUrl);
        let fellBack = false;
        const fallback = (reason)=>{ if (fellBack) return; fellBack = true; playSentenceAudio.isPlaying = false; if (ctx.playTTS) ctx.playTTS(item.sentence); };
        a.onerror = ()=> fallback(new Error('audio error'));
        playSentenceAudio.isPlaying = true;
        a.onended = () => { playSentenceAudio.isPlaying = false; };
        const p = a.play(); if (p && typeof p.catch === 'function') p.catch(err=> fallback(err));
        return;
      } catch { /* fallback below */ }
    }
    if (ctx.playTTS){ 
      playSentenceAudio.isPlaying = true;
      try {
        ctx.playTTS(item.sentence);
        setTimeout(() => { playSentenceAudio.isPlaying = false; }, 12000);
      } catch(e) {
        playSentenceAudio.isPlaying = false;
      }
    }
  }

  function playSfx(kind){
    try {
      if(!playSfx.cache){
        const BASE = '/Games/english_arcade/assets/audio/';
        const manifest = { right: 'right-answer.mp3', wrong: 'wrong-answer.mp3', almost: 'kinda-right-answer.mp3' };
        playSfx.cache = {};
        for (const [k,f] of Object.entries(manifest)){
          const a = new Audio(BASE + f); a.preload = 'auto'; a.volume = 0.85; playSfx.cache[k] = a;
        }
      }
      const a = playSfx.cache[kind]; if(!a) return; a.currentTime = 0; const p = a.play(); if (p && typeof p.catch === 'function') p.catch(()=>{});
    } catch {}
  }
}

// Resolve and attach sentence_id for each item when missing by upserting/finding in the Sentences table.
// Leverages server function to ensure stable IDs for audio keying (sent_<id>.mp3).
async function resolveSentenceIdsIfMissing(items){
  if (!Array.isArray(items) || !items.length) return;
  const need = items.filter(it => !it.sentence_id && it.sentence && typeof it.sentence === 'string');
  if (!need.length) return;
  // Build unique list of texts; include word link to help future analytics (word_sentences join).
  const byText = new Map();
  need.forEach(it => {
    const text = it.sentence.trim().replace(/\s+/g,' ');
    if (!byText.has(text)) byText.set(text, new Set());
    if (it.eng) byText.get(text).add(String(it.eng));
  });
  const payload = {
    action: 'upsert_sentences_batch',
    skip_audio: true,
    sentences: Array.from(byText.entries()).map(([text, wordsSet]) => ({ text, words: Array.from(wordsSet) }))
  };
  try {
    const r = await WillenaAPI.fetch('/.netlify/functions/upsert_sentences_batch', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
    if (!r.ok) { throw new Error('upsert_sentences_batch HTTP '+r.status); }
    const js = await r.json();
    if (!js || !js.success || !Array.isArray(js.sentences)) return;
    const idByText = new Map(js.sentences.map(s => [s.text, s.id]));
    // Attach ids back to items; if item already had a chosen nested sentence, prefer that id.
    items.forEach(it => {
      if (it.sentence_id) return;
      const key = it.sentence && it.sentence.trim().replace(/\s+/g,' ');
      const id = key ? idByText.get(key) : null;
      if (id) it.sentence_id = id;
    });
  } catch(e){
    console.debug('[WordSentenceMode] sentence id resolve error', e?.message);
  }
}

function renderErrorBox(msg){
  return `<div style="max-width:520px;margin:40px auto;text-align:center;font-family:Poppins,system-ui;padding:30px 24px;background:#fff;border:2px solid #fecaca;border-radius:20px;box-shadow:0 10px 32px -6px rgba(0,0,0,0.15);">
    <h2 style="margin:0 0 14px;font-size:1.4rem;color:#b91c1c;font-weight:800;">Sentence Mode</h2>
    <div style="font-size:.95rem;color:#334155;line-height:1.4;">${msg}</div>
  </div>`;
}

function injectStylesOnce(){
  if (document.getElementById('sentenceModeStyles')) return;
  const style = document.createElement('style'); style.id = 'sentenceModeStyles';
  style.textContent = `
  .sentence-mode { font-family:Poppins,system-ui,sans-serif; animation:smFade .5s ease; }
  .sentence-mode .sm-header.sm-header-no-title { justify-content:flex-end; }
    .sentence-mode .sm-header { display:flex;align-items:center;justify-content:space-between;gap:12px;margin:4px 0 16px; flex-wrap:wrap; }
    .sentence-mode .sm-title { font-weight:800;color:#19777e;font-size:clamp(1rem,2vw,1.25rem); letter-spacing:.5px; }
    .sentence-mode .sm-counter { font-size:.75rem;font-weight:700;background:#e6f7f8;color:#19777e;padding:6px 12px;border-radius:20px;letter-spacing:.5px; border:1px solid #b9d9db; }
    .sentence-mode .sm-header-right { display:flex;align-items:center;gap:8px; }
    .sentence-mode .sm-score { font-size:.7rem;font-weight:800;background:#19777e;color:#fff;padding:6px 10px;border-radius:18px;letter-spacing:.5px; box-shadow:0 2px 8px rgba(0,0,0,0.15); }
  .sentence-mode .sm-box { position:relative;background:#f7f7fa;border:2px solid #d0d8e0;border-radius:20px;padding:22px 20px 20px;min-height:210px;display:flex;flex-direction:column;gap:14px;box-shadow:0 8px 28px -4px rgba(74, 141, 146, 0.08); }
    .sentence-mode .sm-section-label { font-size:.65rem;font-weight:700; letter-spacing:.9px; color:#19777e; text-transform:uppercase; }
    .sentence-mode .sm-construct { min-height:54px; display:flex;flex-wrap:wrap;gap:10px; padding:4px 2px 2px; }
    .sentence-mode .sm-construct-line { background:#ffffff;border:1px solid #d0d8e0; border-radius:14px; min-height:56px; padding:12px 14px; display:flex;align-items:center;flex-wrap:wrap; gap:8px; font-size:1.05rem; line-height:1.35; font-weight:600; color:#0f172a; }
    .sentence-mode .sm-construct-line.sm-correct { box-shadow:0 0 0 3px #0d948888; border-color:#19777e; }
    .sentence-mode .sm-word-frag { background:#19777e; color:#fff; padding:6px 12px; border-radius:12px; position:relative; cursor:pointer; display:inline-flex; align-items:center; gap:4px; font-weight:600; font-size:.95rem; box-shadow:0 2px 8px rgba(0,0,0,0.18); animation:fragPop .35s ease; }
    .sentence-mode .sm-word-frag.sm-word-inline { background:transparent; box-shadow:none; color:#0f172a; padding:0 4px; border-radius:8px; position:relative; font-weight:600; }
    .sentence-mode .sm-word-frag.sm-word-inline:after { content:''; position:absolute; left:0; right:0; bottom:0; height:2px; background:#19777e; transform:scaleX(0); transform-origin:left; transition:transform .35s ease; }
    .sentence-mode .sm-word-frag.sm-word-inline:hover:after, .sentence-mode .sm-word-frag.sm-word-inline:focus-visible:after { transform:scaleX(1); }
    .sentence-mode .sm-word-frag:focus-visible { outline:3px solid #19777e; outline-offset:3px; }
    .sentence-mode .sm-line-placeholder { opacity:.5; font-weight:500; font-size:.9rem; letter-spacing:.5px; }
    .sentence-mode .sm-tokens { justify-content:center; display:flex;flex-wrap:wrap;gap:10px; margin-top:2px; }
  .sentence-mode .sm-hint { text-align:center; color:#94a3b8; font-size:.92rem; margin-top:6px; }
    @keyframes fragPop { 0% { transform:scale(.4); opacity:0;} 70% { transform:scale(1.08); opacity:1;} 100% { transform:scale(1); opacity:1;} }
    .sentence-mode .sm-divider { height:1px; background:#d0d8e0; margin:2px 0 4px; }
    .sentence-mode .sm-feedback { min-height:24px; font-size:.85rem; font-weight:600; letter-spacing:.3px; }
    .sentence-mode .sm-chip { --sm-bg:#ffffff; --sm-border:#d0d8e0; --sm-color:#0f172a; position:relative; font:inherit; font-weight:600; font-size:.95rem; padding:10px 16px; border:2px solid var(--sm-border); background:var(--sm-bg); color:var(--sm-color); border-radius:16px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; line-height:1.1; box-shadow:0 3px 10px rgba(0,0,0,0.05); transition:background .25s, transform .25s, box-shadow .25s, border-color .25s; }
    .sentence-mode .sm-chip:hover:not(:disabled){ background:#f2fbfc; border-color:#19777e; }
    .sentence-mode .sm-chip:active:not(:disabled){ transform:scale(.92); }
    .sentence-mode .sm-chip:disabled { opacity:.3; cursor:default; }
    .sentence-mode .sm-actions { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-top:4px; }
    .sentence-mode .flex-spacer { flex:1; }
  .sentence-mode .sm-btn { font:inherit; font-weight:800; letter-spacing:.3px; font-size:.95rem; border:2px solid transparent; color:#fff; padding:13px 28px; border-radius:16px; cursor:pointer; position:relative; display:inline-flex; align-items:center; gap:6px; box-shadow:0 4px 14px -4px rgba(0,0,0,0.16); transition:box-shadow .22s, transform .22s, filter .22s; }
  .sentence-mode .sm-btn:hover { box-shadow:0 6px 20px -4px rgba(0,0,0,0.2); transform:translateY(-2px); }
  .sentence-mode .sm-btn:active { transform:scale(.96); box-shadow:0 4px 12px -4px rgba(0,0,0,0.2); }
  .sentence-mode .sm-btn.submit { background:#ff7a1a; border-color:#ff7a1a; }
  .sentence-mode .sm-btn.submit:hover { background:#ff8c3a; border-color:#ff8c3a; }
  .sentence-mode .sm-btn.primary { background:#19777e; border-color:#19777e; }
  .sentence-mode .sm-btn.primary:hover { background:#248b86; border-color:#248b86; }
  .sentence-mode .sm-btn.accent { background:#19777e; border-color:#19777e; }
  .sentence-mode .sm-btn.accent:hover { background:#248b86; border-color:#248b86; }
    .sentence-mode .sm-btn.ghost { color:#19777e; border:2px solid #19777e; background:#fff; padding:10px 18px; box-shadow:0 2px 10px rgba(0,0,0,0.08); }
    .sentence-mode .sm-btn.ghost:hover { background:#f7f7fa; border-color:#248b86; }
    .sentence-mode .sm-btn.ghost.audio { border-style:solid; font-weight:800; font-size:1rem; }
  .sentence-mode #smSubmit.sm-floating { position:absolute; top:calc(50% + 50px); left:50%; transform:translate(-50%,-50%) scale(.6); opacity:0; pointer-events:none; font-size:clamp(2.2rem,4vw,3.2rem); padding:30px 68px; border-radius:48px; letter-spacing:.9px; font-weight:800; background:#ff7a1a; color:#fff; border:3px solid #ff7a1a; box-shadow:0 22px 55px -12px rgba(0,0,0,0.4),0 0 0 5px rgba(255,122,26,0.18); backdrop-filter:blur(4px); transition:opacity .45s ease, transform .55s cubic-bezier(.16,.8,.24,1); }
  .sentence-mode #smSubmit.sm-floating:hover { background:#ff8c3a; border-color:#ff8c3a; }
    .sentence-mode #smSubmit.sm-floating-visible { opacity:1; transform:translate(-50%,-50%) scale(1); pointer-events:auto; }
  .sentence-mode-quit-btn { z-index: 1100; position: fixed; right: clamp(12px, 3vw, 24px); bottom: calc(env(safe-area-inset-bottom, 0px) + clamp(12px, 3vw, 24px)); }
    .cgm-mode-root.sm-center-root { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:32px; min-height:calc(100vh - 220px); padding:clamp(32px,6vh,56px) clamp(18px,7vw,36px); box-sizing:border-box; background:linear-gradient(180deg,#f6feff 0%, #ffffff 90%); }
    .cgm-mode-root.sm-center-root .sentence-mode { width:min(640px, 94vw); }
    .cgm-mode-root.sm-center-root .sentence-mode-quit-wrap { width:min(640px, 94vw); }
    @keyframes smFade { 0% { opacity:0;} 100% { opacity:1;} }
  `;
  document.head.appendChild(style);
}
