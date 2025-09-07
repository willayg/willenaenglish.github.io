// Reusable c    const res = await fetch(FN('supabase_auth') + '?action=whoami', {ient-side tracker for student activity and per-word attempts
// Works with Netlify function: /.netlify/functions/log_word_attempt
import { FN } from './scripts/api-base.js';

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
      schedulePointsRefresh();
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
      alert('You are not signed in. Please log in to earn points.');
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
    if (res.status === 401) alert('Not signed in. Please log in to earn points.');
    else alert(`Logging failed: ${res.status} - ${txt}`);
    } else {
      // Optimistic: bump local points immediately for responsive UI
      try {
        const inc = typeof points === 'number' ? points : 0;
        if (inc > 0) {
      const current = Number(localStorage.getItem('user_points') || '0') || 0;
      const next = current + inc;
      localStorage.setItem('user_points', String(next));
          // Mark the time of the last optimistic increment to prevent immediate decreases
          localStorage.setItem('user_points_last_inc_at', String(Date.now()));
          const header = document.querySelector('student-header');
          if (header && typeof header.refresh === 'function') header.refresh();
        }
      } catch {}
      // Attempt logged successfully; refresh points soon
      schedulePointsRefresh();
    }
  } catch (e) {
    console.debug('attempt log skipped:', e?.message);
  }
}

// Convenience: track a batch of attempts sequentially (no await between)
export function logBatch(attempts = []) {
  for (const a of attempts) logAttempt(a);
}

// ------ Lightweight points refresher ------
let __pointsRefreshTimer = null;
async function refreshPointsFromOverview() {
  try {
    const res = await fetch(FN('progress_summary') + '?section=overview', { credentials: 'include', cache: 'no-store' });
    if (!res.ok) return;
    const ov = await res.json().catch(() => null);
    if (ov && typeof ov.points === 'number') {
      // Overwrite with server value, but avoid decreases within a short window after an optimistic bump
      const NO_DECREASE_MS = 20000; // 20s grace
      const now = Date.now();
      const current = Number(localStorage.getItem('user_points') || '0') || 0;
      const lastIncAt = Number(localStorage.getItem('user_points_last_inc_at') || '0') || 0;
      const withinWindow = lastIncAt && (now - lastIncAt) < NO_DECREASE_MS;
      if (!(withinWindow && ov.points < current)) {
        localStorage.setItem('user_points', String(ov.points));
      }
      // Proactively refresh header component in this tab
      const header = document.querySelector('student-header');
      if (header && typeof header.refresh === 'function') header.refresh();
    }
  } catch {}
}

function schedulePointsRefresh(delayMs = 800) {
  if (__pointsRefreshTimer) return; // debounce
  __pointsRefreshTimer = setTimeout(() => {
    __pointsRefreshTimer = null;
    refreshPointsFromOverview();
  }, delayMs);
}
