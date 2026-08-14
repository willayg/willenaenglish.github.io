const OP_URL = 'https://fiieuiktlsivwfgyivai.supabase.co';
const OP_ANON_KEY = 'sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';

const ALLOWED_ORIGINS = new Set([
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
]);

function cors(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://staging.willenaenglish.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Cache-Control': 'no-store',
  };
}

function json(origin, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(/;\s*/).forEach(part => {
    const i = part.indexOf('=');
    if (i <= 0) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

async function authenticatedUser(request) {
  const auth = request.headers.get('Authorization') || '';
  const cookies = parseCookies(request.headers.get('Cookie') || '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : cookies.sb_access;
  if (!token) return null;

  const r = await fetch(`${OP_URL}/auth/v1/user`, {
    headers: { apikey: OP_ANON_KEY, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const user = await r.json().catch(() => null);
  return user && user.id ? user : null;
}

function resolvedCount(state) {
  if (!state) return 0;
  return Array.isArray(state.completedIds) ? state.completedIds.length : Number(state.index || 0);
}

function rank(state) {
  if (!state) return -1;
  return resolvedCount(state) * 1000000 + (state.finishedAt ? 100000 : 0) + Number(state.shownCount || 0);
}

function serviceHeaders(env, extra = {}) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function readState(env, sessionId) {
  const q = `${OP_URL}/rest/v1/progress_sessions?select=summary&session_id=eq.${encodeURIComponent(sessionId)}&limit=1`;
  const r = await fetch(q, { headers: serviceHeaders(env), cache: 'no-store' });
  if (!r.ok) throw new Error(`Supabase read failed (${r.status}) ${await r.text()}`);
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0].summary : null;
}

async function writeState(env, userId, date, state) {
  const sessionId = `study-v2-daily:${userId}:${date}`;
  const current = await readState(env, sessionId);
  if (current && rank(current) >= rank(state)) return { accepted: false, session: current };

  const now = new Date().toISOString();
  const resolved = resolvedCount(state);
  const authoritative = {
    ...state,
    date,
    server_saved_at: now,
    resolved_count: resolved,
  };
  const row = {
    session_id: sessionId,
    user_id: userId,
    mode: 'study-v2-daily',
    list_name: `daily-study:${date}`,
    list_size: Number(state.target || 20),
    started_at: state.startedAt ? new Date(state.startedAt).toISOString() : now,
    ended_at: state.finishedAt ? new Date(state.finishedAt).toISOString() : null,
    summary: authoritative,
  };

  const r = await fetch(`${OP_URL}/rest/v1/progress_sessions?on_conflict=session_id`, {
    method: 'POST',
    headers: serviceHeaders(env, { Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`Supabase write failed (${r.status}) ${await r.text()}`);
  const rows = await r.json();
  const saved = Array.isArray(rows) && rows[0] && rows[0].summary ? rows[0].summary : authoritative;
  return { accepted: true, session: saved };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    if (!env.SUPABASE_SERVICE_ROLE_KEY) return json(origin, 500, { success: false, error: 'Worker missing Supabase service key' });

    const url = new URL(request.url);
    const date = String(url.searchParams.get('date') || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json(origin, 400, { success: false, error: 'Invalid date' });

    const user = await authenticatedUser(request);
    if (!user) return json(origin, 401, { success: false, error: 'Not signed in' });

    const sessionId = `study-v2-daily:${user.id}:${date}`;
    try {
      if (request.method === 'GET') {
        const session = await readState(env, sessionId);
        return json(origin, 200, { success: true, user_id: user.id, session });
      }

      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); }
        catch { return json(origin, 400, { success: false, error: 'Invalid JSON' }); }
        const state = body && body.session;
        if (!state || typeof state !== 'object' || state.date !== date) {
          return json(origin, 400, { success: false, error: 'Invalid Daily Study state' });
        }
        const result = await writeState(env, user.id, date, state);
        return json(origin, 200, {
          success: true,
          accepted: result.accepted,
          resolved_count: resolvedCount(result.session),
          session: result.session,
        });
      }

      return json(origin, 405, { success: false, error: 'Method not allowed' });
    } catch (e) {
      console.error('[daily-study-state]', e);
      return json(origin, 500, { success: false, error: e.message || 'Server error' });
    }
  },
};
