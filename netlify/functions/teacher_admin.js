// Teacher Admin API - manage student accounts via Supabase Admin (service role)
// Actions:
// - list_students?search=&limit=&offset=
// - create_student { username, password, name, class, approved }
// - reset_password { user_id|username, new_password }
// - delete_student { user_id|username }
// - set_approved { user_id|username, approved }

const redisCache = require('../../lib/redis_cache');

const LIST_CACHE_VERSION_KEY = 'teacher_admin:list_students_version';
const LIST_CACHE_TTL_SECONDS = 60; // manage students table updates often but benefits from short cache

async function getListCacheVersion() {
  try {
    const raw = await redisCache.getJson(LIST_CACHE_VERSION_KEY);
    if (raw && typeof raw.version !== 'undefined') return String(raw.version);
  } catch {}
  return 'v0';
}

async function bumpListCacheVersion() {
  const payload = { version: Date.now().toString() };
  await redisCache.setJson(LIST_CACHE_VERSION_KEY, payload);
  return payload.version;
}

function buildListCacheKey(version, params) {
  const search = (params.search || '').toLowerCase();
  const classFilter = (params.classFilter || '').toLowerCase();
  const limit = Number(params.limit) || 0;
  const offset = Number(params.offset) || 0;
  return `teacher_admin:list_students:${version}:${classFilter}:${search}:${limit}:${offset}`;
}

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
  const INTERNAL_WARM_KEY = process.env.INTERNAL_WARM_KEY || process.env.internal_warm_key || null;
  const isInternalWarmRequest = Boolean(INTERNAL_WARM_KEY && qs.internal_warm_key && qs.internal_warm_key === INTERNAL_WARM_KEY);
  const internalAllowedActions = new Set(['list_students']);
  const skipAuth = isInternalWarmRequest && internalAllowedActions.has(action);

  // Lazy import supabase-js (CJS require fallback)
  let createClient;
  try { ({ createClient } = await import('@supabase/supabase-js')); }
  catch { ({ createClient } = require('@supabase/supabase-js')); }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return respond(event, 500, { success:false, error:'Missing env' });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const db = admin; // same client for db queries

  // Role flags available to all action branches
  let actorRole = null;
  let isAdmin = false;
  let isTeacher = false;

  // AuthZ: require teacher/admin role unless this is an internal warm ping limited to list_students
  if (!skipAuth) {
    const access = cookieToken(event);
    if (!access) return respond(event, 401, { success:false, error:'Not signed in' });
    try {
      const { data, error } = await admin.auth.getUser(access);
      if (error || !data?.user) return respond(event, 401, { success:false, error:'Not signed in' });
      const userId = data.user.id;
      const { data: prof, error: perr } = await db.from('profiles').select('role').eq('id', userId).single();
      if (perr || !prof) return respond(event, 403, { success:false, error:'Profile missing' });
      actorRole = String(prof.role || '').toLowerCase();
      isAdmin = actorRole === 'admin';
      isTeacher = actorRole === 'teacher';
      if (!isAdmin && !isTeacher) return respond(event, 403, { success:false, error:'Forbidden' });
    } catch {
      return respond(event, 401, { success:false, error:'Not signed in' });
    }
  } else {
    actorRole = 'admin';
    isAdmin = true;
    isTeacher = true;
  }
  if (!skipAuth) {
    // Admin-only: rename_class
    if (action === 'rename_class' && event.httpMethod === 'POST') {
      if (!isAdmin) return respond(event, 403, { success:false, error:'Admins only' });
      const body = JSON.parse(event.body || '{}');
      const { old_class, new_class } = body;
      if (!old_class || !new_class) return respond(event, 400, { success:false, error:'Both class names required' });
      const { error } = await db.from('profiles').update({ class: new_class }).eq('role', 'student').eq('class', old_class);
      if (error) return respond(event, 400, { success:false, error: error.message });
      await bumpListCacheVersion();
      return respond(event, 200, { success:true });
    }

    // Admin-only: update_student
    if (action === 'update_student' && event.httpMethod === 'POST') {
      if (!isAdmin) return respond(event, 403, { success:false, error:'Admins only' });
      const body = JSON.parse(event.body || '{}');
      const { user_id, name, username, korean_name, class: className, grade, school, phone } = body;
      if (!user_id) return respond(event, 400, { success:false, error:'Missing user_id' });
      const { data: tprof, error: perr2 } = await db.from('profiles').select('role').eq('id', user_id).single();
      if (perr2 || !tprof) return respond(event, 404, { success:false, error:'Profile not found' });
      if (String(tprof.role).toLowerCase() !== 'student') return respond(event, 403, { success:false, error:'Only students are manageable' });
      const updateFields = {};
      if (typeof name === 'string') updateFields.name = name;
      if (typeof username === 'string') updateFields.username = username;
      if (typeof korean_name === 'string') updateFields.korean_name = korean_name;
      if (typeof className === 'string') updateFields.class = className;
      if (grade !== undefined) {
        const g = typeof grade === 'string' ? grade.trim() : grade;
        updateFields.grade = g ? g : null;
      }
      if (school !== undefined) {
        const sch = typeof school === 'string' ? school.trim() : school;
        updateFields.school = sch ? sch : null;
      }
      if (phone !== undefined) {
        const ph = typeof phone === 'string' ? phone.trim() : phone;
        updateFields.phone = ph ? ph : null;
      }
      if (Object.keys(updateFields).length === 0) return respond(event, 400, { success:false, error:'No fields to update' });
      const { error } = await db.from('profiles').update(updateFields).eq('id', user_id);
      if (error) return respond(event, 400, { success:false, error: error.message });
      await bumpListCacheVersion();
      return respond(event, 200, { success:true });
    }
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
      const classFilter = (qs.class || '').trim();
      const limit = Math.min(parseInt(qs.limit || '1000', 10) || 1000, 1000);
      const offset = parseInt(qs.offset || '0', 10) || 0;
      const timingStart = Date.now();
      const version = await getListCacheVersion();
      const cacheKey = buildListCacheKey(version, { search, classFilter, limit, offset });
      const cached = await redisCache.getJson(cacheKey);
      if (cached && Array.isArray(cached.students)) {
        console.log('[teacher_admin] list_students cache hit', {
          search: search ? '[set]' : '',
          classFilter: classFilter || '',
          limit,
          offset,
          rows: cached.students.length,
          version,
          totalMs: Date.now() - timingStart
        });
        return respond(event, 200, { success:true, students: cached.students, limit: cached.limit, offset: cached.offset, cached_at: cached.cached_at || null });
      }
      let q = db
        .from('profiles')
        .select('id, name, username, email, avatar, approved, role, class, korean_name, grade, school, phone')
        .eq('role', 'student');
      if (classFilter) q = q.eq('class', classFilter);
      if (search) {
        // Prefer prefix search for index friendliness; fallback to contains if search is very short
        const s = search.replace(/[%_]/g, '').toLowerCase();
        const pat = s.length >= 2 ? `${s}%` : `%${s}%`;
        // Search username, name, korean_name
        q = q.or(`username.ilike.${pat},name.ilike.${pat},korean_name.ilike.${pat}`);
      }
      const queryStart = Date.now();
      const { data, error } = await q.order('username', { ascending: true }).range(offset, offset + limit - 1);
      const queryMs = Date.now() - queryStart;
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
        grade: d.grade || null,
        school: d.school || null,
        phone: d.phone || null,
      }));
      const payload = { students, limit, offset, cached_at: new Date().toISOString() };
      await redisCache.setJson(cacheKey, payload, LIST_CACHE_TTL_SECONDS);
      console.log('[teacher_admin] list_students fresh fetch', {
        search: search ? '[set]' : '',
        classFilter: classFilter || '',
        limit,
        offset,
        rows: students.length,
        version,
        queryMs,
        totalMs: Date.now() - timingStart
      });
      return respond(event, 200, { success:true, ...payload });
    }

    // Bulk upsert students
    if (action === 'bulk_upsert_students' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const students = Array.isArray(body.students) ? body.students : [];
      if (!students.length) return respond(event, 400, { success:false, error:'students array required' });

      // Normalize and validate inputs
      const norm = students.map(s => ({
        class: (s.class || '').toString().trim() || null,
        school: (s.school || '').toString().trim() || null,
        grade: (s.grade || '').toString().trim() || null,
        korean_name: (s.korean_name || s.koreanName || '').toString().trim(),
        name: (s.name || s.english_name || '').toString().trim(),
        phone: (s.phone || '').toString().trim() || null,
        username: (s.username || '').toString().trim().toLowerCase(),
        password: (s.password || '').toString()
      })).filter(s => s.class && s.korean_name && s.name && s.username && s.password);

      if (!norm.length) return respond(event, 400, { success:false, error:'no valid students' });

      let created = 0, updated = 0, skipped = 0;

      // Prefetch existing students by korean_name and class to minimize DB roundtrips
      const korSet = new Set(norm.map(s => (s.korean_name || '').toLowerCase()));
      const clsSet = new Set(norm.map(s => (s.class || '').toLowerCase()));
      let existingRows = [];
      if (korSet.size && clsSet.size) {
        const korArr = Array.from(korSet);
        const clsArr = Array.from(clsSet);
        const { data: exData } = await db
          .from('profiles')
          .select('id, username, email, name, korean_name, class')
          .eq('role', 'student')
          .in('korean_name', korArr)
          .in('class', clsArr);
        if (Array.isArray(exData)) existingRows = exData;
      }
      const byKorClass = new Map(); // key: `${kor}|${cls}`
      const byFull = new Map();     // key: `${eng}|${kor}|${cls}`
      for (const r of existingRows) {
        const kor = String(r.korean_name || '').toLowerCase();
        const cls = String(r.class || '').toLowerCase();
        const eng = String(r.name || '').toLowerCase();
        if (kor && cls) byKorClass.set(`${kor}|${cls}`, r);
        if (eng && kor && cls) byFull.set(`${eng}|${kor}|${cls}`, r);
      }

      for (const s of norm) {
        try {
          // Try lookup from maps first
          const keyFull = `${s.name.toLowerCase()}|${s.korean_name.toLowerCase()}|${(s.class||'').toLowerCase()}`;
          const keyKorCls = `${s.korean_name.toLowerCase()}|${(s.class||'').toLowerCase()}`;
          let existing = byFull.get(keyFull) || byKorClass.get(keyKorCls) || null;
          if (!existing) {
            // Fallback single query if not in prefetch
            const { data: maybe, error: selErr } = await db
              .from('profiles')
              .select('id, username, email, name, korean_name, class')
              .eq('role', 'student')
              .ilike('korean_name', s.korean_name)
              .ilike('class', s.class)
              .maybeSingle();
            if (!selErr && maybe) existing = maybe;
          }

          // synthesize email from username
          const email = `${s.username}@stu.willena`;

          if (!existing) {
            // Create new auth user + profile
            const { data: createdUser, error: cErr } = await admin.auth.admin.createUser({
              email,
              email_confirm: true,
              password: s.password,
              user_metadata: { role: 'student', username: s.username }
            });
            if (cErr || !createdUser?.user) throw new Error(cErr?.message || 'createUser failed');
            const uid = createdUser.user.id;
            const prof = {
              id: uid,
              email,
              username: s.username,
              name: s.name,
              korean_name: s.korean_name,
              role: 'student',
              approved: true,
              class: s.class,
              grade: s.grade || null,
              school: s.school || null,
              phone: s.phone || null
            };
            const { error: iErr } = await db.from('profiles').insert(prof);
            if (iErr) {
              // rollback auth user if profile insert fails
              try { await admin.auth.admin.deleteUser(uid); } catch {}
              throw iErr;
            }
            created++;
          } else {
            // Update existing profile fields; try to update username/email; reset password to new username
            const uid = existing.id;
            // First update profile with school/grade/phone/class/name/kor and username
            const updateFields = {
              username: s.username,
              name: s.name,
              korean_name: s.korean_name,
              class: s.class,
              grade: s.grade || null,
              school: s.school || null,
              phone: s.phone || null
            };
            const { error: uErr } = await db.from('profiles').update(updateFields).eq('id', uid);
            if (uErr) throw uErr;
            // Update auth: email + password
            const { error: updErr } = await admin.auth.admin.updateUserById(uid, { email, password: s.password });
            if (updErr) {
              // If email collision, attempt without email change
              if (String(updErr.message || '').toLowerCase().includes('unique')) {
                const { error: pwErr } = await admin.auth.admin.updateUserById(uid, { password: s.password });
                if (pwErr) throw pwErr;
                // Keep profile email unchanged on collision
              } else {
                throw updErr;
              }
            } else {
              // Auth email updated successfully -> sync profiles.email
              const { error: peErr } = await db.from('profiles').update({ email }).eq('id', uid);
              if (peErr) throw peErr;
            }
            updated++;
          }
        } catch (e) {
          // Skip on error but continue others
          skipped++;
        }
      }

      await bumpListCacheVersion();
      return respond(event, 200, { success:true, created, updated, skipped, total: norm.length });
    }

    if (action === 'create_student' && event.httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      let { username, password, name, class: className, approved, grade, school, phone } = body;
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
  const cleanGrade = typeof grade === 'string' && grade.trim() ? grade.trim() : null;
  const cleanSchool = typeof school === 'string' && school.trim() ? school.trim() : null;
  const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
  const { error: iErr } = await db.from('profiles').insert({ id: uid, email, username, name: name || username, korean_name: body.korean_name || null, role: 'student', approved: approved ?? true, class: className || null, grade: cleanGrade, school: cleanSchool, phone: cleanPhone });
      if (iErr) {
        // Cleanup auth user if profile insert fails
        try { await admin.auth.admin.deleteUser(uid); } catch {}
        return respond(event, 400, { success:false, error: iErr.message });
      }
      await bumpListCacheVersion();
      return respond(event, 200, { success:true, user_id: uid });
    }

    if (action === 'reset_password' && event.httpMethod === 'POST') {
      if (!isAdmin) return respond(event, 403, { success:false, error:'Admins only' });
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
      if (!isAdmin) return respond(event, 403, { success:false, error:'Admins only' });
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
      await bumpListCacheVersion();
      return respond(event, 200, { success:true });
    }

    if (action === 'set_approved' && event.httpMethod === 'POST') {
      if (!isAdmin) return respond(event, 403, { success:false, error:'Admins only' });
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
      await bumpListCacheVersion();
      return respond(event, 200, { success:true });
    }

    return respond(event, 404, { success:false, error:'Action not found' });
  } catch (e) {
    return respond(event, 500, { success:false, error: e?.message || 'Internal error' });
  }
};
