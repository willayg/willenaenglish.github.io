/**
 * API Configuration - Simple and Deterministic
 * VERSION: 2025-12-16 HOTFIX
 * 
 * PRODUCTION (willenaenglish.com, www.willenaenglish.com, cf.willenaenglish.com, students.willenaenglish.com, localhost):
 *   → Relative paths only: /.netlify/functions/<name>
 *   → Same-origin requests, cookies work automatically
 *   → NO absolute URLs, NO proxy domains, NO api-cf.*
 *
 * GITHUB PAGES (willenaenglish.github.io):
 *   → Absolute URL to students domain: https://students.willenaenglish.com/.netlify/functions/<name>
 *   → Cross-origin, requires credentials: 'include'
 *   → Known cookie-blocking browsers redirected to students domain
 */

(function() {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================
  const GITHUB_PAGES_HOST = 'willenaenglish.github.io';
  const NETLIFY_BASE = 'https://students.willenaenglish.com';
  // Cloudflare worker endpoints - ONLY use on localhost for testing
  // On production/staging, use relative paths to same-origin /api/* routes
  const CF_FUNCTIONS = {
    supabase_auth: 'https://supabase-auth.willena.workers.dev',
    verify_student: 'https://verify-student.willena.workers.dev',
  };
  // Only enable workers.dev routing on localhost (for dev testing)
  // Production/staging use relative /api/* paths (same-origin, no CORS issues)
  const USE_CF_WORKERS = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  // Functions that are Netlify-only (not migrated) - these ALWAYS use NETLIFY_FUNCTIONS_URL
  // even when CF_ROLLOUT_PERCENT is 100
  const NETLIFY_ONLY_FUNCTIONS = [
    'verify_student',
    'set_student_password',
    'debug_student_data',
    'openai_proxy',
    'pixabay',
    'google_vision_proxy',
    'supabase_proxy',
    'supabase_proxy_fixed',
    'teacher_admin',
    'test_admin',
    'eleven_labs_proxy',
    'translate',
    'define_word',
  ];

  // ============================================================
  // ENVIRONMENT DETECTION (minimal)
  // ============================================================
  const currentHost = window.location.hostname;
  const isGitHubPages = currentHost === GITHUB_PAGES_HOST;
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  
  // Production = everything except GitHub Pages
  // On production, we ONLY use relative paths
  const isProduction = !isGitHubPages;
  
  // Cross-origin only applies to GitHub Pages
  const isCrossOrigin = isGitHubPages;

  // ============================================================
  // API BASE - Simple rule
  // ============================================================
  // First-party domains (staging, prod, etc.): relative paths for same-origin auth with CF workers
  // GitHub Pages only: absolute URL (cross-origin)
  const isFirstPartyDomain = currentHost.endsWith('.willenaenglish.com') || 
                              currentHost === 'willenaenglish.com' || 
                              currentHost === 'localhost' || 
                              currentHost === '127.0.0.1';
  
  // Use relative paths on all first-party domains (enables same-origin CF worker auth)
  // Only GitHub Pages needs absolute URLs
  const API_BASE = isFirstPartyDomain ? '' : NETLIFY_BASE;

  // ============================================================
  // COOKIE BLOCKING DETECTION (for GitHub Pages redirect)
  // ============================================================
  const isKnownCookieBlockingBrowser = (() => {
    const ua = navigator.userAgent || '';
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Opera/.test(ua);
    const isSamsungInternet = /SamsungBrowser/.test(ua);
    const isBrave = typeof navigator.brave !== 'undefined';
    return isSafari || isSamsungInternet || isBrave;
  })();

  let _crossOriginCookiesFailed = false;
  const isThirdPartyCookiesBlocked = () => isKnownCookieBlockingBrowser || _crossOriginCookiesFailed;

  // ============================================================
  // CORE API FUNCTIONS
  // ============================================================

  /**
   * Get the full URL for a Netlify function.
   * Production: returns relative path (e.g., /.netlify/functions/auth)
   * GitHub Pages: returns absolute Netlify URL
   */
  function getApiUrl(functionPath) {
    // If already a full URL, return as-is
    if (functionPath.startsWith('http://') || functionPath.startsWith('https://')) {
      return functionPath;
    }

    const fn = extractFunctionName(functionPath);
    if (USE_CF_WORKERS && fn && CF_FUNCTIONS[fn]) {
      const qIndex = functionPath.indexOf('?');
      const search = qIndex >= 0 ? functionPath.slice(qIndex) : '';
      return CF_FUNCTIONS[fn] + search;
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
   * Extract function name from path
   */
  function extractFunctionName(functionPath) {
    const match = functionPath.match(/\/?\.?netlify\/functions\/([^\/?]+)/);
    return match ? match[1] : '';
  }

  /**
   * Safe JSON parser for API responses.
   * BUG FIX: Handles HTML error pages, empty responses, and malformed JSON gracefully.
   * Returns { success: false, error: string } on parse failure instead of throwing.
   */
  async function safeParseJSON(response) {
    const contentType = response.headers.get('content-type') || '';
    let responseText;
    try {
      responseText = await response.text();
    } catch (e) {
      console.error('[WillenaAPI] Failed to read response text:', e);
      return { success: false, error: 'Failed to read response', _parseError: true };
    }
    
    // Empty response
    if (!responseText || !responseText.trim()) {
      console.warn('[WillenaAPI] Empty response body');
      return { success: false, error: 'Empty response', _parseError: true };
    }
    
    // Non-JSON content type (likely HTML error page)
    if (!contentType.includes('application/json')) {
      console.error('[WillenaAPI] Non-JSON response (content-type:', contentType, '), body:', responseText.substring(0, 200));
      return { success: false, error: 'Server error (non-JSON response)', _parseError: true };
    }
    
    // Try to parse JSON
    try {
      return JSON.parse(responseText);
    } catch (e) {
      console.error('[WillenaAPI] JSON parse error:', e, 'Body:', responseText.substring(0, 200));
      return { success: false, error: 'Invalid JSON response', _parseError: true };
    }
  }

  /**
   * Wrapper for fetch that handles credentials.
   * Does NOT do any fancy routing - just adds credentials: 'include'.
   * Background fetch failures do NOT trigger logout.
   */
  async function apiFetch(functionPath, options = {}) {
    const url = getApiUrl(functionPath);
    
    const fetchOptions = {
      ...options,
      credentials: 'include',
    };
    
    // For requests with body, ensure Content-Type is set (case-insensitive check)
    if (options.body) {
      const hasContentType = options.headers && 
        Object.keys(options.headers).some(k => k.toLowerCase() === 'content-type');
      if (!hasContentType) {
        fetchOptions.headers = {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        };
      }
    }
    
    // Add Authorization header from localStorage if token exists and no auth header already present
    // This is a fallback for when cookies fail (e.g., on some browsers/incognito modes)
    // IMPORTANT: Only send Authorization if we have a valid non-empty token to avoid interfering with cookie-based auth
    const existingAuth = (fetchOptions.headers && (fetchOptions.headers.Authorization || fetchOptions.headers.authorization));
    if (!existingAuth) {
      let localToken = null;
      try {
        localToken = localStorage.getItem('sb_access_token') || null;
      } catch (e) {
        // localStorage not available or blocked
      }
      
      // Only add Authorization header if we have a valid token that looks like a JWT (contains dots)
      if (localToken && localToken.includes('.') && localToken.length > 50) {
        fetchOptions.headers = {
          ...fetchOptions.headers,
          'Authorization': `Bearer ${localToken}`
        };
        console.log('[WillenaAPI] Added Authorization header from localStorage (token length:', localToken.length + ')');
      }
    }

    
    // Debug logging for POST requests
    if (options.method === 'POST' || options.body) {
      console.log('[WillenaAPI] POST request:', url, 'body:', options.body ? options.body.substring(0, 100) : '(none)');
    }
    
    try {
      const res = await fetch(url, fetchOptions);
      return res;
    } catch (err) {
      console.error('[WillenaAPI] Fetch error:', err);
      throw err;
    }
  }

  // ============================================================
  // GITHUB PAGES HELPERS (redirect to Netlify if cookies blocked)
  // ============================================================
  
  const shouldRedirectImmediately = () => isCrossOrigin && isKnownCookieBlockingBrowser;

  function redirectToNetlifyIfNeeded(pathname) {
    if (isCrossOrigin && isThirdPartyCookiesBlocked()) {
      const targetUrl = NETLIFY_BASE + (pathname || window.location.pathname + window.location.search);
      console.log('[WillenaAPI] Redirecting to Netlify for cookie support:', targetUrl);
      window.location.replace(targetUrl);
      return true;
    }
    return false;
  }

  // ============================================================
  // EXPORT
  // ============================================================
  window.WillenaAPI = {
    // Core API
    getApiUrl,
    fetch: apiFetch,
    safeParseJSON,  // Safe JSON parsing that handles HTML error pages
    
    // Environment info (read-only)
    BASE_URL: API_BASE,
    FUNCTIONS_URL: NETLIFY_BASE,
    isGitHubPages,
    isLocalhost,
    isProduction,
    isCrossOrigin,
    
    // Cookie detection (for GitHub Pages)
    isThirdPartyCookiesBlocked,
    isKnownCookieBlockingBrowser,
    markCookiesFailed() { _crossOriginCookiesFailed = true; },
    
    // Redirect helpers (for GitHub Pages)
    shouldRedirectImmediately,
    redirectToNetlifyIfNeeded,
    getNetlifyUrl(pathname) {
      return NETLIFY_BASE + (pathname || window.location.pathname);
    },
    shouldShowCookieWarning() {
      return isCrossOrigin && isKnownCookieBlockingBrowser;
    },
    
    // Environment helper
    getEnvironment() {
      if (isLocalhost) return 'local';
      if (isGitHubPages) return 'github-pages';
      return 'production';
    },

    // Token storage helpers - fallback for when cookies fail
    // Store access/refresh tokens in localStorage (used when cookies are blocked/not persisting)
    setLocalTokens(accessToken, refreshToken) {
      try {
        if (accessToken) localStorage.setItem('sb_access_token', accessToken);
        if (refreshToken) localStorage.setItem('sb_refresh_token', refreshToken);
        console.log('[WillenaAPI] Tokens stored in localStorage');
      } catch (e) {
        console.warn('[WillenaAPI] Failed to store tokens in localStorage:', e);
      }
    },
    
    // Get stored access token from localStorage
    getLocalAccessToken() {
      try {
        return localStorage.getItem('sb_access_token') || null;
      } catch (e) {
        console.warn('[WillenaAPI] Failed to read access token from localStorage:', e);
        return null;
      }
    },
    
    // Clear stored tokens from localStorage
    clearLocalTokens() {
      try {
        localStorage.removeItem('sb_access_token');
        localStorage.removeItem('sb_refresh_token');
        console.log('[WillenaAPI] Tokens cleared from localStorage');
      } catch (e) {
        console.warn('[WillenaAPI] Failed to clear tokens from localStorage:', e);
      }
 { _crossOriginCookiesFailed = true; },
    
    // Redirect helpers (for GitHub Pages)
    shouldRedirectImmediately,
    redirectToNetlifyIfNeeded,
    getNetlifyUrl(pathname) {
      return NETLIFY_BASE + (pathname || window.location.pathname);
    },
    shouldShowCookieWarning() {
      return isCrossOrigin && isKnownCookieBlockingBrowser;
    },
    
    // Environment helper
    getEnvironment() {
      if (isLocalhost) return 'local';
      if (isGitHubPages) return 'github-pages';
      return 'production';
    },

    // Token storage helpers - fallback for when cookies fail
    // Store access/refresh tokens in localStorage (used when cookies are blocked/not persisting)
    setLocalTokens(accessToken, refreshToken) {
      try {
        if (accessToken) localStorage.setItem('sb_access_token', accessToken);
        if (refreshToken) localStorage.setItem('sb_refresh_token', refreshToken);
        console.log('[WillenaAPI] Tokens stored in localStorage');
      } catch (e) {
        console.warn('[WillenaAPI] Failed to store tokens in localStorage:', e);
      }
    },
    
    // Get stored access token from localStorage
    getLocalAccessToken() {
      try {
        return localStorage.getItem('sb_access_token') || null;
      } catch (e) {
        console.warn('[WillenaAPI] Failed to read access token from localStorage:', e);
        return null;
      }
    },
    
    // Clear stored tokens from localStorage
    clearLocalTokens() {
      try {
        localStorage.removeItem('sb_access_token');
        localStorage.removeItem('sb_refresh_token');
        console.log('[WillenaAPI] Tokens cleared from localStorage');
      } catch (e) {
        console.warn('[WillenaAPI] Failed to clear tokens from localStorage:', e);
      }
    },

    // Legacy compatibility stubs (CF migration disabled)
    CF_ROLLOUT_PERCENT: 100,
    CF_SHADOW_MODE: false,
    shouldUseCloudflare: () => USE_CF_WORKERS,
    setRolloutPercent: () => {},
    setFunctionRollout: () => {},
  };
  // Log configuration (dev only)
  if (isLocalhost || isGitHubPages) {
    console.log('[WillenaAPI] Environment:', window.WillenaAPI.getEnvironment());
    console.log('[WillenaAPI] Base URL:', API_BASE || '(relative/same-origin)');
    console.log('[WillenaAPI] Cross-origin:', isCrossOrigin);
  }
})();