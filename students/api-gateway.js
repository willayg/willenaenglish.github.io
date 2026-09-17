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
  const SENTENCE_GATEWAY = 'https://willena-proxy.willena.workers.dev';
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
    'translate',
    'define_word'
  ]);
  // These Netlify-only functions MUST route through api.willenaenglish.com
  // (not students.willenaenglish.com which is a CF Pages domain and can't serve
  // .netlify/functions). The gateway proxy at api falls through to
  // willenaenglish.netlify.app where the real functions live.
  const FORCE_GATEWAY_FUNCTIONS = new Set([
    'upsert_sentences_batch',
    'get_sentence_audio_urls'
  ]);

  const ROSTER_CACHE_KEY = 'willena:teacher-roster:v1';
  const ROSTER_CACHE_MAX_AGE_MS = 10 * 60 * 1000;
  const ADMIN_BOOTSTRAP_URL = 'https://api.willenaenglish.com/.netlify/functions/teacher_admin_bootstrap';
  let rosterCacheServedThisPage = false;
  let adminBootstrapPromise = null;
  let adminBootstrapPayload = null;

  function extractFunctionName(input) {
    const s = String(input || '');
    const m = s.match(/\/\.netlify\/functions\/([^\/?#]+)/);
    return m ? m[1] : '';
  }

  function parseRequestUrl(input) {
    try {
      if (input instanceof Request) return new URL(input.url, window.location.origin);
      return new URL(String(input || ''), window.location.origin);
    } catch {
      return null;
    }
  }

  function isRosterRequest(input, options = {}) {
    const method = String(options.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    if (method !== 'GET') return false;
    const url = parseRequestUrl(input);
    if (!url || !url.pathname.includes('/.netlify/functions/teacher_admin')) return false;
    return url.searchParams.get('action') === 'list_students';
  }

  function isTeacherAdminMutation(input, options = {}) {
    const method = String(options.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD') return false;
    const url = parseRequestUrl(input);
    return !!(url && url.pathname.includes('/.netlify/functions/teacher_admin'));
  }

  function adminStartupAction(input, options = {}) {
    const method = String(options.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    if (method !== 'GET') return null;
    const url = parseRequestUrl(input);
    if (!url) return null;
    if (url.pathname.includes('/.netlify/functions/supabase_auth')) {
      const action = url.searchParams.get('action');
      if (action === 'whoami') return 'whoami';
      if (action === 'get_profile') return 'get_profile';
    }
    if (url.pathname.includes('/.netlify/functions/teacher_admin') && url.searchParams.get('action') === 'list_students') {
      return 'list_students';
    }
    return null;
  }

  function jsonResponse(payload, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...extraHeaders }
    });
  }

  function readRosterCache() {
    try {
      const raw = sessionStorage.getItem(ROSTER_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.saved_at || !parsed.payload || !Array.isArray(parsed.payload.students)) return null;
      if ((Date.now() - Number(parsed.saved_at)) > ROSTER_CACHE_MAX_AGE_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeRosterCache(payload) {
    try {
      if (!payload || payload.success === false || !Array.isArray(payload.students)) return;
      sessionStorage.setItem(ROSTER_CACHE_KEY, JSON.stringify({ saved_at: Date.now(), payload }));
    } catch {}
  }

  function clearRosterCache() {
    try { sessionStorage.removeItem(ROSTER_CACHE_KEY); } catch {}
  }

  async function cacheRosterResponse(response) {
    try {
      if (!response || !response.ok) return;
      const payload = await response.clone().json();
      writeRosterCache(payload);
    } catch {}
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
    const origFetch = typeof window.WillenaAPI.fetch === 'function'
      ? window.WillenaAPI.fetch.bind(window.WillenaAPI)
      : null;
    
    window.WillenaAPI.getApiUrl = function(path) {
      const url = origGetApiUrl(path);
      const fn = extractFunctionName(path) || extractFunctionName(url);

      // Force sentence functions through the CF API gateway which proxies
      // to willenaenglish.netlify.app. Direct NETLIFY_ORIGIN (students.*)
      // is a CF Pages domain and cannot serve .netlify/functions.
      if (fn && FORCE_GATEWAY_FUNCTIONS.has(fn)) {
        const gateway = SENTENCE_GATEWAY;
        if (/^https?:\/\//i.test(url)) {
          // Already absolute — rewrite to gateway
          const fnPath = '/.netlify/functions/' + fn;
          const qIndex = url.indexOf('?');
          return gateway + fnPath + (qIndex >= 0 ? url.slice(qIndex) : '');
        }
        if (url.startsWith('/.netlify/functions/')) return gateway + url;
        if (String(path || '').startsWith('/.netlify/functions/')) return gateway + String(path);
        return gateway + '/.netlify/functions/' + fn;
      }

      // HARD BYPASS: Netlify-only functions must always hit Netlify origin.
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

    if (origFetch && host === 'teachers.willenaenglish.com') {
      async function loadAdminBootstrap() {
        if (adminBootstrapPayload) return adminBootstrapPayload;
        if (adminBootstrapPromise) return adminBootstrapPromise;
        adminBootstrapPromise = fetch(ADMIN_BOOTSTRAP_URL, {
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Accept': 'application/json' }
        }).then(async response => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload?.success === false) {
            const error = new Error(payload?.error || `Bootstrap failed (${response.status})`);
            error.status = response.status;
            throw error;
          }
          adminBootstrapPayload = payload;
          writeRosterCache({ success:true, students:payload.students || [], cached_at:payload.cached_at || null });
          return payload;
        }).catch(error => {
          adminBootstrapPromise = null;
          adminBootstrapPayload = null;
          throw error;
        });
        return adminBootstrapPromise;
      }

      window.WillenaAPI.fetch = async function(input, options = {}) {
        const startupAction = adminStartupAction(input, options);
        if (startupAction) {
          try {
            const boot = await loadAdminBootstrap();
            const user = boot.user || {};
            if (startupAction === 'whoami') {
              return jsonResponse({ success:true, user_id:user.user_id || user.id || null }, { 'X-Willena-Admin-Bootstrap':'whoami' });
            }
            if (startupAction === 'get_profile') {
              return jsonResponse({ success:true, profile:user }, { 'X-Willena-Admin-Bootstrap':'profile' });
            }
            if (startupAction === 'list_students') {
              rosterCacheServedThisPage = true;
              return jsonResponse({ success:true, students:boot.students || [], cached_at:boot.cached_at || null }, { 'X-Willena-Admin-Bootstrap':'roster' });
            }
          } catch (error) {
            // Preserve the existing auth refresh/fallback flow. A 401 here means
            // the page should perform its normal refresh-token sequence.
            if (startupAction !== 'list_students') return origFetch(input, options);
          }
        }

        if (isRosterRequest(input, options)) {
          const cached = !rosterCacheServedThisPage ? readRosterCache() : null;
          if (cached) {
            rosterCacheServedThisPage = true;
            Promise.resolve(origFetch(input, { ...options, cache: 'no-store' }))
              .then(async response => { await cacheRosterResponse(response); })
              .catch(() => {});
            return jsonResponse(cached.payload, { 'X-Willena-Roster-Cache': 'session' });
          }
          const response = await origFetch(input, options);
          rosterCacheServedThisPage = true;
          await cacheRosterResponse(response);
          return response;
        }

        const response = await origFetch(input, options);
        if (isTeacherAdminMutation(input, options) && response?.ok) {
          clearRosterCache();
          adminBootstrapPayload = null;
          adminBootstrapPromise = null;
        }
        return response;
      };
    }

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