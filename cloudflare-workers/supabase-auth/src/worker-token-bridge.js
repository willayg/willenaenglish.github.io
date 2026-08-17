import authWorker from './index.js';

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(part.slice(i + 1).trim()); }
    catch { out[key] = part.slice(i + 1).trim(); }
  });
  return out;
}

function cookie(name, value, maxAge = 60 * 60 * 24 * 30) {
  return `${name}=${encodeURIComponent(value || '')}; Max-Age=${maxAge}; Path=/; Domain=.willenaenglish.com; Secure; HttpOnly; SameSite=None`;
}

function cors(origin) {
  const allowed = /^https:\/\/(?:[a-z0-9-]+\.)?willenaenglish\.com$/i.test(origin || '') ||
                  origin === 'https://willenaenglish.netlify.app' ||
                  origin === 'https://willenaenglish.github.io';
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
  };
}

async function verifyAccess(env, token) {
  if (!token) return false;
  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });
    return r.ok;
  } catch {
    return false;
  }
}

async function workerToken(request, env) {
  const origin = request.headers.get('Origin') || '';
  const headers = { 'Content-Type': 'application/json', ...cors(origin) };
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const access = cookies.sb_access || '';

  // Most persistent-login recoveries should stop here: copy the already-valid
  // HttpOnly access cookie into a short-lived bearer token for workers.dev.
  // This does not rotate or consume the refresh token.
  if (access && await verifyAccess(env, access)) {
    return new Response(JSON.stringify({ success: true, access_token: access, source: 'access_cookie' }), {
      status: 200,
      headers,
    });
  }

  // Only rotate the persistent refresh token when the access cookie itself has
  // expired. Keeping rotation server-side prevents multiple browser modules from
  // independently consuming the same refresh token.
  const refresh = cookies.sb_refresh || '';
  if (!refresh) {
    return new Response(JSON.stringify({ success: false, error: 'Not signed in' }), { status: 401, headers });
  }

  try {
    const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: env.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.access_token) {
      return new Response(JSON.stringify({ success: false, error: 'Not signed in' }), { status: 401, headers });
    }

    const response = new Response(JSON.stringify({
      success: true,
      access_token: data.access_token,
      source: 'refresh_cookie',
    }), { status: 200, headers });
    response.headers.append('Set-Cookie', cookie('sb_access', data.access_token));
    response.headers.append('Set-Cookie', cookie('sb_refresh', data.refresh_token || refresh));
    return response;
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Not signed in' }), { status: 401, headers });
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.searchParams.get('action') === 'worker_token' && request.method === 'GET') {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request.headers.get('Origin') || '') });
      return workerToken(request, env);
    }
    return authWorker.fetch(request, env, ctx);
  },
};
