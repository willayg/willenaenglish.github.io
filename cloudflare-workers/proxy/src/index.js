/**
 * Cloudflare Worker: Willena API gateway
 * Routes migrated APIs through Cloudflare service bindings and provides a
 * cookie-authenticated proxy for the level-test admin API.
 */

const NETLIFY_BASE = 'https://willenaenglish.netlify.app';
const COOKIE_DOMAIN = '.willenaenglish.com';
const LEVEL_TEST_ADMIN_URL = 'https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/level-test-admin';
const LEVEL_TEST_PUBLISHABLE_KEY = 'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';

const FUNCTION_TO_BINDING = {
  supabase_auth: 'SUPABASE_AUTH',
  homework_api: 'HOMEWORK_API',
  log_word_attempt: 'LOG_WORD_ATTEMPT',
  progress_summary: 'PROGRESS_SUMMARY',
  get_audio_urls: 'GET_AUDIO_URLS',
  pixabay: 'PIXABAY',
};

const PREFER_CF_WORKER = {
  supabase_auth: true,
  homework_api: true,
  log_word_attempt: true,
  progress_summary: true,
  get_audio_urls: true,
  pixabay: true,
};

const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://cf.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://api.willenaenglish.com',
]);

function extractFunctionName(pathname) {
  const match = pathname.match(/^\/?\.?netlify\/functions\/([^/?]+)/);
  return match ? match[1] : null;
}

function parseCookies(cookieHeader) {
  const cookies = {};
  String(cookieHeader || '').split(';').forEach(part => {
    const [name, ...rest] = part.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://willenaenglish.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  };
}

async function routeToCFWorker(request, binding, functionName, url) {
  const workerUrl = new URL(request.url);
  const remainingPath = url.pathname.replace(/^\/?\.?netlify\/functions\/[^/?]+\/?/, '/') || '/';
  workerUrl.pathname = remainingPath === '' ? '/' : remainingPath;
  const workerRequest = new Request(workerUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });
  return binding.fetch(workerRequest);
}

async function routeToNetlify(request, url) {
  const backendUrl = NETLIFY_BASE + url.pathname + url.search;
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete('cf-connecting-ip');
  return fetch(new Request(backendUrl, {
    method: request.method,
    headers: reqHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  }));
}

async function routeLevelTestAdmin(request, url, origin) {
  const cookies = parseCookies(request.headers.get('Cookie'));
  const accessToken = cookies.sb_access || '';
  if (!accessToken) {
    return new Response(JSON.stringify({ success: false, error: 'Teacher login required' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }

  const upstream = new URL(LEVEL_TEST_ADMIN_URL);
  upstream.search = url.search;
  const headers = new Headers();
  headers.set('apikey', LEVEL_TEST_PUBLISHABLE_KEY);
  headers.set('Authorization', `Bearer ${accessToken}`);
  headers.set('Content-Type', 'application/json');

  const response = await fetch(upstream.toString(), {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });
  return rewriteResponse(response, origin);
}

function rewriteResponse(response, origin) {
  const newHeaders = new Headers();
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() !== 'set-cookie') newHeaders.append(key, value);
  }

  let setCookies = [];
  try {
    if (typeof response.headers.getSetCookie === 'function') setCookies = response.headers.getSetCookie();
  } catch {}

  for (const rawCookie of setCookies) {
    let cookie = String(rawCookie || '').trim();
    if (!cookie) continue;
    if (/;\s*Domain=/i.test(cookie)) cookie = cookie.replace(/;\s*Domain=[^;]+/i, `; Domain=${COOKIE_DOMAIN}`);
    else cookie += `; Domain=${COOKIE_DOMAIN}`;
    if (!/;\s*SameSite=/i.test(cookie)) cookie += '; SameSite=None';
    if (!/;\s*Secure/i.test(cookie)) cookie += '; Secure';
    newHeaders.append('Set-Cookie', cookie);
  }

  for (const [key, value] of Object.entries(corsHeaders(origin))) newHeaders.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    if (url.pathname === '/level-test-admin' || url.pathname.startsWith('/level-test-admin/')) {
      return routeLevelTestAdmin(request, url, origin);
    }

    if (url.pathname.startsWith('/audio/')) {
      const binding = env && env.GET_AUDIO_URLS;
      if (!binding || typeof binding.fetch !== 'function') {
        return new Response('Audio service unavailable', { status: 503, headers: corsHeaders(origin) });
      }
      const response = await binding.fetch(new Request(request.url, {
        method: request.method,
        headers: request.headers,
      }));
      return rewriteResponse(response, origin);
    }

    const functionName = extractFunctionName(url.pathname);
    let response;
    if (functionName && PREFER_CF_WORKER[functionName]) {
      const binding = env && env[FUNCTION_TO_BINDING[functionName]];
      response = binding && typeof binding.fetch === 'function'
        ? await routeToCFWorker(request, binding, functionName, url)
        : await routeToNetlify(request, url);
    } else {
      response = await routeToNetlify(request, url);
    }
    return rewriteResponse(response, origin);
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: String(error?.message || error),
    }), {
      status: 520,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
