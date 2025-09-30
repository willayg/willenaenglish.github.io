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

function makeCorsHeaders(event, extra = {}) {
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

function cookie(name, value, event, { maxAge, secure = true, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
  const hdrs = event?.headers || {};
  const host = hdrs.host || hdrs.Host || '';
  
  let s = `${name}=${encodeURIComponent(value ?? '')}`;
  if (maxAge != null) s += `; Max-Age=${maxAge}`;
  if (path) s += `; Path=${path}`;
  if (host.endsWith('willenaenglish.com')) s += '; Domain=.willenaenglish.com';
  if (secure) s += '; Secure';
  if (httpOnly) s += '; HttpOnly';
  if (sameSite) s += `; SameSite=${sameSite}`;
  return s;
}

function respond(event, statusCode, bodyObj, extraHeaders = {}, cookies /* string[] */) {
  const resp = {
    statusCode,
    headers: { ...makeCorsHeaders(event), 'Content-Type': 'application/json', ...extraHeaders },
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
    return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
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

  // Minimal cookie echo for diagnostics (no sensitive values returned)
  if (action === 'cookie_echo') {
    const hdrs = event.headers || {};
    const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
    const hasAccess = /(?:^|;\s*)sb_access=/.test(cookieHeader);
    const hasRefresh = /(?:^|;\s*)sb_refresh=/.test(cookieHeader);
    return respond(event, 200, {
      success: true,
      origin: (hdrs.origin || hdrs.Origin || null),
      host: (hdrs.host || hdrs.Host || null),
      hasAccess,
      hasRefresh
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

    // Detect localhost to relax cookie flags for http dev
    const isLocalDev = () => {
      const hdrs = event?.headers || {};
      const host = (hdrs.host || hdrs.Host || '').toLowerCase();
      return host.startsWith('localhost:') || host.startsWith('127.0.0.1');
    };

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

      // Cookies: in prod use SameSite=None; Secure. On localhost(http), use Lax and no Secure so browser sends them.
      const dev = isLocalDev();
      const cookies = [
        cookie('sb_access', authData.access_token, event, { maxAge: 3600, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
        cookie('sb_refresh', authData.refresh_token || '', event, { maxAge: 60 * 60 * 24 * 30, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
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
        if (!m) return { statusCode: 401, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Not signed in' }) };
        const token = decodeURIComponent(m[1]);

        // Validate token with Supabase
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data, error } = await admin.auth.getUser(token);
        if (error || !data || !data.user) return { statusCode: 401, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Not signed in' }) };
        const user = data.user;
        return { statusCode: 200, headers: makeCorsHeaders(event), body: JSON.stringify({ success: true, user_id: user.id, email: user.email }) };
      } catch {
        return { statusCode: 401, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Not signed in' }) };
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

    // Get profile name (name, username, avatar + optional korean_name/class for fallback)
    if (action === 'get_profile_name' && event.httpMethod === 'GET') {
      // Extract user ID from cookie like whoami does
      const hdrs = event.headers || {};
      const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
      const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
      if (!m) return respond(event, 401, { success: false, error: 'Not signed in' });
      const token = decodeURIComponent(m[1]);

      // Validate token with Supabase
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData || !userData.user) return respond(event, 401, { success: false, error: 'Not signed in' });
      const userId = userData.user.id;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error || !data) return respond(event, 404, { success: false, error: 'User not found' });
      
      const koreanName = data.korean_name || data.koreanname || data.kor_name || data.korean || data.name_kr || null;
      const classVal = data.class || data.class_name || data.homeroom || data.grade || data.group || null;
      return respond(event, 200, { 
        success: true, 
        name: data.name, 
        username: data.username, 
        avatar: data.avatar, 
        korean_name: koreanName, 
        class: classVal 
      });
    }

    // Get profile (full profile data with email, role, etc.)
    if (action === 'get_profile' && event.httpMethod === 'GET') {
      let userId = qs.user_id;
      if (!userId) {
        // Extract user ID from cookie like whoami does
        const hdrs = event.headers || {};
        const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
        const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
        if (!m) return respond(event, 401, { success: false, error: 'Not signed in' });
        const token = decodeURIComponent(m[1]);

        // Validate token with Supabase
        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: userData, error: userError } = await admin.auth.getUser(token);
        if (userError || !userData || !userData.user) return respond(event, 401, { success: false, error: 'Not signed in' });
        userId = userData.user.id;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error || !data) return respond(event, 404, { success: false, error: 'User not found' });
      
      const koreanName = data.korean_name || data.koreanname || data.kor_name || data.korean || data.name_kr || null;
      const classVal = data.class || data.class_name || data.homeroom || data.grade || data.group || null;
      return respond(event, 200, { 
        success: true, 
        name: data.name,
        email: data.email,
        approved: data.approved,
        role: data.role,
        username: data.username,
        avatar: data.avatar,
        korean_name: koreanName,
        class: classVal
      });
    }

    // Update profile avatar
    if (action === 'update_profile_avatar' && event.httpMethod === 'POST') {
      // Minimal CSRF mitigation: require trusted Origin/Referer
      const hdrs0 = event.headers || {};
      const origin0 = (hdrs0.origin || hdrs0.Origin || '').trim();
      const referer0 = (hdrs0.referer || hdrs0.Referer || '').trim();
      const TRUSTED = [
        'https://www.willenaenglish.com',
        'https://willenaenglish.com',
        'https://willenaenglish.github.io',
        'https://willenaenglish.netlify.app',
        'http://localhost:9000',
        'http://localhost:8888',
      ];
      const okOrigin = TRUSTED.includes(origin0);
      const okReferer = TRUSTED.some(p => referer0.startsWith(p + '/'));
      if (!okOrigin && !okReferer) {
        return respond(event, 403, { success: false, error: 'CSRF check failed' });
      }
      // Extract user ID from cookie like whoami does
      const hdrs = event.headers || {};
      const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
      const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
      if (!m) return respond(event, 401, { success: false, error: 'Not signed in' });
      const token = decodeURIComponent(m[1]);

      // Validate token with Supabase
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const { data: userData, error: userError } = await admin.auth.getUser(token);
      if (userError || !userData || !userData.user) return respond(event, 401, { success: false, error: 'Not signed in' });
      const userId = userData.user.id;

      const { avatar } = JSON.parse(event.body || '{}');
      if (!avatar || typeof avatar !== 'string') return respond(event, 400, { success: false, error: 'Missing avatar' });

      const { error } = await supabase
        .from('profiles')
        .update({ avatar })
        .eq('id', userId);
      if (error) return respond(event, 400, { success: false, error: error.message });
      return respond(event, 200, { success: true });
    }

    // Change password (verify current password, then update)
    if (action === 'change_password' && event.httpMethod === 'POST') {
      try {
        const body = JSON.parse(event.body || '{}');
        const { current_password, new_password } = body;
        if (!current_password || !new_password) return respond(event, 400, { success: false, error: 'Missing credentials' });
        if (String(new_password).length < 6) return respond(event, 400, { success: false, error: 'Password too short' });

        // Extract user from sb_access cookie
        const hdrs = event.headers || {};
        const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
        const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
        if (!m) return respond(event, 401, { success: false, error: 'Not signed in' });
        const token = decodeURIComponent(m[1]);

        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: userData, error: userError } = await admin.auth.getUser(token);
        if (userError || !userData || !userData.user) return respond(event, 401, { success: false, error: 'Not signed in' });
        const userId = userData.user.id;
        const userEmail = userData.user.email;

        // Re-auth by attempting password grant with current password
        const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
          body: JSON.stringify({ email: userEmail, password: current_password })
        });
        if (!authResp.ok) {
          return respond(event, 403, { success: false, error: 'Incorrect current password', error_code: 'bad_current' });
        }

        // Update password using admin API
        const { error: updError } = await admin.auth.admin.updateUserById(userId, { password: new_password });
        if (updError) return respond(event, 400, { success: false, error: updError.message || 'Update failed' });

        return respond(event, 200, { success: true });
      } catch (e) {
        return respond(event, 500, { success: false, error: 'Internal error' });
      }
    }

    // Change email (verify current password, then update auth + profile)
    if (action === 'change_email' && event.httpMethod === 'POST') {
      try {
        const body = JSON.parse(event.body || '{}');
        const { current_password, new_email } = body;
        if (!current_password || !new_email) return respond(event, 400, { success: false, error: 'Missing credentials' });
        const emailNorm = String(new_email).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(emailNorm)) return respond(event, 400, { success: false, error: 'Invalid email address', error_code: 'invalid_email' });

        // Extract user from sb_access cookie
        const hdrs = event.headers || {};
        const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
        const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
        if (!m) return respond(event, 401, { success: false, error: 'Not signed in' });
        const token = decodeURIComponent(m[1]);

        const admin = createClient(SUPABASE_URL, SERVICE_KEY);
        const { data: userData, error: userError } = await admin.auth.getUser(token);
        if (userError || !userData || !userData.user) return respond(event, 401, { success: false, error: 'Not signed in' });
        const userId = userData.user.id;
        const currentEmail = userData.user.email;

        // Re-auth using password grant with current email
        const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
          body: JSON.stringify({ email: currentEmail, password: current_password })
        });
        if (!authResp.ok) {
          return respond(event, 403, { success: false, error: 'Incorrect current password', error_code: 'bad_current' });
        }

        // Ensure new email not already in use (profiles table check)
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', emailNorm)
          .single();
        if (existingProfile) {
          return respond(event, 400, { success: false, error: 'Email already in use', error_code: 'email_in_use' });
        }

        // Update auth user email
        const { error: updErr } = await admin.auth.admin.updateUserById(userId, { email: emailNorm });
        if (updErr) return respond(event, 400, { success: false, error: updErr.message || 'Update failed' });

        // Update profiles table
        const { error: profErr } = await supabase
          .from('profiles')
          .update({ email: emailNorm })
          .eq('id', userId);
        if (profErr) return respond(event, 400, { success: false, error: profErr.message || 'Profile update failed' });

        return respond(event, 200, { success: true });
      } catch (e) {
        return respond(event, 500, { success: false, error: 'Internal error' });
      }
    }

    // Logout: clear cookies
    if (action === 'logout' && (event.httpMethod === 'POST' || event.httpMethod === 'GET')) {
      const dev = isLocalDev();
      const cookies = [
        cookie('sb_access', '', event, { maxAge: 0, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
        cookie('sb_refresh', '', event, { maxAge: 0, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
      ];
      return respond(event, 200, { success: true }, {}, cookies);
    }

    // Refresh session (rotate tokens)
    if (action === 'refresh' && event.httpMethod === 'GET') {
      // Extract refresh token from cookie
      const hdrs = event.headers || {};
      const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
      const m = /(?:^|;\s*)sb_refresh=([^;]+)/.exec(cookieHeader);
      if (!m) return respond(event, 200, { success: false, message: 'No refresh token' });

      const refreshToken = decodeURIComponent(m[1]);
      try {
        const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data.session) return respond(event, 200, { success: false, message: 'Refresh failed' });

        const session = data.session;
        const dev = isLocalDev();
        const cookies = [
          cookie('sb_access', session.access_token, event, { maxAge: 3600, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
          cookie('sb_refresh', session.refresh_token, event, { maxAge: 2592000, sameSite: dev ? 'Lax' : 'None', secure: !dev })
        ];
        return respond(event, 200, { success: true }, {}, cookies);
      } catch {
        return respond(event, 200, { success: false, message: 'Refresh failed' });
      }
    }

    // Not found
    return respond(event, 404, { success: false, error: 'Action not found' });
  } catch (error) {
    return respond(event, 500, { success: false, error: error && error.message ? error.message : 'Internal error' });
  }
};