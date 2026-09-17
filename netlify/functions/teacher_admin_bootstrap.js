const { createClient } = require('@supabase/supabase-js');
const redisCache = require('../../lib/redis_cache');

const LIST_CACHE_VERSION_KEY = 'teacher_admin:list_students_version';
const LIST_CACHE_TTL_SECONDS = 60;

function makeCorsHeaders(event) {
  const ALLOWLIST = new Set([
    'https://www.willenaenglish.com',
    'https://willenaenglish.com',
    'https://willenaenglish.github.io',
    'https://willenaenglish.netlify.app',
    'https://teachers.willenaenglish.com',
    'https://students.willenaenglish.com',
    'https://staging.willenaenglish.com',
    'http://localhost:9000',
    'http://localhost:8888'
  ]);
  const hdrs = event.headers || {};
  const origin = (hdrs.origin || hdrs.Origin || '').trim();
  const allow = ALLOWLIST.has(origin) ? origin : 'https://willenaenglish.netlify.app';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store'
  };
}

function respond(event, statusCode, body) {
  return {
    statusCode,
    headers: { ...makeCorsHeaders(event), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function cookieToken(event) {
  const hdrs = event.headers || {};
  const cookieHeader = hdrs.cookie || hdrs.Cookie || '';
  const m = /(?:^|;\s*)sb_access=([^;]+)/.exec(cookieHeader);
  return m ? decodeURIComponent(m[1]) : null;
}

async function getListCacheVersion() {
  try {
    const raw = await redisCache.getJson(LIST_CACHE_VERSION_KEY);
    if (raw && typeof raw.version !== 'undefined') return String(raw.version);
  } catch {}
  return 'v0';
}

function listCacheKey(version) {
  return `teacher_admin:list_students:${version}::${''}:1000:0`;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: makeCorsHeaders(event), body: '' };
  }
  if (event.httpMethod !== 'GET') return respond(event, 405, { success:false, error:'Method not allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) return respond(event, 500, { success:false, error:'Missing env' });

  const access = cookieToken(event);
  if (!access) return respond(event, 401, { success:false, error:'Not signed in' });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: authData, error: authError } = await admin.auth.getUser(access);
    const user = authData?.user;
    if (authError || !user) return respond(event, 401, { success:false, error:'Not signed in' });

    const version = await getListCacheVersion();
    const cacheKey = listCacheKey(version);
    const [profileResult, cachedRoster] = await Promise.all([
      admin.from('profiles').select('id,name,username,role,approved').eq('id', user.id).single(),
      redisCache.getJson(cacheKey).catch(() => null)
    ]);

    const profile = profileResult.data;
    if (profileResult.error || !profile) return respond(event, 403, { success:false, error:'Profile missing' });
    if (String(profile.role || '').toLowerCase() !== 'admin' || profile.approved === false) {
      return respond(event, 403, { success:false, error:'Admins only' });
    }

    let students = Array.isArray(cachedRoster?.students) ? cachedRoster.students : null;
    let cachedAt = cachedRoster?.cached_at || null;

    if (!students) {
      const { data, error } = await admin
        .from('profiles')
        .select('id, name, username, email, avatar, approved, role, class, korean_name, grade, school, phone')
        .eq('role', 'student')
        .order('username', { ascending: true })
        .range(0, 999);
      if (error) return respond(event, 400, { success:false, error:error.message });
      students = (data || []).map(d => ({
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
        phone: d.phone || null
      }));
      cachedAt = new Date().toISOString();
      await redisCache.setJson(cacheKey, { students, limit:1000, offset:0, cached_at:cachedAt }, LIST_CACHE_TTL_SECONDS).catch(() => {});
    }

    return respond(event, 200, {
      success: true,
      user: {
        user_id: user.id,
        id: profile.id,
        name: profile.name || '',
        username: profile.username || '',
        role: profile.role,
        approved: profile.approved !== false
      },
      students,
      cached_at: cachedAt,
      roster_version: version
    });
  } catch (error) {
    console.error('[teacher_admin_bootstrap] error', error);
    return respond(event, 500, { success:false, error:error?.message || 'Internal error' });
  }
};
