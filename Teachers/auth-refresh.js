// Detect custom domain and route to Netlify
const getApiBase = () => {
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  if (host === 'willenaenglish.github.io' || host === 'willenaenglish.com' || host === 'www.willenaenglish.com') {
    return 'https://willenaenglish.netlify.app';
  }
  return '';
};
const API_BASE = getApiBase();
const REFRESH_ENDPOINT = `${API_BASE}/.netlify/functions/supabase_auth?action=refresh`;
const REFRESH_INTERVAL = 1000 * 60 * 40; // 40 minutes

let refreshTimer = null;
let lastRefreshAt = 0;
let refreshInFlight = null;

async function callRefresh() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const resp = await fetch(REFRESH_ENDPOINT, { credentials: 'include' });
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
