/**
 * API Configuration - Simple and Deterministic
 * VERSION: 2025-12-16 HOTFIX
 * 
 * All environments:
 *   → Use /api/<name> routes.
 *   → Default base origin: https://api.willenaenglish.com
 *   → Cookies should be HTTP-only; do not store tokens client-side.
 */

(function() {
  'use strict';

  // ============================================================
  // CONSTANTS
  // ============================================================
  const GITHUB_PAGES_HOST = 'willenaenglish.github.io';
  const API_GATEWAY_ORIGIN = 'https://api.willenaenglish.com';
  // Cloudflare worker endpoints (branch testing)
  const USE_CF_WORKERS = true; // enable CF routing on this branch
  const CF_FUNCTIONS = {
    supabase_auth: 'https://supabase-auth.willena.workers.dev',
    verify_student: 'https://verify-student.willena.workers.dev',
  };

  // Note: some endpoints may not be migrated yet. The API gateway will return 404/503
  // for unknown/unbound functions.

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
  // Use api.willenaenglish.com as the default backend origin.
  // - localhost: relative (so local proxy/dev can work)
  // - api.willenaenglish.com itself: relative
  // - everything else: absolute api gateway
  const isApiGatewayHost = currentHost === 'api.willenaenglish.com';
  const API_BASE = (isLocalhost || isApiGatewayHost) ? '' : API_GATEWAY_ORIGIN;

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
   * Get the full URL for an API function.
   * Returns /api/<name> (optionally prefixed by API_BASE).
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

    // Normalize legacy paths (/.netlify/functions/<name>) to /api/<name>
    if (functionPath.startsWith('/.netlify/functions/')) {
      functionPath = '/api/' + functionPath.slice('/.netlify/functions/'.length);
    }

    // Ensure path starts with /api/
    if (!functionPath.startsWith('/api/')) {
      if (functionPath.startsWith('/')) {
        functionPath = '/api' + functionPath;
      } else {
        functionPath = '/api/' + functionPath;
      }
    }

    return API_BASE + functionPath;
  }

  /**
   * Extract function name from path
   */
  function extractFunctionName(functionPath) {
    const match = functionPath.match(/(?:\/?api\/|\/?\.?netlify\/functions\/)([^\/?]+)/);
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
  // EXPORT
  // ============================================================
  window.WillenaAPI = {
    // Core API
    getApiUrl,
    fetch: apiFetch,
    safeParseJSON,  // Safe JSON parsing that handles HTML error pages
    
    // Environment info (read-only)
    BASE_URL: API_BASE,
    isGitHubPages,
    isLocalhost,
    isProduction,
    isCrossOrigin,
    
    // Cookie detection (for GitHub Pages)
    isThirdPartyCookiesBlocked,
    isKnownCookieBlockingBrowser,
    markCookiesFailed() { _crossOriginCookiesFailed = true; },
    
    shouldShowCookieWarning() {
      return isCrossOrigin && isKnownCookieBlockingBrowser;
    },
    
    // Environment helper
    getEnvironment() {
      if (isLocalhost) return 'local';
      if (isGitHubPages) return 'github-pages';
      return 'production';
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