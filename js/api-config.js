/**
 * API Configuration - Simple and Deterministic
 * VERSION: 2026-08-27e CACHE_BUST
 */
(function() {
  'use strict';

  const GITHUB_PAGES_HOST = 'willenaenglish.github.io';
  const NETLIFY_BASE = 'https://students.willenaenglish.com';
  const CF_API_GATEWAY = 'https://api.willenaenglish.com';
  const TEST_PREP_TEACHER_EDGE = 'https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-teacher';
  const CF_FUNCTIONS = {
    supabase_auth: 'https://supabase-auth.willena.workers.dev',
    verify_student: 'https://verify-student.willena.workers.dev',
  };
  const USE_CF_WORKERS = (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'));

  const ALLOW_DIRECT_NETLIFY_ON_CF = false;
  const NETLIFY_ONLY_FUNCTIONS = [
    'verify_student','set_student_password','debug_student_data','openai_proxy','google_vision_proxy',
    'supabase_proxy','supabase_proxy_fixed','teacher_admin','test_admin','eleven_labs_proxy',
    'upsert_sentences_batch','get_sentence_audio_urls','translate','define_word',
  ];

  const currentHost = window.location.hostname;
  const isGitHubPages = currentHost === GITHUB_PAGES_HOST;
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  const isCloudflarePages = currentHost === 'staging.willenaenglish.com' ||
                             currentHost === 'cf.willenaenglish.com' ||
                             currentHost === 'teachers.willenaenglish.com' ||
                             currentHost === 'students.willenaenglish.com' ||
                             currentHost.endsWith('.pages.dev');
  const isNetlify = currentHost === 'willenaenglish.netlify.app';
  const isProduction = !isGitHubPages;
  const isCrossOrigin = isGitHubPages;

  let API_BASE;
  if (isNetlify || isLocalhost) API_BASE = '';
  else if (isCloudflarePages) API_BASE = CF_API_GATEWAY;
  else if (isGitHubPages) API_BASE = NETLIFY_BASE;
  else API_BASE = NETLIFY_BASE;

  const isKnownCookieBlockingBrowser = (() => {
    const ua = navigator.userAgent || '';
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Opera/.test(ua);
    const isSamsungInternet = /SamsungBrowser/.test(ua);
    const isBrave = typeof navigator.brave !== 'undefined';
    return isSafari || isSamsungInternet || isBrave;
  })();

  let _crossOriginCookiesFailed = false;
  const isThirdPartyCookiesBlocked = () => isKnownCookieBlockingBrowser || _crossOriginCookiesFailed;

  function getApiUrl(functionPath) {
    if (functionPath.startsWith('http://') || functionPath.startsWith('https://')) return functionPath;
    if (!functionPath.startsWith('/.netlify/functions/')) {
      if (functionPath.startsWith('/')) functionPath = '/.netlify/functions' + functionPath;
      else functionPath = '/.netlify/functions/' + functionPath;
    }
    const fn = extractFunctionName(functionPath);
    const qIndex = functionPath.indexOf('?');
    const search = qIndex >= 0 ? functionPath.slice(qIndex) : '';

    if (fn === 'test_prep_api' && /(?:[?&])action=(?:teacher_groups|create_group|update_group)(?:&|$)/.test(search)) {
      return TEST_PREP_TEACHER_EDGE + search;
    }

    if (USE_CF_WORKERS && fn && CF_FUNCTIONS[fn]) {
      return CF_FUNCTIONS[fn] + search;
    }
    if (isCloudflarePages && fn && NETLIFY_ONLY_FUNCTIONS.includes(fn)) {
      return ALLOW_DIRECT_NETLIFY_ON_CF ? (NETLIFY_BASE + functionPath) : (CF_API_GATEWAY + functionPath);
    }
    return API_BASE + functionPath;
  }

  function extractFunctionName(functionPath) {
    const match = functionPath.match(/\/?\.?netlify\/functions\/([^\/?]+)/);
    return match ? match[1] : '';
  }

  async function safeParseJSON(response) {
    const contentType = response.headers.get('content-type') || '';
    let responseText;
    try { responseText = await response.text(); }
    catch (e) { console.error('[WillenaAPI] Failed to read response text:', e); return { success:false,error:'Failed to read response',_parseError:true }; }
    if (!responseText || !responseText.trim()) return { success:false,error:'Empty response',_parseError:true };
    if (!contentType.includes('application/json')) return { success:false,error:'Server error (non-JSON response)',_parseError:true };
    try { return JSON.parse(responseText); }
    catch (e) { return { success:false,error:'Invalid JSON response',_parseError:true }; }
  }

  async function apiFetch(functionPath, options = {}) {
    const url = getApiUrl(functionPath);
    const fetchOptions = { ...options, credentials:'include' };

    const isDirectStudentsFunction = /^https:\/\/students\.willenaenglish\.com\/\.netlify\/functions\//i.test(url);
    const isCrossOriginToStudents = isDirectStudentsFunction && (window.location.origin !== 'https://students.willenaenglish.com');
    if (isCrossOriginToStudents) {
      fetchOptions.credentials = 'omit';
      const headers = { ...(fetchOptions.headers || {}) };
      Object.keys(headers).forEach((k) => { if (k.toLowerCase() === 'authorization') delete headers[k]; });
      fetchOptions.headers = headers;
      console.warn('[WillenaAPI] Cross-origin direct students call detected; forcing credentials=omit for CORS:', url);
    }

    if (options.body) {
      const hasContentType = options.headers && Object.keys(options.headers).some(k => k.toLowerCase() === 'content-type');
      if (!hasContentType) fetchOptions.headers = { 'Content-Type':'application/json', ...fetchOptions.headers };
    }

    const existingAuth = fetchOptions.headers && (fetchOptions.headers.Authorization || fetchOptions.headers.authorization);
    const isWillenaApiGateway = url.startsWith(CF_API_GATEWAY + '/');
    if (!existingAuth && !isWillenaApiGateway) {
      let localToken = null;
      try { localToken = localStorage.getItem('sb_access_token') || null; } catch (e) {}
      if (!isCrossOriginToStudents && localToken && localToken.includes('.') && localToken.length > 50) {
        fetchOptions.headers = { ...fetchOptions.headers, 'Authorization': `Bearer ${localToken}` };
        console.log('[WillenaAPI] Added Authorization header from localStorage (token length:', localToken.length + ')');
      }
    }

    if (options.method === 'POST' || options.body) {
      console.log('[WillenaAPI] POST request:', url, 'body:', options.body ? options.body.substring(0,100) : '(none)');
    }
    try { return await fetch(url, fetchOptions); }
    catch (err) { console.error('[WillenaAPI] Fetch error:', err); throw err; }
  }

  const shouldRedirectImmediately = () => isCrossOrigin && isKnownCookieBlockingBrowser;
  function redirectToNetlifyIfNeeded(pathname) {
    if (isCrossOrigin && isThirdPartyCookiesBlocked()) {
      const targetUrl = NETLIFY_BASE + (pathname || window.location.pathname + window.location.search);
      window.location.replace(targetUrl); return true;
    }
    return false;
  }

  window.WillenaAPI = {
    getApiUrl, fetch:apiFetch, safeParseJSON,
    BASE_URL:API_BASE, FUNCTIONS_URL:NETLIFY_BASE,
    isGitHubPages,isLocalhost,isProduction,isCrossOrigin,
    isThirdPartyCookiesBlocked,isKnownCookieBlockingBrowser,
    markCookiesFailed(){ _crossOriginCookiesFailed = true; },
    shouldRedirectImmediately,redirectToNetlifyIfNeeded,
    getNetlifyUrl(pathname){ return NETLIFY_BASE + (pathname || window.location.pathname); },
    shouldShowCookieWarning(){ return isCrossOrigin && isKnownCookieBlockingBrowser; },
    getEnvironment(){ if(isLocalhost)return'local'; if(isGitHubPages)return'github-pages'; return'production'; },
    setLocalTokens(accessToken,refreshToken){ try { if(accessToken)localStorage.setItem('sb_access_token',accessToken); if(refreshToken)localStorage.setItem('sb_refresh_token',refreshToken); } catch(e){} },
    getLocalAccessToken(){ try { return localStorage.getItem('sb_access_token') || null; } catch(e){ return null; } },
    clearLocalTokens(){ try { localStorage.removeItem('sb_access_token'); localStorage.removeItem('sb_refresh_token'); } catch(e){} },
    CF_ROLLOUT_PERCENT:100, CF_SHADOW_MODE:false,
    shouldUseCloudflare:()=>USE_CF_WORKERS,setRolloutPercent:()=>{},setFunctionRollout:()=>{},
  };

  if (/^\/Teachers\/dashboard-v2\/?$/i.test(window.location.pathname)) {
    const s = document.createElement('script');
    s.src = '/Teachers/dashboard-v2/teacher-dashboard-ui-v3.js?v=20260828-wrongdetail1';
    s.defer = true;
    document.head.appendChild(s);
  }
})();