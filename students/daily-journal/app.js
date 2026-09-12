(function () {
  'use strict';

  const DEFAULT_GOAL = 6;
  const MIN_GOAL = 6;
  const MAX_GOAL = 20;
  const STORAGE_PREFIX = 'willena-daily-journal:v5:';
  const AUTH_WORKER = 'https://supabase-auth.willena.workers.dev';
  const WRITING_AI_WORKER = 'https://willena-openai-proxy.willena.workers.dev';

  const app = document.getElementById('journalApp');
  const els = {
    loading: document.getElementById('loadingCard'), write: document.getElementById('writeCard'), review: document.getElementById('reviewCard'),
    speak: document.getElementById('speakCard'), done: document.getElementById('doneCard'), error: document.getElementById('errorCard'),
    errorText: document.getElementById('errorText'), input: document.getElementById('journalInput'), submit: document.getElementById('submitBtn'),
    count: document.getElementById('progressCount'), bar: document.getElementById('progressBar'), reviewNumber: document.getElementById('reviewNumber'),
    original: document.getElementById('originalText'), corrected: document.getElementById('correctedText'), note: document.getElementById('correctionNote'),
    reviewBack: document.getElementById('reviewBackBtn'), reviewNext: document.getElementById('reviewNextBtn'), speakTarget: document.getElementById('speakTarget'),
    mic: document.getElementById('micBtn'), micLabel: document.getElementById('micLabel'), speechFeedback: document.getElementById('speechFeedback'),
    skipSpeak: document.getElementById('skipSpeakBtn'), nextSpeak: document.getElementById('nextSpeakBtn'), doneSummary: document.getElementById('doneSummary'),
    finished: document.getElementById('finishedSentences'), restart: document.getElementById('newJournalBtn'), retry: document.getElementById('retryBtn')
  };

  let userId = null;
  let state = freshState();
  let recognition = null;
  let listening = false;
  let saveTimer = null;
  let errorRetry = null;

  function clampGoal(value) { return Math.max(MIN_GOAL, Math.min(MAX_GOAL, Number(value) || DEFAULT_GOAL)); }
  function configuredGoal() {
    const q = new URLSearchParams(location.search);
    return clampGoal(q.get('goal') || q.get('sentences') || DEFAULT_GOAL);
  }
  function dayKey() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
    catch (_) { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  }
  function freshState() {
    return { date:dayKey(), goal:configuredGoal(), originalText:'', sentences:[], status:'draft', reviewIndex:0, speakIndex:0, updatedAt:Date.now() };
  }
  function key() { return `${STORAGE_PREFIX}${userId}:${dayKey()}`; }
  function loadLocal() {
    try {
      const x = JSON.parse(localStorage.getItem(key()) || 'null');
      return x && x.date === dayKey() ? Object.assign(freshState(), x) : freshState();
    } catch (_) { return freshState(); }
  }
  function saveLocal() { state.updatedAt = Date.now(); try { localStorage.setItem(key(), JSON.stringify(state)); } catch (_) {} }
  function clearLocal() { try { localStorage.removeItem(key()); } catch (_) {} }
  function show(which) { ['loading','write','review','speak','done','error'].forEach(k => { els[k].hidden = k !== which; }); }

  async function authenticate() {
    const r = await fetch(`${AUTH_WORKER}?action=whoami&_=${Date.now()}`, { credentials:'include', cache:'no-store' });
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.success && d.user_id) return d.user_id;
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace('/students/signin.html?next=' + next);
    throw new Error('Sign in required');
  }

  function splitSentences(text) {
    const clean = String(text || '').replace(/\r/g, '\n').trim();
    if (!clean) return [];
    const out = [];
    clean.split(/\n+/).forEach(line => {
      line = line.trim();
      if (!/[A-Za-z0-9]/.test(line)) return;
      const parts = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [line];
      parts.map(s => s.trim()).filter(s => /[A-Za-z0-9]/.test(s)).forEach(s => out.push(s));
    });
    return out;
  }
  function countSentences(text) { return splitSentences(text).length; }
  function updateWritingProgress() {
    const n = countSentences(els.input.value);
    els.count.textContent = `${n} / ${state.goal}`;
    els.bar.style.width = `${Math.min(100, n / state.goal * 100)}%`;
    els.submit.disabled = n < state.goal;
    const left = Math.max(0, state.goal - n);
    els.submit.textContent = left ? `${left} more sentence${left === 1 ? '' : 's'}` : 'Finish writing';
  }
  function renderWrite() {
    els.input.value = state.originalText || '';
    els.input.disabled = state.status !== 'draft';
    updateWritingProgress();
    show('write');
    app.setAttribute('aria-busy','false');
    if (state.status === 'draft') setTimeout(() => els.input.focus(), 80);
  }

  async function correctSentence(original, order) {
    const r = await fetch(WRITING_AI_WORKER, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ transcript:original, language:'en' })
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) throw new Error(data.error || `Writing correction failed (${r.status}).`);
    const corrected = String(data.corrected_sentence || '').trim();
    if (!corrected) throw new Error(`The correction for sentence ${order} was empty.`);
    if (corrected.length > Math.max(1200, original.length * 4)) throw new Error(`The correction for sentence ${order} looked unsafe.`);
    const reason = String(data.teacher_note || '').trim();
    return {
      order,
      original,
      corrected,
      changes: corrected === original ? [] : [{ type:'grammar', original, corrected, reason:reason || 'A small English correction.' }],
      speechCompleted:false,
      speechAttempts:0,
      speechBestScore:0,
      transcript:''
    };
  }

  async function correctWholeDiary(text) {
    const originals = splitSentences(text);
    if (!originals.length) throw new Error('I could not find any sentences to correct.');
    const results = [];
    for (let i = 0; i < originals.length; i++) {
      results.push(await correctSentence(originals[i], i + 1));
    }
    return results;
  }

  async function runCorrection() {
    if (!state.originalText) throw new Error('Your submitted journal could not be found.');
    state.status = 'correcting';
    saveLocal();
    els.submit.disabled = true;
    els.submit.textContent = 'Checking your English…';
    state.sentences = await correctWholeDiary(state.originalText);
    state.status = 'review';
    state.reviewIndex = 0;
    saveLocal();
    renderReview();
  }

  async function submitDiary() {
    const text = els.input.value.trim();
    const n = countSentences(text);
    if (n < state.goal || state.status !== 'draft') return;
    state.originalText = text;
    state.status = 'correcting';
    saveLocal();
    els.submit.disabled = true;
    els.submit.textContent = 'Checking your English…';
    try { await runCorrection(); }
    catch (e) { showError((e.message || 'Could not check your journal.') + ' Your writing is still saved on this device.', resumeCorrection, 'Try correction again'); }
  }
  async function resumeCorrection() {
    show('loading');
    try { await runCorrection(); }
    catch (e) { showError((e.message || 'Could not check your journal.') + ' Your writing is still saved on this device.', resumeCorrection, 'Try correction again'); }
  }

  function renderReview() {
    const s = state.sentences[state.reviewIndex];
    if (!s) return beginSpeaking();
    els.reviewNumber.textContent = `${state.reviewIndex + 1}/${state.sentences.length}`;
    els.original.textContent = s.original;
    els.corrected.textContent = s.corrected;
    const reasons = (s.changes || []).map(c => c.reason).filter(Boolean);
    els.note.textContent = s.corrected === s.original ? 'Looks good — no change needed.' : (reasons.join(' · ') || 'A small English correction.');
    els.reviewBack.disabled = state.reviewIndex === 0;
    els.reviewNext.textContent = state.reviewIndex === state.sentences.length - 1 ? 'Start speaking' : 'Next';
    show('review');
  }
  function nextReview(delta) {
    state.reviewIndex = Math.max(0, Math.min(state.sentences.length - 1, state.reviewIndex + delta));
    saveLocal();
    renderReview();
  }
  function forwardReview() { if (state.reviewIndex >= state.sentences.length - 1) beginSpeaking(); else nextReview(1); }
  function beginSpeaking() { state.status='speaking'; state.speakIndex=Math.max(0,state.speakIndex||0); saveLocal(); renderSpeak(); }

  function renderSpeak() {
    const s = state.sentences[state.speakIndex];
    if (!s) return finish();
    els.speakTarget.textContent = s.corrected;
    els.speechFeedback.textContent = `Sentence ${state.speakIndex + 1} of ${state.sentences.length}`;
    els.speechFeedback.className = 'speech-feedback';
    els.nextSpeak.hidden = !s.speechCompleted;
    els.micLabel.textContent = speechSupported() ? 'Tap and speak' : 'Speech not supported';
    show('speak');
  }
  function speechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function normalizeSpeech(text) { return String(text||'').toLowerCase().replace(/\b(i'm)\b/g,'i am').replace(/\b(can't)\b/g,'can not').replace(/\b(don't)\b/g,'do not').replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim(); }
  function words(text) { return normalizeSpeech(text).split(' ').filter(Boolean); }
  function scoreSpeech(target, heard) {
    const a=words(target), b=words(heard); if(!a.length) return 0;
    const counts={}; b.forEach(w => counts[w]=(counts[w]||0)+1); let hit=0;
    a.forEach(w => { if(counts[w]>0){ hit++; counts[w]--; } });
    return Math.round(hit/a.length*100);
  }
  function stopMic() { listening=false; els.mic.classList.remove('listening'); els.mic.setAttribute('aria-pressed','false'); els.micLabel.textContent='Try again'; }
  function startMic() {
    if (!speechSupported()) { els.speechFeedback.textContent='This browser cannot use speech recognition. You can use the fallback.'; els.nextSpeak.hidden=false; return; }
    if (listening && recognition) { recognition.stop(); return; }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new R(); recognition.lang='en-US'; recognition.interimResults=true; recognition.continuous=false; let final='';
    recognition.onstart=()=>{ listening=true; els.mic.classList.add('listening'); els.mic.setAttribute('aria-pressed','true'); els.micLabel.textContent='Listening…'; };
    recognition.onresult=e=>{ let interim=''; for(let i=e.resultIndex;i<e.results.length;i++){ const t=e.results[i][0].transcript; if(e.results[i].isFinal) final+=t; else interim+=t; } const heard=(final||interim).trim(); if(heard) els.speechFeedback.textContent=`I heard: “${heard}”`; };
    recognition.onerror=()=>{ stopMic(); const s=state.sentences[state.speakIndex]; s.speechAttempts=(s.speechAttempts||0)+1; saveLocal(); els.speechFeedback.textContent='I could not hear that clearly. Try again.'; if(s.speechAttempts>=2) els.nextSpeak.hidden=false; };
    recognition.onend=()=>{ stopMic(); if(!final.trim()) return; const s=state.sentences[state.speakIndex]; const score=scoreSpeech(s.corrected,final); const accepted=score>=80; s.speechAttempts=(s.speechAttempts||0)+1; s.speechBestScore=Math.max(s.speechBestScore||0,score); s.transcript=final.trim(); if(accepted){ s.speechCompleted=true; els.speechFeedback.textContent=`Nice! I heard: “${final.trim()}”`; els.speechFeedback.className='speech-feedback good'; els.nextSpeak.hidden=false; } else { els.speechFeedback.textContent=`I heard: “${final.trim()}” — try it once more.`; if(s.speechAttempts>=3) els.nextSpeak.hidden=false; } saveLocal(); };
    recognition.start();
  }
  function fallbackSpeak() { const s=state.sentences[state.speakIndex]; if(s){ s.speechCompleted=true; s.fallback=true; saveLocal(); } advanceSpeak(); }
  function advanceSpeak() { if(state.speakIndex>=state.sentences.length-1) finish(); else { state.speakIndex++; saveLocal(); renderSpeak(); } }
  function finish() {
    state.status='completed'; saveLocal();
    const changed=state.sentences.filter(s=>s.original!==s.corrected).length;
    const spoken=state.sentences.filter(s=>s.speechCompleted).length;
    els.doneSummary.textContent=`${state.sentences.length} sentences written · ${changed} improved · ${spoken} spoken`;
    els.finished.innerHTML='';
    state.sentences.forEach((s,i)=>{ const d=document.createElement('div'); d.textContent=`${i+1}. ${s.corrected}`; els.finished.appendChild(d); });
    els.count.textContent=`${state.sentences.length} / ${state.goal}`; els.bar.style.width='100%'; show('done');
  }
  function reset() {
    if (!confirm(state.status==='completed' ? 'Start another journal for today?' : 'Start today’s journal again?')) return;
    clearLocal(); state=freshState(); saveLocal(); renderWrite();
  }
  function showError(msg,retryFn,retryLabel) { errorRetry=retryFn||renderWrite; els.errorText.textContent=msg; els.retry.textContent=retryLabel||'Back to my writing'; show('error'); }

  function wire() {
    els.input.addEventListener('input',()=>{ if(state.status!=='draft') return; state.originalText=els.input.value; clearTimeout(saveTimer); saveTimer=setTimeout(saveLocal,250); updateWritingProgress(); });
    els.submit.addEventListener('click',submitDiary);
    els.reviewBack.addEventListener('click',()=>nextReview(-1));
    els.reviewNext.addEventListener('click',forwardReview);
    els.mic.addEventListener('click',startMic);
    els.skipSpeak.addEventListener('click',fallbackSpeak);
    els.nextSpeak.addEventListener('click',advanceSpeak);
    els.restart.addEventListener('click',reset);
    els.retry.addEventListener('click',()=>{ const fn=errorRetry||renderWrite; errorRetry=null; fn(); });
    window.addEventListener('pagehide',saveLocal);
  }

  async function boot() {
    try {
      userId=await authenticate();
      state=loadLocal();
      state.goal=clampGoal(state.goal||configuredGoal());
      wire(); app.setAttribute('aria-busy','false');
      if(state.status==='completed') finish();
      else if(state.status==='correcting') resumeCorrection();
      else if(state.status==='review'&&state.sentences.length) renderReview();
      else if(state.status==='speaking'&&state.sentences.length) renderSpeak();
      else renderWrite();
    } catch(e) {
      if(!/Sign in required/.test(e.message||'')) showError(e.message||'Could not open your journal.',()=>location.reload(),'Try again');
    }
  }

  boot();
})();