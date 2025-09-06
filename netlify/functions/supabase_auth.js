// CORS + cookie helpers
function cors(event, extra = {}) {
  const ALLOWLIST = new Set([
    'https://www.willenaenglish.com',
  'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:9000',
    'http://localhost:8888',
  ]);
  const hdrs = event.headers || {};
  const origin = (hdrs.origin || hdrs.Origin || '').trim();
  const allow = ALLOWLIST.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

function cookie(name, value, { maxAge, secure = true, httpOnly = true, sameSite = 'None', path = '/', domain } = {}) {
  let s = `${name}=${encodeURIComponent(value ?? '')}`;
  if (maxAge != null) s += `; Max-Age=${maxAge}`;
  if (path) s += `; Path=${path}`;
  if (domain) s += `; Domain=${domain}`;
  if (secure) s += '; Secure';
  if (httpOnly) s += '; HttpOnly';
  if (sameSite) s += `; SameSite=${sameSite}`;
  return s;
}

function respond(event, statusCode, bodyObj, extraHeaders = {}, cookies /* string[] */) {
  const resp = {
    statusCode,
    headers: { ...cors(event), 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(bodyObj),
  };
  if (cookies && cookies.length) {
    resp.multiValueHeaders = { 'Set-Cookie': cookies };
  }
  return resp;
}

exports.handler = async (event) => {
  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors(event), body: '' };
  }

  const qs = event.queryStringParameters || {};
  const action = qs.action;

  // Debug endpoint should not require supabase-js
  if (action === 'debug') {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    return respond(event, 200, {
      success: true,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasAnonKey: !!ANON_KEY,
      hasServiceRole: !!SERVICE_KEY,
      node: process.version,
    });
  }

  try {
    // Lazy import supabase only when needed
    let createClient;
    try {
      const supabaseModule = await import('@supabase/supabase-js');
      createClient = supabaseModule.createClient;
    } catch (e) {
      try {
        createClient = require('@supabase/supabase-js').createClient;
      } catch (e2) {
        return respond(event, 500, { success: false, error: 'Failed to load supabase client' });
      }
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return respond(event, 500, { success: false, error: 'Missing environment variables' });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    // Get email by username
    if (action === 'get_email_by_username') {
      const username = qs.username;
      if (!username) return respond(event, 400, { success: false, error: 'Missing username' });

      const { data, error } = await supabase
        .from('profiles')
        .select('email, approved')
        .eq('username', username)
        .single();

      if (error || !data) return respond(event, 404, { success: false, error: 'Username not found' });
      if (!data.approved) return respond(event, 403, { success: false, error: 'User not approved' });

      return respond(event, 200, { success: true, email: data.email });
    }

    // Login
    if (action === 'login' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email, password } = body;
      if (!email || !password) return respond(event, 400, { success: false, error: 'Missing credentials' });

      // Check approval
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, approved')
        .eq('email', email)
        .single();

      if (profileError || !profile || !profile.approved) {
        return respond(event, 401, { success: false, error: 'User not found or not approved' });
      }

      // Auth with Supabase
      const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({ email, password }),
      });
      const authData = await authResp.json();
      if (!authResp.ok || !authData.access_token) {
        return respond(event, 401, { success: false, error: (authData && authData.error_description) || 'Invalid credentials' });
      }

      // Always set domain for willenaenglish.com sites so cookies work on both apex and www
      let cookieDomain = '.willenaenglish.com';

      const cookies = [
        cookie('sb_access', authData.access_token, { maxAge: 3600, domain: cookieDomain }),
        cookie('sb_refresh', authData.refresh_token || '', { maxAge: 60 * 60 * 24 * 30, domain: cookieDomain }),
      ];
      return respond(event, 200, { success: true, user: authData.user }, {}, cookies);
    }

    // whoami: verify cookie session and return user basics
    if (action === 'whoami' && event.httpMethod === 'GET') {
      // Read sb_access from Cookie header
      try {
        const hdrs = event.headers || {};
        const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
        const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
        if (!m) return respond(event, 401, { success: false, error: 'Not signed in' });
        const token = decodeURIComponent(m[1]);

        // Validate token with Supabase
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data || !data.user) return respond(event, 401, { success: false, error: 'Not signed in' });
        const user = data.user;
        return respond(event, 200, { success: true, user_id: user.id, email: user.email });
      } catch {
        return respond(event, 401, { success: false, error: 'Not signed in' });
      }
    }

    // Get role
    if (action === 'get_role') {
      const userId = qs.user_id;
      if (!userId) return respond(event, 400, { success: false, error: 'Missing user_id' });

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();
      if (error) return respond(event, 400, { success: false, error: error.message });
      return respond(event, 200, { success: true, role: data.role });
    }

    // Get profile ID
    if (action === 'get_profile_id') {
      const authUserId = qs.auth_user_id;
      if (!authUserId) return respond(event, 400, { success: false, error: 'Missing auth_user_id' });

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUserId)
        .single();
      if (error) return respond(event, 400, { success: false, error: error.message });
      return respond(event, 200, { success: true, profile_id: data.id });
    }

    // Not found
    return respond(event, 404, { success: false, error: 'Action not found' });
  } catch (error) {
    return respond(event, 500, { success: false, error: error && error.message ? error.message : 'Internal error' });
  }
};
