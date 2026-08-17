// Shared teacher-session repair helper.
// Verifies the access cookie and uses the refresh-token cookie when needed.

const REFRESH_INTERVAL = 1000 * 60 * 35; // 35 minutes
const MIN_FOCUS_REFRESH_AGE = 1000 * 60 * 15;

let refreshTimer = null;
let lastRefreshAt = 0;
let refreshInFlight = null;

async function sessionRequest() {
  const path = '/.netlify/functions/supabase_auth?action=whoami&_=' + Date.now();

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

async function refreshRequest() {
  const path = '/.netlify/functions/supabase_auth?action=refresh&_=' + Date.now();

  if (window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function') {
    return window.WillenaAPI.fetch(path, {
      method: 'POST',
      cache: 'no-store',
    });
  }

  return fetch(path, {
    method: 'POST',
    credentials: 'include',
    cache: 'no-store',
  });
}

function redirectAuthenticatedLogin(data) {
  if (!/\/Teachers\/(?:login|signin)(?:\.html)?\/?$/i.test(window.location.pathname)) return;
  if (!data?.success) return;

  const params = new URLSearchParams(window.location.search);
  const requested = params.get('redirect');
  const target = requested && requested.startsWith('/') && !/^https?:/i.test(requested)
    ? requested
    : '/Teachers/index.html';

  window.location.replace(target);
}

export async function ensureTeacherSession() {
  try {
    let response = await sessionRequest();
    let data = await response.json().catch(() => ({}));

    if (response.ok && data.success) {
      lastRefreshAt = Date.now();
      return data;
    }

    const refreshed = await refreshRequest();
    if (!refreshed.ok) {
      lastRefreshAt = Date.now();
      return null;
    }

    response = await sessionRequest();
    data = await response.json().catch(() => ({}));
    lastRefreshAt = Date.now();

    return response.ok && data.success ? data : null;
  } catch (error) {
    lastRefreshAt = Date.now();
    console.debug('[auth-refresh] persistent teacher session recovery failed', error);
    return null;
  }
}

async function repairSession() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const data = await ensureTeacherSession();

      if (!data?.success) {
        console.debug('[auth-refresh] teacher session repair did not succeed');
        return false;
      }

      console.debug('[auth-refresh] teacher session verified or repaired');
      try {
        window.dispatchEvent(new CustomEvent('auth:refreshed'));
      } catch {}

      redirectAuthenticatedLogin(data);
      return true;
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
  window.ensureTeacherSession = ensureTeacherSession;
}
