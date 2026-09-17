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
  const LEVEL_TEST_ADMIN = 'https://api.willenaenglish.com/level-test-admin';
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
  const FORCE_GATEWAY_FUNCTIONS = new Set([
    'upsert_sentences_batch',
    'get_sentence_audio_urls'
  ]);

  function extractFunctionName(input) {
    const s = String(input || '');
    const m = s.match(/\/\.netlify\/functions\/([^\/?#]+)/);
    return m ? m[1] : '';
  }

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const isCFPages = host === 'staging.willenaenglish.com' ||
                    host === 'cf.willenaenglish.com' ||
                    host === 'teachers.willenaenglish.com' ||
                    host === 'students.willenaenglish.com' ||
                    host.endsWith('.pages.dev');

  if (!isCFPages) {
    window.__STUDENTS_GATEWAY_PATCHED = true;
    console.log('[CFGateway] Not a CF Pages domain, skipping gateway patch');
    return;
  }

  window.__CF_API_GATEWAY = 'https://api.willenaenglish.com';
  window.__CF_GATEWAY_PATCHED = false;
  window.__STUDENTS_GATEWAY_PATCHED = false;

  // Make the visible Admin revision prove that this exact gateway build is running.
  if (window.location.pathname.startsWith('/Teachers/admin-v2/')) {
    const stampRevision = () => {
      const el = document.querySelector('.admin-v2-rev');
      if (el) el.textContent = 'Admin V2 · 1.11';
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', stampRevision, { once: true });
    else stampRevision();
  }

  // Admin V2 reuses the mature legacy Level Tests module. That module calls
  // /.netlify/functions/admin_classes?action=... via window.api(). The current
  // API gateway exposes the real level-test backend at /level-test-admin, so
  // translate only those legacy calls here instead of touching the old module.
  if (window.location.pathname.startsWith('/Teachers/admin-v2/') && typeof window.api !== 'function') {
    window.api = async function(path, options = {}) {
      let requestPath = path;
      try {
        const raw = String(path || '');
        if (raw.startsWith('/.netlify/functions/admin_classes')) {
          const url = new URL(raw, window.location.origin);
          requestPath = LEVEL_TEST_ADMIN + url.search;
        }
      } catch (error) {
        console.warn('[Admin V2] Could not rewrite legacy level-test request', error);
      }

      const fn = window.WillenaAPI?.fetch || window.fetch.bind(window);
      const response = await fn(requestPath, { credentials: 'include', cache: 'no-store', ...options });
      let data = {};
      try { data = await response.json(); } catch {}
      if (!response.ok || data?.success === false) {
        const error = new Error(data?.error || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return data;
    };
  }

  const maxWaitTime = 5000;
  const startTime = Date.now();
  
  function patchWillenaAPI() {
    if (window.__CF_GATEWAY_PATCHED) return;
    
    if (!window.WillenaAPI || !window.WillenaAPI.getApiUrl) {
      if (Date.now() - startTime < maxWaitTime) {
        setTimeout(patchWillenaAPI, 10);
        return;
      }
      console.error('[CFGateway] WillenaAPI failed to load after 5s');
      return;
    }

    const origGetApiUrl = window.WillenaAPI.getApiUrl;
    
    window.WillenaAPI.getApiUrl = function(path) {
      const url = origGetApiUrl(path);
      const fn = extractFunctionName(path) || extractFunctionName(url);

      if (fn && FORCE_GATEWAY_FUNCTIONS.has(fn)) {
        const gateway = SENTENCE_GATEWAY;
        if (/^https?:\/\//i.test(url)) {
          const fnPath = '/.netlify/functions/' + fn;
          const qIndex = url.indexOf('?');
          return gateway + fnPath + (qIndex >= 0 ? url.slice(qIndex) : '');
        }
        if (url.startsWith('/.netlify/functions/')) return gateway + url;
        if (String(path || '').startsWith('/.netlify/functions/')) return gateway + String(path);
        return gateway + '/.netlify/functions/' + fn;
      }

      if (fn && NETLIFY_ONLY_FUNCTIONS.has(fn)) {
        if (/^https?:\/\//i.test(url)) return url;
        if (url.startsWith('/.netlify/functions/')) return NETLIFY_ORIGIN + url;
        if (String(path || '').startsWith('/.netlify/functions/')) return NETLIFY_ORIGIN + String(path);
      }
      
      if (url.startsWith('/.netlify/functions/')) {
        const fullUrl = window.__CF_API_GATEWAY + url;
        console.log('[CFGateway] Routing to CF API gateway:', fullUrl);
        return fullUrl;
      }
      
      return url;
    };

    window.WillenaAPI.BASE_URL = window.__CF_API_GATEWAY;
    window.__CF_GATEWAY_PATCHED = true;
    window.__STUDENTS_GATEWAY_PATCHED = true;
    
    console.log('[CFGateway] ✓ API routing configured for CF Pages domain:', host);
    console.log('[CFGateway] All API calls will use:', window.__CF_API_GATEWAY);
  }

  patchWillenaAPI();
  
  const rapidPatch = setInterval(() => {
    if (window.__CF_GATEWAY_PATCHED) {
      clearInterval(rapidPatch);
      return;
    }
    patchWillenaAPI();
  }, 5);
  
  setTimeout(() => clearInterval(rapidPatch), 500);
})();
