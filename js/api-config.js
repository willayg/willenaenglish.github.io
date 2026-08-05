/**
 * API Configuration - Simple and Deterministic
 * VERSION: 2026-08-06 AUTH HOTFIX
 *
 * Authentication must use api.willenaenglish.com on Willena custom domains.
 * A workers.dev response cannot set a .willenaenglish.com cookie, which causes
 * a successful login followed immediately by an auth redirect loop.
 */

(function() {
  'use strict';

  const GITHUB_PAGES_HOST = 'willenaenglish.github.io';
  const NETLIFY_BASE = 'https://students.willenaenglish.com';
  const USE_CF_WORKERS = true;
  const CF_FUNCTIONS = {
    supabase_auth: 'https://api.willenaenglish.com/.netlify/functions/supabase_auth',
    verify_student: 'https://verify-student.willena.workers.dev',
  };

  const NETLIFY_ONLY_FUNCTIONS = [
    'verify_student','set_student_password','debug_student_data','openai_proxy',
    'pixabay','google_vision_proxy','supabase_proxy','supabase_proxy_fixed',
    'teacher_admin','test_admin','eleven_labs_proxy','translate','define_word',
  ];

  const currentHost = window.location.hostname;
  const isGitHubPages = currentHost === GITHUB_PAGES_HOST;
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  const isProduction = !isGitHubPages;
  const isCrossOrigin = isGitHubPages;
  const isNetlifyApp = currentHost === 'students.willenaenglish.com';
  const API_BASE = (isNetlifyApp || isLocalhost) ? '' : NETLIFY_BASE;

  const isKnownCookieBlockingBrowser = (() => {
    const ua = navigator.userAgent || '';
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Opera/.test(ua);
    const isSamsungInternet = /SamsungBrowser/.test(ua);
    const isBrave = typeof navigator.brave !== 'undefined';
    return isSafari || isSamsungInternet || isBrave;
  })();

  let _crossOriginCookiesFailed = false;
  const isThirdPartyCookiesBlocked = () => isKnownCookieBlockingBrowser || _crossOriginCookiesFailed;

  function extractFunctionName(functionPath) {
    const match = String(functionPath || '').match(/\/?\.?netlify\/functions\/([^\/?]+)/);
    return match ? match[1] : '';
  }

  function getApiUrl(functionPath) {
    if (functionPath.startsWith('http://') || functionPath.startsWith('https://')) return functionPath;
    const fn = extractFunctionName(functionPath);
    if (USE_CF_WORKERS && fn && CF_FUNCTIONS[fn]) {
      const qIndex = functionPath.indexOf('?');
      const search = qIndex >= 0 ? functionPath.slice(qIndex) : '';
      return CF_FUNCTIONS[fn] + search;
    }
    if (!functionPath.startsWith('/.netlify/functions/')) {
      functionPath = functionPath.startsWith('/')
        ? '/.netlify/functions' + functionPath
        : '/.netlify/functions/' + functionPath;
    }
    return API_BASE + functionPath;
  }

  async function safeParseJSON(response) {
    let responseText;
    try { responseText = await response.text(); }
    catch { return { success:false, error:'Failed to read response', _parseError:true }; }
    if (!responseText || !responseText.trim()) return { success:false, error:'Empty response', _parseError:true };
    try { return JSON.parse(responseText); }
    catch { return { success:false, error:'Invalid JSON response', _parseError:true }; }
  }

  async function apiFetch(functionPath, options = {}) {
    const url = getApiUrl(functionPath);
    const fetchOptions = { ...options, credentials:'include' };
    if (options.body) {
      const hasContentType = options.headers && Object.keys(options.headers).some(k => k.toLowerCase() === 'content-type');
      if (!hasContentType) fetchOptions.headers = { 'Content-Type':'application/json', ...fetchOptions.headers };
    }
    const existingAuth = fetchOptions.headers && (fetchOptions.headers.Authorization || fetchOptions.headers.authorization);
    if (!existingAuth) {
      let localToken = null;
      try { localToken = localStorage.getItem('sb_access_token') || null; } catch {}
      if (localToken && localToken.includes('.') && localToken.length > 50) {
        fetchOptions.headers = { ...fetchOptions.headers, Authorization:`Bearer ${localToken}` };
      }
    }
    return fetch(url, fetchOptions);
  }

  const shouldRedirectImmediately = () => isCrossOrigin && isKnownCookieBlockingBrowser;
  function redirectToNetlifyIfNeeded(pathname) {
    if (isCrossOrigin && isThirdPartyCookiesBlocked()) {
      window.location.replace(NETLIFY_BASE + (pathname || window.location.pathname + window.location.search));
      return true;
    }
    return false;
  }

  window.WillenaAPI = {
    getApiUrl,
    fetch: apiFetch,
    safeParseJSON,
    BASE_URL: API_BASE,
    FUNCTIONS_URL: NETLIFY_BASE,
    isGitHubPages,
    isLocalhost,
    isProduction,
    isCrossOrigin,
    isThirdPartyCookiesBlocked,
    isKnownCookieBlockingBrowser,
    markCookiesFailed() { _crossOriginCookiesFailed = true; },
    shouldRedirectImmediately,
    redirectToNetlifyIfNeeded,
    getNetlifyUrl(pathname) { return NETLIFY_BASE + (pathname || window.location.pathname); },
    shouldShowCookieWarning() { return isCrossOrigin && isKnownCookieBlockingBrowser; },
    getEnvironment() { if (isLocalhost) return 'local'; if (isGitHubPages) return 'github-pages'; return 'production'; },
    setLocalTokens(accessToken, refreshToken) {
      try {
        if (accessToken) localStorage.setItem('sb_access_token', accessToken);
        if (refreshToken) localStorage.setItem('sb_refresh_token', refreshToken);
      } catch {}
    },
    getLocalAccessToken() { try { return localStorage.getItem('sb_access_token') || null; } catch { return null; } },
    clearLocalTokens() {
      try { localStorage.removeItem('sb_access_token'); localStorage.removeItem('sb_refresh_token'); } catch {}
    },
    CF_ROLLOUT_PERCENT: 100,
    CF_SHADOW_MODE: false,
    shouldUseCloudflare: () => USE_CF_WORKERS,
    setRolloutPercent: () => {},
    setFunctionRollout: () => {},
  };
})();
