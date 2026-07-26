// Shared student-session repair helper.
// Verifies the current access token and uses the refresh-token cookie when needed.

const REFRESH_INTERVAL = 1000 * 60 * 35;
const MIN_FOCUS_REFRESH_AGE = 1000 * 60 * 15;

let refreshTimer = null;
let lastRefreshAt = 0;
let refreshInFlight = null;

async function sessionRequest() {
  const path = '/.netlify/functions/supabase_auth?action=whoami_student&_=' + Date.now();

  if (window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function') {
    return window.WillenaAPI.fetch(path, { method: 'GET', cache: 'no-store' });
  }

  return fetch(path, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
}

async function repairSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await sessionRequest();
      const data = await response.json().catch(() => ({}));
      lastRefreshAt = Date.now();

      if (!response.ok || !data.success) {
        console.debug('[student-auth-refresh] session repair did not succeed', {
          status: response.status,
          body: data,
        });
        return false;
      }

      // Keep both event names for compatibility. The shared header already
      // listens for auth:changed and will immediately reload identity,
      // points, and stars after a successful session repair.
      try { window.dispatchEvent(new CustomEvent('auth:refreshed')); } catch {}
      try { window.dispatchEvent(new CustomEvent('auth:changed')); } catch {}
      return true;
    } catch (error) {
      lastRefreshAt = Date.now();
      console.debug('[student-auth-refresh] request error', error);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(repairSession, REFRESH_INTERVAL);
}

function repairAfterReturning() {
  if (document.visibilityState === 'hidden') return;
  const elapsed = Date.now() - lastRefreshAt;
  if (!lastRefreshAt || elapsed >= MIN_FOCUS_REFRESH_AGE) repairSession();
}

export function ensureStudentAuthRefresh() {
  if (window.__studentAuthRefreshInitialized) return;
  window.__studentAuthRefreshInitialized = true;

  repairSession().finally(scheduleRefresh);
  window.addEventListener('focus', repairAfterReturning);
  document.addEventListener('visibilitychange', repairAfterReturning);
  window.addEventListener('online', repairAfterReturning);
}

if (typeof window !== 'undefined') {
  window.ensureStudentAuthRefresh = ensureStudentAuthRefresh;
}
