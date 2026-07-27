import baseWorker from './index.js';

const STUDENT_ORIGIN = 'https://students.willenaenglish.com';
const COOKIE_DOMAIN = '.willenaenglish.com';

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = value;
  }
  return out;
}

function replaceCookie(header, name, value) {
  const parts = (header || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith(`${name}=`));
  parts.push(`${name}=${value}`);
  return parts.join('; ');
}

function authCookie(name, value, maxAge) {
  return `${name}=${value}; Domain=${COOKIE_DOMAIN}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function preferCookieRequest(request, cookieHeader = null) {
  const headers = new Headers(request.headers);
  const effectiveCookie = cookieHeader ?? headers.get('Cookie') ?? '';
  const cookies = parseCookies(effectiveCookie);

  if (cookies.sb_access) {
    headers.delete('Authorization');
  }
  if (cookieHeader !== null) {
    headers.set('Cookie', cookieHeader);
  }

  return new Request(request, { headers });
}

async function refreshTokens(env, refreshToken) {
  if (!refreshToken || !env.SUPABASE_URL) return null;
  const apiKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY;
  if (!apiKey) return null;

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refresh_token: decodeURIComponent(refreshToken) }),
  });

  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.access_token || !data?.refresh_token) return null;
  return data;
}

export default {
  async fetch(request, env, ctx) {
    const firstRequest = preferCookieRequest(request);
    const first = await baseWorker.fetch(firstRequest, env, ctx);
    if (first.status !== 401 || request.headers.get('Origin') !== STUDENT_ORIGIN) {
      return first;
    }

    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const refreshToken = cookies.sb_refresh || cookies['sb-refresh'];
    const tokens = await refreshTokens(env, refreshToken).catch(() => null);
    if (!tokens) return first;

    let nextCookie = request.headers.get('Cookie') || '';
    nextCookie = replaceCookie(nextCookie, 'sb_access', encodeURIComponent(tokens.access_token));
    nextCookie = replaceCookie(nextCookie, 'sb_refresh', encodeURIComponent(tokens.refresh_token));

    const retriedRequest = preferCookieRequest(request, nextCookie);
    const retried = await baseWorker.fetch(retriedRequest, env, ctx);

    const responseHeaders = new Headers(retried.headers);
    responseHeaders.append('Set-Cookie', authCookie('sb_access', encodeURIComponent(tokens.access_token), Number(tokens.expires_in) || 3600));
    responseHeaders.append('Set-Cookie', authCookie('sb_refresh', encodeURIComponent(tokens.refresh_token), 60 * 60 * 24 * 30));
    responseHeaders.set('Cache-Control', 'private, no-store');

    return new Response(retried.body, {
      status: retried.status,
      statusText: retried.statusText,
      headers: responseHeaders,
    });
  },
};
