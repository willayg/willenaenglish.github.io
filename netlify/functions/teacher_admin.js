// Teacher Admin API - manage student accounts via Supabase Admin (service role)
// Actions:
// - list_students?search=&limit=&offset=
// - create_student { username, password, name, class, approved }
// - reset_password { user_id|username, new_password }
// - delete_student { user_id|username }
// - set_approved { user_id|username, approved }

function makeCorsHeaders(event, extra = {}) {
  const ALLOWLIST = new Set([
    'https://www.willenaenglish.com',
    'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'http://localhost:9000',
    'http://localhost:8888',
  ]);
  const hdrs = event.headers || {};
  const origin = (hdrs.origin || hdrs.Origin || '').trim();
  const allow = ALLOWLIST.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    ...extra,
  };
}

function respond(event, statusCode, bodyObj, extraHeaders = {}) {
  return { statusCode, headers: { ...makeCorsHeaders(event), 'Content-Type': 'application/json', ...extraHeaders }, body: JSON.stringify(bodyObj) };
}

function cookieToken(event) {
  const hdrs = event.headers || {};
  const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
  const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
  return m ? decodeURIComponent(m[1]) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
  }

  // Parse query params early so `action` is available everywhere
  const qs = event.queryStringParameters || {};
  const action = qs.action;

  // Lazy import supabase-js (CJS require fallback)
  let createClient;
  try { ({ createClient } = await import('@supabase/supabase-js')); }
  catch { ({ createClient } = require('@supabase/supabase-js')); }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return respond(event, 500, { success:false, error:'Missing env' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const db = admin; // same client for db queries

  // AuthZ: require teacher/admin role
  const access = cookieToken(event);
  if (!access) return respond(event, 401, { success:false, error:'Not signed in' });
  try {
      if (action === 'rename_class' && event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { old_class, new_class } = body;
        if (!old_class || !new_class) return respond(event, 400, { success:false, error:'Both class names required' });
        // Only update students
        const { error } = await db.from('profiles').update({ class: new_class }).eq('role', 'student').eq('class', old_class);
        if (error) return respond(event, 400, { success:false, error: error.message });
        return respond(event, 200, { success:true });
      }
    if (action === 'update_student' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const { user_id, name, username, korean_name, class: className } = body;
      if (!user_id) return respond(event, 400, { success:false, error:'Missing user_id' });
      // Only allow update for students
      const { data: prof, error: perr } = await db.from('profiles').select('role').eq('id', user_id).single();
      if (perr || !prof) return respond(event, 404, { success:false, error:'Profile not found' });
      if (String(prof.role).toLowerCase() !== 'student') return respond(event, 403, { success:false, error:'Only students are manageable' });
      const updateFields = {};
      if (typeof name === 'string') updateFields.name = name;
      if (typeof username === 'string') updateFields.username = username;
      if (typeof korean_name === 'string') updateFields.korean_name = korean_name;
      if (typeof className === 'string') updateFields.class = className;
      if (Object.keys(updateFields).length === 0) return respond(event, 400, { success:false, error:'No fields to update' });
      const { error } = await db.from('profiles').update(updateFields).eq('id', user_id);
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true });
    }
    const { data, error } = await admin.auth.getUser(access);
    if (error || !data?.user) return respond(event, 401, { success:false, error:'Not signed in' });
    const userId = data.user.id;
    const { data: prof, error: perr } = await db.from('profiles').select('role').eq('id', userId).single();
    if (perr || !prof) return respond(event, 403, { success:false, error:'Profile missing' });
    if (!['teacher','admin'].includes((prof.role || '').toLowerCase())) return respond(event, 403, { success:false, error:'Forbidden' });
  } catch {
    return respond(event, 401, { success:false, error:'Not signed in' });
  }


  // Helper: lookup user by username
  async function getUserIdByUsername(username) {
  const { data, error } = await db.from('profiles').select('id').eq('username', username).single();
    if (error || !data) return null;
    return data.id;
  }

  // Helper: synthesize email for student accounts (shorter)
  function synthEmail(username) { return `${username}@stu.willena`; }

  try {
    if (action === 'list_students') {
      const search = (qs.search || '').trim();
      const limit = Math.min(parseInt(qs.limit || '100', 10) || 100, 500);
      const offset = parseInt(qs.offset || '0', 10) || 0;
  let q = db.from('profiles').select('id, name, username, email, avatar, approved, role, class, korean_name').eq('role', 'student');
      if (search) {
        // ILIKE not available in supabase-js builder; use filters
        q = q.or(`username.ilike.%${search}%,name.ilike.%${search}%`);
      }
      const { data, error } = await q.order('username', { ascending: true }).range(offset, offset + limit - 1);
      if (error) return respond(event, 400, { success:false, error: error.message });
      const students = (data || []).map(d => ({
        id: d.id,
        name: d.name,
        username: d.username,
        email: d.email,
        avatar: d.avatar,
        approved: d.approved,
        role: d.role,
        class: d.class || null,
        korean_name: d.korean_name || '',
      }));
      return respond(event, 200, { success:true, students, limit, offset });
    }

    if (action === 'create_student' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      let { username, password, name, class: className, approved } = body;
      username = (username || '').trim();
      if (!username || !password) return respond(event, 400, { success:false, error:'username and password required' });
      // Check existing username
      const { data: exists } = await db.from('profiles').select('id').eq('username', username).maybeSingle();
      if (exists?.id) return respond(event, 409, { success:false, error:'Username already exists' });

      const email = synthEmail(username);
      // Create auth user
      const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, email_confirm: true, password, user_metadata: { role: 'student', username } });
      if (cErr || !created?.user) return respond(event, 400, { success:false, error: cErr?.message || 'Failed to create auth user' });
      const uid = created.user.id;
  // Insert profile
  const { error: iErr } = await db.from('profiles').insert({ id: uid, email, username, name: name || username, korean_name: body.korean_name || null, role: 'student', approved: approved ?? true, class: className || null });
      if (iErr) {
        // Cleanup auth user if profile insert fails
        try { await admin.auth.admin.deleteUser(uid); } catch {}
        return respond(event, 400, { success:false, error: iErr.message });
      }
      return respond(event, 200, { success:true, user_id: uid });
    }

    if (action === 'reset_password' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const idOrUsername = (body.user_id || body.username || '').trim();
      const newPass = body.new_password;
      if (!idOrUsername || !newPass) return respond(event, 400, { success:false, error:'user_id/username and new_password required' });
      let uid = body.user_id || null;
      if (!uid) uid = await getUserIdByUsername(idOrUsername);
      if (!uid) return respond(event, 404, { success:false, error:'User not found' });
      // Ensure target is a student
      const { data: prof, error: perr } = await db.from('profiles').select('role').eq('id', uid).single();
      if (perr || !prof) return respond(event, 404, { success:false, error:'Profile not found' });
      if (String(prof.role).toLowerCase() !== 'student') return respond(event, 403, { success:false, error:'Only students are manageable' });
      const { error } = await admin.auth.admin.updateUserById(uid, { password: newPass });
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true });
    }

    if (action === 'delete_student' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const idOrUsername = (body.user_id || body.username || '').trim();
      if (!idOrUsername) return respond(event, 400, { success:false, error:'user_id or username required' });
      let uid = body.user_id || null;
      if (!uid) uid = await getUserIdByUsername(idOrUsername);
      if (!uid) return respond(event, 404, { success:false, error:'User not found' });
      // Ensure target is a student
      const { data: prof, error: perr } = await db.from('profiles').select('role').eq('id', uid).single();
      if (perr || !prof) return respond(event, 404, { success:false, error:'Profile not found' });
      if (String(prof.role).toLowerCase() !== 'student') return respond(event, 403, { success:false, error:'Only students are manageable' });
      // Delete profile first (to satisfy FKs if any), then auth user
      await db.from('profiles').delete().eq('id', uid);
      const { error } = await admin.auth.admin.deleteUser(uid);
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true });
    }

    if (action === 'set_approved' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const idOrUsername = (body.user_id || body.username || '').trim();
      const approved = !!body.approved;
      if (!idOrUsername) return respond(event, 400, { success:false, error:'user_id or username required' });
      let uid = body.user_id || null;
      if (!uid) uid = await getUserIdByUsername(idOrUsername);
      if (!uid) return respond(event, 404, { success:false, error:'User not found' });
      // Ensure target is a student
      const { data: prof, error: perr } = await db.from('profiles').select('role').eq('id', uid).single();
      if (perr || !prof) return respond(event, 404, { success:false, error:'Profile not found' });
      if (String(prof.role).toLowerCase() !== 'student') return respond(event, 403, { success:false, error:'Only students are manageable' });
      const { error } = await db.from('profiles').update({ approved }).eq('id', uid);
      if (error) return respond(event, 400, { success:false, error: error.message });
      return respond(event, 200, { success:true });
    }

    return respond(event, 404, { success:false, error:'Action not found' });
  } catch (e) {
    return respond(event, 500, { success:false, error: e?.message || 'Internal error' });
  }
};
