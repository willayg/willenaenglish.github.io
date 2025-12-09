/**
 * Cloudflare Worker: API proxy + Set-Cookie domain rewrite
 *
 * Usage:
 * - Deploy to workers.dev first for testing
 * - Configure BACKEND_BASE to point at your Netlify functions base or other origin
 * - When ready, bind this worker to `api.willenaenglish.com/*` in Cloudflare routes
 *
 * Notes:
 * - This worker proxies requests to BACKEND_BASE and copies response body/headers
 * - It rewrites any Set-Cookie headers so cookies use Domain=.willenaenglish.com
 * - It echoes Origin from an allowlist for CORS and sets Access-Control-Allow-Credentials
 */

const BACKEND_BASE = typeof BACKEND_BASE !== 'undefined' ? BACKEND_BASE : 'https://willenaenglish.netlify.app';
const COOKIE_DOMAIN = '.willenaenglish.com';

const ALLOWED_ORIGINS = new Set([
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://cf.willenaenglish.com'
]);

addEventListener('fetch', event => event.respondWith(handle(event.request)));

async function handle(request) {
  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    // Map incoming path to backend path. If client calls /.netlify/functions/<fn>, forward as-is.
    const forwardPath = url.pathname + url.search;
    const backendUrl = BACKEND_BASE.replace(/\/$/, '') + forwardPath;

    // Build backend request
    const reqHeaders = new Headers(request.headers);
    // Remove hop-by-hop headers that shouldn't be forwarded
    reqHeaders.delete('cf-connecting-ip');

    const backendReq = new Request(backendUrl, {
      method: request.method,
      headers: reqHeaders,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'follow'
    });

    const backendResp = await fetch(backendReq);

    // Build response headers, rewriting Set-Cookie entries
    const newHeaders = new Headers();
    for (const [k, v] of backendResp.headers) {
      if (k.toLowerCase() === 'set-cookie') {
        // Collect cookies to rewrite separately
        // We will handle rewriting below
        continue;
      }
      newHeaders.append(k, v);
    }

    // Collect all Set-Cookie headers from backendResp
    const rawCookies = [];
    for (const [k, v] of backendResp.headers) {
      if (k.toLowerCase() === 'set-cookie') rawCookies.push(v);
    }

    if (rawCookies.length) {
      for (let sc of rawCookies) {
        let cookie = sc.trim();
        // Ensure Domain is the shared domain
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

    // Apply CORS headers (echo origin if allowed)
    const cors = corsHeaders(request);
    for (const k of Object.keys(cors)) newHeaders.set(k, cors[k]);

    const body = await backendResp.arrayBuffer();
    return new Response(body, { status: backendResp.status, statusText: backendResp.statusText, headers: newHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: String(err && err.message ? err.message : err) }), { status: 520, headers: { 'Content-Type': 'application/json' } });
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}

/**
 * Exported for quick local testing when using Wrangler in module mode
 */
export { handle };
