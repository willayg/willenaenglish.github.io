/**
 * API Gateway Configuration for Students Domain
 * 
 * This script enforces that ALL API calls on students.willenaenglish.com
 * go through api.willenaenglish.com (the CF Pages API gateway).
 * 
 * MUST be loaded BEFORE api-config.js to override the routing.
 * This is the single source of truth for student auth API routing.
 */

(function() {
  'use strict';

  // Set API gateway immediately, before anything else loads
  window.__STUDENTS_API_GATEWAY = 'https://api.willenaenglish.com';

  // Wait for WillenaAPI to load, then override it
  const maxWaitTime = 5000; // 5 seconds max wait
  const startTime = Date.now();
  
  function patchWillenaAPI() {
    if (!window.WillenaAPI || !window.WillenaAPI.getApiUrl) {
      if (Date.now() - startTime < maxWaitTime) {
        // WillenaAPI not loaded yet, try again soon
        setTimeout(patchWillenaAPI, 50);
        return;
      }
      // Timeout - WillenaAPI didn't load
      console.error('[StudentGateway] WillenaAPI failed to load after 5s');
      return;
    }

    // WillenaAPI is loaded - patch it
    const origGetApiUrl = window.WillenaAPI.getApiUrl;
    
    window.WillenaAPI.getApiUrl = function(path) {
      const url = origGetApiUrl(path);
      
      // If it's a relative netlify path, prepend the gateway
      if (url.startsWith('/.netlify/functions/')) {
        const fullUrl = window.__STUDENTS_API_GATEWAY + url;
        console.log('[StudentGateway] Routing to gateway:', fullUrl);
        return fullUrl;
      }
      
      return url;
    };

    // Update BASE_URL to reflect the gateway
    window.WillenaAPI.BASE_URL = window.__STUDENTS_API_GATEWAY;
    
    console.log('[StudentGateway] ✓ API routing configured for students domain');
    console.log('[StudentGateway] All API calls will use:', window.__STUDENTS_API_GATEWAY);
  }

  // Start patching immediately when the page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchWillenaAPI);
  } else {
    // DOM already loaded (e.g., if this script is loaded late)
    patchWillenaAPI();
  }

  // Also try patching if WillenaAPI becomes available later
  window.addEventListener('load', patchWillenaAPI);
})();
