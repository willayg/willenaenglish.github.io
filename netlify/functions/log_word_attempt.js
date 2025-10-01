const { createClient } = require('@supabase/supabase-js');

// Expected tables (create via SQL in Supabase):
// progress_attempts (
//   id UUID PK default gen_random_uuid(),
//   user_id UUID,
//   session_id TEXT,
//   mode TEXT,
//   word TEXT,
//   is_correct BOOLEAN,
//   answer TEXT,
//   correct_answer TEXT,
//   points INT,
//   attempt_index INT,
//   duration_ms INT,
//   round INT,
//   extra JSONB,
//   created_at TIMESTAMPTZ DEFAULT now()
// )
// progress_sessions (
//   id UUID PK default gen_random_uuid(),
//   session_id TEXT UNIQUE,
//   user_id UUID,
//   mode TEXT,
//   list_name TEXT,
//   list_size INT,
//   started_at TIMESTAMPTZ DEFAULT now(),
//   ended_at TIMESTAMPTZ,
//   summary JSONB
// )


// Cookie helpers (align with supabase_proxy_fixed)
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

async function getUserFromAccessToken(supabase, accessToken) {
  if (!accessToken) return null;
  try {
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

exports.handler = async (event) => {
  // Simple health check and debug helpers
  if (event.httpMethod === 'GET') {
    try {
      const url = new URL(event.rawUrl || `http://localhost${event.path}${event.rawQuery ? '?' + event.rawQuery : ''}`);
      const selftest = url.searchParams.get('selftest');
      const env = url.searchParams.get('env');

      if (env) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            ok: true,
            env: {
              hasUrl: !!process.env.SUPABASE_URL,
              hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
              node: process.version
            }
          })
        };
      }

      if (selftest) {
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const sid = `selftest-${Date.now()}`;
        const up = await supabase.from('progress_sessions').upsert({ session_id: sid }, { onConflict: 'session_id' });
        if (up.error) {
          return { statusCode: 500, body: JSON.stringify({ ok: false, stage: 'upsert_session', error: up.error.message }) };
        }
        const ins = await supabase.from('progress_attempts').insert({ session_id: sid, mode: 'debug', word: 'ping', is_correct: true });
        if (ins.error) {
          return { statusCode: 500, body: JSON.stringify({ ok: false, stage: 'insert_attempt', error: ins.error.message }) };
        }
        return { statusCode: 200, body: JSON.stringify({ ok: true, note: 'selftest wrote a row', session_id: sid }) };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, note: 'log_word_attempt online' })
      };
    } catch (e) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, note: 'log_word_attempt online' }) };
    }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Best-effort resolve user from cookie access token
  const cookieHeader = (event.headers && (event.headers.Cookie || event.headers.cookie)) || '';
  const cookies = parseCookies(cookieHeader);
  // Support a few legacy/alternate cookie names defensively
  const accessToken = cookies['sb_access'] || cookies['sb-access'] || cookies['sb_access_token'] || cookies['sb-access-token'] || null;
  const user = await getUserFromAccessToken(supabase, accessToken);
  const userIdFromCookie = user && user.id ? user.id : null;

  try {
    const body = JSON.parse(event.body || '{}');
    const { event_type } = body;

    if (!event_type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing event_type' }) };
    }

  if (event_type === 'session_start') {
      // Do not create sessions for unauthenticated users
      if (!userIdFromCookie) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not signed in. Please log in to start a session.' }) };
      }
  const { session_id, user_id, mode, list_name, list_size, extra } = body;
      if (!session_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
      const { error } = await supabase.from('progress_sessions').upsert({
        session_id,
        user_id: userIdFromCookie,
        mode: mode || null,
        list_name: list_name || null,
        list_size: (typeof list_size === 'number') ? list_size : null,
        summary: extra || null
      }, { onConflict: 'session_id' });
      if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message, code: error.code, details: error.details, hint: error.hint }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

  if (event_type === 'session_end') {
      // Require authentication
      if (!userIdFromCookie) {
        return { statusCode: 401, body: JSON.stringify({ error: 'Not signed in. Please log in to end a session.' }) };
      }
  const { session_id, user_id, mode, extra, list_name, list_size } = body;
      if (!session_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
      // Fetch existing row to avoid overwriting list_name/list_size when not provided
      const { data: existing, error: fetchErr } = await supabase
        .from('progress_sessions')
        .select('list_name, list_size')
        .eq('session_id', session_id)
        .limit(1);
      if (fetchErr) return { statusCode: 400, body: JSON.stringify({ error: fetchErr.message }) };
      const prev = existing && existing[0] ? existing[0] : {};
      const nextListName = (list_name !== undefined && list_name !== null && list_name !== '') ? list_name : (prev.list_name || null);
      const nextListSize = (typeof list_size === 'number') ? list_size : (typeof prev.list_size === 'number' ? prev.list_size : null);

      const { error } = await supabase
        .from('progress_sessions')
        .update({
          ended_at: new Date().toISOString(),
          summary: extra || null,
          mode: mode || null,
          user_id: userIdFromCookie,
          list_name: nextListName,
            list_size: nextListSize
        })
        .eq('session_id', session_id);
      if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message, code: error.code, details: error.details, hint: error.hint }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (event_type === 'attempt') {
      // Require authentication: attempts must be attributed to a user
      if (!userIdFromCookie) {
  return { statusCode: 401, body: JSON.stringify({ error: 'Not signed in. Please log in.' }) };
      }
      const {
        user_id, session_id, mode, word,
        is_correct, answer, correct_answer,
        points, attempt_index, duration_ms, round,
        extra
      } = body;

      if (!word) return { statusCode: 400, body: JSON.stringify({ error: 'Missing word' }) };

      // Ensure a session row exists to satisfy FK (if you created the FK)
      if (session_id) {
  const stub = { session_id, user_id: userIdFromCookie, mode: mode || null };
        const { error: sessErr } = await supabase
          .from('progress_sessions')
          .upsert(stub, { onConflict: 'session_id' });
        if (sessErr) {
          return { statusCode: 400, body: JSON.stringify({ error: sessErr.message, code: sessErr.code, details: sessErr.details, hint: sessErr.hint }) };
        }
      }

      // Compute a safe default for points if not provided by client
      let safePoints = 0;
      if (points === 0 || points === null || points === undefined) {
        safePoints = is_correct ? 1 : 0;
      } else {
        const n = Number(points);
        safePoints = Number.isFinite(n) ? n : (is_correct ? 1 : 0);
      }

      const row = {
        user_id: userIdFromCookie,
        session_id: session_id || null,
        mode: mode || null,
        word,
        is_correct: !!is_correct,
        answer: answer ?? null,
        correct_answer: correct_answer ?? null,
        points: safePoints,
        attempt_index: attempt_index ?? null,
        duration_ms: duration_ms ?? null,
        round: round ?? null,
        extra: extra || null
      };
      const { error } = await supabase.from('progress_attempts').insert(row);
      if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message, code: error.code, details: error.details, hint: error.hint }) };
      
      // Server-authoritative total: sum of points for this user
      let points_total = 0;
      try {
        const { data: rpcVal, error: rpcErr } = await supabase.rpc('sum_points_for_user', { uid: userIdFromCookie });
        if (rpcErr) throw rpcErr;
        points_total = (typeof rpcVal === 'number') ? rpcVal : (rpcVal && typeof rpcVal.sum === 'number' ? rpcVal.sum : 0);
      } catch {
        // Fallback: paginate to avoid row caps
        const { count: totalRows, error: cntErr } = await supabase
          .from('progress_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userIdFromCookie)
          .not('points', 'is', null);
        if (cntErr) return { statusCode: 400, body: JSON.stringify({ error: cntErr.message }) };
        const pageSize = 1000;
        const total = totalRows || 0;
        for (let from = 0; from < total; from += pageSize) {
          const to = Math.min(from + pageSize - 1, total - 1);
          const { data: rows, error: pageErr } = await supabase
            .from('progress_attempts')
            .select('points')
            .eq('user_id', userIdFromCookie)
            .not('points', 'is', null)
            .range(from, to);
          if (pageErr) return { statusCode: 400, body: JSON.stringify({ error: pageErr.message }) };
          if (Array.isArray(rows)) rows.forEach(r => { points_total += (Number(r.points) || 0); });
        }
      }
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ ok: true, points_total: Number(points_total) })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown event_type' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
