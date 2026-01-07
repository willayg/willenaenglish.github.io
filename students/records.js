// Reusable client-side tracker for student activity and per-word attempts
// Works with the activity logging endpoint
import { FN } from './scripts/api-base.js';
import { scheduleRefresh } from './scripts/points-client.js';
// Optional shared points helpers (non-breaking):
// Shared points helpers: standardize optimistic bump and debounced server refresh
// Scoreless build: no points helpers

const ENDPOINT = FN('log_word_attempt');

// Auth: derive user id from secure HTTP-only cookies via whoami endpoint.
// NOTE: we may receive an `assignment_run` token when a teacher launches
// a run. Read it from the URL or sessionStorage and attach it to session
// payloads so server-side assignment matching can prefer token-linked sessions.
let __userId = null;
let __whoamiPromise = null;
let __authResolved = false; // becomes true after first successful authenticated write
let __authChecked = false; // BUG FIX: Track whether auth check has completed (even if failed)
const __pendingAttempts = [];
let __flushScheduled = false;
const __pendingSessionEnd = new Map(); // sessionId -> payload for retry
let __authRetryCount = 0; // Track how many times we've tried auth
const __MAX_AUTH_RETRIES = 3; // Stop retrying after this many 401s

// BUG FIX: Auth-ready event listeners for progress/stars loading
// This solves the race condition where progress loads before auth completes
const __authReadyCallbacks = [];
function notifyAuthReady(userId) {
  __authChecked = true;
  console.log('[records] Auth check complete, userId:', userId ? '(set)' : '(null)');
  // Dispatch custom event for global listeners
  try {
    window.dispatchEvent(new CustomEvent('auth:ready', { detail: { userId } }));
  } catch (e) {}
  // Call registered callbacks
  __authReadyCallbacks.forEach(cb => { try { cb(userId); } catch (e) {} });
  __authReadyCallbacks.length = 0;
}

// ---- BATCHING CONFIGURATION ----
// When true, attempts are queued and sent in batches to reduce invocations
const BATCH_MODE = true;
const BATCH_FLUSH_DELAY_MS = 60000; // 60 seconds - long enough that games finish before flush
const BATCH_MAX_SIZE = 20; // Flush immediately if this many attempts queued
let __batchFlushTimer = null;
const __batchQueue = []; // Holds attempts ready to batch (after auth resolved)

console.debug('[records] BATCH_MODE =', BATCH_MODE, 'flush delay =', BATCH_FLUSH_DELAY_MS/1000, 's, max size =', BATCH_MAX_SIZE);
// New: store session_start payloads that failed (likely 401) so we can retry once auth resolves
const __pendingSessionStarts = new Map(); // sessionId -> { payload, tries }
// Throttle: avoid hammering the auth refresh endpoint if user id not yet resolved.
// Previously, flushPendingAttempts() retried every ~250ms, causing a rapid
// stream of GET /api/supabase_auth?action=refresh requests.
// We cap refresh attempts to at most once every THROTTLE_MS while unauthenticated.
const __AUTH_REFRESH_THROTTLE_MS = 5000; // adjust (e.g. 3000) if you want faster retries
let __lastAuthRefresh = 0;

async function fetchWhoAmI() {
  try {
  const res = await fetch(FN('supabase_auth') + '?action=whoami', {
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
    __whoamiPromise = fetchWhoAmI()
      .then(id => { 
        __userId = id; 
        // BUG FIX: Notify listeners that auth check is complete
        notifyAuthReady(id);
        return id; 
      })
      .catch(() => {
        // BUG FIX: Still notify even on failure (user is not authenticated)
        notifyAuthReady(null);
        return null;
      });
  }
  return __whoamiPromise;
}

function genId(prefix = 'wa') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- Assignment run token helpers ---------------------------------------
function readAssignmentRunFromURL() {
  try {
    const p = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    if (!p) return null;
    return p.get('assignment_run') || p.get('assignmentRun') || null;
  } catch (e) { return null; }
}

function getStoredAssignmentRun() {
  try {
    // prefer in-memory global if teacher UI set it
    if (typeof window !== 'undefined' && window.currentHomeworkRunTokens) {
      // If an exact token was placed here (string) use it
      if (typeof window.currentHomeworkRunTokens === 'string') return window.currentHomeworkRunTokens;
      // If it's an object (assignmentId -> token), try to pick a sensible token.
      // Common teacher UI stores tokens keyed by assignmentId. In many cases
      // there will only be one active token in the object; pick the first
      // token value found so student pages can pick it up even when the
      // teacher UI didn't propagate a plain string global.
      if (typeof window.currentHomeworkRunTokens === 'object' && window.currentHomeworkRunTokens !== null) {
        try {
          for (const k of Object.keys(window.currentHomeworkRunTokens)) {
            const v = window.currentHomeworkRunTokens[k];
            if (typeof v === 'string' && v) return v;
          }
        } catch (e) {}
      }
    }
    if (typeof sessionStorage !== 'undefined') return sessionStorage.getItem('wa_assignment_run');
  } catch (e) {}
  return null;
}

function persistAssignmentRun(token) {
  try { if (!token) return; if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('wa_assignment_run', token); } catch (e) {}
}

function getAssignmentRun() {
  const fromURL = readAssignmentRunFromURL();
  if (fromURL) { persistAssignmentRun(fromURL); return fromURL; }
  const stored = getStoredAssignmentRun();
  return stored || null;
}

// On module load, capture any token in the URL so subsequent navigations keep it
try {
  const _ar = readAssignmentRunFromURL();
  if (_ar) {
    persistAssignmentRun(_ar);
    try { console.debug('[records] assignment_run token captured:', _ar); } catch (e) {}
  }
} catch (e) {}

// Synchronous getter used by logging; returns cached id (may be null on first call).
export function getUserId() { return __userId; }

// BUG FIX: Check if auth check has completed (even if result was null/no user)
export function isAuthChecked() { return __authChecked; }

// BUG FIX: Wait for auth to be checked. Resolves with userId (or null if not logged in).
// This is different from ensureUserId which just returns the current value.
// This WAITS for the auth check to complete, then resolves.
export function waitForAuth(timeoutMs = 10000) {
  // If already checked, resolve immediately
  if (__authChecked) {
    return Promise.resolve(__userId);
  }
  // If whoami is in flight, wait for it
  if (__whoamiPromise) {
    return __whoamiPromise;
  }
  // Otherwise, kick off whoami and wait
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      console.warn('[records] waitForAuth timed out');
      resolve(null);
    }, timeoutMs);
    
    __authReadyCallbacks.push((userId) => {
      clearTimeout(timeout);
      resolve(userId);
    });
    
    // Start the auth check
    kickOffWhoAmI();
  });
}
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
    extra: (function() {
      const ar = getAssignmentRun();
      if (ar) return { ...(meta || {}), assignment_run: ar };
      return (meta || {});
    })()
  };
  // Fire and forget; do not block UI
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload)
  }).then(async res => {
    if (res.status === 401 || res.status === 403) {
      // queue for retry after auth; keep original payload (with list_name)
      __pendingSessionStarts.set(sessionId, { payload, tries: 0 });
      scheduleAuthFlush();
      return;
    }
    if (!res.ok) {
      console.warn('[records] session_start failed', res.status);
    }
  }).catch((e) => {
    console.debug('session_start log skipped:', e?.message);
    // On network error retain payload for later attempt
    __pendingSessionStarts.set(sessionId, { payload, tries: 0 });
    scheduleAuthFlush();
  });

  // Background: if we don't have an assignment_run token yet, attempt to fetch
  // one for this list from the homework API and re-upsert the session to attach it.
  (async () => {
    try {
      if (!getAssignmentRun() && listName) {
        const api = FN('homework_api') + `?action=get_run_token&list_key=${encodeURIComponent(listName)}`;
        const res = await fetch(api, { credentials: 'include', cache: 'no-store' });
        if (res.ok) {
          const js = await res.json().catch(() => null);
          const token = js && Array.isArray(js.tokens) && js.tokens.length ? js.tokens[0] : (js && js.run_token) || null;
          if (token) {
            persistAssignmentRun(token);
            try { console.debug('[records] fetched assignment_run token for', listName, token); } catch (e) {}
            // If we have a pending session_start queued due to auth, attach token there
            const pending = __pendingSessionStarts.get(sessionId);
            if (pending && pending.payload) {
              pending.payload = { ...pending.payload, extra: { ...(pending.payload.extra || {}), assignment_run: token } };
              __pendingSessionStarts.set(sessionId, pending);
            }
            // Also attempt an immediate upsert to attach token to this session row
            try {
              const payload2 = { ...payload, extra: { ...(payload.extra || {}), assignment_run: token } };
              await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(payload2) });
            } catch (e) { /* non-fatal */ }
          } else {
            try { console.debug('[records] no run token returned for', listName); } catch (e) {}
          }
        }
      }
    } catch (e) {
      try { console.debug('[records] run token fetch failed:', e?.message); } catch (e) {}
    }
  })();
  return sessionId;
}

export async function endSession(sessionId, { mode, summary = {}, listName = null, wordList = null } = {}) {
  if (!sessionId) return;
  
  // BATCH: Flush all pending attempts for this session before ending
  if (BATCH_MODE && __batchQueue.length > 0) {
    try {
      await flushBatchQueue();
    } catch (e) {
      console.debug('[records] batch flush on endSession failed:', e?.message);
    }
  }
  
  // Fire a local in-page event immediately so game UIs can react (e.g., show stars)
  try {
    const list_size = Array.isArray(wordList) ? wordList.length : null;
    try {
      // Ensure assignment_run token is present in summary for session_end
      const _ar = getAssignmentRun();
      if (_ar) summary = { ...(summary || {}), assignment_run: _ar };
      window.dispatchEvent(new CustomEvent('wa:session-ended', { detail: { session_id: sessionId, mode: mode || 'unknown', summary, list_name: listName, list_size } }));
    } catch {}
  } catch {}
  try {
    kickOffWhoAmI();
    const uid = getUserId();
    if (!uid) {
      // Defer until auth; store minimal payload
      __pendingSessionEnd.set(sessionId, { session_id: sessionId, mode: mode || 'unknown', extra: summary, tries: 0 });
      scheduleAuthFlush();
      return;
    }
  const list_size = Array.isArray(wordList) ? wordList.length : null;
  try {
    try { console.debug('[records] session_end payload assignment_run:', summary && summary.assignment_run); } catch (e) {}
  } catch (e) {}
  await sendSessionEnd({ session_id: sessionId, mode: mode || 'unknown', extra: summary, user_id: uid, list_name: listName, list_size });
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
  // REVIEW ENRICHMENT HOOK (non-breaking): if a global ReviewManager is active and mode indicates review context
  try {
    if (typeof window !== 'undefined' && window.__WA_REVIEW_ACTIVE && window.__WA_REVIEW_MANAGER && extra && extra.attempt_context !== 'review') {
      // We only have 'word' string here; attempt to find matching word object from manager for enrichment
      const mgr = window.__WA_REVIEW_MANAGER;
      const candidate = Array.isArray(mgr.words) ? mgr.words.find(w => (w.eng || w.word) === word) : null;
      if (candidate) {
        // Use manager to build extra metadata; do NOT double-log (manager normally would call logAttempt directly in review modes later)
        const built = mgr.buildExtraFor(candidate);
        extra = { ...extra, ...built };
        if (is_correct) {
          // Mark first-correct if not already credited
          const wid = built.word_id;
            if (wid && !mgr.firstCorrect.has(wid)) { mgr.firstCorrect.add(wid); extra.first_correct_in_review = true; }
            else if (wid) { extra.first_correct_in_review = false; }
        }
      }
    }
  } catch (e) { /* swallow enrichment errors */ }
  try {
    // Attach assignment_run token to every attempt if present so attempts can be
    // associated with a teacher run as well as session events.
    const _ar = getAssignmentRun();
    if (_ar) extra = { ...(extra || {}), assignment_run: _ar };
  } catch (e) {}
  try {
    // Ensure cookies are sent; also kick whoami if not yet done
    kickOffWhoAmI();
    let user_id = getUserId();
    console.debug('[records] logAttempt: user_id=', user_id ? 'present' : 'null', 'word=', word);
    // If we do not yet have a user id, enqueue the attempt for a deferred flush.
    if (!user_id) {
      console.debug('[records] No user_id, queuing in __pendingAttempts');
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

// ---- BATCH QUEUE HELPERS ----
function scheduleBatchFlush() {
  if (__batchFlushTimer) return; // Already scheduled
  __batchFlushTimer = setTimeout(async () => {
    __batchFlushTimer = null;
    await flushBatchQueue();
  }, BATCH_FLUSH_DELAY_MS);
}

async function flushBatchQueue() {
  console.debug('[records] flushBatchQueue called, queue size:', __batchQueue.length);
  if (__batchQueue.length === 0) return;
  
  // Clear any pending timer
  if (__batchFlushTimer) {
    clearTimeout(__batchFlushTimer);
    __batchFlushTimer = null;
  }
  
  // Snapshot and clear the queue
  const toSend = __batchQueue.splice(0, __batchQueue.length);
  if (toSend.length === 0) return;
  
  // Group by session_id for the batch payload
  const bySession = {};
  for (const a of toSend) {
    const sid = a.session_id || '__nosession';
    if (!bySession[sid]) bySession[sid] = { mode: a.mode, attempts: [] };
    bySession[sid].attempts.push({
      word: a.word,
      is_correct: a.is_correct,
      answer: a.answer,
      correct_answer: a.correct_answer,
      points: a.points,
      attempt_index: a.attempt_index,
      duration_ms: a.duration_ms,
      round: a.round,
      extra: a.extra
    });
  }
  
  // Send each session's batch
  for (const [sessionId, data] of Object.entries(bySession)) {
    if (sessionId === '__nosession') continue; // Skip orphan attempts
    
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          event_type: 'attempts_batch',
          session_id: sessionId,
          mode: data.mode,
          attempts: data.attempts
        })
      });
      
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        if (res.status === 401) {
          __authRetryCount++;
          // Only retry a limited number of times to avoid infinite loop when not logged in
          if (__authRetryCount <= __MAX_AUTH_RETRIES) {
            console.debug('[records] 401 - will retry auth (attempt', __authRetryCount, '/', __MAX_AUTH_RETRIES, ')');
            // Re-queue for retry after auth
            for (const a of data.attempts) {
              __pendingAttempts.push({ session_id: sessionId, mode: data.mode, ...a, _ts: Date.now() });
            }
            scheduleAuthFlush();
          } else if (__authRetryCount === __MAX_AUTH_RETRIES + 1) {
            console.debug('[records] Auth retries exhausted - guest mode, attempts will not be saved');
          }
          // Suppress repeated error logs after max retries
        } else {
          console.error('❌ BATCH LOG FAILED:', res.status, txt);
        }
      } else {
        console.debug(`[records] ✅ Batch sent: ${data.attempts.length} attempts for session ${sessionId.slice(0,12)}...`);
        __authResolved = true;
        __authRetryCount = 0; // Reset retry counter on success
        // Note: scheduleRefresh removed here - points refresh happens once at session end
      }
    } catch (e) {
      console.error('[records] batch send error:', e?.message);
      // Re-queue on network error
      for (const a of data.attempts) {
        __pendingAttempts.push({ session_id: sessionId, mode: data.mode, ...a, _ts: Date.now() });
      }
      scheduleAuthFlush();
    }
  }
}

// Export flush for game-end scenarios
export async function flushAttempts() {
  // First ensure pending (unauthenticated) attempts are flushed
  await flushPendingAttempts();
  // Then flush the batch queue
  await flushBatchQueue();
}

// Flush on page unload (best effort with sendBeacon)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (__batchQueue.length === 0) return;
    
    // Group by session for beacon
    const bySession = {};
    for (const a of __batchQueue) {
      const sid = a.session_id || '__nosession';
      if (!bySession[sid]) bySession[sid] = { mode: a.mode, attempts: [] };
      bySession[sid].attempts.push(a);
    }
    
    for (const [sessionId, data] of Object.entries(bySession)) {
      if (sessionId === '__nosession') continue;
      const payload = JSON.stringify({
        event_type: 'attempts_batch',
        session_id: sessionId,
        mode: data.mode,
        attempts: data.attempts.map(a => ({
          word: a.word,
          is_correct: a.is_correct,
          answer: a.answer,
          correct_answer: a.correct_answer,
          points: a.points,
          attempt_index: a.attempt_index,
          duration_ms: a.duration_ms,
          round: a.round,
          extra: a.extra
        }))
      });
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      console.debug(`[records] 📡 Beacon sent: ${data.attempts.length} attempts`);
    }
    __batchQueue.length = 0; // Clear after beacon
  });
}

// ---- Internal helpers for deferred auth & queued attempts -----------------

function scheduleAuthFlush() {
  if (__flushScheduled) return;
  __flushScheduled = true;
  setTimeout(() => { __flushScheduled = false; flushPendingAttempts(); }, 250);
}

async function flushPendingAttempts() {
  // Try to resolve auth again (refresh + whoami) with light backoff chain
  if (!getUserId()) {
    const now = Date.now();
    // Only call the refresh endpoint if enough time has passed since last attempt.
    if (now - __lastAuthRefresh >= __AUTH_REFRESH_THROTTLE_MS) {
      __lastAuthRefresh = now;
      try {
        await fetch(FN('supabase_auth') + '?action=refresh', { credentials: 'include', cache: 'no-store' });
      } catch {}
    }
    await ensureUserId();
  }
  const uid = getUserId();
  if (!uid) {
    // Still no auth: re-schedule only if we haven't exceeded retry limit
    if (__pendingAttempts.length > 0 && __authRetryCount < __MAX_AUTH_RETRIES) {
      scheduleAuthFlush();
    }
    return;
  }
  // Drain queue snapshot (avoid infinite loop if new attempts arrive while sending)
  const toSend = __pendingAttempts.splice(0, __pendingAttempts.length);
  for (const a of toSend) {
    await sendAttempt({ user_id: uid, ...a });
  }
  // Flush batch queue after processing pending attempts (batch mode queues them)
  if (BATCH_MODE && __batchQueue.length > 0) {
    await flushBatchQueue();
  }
  // Also flush any pending session_end payloads
  if (__pendingSessionEnd.size) {
    for (const [sid, payload] of Array.from(__pendingSessionEnd.entries())) {
      await sendSessionEnd({ ...payload, user_id: uid });
    }
  }
  // Retry pending session_start events (upsert semantics) now that we (likely) have auth
  if (__pendingSessionStarts.size) {
    for (const [sid, entry] of Array.from(__pendingSessionStarts.entries())) {
      const { payload } = entry || {}; if (!payload) { __pendingSessionStarts.delete(sid); continue; }
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...payload, user_id: uid })
        });
        if (res.ok) {
          __pendingSessionStarts.delete(sid);
        } else if (res.status === 401) {
          // still unauthorized; will retry on next flush
          const cur = __pendingSessionStarts.get(sid); if (cur) cur.tries = (cur.tries || 0) + 1;
        } else {
          console.warn('[records] retry session_start failed', res.status);
          __pendingSessionStarts.delete(sid);
        }
      } catch (e) {
        const cur = __pendingSessionStarts.get(sid); if (cur) cur.tries = (cur.tries || 0) + 1;
        // Give up after several attempts
        if (cur && cur.tries > 6) __pendingSessionStarts.delete(sid);
      }
    }
  }
}

async function sendAttempt({ user_id, session_id, mode, word, is_correct, answer, correct_answer, points, attempt_index, duration_ms, round, extra }) {
  if (!word) return; // safeguard
  
  console.debug('[records] sendAttempt called, BATCH_MODE=', BATCH_MODE, 'word=', word);
  
  // BATCH MODE: Queue the attempt instead of sending immediately
  if (BATCH_MODE) {
    console.debug('[records] Queueing attempt in batch, queue size:', __batchQueue.length + 1);
    __batchQueue.push({
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
      extra: extra || {}
    });
    
    // Optimistic UI update: bump points display immediately for correct answers
    if (is_correct) {
      const delta = (typeof points === 'number' && points > 0) ? points : 1;
      try { 
        // Dispatch points:optimistic-bump - student-header listens for this
        window.dispatchEvent(new CustomEvent('points:optimistic-bump', { detail: { delta } }));
      } catch {}
    }
    
    // If we hit max size, flush immediately
    if (__batchQueue.length >= BATCH_MAX_SIZE) {
      await flushBatchQueue();
    } else {
      // Schedule a delayed flush
      scheduleBatchFlush();
    }
    return;
  }
  
  // LEGACY: Individual attempt send (when BATCH_MODE = false)
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
      // Note: scheduleRefresh removed - will happen at session end to reduce invocations
      return;
    }
  } catch {}
  // Note: per-attempt scheduleRefresh removed - points update happens at session end
}

async function sendSessionEnd({ session_id, mode, extra, user_id, list_name = null, list_size = null }) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      event_type: 'session_end',
      session_id,
      mode,
  user_id,
  extra,
  list_name,
  list_size
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
  // Emit a lightweight event to allow any listeners (e.g., profile or header) to refetch overview immediately
  try { window.dispatchEvent(new CustomEvent('session:ended', { detail: { session_id, mode, list_name, list_size } })); } catch {}
  // Cross-tab signal
  try { localStorage.setItem('stars:refresh', String(Date.now())); } catch {}
  scheduleRefresh();
}

