/**
 * API Configuration for GitHub Pages + Netlify Functions + Cloudflare Workers
 * VERSION: 2025-12-07-v2 LOCAL_DEV_FIX
 * 
 * This file centralizes the API base URL configuration.
 * When hosted on GitHub Pages, API calls go to the Netlify functions domain.
 * When running locally or on Netlify, they use relative paths.
 * 
 * CLOUDFLARE WORKERS MIGRATION:
 * - Set CF_ROLLOUT_PERCENT to gradually shift traffic to Cloudflare Workers
 * - 0 = all Netlify, 100 = all Cloudflare
 * - Shadow mode sends requests to both but uses Netlify response
 * 
 * IMPORTANT: For cross-origin cookie authentication to work:
 * 1. Netlify functions must return proper CORS headers with credentials
 * 2. Cookies must be set with SameSite=None; Secure
 * 3. Fetch requests must include credentials: 'include'
 */

(function() {
  'use strict';

  // ============================================================
  // CLOUDFLARE WORKERS MIGRATION CONFIG
  // ============================================================
  
  // Cloudflare Worker URLs - use the proxy at api-cf.willenaenglish.com
  // The proxy routes /.netlify/functions/<name> to the appropriate worker
  const CF_PROXY_BASE = 'https://api-cf.willenaenglish.com';
  const CF_WORKER_URLS = {
    get_audio_urls: CF_PROXY_BASE,
    supabase_auth: CF_PROXY_BASE,
    log_word_attempt: CF_PROXY_BASE,
    homework_api: CF_PROXY_BASE,
    progress_summary: CF_PROXY_BASE,
  };
  // Back-compat for older code paths that referenced a single base
  const CF_WORKER_BASE = CF_WORKER_URLS.get_audio_urls;

  // Local dev worker ports (Cloudflare Workers via wrangler dev)
  const LOCAL_WORKER_MAP = {
    supabase_auth: 'http://127.0.0.1:8787',
    log_word_attempt: 'http://127.0.0.1:8788',
    homework_api: 'http://127.0.0.1:8789',
    progress_summary: 'http://127.0.0.1:8790',
  };
  
  // Rollout percentage: 0-100 (0 = all Netlify, 100 = all Cloudflare)
  // Change this to gradually shift traffic. Use `setRolloutPercent()` to update at runtime.
  // SAFETY: Set to 0 while CF Workers routes are still being configured
  // Once routes are confirmed working, gradually increase to 100
  let CF_ROLLOUT_PERCENT = 0;

  // Per-function rollout overrides (percent 0-100). If a function is listed here,
  // this value takes precedence over the global CF_ROLLOUT_PERCENT. Defaults to 0
  // so nothing is routed to workers unless explicitly set.
  // NOTE: Keep at 0 until CF Workers are fully tested
  const CF_ROLLOUT_PERCENT_BY_FN = {
    get_audio_urls: 0,
    supabase_auth: 0,
    log_word_attempt: 0,
    homework_api: 0,
    progress_summary: 0,
  };
  
  // Shadow mode: if true, calls BOTH endpoints but uses Netlify response
  // Useful for testing parity without affecting users
  let CF_SHADOW_MODE = false;
  
  // Functions that have been migrated to Cloudflare Workers
  const CF_MIGRATED_FUNCTIONS = {
    get_audio_urls: CF_WORKER_URLS.get_audio_urls,
    supabase_auth: CF_WORKER_URLS.supabase_auth,
    log_word_attempt: CF_WORKER_URLS.log_word_attempt,
    homework_api: CF_WORKER_URLS.homework_api,
    progress_summary: CF_WORKER_URLS.progress_summary,
  };

  // ============================================================

  // Detect the current environment
  const currentHost = window.location.hostname;
  
  // Netlify functions base URL
  const NETLIFY_FUNCTIONS_URL = 'https://willenaenglish.netlify.app';
  
  // Determine if we're on GitHub Pages or a custom domain pointing to GH Pages
  const isGitHubPages = currentHost === 'willenaenglish.github.io';
  // Custom domain now served by Cloudflare Pages - treat as Cloudflare ecosystem
  const isCustomDomain = currentHost === 'willenaenglish.com' || currentHost === 'www.willenaenglish.com';
  // Cloudflare Pages: includes cf subdomain, custom domain, and *.pages.dev previews
  const isCloudflarePages = isCustomDomain || currentHost === 'cf.willenaenglish.com' || currentHost.endsWith('.pages.dev');
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  const isNetlify = currentHost.includes('netlify.app') || currentHost.includes('netlify.com');
  
  // For cross-origin requests (GitHub Pages only now), we need special handling
  // Cloudflare Pages (including willenaenglish.com) uses api.willenaenglish.com with same-root cookies
  const isCrossOrigin = isGitHubPages;
  
  // Cloudflare Pages with api.willenaenglish.com uses same-root cookies (Domain=.willenaenglish.com)
  // so it's NOT a problematic cross-origin scenario for cookies
  const isCloudflareEcosystem = isCloudflarePages || currentHost === 'api.willenaenglish.com';
  
  // Detect browsers that ALWAYS block third-party cookies (Safari ITP, Samsung Internet, Brave, etc.)
  const isKnownCookieBlockingBrowser = (() => {
    const ua = navigator.userAgent || '';
    // Safari (including iOS Safari) - has Intelligent Tracking Prevention
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Opera/.test(ua);
    // Samsung Internet - has Smart Anti-Tracking
    const isSamsungInternet = /SamsungBrowser/.test(ua);
    // Brave browser - blocks third-party cookies by default
    const isBrave = typeof navigator.brave !== 'undefined';
    
    return isSafari || isSamsungInternet || isBrave;
  })();

  // For Chrome/Firefox/Edge in incognito/private mode, we can't detect via UA.
  // Use a session flag + async test approach for those cases.
  // This flag gets set by testCrossOriginCookies() if cookies fail.
  let _crossOriginCookiesFailed = false;

  // Synchronous check: known blockers OR previously detected failure
  const isThirdPartyCookiesBlocked = () => isKnownCookieBlockingBrowser || _crossOriginCookiesFailed;

  /**
   * Async test: call Netlify function to set a test cookie, then call again to verify it's sent back.
   * Returns true if cross-origin cookies work, false otherwise.
   * Sets _crossOriginCookiesFailed flag as side effect.
   */
  async function testCrossOriginCookies() {
    if (!isCrossOrigin) return true; // same-origin, cookies always work
    if (isKnownCookieBlockingBrowser) {
      _crossOriginCookiesFailed = true;
      return false;
    }
    try {
      // Use cookie_echo endpoint to check if any auth cookies are present
      // If user was logged in before, cookies should be sent. If not, that's also fine for this test.
      // The real test is: after login, do cookies come back on subsequent requests?
      // For a quick pre-login check, we test if the browser sends ANY cookies to the cross-origin.
      const resp = await fetch(NETLIFY_FUNCTIONS_URL + '/.netlify/functions/supabase_auth?action=cookie_echo&_t=' + Date.now(), {
        method: 'GET',
        credentials: 'include'
      });
      const data = await resp.json();
      // If we get a response, the request worked. The cookie_echo tells us if cookies were received.
      // For incognito without prior login, hasAccess will be false - that's expected.
      // The test passes if we got a valid response (cookies CAN be sent, even if none exist yet).
      // We'll rely on a post-login check for the real validation.
      return true;
    } catch (e) {
      console.warn('[WillenaAPI] Cross-origin cookie test failed:', e.message);
      _crossOriginCookiesFailed = true;
      return false;
    }
  }

  /**
   * Quick synchronous check to see if we should redirect immediately.
   * For unknown browsers (Chrome incognito), we DON'T redirect immediately -
   * we let them try to login, and if whoami fails right after, then redirect.
   * NOTE: Cloudflare Pages (cf.willenaenglish.com) uses same-root cookies so no redirect needed.
   */
  const shouldRedirectImmediately = () => isCrossOrigin && !isCloudflarePages && isKnownCookieBlockingBrowser;
  
  // Set API base URL based on environment
  let API_BASE = '';
  
  if (isCloudflarePages) {
    // On Cloudflare Pages (willenaenglish.com, cf.willenaenglish.com, *.pages.dev)
    // Use the CF proxy - cookies work with Domain=.willenaenglish.com
    API_BASE = 'https://api-cf.willenaenglish.com';
  } else if (isGitHubPages) {
    // On GitHub Pages - use full Netlify URL for functions
    API_BASE = NETLIFY_FUNCTIONS_URL;
  } else if (isLocalhost) {
    // Local development - use relative path for local netlify dev (port 8888 or 9000)
    API_BASE = '';
  } else if (isNetlify) {
    // On Netlify - use relative paths
    API_BASE = '';
  } else {
    // Unknown environment - default to Netlify
    API_BASE = NETLIFY_FUNCTIONS_URL;
  }

  // --- Development override for localhost ---
  // In `netlify dev`, the local Cloudflare workers (wrangler dev on 8787-8790)
  // may not be running. Keep rollout at 0 by default to avoid connection refused.
  // If you ARE running wrangler dev locally and want to hit it, call:
  //   WillenaAPI.setRolloutPercent(100)
  if (isLocalhost) {
    // Keep localhost using the default rollout (0%) unless explicitly changed at runtime
    CF_ROLLOUT_PERCENT = 0;
    CF_SHADOW_MODE = false;
    console.log('[WillenaAPI] DEV MODE: CF_ROLLOUT_PERCENT=0 (local workers disabled by default). Use setRolloutPercent(100) to enable.');
  }

  /**
   * Check if this request should go to Cloudflare Worker
   * @param {string} functionName - The function name (e.g., 'get_audio_urls')
   * @returns {boolean}
   */
  function getRolloutPercent(functionName) {
    if (Object.prototype.hasOwnProperty.call(CF_ROLLOUT_PERCENT_BY_FN, functionName)) {
      return Number(CF_ROLLOUT_PERCENT_BY_FN[functionName]) || 0;
    }
    return CF_ROLLOUT_PERCENT;
  }

  function shouldUseCloudflare(functionName) {
    if (!CF_MIGRATED_FUNCTIONS[functionName]) return false;
    const rollout = getRolloutPercent(functionName);
    if (rollout <= 0) return false;
    if (rollout >= 100) return true;
    return Math.random() * 100 < rollout;
  }

  /**
   * Extract function name from path
   * @param {string} functionPath 
   * @returns {string}
   */
  function extractFunctionName(functionPath) {
    const match = functionPath.match(/\/?\.?netlify\/functions\/([^/?]+)/);
    return match ? match[1] : '';
  }

  /**
   * Get the full URL for a Netlify function
   * @param {string} functionPath - The function path (e.g., '/.netlify/functions/auth')
   * @returns {string} The full URL
   */
  function getApiUrl(functionPath) {
    // Local dev: rewrite to local worker ports ONLY if rollout > 0
    // Otherwise keep relative paths so netlify dev handles them
    if (isLocalhost) {
      const fn = extractFunctionName(functionPath);
      const rollout = getRolloutPercent(fn);
      if (rollout > 0) {
        const base = LOCAL_WORKER_MAP[fn];
        if (base) {
          // remove the "/.netlify/functions/<name>" prefix and keep query string
          const pathOnly = functionPath.split('?')[0];
          const query = functionPath.includes('?') ? functionPath.slice(functionPath.indexOf('?')) : '';
          const suffix = pathOnly.replace(new RegExp(`^/?\.?netlify/functions/${fn}/?`), '');
          return base + '/' + suffix + query;
        }
      }
    }

    // If already a full URL, return as-is
    if (functionPath.startsWith('http://') || functionPath.startsWith('https://')) {
      return functionPath;
    }
    // Ensure path starts with /.netlify/functions/
    if (!functionPath.startsWith('/.netlify/functions/')) {
      if (functionPath.startsWith('/')) {
        functionPath = '/.netlify/functions' + functionPath;
      } else {
        functionPath = '/.netlify/functions/' + functionPath;
      }
    }
    return API_BASE + functionPath;
  }

  /**
   * Wrapper for fetch that automatically handles credentials for cross-origin requests
   * AND supports Cloudflare Worker migration
   * @param {string} functionPath - The function path
   * @param {RequestInit} options - Fetch options
   * @returns {Promise<Response>}
   */
  async function apiFetch(functionPath, options = {}) {
    const functionName = extractFunctionName(functionPath);
    const useCloudflare = shouldUseCloudflare(functionName);
    const cfWorkerUrl = CF_MIGRATED_FUNCTIONS[functionName];
    
    // Determine primary URL
    let primaryUrl;
    
    // If functionPath is already a full URL, extract just the path portion for routing
    let pathForRouting = functionPath;
    if (functionPath.startsWith('http://') || functionPath.startsWith('https://')) {
      try {
        const parsedUrl = new URL(functionPath);
        pathForRouting = parsedUrl.pathname + parsedUrl.search;
      } catch (e) {
        // If URL parsing fails, use as-is
        pathForRouting = functionPath;
      }
    }
    
    // LOCAL DEV: use local worker ports only when rollout wants Cloudflare
    if (isLocalhost && LOCAL_WORKER_MAP[functionName] && useCloudflare) {
      const base = LOCAL_WORKER_MAP[functionName];
      const query = pathForRouting.includes('?') ? pathForRouting.slice(pathForRouting.indexOf('?')) : '';
      primaryUrl = base + '/' + query;
      console.log(`[WillenaAPI] ${functionName}: using local worker ${base}`);
    } else if (useCloudflare && cfWorkerUrl) {
      // Using the CF proxy at api-cf.willenaenglish.com
      // The proxy expects the full path like /.netlify/functions/progress_summary?section=kpi
      // Extract query string and build the full URL with Netlify-style path
      const query = pathForRouting.includes('?') ? pathForRouting.slice(pathForRouting.indexOf('?')) : '';
      primaryUrl = `${cfWorkerUrl}/.netlify/functions/${functionName}${query}`;
      console.log(`[WillenaAPI] ${functionName}: using CF Proxy -> ${primaryUrl}`);
    } else {
      primaryUrl = getApiUrl(functionPath);
    }
    
    // Always include credentials for cookie-based auth
    const fetchOptions = {
      ...options,
      credentials: 'include',
    };
    
    // LOCAL DEV: inject Authorization header when using local workers
    // Since cross-origin cookies won't work between localhost and local worker ports,
    // inject the local token when this call will be routed to Cloudflare (per-function).
    if (isLocalhost && useCloudflare) {
      const localToken = getLocalToken();
      if (localToken) {
        // Inject for ALL auth-requiring functions (not just supabase_auth)
        const authFunctions = ['supabase_auth', 'supabase-auth', 'homework_api', 'progress_summary', 'log_word_attempt'];
        if (authFunctions.includes(functionName)) {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Authorization': `Bearer ${localToken}`,
          };
          console.log(`[WillenaAPI] Injected local token for ${functionName}`);
        }
      } else if (['supabase_auth', 'homework_api', 'progress_summary'].includes(functionName)) {
        console.log(`[WillenaAPI] No local token found for ${functionName}`);
      }
    }
    
    // For cross-origin requests with body, ensure Content-Type is set
    if ((isCrossOrigin || useCloudflare) && options.body && !options.headers?.['Content-Type']) {
      fetchOptions.headers = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      };
    }
    
    // Shadow mode: call both endpoints, use Netlify response
    if (CF_SHADOW_MODE && cfWorkerUrl && !useCloudflare) {
      // Fire shadow request to Cloudflare (don't await)
      fetch(cfWorkerUrl, { ...fetchOptions, credentials: 'omit' })
        .then(r => r.json())
        .then(data => console.log(`[CF Shadow] ${functionName}:`, data))
        .catch(e => console.warn(`[CF Shadow Error] ${functionName}:`, e.message));
    }
    
    // Log which endpoint we're using (in dev)
    if (isLocalhost && cfWorkerUrl) {
      console.log(`[WillenaAPI] ${functionName}: using ${useCloudflare ? 'Cloudflare' : 'Netlify'}`);
    }

    // Safety: some callers mistakenly call get_audio_urls with GET (no body).
    // The Cloudflare worker expects POST to `/` with a JSON body. If a
    // caller forgot to set method, force POST here so the worker receives
    // the intended verb (prevents a 405 from GET to the worker root).
    if (functionName === 'get_audio_urls' && !fetchOptions.method) {
      fetchOptions.method = 'POST';
      fetchOptions.headers = fetchOptions.headers || {};
      if (options.body && !fetchOptions.headers['Content-Type']) {
        fetchOptions.headers['Content-Type'] = 'application/json';
      }
    }
    
    const res = await fetch(primaryUrl, fetchOptions).catch(err => {
      return new Response(JSON.stringify({ success:false, error:String(err.message||err) }), { status: 520, headers: { 'Content-Type':'application/json' } });
    });

    // DEV SAFETY: if a Cloudflare-routed call to progress_summary is unauthorized,
    // transparently retry against Netlify to avoid triggering logout flows.
    if (useCloudflare && functionName === 'progress_summary' && res && (res.status === 401 || res.status === 403)) {
      try {
        const fallbackUrl = getApiUrl(functionPath);
        const fallbackRes = await fetch(fallbackUrl, { ...fetchOptions, credentials: 'include' });
        return fallbackRes;
      } catch {
        return res;
      }
    }

    return res;
  }

  // --- Local dev token storage ---
  // On localhost with local workers, cross-origin cookies don't work between
  // localhost:9000 (page) and 127.0.0.1:8787 (worker). Use localStorage instead.
  const LOCAL_TOKEN_KEY = 'sb_local_access';
  const LOCAL_REFRESH_KEY = 'sb_local_refresh';

  function getLocalToken() {
    if (!isLocalhost) return null;
    try { return localStorage.getItem(LOCAL_TOKEN_KEY); } catch { return null; }
  }

  function setLocalTokens(access, refresh) {
    if (!isLocalhost) return;
    try {
      if (access) localStorage.setItem(LOCAL_TOKEN_KEY, access);
      if (refresh) localStorage.setItem(LOCAL_REFRESH_KEY, refresh);
    } catch {}
  }

  function clearLocalTokens() {
    try {
      localStorage.removeItem(LOCAL_TOKEN_KEY);
      localStorage.removeItem(LOCAL_REFRESH_KEY);
    } catch {}
  }

  // Export to window for global access
  window.WillenaAPI = {
    BASE_URL: API_BASE,
    FUNCTIONS_URL: NETLIFY_FUNCTIONS_URL,
    CF_WORKER_BASE,
    CF_WORKER_URLS,
    CF_ROLLOUT_PERCENT,
    CF_SHADOW_MODE,
    CF_MIGRATED_FUNCTIONS,
    isGitHubPages,
    isCustomDomain,
    isCloudflarePages,
    isCloudflareEcosystem,
    isLocalhost,
    isNetlify,
    isCrossOrigin,
    getApiUrl,
    fetch: apiFetch,
    shouldUseCloudflare,
    CF_ROLLOUT_PERCENT_BY_FN,
    
    // Convenience method to check environment
    getEnvironment() {
      if (isLocalhost) return 'local';
      if (isNetlify) return 'netlify';
      if (isGitHubPages) return 'github-pages';
      if (isCustomDomain) return 'custom-domain';
      return 'unknown';
    },
    
    // Method to dynamically change rollout percentage (for testing)
    setRolloutPercent(percent) {
      console.log(`[WillenaAPI] Rollout changed: ${CF_ROLLOUT_PERCENT}% -> ${percent}%`);
      CF_ROLLOUT_PERCENT = Number(percent) || 0;
    },

    // Set rollout for a specific function (overrides global). Example:
    //   WillenaAPI.setFunctionRollout('progress_summary', 100);
    setFunctionRollout(functionName, percent) {
      if (!functionName) return;
      const prev = CF_ROLLOUT_PERCENT_BY_FN[functionName];
      const next = Number(percent) || 0;
      CF_ROLLOUT_PERCENT_BY_FN[functionName] = next;
      console.log(`[WillenaAPI] Rollout (${functionName}): ${prev || 0}% -> ${next}%`);
    },

    // Local dev token storage (for cross-origin worker auth)
    getLocalToken,
    setLocalTokens,
    clearLocalTokens,

    // Check if third-party cookies are likely blocked (sync check)
    isThirdPartyCookiesBlocked,
    
    // Check if we KNOW for sure cookies are blocked (Safari, Samsung, Brave)
    isKnownCookieBlockingBrowser,
    
    // Async test for cross-origin cookies
    testCrossOriginCookies,
    
    // Mark cookies as failed (call this after whoami returns 401 right after login)
    markCookiesFailed() {
      _crossOriginCookiesFailed = true;
    },

    // For cross-origin + blocked cookies scenario, redirect to Netlify-hosted version
    // This ensures cookies work properly for authentication
    redirectToNetlifyIfNeeded(pathname) {
      if (isCrossOrigin && isThirdPartyCookiesBlocked()) {
        const targetUrl = NETLIFY_FUNCTIONS_URL + (pathname || window.location.pathname + window.location.search);
        console.log('[WillenaAPI] Redirecting to Netlify for cookie support:', targetUrl);
        window.location.replace(targetUrl);
        return true;
      }
      return false;
    },
    
    // Redirect immediately only for KNOWN cookie-blocking browsers
    // For unknown (Chrome incognito), we let them try first
    shouldRedirectImmediately,

    // Get the Netlify-hosted URL for the current page (useful for login redirects)
    getNetlifyUrl(pathname) {
      return NETLIFY_FUNCTIONS_URL + (pathname || window.location.pathname);
    },

    // Check if we should show a cookie warning (sync, for known blockers)
    shouldShowCookieWarning() {
      return isCrossOrigin && isKnownCookieBlockingBrowser;
    }
  };

  // Log configuration in development
  if (isLocalhost || isGitHubPages) {
    console.log('[WillenaAPI] Environment:', window.WillenaAPI.getEnvironment());
    console.log('[WillenaAPI] Base URL:', API_BASE || '(relative)');
    console.log('[WillenaAPI] Cross-origin mode:', isCrossOrigin);
    console.log('[WillenaAPI] CF Rollout:', CF_ROLLOUT_PERCENT + '%');
    console.log('[WillenaAPI] CF Shadow Mode:', CF_SHADOW_MODE);
  }
})();
