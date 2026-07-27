const { createClient } = require('@supabase/supabase-js');

const ALLOWED_ORIGINS = new Set([
  'https://teachers.willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'http://localhost:8888',
  'http://localhost:9000'
]);

function headers(event) {
  const h = event.headers || {};
  const origin = String(h.origin || h.Origin || '').trim();
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://teachers.willenaenglish.com',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
    'Cache-Control': 'private, no-store'
  };
}

function respond(event, statusCode, body) {
  return { statusCode, headers: headers(event), body: JSON.stringify(body) };
}

function getCookie(event, name) {
  const raw = (event.headers && (event.headers.cookie || event.headers.Cookie)) || '';
  const match = raw.match(new RegExp('(?:^|;\\s*)' + name.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

function safeText(value, max = 200) {
  return String(value || '').trim().slice(0, max);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: headers(event), body: '' };

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return respond(event, 500, { success: false, error: 'Server configuration missing' });

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const accessToken = getCookie(event, 'sb_access');
  if (!accessToken) return respond(event, 401, { success: false, error: 'Not signed in' });

  const { data: authData, error: authError } = await admin.auth.getUser(accessToken);
  const actor = authData && authData.user;
  if (authError || !actor) return respond(event, 401, { success: false, error: 'Not signed in' });

  const { data: actorProfile, error: actorProfileError } = await admin
    .from('profiles')
    .select('id, role, approved')
    .eq('id', actor.id)
    .single();

  if (actorProfileError || !actorProfile || String(actorProfile.role).toLowerCase() !== 'admin' || actorProfile.approved !== true) {
    return respond(event, 403, { success: false, error: 'Admin access required' });
  }

  const qs = event.queryStringParameters || {};
  const action = safeText(qs.action, 50);
  let body = {};
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}'); }
    catch { return respond(event, 400, { success: false, error: 'Invalid JSON body' }); }
  }

  try {
    if (action === 'list' && event.httpMethod === 'GET') {
      const { data, error } = await admin
        .from('profiles')
        .select('id, name, username, email, role, approved, created_at')
        .in('role', ['teacher', 'admin'])
        .order('name', { ascending: true });
      if (error) throw error;
      return respond(event, 200, { success: true, actor_id: actor.id, teachers: data || [] });
    }

    if (action === 'create' && event.httpMethod === 'POST') {
      const email = safeText(body.email, 320).toLowerCase();
      const password = String(body.password || '');
      const name = safeText(body.name, 120);
      const username = safeText(body.username, 80).toLowerCase();
      const role = String(body.role || 'teacher').toLowerCase();
      const approved = body.approved !== false;

      if (!email || !email.includes('@')) return respond(event, 400, { success: false, error: 'A valid email is required' });
      if (password.length < 8) return respond(event, 400, { success: false, error: 'Password must be at least 8 characters' });
      if (!name) return respond(event, 400, { success: false, error: 'Name is required' });
      if (!['teacher', 'admin'].includes(role)) return respond(event, 400, { success: false, error: 'Invalid role' });

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, username }
      });
      if (createError || !created.user) return respond(event, 400, { success: false, error: createError?.message || 'Could not create account' });

      const profile = {
        id: created.user.id,
        email,
        name,
        username: username || email.split('@')[0],
        role,
        approved
      };
      const { error: profileError } = await admin.from('profiles').upsert(profile, { onConflict: 'id' });
      if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
        return respond(event, 400, { success: false, error: profileError.message });
      }
      return respond(event, 200, { success: true, teacher: profile });
    }

    if (action === 'update' && event.httpMethod === 'POST') {
      const userId = safeText(body.user_id, 80);
      if (!userId) return respond(event, 400, { success: false, error: 'Missing user ID' });

      const { data: existing, error: existingError } = await admin
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .single();
      if (existingError || !existing || !['teacher', 'admin'].includes(String(existing.role).toLowerCase())) {
        return respond(event, 404, { success: false, error: 'Teacher account not found' });
      }

      const update = {};
      if (body.name !== undefined) update.name = safeText(body.name, 120);
      if (body.username !== undefined) update.username = safeText(body.username, 80).toLowerCase();
      if (body.approved !== undefined) update.approved = Boolean(body.approved);
      if (body.role !== undefined) {
        const role = String(body.role).toLowerCase();
        if (!['teacher', 'admin'].includes(role)) return respond(event, 400, { success: false, error: 'Invalid role' });
        if (userId === actor.id && role !== 'admin') return respond(event, 400, { success: false, error: 'You cannot remove your own admin role' });
        update.role = role;
      }
      if (userId === actor.id && update.approved === false) return respond(event, 400, { success: false, error: 'You cannot disable your own account' });
      if (!Object.keys(update).length) return respond(event, 400, { success: false, error: 'Nothing to update' });

      const { error } = await admin.from('profiles').update(update).eq('id', userId);
      if (error) throw error;
      return respond(event, 200, { success: true });
    }

    if (action === 'reset_password' && event.httpMethod === 'POST') {
      const userId = safeText(body.user_id, 80);
      const password = String(body.password || '');
      if (!userId) return respond(event, 400, { success: false, error: 'Missing user ID' });
      if (password.length < 8) return respond(event, 400, { success: false, error: 'Password must be at least 8 characters' });
      const { data: existing } = await admin.from('profiles').select('role').eq('id', userId).single();
      if (!existing || !['teacher', 'admin'].includes(String(existing.role).toLowerCase())) return respond(event, 404, { success: false, error: 'Teacher account not found' });
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return respond(event, 200, { success: true });
    }

    if (action === 'delete' && event.httpMethod === 'POST') {
      const userId = safeText(body.user_id, 80);
      if (!userId) return respond(event, 400, { success: false, error: 'Missing user ID' });
      if (userId === actor.id) return respond(event, 400, { success: false, error: 'You cannot delete your own account' });
      const { data: existing } = await admin.from('profiles').select('role').eq('id', userId).single();
      if (!existing || !['teacher', 'admin'].includes(String(existing.role).toLowerCase())) return respond(event, 404, { success: false, error: 'Teacher account not found' });
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
      if (authDeleteError) throw authDeleteError;
      await admin.from('profiles').delete().eq('id', userId);
      return respond(event, 200, { success: true });
    }

    return respond(event, 404, { success: false, error: 'Unknown action' });
  } catch (error) {
    console.error('[teacher_management]', action, error);
    return respond(event, 500, { success: false, error: error.message || 'Server error' });
  }
};
