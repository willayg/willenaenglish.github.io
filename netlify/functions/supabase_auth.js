// CORS + cookie helpers
function cors(event, extra = {}) {
  const ALLOWLIST = new Set([
    'https://www.willenaenglish.com',
  'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    // Cloudflare Pages deployment
    'https://cf.willenaenglish.com',
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
    // Cloudflare Pages deployment
    'https://cf.willenaenglish.com',
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

// Local dev helper: load `.env` from repo root into process.env when keys are missing.
// This makes `netlify dev` pick up local Supabase vars without changing production.
try {
  const fs = require('fs');
  const path = require('path');
  const repoRoot = path.join(__dirname, '..', '..');
  const envPath = path.join(repoRoot, '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
          val = val.slice(1, -1);
        }
        if (!process.env[m[1]]) process.env[m[1]] = val;
      }
    });
  }
} catch (e) {
  // ignore failures — production env should be set by Netlify
}

// ── Module-scope Supabase client (reused across warm invocations) ──
let _createClient;
try {
  _createClient = require('@supabase/supabase-js').createClient;
} catch {}
const _SUPABASE_URL = process.env.SUPABASE_URL;
const _SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const _ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const _supabase = (_createClient && _SUPABASE_URL && _SERVICE_KEY) ? _createClient(_SUPABASE_URL, _SERVICE_KEY) : null;

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
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY 
      || process.env.SUPABASE_SERVICE_KEY 
      || process.env.SUPABASE_KEY 
      || process.env.SUPABASE_SERVICE_ROLE 
      || process.env.SERVICE_ROLE_KEY;
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
    // Use module-scope Supabase client for faster warm starts
    const createClient = _createClient;
    const SUPABASE_URL = _SUPABASE_URL;
    const SERVICE_KEY = _SERVICE_KEY;
    const ANON_KEY = _ANON_KEY;
    const supabase = _supabase;

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY || !supabase) {
      return respond(event, 500, { success: false, error: 'Missing environment variables' });
    }

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
      let body;
      try {
        body = JSON.parse(event.body || '{}');
      } catch (parseErr) {
        return respond(event, 400, { success: false, error: 'Invalid JSON body' });
      }
      const { email, password } = body;
      if (!email || !password) return respond(event, 400, { success: false, error: 'Missing credentials' });

      // Run profile check and auth token fetch in parallel for faster login
      const profilePromise = supabase
        .from('profiles')
        .select('id, approved')
        .eq('email', email)
        .single();

      const authPromise = fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
        body: JSON.stringify({ email, password }),
      }).catch(fetchErr => ({ ok: false, fetchError: fetchErr }));

      const [profileResult, authResp] = await Promise.all([
        profilePromise.then(r => ({ data: r.data, error: r.error })).catch(e => ({ error: e })),
        authPromise
      ]);

      const { data: profile, error: profileError } = profileResult;

      // Check approval (must still reject if not approved even if auth succeeded)
      if (profileError || !profile || !profile.approved) {
        return respond(event, 401, { success: false, error: 'User not found or not approved' });
      }

      // Check if fetch itself failed (network error)
      if (authResp.fetchError) {
        console.error('[supabase_auth] fetch to Supabase auth failed:', authResp.fetchError);
        return respond(event, 500, { success: false, error: 'Auth service unavailable' });
      }

      // Process auth response
      let authData;
      try {
        authData = await authResp.json();
      } catch (jsonErr) {
        console.error('[supabase_auth] failed to parse auth response:', jsonErr);
        return respond(event, 500, { success: false, error: 'Auth service error' });
      }
      if (!authResp.ok || !authData.access_token) {
        return respond(event, 401, { success: false, error: (authData && authData.error_description) || 'Invalid credentials' });
      }

      // Cookies: in prod use SameSite=None; Secure. On localhost(http), use Lax and no Secure so browser sends them.
      // Make both access and refresh tokens effectively last ~30 days so you rarely need to log back in.
      const dev = isLocalDev();
      const cookies = [
        cookie('sb_access', authData.access_token, event, { maxAge: 60 * 60 * 24 * 30, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
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
        // First try SDK helper (may vary between supabase-js versions)
        try {
          const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
          if (data && data.session && data.session.access_token) {
            const session = data.session;
            const dev = isLocalDev();
            const cookies = [
              cookie('sb_access', session.access_token, event, { maxAge: 60 * 60 * 24 * 30, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
              cookie('sb_refresh', session.refresh_token, event, { maxAge: 60 * 60 * 24 * 30, sameSite: dev ? 'Lax' : 'None', secure: !dev })
            ];
            return respond(event, 200, { success: true }, {}, cookies);
          }
        } catch (sdkErr) {
          // fallthrough to REST exchange below
          console.error('[supabase_auth] sdk refreshSession failed:', sdkErr && sdkErr.message ? sdkErr.message : sdkErr);
        }

        // Fallback: use direct REST token exchange (works regardless of SDK version)
        try {
          const tokenUrl = `${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/token?grant_type=refresh_token`;
          const authResp = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          const authData = await authResp.json().catch(() => ({}));
          if (!authResp.ok || !authData.access_token) {
            console.error('[supabase_auth] REST refresh failed', { status: authResp.status, body: authData });
            return respond(event, 200, { success: false, message: 'Refresh failed' });
          }

          const session = {
            access_token: authData.access_token,
            refresh_token: authData.refresh_token || refreshToken
          };
          const dev = isLocalDev();
          const cookies = [
            cookie('sb_access', session.access_token, event, { maxAge: 60 * 60 * 24 * 30, sameSite: dev ? 'Lax' : 'None', secure: !dev }),
            cookie('sb_refresh', session.refresh_token, event, { maxAge: 60 * 60 * 24 * 30, sameSite: dev ? 'Lax' : 'None', secure: !dev })
          ];
          return respond(event, 200, { success: true }, {}, cookies);
        } catch (restErr) {
          console.error('[supabase_auth] REST exchange error:', restErr && restErr.message ? restErr.message : restErr);
          return respond(event, 200, { success: false, message: 'Refresh failed' });
        }
      } catch (e) {
        console.error('[supabase_auth] unexpected refresh error:', e && e.message ? e.message : e);
        return respond(event, 200, { success: false, message: 'Refresh failed' });
      }
    }

    // Not found
    return respond(event, 404, { success: false, error: 'Action not found' });
  } catch (error) {
    return respond(event, 500, { success: false, error: error && error.message ? error.message : 'Internal error' });
  }
};