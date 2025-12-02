// Teacher analytics for English Arcade: class leaderboards, timeframe filters, and per-student stats
// Secure: requires teacher/admin cookie session; verifies role from profiles

const redisCache = require('../../lib/redis_cache');

let createClientFn = null;

async function ensureCreateClient() {
  if (createClientFn) return createClientFn;
  try {
    const mod = await import('@supabase/supabase-js');
    createClientFn = mod.createClient;
  } catch (e) {
    try {
      const mod = require('@supabase/supabase-js');
      createClientFn = mod.createClient || (mod.default && mod.default.createClient);
    } catch (err) {
      console.error('[progress_teacher_summary] Failed to load supabase client', err);
      throw err;
    }
  }
  if (typeof createClientFn !== 'function') {
    throw new Error('createClient export missing from @supabase/supabase-js');
  }
  return createClientFn;
}

const baseHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function json(status, body) {
  return { statusCode: status, headers: baseHeaders, body: JSON.stringify(body) };
}

function parseCookies(header) {
  const out = {}; if (!header) return out;
  header.split(/;\s*/).forEach(kv => { const i = kv.indexOf('='); if (i > 0) out[kv.slice(0,i)] = decodeURIComponent(kv.slice(i+1)); });
  return out;
}

function monthStartISO(now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0,0,0));
  return d.toISOString();
}

async function getAuthedTeacher(event, admin, debug = {}) {
  try {
    const cookieHeader = (event.headers && (event.headers.Cookie || event.headers.cookie)) || '';
    const cookies = parseCookies(cookieHeader);
    const access = cookies['sb_access'] || cookies['sb-access'] || cookies['sb_access_token'] || cookies['sb-access-token'] || null;
    const cookieDebug = {
      keys: Object.keys(cookies),
      hasAccess: Boolean(access),
      hasRefresh: Boolean(cookies['sb_refresh'])
    };
    if (typeof debug === 'object' && debug !== null) debug.cookieDebug = cookieDebug;
    if (!access) {
      console.warn('[progress_teacher_summary] getAuthedTeacher missing access token', cookieDebug);
      return null;
    }
    const { data: udata, error: uerr } = await admin.auth.getUser(access);
    if (uerr || !udata || !udata.user) {
      console.warn('[progress_teacher_summary] auth.getUser failed', { error: uerr && uerr.message, cookieDebug });
      return null;
    }
    const uid = udata.user.id;
    const { data: prof, error: perr } = await admin
      .from('profiles')
      .select('id, role, approved, class, name, username')
      .eq('id', uid)
      .single();
    if (perr || !prof) {
      console.warn('[progress_teacher_summary] profile lookup failed', { error: perr && perr.message, cookieDebug });
      return null;
    }
    const role = String(prof.role || '').toLowerCase();
    if (!['teacher','admin'].includes(role)) {
      console.warn('[progress_teacher_summary] unauthorized role', { role, cookieDebug });
      return null;
    }
    if (prof.approved === false) {
      console.warn('[progress_teacher_summary] teacher not approved', { cookieDebug });
      return null;
    }
    if (typeof debug === 'object' && debug !== null) {
      debug.userId = uid;
      debug.userRole = role;
    }
    console.log('[progress_teacher_summary] authenticated teacher', { id: uid, role, cookieDebug });
    return { id: uid, role, name: prof.name || prof.username || 'Teacher', class: prof.class || null };
  } catch (err) {
    console.warn('[progress_teacher_summary] getAuthedTeacher exception', err && err.message ? err.message : err);
    return null;
  }
}

// Utility: timeframe where clause for created_at
function timeframeFilter(qb, timeframe, col = 'created_at') {
  if (timeframe === 'month') {
    const iso = monthStartISO();
    return qb.gte(col, iso);
  }
  return qb; // 'all' or default
}

function parseSummary(summary) {
  try {
    if (!summary) return null;
    if (typeof summary === 'string') return JSON.parse(summary);
    return summary;
  } catch {
    return null;
  }
}

function normalizeClassDisplay(name) {
  const raw = (name || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'ny') return 'New York';
  return raw;
}

function classKey(name) {
  return normalizeClassDisplay(name).toLowerCase();
}

const CACHE_PREFIX = 'teacher_summary';
const CLASSES_LIST_CACHE_KEY = `${CACHE_PREFIX}:classes_v1`;
const CLASSES_LIST_TTL_SECONDS = 5 * 60; // class dropdown rarely changes
const LEADERBOARD_TTL_SECONDS = 2 * 60; // per-class leaderboard caching
const STUDENT_DETAILS_TTL_SECONDS = 90; // student drilldowns change frequently

function leaderboardCacheKey(name, timeframe = 'all') {
  const tf = (timeframe || 'all').toLowerCase();
  return `${CACHE_PREFIX}:leaderboard:${classKey(name) || 'unknown'}:${tf}`;
}

function studentDetailsCacheKey(userId, timeframe = 'all') {
  const tf = (timeframe || 'all').toLowerCase();
  return `${CACHE_PREFIX}:student:${userId || 'unknown'}:${tf}`;
}

// Mirrors progress_summary star thresholds so teacher and student leaderboards agree.
function deriveStars(summary) {
  const s = summary || {};
  let acc = null;
  if (typeof s.accuracy === 'number') acc = s.accuracy;
  else if (typeof s.score === 'number' && typeof s.total === 'number' && s.total > 0) acc = s.score / s.total;
  else if (typeof s.score === 'number' && typeof s.max === 'number' && s.max > 0) acc = s.score / s.max;
  if (acc != null) {
    if (acc >= 1) return 5;
    if (acc >= 0.95) return 4;
    if (acc >= 0.90) return 3;
    if (acc >= 0.80) return 2;
    if (acc >= 0.60) return 1;
    return 0;
  }
  if (typeof s.stars === 'number') return s.stars;
  return 0;
}

async function fetchAllRows(createQuery, batchSize = 1000, maxBatches = 200) {
  const out = [];
  let truncated = false;
  let from = 0;
  for (let i = 0; i < maxBatches; i++) {
    const qb = createQuery();
    const { data, error } = await qb.range(from, from + batchSize - 1);
    if (error) return { error };
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
    if (i === maxBatches - 1 && data.length === batchSize) truncated = true;
  }
  return { data: out, truncated };
}

exports.handler = async (event) => {
  const method = event.httpMethod || 'GET';
  if (method === 'OPTIONS') return json(200, { ok: true });
  if (!['GET', 'POST'].includes(method)) return json(405, { error: 'Method Not Allowed' });

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.supabase_url;
  const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.supabase_service_role_key || process.env.SUPABASE_KEY;
  if (!SUPABASE_URL || !ADMIN_KEY) return json(500, { error: 'Missing Supabase env' });
  let createClient;
  try {
    createClient = await ensureCreateClient();
  } catch (e) {
    return json(500, { error: 'Failed to load database client', detail: e.message || String(e) });
  }
  const admin = createClient(SUPABASE_URL, ADMIN_KEY);

  const qs = event.queryStringParameters || {};
  const action = qs.action || 'help';

  const INTERNAL_WARM_KEY = process.env.INTERNAL_WARM_KEY || process.env.internal_warm_key || null;
  const isInternalWarmRequest = Boolean(INTERNAL_WARM_KEY && qs.internal_warm_key && qs.internal_warm_key === INTERNAL_WARM_KEY);
  const internalAllowedActions = new Set(['classes_list', 'leaderboard', 'student_details']);

  // Authz
  const authDebug = {};
  let teacher = null;
  if (isInternalWarmRequest && internalAllowedActions.has(action)) {
    teacher = { id: 'internal-warm', role: 'admin', name: 'Internal Warm', class: null };
    authDebug.internalWarm = true;
  } else {
    teacher = await getAuthedTeacher(event, admin, authDebug);
    if (!teacher) return json(401, { error: 'Unauthorized' });
  }

  console.log('[progress_teacher_summary] request', {
    action,
    method,
    teacher: teacher ? { id: teacher.id, role: teacher.role } : null,
    debug: authDebug
  });
  try {
    if (action === 'toggle_class_visibility') {
      if (method !== 'POST') return json(405, { success: false, error: 'Method Not Allowed' });
      if (teacher.role !== 'admin') return json(403, { success: false, error: 'Admins only' });

      let classParam = (qs.class || '').trim();
      let hiddenValue = qs.hidden;
      if ((!classParam || hiddenValue === undefined) && event.body) {
        try {
          const parsed = JSON.parse(event.body);
          if (parsed && typeof parsed === 'object') {
            if (!classParam && parsed.class) classParam = String(parsed.class).trim();
            if (hiddenValue === undefined && parsed.hidden !== undefined) hiddenValue = parsed.hidden;
          }
        } catch {}
      }

      if (!classParam) return json(400, { success: false, error: 'Missing class parameter' });
      const displayName = normalizeClassDisplay(classParam);
      if (!displayName) return json(400, { success: false, error: 'Invalid class parameter' });
      const key = classKey(displayName);
      const toggleTo = (() => {
        if (typeof hiddenValue === 'boolean') return hiddenValue;
        if (typeof hiddenValue === 'number') return hiddenValue !== 0;
        if (typeof hiddenValue === 'string') {
          const lower = hiddenValue.trim().toLowerCase();
          if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') return true;
          if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'off') return false;
        }
        return false;
      })();

      const payload = {
        class_key: key,
        class_name: displayName,
        hidden: toggleTo,
        updated_by: teacher.id,
        updated_at: new Date().toISOString()
      };
      const { error } = await admin.from('class_visibility').upsert(payload, { onConflict: 'class_key' });
      if (error) {
        if (error.code === '42P01') {
          return json(400, { success: false, error: 'class_visibility table missing. Run latest Supabase migration.' });
        }
        return json(400, { success: false, error: error.message });
      }
      await redisCache.del(CLASSES_LIST_CACHE_KEY);
      return json(200, { success: true, class: displayName, hidden: toggleTo });
    }

    // 1) List classes for dropdown (distinct class for students)
    if (action === 'classes_list') {
      const cached = await redisCache.getJson(CLASSES_LIST_CACHE_KEY);
      if (cached && Array.isArray(cached.classes)) {
        return json(200, { success: true, classes: cached.classes, cached_at: cached.cached_at || null });
      }
      const { data, error } = await admin
        .from('profiles')
        .select('class')
        .eq('role', 'student');
      if (error) return json(400, { success: false, error: error.message });
      const rawClasses = Array.from(new Set((data || []).map(r => (r && r.class) ? String(r.class).trim() : '').filter(Boolean)));
      
      // Normalize and sort: specified order first, then rest alphabetically
      const preferredOrder = ['Brown', 'Stanford', 'Manchester', 'Melbourne', 'New York', 'Hawaii', 'Boston', 'Sydney', 'Berkeley', 'Chicago', 'Cambridge', 'Yale', 'Washington', 'Oxford', 'MIT', 'Dublin', 'Harvard'];
      const normalized = [];
      const seen = new Set();
      rawClasses.forEach((c) => {
        const display = normalizeClassDisplay(c);
        if (!display) return;
        if (seen.has(display)) return;
        seen.add(display);
        normalized.push(display);
      });
      const inOrder = preferredOrder.filter(p => normalized.includes(p));
      const remaining = normalized.filter(c => !inOrder.includes(c)).sort();
      const { data: visRowsRaw, error: visErr } = await admin
        .from('class_visibility')
        .select('class_key, class_name, hidden');
      if (visErr && visErr.code !== '42P01') {
        console.warn('[progress_teacher_summary] class_visibility fetch error', visErr.message);
      }
      const visRows = Array.isArray(visRowsRaw) ? visRowsRaw : [];
      const visMap = new Map(visRows.map(r => [r.class_key, !!r.hidden]));
      const classes = [...inOrder, ...remaining].map(name => ({
        name,
        hidden: visMap.get(classKey(name)) || false
      }));
      const payload = { classes, cached_at: new Date().toISOString() };
      await redisCache.setJson(CLASSES_LIST_CACHE_KEY, payload, CLASSES_LIST_TTL_SECONDS);
      return json(200, { success: true, ...payload });
    }

    // 2) Class leaderboard (stars + points + accuracy) with timeframe
    if (action === 'leaderboard') {
      const className = (qs.class || '').trim();
      const timeframe = (qs.timeframe || 'all').toLowerCase();
      if (!className) return json(200, { success: true, leaderboard: [], class: null });
      const timingStart = Date.now();
      const cacheKey = leaderboardCacheKey(className, timeframe);
      const cached = await redisCache.getJson(cacheKey);
      if (cached && Array.isArray(cached.leaderboard)) {
        console.log('[progress_teacher_summary] leaderboard cache hit', {
          className,
          timeframe,
          rows: cached.leaderboard.length,
          totalMs: Date.now() - timingStart
        });
        return json(200, { success: true, ...cached });
      }

      // Get students in class
      const studentsStart = Date.now();
      const { data: students, error: sErr } = await admin
        .from('profiles')
        .select('id, name, username, class, korean_name')
        .eq('role', 'student')
        .eq('class', className);
      const studentsMs = Date.now() - studentsStart;
      if (sErr) return json(400, { success: false, error: sErr.message });
      const ids = (students || []).map(s => s.id);
      if (!ids.length) {
        console.log('[progress_teacher_summary] leaderboard empty class', {
          className,
          timeframe,
          studentsMs,
          totalMs: Date.now() - timingStart
        });
        return json(200, { success: true, class: className, leaderboard: [] });
      }

      // Aggregate attempts in timeframe for those users
      const attemptsQuery = () => timeframeFilter(
        admin
          .from('progress_attempts')
          .select('user_id, is_correct, points', { head: false })
          .in('user_id', ids)
          .order('created_at', { ascending: true }),
        timeframe,
        'created_at'
      );
    const attemptsStart = Date.now();
    const { data: attempts, error: aErr, truncated: attemptsTruncated } = await fetchAllRows(attemptsQuery, 1000, 400);
    const attemptsMs = Date.now() - attemptsStart;
    if (aErr) return json(400, { success: false, error: aErr.message });

      const attemptStats = new Map(); // user_id -> { points, total, correct }
      for (const a of (attempts || [])) {
        const u = a.user_id; if (!u) continue;
        let stats = attemptStats.get(u);
        if (!stats) {
          stats = { points: 0, total: 0, correct: 0 };
          attemptStats.set(u, stats);
        }
        stats.total += 1;
        if (a.is_correct) stats.correct += 1;
        const p = Number(a.points);
        if (Number.isFinite(p)) stats.points += p;
      }

      const sessionsQuery = () => timeframeFilter(
        admin
          .from('progress_sessions')
          .select('user_id, list_name, mode, summary, ended_at, started_at', { head: false })
          .in('user_id', ids)
          .not('ended_at', 'is', null)
          .order('ended_at', { ascending: true }),
        timeframe,
        'ended_at'
      );
    const sessionsStart = Date.now();
    const { data: sessions, error: sessErr, truncated: sessionsTruncated } = await fetchAllRows(sessionsQuery, 500, 400);
    const sessionsMs = Date.now() - sessionsStart;
    if (sessErr) return json(400, { success: false, error: sessErr.message });

      const starsByUser = new Map(); // user_id -> Map<list||mode, stars>
      for (const sess of (sessions || [])) {
        if (!sess || !sess.user_id) continue;
        const list = (sess.list_name || '').trim();
        const mode = (sess.mode || '').trim();
        if (!list || !mode) continue;
        const summary = parseSummary(sess.summary);
        if (summary && summary.completed === false) continue;
        const stars = deriveStars(summary);
        if (stars <= 0) continue;
        let userStars = starsByUser.get(sess.user_id);
        if (!userStars) {
          userStars = new Map();
          starsByUser.set(sess.user_id, userStars);
        }
        const key = `${list}||${mode}`;
        const prev = userStars.get(key) || 0;
        if (stars > prev) userStars.set(key, stars);
      }

      const rows = (students || []).map(student => {
        const stats = attemptStats.get(student.id) || { points: 0, total: 0, correct: 0 };
        const userStars = starsByUser.get(student.id) || new Map();
        let totalStars = 0;
        userStars.forEach(value => { totalStars += value; });
        const accuracy = stats.total ? Math.round((stats.correct / stats.total) * 100) : 0;
        return {
          user_id: student.id,
          name: student.name || student.username || 'Unknown',
          korean_name: student.korean_name || null,
          class: className,
          stars: totalStars,
          points: stats.points || 0,
          accuracy,
          attempts: stats.total || 0
        };
      });

      rows.sort((a,b)=> (b.stars - a.stars) || (b.points - a.points) || a.name.localeCompare(b.name));
      rows.forEach((r,i)=> r.rank = i+1);
      const truncated = Boolean(attemptsTruncated || sessionsTruncated);
      const payload = { class: className, timeframe, leaderboard: rows, truncated, cached_at: new Date().toISOString() };
      await redisCache.setJson(cacheKey, payload, LEADERBOARD_TTL_SECONDS);
      console.log('[progress_teacher_summary] leaderboard fresh', {
        className,
        timeframe,
        rows: rows.length,
        studentsMs,
        attemptsMs,
        sessionsMs,
        totalMs: Date.now() - timingStart,
        truncated
      });
      return json(200, { success: true, ...payload });
    }

    // 3) Per-student details with timeframe
    if (action === 'student_details') {
      const userId = qs.user_id || '';
      const timeframe = (qs.timeframe || 'all').toLowerCase();
      if (!userId) return json(400, { success: false, error: 'Missing user_id' });
      const timingStart = Date.now();
      const cacheKey = studentDetailsCacheKey(userId, timeframe);
      const cached = await redisCache.getJson(cacheKey);
      if (cached && cached.student && cached.totals) {
        console.log('[progress_teacher_summary] student_details cache hit', {
          userId,
          timeframe,
          totalMs: Date.now() - timingStart
        });
        return json(200, { success: true, ...cached });
      }

      // Profile basics
      const profileStart = Date.now();
      const { data: prof, error: pErr } = await admin
        .from('profiles')
        .select('id, name, username, class')
        .eq('id', userId)
        .single();
      const profileMs = Date.now() - profileStart;
      if (pErr || !prof) return json(404, { success: false, error: 'Student not found' });

      // Attempts aggregate
      const studentAttemptsQuery = () => timeframeFilter(
        admin
          .from('progress_attempts')
          .select('is_correct, points, mode', { head: false })
          .eq('user_id', userId)
          .order('created_at', { ascending: true }),
        timeframe,
        'created_at'
      );
    const attemptsStart = Date.now();
    const { data: attempts, error: aErr, truncated: studentAttemptsTruncated } = await fetchAllRows(studentAttemptsQuery, 1000, 400);
    const attemptsMs = Date.now() - attemptsStart;
    if (aErr) return json(400, { success: false, error: aErr.message });

      let total = 0, correct = 0, points = 0;
      const byMode = new Map(); // mode -> { total, correct }
      for (const a of (attempts || [])) {
        total += 1; if (a.is_correct) correct += 1;
        const p = Number(a.points); if (Number.isFinite(p)) points += p;
        const m = a.mode || 'unknown';
        let o = byMode.get(m); if (!o) { o = { total: 0, correct: 0 }; byMode.set(m, o); }
        o.total += 1; if (a.is_correct) o.correct += 1;
      }
      const accuracy = total ? Math.round((correct / total) * 100) : 0;
      const modeBreakdown = Array.from(byMode.entries()).map(([mode, v]) => ({ mode, total: v.total, correct: v.correct, accuracy: v.total ? Math.round((v.correct/v.total)*100) : 0 })).sort((a,b)=> b.total - a.total);

      // Sessions: lists played
      const sessionsQuery = () => timeframeFilter(
        admin
          .from('progress_sessions')
          .select('list_name, list_size, started_at, ended_at, mode, summary', { head: false })
          .eq('user_id', userId)
          .order('started_at', { ascending: true }),
        timeframe,
        'started_at'
      );
    const sessionsStart = Date.now();
    const { data: sessions, error: sErr, truncated: sessionsTruncated } = await fetchAllRows(sessionsQuery, 1000, 500);
    const sessionsMs = Date.now() - sessionsStart;
    if (sErr) return json(400, { success: false, error: sErr.message });
    console.log(`[student_details] Fetched ${sessions?.length || 0} sessions for user ${userId}, truncated: ${sessionsTruncated}`);

      const lists = new Map(); // key by list_name+mode to distinguish if needed
      let sessionsCount = 0;
      const bestStars = new Map();
      for (const s of (sessions || [])) {
        sessionsCount += 1;
        const lnRaw = s.list_name || '(Unknown List)';
        const ln = typeof lnRaw === 'string' ? lnRaw.trim() : lnRaw;
        const modeRaw = s.mode || 'unknown';
        const modeName = typeof modeRaw === 'string' ? modeRaw.trim() : modeRaw;
        const key = `${ln}\u0001${modeName}`;
        let o = lists.get(key);
        const ts = s.ended_at || s.started_at;
        if (!o) {
          o = { list_name: ln, mode: modeName || 'unknown', list_size: s.list_size || null, count: 0, last_played: ts, stars: 0 };
          lists.set(key, o);
        }
        o.count += 1;
        if (ts && (!o.last_played || ts > o.last_played)) o.last_played = ts;
        const summary = parseSummary(s.summary);
        const stars = deriveStars(summary);
        if (stars > 0) {
          o.stars = Math.max(o.stars || 0, stars);
          const prev = bestStars.get(key) || 0;
          if (stars > prev) bestStars.set(key, stars);
        }
      }
      console.log(`[student_details] Processed ${sessionsCount} sessions into ${lists.size} list-mode combinations`);
  const totalStars = Array.from(bestStars.values()).reduce((sum, val) => sum + val, 0);
  const listsPlayedAll = Array.from(lists.values()).sort((a,b)=> (b.count - a.count) || ((b.last_played||'').localeCompare(a.last_played||'')));
  const listsPlayed = listsPlayedAll;

      // Recent sessions
      const recentSessions = (sessions || [])
        .map(s => ({ mode: s.mode || 'unknown', list_name: s.list_name || null, started_at: s.started_at, ended_at: s.ended_at, list_size: s.list_size || null }))
        .sort((a,b)=> ((b.ended_at||b.started_at||'').localeCompare(a.ended_at||a.started_at||'')));

      const payload = {
        student: { id: prof.id, name: prof.name || prof.username, class: prof.class },
          timeframe,
          totals: { attempts: total, correct, accuracy, points, stars: totalStars },
        sessions: { count: sessionsCount, truncated: sessionsTruncated },
        modes: modeBreakdown,
        lists: listsPlayed,
        recent: recentSessions,
        truncated: studentAttemptsTruncated,
        cached_at: new Date().toISOString()
      };
      await redisCache.setJson(cacheKey, payload, STUDENT_DETAILS_TTL_SECONDS);
      console.log('[progress_teacher_summary] student_details fresh', {
        userId,
        timeframe,
        attemptsCount: attempts?.length || 0,
        sessionsCount,
        profileMs,
        attemptsMs,
        sessionsMs,
        totalMs: Date.now() - timingStart,
        truncated: Boolean(studentAttemptsTruncated || sessionsTruncated)
      });
      return json(200, { success: true, ...payload });
    }

    // Default help
    return json(200, { success: true, actions: ['classes_list', 'leaderboard?class=ClassA&timeframe=all|month', 'student_details?user_id=<uuid>&timeframe=all|month'] });
  } catch (e) {
    console.error('[progress_teacher_summary] error', e);
    return json(500, { success: false, error: e.message });
  }
};
