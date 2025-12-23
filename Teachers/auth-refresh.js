const REFRESH_PATH = '/.netlify/functions/supabase_auth?action=refresh';
const REFRESH_INTERVAL = 1000 * 60 * 40; // 40 minutes

let refreshTimer = null;
let lastRefreshAt = 0;
let refreshInFlight = null;

async function callRefresh() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const resp = (typeof window !== 'undefined' && window.WillenaAPI && typeof window.WillenaAPI.fetch === 'function')
        ? await window.WillenaAPI.fetch(REFRESH_PATH, { cache: 'no-store' })
        : await fetch(REFRESH_PATH, { credentials: 'include', cache: 'no-store' });

      const json = await resp.json().catch(() => ({}));
        if (!resp.ok || !(json && json.success)) {
          console.debug('[auth-refresh] refresh request failed', { status: resp.status, body: json });
        } else {
          console.debug('[auth-refresh] refresh ok', { status: resp.status, body: json });
        }
      lastRefreshAt = Date.now();
      return json;
    } catch (error) {
      console.debug('[auth-refresh] refresh request error', error);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function ensureAuthRefresh() {
  if (window.__authRefreshInitialized) {
    return;
  }
  window.__authRefreshInitialized = true;

  const schedule = () => {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => callRefresh(), REFRESH_INTERVAL);
  };

  callRefresh().then(schedule);

  window.addEventListener('focus', () => {
    const elapsed = Date.now() - lastRefreshAt;
    if (elapsed > REFRESH_INTERVAL / 2) {
      callRefresh();
    }
  });
}

// If the script is loaded outside of modules and we still want to trigger, expose global
if (typeof window !== 'undefined') {
  window.ensureAuthRefresh = ensureAuthRefresh;
}
