// netlify/functions/supabase_auth.js
// Minimal auth proxy for Netlify + Supabase (v2).
// Actions: debug, login, get_email_by_username, get_role, get_profile_id, logout, refresh.

const ALLOWLIST = new Set([
  'https://www.willenaenglish.com',
  'https://willenaenglish.github.io',
  'https://willenaenglish.netlify.app',
  'http://localhost:9000',
  'http://localhost:8888',
]);

function getOrigin(event) {
  return (event.headers?.origin || event.headers?.Origin || '').trim();
}

function isLocalHost(event) {
  const h = (event.headers?.host || '').toLowerCase();
  return h.includes('localhost') || h.includes('127.0.0.1');
}

function cors(event, extra = {}) {
  const origin = getOrigin(event);
  const allowed = ALLOWLIST.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

function cookie(name, value, { maxAge, secure = true, httpOnly = true, sameSite = 'None', path = '/' } = {}) {
  let s = `${name}=${encodeURIComponent(value ?? '')}`;
  if (maxAge != null) s += `; Max-Age=${maxAge}`;
  if (path) s += `; Path=${path}`;
  if (secure) s += '; Secure';
  if (httpOnly) s += '; HttpOnly';
  if (sameSite) s += `; SameSite=${sameSite}`;
  return s;
}

function json(event, statusCode, obj, extraHeaders = {}) {
  return {
    statusCode,
    headers: { ...cors(event), 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(obj),
  };
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(event), body: '' };
  }

  // Dynamic import to avoid ERR_REQUIRE_ESM on Netlify
  const { createClient } = await import('@supabase/supabase-js');

  const SUPABASE_URL   = process.env.SUPABASE_URL;
  const SERVICE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY; // admin ops
  const ANON_KEY       = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY; // auth REST apikey

  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return json(event, 500, { success: false, error: 'Missing Supabase env vars' });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const qs = event.queryStringParameters || {};
  const action = qs.action;

  try {
    // --- debug ---
    if (action === 'debug' && event.httpMethod === 'GET') {
      return json(event, 200, {
        ok: true,
        hasUrl: !!SUPABASE_URL,
        hasAnon: !!ANON_KEY,
        hasService: !!SERVICE_KEY,
        node: process.version,
      });
    }

    // --- get_email_by_username (approved only) ---
    if (action === 'get_email_by_username' && event.httpMethod === 'GET') {
      const username = qs.username;
      if (!username) return json(event, 400, { success: false, error: 'Missing username' });
      const { data, error } = await admin
        .from('profiles')
        .select('email, approved')
        .eq('username', username)
        .single();
      if (error || !data) return json(event, 404, { success: false, error: 'Username not found' });
      if (!data.approved) return json(event, 403, { success: false, error: 'User not approved' });
      return json(event, 200, { success: true, email: data.email });
    }

    // --- login (email/password) ---
    if (action === 'login' && event.httpMethod === 'POST') {
      const { email, password } = JSON.parse(event.body || '{}');
      if (!email || !password) return json(event, 400, { success: false, error: 'Missing email or password' });

      // gate on approval
      const { data: profile, error: pErr } = await admin
        .from('profiles')
        .select('id, approved')
        .eq('email', email)
        .single();
      if (pErr || !profile) return json(event, 401, { success: false, error: 'User not found' });
      if (!profile.approved) return json(event, 403, { success: false, error: 'User not approved' });

      // password grant via REST
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({ email, password }),
      });
      const js = await resp.json().catch(() => ({}));
      if (!resp.ok || !js?.access_token) {
        const msg = js?.error_description || js?.error || 'Invalid credentials';
        return json(event, 401, { success: false, error: msg });
      }

      // cookies
      const secure = !isLocalHost(event);
      const setCookies = [
        cookie('sb_access', js.access_token, { maxAge: js.expires_in || 3600, secure }),
      ];
      if (js.refresh_token) {
        setCookies.push(cookie('sb_refresh', js.refresh_token, { maxAge: 60 * 60 * 24 * 30 * 6, secure }));
      }

      return json(
        event,
        200,
        { success: true, user: js.user || null },
        { 'Set-Cookie': setCookies }
      );
    }

    // --- get_role (profiles.role by user_id) ---
    if (action === 'get_role' && event.httpMethod === 'GET') {
      const user_id = qs.user_id;
      if (!user_id) return json(event, 400, { success: false, error: 'Missing user_id' });
      const { data, error } = await admin.from('profiles').select('role').eq('id', user_id).single();
      if (error) return json(event, 400, { success: false, error: error.message });
      return json(event, 200, { success: true, role: data.role });
    }

    // --- get_profile_id (by auth user id) ---
    if (action === 'get_profile_id' && event.httpMethod === 'GET') {
      const auth_user_id = qs.auth_user_id;
      if (!auth_user_id) return json(event, 400, { success: false, error: 'Missing auth_user_id' });
      const { data, error } = await admin.from('profiles').select('id').eq('id', auth_user_id).single();
      if (error || !data) return json(event, 404, { success: false, error: 'Not found' });
      return json(event, 200, { success: true, profile_id: data.id });
    }

    // --- logout (clear cookies) ---
    if (action === 'logout') {
      const expired = new Date(0);
      const secure = !isLocalHost(event);
      const setCookies = [
        cookie('sb_access', '', { secure, httpOnly: true, path: '/', sameSite: 'None' }) + `; Expires=${expired.toUTCString()}`,
        cookie('sb_refresh', '', { secure, httpOnly: true, path: '/', sameSite: 'None' }) + `; Expires=${expired.toUTCString()}`,
      ];
      return json(event, 200, { success: true }, { 'Set-Cookie': setCookies });
    }

    // --- refresh (rotate using refresh cookie) ---
    if (action === 'refresh' && event.httpMethod === 'GET') {
      const cookieHeader = event.headers?.cookie || event.headers?.Cookie || '';
      const refresh = (cookieHeader.split(/;\s*/).map(s => s.split('='))).reduce((acc, [k, v]) => {
        acc[k] = decodeURIComponent(v || '');
        return acc;
      }, {}).sb_refresh;

      if (!refresh) return json(event, 401, { success: false, error: 'No refresh token' });

      const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      const js = await resp.json().catch(() => ({}));
      if (!resp.ok || !js?.access_token) {
        const msg = js?.error_description || js?.error || 'Refresh failed';
        return json(event, 401, { success: false, error: msg });
      }

      const secure = !isLocalHost(event);
      const setCookies = [
        cookie('sb_access', js.access_token, { maxAge: js.expires_in || 3600, secure }),
        cookie('sb_refresh', js.refresh_token || refresh, { maxAge: 60 * 60 * 24 * 30 * 6, secure }),
      ];
      return json(event, 200, { success: true, expires_in: js.expires_in || 3600 }, { 'Set-Cookie': setCookies });
    }

    // not found
    return json(event, 404, { success: false, error: 'Not found' });
  } catch (e) {
    // unified error
    return json(event, 500, { success: false, error: e.message || 'Internal server error' });
  }
};
