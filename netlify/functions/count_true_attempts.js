const { createClient } = require('@supabase/supabase-js');

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

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body)
  };
}

async function handler(event) {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method Not Allowed' });

  // Quick load check
  try {
    const url = new URL(event.rawUrl || 'http://local.test');
    if (url.searchParams.get('ping')) return json(200, { ok: true, pong: true });
  } catch {}

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
  const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key || process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !ADMIN_KEY) return json(500, { error: 'Missing Supabase env' });

  const cookieHeader = (event.headers && (event.headers.Cookie || event.headers.cookie)) || '';
  const cookies = parseCookies(cookieHeader);
  const accessToken = cookies['sb_access'] || null;

  const admin = createClient(SUPABASE_URL, ADMIN_KEY);
  const { data: userData, error: userErr } = await admin.auth.getUser(accessToken);
  if (userErr || !userData || !userData.user) return json(401, { error: 'Not signed in' });
  const userId = userData.user.id;

  // 1) Count of correct attempts
  const { count, error } = await admin
    .from('progress_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_correct', true);
  if (error) return json(400, { error: error.message });

  // 2) Sum of points for this user (sum all numeric values in points), paginated to avoid server max-rows cap
  // First, get total rows for this user so we know how many pages to fetch
  const { count: totalRows, error: cntErr } = await admin
    .from('progress_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .not('points', 'is', null);
  if (cntErr) return json(400, { error: cntErr.message });
  let points = 0;
  const pageSize = 1000;
  const total = totalRows || 0;
  for (let from = 0; from < total; from += pageSize) {
    const to = Math.min(from + pageSize - 1, total - 1);
    const { data: rows, error: pageErr } = await admin
      .from('progress_attempts')
      .select('points')
      .eq('user_id', userId)
      .not('points', 'is', null)
      .range(from, to);
    if (pageErr) return json(400, { error: pageErr.message, page: { from, to } });
    if (Array.isArray(rows) && rows.length) {
      for (const r of rows) points += (Number(r.points) || 0);
    }
  }

  return json(200, { ok: true, correct: count || 0, points });
}

exports.handler = handler;
module.exports = { handler };
