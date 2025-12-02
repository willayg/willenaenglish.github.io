/**
 * API Configuration for GitHub Pages + Netlify Functions
 * 
 * This file centralizes the API base URL configuration.
 * When hosted on GitHub Pages, API calls go to the Netlify functions domain.
 * When running locally or on Netlify, they use relative paths.
 * 
 * IMPORTANT: For cross-origin cookie authentication to work:
 * 1. Netlify functions must return proper CORS headers with credentials
 * 2. Cookies must be set with SameSite=None; Secure
 * 3. Fetch requests must include credentials: 'include'
 */

(function() {
  'use strict';

  // Detect the current environment
  const currentHost = window.location.hostname;
  
  // Netlify functions base URL
  const NETLIFY_FUNCTIONS_URL = 'https://willenaenglish.netlify.app';
  
  // Determine if we're on GitHub Pages or a custom domain pointing to GH Pages
  const isGitHubPages = currentHost === 'willenaenglish.github.io';
  const isCustomDomain = currentHost === 'willenaenglish.com' || currentHost === 'www.willenaenglish.com';
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  const isNetlify = currentHost.includes('netlify.app') || currentHost.includes('netlify.com');
  
  // For cross-origin requests (GitHub Pages -> Netlify), we need special handling
  const isCrossOrigin = isGitHubPages;
  
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
   * @param {string} functionPath - The function path
   * @param {RequestInit} options - Fetch options
   * @returns {Promise<Response>}
   */
  async function apiFetch(functionPath, options = {}) {
    const url = getApiUrl(functionPath);
    
    // Always include credentials for cookie-based auth
    // This is critical for cross-origin requests to send/receive cookies
    const fetchOptions = {
      ...options,
      credentials: 'include',
    };
    
    // For cross-origin requests with body, ensure Content-Type is set
    if (isCrossOrigin && options.body && !options.headers?.['Content-Type']) {
      fetchOptions.headers = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      };
    }
    
    return fetch(url, fetchOptions);
  }

  // Export to window for global access
  window.WillenaAPI = {
    BASE_URL: API_BASE,
    FUNCTIONS_URL: NETLIFY_FUNCTIONS_URL,
    isGitHubPages,
    isCustomDomain,
    isLocalhost,
    isNetlify,
    isCrossOrigin,
    getApiUrl,
    fetch: apiFetch,
    
    // Convenience method to check environment
    getEnvironment() {
      if (isLocalhost) return 'local';
      if (isNetlify) return 'netlify';
      if (isGitHubPages) return 'github-pages';
      if (isCustomDomain) return 'custom-domain';
      return 'unknown';
    }
  };

  // Log configuration in development
  if (isLocalhost || isGitHubPages) {
    console.log('[WillenaAPI] Environment:', window.WillenaAPI.getEnvironment());
    console.log('[WillenaAPI] Base URL:', API_BASE || '(relative)');
    console.log('[WillenaAPI] Cross-origin mode:', isCrossOrigin);
  }
})();
