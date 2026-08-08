import baseWorker from './index.js';

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

  if (cookies.sb_access) headers.delete('Authorization');
  if (cookieHeader !== null) headers.set('Cookie', cookieHeader);
  return new Request(request, { headers });
}

async function refreshTokens(env, refreshToken) {
  if (!refreshToken || !env.SUPABASE_URL) return null;
  const apiKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY;
  if (!apiKey) return null;

  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: decodeURIComponent(refreshToken) }),
  });

  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.access_token || !data?.refresh_token) return null;
  return data;
}

function corsHeaders(origin) {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin || 'https://students.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'private, no-store',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(origin) });
}

async function userFromCookie(request, env) {
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = cookies.sb_access ? decodeURIComponent(cookies.sb_access) : '';
  if (!token) return null;
  const apiKey = env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_KEY;
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: apiKey, Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return null;
  return response.json();
}

async function serviceRpc(env, name, args) {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args || {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.message || data?.error || `RPC ${name} failed (${response.status})`);
  return data;
}

async function verifyAssignedBook(env, userId, bookId) {
  const profileResp = await fetch(`${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=class&limit=1`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!profileResp.ok) return false;
  const profiles = await profileResp.json().catch(() => []);
  const className = String(profiles?.[0]?.class || '').trim();
  if (!className) return false;
  const assignment = await serviceRpc(env, 'get_study_assignment_for_class', { p_class_name: className });
  return !!(assignment?.success && assignment?.assignment?.book_id && String(assignment.assignment.book_id) === String(bookId));
}

async function handleStudyRoute(request, env) {
  const url = new URL(request.url);
  const section = String(url.searchParams.get('section') || '').toLowerCase();
  if (section !== 'study_attempt' && section !== 'study_progress') return null;
  const origin = request.headers.get('Origin') || '';
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  const user = await userFromCookie(request, env);
  if (!user?.id) return json({ success: false, error: 'Not signed in' }, 401, origin);

  try {
    if (section === 'study_attempt') {
      if (request.method !== 'POST') return json({ success: false, error: 'Method Not Allowed' }, 405, origin);
      const body = await request.json().catch(() => ({}));
      const payload = body?.payload || body?.p_payload || null;
      if (!payload?.book_id || !payload?.unit_id) return json({ success: false, error: 'Missing study attempt payload' }, 400, origin);
      if (payload.preview_mode) return json({ success: false, error: 'Preview attempts are not recordable' }, 400, origin);
      const assigned = await verifyAssignedBook(env, user.id, payload.book_id);
      if (!assigned) return json({ success: false, error: 'Attempt does not match the student assigned book' }, 409, origin);
      const result = await serviceRpc(env, 'record_study_attempt_v1', { p_student_id: user.id, p_payload: payload });
      return json(result, 200, origin);
    }

    if (request.method !== 'GET') return json({ success: false, error: 'Method Not Allowed' }, 405, origin);
    const bookId = url.searchParams.get('book_id') || null;
    const unitId = url.searchParams.get('unit_id') || null;
    const result = await serviceRpc(env, 'get_study_progress_v1', { p_student_id: user.id, p_book_id: bookId, p_unit_id: unitId });
    return json(result, 200, origin);
  } catch (error) {
    return json({ success: false, error: String(error?.message || error) }, 500, origin);
  }
}

async function routeRequest(request, env, ctx) {
  const study = await handleStudyRoute(request, env);
  if (study) return study;
  return baseWorker.fetch(request, env, ctx);
}

export default {
  async fetch(request, env, ctx) {
    const firstRequest = preferCookieRequest(request);
    const first = await routeRequest(firstRequest, env, ctx);
    if (first.status !== 401) return first;

    const cookies = parseCookies(request.headers.get('Cookie') || '');
    const refreshToken = cookies.sb_refresh || cookies['sb-refresh'];
    const tokens = await refreshTokens(env, refreshToken).catch(() => null);
    if (!tokens) return first;

    let nextCookie = request.headers.get('Cookie') || '';
    nextCookie = replaceCookie(nextCookie, 'sb_access', encodeURIComponent(tokens.access_token));
    nextCookie = replaceCookie(nextCookie, 'sb_refresh', encodeURIComponent(tokens.refresh_token));

    const retriedRequest = preferCookieRequest(request, nextCookie);
    const retried = await routeRequest(retriedRequest, env, ctx);

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
