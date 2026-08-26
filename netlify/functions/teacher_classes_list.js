const { createClient } = require('@supabase/supabase-js');

const headers = {
  'content-type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'cache-control': 'private, max-age=0, s-maxage=0, no-store'
};

const json = (statusCode, body) => ({ statusCode, headers, body: JSON.stringify(body) });

function parseCookies(header) {
  const out = {};
  String(header || '').split(/;\s*/).forEach(kv => {
    const i = kv.indexOf('=');
    if (i > 0) out[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1));
  });
  return out;
}

function getToken(event) {
  const h = event.headers || {};
  const cookies = parseCookies(h.cookie || h.Cookie || '');
  const fromCookie = cookies.sb_access || cookies['sb-access'] || cookies.sb_access_token || cookies['sb-access-token'];
  if (fromCookie) return fromCookie;
  const auth = h.authorization || h.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

exports.handler = async (event) => {
  if ((event.httpMethod || 'GET') === 'OPTIONS') return json(200, { success: true });
  if ((event.httpMethod || 'GET') !== 'GET') return json(405, { success: false, error: 'Method Not Allowed' });

  try {
    const url = process.env.SUPABASE_URL || process.env.supabase_url;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key || process.env.SUPABASE_KEY;
    if (!url || !service) return json(500, { success: false, error: 'Missing Supabase env' });

    const admin = createClient(url, service, { auth: { persistSession: false } });
    const token = getToken(event);
    if (!token) return json(401, { success: false, error: 'Unauthorized' });

    const { data: authData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !authData?.user) return json(401, { success: false, error: 'Unauthorized' });
    const uid = authData.user.id;

    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, role, approved')
      .eq('id', uid)
      .maybeSingle();
    if (profileErr) throw profileErr;
    const role = String(profile?.role || '').toLowerCase();
    if (!profile?.approved || !['teacher', 'admin'].includes(role)) return json(403, { success: false, error: 'Teacher access required' });

    let classQuery = admin
      .from('classes')
      .select('id,name,display_name,legacy_class_name,status')
      .eq('status', 'active')
      .order('display_name', { ascending: true, nullsFirst: false });

    let allowedIds = null;
    if (role !== 'admin') {
      const { data: assignments, error: assignErr } = await admin
        .from('class_teacher_assignments')
        .select('class_id,started_at,ended_at')
        .eq('teacher_id', uid);
      if (assignErr) throw assignErr;
      const today = new Date().toISOString().slice(0, 10);
      const activeIds = (assignments || [])
        .filter(a => (!a.started_at || a.started_at <= today) && (!a.ended_at || a.ended_at >= today))
        .map(a => a.class_id)
        .filter(Boolean);
      if (activeIds.length) allowedIds = activeIds;
    }
    if (allowedIds) classQuery = classQuery.in('id', allowedIds);

    const { data: classesRaw, error: classesErr } = await classQuery;
    if (classesErr) throw classesErr;
    const classRows = classesRaw || [];
    const ids = classRows.map(c => c.id);

    let enrollments = [];
    if (ids.length) {
      const { data, error } = await admin
        .from('class_enrollments')
        .select('class_id,student_id,status')
        .in('class_id', ids)
        .eq('status', 'active');
      if (error) throw error;
      enrollments = data || [];
    }

    const counts = new Map();
    for (const e of enrollments) {
      if (!e.class_id || !e.student_id) continue;
      if (!counts.has(e.class_id)) counts.set(e.class_id, new Set());
      counts.get(e.class_id).add(e.student_id);
    }

    const classes = classRows.map(c => ({
      id: c.id,
      name: c.display_name || c.name || c.legacy_class_name,
      student_count: counts.get(c.id)?.size || 0
    })).filter(c => c.name);

    return json(200, { success: true, classes, source: 'canonical_classes' });
  } catch (e) {
    console.error('[teacher_classes_list]', e);
    return json(500, { success: false, error: e?.message || 'Server error' });
  }
};
