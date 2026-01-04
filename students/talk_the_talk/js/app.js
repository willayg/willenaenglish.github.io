/**
 * Talk the Talk - Speech Recording & Grammar Correction App
 * Messenger-style UI for elementary English learners
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
    chatArea: document.getElementById('chatArea'),
    statusBar: document.getElementById('statusBar'),
    statusText: document.getElementById('statusText'),
    timerDisplay: document.getElementById('timerDisplay'),
    timerValue: document.getElementById('timerValue')
  };

  // ─────────────────────────────────────────────
  // State
  // ─────────────────────────────────────────────
  let mediaRecorder = null;
  let audioChunks = [];
  let timerInterval = null;
  let timeRemaining = CONFIG.maxRecordingTime;
  let selectedMimeType = null;
  let isRecording = false;
  let processingTypingEl = null;

  // ─────────────────────────────────────────────
  // Initialize
  // ─────────────────────────────────────────────
  function init() {
    // Find supported MIME type
    selectedMimeType = CONFIG.mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    
    if (!selectedMimeType) {
      showStatus('Your browser does not support audio recording.', 'error');
      elements.recordBtn.disabled = true;
      return;
    }

    console.log('[TalkTheTalk] Using MIME type:', selectedMimeType);

    // Attach event listener - single button toggles record/stop
    elements.recordBtn.addEventListener('click', toggleRecording);
  }

  // ─────────────────────────────────────────────
  // Toggle Recording
  // ─────────────────────────────────────────────
  function toggleRecording() {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
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
      isRecording = true;
      
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
      elements.recordBtn.classList.add('recording');
      showStatus('Recording... Speak now!', 'recording');

      // Start countdown timer
      startTimer();

    } catch (err) {
      console.error('[TalkTheTalk] Microphone error:', err);
      isRecording = false;
      
      if (err.name === 'NotAllowedError') {
        showStatus('Microphone access denied. Please allow microphone.', 'error');
      } else if (err.name === 'NotFoundError') {
        showStatus('No microphone found.', 'error');
      } else {
        showStatus('Could not start recording.', 'error');
      }
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      clearInterval(timerInterval);
      mediaRecorder.stop();
      isRecording = false;
      
      elements.recordBtn.classList.remove('recording');
      hideStatus();
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
      showStatus('No audio recorded. Try again.', 'error');
      return;
    }

    // Create audio blob
    const audioBlob = new Blob(audioChunks, { type: selectedMimeType });
    
    console.log('[TalkTheTalk] Audio blob size:', audioBlob.size, 'bytes');

    if (audioBlob.size < 1000) {
      showStatus('Recording too short. Please speak longer.', 'error');
      return;
    }

    // Send to server
    await sendAudioForAnalysis(audioBlob);
  }

  async function sendAudioForAnalysis(audioBlob) {
    processingTypingEl = showTeacherTyping(processingTypingEl);

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
        const code = errorData.code;

        if (code === 'UNSUPPORTED_REGION') {
          throw new Error('Speech service is unavailable on this network. Try switching networks or disabling VPN and try again.');
        }

        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('[TalkTheTalk] API response:', data);

      // Display results as chat messages
      clearTeacherTyping(processingTypingEl);
      processingTypingEl = null;
      await displayResults(data);

    } catch (err) {
      console.error('[TalkTheTalk] API error:', err);
      showStatus(err.message || 'Something went wrong. Try again.', 'error');
    } finally {
      clearTeacherTyping(processingTypingEl);
      processingTypingEl = null;
    }
  }

  // ─────────────────────────────────────────────
  // UI Functions
  // ─────────────────────────────────────────────
  async function displayResults(data) {
    const transcript = data.transcript || '(no speech detected)';
    const corrected = data.corrected_sentence || data.transcript || '';
    const teacherNote = data.teacher_note || '';
    
    // Add student message (what they said)
    addMessage(transcript, 'student', 'You said');

    // Always show the correct sentence first (only when it differs).
    const hasCorrection =
      corrected &&
      transcript &&
      corrected.trim() &&
      transcript.trim() &&
      corrected.trim().toLowerCase() !== transcript.trim().toLowerCase();

    if (hasCorrection) {
      await delay(220);
      addMessage(corrected, 'correction', 'Correct sentence');
    }

    // Then show a chat-style typing indicator, followed by the teacher comment.
    await delay(220);
    const typingEl = showTeacherTyping(null);
    await delay(900);
    clearTeacherTyping(typingEl);

    addMessage(teacherNote || 'Good job! Keep practicing!', 'teacher', 'Teacher');
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showTeacherTyping(existingEl) {
    if (existingEl && existingEl.isConnected) {
      return existingEl;
    }

    const message = document.createElement('div');
    message.className = 'message teacher typing';
    message.setAttribute('aria-label', 'Teacher is typing');

    const dots = document.createElement('div');
    dots.className = 'typing-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    message.appendChild(dots);

    elements.chatArea.appendChild(message);
    elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
    return message;
  }

  function clearTeacherTyping(el) {
    if (el && el.isConnected) {
      el.remove();
    }
  }

  function addMessage(text, type, label) {
    const message = document.createElement('div');
    message.className = `message ${type}`;
    
    if (label) {
      const labelEl = document.createElement('div');
      labelEl.className = 'message-label';
      labelEl.textContent = label;
      message.appendChild(labelEl);
    }
    
    const textEl = document.createElement('div');
    textEl.className = 'message-text';
    textEl.textContent = text;
    message.appendChild(textEl);
    
    elements.chatArea.appendChild(message);
    
    // Scroll to bottom
    elements.chatArea.scrollTop = elements.chatArea.scrollHeight;
  }

  function showStatus(message, type = '') {
    elements.statusText.textContent = message;
    elements.statusBar.hidden = false;
    elements.statusBar.className = 'status-bar';
    if (type) {
      elements.statusBar.classList.add(type);
    }
  }

  function hideStatus() {
    elements.statusBar.hidden = true;
  }

  // Loading overlay removed intentionally (no spinner UX).

  // ─────────────────────────────────────────────
  // Start App
  // ─────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
