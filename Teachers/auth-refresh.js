// Shared teacher-session repair helper.
// Calls the teacher-only server action, which verifies the access token and
// uses the refresh-token cookie when the access token has expired.

const REFRESH_INTERVAL = 1000 * 60 * 35; // 35 minutes
const MIN_FOCUS_REFRESH_AGE = 1000 * 60 * 15;

let refreshTimer = null;
let lastRefreshAt = 0;
let refreshInFlight = null;

async function sessionRequest() {
  const path = '/.netlify/functions/supabase_auth?action=whoami_teacher&_=' + Date.now();

  if (window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function') {
    return window.WillenaAPI.fetch(path, {
      method: 'GET',
      cache: 'no-store',
    });
  }

  return fetch(path, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
}

function redirectAuthenticatedLogin(data) {
  if (!/\/Teachers\/(?:login|signin)\.html$/i.test(window.location.pathname)) return;
  // whoami_teacher is already restricted to teacher/admin accounts, so a
  // successful response is sufficient even when the response omits `role`.
  if (!data?.success) return;

  const params = new URLSearchParams(window.location.search);
  const requested = params.get('redirect');
  const target = requested && requested.startsWith('/') && !/^https?:/i.test(requested)
    ? requested
    : '/Teachers/index.html';

  window.location.replace(target);
}

async function repairSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await sessionRequest();
      const data = await response.json().catch(() => ({}));
      lastRefreshAt = Date.now();

      if (!response.ok || !data.success) {
        console.debug('[auth-refresh] teacher session repair did not succeed', {
          status: response.status,
          body: data,
        });
        return false;
      }

      console.debug('[auth-refresh] teacher session verified or repaired');
      try {
        window.dispatchEvent(new CustomEvent('auth:refreshed'));
      } catch {}

      redirectAuthenticatedLogin(data);
      return true;
    } catch (error) {
      lastRefreshAt = Date.now();
      console.debug('[auth-refresh] teacher session request error', error);
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
  if (!lastRefreshAt || elapsed >= MIN_FOCUS_REFRESH_AGE) {
    repairSession();
  }
}

export function ensureAuthRefresh() {
  if (window.__authRefreshInitialized) return;
  window.__authRefreshInitialized = true;

  repairSession().finally(scheduleRefresh);

  window.addEventListener('focus', repairAfterReturning);
  document.addEventListener('visibilitychange', repairAfterReturning);
  window.addEventListener('online', repairAfterReturning);
}

if (typeof window !== 'undefined') {
  window.ensureAuthRefresh = ensureAuthRefresh;
}
