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

  try {
    const body = JSON.parse(event.body || '{}');
    const { event_type } = body;

    if (!event_type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing event_type' }) };
    }

    if (event_type === 'session_start') {
      const { session_id, user_id, mode, list_name, list_size, extra } = body;
      if (!session_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
  const { error } = await supabase.from('progress_sessions').upsert({
        session_id,
        user_id: user_id || null,
        mode: mode || null,
        list_name: list_name || null,
        list_size: list_size ?? null,
        summary: extra || null
      }, { onConflict: 'session_id' });
  if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message, code: error.code, details: error.details, hint: error.hint }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (event_type === 'session_end') {
      const { session_id, user_id, mode, extra } = body;
      if (!session_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing session_id' }) };
  const { error } = await supabase
        .from('progress_sessions')
        .update({ ended_at: new Date().toISOString(), summary: extra || null, mode: mode || null, user_id: user_id || null })
        .eq('session_id', session_id);
  if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message, code: error.code, details: error.details, hint: error.hint }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    if (event_type === 'attempt') {
      const {
        user_id, session_id, mode, word,
        is_correct, answer, correct_answer,
        points, attempt_index, duration_ms, round,
        extra
      } = body;

      if (!word) return { statusCode: 400, body: JSON.stringify({ error: 'Missing word' }) };

      // Ensure a session row exists to satisfy FK (if you created the FK)
      if (session_id) {
        const stub = {
          session_id,
          user_id: user_id || null,
          mode: mode || null
        };
        const { error: sessErr } = await supabase
          .from('progress_sessions')
          .upsert(stub, { onConflict: 'session_id' });
        if (sessErr) {
          return { statusCode: 400, body: JSON.stringify({ error: sessErr.message, code: sessErr.code, details: sessErr.details, hint: sessErr.hint }) };
        }
      }

      const row = {
        user_id: user_id || null,
        session_id: session_id || null,
        mode: mode || null,
        word,
        is_correct: !!is_correct,
        answer: answer ?? null,
        correct_answer: correct_answer ?? null,
        points: points ?? null,
        attempt_index: attempt_index ?? null,
        duration_ms: duration_ms ?? null,
        round: round ?? null,
        extra: extra || null
      };
  const { error } = await supabase.from('progress_attempts').insert(row);
  if (error) return { statusCode: 400, body: JSON.stringify({ error: error.message, code: error.code, details: error.details, hint: error.hint }) };
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown event_type' }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
