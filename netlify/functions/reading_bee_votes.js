const { createClient } = require('@supabase/supabase-js');

const AWARDS = [
  'champion','second_place','third_place','best_fluency','best_expression',
  'best_pronunciation','best_comprehension','most_improved','most_confident',
  'best_storyteller','best_character_voice'
];

function headers(event) {
  const origin = String(event.headers?.origin || event.headers?.Origin || '').trim();
  const allowed = new Set([
    'https://teachers.willenaenglish.com',
    'https://staging.willenaenglish.com',
    'https://www.willenaenglish.com',
    'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:8888',
    'http://localhost:9000'
  ]);
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://teachers.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  };
}

const reply = (event, statusCode, body) => ({ statusCode, headers: headers(event), body: JSON.stringify(body) });

function accessToken(event) {
  const cookie = event.headers?.cookie || event.headers?.Cookie || '';
  const match = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookie);
  if (match) return decodeURIComponent(match[1]);
  const auth = event.headers?.authorization || event.headers?.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

function tally(rows) {
  const grouped = {};
  for (const key of AWARDS) grouped[key] = new Map();

  for (const row of rows || []) {
    if (!grouped[row.award_key]) continue;
    const display = cleanName(row.student_name);
    if (!display) continue;
    const norm = display.toLocaleLowerCase('en-US');
    const current = grouped[row.award_key].get(norm) || { name: display, count: 0 };
    current.count += 1;
    grouped[row.award_key].set(norm, current);
  }

  const result = {};
  for (const key of AWARDS) {
    result[key] = Array.from(grouped[key].values())
      .sort((a,b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 20);
  }
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: headers(event), body: '' };
  if (!['GET','POST'].includes(event.httpMethod)) return reply(event, 405, { success:false, error:'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply(event, 500, { success:false, error:'Missing server configuration' });

  const db = createClient(url, key, { auth: { persistSession:false, autoRefreshToken:false } });
  const token = accessToken(event);
  if (!token) return reply(event, 401, { success:false, error:'Not signed in' });

  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData?.user) return reply(event, 401, { success:false, error:'Not signed in' });

  const { data: actor, error: actorError } = await db
    .from('profiles')
    .select('role,approved')
    .eq('id', authData.user.id)
    .single();

  const role = String(actor?.role || '').toLowerCase();
  if (actorError || !actor || !['teacher','admin'].includes(role) || actor.approved === false) {
    return reply(event, 403, { success:false, error:'Teacher access required' });
  }

  if (event.httpMethod === 'GET') {
    const { data: mine, error: mineError } = await db
      .from('reading_bee_votes')
      .select('award_key,student_name,updated_at')
      .eq('teacher_id', authData.user.id);
    if (mineError) return reply(event, 400, { success:false, error:mineError.message });

    const payload = {
      success:true,
      is_admin: role === 'admin',
      votes: Object.fromEntries((mine || []).map(r => [r.award_key, r.student_name]))
    };

    if (role === 'admin') {
      const { data: allVotes, error: allError } = await db
        .from('reading_bee_votes')
        .select('teacher_id,award_key,student_name');
      if (allError) return reply(event, 400, { success:false, error:allError.message });
      payload.total_voters = new Set((allVotes || []).map(v => v.teacher_id)).size;
      payload.results = tally(allVotes);
    }
    return reply(event, 200, payload);
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(event, 400, { success:false, error:'Invalid JSON' }); }

  const incoming = body && typeof body.votes === 'object' && body.votes ? body.votes : {};
  const now = new Date().toISOString();
  const upserts = [];
  const removals = [];

  for (const keyName of AWARDS) {
    if (!Object.prototype.hasOwnProperty.call(incoming, keyName)) continue;
    const studentName = cleanName(incoming[keyName]);
    if (studentName) {
      upserts.push({
        teacher_id: authData.user.id,
        award_key: keyName,
        student_name: studentName,
        updated_at: now
      });
    } else {
      removals.push(keyName);
    }
  }

  if (upserts.length) {
    const { error } = await db.from('reading_bee_votes')
      .upsert(upserts, { onConflict:'teacher_id,award_key' });
    if (error) return reply(event, 400, { success:false, error:error.message });
  }

  if (removals.length) {
    const { error } = await db.from('reading_bee_votes')
      .delete()
      .eq('teacher_id', authData.user.id)
      .in('award_key', removals);
    if (error) return reply(event, 400, { success:false, error:error.message });
  }

  return reply(event, 200, { success:true, saved:upserts.length, cleared:removals.length });
};
