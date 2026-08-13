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

  // Study cache must exist before study.js starts its refresh-time data chain.
  if (typeof document !== 'undefined' && /\/students\/study\/?(?:index\.html)?$/i.test(window.location.pathname) && document.readyState === 'loading') {
    document.write('<script src="/students/study/study-cache.js?v=20260810-cache2"><\/script>');
  }

  const NETLIFY_ORIGIN = 'https://students.willenaenglish.com';
  const SENTENCE_GATEWAY = 'https://willena-proxy.willena.workers.dev';
  const NETLIFY_ONLY_FUNCTIONS = new Set([
    'verify_student','set_student_password','debug_student_data','openai_proxy','google_vision_proxy',
    'supabase_proxy','supabase_proxy_fixed','teacher_admin','test_admin','eleven_labs_proxy','translate','define_word',
    'student_study_current'
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
  const isCFPages = host === 'staging.willenaenglish.com' || host === 'cf.willenaenglish.com' ||
                    host === 'teachers.willenaenglish.com' || host === 'students.willenaenglish.com' ||
                    host.endsWith('.pages.dev');

  if (!isCFPages) {
    window.__STUDENTS_GATEWAY_PATCHED = true;
    console.log('[CFGateway] Not a CF Pages domain, skipping gateway patch');
    return;
  }

  window.__CF_API_GATEWAY = 'https://api.willenaenglish.com';
  window.__CF_GATEWAY_PATCHED = false;
  window.__STUDENTS_GATEWAY_PATCHED = false;

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
    if (window.__CF_GATEWAY_PATCHED) { clearInterval(rapidPatch); return; }
    patchWillenaAPI();
  }, 5);
  setTimeout(() => clearInterval(rapidPatch), 500);
})();

(function() {
  'use strict';
  if (typeof window === 'undefined' || !/\/Teachers\/tools\/curriculum-editor(?:\/|\/index\.html)?$/i.test(window.location.pathname)) return;
  const supportedTypes = ['reading', 'listening', 'speaking'];
  function addAssessmentTypeOptions(select) {
    if (!(select instanceof HTMLSelectElement)) return;
    const values = [...select.options].map(option => option.value || option.textContent.trim());
    const isAssessmentTypeSelect = select.id === 'typeFilter' || (values.includes('question_response') && values.includes('grammar_error'));
    if (!isAssessmentTypeSelect) return;
    supportedTypes.forEach(type => {
      const currentValues = [...select.options].map(option => option.value || option.textContent.trim());
      if (currentValues.includes(type)) return;
      const option = document.createElement('option');
      option.value = type; option.textContent = type; select.appendChild(option);
    });
  }
  function patchAssessmentTypeSelects(root = document) {
    if (root instanceof HTMLSelectElement) addAssessmentTypeOptions(root);
    root.querySelectorAll?.('select').forEach(addAssessmentTypeOptions);
  }
  const start = () => {
    patchAssessmentTypeSelects();
    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) patchAssessmentTypeSelects(node);
      }));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
