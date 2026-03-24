/**
 * CF Pages API Gateway Configuration
 * 
 * This script enforces that ALL API calls on Cloudflare Pages domains
 * (teachers, students, staging, cf, etc.) go through api.willenaenglish.com
 * (the CF Pages API gateway) for proper CORS and cookie handling.
 * 
 * MUST be loaded BEFORE api-config.js to override the routing.
 * This is the single source of truth for CF Pages API routing.
 */

(function() {
  'use strict';

  const NETLIFY_ORIGIN = 'https://students.willenaenglish.com';
  const NETLIFY_ONLY_FUNCTIONS = new Set([
    'verify_student',
    'set_student_password',
    'debug_student_data',
    'openai_proxy',
    'google_vision_proxy',
    'supabase_proxy',
    'supabase_proxy_fixed',
    'teacher_admin',
    'test_admin',
    'eleven_labs_proxy',
    'upsert_sentences_batch',
    'get_sentence_audio_urls',
    'translate',
    'define_word'
  ]);

  function extractFunctionName(input) {
    const s = String(input || '');
    const m = s.match(/\/\.netlify\/functions\/([^\/?#]+)/);
    return m ? m[1] : '';
  }

  // Detect if we're on a CF Pages domain
  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isCFPages = host === 'staging.willenaenglish.com' ||
                    host === 'cf.willenaenglish.com' ||
                    host === 'teachers.willenaenglish.com' ||
                    host === 'students.willenaenglish.com' ||
                    host.endsWith('.pages.dev');

  // If NOT on CF Pages, do nothing - let api-config.js handle it
  if (!isCFPages) {
    // Backward compatibility: some pages still wait on this flag.
    // Mark ready on non-CF domains so auth gates do not deadlock.
    window.__STUDENTS_GATEWAY_PATCHED = true;
    console.log('[CFGateway] Not a CF Pages domain, skipping gateway patch');
    return;
  }

  // Set API gateway immediately, before anything else loads
  window.__CF_API_GATEWAY = 'https://api.willenaenglish.com';
  window.__CF_GATEWAY_PATCHED = false;
  // Backward compatibility alias used by legacy auth gates
  window.__STUDENTS_GATEWAY_PATCHED = false;

  // Wait for WillenaAPI to load, then override it
  const maxWaitTime = 5000; // 5 seconds max wait
  const startTime = Date.now();
  
  function patchWillenaAPI() {
    if (window.__CF_GATEWAY_PATCHED) return; // Already done
    
    if (!window.WillenaAPI || !window.WillenaAPI.getApiUrl) {
      if (Date.now() - startTime < maxWaitTime) {
        // WillenaAPI not loaded yet, try again soon
        setTimeout(patchWillenaAPI, 10);
        return;
      }
      // Timeout - WillenaAPI didn't load
      console.error('[CFGateway] WillenaAPI failed to load after 5s');
      return;
    }

    // WillenaAPI is loaded - patch it
    const origGetApiUrl = window.WillenaAPI.getApiUrl;
    
    window.WillenaAPI.getApiUrl = function(path) {
      const url = origGetApiUrl(path);
      const fn = extractFunctionName(path) || extractFunctionName(url);

      // HARD BYPASS: Netlify-only functions must always hit Netlify origin.
      // This protects sentence/audio functions even when older api-config.js
      // or stale CDN assets return relative function paths.
      if (fn && NETLIFY_ONLY_FUNCTIONS.has(fn)) {
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith('/.netlify/functions/')) return NETLIFY_ORIGIN + url;
        if (String(path || '').startsWith('/.netlify/functions/')) return NETLIFY_ORIGIN + String(path);
      }
      
      // If it's a relative netlify path, prepend the CF gateway
      if (url.startsWith('/.netlify/functions/')) {
        const fullUrl = window.__CF_API_GATEWAY + url;
        console.log('[CFGateway] Routing to CF API gateway:', fullUrl);
        return fullUrl;
      }
      
      return url;
    };

    // Update BASE_URL to reflect the gateway
    window.WillenaAPI.BASE_URL = window.__CF_API_GATEWAY;
    window.__CF_GATEWAY_PATCHED = true;
    // Keep legacy flag in sync for older pages (play.html/index.html)
    window.__STUDENTS_GATEWAY_PATCHED = true;
    
    console.log('[CFGateway] ✓ API routing configured for CF Pages domain:', host);
    console.log('[CFGateway] All API calls will use:', window.__CF_API_GATEWAY);
  }

  // Try patching IMMEDIATELY (synchronous) - api-config.js may have already loaded
  patchWillenaAPI();
  
  // Also keep trying rapidly in case api-config.js loads right after us
  const rapidPatch = setInterval(() => {
    if (window.__CF_GATEWAY_PATCHED) {
      clearInterval(rapidPatch);
      return;
    }
    patchWillenaAPI();
  }, 5);
  
  // Stop rapid polling after 500ms
  setTimeout(() => clearInterval(rapidPatch), 500);
})();
