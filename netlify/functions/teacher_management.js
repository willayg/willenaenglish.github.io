const { createClient } = require('@supabase/supabase-js');
// Explicit manager allowlist: Will, 김윤정, 김현정. An admin role alone is not sufficient.
const MANAGERS = new Set(['abdf7489-55ff-4acd-9a15-1919076064ba','3a84b9ed-fdf2-4f40-b7e9-d37665023792','0811e4bc-232e-42b9-99c8-68d36a3f2ed7']);

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
  const origin = String((event.headers || {}).origin || (event.headers || {}).Origin || '');
  if (event.httpMethod === 'POST' && !ALLOWED_ORIGINS.has(origin)) return respond(event, 403, {success:false,error:'Origin not allowed'});

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

  if (actorProfileError || !actorProfile || String(actorProfile.role).toLowerCase() !== 'admin' || actorProfile.approved !== true || !MANAGERS.has(actor.id)) {
    return respond(event, 403, { success: false, error: 'Teacher management is restricted to designated administrators' });
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
      const role = 'teacher';
      const approved = true;

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
      if (!userId || MANAGERS.has(userId)) return respond(event, 403, { success: false, error: 'Protected administrator account' });
      const { data: existing, error: existingError } = await admin.from('profiles')
        .select('id, role, approved').eq('id', userId).single();
      if (existingError || !existing || String(existing.role).toLowerCase() !== 'teacher')
        return respond(event, 404, { success: false, error: 'Teacher account not found' });
      // Retire/reactivate teachers without deleting their profile, history or auth identity.
      // Role changes and elevation are deliberately not available from this manager.
      if (typeof body.approved !== 'boolean') return respond(event, 400, { success: false, error: 'Specify active or retired status' });
      const { error } = await admin.from('profiles').update({approved:body.approved}).eq('id',userId).eq('role','teacher');
      if (error) throw error;
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {ban_duration: body.approved ? 'none' : '876000h'});
      if (authUpdateError) {
        await admin.from('profiles').update({approved:existing.approved}).eq('id',userId).eq('role','teacher');
        throw authUpdateError;
      }
      return respond(event, 200, { success:true });
    }

    return respond(event, 404, { success: false, error: 'Unknown action' });
  } catch (error) {
    console.error('[teacher_management]', action, error);
    return respond(event, 500, { success: false, error: error.message || 'Server error' });
  }
};
