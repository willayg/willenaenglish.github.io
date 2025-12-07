// Worker proxy to forward /.netlify/functions/* requests to Netlify
// For quick testing on workers.dev. Adjust NETLIFY_ORIGIN if needed.
addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

const NETLIFY_ORIGIN = 'https://willenaenglish.netlify.app';

async function handle(request) {
  try {
    const url = new URL(request.url);

    // Only proxy Netlify function requests; leave other requests alone
    if (!url.pathname.startsWith('/.netlify/functions/')) {
      return fetch(request);
    }

    const target = NETLIFY_ORIGIN + url.pathname + (url.search || '');

    // Clone incoming headers so we forward cookies and auth headers
    const headers = new Headers(request.headers);
    // Optional: ensure Host matches target origin host
    // headers.set('Host', new URL(NETLIFY_ORIGIN).host);

    const init = {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
      redirect: 'manual'
    };

    const res = await fetch(target, init);

    // Build response headers, rewriting Set-Cookie so cookies become host-only for worker origin
    const responseHeaders = new Headers(res.headers);

    const rewrittenCookies = [];
    res.headers.forEach((v, k) => {
      if (k.toLowerCase() === 'set-cookie') {
        let cookieVal = v;
        // Remove Domain attribute so cookie is host-only for the worker origin
        cookieVal = cookieVal.replace(/;\s*Domain=[^;]+/i, '');
        // Ensure SameSite=None and Secure for cookies used in cross-site scenarios
        if (!/samesite=/i.test(cookieVal)) cookieVal += '; SameSite=None; Secure';
        if (!/secure/i.test(cookieVal)) cookieVal += '; Secure';
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
  } catch (err) {
    return new Response('Worker proxy error: ' + String(err), { status: 502 });
  }
}

// End
