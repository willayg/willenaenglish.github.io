
exports.handler = async (event) => {
  console.log('=== AUTH FUNCTION START ===');
  console.log('Received event:', event.httpMethod, event.path);
  
  // Dynamic ESM import to avoid ERR_REQUIRE_ESM
  const { createClient } = await import('@supabase/supabase-js');

  // Helpers for cookie-based sessions
  function parseCookies(header) {
    const out = {};
    if (!header) return out;
    header.split(/;\s*/).forEach(kv => {
      const idx = kv.indexOf('=');
      if (idx > 0) {
        const k = kv.slice(0, idx).trim();
        const v = kv.slice(idx + 1).trim();
        if (k && !(k in out)) out[k] = decodeURIComponent(v);
      }
    });
    return out;
  }

  function makeCookie(name, value, { maxAge, expires, secure = true, httpOnly = true, sameSite = 'Lax', path = '/' } = {}) {
    let str = `${name}=${encodeURIComponent(value || '')}`;
    if (maxAge != null) str += `; Max-Age=${maxAge}`;
    if (expires) str += `; Expires=${expires.toUTCString()}`;
    if (path) str += `; Path=${path}`;
    if (secure) str += '; Secure';
    if (httpOnly) str += '; HttpOnly';
    if (sameSite) str += `; SameSite=${sameSite}`;
    return str;
  }

  // Minimal CORS helpers
  function getRequestOrigin(event) {
    const h = (event && event.headers) || {};
    return h.origin || h.Origin || '';
  }
  function makeCorsHeaders(event, extra = {}) {
    const origin = getRequestOrigin(event);
    const headers = {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...extra,
    };
    if (origin) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
    } else {
      headers['Access-Control-Allow-Origin'] = '*';
    }
    return headers;
  }

  // Generic preflight support
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
  }

  // Determine if current request is from a local dev origin
  function isLocalDev(event) {
    try {
      const headers = event.headers || {};
      const host = String(headers.host || headers.Host || headers["x-forwarded-host"] || '').toLowerCase();
      if (host.includes('localhost') || host.includes('127.0.0.1')) return true;
      if (event.rawUrl) {
        const u = new URL(event.rawUrl);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
      }
    } catch {}
    return false;
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const action = event.queryStringParameters.action;

    // --- GET EMAIL BY USERNAME (only approved users) ---
    if (action === 'get_email_by_username' && event.httpMethod === 'GET') {
      try {
        const username = event.queryStringParameters.username;
        if (!username) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Missing username' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('email, approved')
          .eq('username', username)
          .single();
        if (error || !data) {
          return { statusCode: 404, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Username not found' }) };
        }
        if (!data.approved) {
          return { statusCode: 403, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'User not approved' }) };
        }
        return { statusCode: 200, headers: makeCorsHeaders(event), body: JSON.stringify({ success: true, email: data.email }) };
      } catch (err) {
        return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- SECURE SIGNUP ---
    if (action === 'signup' && event.httpMethod === 'POST') {
      try {
        const { email, password, name, username } = JSON.parse(event.body);
        if (!email || !password || !name || !username) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Missing name, email, password, or username' }) };
        }
        const { data: userData, error: signUpError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });
        if (signUpError || !userData || !userData.user) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: signUpError ? signUpError.message : 'Sign up failed' }) };
        }
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([{ id: userData.user.id, email, name, username, approved: true, role: 'teacher' }]);
        if (profileError) {
          return { statusCode: 400, body: JSON.stringify({ success: false, error: profileError.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ success: true, user: { id: userData.user.id, email, name, username } }) };
      } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- TEACHER LOGIN ---
    if (action === 'login' && event.httpMethod === 'POST') {
      try {
        const { email, password } = JSON.parse(event.body || '{}');
        if (!email || !password) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Missing email or password' }) };
        }
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, approved')
          .eq('email', email)
          .single();
        if (profileError || !profile) {
          return { statusCode: 401, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'User not found or not approved' }) };
        }
        if (!profile.approved) {
          return { statusCode: 403, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'User not approved' }) };
        }
        const API_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
        if (!API_KEY) {
          return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Auth key not configured' }) };
        }
        const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
          body: JSON.stringify({ email, password })
        });
        const authData = await authResp.json().catch(() => ({}));
        if (!authResp.ok || !authData || !authData.access_token) {
          const msg = authData?.error_description || authData?.error || 'Invalid credentials';
          return { statusCode: 401, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: msg }) };
        }
        const secureFlag = !isLocalDev(event);
        const origin = getRequestOrigin(event) || '';
        let sameSite = 'Lax';
        try {
          if (origin) {
            const originHost = new URL(origin).hostname;
            const hostHeader = (event.headers.host || event.headers.Host || '');
            const hostHost = hostHeader.split(':')[0];
            const isLocalPair = (/^(localhost|127\.0\.0\.1)$/i.test(originHost)) && (/^(localhost|127\.0\.0\.1)$/i.test(hostHost));
            const crossSite = originHost && hostHost && originHost.toLowerCase() !== hostHost.toLowerCase() && !isLocalPair;
            if (crossSite) sameSite = 'None';
          }
        } catch {}
        const cookies = [
          makeCookie('sb_access', authData.access_token, { maxAge: 3600, secure: secureFlag, httpOnly: true, sameSite, path: '/' })
        ];
        if (authData.refresh_token) {
          cookies.push(makeCookie('sb_refresh', authData.refresh_token, { maxAge: 604800, secure: secureFlag, httpOnly: true, sameSite, path: '/' }));
        }
        return {
          statusCode: 200,
          headers: { ...makeCorsHeaders(event), 'Set-Cookie': cookies, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, user: authData.user || null })
        };
      } catch (err) {
        console.error('=== LOGIN ERROR ===', err.message, err.stack);
        return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // --- LOGOUT ---
    if (action === 'logout') {
      const expired = new Date(0);
      const secureFlag = !isLocalDev(event);
      return {
        statusCode: 200,
        headers: {
          'Set-Cookie': [
            makeCookie('sb_access', '', { expires: expired, path: '/', secure: secureFlag, httpOnly: true, sameSite: 'Lax' }),
            makeCookie('sb_refresh', '', { expires: expired, path: '/', secure: secureFlag, httpOnly: true, sameSite: 'Lax' })
          ],
          'Cache-Control': 'no-store',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ success: true })
      };
    }

    // --- REFRESH TOKEN ---
    if (action === 'refresh' && event.httpMethod === 'GET') {
      try {
        const cookieHeader = (event.headers && (event.headers.Cookie || event.headers.cookie)) || '';
        const cookies = parseCookies(cookieHeader);
        const refreshTok = cookies['sb_refresh'];
        if (!refreshTok) {
          return { statusCode: 401, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: 'No refresh token' }) };
        }
        const API_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
          body: JSON.stringify({ refresh_token: refreshTok })
        });
        const js = await resp.json().catch(() => ({}));
        if (!resp.ok || !js || !js.access_token) {
          return { statusCode: 401, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: js?.error_description || js?.error || 'Refresh failed' }) };
        }
        const accessToken = js.access_token;
        const newRefresh = js.refresh_token || refreshTok;
        const expiresIn = Number(js.expires_in) > 0 ? Number(js.expires_in) : 3600;
        const cookiesOut = [];
        const secureFlag = !isLocalDev(event);
        cookiesOut.push(
          makeCookie('sb_access', accessToken, { maxAge: expiresIn, secure: secureFlag, httpOnly: true, sameSite: 'Lax', path: '/' })
        );
        const SIX_MONTHS = 60 * 60 * 24 * 30 * 6;
        cookiesOut.push(
          makeCookie('sb_refresh', newRefresh, { maxAge: SIX_MONTHS, secure: secureFlag, httpOnly: true, sameSite: 'Lax', path: '/' })
        );
        return {
          statusCode: 200,
          headers: { 'Set-Cookie': cookiesOut, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, expires_in: expiresIn })
        };
      } catch (err) {
        return { statusCode: 500, headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    return { statusCode: 404, headers: makeCorsHeaders(event), body: JSON.stringify({ error: 'Auth action not found' }) };

  } catch (err) {
    console.log('=== AUTH FUNCTION ERROR ===');
    console.log('Error message:', err.message);
    console.log('Error stack:', err.stack);
    console.log('=== END ERROR ===');
    return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ error: 'Internal server error: ' + err.message }) };
  }
};
