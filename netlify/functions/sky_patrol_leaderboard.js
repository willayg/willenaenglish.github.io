const { createClient } = require('@supabase/supabase-js');

function parseCookies(header = '') {
  const out = {};
  header.split(/;\s*/).forEach(part => {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  });
  return out;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'private, max-age=0, no-store'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async event => {
  if (event.httpMethod !== 'GET') return response(405, { error: 'Method Not Allowed' });

  const url = process.env.SUPABASE_URL || process.env.supabase_url;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
  if (!url || !serviceKey) return response(500, { error: 'Server configuration missing' });

  const cookies = parseCookies((event.headers && (event.headers.cookie || event.headers.Cookie)) || '');
  let token = cookies.sb_access || null;
  const authHeader = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  if (!token && authHeader.startsWith('Bearer ')) token = authHeader.slice(7);
  if (!token) return response(401, { error: 'Sign in required' });

  const supabase = createClient(url, serviceKey);
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData || !authData.user) return response(401, { error: 'Invalid session' });

  const { data, error } = await supabase
    .from('progress_sessions')
    .select('user_id, summary, ended_at')
    .eq('mode', 'short-a-sky-patrol')
    .eq('list_name', 'short-a')
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: false })
    .limit(1000);

  if (error) return response(500, { error: error.message });

  const best = new Map();
  for (const row of data || []) {
    let summary = row.summary;
    if (typeof summary === 'string') {
      try { summary = JSON.parse(summary); } catch { summary = null; }
    }
    if (!summary || summary.completed !== true) continue;
    const score = Number(summary.arcade_score) || 0;
    const speed = Number(summary.speed) || 1;
    const duration = Number(summary.duration_ms) || Number.MAX_SAFE_INTEGER;
    const name = String(summary.display_name || 'Student').slice(0, 40);
    const candidate = { user_id: row.user_id, name, score, speed, duration_ms: duration };
    const previous = best.get(row.user_id);
    if (!previous || score > previous.score || (score === previous.score && speed > previous.speed) || (score === previous.score && speed === previous.speed && duration < previous.duration_ms)) {
      best.set(row.user_id, candidate);
    }
  }

  const leaderboard = [...best.values()]
    .sort((a, b) => b.score - a.score || b.speed - a.speed || a.duration_ms - b.duration_ms || a.name.localeCompare(b.name))
    .slice(0, 10)
    .map((entry, index) => ({ ...entry, rank: index + 1, self: entry.user_id === authData.user.id }));

  return response(200, { success: true, leaderboard });
};