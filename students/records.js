// Reusable client-side tracker for student activity and per-word attempts
// Works with Netlify function: /.netlify/functions/log_word_attempt

const ENDPOINT = '/.netlify/functions/log_word_attempt';

function genId(prefix = 'wa') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getUserId() {
  const userId = 
    localStorage.getItem('user_id') ||
    sessionStorage.getItem('user_id') ||
    localStorage.getItem('userId') ||
    sessionStorage.getItem('userId') ||
    localStorage.getItem('student_id') ||
    sessionStorage.getItem('student_id') ||
    localStorage.getItem('profile_id') ||
    sessionStorage.getItem('profile_id') ||
    localStorage.getItem('id') ||
    sessionStorage.getItem('id');
  
  // Return null if it's a placeholder string or empty
  if (!userId || userId === '<your-supabase-user-uuid>' || userId.includes('<') || userId.includes('>')) {
    return null;
  }
  
  return userId;
}

// Start a logical game session (per mode run). Returns sessionId immediately.
export function startSession({ mode, wordList = [], listName = null, meta = {} } = {}) {
  const sessionId = genId('session');
  const payload = {
    event_type: 'session_start',
    session_id: sessionId,
    mode: mode || 'unknown',
    list_name: listName,
    list_size: Array.isArray(wordList) ? wordList.length : null,
    user_id: getUserId(),
    extra: meta || {}
  };
  // Fire and forget; do not block UI
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch((e) => console.debug('session_start log skipped:', e?.message));
  return sessionId;
}

export async function endSession(sessionId, { mode, summary = {} } = {}) {
  if (!sessionId) return;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'session_end',
        session_id: sessionId,
        mode: mode || 'unknown',
        user_id: getUserId(),
        extra: summary
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('❌ SESSION_END LOG FAILED:', res.status, txt);
      alert(`Session end logging failed: ${res.status} - ${txt}`);
    }
  } catch (e) {
    console.debug('session_end log skipped:', e?.message);
  }
}

// Log a single attempt for a word/question
export async function logAttempt({
  session_id,
  mode,
  word,
  is_correct,
  answer = null,
  correct_answer = null,
  points = null,
  attempt_index = null,
  duration_ms = null,
  round = null,
  extra = {}
} = {}) {
  try {
    const user_id = getUserId();
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'attempt',
        user_id,
        session_id,
        mode,
        word,
        is_correct,
        answer,
        correct_answer,
        points,
        attempt_index,
        duration_ms,
        round,
        extra
      })
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.error('❌ ATTEMPT LOG FAILED:', res.status, txt);
      // Also alert for immediate visibility
      alert(`Logging failed: ${res.status} - ${txt}`);
    }
  } catch (e) {
    console.debug('attempt log skipped:', e?.message);
  }
}

// Convenience: track a batch of attempts sequentially (no await between)
export function logBatch(attempts = []) {
  for (const a of attempts) logAttempt(a);
}
