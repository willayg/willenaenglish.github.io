(function () {
  'use strict';

  const DEFAULT_GOAL = 6;
  const MIN_GOAL = 6;
  const MAX_GOAL = 20;
  const STORAGE_PREFIX = 'willena-daily-journal:v3:';
  const LUNA_MODEL = 'gpt-5.6-luna';
  const JOURNAL_API = '/.netlify/functions/journal_api';
  const PROMPT_TEXT = 'Write about your day.';
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
  let draftTimer = null;
  let draftSavePromise = Promise.resolve();
  let errorRetry = null;

  function clampGoal(value) { return Math.max(MIN_GOAL, Math.min(MAX_GOAL, Number(value) || DEFAULT_GOAL)); }
  function configuredGoal() {
    const q = new URLSearchParams(location.search);
    return clampGoal(q.get('goal') || q.get('sentences') || DEFAULT_GOAL);
  }
  function dayKey() {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date()); }
    catch (_) { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  }
  function freshState() {
    return { date:dayKey(), entryId:null, goal:configuredGoal(), originalText:'', sentences:[], status:'draft', reviewIndex:0, speakIndex:0, updatedAt:Date.now(), serverUpdatedAt:null };
  }
  function key() { return `${STORAGE_PREFIX}${userId}:${dayKey()}`; }
  function apiFetch(path, options) {
    const fn = window.WillenaAPI?.fetch ? window.WillenaAPI.fetch.bind(window.WillenaAPI) : window.fetch.bind(window);
    return fn(path, Object.assign({ credentials:'include', cache:'no-store' }, options || {}));
  }

  async function authenticate() {
    const r = await apiFetch('/.netlify/functions/supabase_auth?action=whoami&_=' + Date.now());
    const d = await r.json().catch(() => ({}));
    if (r.ok && d.success && d.user_id) return d.user_id;
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace('/students/signin.html?next=' + next);
    throw new Error('Sign in required');
  }

  async function journalRequest(action, body, method) {
    const verb = method || 'POST';
    const url = `${JOURNAL_API}?action=${encodeURIComponent(action)}${verb === 'GET' ? `&date=${encodeURIComponent(dayKey())}&_=${Date.now()}` : ''}`;
    const options = { method:verb };
    if (verb !== 'GET') {
      options.headers = { 'Content-Type':'application/json' };
      options.body = JSON.stringify(Object.assign({ action }, body || {}));
    }
    const r = await apiFetch(url, options);
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.success === false) {
      const err = new Error(data.error || `Journal request failed (${r.status}).`);
      err.status = r.status;
      throw err;
    }
    return data;
  }

  function loadLocal() {
    try {
      const x = JSON.parse(localStorage.getItem(key()) || 'null');
      return x && x.date === dayKey() ? Object.assign(freshState(), x) : freshState();
    } catch (_) { return freshState(); }
  }
  function saveLocal() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(key(), JSON.stringify(state)); } catch (_) {}
  }
  function clearLocal() { try { localStorage.removeItem(key()); } catch (_) {} }
  function show(which) { ['loading','write','review','speak','done','error'].forEach(k => els[k].hidden = k !== which); }

  function normalizeDbSentence(s) {
    return {
      id:s.id || null,
      order:s.sentence_order || s.order || 0,
      original:String(s.original_sentence ?? s.original ?? ''),
      corrected:String(s.corrected_sentence ?? s.corrected ?? ''),
      changes:Array.isArray(s.changes) ? s.changes : [],
      speechCompleted:!!s.speech_completed,
      speechAttempts:Number(s.speech_attempts) || 0,
      speechBestScore:Number(s.speech_best_score) || 0,
      transcript:''
    };
  }

  function hydrateRemote(journal) {
    if (!journal?.entry) return false;
    const e = journal.entry;
    const meta = e.ai_metadata || {};
    state = freshState();
    state.entryId = e.id;
    state.goal = clampGoal(e.target_sentences);
    state.originalText = e.original_text || '';
    state.status = e.status || 'draft';
    state.reviewIndex = Math.max(0, Number(meta.review_index) || 0);
    state.speakIndex = Math.max(0, Number(meta.speak_index) || 0);
    state.serverUpdatedAt = e.updated_at || null;
    state.sentences = (journal.sentences || []).map(normalizeDbSentence);
    saveLocal();
    return true;
  }

  function countSentences(text) {
    const clean = String(text || '').replace(/\r/g,'\n').trim();
    if (!clean) return 0;
    const lines = clean.split(/\n+/).map(s => s.trim()).filter(s => /[A-Za-z0-9]/.test(s));
    let total = 0;
    lines.forEach(line => {
      const endings = line.match(/[.!?]+(?=\s|$)/g);
      if (endings?.length) {
        total += endings.length;
        const tail = line.split(/[.!?]+/).pop().trim();
        if (tail && /[A-Za-z0-9]/.test(tail)) total += 1;
      } else {
        total += 1;
      }
    });
    return total;
  }

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

  function draftPayload() {
    return {
      entry_id:state.entryId,
      date:state.date,
      prompt_text:PROMPT_TEXT,
      target_sentences:state.goal,
      original_text:state.originalText,
      sentence_count:countSentences(state.originalText)
    };
  }

  function scheduleDraftSave() {
    if (state.status !== 'draft') return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => { void saveDraftRemote(); }, 550);
  }

  async function saveDraftRemote() {
    if (state.status !== 'draft') return state.entryId;
    clearTimeout(draftTimer);
    const payload = draftPayload();
    draftSavePromise = draftSavePromise.catch(() => {}).then(async () => {
      const result = await journalRequest('save_draft', payload);
      if (result.entry?.id) {
        state.entryId = result.entry.id;
        state.serverUpdatedAt = result.entry.updated_at || null;
        saveLocal();
      }
      return state.entryId;
    });
    return draftSavePromise;
  }

  function extractJson(text) {
    const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
    try { return JSON.parse(raw); } catch (_) {}
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('The AI response was not valid JSON.');
  }

  function parseCorrection(raw, expectedText) {
    const parsed = extractJson(raw);
    if (!parsed || !Array.isArray(parsed.sentences) || !parsed.sentences.length) throw new Error('The AI response was incomplete.');
    if (parsed.sentences.length > 100) throw new Error('The AI returned too many sentences.');
    const expectedCount = countSentences(expectedText);
    if (expectedCount > 1 && Math.abs(parsed.sentences.length - expectedCount) > 2) throw new Error('The AI changed the journal structure too much.');
    return parsed.sentences.map((s, i) => {
      if (!s || typeof s.original !== 'string' || typeof s.corrected !== 'string') throw new Error(`The AI response had an invalid sentence ${i + 1}.`);
      const original = s.original.trim();
      const corrected = s.corrected.trim();
      if (!original || !corrected || corrected.length > Math.max(1200, original.length * 4)) throw new Error(`The AI response had an invalid sentence ${i + 1}.`);
      return { order:i+1, original, corrected, changes:Array.isArray(s.changes) ? s.changes : [], speechCompleted:false, speechAttempts:0, speechBestScore:0, transcript:'' };
    });
  }

  function correctionSystemPrompt() {
    return `You are an English writing coach for Korean ESL children. Correct the student's entire diary sentence by sentence. Preserve every fact, feeling, opinion, detail, sentence personality, and age-appropriate word that already works. Make the smallest reasonable changes needed for clear, correct American English. Fix genuine grammar, spelling, capitalization, punctuation, word form, tense, articles, prepositions, and clearly unnatural wording. Never invent, embellish, summarize, moralize, or add details. Never turn child English into polished adult prose. Keep the student's sentence order and sentence boundaries whenever possible. Return ONLY valid JSON with this exact top-level shape: {"sentences":[{"order":1,"original":"exact original sentence","corrected":"minimally corrected sentence","changes":[{"type":"grammar","original":"...","corrected":"...","reason":"very short child-friendly reason"}]}]}. If no correction is needed, corrected must equal original and changes must be []. The original field must reproduce the student's wording for that sentence, not a paraphrase.`;
  }

  function correctionOutput(data) {
    const root = data?.data || data;
    if (root?.error) throw new Error(root.error.message || 'AI correction failed.');
    return root?.choices?.[0]?.message?.content || root?.output_text || root?.output?.map?.(() => '') || '';
  }

  async function callCorrection(text, repairHint) {
    const messages = [
      { role:'system', content:correctionSystemPrompt() },
      { role:'user', content:repairHint ? `${text}\n\nIMPORTANT: Your previous response could not be safely parsed. Return only the required JSON object. Do not add markdown or commentary.` : text }
    ];
    const r = await apiFetch('/.netlify/functions/openai_proxy', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ endpoint:'chat/completions', payload:{ model:LUNA_MODEL, messages, temperature:0.1, max_tokens:3000 } })
    });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) {
      const root = result?.data || result;
      throw new Error(root?.error?.message || `AI correction failed (${r.status}).`);
    }
    return correctionOutput(result);
  }

  async function correctWholeDiary(text) {
    let firstError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callCorrection(text, attempt > 0);
        return parseCorrection(raw, text);
      } catch (e) {
        firstError = firstError || e;
      }
    }
    throw firstError || new Error('Could not safely read the AI correction.');
  }

  async function runCorrection() {
    if (!state.entryId || !state.originalText) throw new Error('Your submitted journal could not be found.');
    state.status = 'correcting';
    saveLocal();
    els.submit.disabled = true;
    els.submit.textContent = 'Checking your English…';
    const corrected = await correctWholeDiary(state.originalText);
    const saved = await journalRequest('save_correction', {
      entry_id:state.entryId,
      sentences:corrected,
      ai_model:LUNA_MODEL,
      ai_metadata:{ corrected_at:new Date().toISOString(), correction_attempts:1 }
    });
    hydrateRemote(saved.journal);
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
    saveLocal();
    els.submit.disabled = true;
    els.submit.textContent = 'Saving…';
    try {
      await saveDraftRemote();
      const submitted = await journalRequest('submit', { entry_id:state.entryId, original_text:text, sentence_count:n });
      state.entryId = submitted.entry.id;
      state.originalText = submitted.entry.original_text;
      state.status = 'correcting';
      state.serverUpdatedAt = submitted.entry.updated_at || null;
      saveLocal();
      await runCorrection();
    } catch (e) {
      const submittedAlready = state.status === 'correcting';
      showError((e.message || 'Could not check your journal.') + (submittedAlready ? ' Your submitted writing is safely saved.' : ' Your draft is still saved.'), submittedAlready ? resumeCorrection : renderWrite, submittedAlready ? 'Try correction again' : 'Back to my writing');
    }
  }

  async function resumeCorrection() {
    show('loading');
    try { await runCorrection(); }
    catch (e) { showError((e.message || 'Could not check your journal.') + ' Your submitted writing is safely saved.', resumeCorrection, 'Try correction again'); }
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

  function persistProgress() {
    if (!state.entryId) return;
    void journalRequest('progress', { entry_id:state.entryId, status:state.status, review_index:state.reviewIndex, speak_index:state.speakIndex }).catch(() => {});
  }
  function nextReview(delta) {
    state.reviewIndex = Math.max(0, Math.min(state.sentences.length - 1, state.reviewIndex + delta));
    saveLocal(); persistProgress(); renderReview();
  }
  function forwardReview() { if (state.reviewIndex >= state.sentences.length - 1) beginSpeaking(); else nextReview(1); }
  function beginSpeaking() { state.status='speaking'; state.speakIndex=Math.max(0,state.speakIndex||0); saveLocal(); persistProgress(); renderSpeak(); }

  function renderSpeak() {
    const s = state.sentences[state.speakIndex];
    if (!s) return finish();
    els.speakTarget.textContent=s.corrected;
    els.speechFeedback.textContent=`Sentence ${state.speakIndex+1} of ${state.sentences.length}`;
    els.speechFeedback.className='speech-feedback';
    els.nextSpeak.hidden=!s.speechCompleted;
    els.micLabel.textContent=speechSupported()?'Tap and speak':'Speech not supported';
    show('speak');
  }

  function speechSupported(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}
  function normalizeSpeech(text){return String(text||'').toLowerCase().replace(/\b(i'm)\b/g,'i am').replace(/\b(can't)\b/g,'can not').replace(/\b(don't)\b/g,'do not').replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();}
  function words(text){return normalizeSpeech(text).split(' ').filter(Boolean);}
  function scoreSpeech(target,heard){const a=words(target),b=words(heard);if(!a.length)return 0;const counts={};b.forEach(w=>counts[w]=(counts[w]||0)+1);let hit=0;a.forEach(w=>{if(counts[w]>0){hit++;counts[w]--;}});return Math.round(hit/a.length*100);}
  function stopMic(){listening=false;els.mic.classList.remove('listening');els.mic.setAttribute('aria-pressed','false');els.micLabel.textContent='Try again';}

  async function persistSpeechAttempt(s, transcript, score, accepted) {
    if (!state.entryId) return;
    try {
      const result = await journalRequest('speech_attempt', {
        entry_id:state.entryId, sentence_order:state.speakIndex+1, transcript,
        normalized_transcript:normalizeSpeech(transcript), match_score:score, accepted
      });
      if (result.sentence) {
        s.id=result.sentence.id; s.speechCompleted=!!result.sentence.speech_completed;
        s.speechAttempts=Number(result.sentence.speech_attempts)||s.speechAttempts;
        s.speechBestScore=Number(result.sentence.speech_best_score)||s.speechBestScore;
      }
      saveLocal();
    } catch (_) {}
  }

  function startMic(){
    if(!speechSupported()){els.speechFeedback.textContent='This browser cannot use speech recognition. You can use the fallback.';els.nextSpeak.hidden=false;return;}
    if(listening&&recognition){recognition.stop();return;}
    const R=window.SpeechRecognition||window.webkitSpeechRecognition;recognition=new R();recognition.lang='en-US';recognition.interimResults=true;recognition.continuous=false;let final='';
    recognition.onstart=()=>{listening=true;els.mic.classList.add('listening');els.mic.setAttribute('aria-pressed','true');els.micLabel.textContent='Listening…';};
    recognition.onresult=e=>{let interim='';for(let i=e.resultIndex;i<e.results.length;i++){const t=e.results[i][0].transcript;if(e.results[i].isFinal)final+=t;else interim+=t;}const heard=(final||interim).trim();if(heard)els.speechFeedback.textContent=`I heard: “${heard}”`;};
    recognition.onerror=()=>{stopMic();const s=state.sentences[state.speakIndex];s.speechAttempts=(s.speechAttempts||0)+1;saveLocal();els.speechFeedback.textContent='I could not hear that clearly. Try again.';if(s.speechAttempts>=2)els.nextSpeak.hidden=false;};
    recognition.onend=()=>{stopMic();if(!final.trim())return;const s=state.sentences[state.speakIndex];const score=scoreSpeech(s.corrected,final);const accepted=score>=80;s.speechAttempts=(s.speechAttempts||0)+1;s.speechBestScore=Math.max(s.speechBestScore||0,score);s.transcript=final.trim();if(accepted){s.speechCompleted=true;els.speechFeedback.textContent=`Nice! I heard: “${final.trim()}”`;els.speechFeedback.className='speech-feedback good';els.nextSpeak.hidden=false;}else{els.speechFeedback.textContent=`I heard: “${final.trim()}” — try it once more.`;if(s.speechAttempts>=3)els.nextSpeak.hidden=false;}saveLocal();void persistSpeechAttempt(s,final.trim(),score,accepted);};
    recognition.start();
  }

  async function fallbackSpeak(){const s=state.sentences[state.speakIndex];if(s){s.speechCompleted=true;s.fallback=true;saveLocal();if(state.entryId)await journalRequest('mark_spoken',{entry_id:state.entryId,sentence_order:state.speakIndex+1}).catch(()=>{});}advanceSpeak();}
  function advanceSpeak(){if(state.speakIndex>=state.sentences.length-1)finish();else{state.speakIndex++;saveLocal();persistProgress();renderSpeak();}}
  async function finish(){
    state.status='completed';saveLocal();
    if(state.entryId)await journalRequest('complete',{entry_id:state.entryId}).catch(()=>{});
    const changed=state.sentences.filter(s=>s.original!==s.corrected).length;const spoken=state.sentences.filter(s=>s.speechCompleted).length;
    els.doneSummary.textContent=`${state.sentences.length} sentences written · ${changed} improved · ${spoken} spoken`;
    els.finished.innerHTML='';state.sentences.forEach((s,i)=>{const d=document.createElement('div');d.textContent=`${i+1}. ${s.corrected}`;els.finished.appendChild(d);});
    els.count.textContent=`${state.sentences.length} / ${state.goal}`;els.bar.style.width='100%';show('done');
  }

  async function reset(){
    if(!confirm(state.status==='completed'?'Start another journal for today?':'Start today’s journal again?'))return;
    if(state.entryId&&state.status!=='completed')await journalRequest('reset',{entry_id:state.entryId}).catch(()=>{});
    clearLocal();state=freshState();saveLocal();renderWrite();
  }

  function showError(msg,retryFn,retryLabel){errorRetry=retryFn||renderWrite;els.errorText.textContent=msg;els.retry.textContent=retryLabel||'Back to my writing';show('error');}

  function wire(){
    els.input.addEventListener('input',()=>{if(state.status!=='draft')return;state.originalText=els.input.value;saveLocal();updateWritingProgress();scheduleDraftSave();});
    els.submit.addEventListener('click',submitDiary);
    els.reviewBack.addEventListener('click',()=>nextReview(-1));
    els.reviewNext.addEventListener('click',forwardReview);
    els.mic.addEventListener('click',startMic);
    els.skipSpeak.addEventListener('click',()=>void fallbackSpeak());
    els.nextSpeak.addEventListener('click',advanceSpeak);
    els.restart.addEventListener('click',()=>void reset());
    els.retry.addEventListener('click',()=>{const fn=errorRetry||renderWrite;errorRetry=null;fn();});
    window.addEventListener('pagehide',()=>{saveLocal();if(state.status==='draft')void saveDraftRemote();});
  }

  async function boot(){
    try{
      userId=await authenticate();
      const local=loadLocal();
      let remote=null;
      try{remote=await journalRequest('today',null,'GET');}catch(e){if(e.status===401)throw e;}
      if(remote?.journal){hydrateRemote(remote.journal);}
      else{
        state=local;
        state.goal=clampGoal(state.goal||configuredGoal());
        if(state.originalText&&state.status==='draft')await saveDraftRemote().catch(()=>{});
      }
      wire();app.setAttribute('aria-busy','false');
      if(state.status==='completed')finish();
      else if(state.status==='correcting')resumeCorrection();
      else if(state.status==='review'&&state.sentences.length)renderReview();
      else if(state.status==='speaking'&&state.sentences.length)renderSpeak();
      else renderWrite();
    }catch(e){if(!/Sign in required/.test(e.message||''))showError(e.message||'Could not open your journal.',()=>location.reload(),'Try again');}
  }
  boot();
})();
