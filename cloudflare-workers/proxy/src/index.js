/**
 * Cloudflare Worker: API Gateway + Set-Cookie domain rewrite
 *
 * Main API gateway at api.willenaenglish.com.
 */

const NETLIFY_BASE = 'https://willenaenglish.netlify.app';
const COOKIE_DOMAIN = '.willenaenglish.com';

const FUNCTION_TO_BINDING = {
  supabase_auth: 'SUPABASE_AUTH',
  homework_api: 'HOMEWORK_API',
  log_word_attempt: 'LOG_WORD_ATTEMPT',
  progress_summary: 'PROGRESS_SUMMARY',
  get_audio_urls: 'GET_AUDIO_URLS',
};

const PREFER_CF_WORKER = {
  supabase_auth: true,
  homework_api: true,
  log_word_attempt: true,
  progress_summary: true,
  get_audio_urls: true,
};

const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://cf.willenaenglish.com',
  'https://api.willenaenglish.com',
]);

function extractFunctionName(pathname) {
  const match = pathname.match(/^\/?\.?netlify\/functions\/([^/?]+)/);
  return match ? match[1] : null;
}

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://willenaenglish.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'private, max-age=0, no-store',
    'Vary': 'Origin',
  };
}

async function routeToCFWorker(request, binding, functionName, url) {
  const workerUrl = new URL(request.url);
  const remainingPath = url.pathname.replace(/^\/?\.?netlify\/functions\/[^/?]+\/?/, '/') || '/';
  workerUrl.pathname = remainingPath === '' ? '/' : remainingPath;

  const workerHeaders = new Headers(request.headers);
  workerHeaders.set('X-Willena-Original-Origin', request.headers.get('Origin') || '');
  workerHeaders.set('X-Willena-Gateway-Host', url.hostname);

  const workerRequest = new Request(workerUrl.toString(), {
    method: request.method,
    headers: workerHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  return binding.fetch(workerRequest);
}

async function routeToNetlify(request, url) {
  const backendUrl = NETLIFY_BASE + url.pathname + url.search;
  const reqHeaders = new Headers(request.headers);
  reqHeaders.delete('cf-connecting-ip');

  const backendReq = new Request(backendUrl, {
    method: request.method,
    headers: reqHeaders,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
    redirect: 'follow'
  });

  return fetch(backendReq);
}

function rewriteResponse(response, origin) {
  const newHeaders = new Headers();

  for (const [key, value] of response.headers) {
    if (key.toLowerCase() !== 'set-cookie') newHeaders.append(key, value);
  }

  for (const [key, value] of response.headers) {
    if (key.toLowerCase() === 'set-cookie') {
      let cookie = value.trim();
      if (/;\s*Domain=/i.test(cookie)) {
        cookie = cookie.replace(/;\s*Domain=[^;]+/i, `; Domain=${COOKIE_DOMAIN}`);
      } else {
        cookie += `; Domain=${COOKIE_DOMAIN}`;
      }
      if (!/;\s*SameSite=/i.test(cookie)) cookie += '; SameSite=None';
      if (!/;\s*Secure/i.test(cookie)) cookie += '; Secure';
      newHeaders.append('Set-Cookie', cookie);
    }
  }

  const cors = corsHeaders(origin);
  for (const [key, value] of Object.entries(cors)) newHeaders.set(key, value);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  try {
    if (url.pathname.startsWith('/audio/')) {
      const binding = env && env.GET_AUDIO_URLS;
      if (binding && typeof binding.fetch === 'function') {
        const workerRequest = new Request(request.url, {
          method: request.method,
          headers: request.headers,
        });
        return rewriteResponse(await binding.fetch(workerRequest), origin);
      }
      return new Response('Audio service unavailable', { status: 503, headers: corsHeaders(origin) });
    }

    const functionName = extractFunctionName(url.pathname);
    let response;

    if (functionName && PREFER_CF_WORKER[functionName]) {
      const bindingName = FUNCTION_TO_BINDING[functionName];
      const binding = env && env[bindingName];
      response = binding && typeof binding.fetch === 'function'
        ? await routeToCFWorker(request, binding, functionName, url)
        : await routeToNetlify(request, url);
    } else {
      response = await routeToNetlify(request, url);
    }

    return rewriteResponse(response, origin);
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err?.message || err) }),
      { status: 520, headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) } }
    );
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
