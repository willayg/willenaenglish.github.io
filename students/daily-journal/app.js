(function () {
  'use strict';

  const DEFAULT_GOAL = 6;
  const STORAGE_PREFIX = 'willena-daily-journal:v2:';
  const LUNA_MODEL = 'gpt-5.6-luna';
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

  function dayKey() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function freshState() { return { date: dayKey(), goal: DEFAULT_GOAL, originalText: '', sentences: [], status: 'draft', reviewIndex: 0, speakIndex: 0, updatedAt: Date.now() }; }
  function key() { return `${STORAGE_PREFIX}${userId}:${dayKey()}`; }
  function apiFetch(path, options) { const fn = window.WillenaAPI?.fetch ? window.WillenaAPI.fetch.bind(window.WillenaAPI) : window.fetch.bind(window); return fn(path, Object.assign({ credentials:'include', cache:'no-store' }, options || {})); }

  async function authenticate() {
    const r = await apiFetch('/.netlify/functions/supabase_auth?action=whoami&_=' + Date.now());
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.success && d.user_id) return d.user_id;
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace('/students/signin.html?next=' + next);
    throw new Error('Sign in required');
  }

  function load() { try { const x = JSON.parse(localStorage.getItem(key()) || 'null'); return x && x.date === dayKey() ? Object.assign(freshState(), x) : freshState(); } catch (_) { return freshState(); } }
  function save() { state.updatedAt = Date.now(); try { localStorage.setItem(key(), JSON.stringify(state)); } catch (_) {} }
  function show(which) { ['loading','write','review','speak','done','error'].forEach(k => els[k].hidden = k !== which); }

  function countSentences(text) {
    const clean = String(text || '').replace(/\r/g,'\n').trim();
    if (!clean) return 0;
    const punctuated = clean.match(/[^.!?\n]+(?:[.!?]+|$)/g) || [];
    const lines = clean.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const chunks = punctuated.map(s => s.trim()).filter(s => /[A-Za-z0-9]/.test(s));
    return Math.max(chunks.length, lines.length === 1 && !/[.!?]/.test(clean) ? 1 : 0);
  }

  function updateWritingProgress() {
    const n = countSentences(els.input.value);
    els.count.textContent = `${n} / ${state.goal}`;
    els.bar.style.width = `${Math.min(100, n / state.goal * 100)}%`;
    els.submit.disabled = n < state.goal;
    els.submit.textContent = n < state.goal ? `${state.goal - n} more sentence${state.goal - n === 1 ? '' : 's'}` : 'Finish writing';
  }

  function renderWrite() { els.input.value = state.originalText || ''; updateWritingProgress(); show('write'); app.setAttribute('aria-busy','false'); setTimeout(() => els.input.focus(), 80); }

  function parseCorrection(raw) {
    const cleaned = String(raw || '').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    const parsed = JSON.parse(cleaned);
    if (!parsed || !Array.isArray(parsed.sentences) || !parsed.sentences.length) throw new Error('The AI response was incomplete.');
    return parsed.sentences.map((s, i) => {
      if (!s || typeof s.original !== 'string' || typeof s.corrected !== 'string') throw new Error('The AI response had an invalid sentence.');
      return { order: i + 1, original: s.original.trim(), corrected: s.corrected.trim(), changes: Array.isArray(s.changes) ? s.changes : [], speechCompleted:false, speechAttempts:0, speechBestScore:0, transcript:'' };
    });
  }

  async function correctWholeDiary(text) {
    const system = `You are an English writing coach for Korean ESL children. Correct the student's entire diary sentence by sentence. Preserve every fact, feeling, opinion, detail, sentence personality, and age-appropriate word that already works. Make the smallest reasonable changes needed for clear, correct American English. Fix genuine grammar, spelling, capitalization, punctuation, word form, tense, articles, prepositions, and clearly unnatural wording. Never invent or embellish. Never turn child English into polished adult prose. Return ONLY valid JSON in this exact shape: {"sentences":[{"order":1,"original":"exact original sentence","corrected":"minimally corrected sentence","changes":[{"type":"grammar","original":"...","corrected":"...","reason":"very short child-friendly reason"}]}]}. Keep sentence order. If no correction is needed, corrected must equal original and changes must be [].`;
    const r = await apiFetch('/.netlify/functions/openai_proxy', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ endpoint:'chat/completions', payload:{ model:LUNA_MODEL, messages:[{role:'system',content:system},{role:'user',content:text}], temperature:0.1, max_tokens:2200 } }) });
    if (!r.ok) throw new Error(`AI correction failed (${r.status}).`);
    const result = await r.json(); const data = result?.data || result; if (data?.error) throw new Error(data.error.message || 'AI correction failed.');
    return parseCorrection(data?.choices?.[0]?.message?.content);
  }

  async function submitDiary() {
    const text = els.input.value.trim(); const n = countSentences(text); if (n < state.goal) return;
    state.originalText = text; state.status = 'correcting'; save(); els.submit.disabled = true; els.submit.textContent = 'Checking your English…';
    try { state.sentences = await correctWholeDiary(text); state.status = 'review'; state.reviewIndex = 0; save(); renderReview(); }
    catch (e) { showError((e.message || 'Could not check your journal.') + ' Your original writing is still saved.'); }
  }

  function renderReview() {
    const s = state.sentences[state.reviewIndex]; if (!s) return beginSpeaking();
    els.reviewNumber.textContent = `${state.reviewIndex + 1}/${state.sentences.length}`; els.original.textContent = s.original; els.corrected.textContent = s.corrected;
    const reasons = (s.changes || []).map(c => c.reason).filter(Boolean); els.note.textContent = s.corrected === s.original ? 'Looks good — no change needed.' : (reasons.join(' · ') || 'A small English correction.');
    els.reviewBack.disabled = state.reviewIndex === 0; els.reviewNext.textContent = state.reviewIndex === state.sentences.length - 1 ? 'Start speaking' : 'Next'; show('review');
  }

  function nextReview(delta) { state.reviewIndex = Math.max(0, Math.min(state.sentences.length - 1, state.reviewIndex + delta)); save(); renderReview(); }
  function forwardReview() { if (state.reviewIndex >= state.sentences.length - 1) beginSpeaking(); else nextReview(1); }
  function beginSpeaking() { state.status = 'speaking'; state.speakIndex = Math.max(0, state.speakIndex || 0); save(); renderSpeak(); }

  function renderSpeak() {
    const s = state.sentences[state.speakIndex]; if (!s) return finish();
    els.speakTarget.textContent = s.corrected; els.speechFeedback.textContent = `Sentence ${state.speakIndex + 1} of ${state.sentences.length}`; els.speechFeedback.className='speech-feedback'; els.nextSpeak.hidden = !s.speechCompleted; els.micLabel.textContent = speechSupported() ? 'Tap and speak' : 'Speech not supported'; show('speak');
  }

  function speechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  function words(text) { return String(text||'').toLowerCase().replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim().split(' ').filter(Boolean); }
  function scoreSpeech(target, heard) { const a=words(target), b=words(heard); if(!a.length) return 0; const counts={}; b.forEach(w=>counts[w]=(counts[w]||0)+1); let hit=0; a.forEach(w=>{if(counts[w]>0){hit++;counts[w]--;}}); return Math.round(hit/a.length*100); }
  function stopMic() { listening=false; els.mic.classList.remove('listening'); els.mic.setAttribute('aria-pressed','false'); els.micLabel.textContent='Try again'; }

  function startMic() {
    if (!speechSupported()) { els.speechFeedback.textContent='This browser cannot use speech recognition. You can use the fallback.'; els.nextSpeak.hidden=false; return; }
    if (listening && recognition) { recognition.stop(); return; }
    const R=window.SpeechRecognition||window.webkitSpeechRecognition; recognition=new R(); recognition.lang='en-US'; recognition.interimResults=true; recognition.continuous=false; let final='';
    recognition.onstart=()=>{listening=true;els.mic.classList.add('listening');els.mic.setAttribute('aria-pressed','true');els.micLabel.textContent='Listening…';};
    recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=t;else interim+=t;}const heard=(final||interim).trim();if(heard)els.speechFeedback.textContent=`I heard: “${heard}”`;};
    recognition.onerror=()=>{stopMic(); const s=state.sentences[state.speakIndex]; s.speechAttempts=(s.speechAttempts||0)+1; save(); els.speechFeedback.textContent='I could not hear that clearly. Try again.'; if(s.speechAttempts>=2)els.nextSpeak.hidden=false;};
    recognition.onend=()=>{stopMic();if(!final.trim())return;const s=state.sentences[state.speakIndex];const score=scoreSpeech(s.corrected,final);s.speechAttempts=(s.speechAttempts||0)+1;s.speechBestScore=Math.max(s.speechBestScore||0,score);s.transcript=final.trim();if(score>=80){s.speechCompleted=true;els.speechFeedback.textContent=`Nice! I heard: “${final.trim()}”`;els.speechFeedback.className='speech-feedback good';els.nextSpeak.hidden=false;}else{els.speechFeedback.textContent=`I heard: “${final.trim()}” — try it once more.`;if(s.speechAttempts>=3)els.nextSpeak.hidden=false;}save();};
    recognition.start();
  }

  function fallbackSpeak() { const s=state.sentences[state.speakIndex]; if(s){s.speechCompleted=true;s.fallback=true;save();} advanceSpeak(); }
  function advanceSpeak() { if(state.speakIndex>=state.sentences.length-1)finish();else{state.speakIndex++;save();renderSpeak();} }
  function finish() { state.status='completed'; save(); const changed=state.sentences.filter(s=>s.original!==s.corrected).length; const spoken=state.sentences.filter(s=>s.speechCompleted).length; els.doneSummary.textContent=`${state.sentences.length} sentences written · ${changed} improved · ${spoken} spoken`; els.finished.innerHTML=''; state.sentences.forEach((s,i)=>{const d=document.createElement('div');d.textContent=`${i+1}. ${s.corrected}`;els.finished.appendChild(d);}); els.count.textContent=`${state.sentences.length} / ${state.goal}`; els.bar.style.width='100%'; show('done'); }
  function reset() { if(!confirm('Start today’s journal again?'))return; state=freshState();save();renderWrite(); }
  function showError(msg){els.errorText.textContent=msg;show('error');}

  function wire(){els.input.addEventListener('input',()=>{state.originalText=els.input.value;save();updateWritingProgress();});els.submit.addEventListener('click',submitDiary);els.reviewBack.addEventListener('click',()=>nextReview(-1));els.reviewNext.addEventListener('click',forwardReview);els.mic.addEventListener('click',startMic);els.skipSpeak.addEventListener('click',fallbackSpeak);els.nextSpeak.addEventListener('click',advanceSpeak);els.restart.addEventListener('click',reset);els.retry.addEventListener('click',renderWrite);}

  async function boot(){try{userId=await authenticate();state=load();wire();app.setAttribute('aria-busy','false');if(state.status==='completed')finish();else if(state.status==='review'&&state.sentences.length)renderReview();else if(state.status==='speaking'&&state.sentences.length)renderSpeak();else renderWrite();}catch(e){if(!/Sign in required/.test(e.message||''))showError(e.message||'Could not open your journal.');}}
  boot();
})();
