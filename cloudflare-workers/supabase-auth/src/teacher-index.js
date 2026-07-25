import baseWorker from './index.js';

const TEACHER_ORIGIN = 'https://teachers.willenaenglish.com';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name) cookies[name] = decodeURIComponent(rest.join('='));
  }

  return cookies;
}

function serializeCookies(cookies) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value || '')}`)
    .join('; ');
}

function sessionCookie(name, value) {
  return `${name}=${encodeURIComponent(value || '')}; Max-Age=${COOKIE_MAX_AGE}; Path=/; Domain=.willenaenglish.com; Secure; HttpOnly; SameSite=None`;
}

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin || TEACHER_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Cache-Control': 'no-store',
    },
  });
}

function asBaseWhoamiRequest(request) {
  const url = new URL(request.url);
  url.searchParams.set('action', 'whoami');
  return new Request(url.toString(), request);
}

async function refreshTeacherSession(request, env, ctx) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const refreshToken = cookies.sb_refresh;
  if (!refreshToken) return null;

  const refreshResponse = await fetch(
    `${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    }
  );

  const session = await refreshResponse.json().catch(() => null);
  if (!refreshResponse.ok || !session?.access_token) return null;

  const newRefreshToken = session.refresh_token || refreshToken;
  const retryHeaders = new Headers(request.headers);
  retryHeaders.set(
    'Cookie',
    serializeCookies({
      ...cookies,
      sb_access: session.access_token,
      sb_refresh: newRefreshToken,
    })
  );

  const retryRequest = asBaseWhoamiRequest(
    new Request(request, { headers: retryHeaders })
  );
  const retryResponse = await baseWorker.fetch(retryRequest, env, ctx);
  if (!retryResponse.ok) return null;

  const responseHeaders = new Headers(retryResponse.headers);
  responseHeaders.append('Set-Cookie', sessionCookie('sb_access', session.access_token));
  responseHeaders.append('Set-Cookie', sessionCookie('sb_refresh', newRefreshToken));

  return new Response(retryResponse.body, {
    status: retryResponse.status,
    statusText: retryResponse.statusText,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Every existing action remains delegated to the original worker unchanged.
    if (action !== 'whoami_teacher') {
      return baseWorker.fetch(request, env, ctx);
    }

    const origin = request.headers.get('Origin') || '';
    if (origin !== TEACHER_ORIGIN || request.method !== 'GET') {
      return jsonResponse({ success: false, error: 'Action not found' }, 404, origin);
    }

    const initialResponse = await baseWorker.fetch(
      asBaseWhoamiRequest(request),
      env,
      ctx
    );

    if (initialResponse.status !== 401) return initialResponse;

    try {
      return (
        (await refreshTeacherSession(request, env, ctx)) || initialResponse
      );
    } catch (error) {
      console.error('[teacher-whoami-refresh] Failed to repair session:', error);
      return initialResponse;
    }
  },
};
