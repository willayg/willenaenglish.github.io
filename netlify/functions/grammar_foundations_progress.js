const { createClient } = require('@supabase/supabase-js');

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(/;\s*/).forEach(kv => {
    const idx = kv.indexOf('=');
    if (idx > 0) {
      const key = kv.slice(0, idx).trim();
      const value = kv.slice(idx + 1).trim();
      if (key && !(key in out)) out[key] = decodeURIComponent(value);
    }
  });
  return out;
}

async function getUser(supabase, event) {
  const headers = event.headers || {};
  const cookies = parseCookies(headers.Cookie || headers.cookie || '');
  let token = cookies.sb_access || cookies['sb-access'] || cookies.sb_access_token || cookies['sb-access-token'] || null;
  const auth = headers.authorization || headers.Authorization || '';
  if (!token && auth.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  return error ? null : data?.user || null;
}

function reply(statusCode, body) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return reply(200, { ok: true });
  if (!['GET', 'POST'].includes(event.httpMethod)) return reply(405, { error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL || process.env.supabase_url;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_key;
  if (!url || !key) return reply(500, { error: 'Supabase environment unavailable' });

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const user = await getUser(supabase, event);
  if (!user?.id) return reply(401, { error: 'Not signed in' });

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('grammar_foundation_stage_progress')
      .select('module_id,stage_id,attempt_count,best_score,latest_score,total,passed,first_passed_at,last_attempt_at,updated_at')
      .eq('student_id', user.id)
      .order('module_id')
      .order('stage_id');
    if (error) return reply(500, { error: error.message });
    return reply(200, { ok: true, progress: data || [] });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return reply(400, { error: 'Invalid JSON' }); }
  const moduleId = String(body.module_id || '').trim();
  const stageId = String(body.stage_id || '').trim();
  const score = Number(body.score);
  const total = Number(body.total || 10);
  const passed = body.passed === true;
  const results = Array.isArray(body.results) ? body.results : [];
  if (!moduleId || !stageId || !Number.isInteger(score) || !Number.isInteger(total) || total <= 0 || score < 0 || score > total) {
    return reply(400, { error: 'Invalid stage result' });
  }

  const now = new Date().toISOString();
  const { error: runError } = await supabase.from('grammar_foundation_stage_runs').insert({
    student_id: user.id,
    module_id: moduleId,
    stage_id: stageId,
    score,
    total,
    passed,
    results,
    completed_at: now
  });
  if (runError) return reply(500, { error: runError.message });

  const { data: existing, error: existingError } = await supabase
    .from('grammar_foundation_stage_progress')
    .select('*')
    .eq('student_id', user.id)
    .eq('module_id', moduleId)
    .eq('stage_id', stageId)
    .maybeSingle();
  if (existingError) return reply(500, { error: existingError.message });

  const next = {
    student_id: user.id,
    module_id: moduleId,
    stage_id: stageId,
    attempt_count: Number(existing?.attempt_count || 0) + 1,
    best_score: Math.max(Number(existing?.best_score || 0), score),
    latest_score: score,
    total,
    passed: Boolean(existing?.passed) || passed,
    first_passed_at: existing?.first_passed_at || (passed ? now : null),
    last_attempt_at: now,
    updated_at: now
  };

  const { data: saved, error: saveError } = await supabase
    .from('grammar_foundation_stage_progress')
    .upsert(next, { onConflict: 'student_id,module_id,stage_id' })
    .select()
    .single();
  if (saveError) return reply(500, { error: saveError.message });

  return reply(200, { ok: true, progress: saved });
};
