/**
 * Talk the Talk - Speech Recording & Grammar Correction App
 * For elementary English learners
 */

(function () {
  'use strict';

  // ─────────────────────────────────────────────
  // Configuration
  // ─────────────────────────────────────────────
  const CONFIG = {
    maxRecordingTime: 15,           // seconds
    apiEndpoint: '/api/analyze-sentence',
    mimeTypes: [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ]
  };

  // ─────────────────────────────────────────────
  // DOM Elements
  // ─────────────────────────────────────────────
  const elements = {
    recordBtn: document.getElementById('recordBtn'),
    stopBtn: document.getElementById('stopBtn'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerValue: document.getElementById('timerValue'),
    status: document.getElementById('status'),
    results: document.getElementById('results'),
    transcript: document.getElementById('transcript'),
    corrected: document.getElementById('corrected'),
    teacherNote: document.getElementById('teacherNote'),
    tryAgainBtn: document.getElementById('tryAgainBtn'),
    loadingOverlay: document.getElementById('loadingOverlay')
  };

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  let mediaRecorder = null;
  let audioChunks = [];
  let timerInterval = null;
  let timeRemaining = CONFIG.maxRecordingTime;
  let selectedMimeType = null;

  // ─────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────
  function init() {
    // Find supported MIME type
    selectedMimeType = CONFIG.mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    
    if (!selectedMimeType) {
      setStatus('❌ Your browser does not support audio recording.', 'error');
      elements.recordBtn.disabled = true;
      return;
    }

    console.log('[TalkTheTalk] Using MIME type:', selectedMimeType);

    // Attach event listeners
    elements.recordBtn.addEventListener('click', startRecording);
    elements.stopBtn.addEventListener('click', stopRecording);
    elements.tryAgainBtn.addEventListener('click', resetUI);
  }

  // ─────────────────────────────────────────────
  // Recording Functions
  // ─────────────────────────────────────────────
  async function startRecording() {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Reset state
      audioChunks = [];
      timeRemaining = CONFIG.maxRecordingTime;
      
      // Create MediaRecorder
      mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        handleRecordingComplete();
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      
      // Update UI
      elements.recordBtn.disabled = true;
      elements.recordBtn.classList.add('recording');
      elements.stopBtn.disabled = false;
      elements.timerDisplay.classList.add('active');
      setStatus('🎤 Recording... Speak now!', 'recording');
      hideResults();

      // Start countdown timer
      startTimer();

    } catch (err) {
      console.error('[TalkTheTalk] Microphone error:', err);
      
      if (err.name === 'NotAllowedError') {
        setStatus('🚫 Microphone access denied. Please allow microphone.', 'error');
      } else if (err.name === 'NotFoundError') {
        setStatus('🎤 No microphone found.', 'error');
      } else {
        setStatus('❌ Could not start recording.', 'error');
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      clearInterval(timerInterval);
      mediaRecorder.stop();
      
      elements.recordBtn.classList.remove('recording');
      elements.stopBtn.disabled = true;
      elements.timerDisplay.classList.remove('active');
    }
  }

  function startTimer() {
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
      timeRemaining--;
      updateTimerDisplay();
      
      if (timeRemaining <= 0) {
        stopRecording();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    elements.timerValue.textContent = timeRemaining;
  }

  // ─────────────────────────────────────────────
  // Process Recording
  // ─────────────────────────────────────────────
  async function handleRecordingComplete() {
    if (audioChunks.length === 0) {
      setStatus('⚠️ No audio recorded. Try again.', 'error');
      resetControls();
      return;
    }

    // Create audio blob
    const audioBlob = new Blob(audioChunks, { type: selectedMimeType });
    
    console.log('[TalkTheTalk] Audio blob size:', audioBlob.size, 'bytes');

    if (audioBlob.size < 1000) {
      setStatus('⚠️ Recording too short. Please speak longer.', 'error');
      resetControls();
      return;
    }

    // Send to server
    await sendAudioForAnalysis(audioBlob);
  }

  async function sendAudioForAnalysis(audioBlob) {
    setStatus('🤔 Processing your speech...', 'processing');
    showLoading();

    try {
      // Prepare form data
      const formData = new FormData();
      
      // Determine file extension from MIME type
      let ext = 'webm';
      if (selectedMimeType.includes('mp4')) ext = 'mp4';
      else if (selectedMimeType.includes('ogg')) ext = 'ogg';
      
      formData.append('audio', audioBlob, `recording.${ext}`);

      // Send to API
      const response = await fetch(CONFIG.apiEndpoint, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[TalkTheTalk] API response:', data);

      // Display results
      displayResults(data);
      setStatus('✅ Done! Check your results below.', 'success');

    } catch (err) {
      console.error('[TalkTheTalk] API error:', err);
      setStatus(`❌ ${err.message || 'Something went wrong. Try again.'}`, 'error');
      resetControls();
    } finally {
      hideLoading();
    }
  }

  // ─────────────────────────────────────────────
  // UI Functions
  // ─────────────────────────────────────────────
  function displayResults(data) {
    elements.transcript.textContent = data.transcript || '(no speech detected)';
    elements.corrected.textContent = data.corrected_sentence || data.transcript || '';
    elements.teacherNote.textContent = data.teacher_note || 'Good job trying!';
    
    elements.results.hidden = false;
    elements.tryAgainBtn.hidden = false;
  }

  function hideResults() {
    elements.results.hidden = true;
    elements.tryAgainBtn.hidden = true;
  }

  function setStatus(message, type = '') {
    elements.status.textContent = message;
    elements.status.className = 'status';
    if (type) {
      elements.status.classList.add(type);
    }
  }

  function showLoading() {
    elements.loadingOverlay.hidden = false;
  }

  function hideLoading() {
    elements.loadingOverlay.hidden = true;
  }

  function resetControls() {
    elements.recordBtn.disabled = false;
    elements.recordBtn.classList.remove('recording');
    elements.stopBtn.disabled = true;
    elements.timerDisplay.classList.remove('active');
    timeRemaining = CONFIG.maxRecordingTime;
    updateTimerDisplay();
  }

  function resetUI() {
    hideResults();
    resetControls();
    setStatus('Tap Record to start!', '');
  }

  // ─────────────────────────────────────────────
  // Start App
  // ─────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
