// Shared teacher-session refresh helper.
// Keeps the short-lived Supabase access token alive by using the long-lived
// refresh-token cookie before the access token expires.

const REFRESH_INTERVAL = 1000 * 60 * 35; // 35 minutes
const MIN_FOCUS_REFRESH_AGE = 1000 * 60 * 15; // refresh after returning to an old tab

let refreshTimer = null;
let lastRefreshAt = 0;
let refreshInFlight = null;

async function refreshRequest() {
  // Use the site's shared API router when it is available. It handles the
  // current students domain, Cloudflare routing, credentials and local tokens.
  if (window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function') {
    return window.WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=refresh&_=' + Date.now(), {
      method: 'GET',
      cache: 'no-store',
    });
  }

  // Same-origin fallback for pages that load this module before api-config.js.
  return fetch('/.netlify/functions/supabase_auth?action=refresh&_=' + Date.now(), {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
  });
}

async function callRefresh() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await refreshRequest();
      const data = await response.json().catch(() => ({}));
      lastRefreshAt = Date.now();

      if (!response.ok || !data.success) {
        console.debug('[auth-refresh] refresh did not succeed', {
          status: response.status,
          body: data,
        });
        return false;
      }

      console.debug('[auth-refresh] session refreshed');
      try {
        window.dispatchEvent(new CustomEvent('auth:refreshed'));
      } catch {}
      return true;
    } catch (error) {
      lastRefreshAt = Date.now();
      console.debug('[auth-refresh] refresh request error', error);
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(callRefresh, REFRESH_INTERVAL);
}

function refreshAfterReturning() {
  if (document.visibilityState === 'hidden') return;
  const elapsed = Date.now() - lastRefreshAt;
  if (!lastRefreshAt || elapsed >= MIN_FOCUS_REFRESH_AGE) {
    callRefresh();
  }
}

export function ensureAuthRefresh() {
  if (window.__authRefreshInitialized) return;
  window.__authRefreshInitialized = true;

  // Refresh immediately so an older-but-recoverable session is repaired as
  // soon as the page loads, then continue before the access token expires.
  callRefresh().finally(scheduleRefresh);

  window.addEventListener('focus', refreshAfterReturning);
  document.addEventListener('visibilitychange', refreshAfterReturning);
  window.addEventListener('online', refreshAfterReturning);
}

// Preserve the existing global escape hatch for non-module callers.
if (typeof window !== 'undefined') {
  window.ensureAuthRefresh = ensureAuthRefresh;
}
