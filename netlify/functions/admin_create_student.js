// Dedicated admin-only student creation endpoint.
// Creates the Supabase Auth user and profiles row as one controlled operation.

function cors(event) {
  const allowed = new Set([
    'https://www.willenaenglish.com',
    'https://willenaenglish.com',
    'https://teachers.willenaenglish.com',
    'https://students.willenaenglish.com',
    'https://staging.willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:9000',
    'http://localhost:8888',
  ]);
  const origin = String(event.headers?.origin || event.headers?.Origin || '').trim();
  return {
    'Access-Control-Allow-Origin': allowed.has(origin) ? origin : 'https://willenaenglish.netlify.app',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
}

function response(event, statusCode, body) {
  return { statusCode, headers: cors(event), body: JSON.stringify(body) };
}

function accessToken(event) {
  const raw = event.headers?.cookie || event.headers?.Cookie || '';
  const match = /(?:^|;\s*)sb_access=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : null;
}

function clean(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors(event), body: '' };
  if (event.httpMethod !== 'POST') return response(event, 405, { success: false, error: 'Method not allowed' });

  let createClient;
  try { ({ createClient } = await import('@supabase/supabase-js')); }
  catch { ({ createClient } = require('@supabase/supabase-js')); }

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return response(event, 500, { success: false, error: 'Missing server configuration' });

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = accessToken(event);
  if (!token) return response(event, 401, { success: false, error: 'Not signed in' });

  const { data: actorData, error: actorError } = await supabase.auth.getUser(token);
  if (actorError || !actorData?.user) return response(event, 401, { success: false, error: 'Not signed in' });

  const { data: actorProfile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', actorData.user.id)
    .single();
  if (profileError || String(actorProfile?.role || '').toLowerCase() !== 'admin') {
    return response(event, 403, { success: false, error: 'Admins only' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return response(event, 400, { success: false, error: 'Invalid request body' }); }

  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.name || '').trim();
  const koreanName = String(body.korean_name || '').trim();

  if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
    return response(event, 400, { success: false, error: 'Username must be 3–40 characters using letters, numbers, dot, dash or underscore' });
  }
  if (password.length < 6) return response(event, 400, { success: false, error: 'Password must be at least 6 characters' });
  if (!name && !koreanName) return response(event, 400, { success: false, error: 'A student name is required' });

  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (existingError) return response(event, 400, { success: false, error: existingError.message });
  if (existing?.id) return response(event, 409, { success: false, error: 'Username already exists' });

  const email = `${username}@stu.willena`;
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'student', username },
  });
  if (createError || !created?.user) {
    const message = String(createError?.message || 'Could not create account');
    const duplicate = /already|registered|exists|unique/i.test(message);
    return response(event, duplicate ? 409 : 400, { success: false, error: duplicate ? 'Username already exists' : message });
  }

  const student = {
    id: created.user.id,
    email,
    username,
    name: name || username,
    korean_name: koreanName || null,
    role: 'student',
    approved: body.approved !== false,
    class: clean(body.class),
    grade: clean(body.grade),
    school: clean(body.school),
    phone: clean(body.phone),
  };

  const { error: insertError } = await supabase.from('profiles').insert(student);
  if (insertError) {
    try { await supabase.auth.admin.deleteUser(created.user.id); } catch {}
    return response(event, 400, { success: false, error: insertError.message });
  }

  return response(event, 200, { success: true, student });
};
