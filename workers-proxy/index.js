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

  // Preserve shared Willena authentication cookies. The previous proxy removed
  // Domain=.willenaenglish.com, which made sb_access and sb_refresh host-only
  // cookies for api.willenaenglish.com. Teacher and student subdomains could
  // therefore not send the session on their next request and were logged out.
  const responseHeaders = new Headers(res.headers);
  const rewrittenCookies = [];
  const reqHost = (request.headers.get('host') || '').toLowerCase();
  const isLocalHost = reqHost.includes('127.0.0.1') || reqHost.includes('localhost');

  res.headers.forEach((v, k) => {
    if (k.toLowerCase() === 'set-cookie') {
      let cookieVal = v;

      if (isLocalHost) {
        // Local HTTP cannot use Secure cross-domain cookies.
        cookieVal = cookieVal.replace(/;\s*Domain=[^;]+/i, '');
        cookieVal = cookieVal.replace(/;\s*Secure/ig, '');
        cookieVal = cookieVal.replace(/;\s*SameSite=None/ig, '; SameSite=Lax');
      } else {
        // Authentication cookies must be available to teachers.*, students.*,
        // staging.* and the main site. Preserve an existing Willena domain or
        // add it when the origin response omitted one.
        if (/;\s*Domain=/i.test(cookieVal)) {
          cookieVal = cookieVal.replace(/;\s*Domain=[^;]+/i, '; Domain=.willenaenglish.com');
        } else {
          cookieVal += '; Domain=.willenaenglish.com';
        }
        if (!/samesite=/i.test(cookieVal)) cookieVal += '; SameSite=None';
        if (!/;\s*Secure/i.test(cookieVal)) cookieVal += '; Secure';
      }

      rewrittenCookies.push(cookieVal);
    }
  });

  if (rewrittenCookies.length) {
    responseHeaders.delete('set-cookie');
    rewrittenCookies.forEach(c => responseHeaders.append('Set-Cookie', c));
  }

  // All function responses are dynamic and may contain session information.
  responseHeaders.set('Cache-Control', 'private, max-age=0, no-store');

  const body = await res.arrayBuffer();
  return new Response(body, {
    status: res.status,
    statusText: res.statusText,
    headers: responseHeaders
  });
}

// End
