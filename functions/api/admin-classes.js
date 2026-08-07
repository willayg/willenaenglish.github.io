const ADMIN_CLASSES_WORKER = 'https://admin-classes.willena.workers.dev';

function cookieValue(cookieHeader, name) {
  const match = String(cookieHeader || '').match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[1]) : '';
}

async function forward(request) {
  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(ADMIN_CLASSES_WORKER);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');

  if (!headers.get('Authorization')) {
    const accessToken = cookieValue(headers.get('Cookie'), 'sb_access');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return fetch(targetUrl.toString(), {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
  });
}

export async function onRequest(context) {
  const { request } = context;
  if (!['GET', 'POST', 'OPTIONS'].includes(request.method)) {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

  const response = await forward(request);
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
