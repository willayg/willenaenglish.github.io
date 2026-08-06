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

function reply(event, statusCode, body) {
  return { statusCode, headers: headers(event), body: JSON.stringify(body) };
}

function accessToken(event) {
  const cookie = event.headers?.cookie || event.headers?.Cookie || '';
  const match = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]) : null;
}

exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: headers(event), body: '' };
  if (!['GET', 'POST'].includes(event.httpMethod)) return reply(event, 405, { success: false, error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return reply(event, 500, { success: false, error: 'Missing server configuration' });

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const token = accessToken(event);
  if (!token) return reply(event, 401, { success: false, error: 'Not signed in' });

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) return reply(event, 401, { success: false, error: 'Not signed in' });

  const { data: actor, error: actorError } = await supabase.from('profiles').select('role, approved').eq('id', authData.user.id).single();
  if (actorError || !actor || String(actor.role).toLowerCase() !== 'admin' || actor.approved === false) {
    return reply(event, 403, { success: false, error: 'Admins only' });
  }

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('classes')
      .select('id,name,display_name,legacy_class_name,status,level,room,capacity,notes,created_at,updated_at')
      .eq('status', 'active')
      .order('name', { ascending: true });
    if (error) return reply(event, 400, { success: false, error: error.message });
    return reply(event, 200, { success: true, classes: data || [] });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(event, 400, { success: false, error: 'Invalid JSON' }); }

  const name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const level = String(body.level || '').trim() || null;
  const room = String(body.room || '').trim() || null;
  const notes = String(body.notes || '').trim() || null;
  const capacity = body.capacity === '' || body.capacity == null ? null : Number(body.capacity);

  if (name.length < 2 || name.length > 80) return reply(event, 400, { success: false, error: 'Class name must be 2–80 characters' });
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 100)) {
    return reply(event, 400, { success: false, error: 'Capacity must be a whole number from 1 to 100' });
  }

  const { data: existing, error: existingError } = await supabase
    .from('classes')
    .select('id,name,status')
    .ilike('name', name)
    .maybeSingle();
  if (existingError) return reply(event, 400, { success: false, error: existingError.message });
  if (existing) return reply(event, 409, { success: false, error: 'Class name already exists' });

  const payload = {
    name,
    display_name: name,
    legacy_class_name: name,
    status: 'active',
    level,
    room,
    capacity,
    notes
  };
  const { data: created, error } = await supabase.from('classes').insert(payload).select('*').single();
  if (error) return reply(event, 400, { success: false, error: error.message });
  return reply(event, 201, { success: true, class: created });
};
