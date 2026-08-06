// Worker proxy to forward API requests to Cloudflare Workers or Netlify
// and to proxy static site requests to either a local static server (during
// `wrangler dev`) or to GitHub Pages (deployed preview on workers.dev).
addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const NETLIFY_ORIGIN = 'https://willenaenglish.netlify.app';
const GHPAGES_ORIGIN = 'https://willenaenglish.github.io';
const LOCAL_STATIC = 'http://127.0.0.1:8000';

// Migrated functions are called server-to-server through this gateway. This
// preserves the browser's .willenaenglish.com auth cookie while avoiding the
// third-party-cookie problem that would occur if the browser called workers.dev.
const CLOUDFLARE_FUNCTIONS = {
  log_word_attempt: 'https://log-word-attempt.willena.workers.dev',
  admin_classes: 'https://admin-classes.willena.workers.dev'
};

async function handle(request) {
  try {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/.netlify/functions/')) {
      return proxyFunctionRequest(request, url);
    }

    const host = (request.headers.get('host') || '').toLowerCase();
    const targetStatic = host.includes('127.0.0.1') || host.includes('localhost') ? LOCAL_STATIC : GHPAGES_ORIGIN;
    const target = targetStatic + url.pathname + (url.search || '');

    const headers = new Headers(request.headers);
    headers.delete('x-forwarded-for');
    headers.delete('x-real-ip');

    const init = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual'
    };

    const res = await fetch(target, init);
    const body = await res.arrayBuffer();
    const respHeaders = new Headers(res.headers);
    return new Response(body, { status: res.status, statusText: res.statusText, headers: respHeaders });
  } catch (err) {
    return new Response('Worker proxy error: ' + String(err), { status: 502 });
  }
}

function getFunctionName(pathname) {
  const match = pathname.match(/^\/\.netlify\/functions\/([^/?#]+)/);
  return match ? match[1] : '';
}

function cookieValue(cookieHeader, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(cookieHeader || '').match(new RegExp(`(?:^|;\\s*)${escaped}=([^;]+)`));
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

async function proxyFunctionRequest(request, url) {
  const functionName = getFunctionName(url.pathname);
  const workerOrigin = CLOUDFLARE_FUNCTIONS[functionName];
  const target = workerOrigin
    ? workerOrigin + (url.search || '')
    : NETLIFY_ORIGIN + url.pathname + (url.search || '');

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  headers.set('x-willena-api-route', workerOrigin ? 'cloudflare-worker' : 'netlify');

  // The established Willena login is stored in an HttpOnly sb_access cookie.
  // The isolated admin-classes Worker expects a bearer token, so translate the
  // cookie only for this one route. Do not alter auth behavior for other routes.
  if (functionName === 'admin_classes') {
    const accessToken = cookieValue(request.headers.get('cookie'), 'sb_access');
    if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  }

  const init = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual'
  };

  const res = await fetch(target, init);
  const responseHeaders = new Headers(res.headers);
  responseHeaders.set('x-willena-api-backend', workerOrigin ? 'cloudflare-worker' : 'netlify');

  const rewrittenCookies = [];
  const reqHost = (request.headers.get('host') || '').toLowerCase();
  const isLocalHost = reqHost.includes('127.0.0.1') || reqHost.includes('localhost');

  res.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') {
      let cookieVal = v.replace(/;\s*Domain=[^;]+/i, '');
      if (!isLocalHost) {
        if (!/samesite=/i.test(cookieVal)) cookieVal += '; SameSite=None';
        if (!/secure/i.test(cookieVal)) cookieVal += '; Secure';
      }
      rewrittenCookies.push(cookieVal);
    }
  });
  if (rewrittenCookies.length) {
    responseHeaders.delete('set-cookie');
    rewrittenCookies.forEach(c => responseHeaders.append('Set-Cookie', c));
  }

  if (url.pathname.includes('progress_summary') && url.search.includes('section=leaderboard_stars_class')) {
    responseHeaders.set('Cache-Control', 'private, max-age=0, no-store');
  }

  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders
  });
}
