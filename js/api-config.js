/**
 * API Configuration for GitHub Pages + Netlify Functions + Cloudflare Workers
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
  
  // Cloudflare Worker URL (update after deploying)
  const CF_WORKER_BASE = 'https://get-audio-urls.willena.workers.dev';
  
  // Rollout percentage: 0-100 (0 = all Netlify, 100 = all Cloudflare)
  // Change this to gradually shift traffic. Use `setRolloutPercent()` to update at runtime.
  // Default to 100% so production will use Cloudflare Worker for migrated functions.
  let CF_ROLLOUT_PERCENT = 100;
  
  // Shadow mode: if true, calls BOTH endpoints but uses Netlify response
  // Useful for testing parity without affecting users
  let CF_SHADOW_MODE = false;
  
  // Functions that have been migrated to Cloudflare Workers
  const CF_MIGRATED_FUNCTIONS = {
    'get_audio_urls': CF_WORKER_BASE,
    // Add more as you migrate: 'function_name': 'https://worker-url.workers.dev'
  };

  // ============================================================

  // Detect the current environment
  const currentHost = window.location.hostname;
  
  // Netlify functions base URL
  const NETLIFY_FUNCTIONS_URL = 'https://willenaenglish.netlify.app';
  
  // Determine if we're on GitHub Pages or a custom domain pointing to GH Pages
  const isGitHubPages = currentHost === 'willenaenglish.github.io';
  const isCustomDomain = currentHost === 'willenaenglish.com' || currentHost === 'www.willenaenglish.com';
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  const isNetlify = currentHost.includes('netlify.app') || currentHost.includes('netlify.com');
  
  // For cross-origin requests (GitHub Pages or custom domain -> Netlify), we need special handling
  const isCrossOrigin = isGitHubPages || isCustomDomain;
  
  // Detect browsers that block third-party cookies (Safari ITP, Samsung Internet, Brave, etc.)
  // or when in private/incognito mode
  const isThirdPartyCookiesBlocked = (() => {
    const ua = navigator.userAgent || '';
    // Safari (including iOS Safari) - has Intelligent Tracking Prevention
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Opera/.test(ua);
    // Samsung Internet - has Smart Anti-Tracking
    const isSamsungInternet = /SamsungBrowser/.test(ua);
    // Brave browser - blocks third-party cookies by default
    const isBrave = typeof navigator.brave !== 'undefined';
    // Firefox with Enhanced Tracking Protection (can't detect easily, but worth checking)
    const isFirefox = /Firefox/.test(ua);
    
    return isSafari || isSamsungInternet || isBrave;
  })();
  
  // Set API base URL based on environment
  let API_BASE = '';
  
  if (isGitHubPages) {
    // On GitHub Pages - use full Netlify URL for functions
    API_BASE = NETLIFY_FUNCTIONS_URL;
  } else if (isCustomDomain) {
    // Custom domain - check if it points to Netlify or GH Pages
    // For now, assume Netlify functions are still on netlify subdomain
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

  // --- Development override: force Cloudflare rollout on localhost for testing ---
  // When running the frontend on localhost, enable 100% rollout so dev traffic
  // goes to the Cloudflare Worker. This makes it easy to validate real-worker
  // behaviour while serving the app from your local dev server.
  if (isLocalhost) {
    CF_ROLLOUT_PERCENT = 100;
    CF_SHADOW_MODE = false;
    console.log('[WillenaAPI] DEV OVERRIDE: CF_ROLLOUT_PERCENT=100 (all Cloudflare)');
  }

  /**
   * Check if this request should go to Cloudflare Worker
   * @param {string} functionName - The function name (e.g., 'get_audio_urls')
   * @returns {boolean}
   */
  function shouldUseCloudflare(functionName) {
    if (!CF_MIGRATED_FUNCTIONS[functionName]) return false;
    if (CF_ROLLOUT_PERCENT <= 0) return false;
    if (CF_ROLLOUT_PERCENT >= 100) return true;
    return Math.random() * 100 < CF_ROLLOUT_PERCENT;
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
    if (useCloudflare && cfWorkerUrl) {
      primaryUrl = cfWorkerUrl;
    } else {
      primaryUrl = getApiUrl(functionPath);
    }
    
    // Always include credentials for cookie-based auth
    const fetchOptions = {
      ...options,
      credentials: 'include',
    };
    
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
    
    return fetch(primaryUrl, fetchOptions);
  }

  // Export to window for global access
  window.WillenaAPI = {
    BASE_URL: API_BASE,
    FUNCTIONS_URL: NETLIFY_FUNCTIONS_URL,
    CF_WORKER_BASE,
    CF_ROLLOUT_PERCENT,
    CF_SHADOW_MODE,
    CF_MIGRATED_FUNCTIONS,
    isGitHubPages,
    isCustomDomain,
    isLocalhost,
    isNetlify,
    isCrossOrigin,
    getApiUrl,
    fetch: apiFetch,
    shouldUseCloudflare,
    
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

    // Check if third-party cookies are likely blocked
    isThirdPartyCookiesBlocked,

    // For cross-origin + blocked cookies scenario, redirect to Netlify-hosted version
    // This ensures cookies work properly for authentication
    redirectToNetlifyIfNeeded(pathname) {
      if (isCrossOrigin && isThirdPartyCookiesBlocked) {
        const targetUrl = NETLIFY_FUNCTIONS_URL + (pathname || window.location.pathname + window.location.search);
        console.log('[WillenaAPI] Redirecting to Netlify for cookie support:', targetUrl);
        window.location.replace(targetUrl);
        return true;
      }
      return false;
    },

    // Get the Netlify-hosted URL for the current page (useful for login redirects)
    getNetlifyUrl(pathname) {
      return NETLIFY_FUNCTIONS_URL + (pathname || window.location.pathname);
    },

    // Check if we should show a cookie warning
    shouldShowCookieWarning() {
      return isCrossOrigin && isThirdPartyCookiesBlocked;
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
