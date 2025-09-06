exports.handler = async (event) => {
  try {
    // Dynamic ESM import for Netlify runtime
    const { createClient } = await import('@supabase/supabase-js');

    // CORS allowlist
    const ALLOWLIST = new Set([
      'https://www.willenaenglish.com',
      'https://willenaenglish.com',
      'https://willenaenglish.github.io',
      'https://willenaenglish.netlify.app',
      'http://localhost:9000',
      'http://localhost:8888'
    ]);

    function getRequestOrigin(event) {
      const h = (event && event.headers) || {};
      return h.origin || h.Origin || '';
    }

    function makeCorsHeaders(event) {
      const reqOrigin = getRequestOrigin(event);
      const allowOrigin = (reqOrigin && ALLOWLIST.has(reqOrigin)) ? reqOrigin : 'https://willenaenglish.netlify.app';
      return {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-store'
      };
    }

    function isLocalDev(event) {
      try {
        const headers = event.headers || {};
        const host = String(headers.host || headers.Host || '').toLowerCase();
        return host.includes('localhost') || host.includes('127.0.0.1');
      } catch {
        return false;
      }
    }

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
      return {
        statusCode: 500,
        headers: makeCorsHeaders(event),
        body: JSON.stringify({ success: false, error: 'Missing Supabase environment variables' })
      };
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const qs = event.queryStringParameters || {};
    const action = qs.action;

    // Debug endpoint
    if (action === 'debug' && event.httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: { ...makeCorsHeaders(event), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hasSupabaseUrl: !!SUPABASE_URL,
          hasAnonKey: !!ANON_KEY,
          hasServiceRole: !!SERVICE_KEY,
          node: process.version
        })
      };
    }

    // Get email by username
    if (action === 'get_email_by_username' && event.httpMethod === 'GET') {
      const username = qs.username;
      if (!username) {
        return {
          statusCode: 400,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'Missing username' })
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('email, approved')
        .eq('username', username)
        .single();

      if (error || !data) {
        return {
          statusCode: 404,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'Username not found' })
        };
      }

      if (!data.approved) {
        return {
          statusCode: 403,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'User not approved' })
        };
      }

      return {
        statusCode: 200,
        headers: makeCorsHeaders(event),
        body: JSON.stringify({ success: true, email: data.email })
      };
    }

    // Login
    if (action === 'login' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { email, password } = body;

      if (!email || !password) {
        return {
          statusCode: 400,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'Missing email or password' })
        };
      }

      // Check if user is approved
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, approved')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        return {
          statusCode: 401,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'User not found' })
        };
      }

      if (!profile.approved) {
        return {
          statusCode: 403,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'User not approved' })
        };
      }

      // Authenticate with Supabase
      const authResp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY },
        body: JSON.stringify({ email, password })
      });

      const authData = await authResp.json().catch(() => ({}));

      if (!authResp.ok || !authData.access_token) {
        const msg = authData?.error_description || authData?.error || 'Invalid credentials';
        return {
          statusCode: 401,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: msg })
        };
      }

      // Set cookies
      const secureFlag = !isLocalDev(event);
      const origin = getRequestOrigin(event) || '';
      let sameSite = 'Lax';

      // Determine if cross-site (use SameSite=None)
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

      const accessMaxAge = Number(authData.expires_in) > 0 ? Number(authData.expires_in) : 3600;
      const SIX_MONTHS = 60 * 60 * 24 * 30 * 6;

      const cookies = [
        `sb_access=${encodeURIComponent(authData.access_token)}; Max-Age=${accessMaxAge}; Path=/; ${secureFlag ? 'Secure; ' : ''}HttpOnly; SameSite=${sameSite}`
      ];

      if (authData.refresh_token) {
        cookies.push(`sb_refresh=${encodeURIComponent(authData.refresh_token)}; Max-Age=${SIX_MONTHS}; Path=/; ${secureFlag ? 'Secure; ' : ''}HttpOnly; SameSite=${sameSite}`);
      }

      return {
        statusCode: 200,
        headers: { ...makeCorsHeaders(event), 'Set-Cookie': cookies, 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, user: authData.user || null })
      };
    }

    // Get role
    if (action === 'get_role' && event.httpMethod === 'GET') {
      const userId = qs.user_id;
      if (!userId) {
        return {
          statusCode: 400,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'Missing user_id' })
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) {
        return {
          statusCode: 400,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: makeCorsHeaders(event),
        body: JSON.stringify({ success: true, role: data.role })
      };
    }

    // Get profile ID
    if (action === 'get_profile_id' && event.httpMethod === 'GET') {
      const authUserId = qs.auth_user_id;
      if (!authUserId) {
        return {
          statusCode: 400,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: 'Missing auth_user_id' })
        };
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', authUserId)
        .single();

      if (error) {
        return {
          statusCode: 400,
          headers: makeCorsHeaders(event),
          body: JSON.stringify({ success: false, error: error.message })
        };
      }

      return {
        statusCode: 200,
        headers: makeCorsHeaders(event),
        body: JSON.stringify({ success: true, profile_id: data.id })
      };
    }

    // Unknown action
    return {
      statusCode: 404,
      headers: makeCorsHeaders(event),
      body: JSON.stringify({ success: false, error: 'Action not found' })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: false, error: error.message || 'Internal server error' })
    };
  }
};
