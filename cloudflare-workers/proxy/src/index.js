/**
 * Cloudflare Worker: API gateway and cookie-domain rewrite.
 * Daily Study V2 is Cloudflare-only and uses a direct /api/daily-study route.
 */

const NETLIFY_BASE = 'https://willenaenglish.netlify.app';
const COOKIE_DOMAIN = '.willenaenglish.com';

const FUNCTION_TO_BINDING = {
  supabase_auth: 'SUPABASE_AUTH',
  homework_api: 'HOMEWORK_API',
  log_word_attempt: 'LOG_WORD_ATTEMPT',
  progress_summary: 'PROGRESS_SUMMARY',
  get_audio_urls: 'GET_AUDIO_URLS',
  pixabay: 'PIXABAY',
  student_level_test: 'STUDENT_LEVEL_TEST',
  admin_classes: 'ADMIN_CLASSES',
};

const PREFER_CF_WORKER = new Set(Object.keys(FUNCTION_TO_BINDING));
const CLOUDFLARE_ONLY = new Set(['student_level_test', 'admin_classes']);

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

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://students.willenaenglish.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function accessTokenFromCookie(cookieHeader) {
  const match = String(cookieHeader || '').match(/(?:^|;\s*)sb_access=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function bearerToken(headers) {
  const value = String(headers.get('Authorization') || '').trim();
  return /^Bearer\s+/i.test(value) ? value.replace(/^Bearer\s+/i, '').trim() : '';
}

async function authenticatedUserId(request, env) {
  const auth = env?.SUPABASE_AUTH;
  if (!auth || typeof auth.fetch !== 'function') return '';
  const url = new URL(request.url);
  url.pathname = '/';
  url.search = '?action=whoami';
  const headers = new Headers(request.headers);

  // The browser may call this Worker on workers.dev, where a
  // .willenaenglish.com cookie cannot be sent. In that case Study V2 sends
  // its persisted access token as Bearer auth. Translate that token into the
  // cookie shape expected by the existing supabase-auth whoami handler.
  if (!accessTokenFromCookie(headers.get('Cookie'))) {
    const token = bearerToken(headers);
    if (token) headers.set('Cookie', `sb_access=${encodeURIComponent(token)}`);
  }

  const response = await auth.fetch(new Request(url.toString(), {
    method: 'GET',
    headers,
  }));
  if (!response.ok) return '';
  const data = await response.json().catch(() => null);
  return data && data.success && data.user_id ? String(data.user_id) : '';
}

async function routeDailyStudy(request, env) {
  const binding = env?.DAILY_STUDY_V2;
  if (!binding || typeof binding.fetch !== 'function') {
    return new Response(JSON.stringify({ success:false, error:'Daily Study service unavailable' }), {
      status:503,
      headers:{'content-type':'application/json; charset=utf-8'}
    });
  }

  const userId = await authenticatedUserId(request, env);
  if (!userId) {
    return new Response(JSON.stringify({ success:false, error:'Not signed in' }), {
      status:401,
      headers:{'content-type':'application/json; charset=utf-8'}
    });
  }

  const headers = new Headers(request.headers);
  headers.set('X-Willena-Authenticated-User', userId);
  headers.delete('Authorization');
  const response = await binding.fetch(new Request(request.url, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  }));
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-Willena-Upstream', 'cloudflare:daily-study-v2');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

async function routeToCFWorker(request, binding, functionName, url) {
  const workerUrl = new URL(request.url);
  const remainingPath = url.pathname.replace(/^\/?\.?netlify\/functions\/[^/?]+\/?/, '/') || '/';
  workerUrl.pathname = remainingPath || '/';
  console.log(`[proxy] Cloudflare Worker ${functionName}: ${workerUrl.pathname}${workerUrl.search}`);

  const headers = new Headers(request.headers);
  if (functionName === 'admin_classes' && !headers.get('Authorization')) {
    const token = accessTokenFromCookie(headers.get('Cookie'));
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await binding.fetch(new Request(workerUrl.toString(), {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  }));
  const responseHeaders = new Headers(response.headers);
  responseHeaders.set('X-Willena-Upstream', `cloudflare:${functionName}`);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}

async function routeToNetlify(request, url) {
  const backendUrl = NETLIFY_BASE + url.pathname + url.search;
  console.log(`[proxy] Legacy Netlify route: ${backendUrl}`);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete('cf-connecting-ip');
  return fetch(new Request(backendUrl, {
    method: request.method,
    headers: requestHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow',
  }));
}

function rewriteResponse(response, origin) {
  const headers = new Headers();
  for (const [key, value] of response.headers) {
    if (key.toLowerCase() !== 'set-cookie') headers.append(key, value);
  }

  let cookies = [];
  try {
    if (typeof response.headers?.getSetCookie === 'function') cookies = response.headers.getSetCookie();
  } catch (_) {
    cookies = [];
  }

  for (const rawCookie of cookies) {
    let cookie = String(rawCookie || '').trim();
    if (!cookie) continue;
    if (/;\s*Domain=/i.test(cookie)) cookie = cookie.replace(/;\s*Domain=[^;]+/i, `; Domain=${COOKIE_DOMAIN}`);
    else cookie += `; Domain=${COOKIE_DOMAIN}`;
    if (!/;\s*SameSite=/i.test(cookie)) cookie += '; SameSite=None';
    if (!/;\s*Secure/i.test(cookie)) cookie += '; Secure';
    headers.append('Set-Cookie', cookie);
  }

  for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  try {
    if (url.pathname === '/api/daily-study' || url.pathname === '/api/daily-study/') {
      const response = await routeDailyStudy(request, env);
      return rewriteResponse(response, origin);
    }

    if (url.pathname.startsWith('/audio/')) {
      const binding = env?.GET_AUDIO_URLS;
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

    if (functionName && PREFER_CF_WORKER.has(functionName)) {
      const bindingName = FUNCTION_TO_BINDING[functionName];
      const binding = env?.[bindingName];
      if (binding && typeof binding.fetch === 'function') {
        response = await routeToCFWorker(request, binding, functionName, url);
      } else if (CLOUDFLARE_ONLY.has(functionName)) {
        console.error(`[proxy] Missing required Cloudflare binding: ${bindingName}`);
        response = new Response(JSON.stringify({
          success: false,
          error: 'This service is temporarily unavailable because its Cloudflare Worker binding is missing.',
        }), {
          status: 503,
          headers: { 'content-type': 'application/json; charset=utf-8' },
        });
      } else {
        response = await routeToNetlify(request, url);
      }
    } else {
      response = await routeToNetlify(request, url);
    }

    return rewriteResponse(response, origin);
  } catch (error) {
    console.error('[proxy] Error:', error);
    return new Response(JSON.stringify({ success: false, error: String(error?.message || error) }), {
      status: 520,
      headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
    });
  }
}

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};
