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
let __authResolved = false; // becomes true after first successful authenticated write
const __pendingAttempts = [];
let __flushScheduled = false;
const __pendingSessionEnd = new Map(); // sessionId -> payload for retry

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
    kickOffWhoAmI();
    const uid = getUserId();
    if (!uid) {
      // Defer until auth; store minimal payload
      __pendingSessionEnd.set(sessionId, { session_id: sessionId, mode: mode || 'unknown', extra: summary, tries: 0 });
      scheduleAuthFlush();
      return;
    }
    await sendSessionEnd({ session_id: sessionId, mode: mode || 'unknown', extra: summary, user_id: uid });
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
    // If we do not yet have a user id, enqueue the attempt for a deferred flush.
    if (!user_id) {
      __pendingAttempts.push({ session_id, mode, word, is_correct, answer, correct_answer, points, attempt_index, duration_ms, round, extra, _ts: Date.now() });
      // Prevent unbounded growth (keep last 50)
      while (__pendingAttempts.length > 50) __pendingAttempts.shift();
      scheduleAuthFlush();
      return; // Silent – do not distract player.
    }
    await sendAttempt({ user_id, session_id, mode, word, is_correct, answer, correct_answer, points, attempt_index, duration_ms, round, extra });
  } catch (e) {
    console.debug('attempt log skipped:', e?.message);
  }
}

// Convenience: track a batch of attempts sequentially (no await between)
export function logBatch(attempts = []) {
  for (const a of attempts) logAttempt(a);
}

// Scoreless build: no points refresh

// ---- Internal helpers for deferred auth & queued attempts -----------------

function scheduleAuthFlush() {
  if (__flushScheduled) return;
  __flushScheduled = true;
  setTimeout(() => { __flushScheduled = false; flushPendingAttempts(); }, 250);
}

async function flushPendingAttempts() {
  // Try to resolve auth again (refresh + whoami) with light backoff chain
  if (!getUserId()) {
    try { await fetch(FN('supabase_auth') + '?action=refresh', { credentials: 'include', cache: 'no-store' }); } catch {}
    await ensureUserId();
  }
  const uid = getUserId();
  if (!uid) {
    // Still no auth: re-schedule (gives user time to finish login in another tab)
    if (__pendingAttempts.length > 0) scheduleAuthFlush();
    return;
  }
  // Drain queue snapshot (avoid infinite loop if new attempts arrive while sending)
  const toSend = __pendingAttempts.splice(0, __pendingAttempts.length);
  for (const a of toSend) {
    await sendAttempt({ user_id: uid, ...a });
  }
  // Also flush any pending session_end payloads
  if (__pendingSessionEnd.size) {
    for (const [sid, payload] of Array.from(__pendingSessionEnd.entries())) {
      await sendSessionEnd({ ...payload, user_id: uid });
    }
  }
}

async function sendAttempt({ user_id, session_id, mode, word, is_correct, answer, correct_answer, points, attempt_index, duration_ms, round, extra }) {
  if (!word) return; // safeguard
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
    if (res.status === 401) {
      // Auth likely expired; queue this attempt again & trigger refresh cycle
      __pendingAttempts.push({ session_id, mode, word, is_correct, answer, correct_answer, points, attempt_index, duration_ms, round, extra, _ts: Date.now() });
      scheduleAuthFlush();
      return;
    }
    // Non-auth error: surface once (optional). Avoid spamming alerts for repeated failures.
    if (!sendAttempt._lastError || Date.now() - sendAttempt._lastError > 5000) {
      sendAttempt._lastError = Date.now();
      alert(`Logging failed (${res.status}). Attempts will retry silently.`);
    }
    return;
  }
  __authResolved = true;
  try {
    const js = await res.json().catch(() => null);
    if (js && typeof js.points_total === 'number') {
      try { window.dispatchEvent(new CustomEvent('points:update', { detail: { total: js.points_total } })); } catch {}
      scheduleRefresh();
      return;
    }
  } catch {}
  // If server didn’t send total, only request a refresh when correct to keep noise low
  if (is_correct) scheduleRefresh(0);
}

async function sendSessionEnd({ session_id, mode, extra, user_id }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      event_type: 'session_end',
      session_id,
      mode,
      user_id,
      extra
    })
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('❌ SESSION_END LOG FAILED:', res.status, txt);
    if (res.status === 401) {
      // Requeue for retry
      const existing = __pendingSessionEnd.get(session_id) || { session_id, mode, extra, tries: 0 };
      existing.tries = (existing.tries || 0) + 1;
      if (existing.tries < 8) { // cap retries
        __pendingSessionEnd.set(session_id, existing);
        scheduleAuthFlush();
      } else {
        if (!sendSessionEnd._lastError || Date.now() - sendSessionEnd._lastError > 10000) {
          sendSessionEnd._lastError = Date.now();
          alert('Session end could not be authenticated. Points may be partial.');
        }
      }
      return;
    }
    if (!sendSessionEnd._lastError || Date.now() - sendSessionEnd._lastError > 10000) {
      sendSessionEnd._lastError = Date.now();
      alert(`Session end logging failed (${res.status}). Will not retry.`);
    }
    return;
  }
  try { __pendingSessionEnd.delete(session_id); } catch {}
  scheduleRefresh();
}

