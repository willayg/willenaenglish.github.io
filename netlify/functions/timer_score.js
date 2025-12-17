// netlify/functions/timer_score.js
// Timer Mode scoring + leaderboard API
// POST: upsert a user's best score for a given (session_id, round)
// GET: fetch top N scores for a given (session_id, round)
// Auth: requires sb_access cookie; resolves user id via Supabase admin auth
//
// Suggested schema (run in Supabase SQL):
// CREATE TABLE IF NOT EXISTS timer_scores (
//   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   session_id uuid NOT NULL,
//   round int NOT NULL,
//   user_id uuid NOT NULL,
//   name text,
//   score int NOT NULL DEFAULT 0,
//   created_at timestamptz DEFAULT now(),
//   updated_at timestamptz DEFAULT now(),
//   UNIQUE (session_id, round, user_id)
// );
// CREATE INDEX IF NOT EXISTS idx_timer_scores_session_round ON timer_scores (session_id, round);
// CREATE INDEX IF NOT EXISTS idx_timer_scores_score_desc ON timer_scores (score DESC);

const { createClient } = require('@supabase/supabase-js');

function json(status, body) {
  return { statusCode: status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) };
}

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

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' }, body: '' };

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
  if (!SUPABASE_URL || !SERVICE_KEY) return json(500, { success: false, error: 'Supabase env missing', hasUrl: !!SUPABASE_URL, hasKey: !!SERVICE_KEY });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Resolve user via sb_access cookie or Authorization header
  async function requireUser() {
    try {
      const hdrs = event.headers || {};
      const cookieHeader = (hdrs.Cookie || hdrs.cookie) || '';
      const cookies = parseCookies(cookieHeader);
      
      let token = cookies['sb_access'];
      
      // Fallback: check Authorization header if no cookie found
      if (!token) {
        const authHeader = hdrs.authorization || hdrs.Authorization || '';
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.slice(7);
        }
      }
      
      if (!token) return { error: 'Not authenticated (no cookie or auth header)' };
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData || !userData.user) return { error: 'Not authenticated (invalid token)' };
      const user = userData.user;
      const uid = user.id;
      // Strict: only use `profiles.name` as requested
      let display = null;
      try {
        const { data: prof, error: pErr } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', uid)
          .single();
        if (!pErr && prof) {
          display = prof.name || null;
        }
      } catch {}
      // No additional fallbacks by design; keep private
      return { id: uid, name: display || 'Player' };
    } catch {
      return { error: 'Not authenticated (exception)' };
    }
  }

  if (event.httpMethod === 'POST') {
    let body; try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { success: false, error: 'Invalid JSON' }); }
    const { session_id, round, score } = body || {};
    if (!session_id) return json(400, { success: false, error: 'Missing session_id' });
    const roundNum = Number(round);
    const scoreNum = Number(score);
    if (!Number.isFinite(roundNum) || roundNum < 1) return json(400, { success: false, error: 'Invalid round' });
    if (!Number.isFinite(scoreNum) || scoreNum < 0) return json(400, { success: false, error: 'Invalid score' });

    const user = await requireUser();
    if (user.error) return json(401, { success: false, error: user.error, requires_auth: true });
    // Preserve best score per (session_id, round, user_id): only update when higher
    const { data: rows, error: selErr } = await supabase
      .from('timer_scores')
      .select('id, session_id, round, user_id, name, score')
      .eq('session_id', session_id)
      .eq('round', roundNum)
      .eq('user_id', user.id)
      .limit(1);
    if (selErr) return json(500, { success: false, error: selErr.message });
    const existing = (rows && rows[0]) || null;

    if (existing) {
      if (scoreNum > Number(existing.score || 0)) {
        const { data: updated, error: upErr } = await supabase
          .from('timer_scores')
          .update({ score: scoreNum, name: user.name, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('session_id, round, user_id, name, score')
          .single();
        if (upErr) return json(500, { success: false, error: upErr.message });
        return json(200, { success: true, entry: updated });
      } else {
        // Do not downgrade the score; return existing best
        return json(200, { success: true, entry: { session_id, round: roundNum, user_id: user.id, name: existing.name || user.name, score: existing.score } });
      }
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('timer_scores')
        .insert({ session_id, round: roundNum, user_id: user.id, name: user.name, score: scoreNum, updated_at: new Date().toISOString() })
        .select('session_id, round, user_id, name, score')
        .single();
      if (insErr) return json(500, { success: false, error: insErr.message });
      return json(200, { success: true, entry: inserted });
    }
  }

  if (event.httpMethod === 'GET') {
    const qs = event.queryStringParameters || {};
    const session_id = qs.session_id || qs.sessionId;
    const round = Number(qs.round || qs.r || '0');
    const limit = Math.min(Math.max(Number(qs.limit || 10), 1), 100);
    const bestOnly = String(qs.best || qs.aggregate || '').trim() !== '';
    if (!session_id) return json(400, { success: false, error: 'Missing session_id' });
    if (!bestOnly && (!Number.isFinite(round) || round < 1)) return json(400, { success: false, error: 'Invalid round' });

    if (bestOnly) {
      // Fetch all scores for the session and aggregate best per user in memory
      const { data, error } = await supabase
        .from('timer_scores')
        .select('user_id, name, score, updated_at')
        .eq('session_id', session_id)
        .limit(10000); // defensive upper bound
      if (error) return json(500, { success: false, error: error.message });
      const bestMap = new Map(); // user_id -> { user_id, name, score, updated_at }
      for (const row of data || []) {
        const prev = bestMap.get(row.user_id);
        if (!prev || (row.score > prev.score) || (row.score === prev.score && new Date(row.updated_at) < new Date(prev.updated_at))) {
          bestMap.set(row.user_id, { user_id: row.user_id, name: row.name || 'Player', score: row.score, updated_at: row.updated_at });
        }
      }
      const arr = Array.from(bestMap.values()).sort((a, b) => b.score - a.score || new Date(a.updated_at) - new Date(b.updated_at));
      return json(200, { success: true, leaderboard: arr.slice(0, limit) });
    } else {
      const { data, error } = await supabase
        .from('timer_scores')
        .select('user_id, name, score, created_at, updated_at')
        .eq('session_id', session_id)
        .eq('round', round)
        .order('score', { ascending: false })
        .order('updated_at', { ascending: true })
        .limit(limit);
      if (error) return json(500, { success: false, error: error.message });
      return json(200, { success: true, leaderboard: data || [] });
    }
  }

  return json(405, { success: false, error: 'Method not allowed' });
};
