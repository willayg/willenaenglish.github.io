const { createClient } = require('@supabase/supabase-js');

function headers(event) {
  const origin = String(event.headers?.origin || event.headers?.Origin || '').trim();
  const allowed = new Set([
    'https://teachers.willenaenglish.com',
    'https://students.willenaenglish.com',
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

function classKey(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: headers(event), body: '' };
  if (!['GET', 'POST'].includes(event.httpMethod)) return reply(event, 405, { success: false, error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return reply(event, 500, { success: false, error: 'Missing server configuration' });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = accessToken(event);
  if (!token) return reply(event, 401, { success: false, error: 'Not signed in' });

  const { data: authData, error: authError } = await db.auth.getUser(token);
  if (authError || !authData?.user) return reply(event, 401, { success: false, error: 'Not signed in' });

  const { data: actor, error: actorError } = await db
    .from('profiles')
    .select('role,approved')
    .eq('id', authData.user.id)
    .single();

  const role = String(actor?.role || '').toLowerCase();
  if (actorError || !actor || !['teacher', 'admin'].includes(role) || actor.approved === false) {
    return reply(event, 403, { success: false, error: 'Teacher access required' });
  }

  if (event.httpMethod === 'GET') {
    const { data, error } = await db
      .from('class_sort_order')
      .select('class_key,class_name,sort_order')
      .order('sort_order', { ascending: true })
      .order('class_name', { ascending: true });
    if (error) return reply(event, 400, { success: false, error: error.message });
    return reply(event, 200, {
      success: true,
      can_edit: role === 'admin',
      order: (data || []).map(row => row.class_name)
    });
  }

  if (role !== 'admin') return reply(event, 403, { success: false, error: 'Admins only' });

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return reply(event, 400, { success: false, error: 'Invalid JSON' });
  }

  const incoming = Array.isArray(body.order) ? body.order : [];
  const seen = new Set();
  const names = incoming
    .map(name => String(name || '').trim().replace(/\s+/g, ' '))
    .filter(name => {
      if (!name || name.length > 80) return false;
      const keyValue = classKey(name);
      if (!keyValue || seen.has(keyValue)) return false;
      seen.add(keyValue);
      return true;
    });

  if (!names.length) return reply(event, 400, { success: false, error: 'No classes supplied' });

  const now = new Date().toISOString();
  const rows = names.map((name, index) => ({
    class_key: classKey(name),
    class_name: name,
    sort_order: index,
    updated_by: authData.user.id,
    updated_at: now
  }));

  const { error } = await db.from('class_sort_order').upsert(rows, { onConflict: 'class_key' });
  if (error) return reply(event, 400, { success: false, error: error.message });

  return reply(event, 200, { success: true, order: names });
};
