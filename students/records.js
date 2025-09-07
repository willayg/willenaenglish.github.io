// Reusable client-side tracker for student activity and per-word attempts
// Works with Netlify function: /.netlify/functions/log_word_attempt
import { FN } from './scripts/api-base.js';
import { scheduleRefresh } from './scripts/points-client.js';
// Optional shared points helpers (non-breaking):
// Shared points helpers: standardize optimistic bump and debounced server refresh
// Scoreless build: no points helpers

const ENDPOINT = FN('log_word_attempt');

// Auth: derive user id from secure HTTP-only cookies via whoami endpoint.
// We do NOT read tokens from localStorage or sessionStorage.
let __userId = null;
let __whoamiPromise = null;

async function fetchWhoAmI() {
  try {
  const res = await fetch('/.netlify/functions/supabase_auth?action=whoami', {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const js = await res.json().catch(() => ({}));
    return (js && js.user_id) || null;
  } catch {
    return null;
  }
}

function kickOffWhoAmI() {
  if (!__whoamiPromise) {
    __whoamiPromise = fetchWhoAmI().then(id => { __userId = id; return id; }).catch(() => null);
  }
  return __whoamiPromise;
}

function genId(prefix = 'wa') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Synchronous getter used by logging; returns cached id (may be null on first call).
export function getUserId() { return __userId; }

// Optional async helper for callers that want to ensure best-effort id resolution.
export async function ensureUserId() { return (__userId ?? (await kickOffWhoAmI())); }

// Start a logical game session (per mode run). Returns sessionId immediately.
export function startSession({ mode, wordList = [], listName = null, meta = {} } = {}) {
  const sessionId = genId('session');
  // Eagerly kick off whoami in background so user_id is likely available soon
  kickOffWhoAmI();
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
    credentials: 'include',
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
  credentials: 'include',
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
    } else {
  // On success, refresh points in header/profile (debounced)
  scheduleRefresh();
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
    // Ensure cookies are sent; also kick whoami if not yet done
    kickOffWhoAmI();
    let user_id = getUserId();
    // If not yet signed in, try a one-time cookie refresh then re-check
    if (!user_id) {
      try { await fetch(FN('supabase_auth') + '?action=refresh', { credentials: 'include', cache: 'no-store' }); } catch {}
      await new Promise(r => setTimeout(r, 200));
      user_id = await ensureUserId();
    }
    if (!user_id) {
  alert('You are not signed in. Please log in.');
      return;
    }
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
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
  if (res.status === 401) alert('Not signed in. Please log in.');
    else alert(`Logging failed: ${res.status} - ${txt}`);
    } else {
      // Apply server-authoritative total if provided
      try {
        const js = await res.json().catch(() => null);
        if (js && typeof js.points_total === 'number') {
          // Stop persisting points in localStorage; use events + server refresh only
          try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: js.points_total } })); } catch {}
          scheduleRefresh();
          return;
        }
      } catch {}
      // If server didn’t send total, do a tiny optimistic bump only for correct answers
      try {
  // Avoid unexpected large defaults; only emit an event so header can refetch
  if (is_correct) scheduleRefresh(0);
      } catch {}
    }
  } catch (e) {
    console.debug('attempt log skipped:', e?.message);
  }
}

// Convenience: track a batch of attempts sequentially (no await between)
export function logBatch(attempts = []) {
  for (const a of attempts) logAttempt(a);
}

// Scoreless build: no points refresh

