// Worker proxy to forward /.netlify/functions/* requests to Netlify
// and to proxy static site requests to either a local static server (during
// `wrangler dev`) or to GitHub Pages (deployed preview on workers.dev).
addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const NETLIFY_ORIGIN = 'https://willenaenglish.netlify.app';
const GHPAGES_ORIGIN = 'https://willenaenglish.github.io';
const LOCAL_STATIC = 'http://127.0.0.1:8000';

async function handle(request) {
  try {
    const url = new URL(request.url);

    // Proxy Netlify function requests to Netlify origin
    if (url.pathname.startsWith('/.netlify/functions/')) {
      return proxyFunctionRequest(request, url);
    }

    // For other paths (static site), proxy to a static server.
    // If running locally under wrangler dev (host contains 127.0.0.1 or localhost)
    // proxy to the local static server. Otherwise proxy to GitHub Pages.
    const host = (request.headers.get('host') || '').toLowerCase();
    const targetStatic = host.includes('127.0.0.1') || host.includes('localhost') ? LOCAL_STATIC : GHPAGES_ORIGIN;
    const target = targetStatic + url.pathname + (url.search || '');

    const headers = new Headers(request.headers);
    // Remove hop-by-hop headers that might confuse the origin
    headers.delete('x-forwarded-for');
    headers.delete('x-real-ip');

    const init = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual'
    };

    const res = await fetch(target, init);
    // Return the origin response directly for static files (preserve headers)
    const body = await res.arrayBuffer();
    const respHeaders = new Headers(res.headers);
    return new Response(body, { status: res.status, statusText: res.statusText, headers: respHeaders });
  } catch (err) {
    return new Response('Worker proxy error: ' + String(err), { status: 502 });
  }
}

async function proxyFunctionRequest(request, url) {
  const target = NETLIFY_ORIGIN + url.pathname + (url.search || '');
  const headers = new Headers(request.headers);
  const init = {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual'
  };

  const res = await fetch(target, init);

  // Rewrite Set-Cookie headers so they are host-only for the worker origin
  const responseHeaders = new Headers(res.headers);
  const rewrittenCookies = [];
  // Detect if the worker is being accessed locally (wrangler dev)
  const reqHost = (request.headers.get('host') || '').toLowerCase();
  const isLocalHost = reqHost.includes('127.0.0.1') || reqHost.includes('localhost');

  res.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') {
      let cookieVal = v;
      // Remove Domain attribute so cookie is host-only for the worker origin
      cookieVal = cookieVal.replace(/;\s*Domain=[^;]+/i, '');
      // For local dev (HTTP) do not force Secure/SameSite=None otherwise the
      // browser will ignore the cookie. For production (workers.dev) add
      // SameSite=None; Secure so cross-site flows still work.
      if (isLocalHost) {
        // Keep cookie mostly as-is (no Domain), let it be set over HTTP for local testing
      } else {
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

  // Make user-specific endpoints uncacheable at edge (extra safety)
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

// End
