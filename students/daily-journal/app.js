(function () {
  'use strict';

  const DEFAULT_GOAL = 6;
  const STORAGE_PREFIX = 'willena-daily-journal:v1:';
  const app = document.getElementById('journalApp');
  const els = {
    loading: document.getElementById('loadingCard'),
    write: document.getElementById('writeCard'),
    review: document.getElementById('reviewCard'),
    speak: document.getElementById('speakCard'),
    done: document.getElementById('doneCard'),
    error: document.getElementById('errorCard'),
    errorText: document.getElementById('errorText'),
    input: document.getElementById('sentenceInput'),
    check: document.getElementById('checkBtn'),
    sentenceNumber: document.getElementById('sentenceNumber'),
    original: document.getElementById('originalText'),
    corrected: document.getElementById('correctedText'),
    note: document.getElementById('correctionNote'),
    keep: document.getElementById('keepBtn'),
    use: document.getElementById('useBtn'),
    speakTarget: document.getElementById('speakTarget'),
    mic: document.getElementById('micBtn'),
    micLabel: document.getElementById('micLabel'),
    speechFeedback: document.getElementById('speechFeedback'),
    skipSpeak: document.getElementById('skipSpeakBtn'),
    next: document.getElementById('nextBtn'),
    count: document.getElementById('progressCount'),
    bar: document.getElementById('progressBar'),
    doneSummary: document.getElementById('doneSummary'),
    finished: document.getElementById('finishedSentences'),
    restart: document.getElementById('newJournalBtn'),
    retry: document.getElementById('retryBtn')
  };

  let userId = null;
  let state = createState();
  let pendingCorrection = null;
  let recognition = null;
  let isListening = false;

  function todayKey() {
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
  }

  function createState() {
    return { date: todayKey(), goal: DEFAULT_GOAL, sentences: [], draft: '', completed: false, updatedAt: Date.now() };
  }

  function storageKey() {
    return STORAGE_PREFIX + userId + ':' + todayKey();
  }

  function apiFetch(path, options) {
    const fn = window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function'
      ? window.WillenaAPI.fetch.bind(window.WillenaAPI)
      : window.fetch.bind(window);
    return fn(path, Object.assign({ credentials: 'include', cache: 'no-store' }, options || {}));
  }

  async function authenticate() {
    let response = await apiFetch('/.netlify/functions/supabase_auth?action=whoami&_=' + Date.now());
    let data = await response.json().catch(() => ({}));
    if (response.ok && data.success && data.user_id) return data.user_id;

    const refresh = await apiFetch('/.netlify/functions/supabase_auth?action=refresh&_=' + Date.now()).catch(() => null);
    const refreshed = refresh ? await refresh.json().catch(() => ({})) : {};
    if (refresh && refresh.ok && refreshed.success && refreshed.access_token && window.WillenaAPI?.setLocalTokens) {
      window.WillenaAPI.setLocalTokens(refreshed.access_token, '');
      response = await apiFetch('/.netlify/functions/supabase_auth?action=whoami&_=' + Date.now());
      data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.user_id) return data.user_id;
    }

    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    location.replace('/students/signin.html?next=' + next);
    throw new Error('Sign in required.');
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(storageKey());
      if (!raw) return createState();
      const saved = JSON.parse(raw);
      if (!saved || saved.date !== todayKey() || !Array.isArray(saved.sentences)) return createState();
      return Object.assign(createState(), saved, { goal: Number(saved.goal) || DEFAULT_GOAL });
    } catch (_) {
      return createState();
    }
  }

  function saveState() {
    state.updatedAt = Date.now();
    try { localStorage.setItem(storageKey(), JSON.stringify(state)); } catch (_) {}
  }

  function show(name) {
    ['loading', 'write', 'review', 'speak', 'done', 'error'].forEach(key => {
      if (els[key]) els[key].hidden = key !== name;
    });
  }

  function updateProgress() {
    const done = state.sentences.length;
    els.count.textContent = done + ' / ' + state.goal;
    els.bar.style.width = Math.min(100, (done / state.goal) * 100) + '%';
    els.sentenceNumber.textContent = Math.min(state.goal, done + 1);
  }

  function renderWrite() {
    if (state.completed || state.sentences.length >= state.goal) return finishJournal();
    pendingCorrection = null;
    updateProgress();
    els.input.value = state.draft || '';
    show('write');
    setTimeout(() => els.input.focus(), 70);
  }

  function normalizeSpaces(text) {
    return String(text || '').trim().replace(/\s+/g, ' ');
  }

  function cleanupModelText(text) {
    return String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  function parseCorrection(content, original) {
    const cleaned = cleanupModelText(content);
    try {
      const parsed = JSON.parse(cleaned);
      return {
        corrected: normalizeSpaces(parsed.corrected || parsed.sentence || original),
        note: normalizeSpaces(parsed.note || '')
      };
    } catch (_) {
      const line = cleaned.split('\n').map(s => s.trim()).find(Boolean) || original;
      return { corrected: normalizeSpaces(line.replace(/^corrected\s*:\s*/i, '')), note: '' };
    }
  }

  async function correctSentence(original) {
    const systemPrompt = [
      'You are an English writing coach for Korean ESL children.',
      'Correct one student sentence while preserving the student\'s exact intended meaning, personality, details, and emotional tone.',
      'Make the smallest useful correction. Do not make the sentence more sophisticated unless necessary for natural English.',
      'Use American English.',
      'Never add facts or ideas the student did not write.',
      'If the sentence is already natural and correct, return it unchanged.',
      'Return ONLY compact JSON with exactly two string fields: corrected and note.',
      'The note should be very short and child-friendly. If no correction is needed, note should say: Looks good!'
    ].join(' ');

    const response = await apiFetch('/.netlify/functions/openai_proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'chat/completions',
        payload: {
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: original }
          ],
          temperature: 0.15,
          max_tokens: 180
        }
      })
    });

    if (!response.ok) throw new Error('AI check failed (' + response.status + ').');
    const result = await response.json();
    const data = result && result.data ? result.data : result;
    if (data.error) throw new Error(data.error.message || 'AI check failed.');
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('The AI returned no correction.');
    return parseCorrection(content, original);
  }

  async function checkCurrentSentence() {
    const original = normalizeSpaces(els.input.value);
    if (!original) {
      els.input.focus();
      return;
    }
    state.draft = original;
    saveState();
    els.check.disabled = true;
    els.check.textContent = 'Checking…';
    try {
      const result = await correctSentence(original);
      pendingCorrection = { original, corrected: result.corrected || original, note: result.note || '' };
      els.original.textContent = original;
      els.corrected.textContent = pendingCorrection.corrected;
      els.note.textContent = pendingCorrection.note;
      show('review');
    } catch (error) {
      showError(error.message || 'Could not check the sentence.');
    } finally {
      els.check.disabled = false;
      els.check.textContent = 'Check my sentence';
    }
  }

  function chooseSentence(useCorrection) {
    if (!pendingCorrection) return;
    const finalText = useCorrection ? pendingCorrection.corrected : pendingCorrection.original;
    const entry = {
      original: pendingCorrection.original,
      corrected: pendingCorrection.corrected,
      final: finalText,
      usedCorrection: !!useCorrection,
      note: pendingCorrection.note || '',
      spoken: false,
      transcript: '',
      createdAt: Date.now()
    };
    state.sentences.push(entry);
    state.draft = '';
    saveState();
    updateProgress();
    openSpeaking(entry);
  }

  function openSpeaking(entry) {
    els.speakTarget.textContent = entry.final;
    els.speechFeedback.textContent = 'Read the sentence out loud.';
    els.speechFeedback.className = 'speech-feedback';
    els.next.hidden = true;
    els.mic.disabled = false;
    els.micLabel.textContent = speechRecognitionSupported() ? 'Tap and speak' : 'Speaking is not supported on this browser';
    show('speak');
  }

  function speechRecognitionSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  function simplifyForMatch(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function speechScore(target, heard) {
    const targetWords = simplifyForMatch(target).split(' ').filter(Boolean);
    const heardWords = new Set(simplifyForMatch(heard).split(' ').filter(Boolean));
    if (!targetWords.length) return 0;
    return Math.round((targetWords.filter(w => heardWords.has(w)).length / targetWords.length) * 100);
  }

  function stopRecognitionUI() {
    isListening = false;
    els.mic.classList.remove('listening');
    els.mic.setAttribute('aria-pressed', 'false');
    els.micLabel.textContent = 'Try again';
  }

  function startSpeaking() {
    if (!speechRecognitionSupported()) {
      els.speechFeedback.textContent = 'Your browser does not support speech recognition. You can skip this step.';
      els.next.hidden = false;
      return;
    }
    if (isListening && recognition) {
      recognition.stop();
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new Recognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    let finalTranscript = '';

    recognition.onstart = function () {
      isListening = true;
      els.mic.classList.add('listening');
      els.mic.setAttribute('aria-pressed', 'true');
      els.micLabel.textContent = 'Listening…';
      els.speechFeedback.textContent = 'Go ahead.';
      els.speechFeedback.className = 'speech-feedback';
    };

    recognition.onresult = function (event) {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += piece;
        else interim += piece;
      }
      const heard = normalizeSpaces(finalTranscript || interim);
      if (heard) els.speechFeedback.textContent = 'I heard: “' + heard + '”';
    };

    recognition.onerror = function (event) {
      stopRecognitionUI();
      const friendly = event.error === 'not-allowed'
        ? 'Microphone permission is off. You can allow it or skip speaking.'
        : 'I could not hear that clearly. Try again.';
      els.speechFeedback.textContent = friendly;
      els.next.hidden = false;
    };

    recognition.onend = function () {
      stopRecognitionUI();
      const heard = normalizeSpaces(finalTranscript);
      if (!heard) {
        if (!els.speechFeedback.textContent.startsWith('Microphone')) {
          els.speechFeedback.textContent = 'I did not catch that. Try again.';
        }
        els.next.hidden = false;
        return;
      }
      const entry = state.sentences[state.sentences.length - 1];
      const score = speechScore(entry.final, heard);
      entry.spoken = true;
      entry.transcript = heard;
      entry.speechMatch = score;
      saveState();
      if (score >= 70) {
        els.speechFeedback.textContent = 'Nice! I heard: “' + heard + '”';
        els.speechFeedback.className = 'speech-feedback good';
      } else {
        els.speechFeedback.textContent = 'I heard: “' + heard + '” — you can try once more or continue.';
      }
      els.next.hidden = false;
    };

    recognition.start();
  }

  function skipSpeaking() {
    const entry = state.sentences[state.sentences.length - 1];
    if (entry) {
      entry.spoken = false;
      entry.skippedSpeaking = true;
      saveState();
    }
    advance();
  }

  function advance() {
    if (state.sentences.length >= state.goal) finishJournal();
    else renderWrite();
  }

  function finishJournal() {
    state.completed = true;
    state.draft = '';
    saveState();
    updateProgress();
    els.doneSummary.textContent = 'You finished ' + state.sentences.length + ' sentences today.';
    els.finished.innerHTML = '';
    state.sentences.forEach((entry, index) => {
      const row = document.createElement('div');
      row.textContent = (index + 1) + '. ' + entry.final;
      els.finished.appendChild(row);
    });
    show('done');
  }

  function resetJournal() {
    if (!confirm('Start today\'s journal again? Your current browser copy will be replaced.')) return;
    state = createState();
    saveState();
    renderWrite();
  }

  function showError(message) {
    els.errorText.textContent = message || 'Please try again.';
    show('error');
  }

  function wireEvents() {
    els.input.addEventListener('input', function () {
      state.draft = els.input.value;
      saveState();
    });
    els.check.addEventListener('click', checkCurrentSentence);
    els.keep.addEventListener('click', () => chooseSentence(false));
    els.use.addEventListener('click', () => chooseSentence(true));
    els.mic.addEventListener('click', startSpeaking);
    els.skipSpeak.addEventListener('click', skipSpeaking);
    els.next.addEventListener('click', advance);
    els.restart.addEventListener('click', resetJournal);
    els.retry.addEventListener('click', renderWrite);
  }

  async function boot() {
    try {
      userId = await authenticate();
      state = loadState();
      wireEvents();
      updateProgress();
      app.setAttribute('aria-busy', 'false');
      if (state.completed || state.sentences.length >= state.goal) finishJournal();
      else renderWrite();
    } catch (error) {
      if (!/Sign in required/.test(error.message || '')) showError(error.message || 'Could not open your journal.');
    }
  }

  boot();
})();
