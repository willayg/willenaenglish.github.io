
exports.handler = async (event) => {
  // Dynamic ESM import for Netlify runtime
  const { createClient } = await import('@supabase/supabase-js');

  // ---- Helpers ----
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

  function getRequestOrigin(event) {
    const h = (event && event.headers) || {};
    return h.origin || h.Origin || '';
  }

  const ALLOWLIST = new Set([
    'https://www.willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:9000',
    'http://localhost:8888'
  ]);
  const DEFAULT_ORIGIN = process.env.URL || 'https://willenaenglish.netlify.app';

  function makeCorsHeaders(event, extra = {}) {
    const reqOrigin = getRequestOrigin(event);
    const allowOrigin = (reqOrigin && ALLOWLIST.has(reqOrigin)) ? reqOrigin : DEFAULT_ORIGIN;
    return {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...extra,
    };
  }

  function isLocalDev(event) {
    try {
      const headers = event.headers || {};
      const host = String(headers.host || headers.Host || headers['x-forwarded-host'] || '').toLowerCase();
      if (host.includes('localhost') || host.includes('127.0.0.1')) return true;
      if (event.rawUrl) {
        const u = new URL(event.rawUrl);
        if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
      }
    } catch {}
    return false;
  }

  // Preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
  }

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const qs = event.queryStringParameters || {};
    const action = qs.action;

    // ---- action=debug ----
    if (action === 'debug' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: makeCorsHeaders(event, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }),
        body: JSON.stringify({
          hasSupabaseUrl: !!process.env.SUPABASE_URL,
          hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
          hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          node: process.version
        })
      };
    }

    // ---- action=get_email_by_username ----
    if (action === 'get_email_by_username' && event.httpMethod === 'GET') {
      try {
        const username = qs.username;
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

    // ---- action=login ----
    if (action === 'login' && event.httpMethod === 'POST') {
      try {
        const { email, password } = JSON.parse(event.body || '{}');
        if (!email || !password) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Missing email or password' }) };
        }
        // Check approval
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

        const API_KEY = process.env.SUPABASE_ANON_KEY;
        if (!API_KEY) {
          return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Auth key not configured' }) };
        }
        const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': API_KEY },
          body: JSON.stringify({ email, password })
        });
        const js = await authResp.json().catch(() => ({}));
        if (!authResp.ok || !js || !js.access_token) {
          const msg = js?.error_description || js?.error || 'Invalid credentials';
          return { statusCode: 401, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: msg }) };
        }

        // Cookies: SameSite=None for cross-site, Lax otherwise
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
        const secureFlag = !isLocalDev(event);
        const accessMaxAge = Number(js.expires_in) > 0 ? Number(js.expires_in) : 3600;
        const SIX_MONTHS = 60 * 60 * 24 * 30 * 6; // ~6 months
        const cookies = [
          `sb_access=${encodeURIComponent(js.access_token)}; Max-Age=${accessMaxAge}; Path=/; ${secureFlag ? 'Secure; ' : ''}HttpOnly; SameSite=${sameSite}`
        ];
        if (js.refresh_token) {
          cookies.push(`sb_refresh=${encodeURIComponent(js.refresh_token)}; Max-Age=${SIX_MONTHS}; Path=/; ${secureFlag ? 'Secure; ' : ''}HttpOnly; SameSite=${sameSite}`);
        }
        return {
          statusCode: 200,
          headers: { ...makeCorsHeaders(event), 'Set-Cookie': cookies, 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
          body: JSON.stringify({ success: true, user: js.user || null })
        };
      } catch (err) {
        return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // ---- action=get_role ----
    if (action === 'get_role' && event.httpMethod === 'GET') {
      try {
        const userId = qs.user_id;
        if (!userId) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Missing user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        if (error) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, headers: makeCorsHeaders(event), body: JSON.stringify({ success: true, role: data.role }) };
      } catch (err) {
        return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // ---- action=get_profile_id ----
    if (action === 'get_profile_id' && event.httpMethod === 'GET') {
      try {
        const authUserId = qs.auth_user_id;
        if (!authUserId) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Missing auth_user_id' }) };
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', authUserId)
          .single();
        if (error) {
          return { statusCode: 400, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: error.message }) };
        }
        return { statusCode: 200, headers: makeCorsHeaders(event), body: JSON.stringify({ success: true, profile_id: data.id }) };
      } catch (err) {
        return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
      }
    }

    // Default 404
    return { statusCode: 404, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: 'Auth action not found' }) };

  } catch (err) {
    return { statusCode: 500, headers: makeCorsHeaders(event), body: JSON.stringify({ success: false, error: err.message }) };
  }
};
