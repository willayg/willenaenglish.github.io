/**
 * Cloudflare Worker: progress-summary
 * 
 * Full replacement for Netlify function progress_summary.js
 * Uses Supabase REST API directly (no SDK required)
 * 
 * API Sections:
 *   - kpi: Basic KPIs (attempts, accuracy, streak)
 *   - modes: Per-mode stats
 *   - sessions: Session history
 *   - attempts: Recent attempts
 *   - badges: Achievement badges
 *   - overview: Complete overview stats
 *   - leaderboard_class: Class leaderboard
 *   - leaderboard_global: Global leaderboard
 *   - leaderboard_stars_class: Stars-based class leaderboard
 *   - leaderboard_stars_global: Stars-based global leaderboard
 *   - challenging: Challenging words
 *   - challenging_v2: V2 challenging words via SQL
 *   - clear_cache: Admin cache clear
 */

const ALLOWED_ORIGINS = [
  'https://willenaenglish.com',
  'https://www.willenaenglish.com',
  'https://staging.willenaenglish.com',
  'https://students.willenaenglish.com',
  'https://teachers.willenaenglish.com',
  'https://willenaenglish.netlify.app',
  'https://willenaenglish.github.io',
  'https://willenaenglish-github-io.pages.dev',
  'https://staging.willenaenglish-github-io.pages.dev',
  'https://cf.willenaenglish.com',
  'https://api.willenaenglish.com',
  'https://api-cf.willenaenglish.com',
  'http://localhost:8888',
  'http://localhost:9000',
  'http://127.0.0.1:8888',
  'http://127.0.0.1:9000',
];

const CACHE_CONTROL_MAX_AGE = 120; // 2 minutes

function getCorsHeaders(origin) {
  // Allow any *.pages.dev or *.willenaenglish.com
  let allowed = ALLOWED_ORIGINS[0];
  if (ALLOWED_ORIGINS.includes(origin)) {
    allowed = origin;
  } else if (origin) {
    try {
      const u = new URL(origin);
      if (u.hostname.endsWith('.pages.dev') || 
          u.hostname.endsWith('.willenaenglish.com') ||
          u.hostname === 'willenaenglish.com') {
        allowed = origin;
      }
    } catch {}
  }
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
  };
}

function jsonResponse(data, status = 200, origin = '', cacheSeconds = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...getCorsHeaders(origin),
  };
  if (cacheSeconds && status >= 200 && status < 300) {
    headers['Cache-Control'] = `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`;
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function timedJsonResponse(data, status, origin, startMs, cache = true) {
  const duration_ms = Date.now() - startMs;
  const headers = {
    'Content-Type': 'application/json',
    'X-Timing-Ms': String(duration_ms),
    ...getCorsHeaders(origin),
  };
  if (cache) {
    headers['Cache-Control'] = `public, max-age=${CACHE_CONTROL_MAX_AGE}`;
  } else {
    headers['Cache-Control'] = 'private, max-age=0, no-store';
  }
  return new Response(JSON.stringify({ ...data, _timing_ms: duration_ms }), { status, headers });
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(/;\s*/).forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const key = pair.slice(0, idx).trim();
      const val = pair.slice(idx + 1).trim();
      cookies[key] = decodeURIComponent(val);
    }
  });
  return cookies;
}

function getAccessToken(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = parseCookies(cookieHeader);
  if (cookies['sb_access']) return cookies['sb_access'];
  
  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  
  return null;
}

function monthStartISO(now = new Date()) {
  const d = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  return d.toISOString();
}

function classKey(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_\-]/g, '');
}

function timeframeStartIso(timeframe) {
  return timeframe === 'month' ? monthStartISO() : null;
}

function normalizeClassDisplay(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  // Keep common formatting consistent
  return lower
    .split(/\s+/)
    .map(s => s ? (s[0].toUpperCase() + s.slice(1)) : s)
    .join(' ')
    .replace(/\bMit\b/g, 'MIT');
}

async function safeJson(resp) {
  try { return await resp.json(); } catch { return null; }
}

async function teacherAuth(client, request) {
  const accessToken = getAccessToken(request);
  if (!accessToken) return { ok: false, status: 401, error: 'Not signed in (cookie missing or invalid)' };
  const userData = await client.verifyToken(accessToken);
  if (!userData || !userData.id) return { ok: false, status: 401, error: 'Invalid or expired session' };
  const userId = userData.id;

  const prof = await client.query('profiles', {
    select: 'id, role, approved, class, name, username',
    filters: [{ column: 'id', op: 'eq', value: userId }],
    single: true,
  });
  const role = String(prof?.role || '').toLowerCase();
  if (!['teacher', 'admin'].includes(role)) return { ok: false, status: 403, error: 'Unauthorized' };
  if (prof?.approved === false) return { ok: false, status: 403, error: 'Not approved' };

  return { ok: true, userId, role, profile: prof };
}

async function teacherLoadDailyAgg(client, userIds, className, timeframe) {
  const filters = [
    { column: 'user_id', op: 'in', value: userIds },
  ];
  if (className) filters.push({ column: 'class', op: 'eq', value: className });
  if (timeframe === 'month') filters.push({ column: 'date', op: 'gte', value: monthStartISO().slice(0, 10) });
  const rows = await client.query('progress_daily_stats', {
    select: 'user_id, stars_earned, points_earned, attempts, correct, sessions',
    filters,
    limit: 5000,
  });
  const byUser = new Map();
  (rows || []).forEach(r => {
    if (!r?.user_id) return;
    let agg = byUser.get(r.user_id);
    if (!agg) {
      agg = { stars: 0, points: 0, attempts: 0, correct: 0, sessions: 0 };
      byUser.set(r.user_id, agg);
    }
    agg.stars += Number(r.stars_earned) || 0;
    agg.points += Number(r.points_earned) || 0;
    agg.attempts += Number(r.attempts) || 0;
    agg.correct += Number(r.correct) || 0;
    agg.sessions += Number(r.sessions) || 0;
  });
  return byUser;
}

async function teacherLoadAttemptsAgg(client, userIds, timeframe) {
  const filters = [{ column: 'user_id', op: 'in', value: userIds }];
  const startIso = timeframeStartIso(timeframe);
  if (startIso) filters.push({ column: 'created_at', op: 'gte', value: startIso });

  const rows = await client.query('progress_attempts', {
    select: 'user_id, is_correct, points',
    filters,
    limit: 50000,
  });

  const byUser = new Map();
  (rows || []).forEach(r => {
    const uid = r?.user_id;
    if (!uid) return;
    let agg = byUser.get(uid);
    if (!agg) {
      agg = { points: 0, attempts: 0, correct: 0 };
      byUser.set(uid, agg);
    }
    agg.attempts += 1;
    if (r?.is_correct) agg.correct += 1;
    const p = Number(r?.points);
    if (Number.isFinite(p)) agg.points += p;
  });
  return byUser;
}

async function teacherLoadSessionStarsAgg(client, userIds, timeframe) {
  const filters = [
    { column: 'user_id', op: 'in', value: userIds },
    { column: 'ended_at', op: 'not.is', value: 'null' },
  ];
  const startIso = timeframeStartIso(timeframe);
  if (startIso) filters.push({ column: 'ended_at', op: 'gte', value: startIso });

  const rows = await client.query('progress_sessions', {
    select: 'user_id, list_name, mode, summary, ended_at',
    filters,
    order: { column: 'ended_at', ascending: true },
    limit: 50000,
  });

  const bestByUser = new Map(); // uid -> Map<list||mode, bestStars>
  const sessionsCountByUser = new Map();
  (rows || []).forEach(sess => {
    const uid = sess?.user_id;
    if (!uid) return;
    sessionsCountByUser.set(uid, (sessionsCountByUser.get(uid) || 0) + 1);

    const list = String(sess?.list_name || '').trim();
    const mode = String(sess?.mode || '').trim();
    if (!list || !mode) return;

    const summary = safeParseSummary(sess?.summary);
    if (summary && summary.completed === false) return;
    const stars = deriveStars(summary);
    if (stars <= 0) return;

    let userBest = bestByUser.get(uid);
    if (!userBest) {
      userBest = new Map();
      bestByUser.set(uid, userBest);
    }
    const key = `${list}||${mode}`;
    const prev = userBest.get(key) || 0;
    if (stars > prev) userBest.set(key, stars);
  });

  const starsByUser = new Map();
  for (const [uid, map] of bestByUser.entries()) {
    let total = 0;
    for (const v of map.values()) total += Number(v) || 0;
    starsByUser.set(uid, total);
  }
  return { starsByUser, sessionsCountByUser };
}

async function teacherHandle(request, env, origin) {
  const url = new URL(request.url);
  const action = (url.searchParams.get('action') || '').toLowerCase();
  const timeframe = (url.searchParams.get('timeframe') || 'all').toLowerCase();

  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return jsonResponse({ success: false, error: 'Server misconfigured' }, 500, origin);
  }
  const client = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const auth = await teacherAuth(client, request);
  if (!auth.ok) return jsonResponse({ success: false, error: auth.error }, auth.status, origin);

  // --- classes_list ---
  if (action === 'classes_list') {
    const data = await client.query('profiles', {
      select: 'class',
      filters: [{ column: 'role', op: 'eq', value: 'student' }],
      limit: 5000,
    });
    const rawClasses = Array.from(new Set((data || [])
      .map(r => r?.class ? String(r.class).trim() : '')
      .filter(Boolean)));

    const preferredOrder = ['Brown', 'Stanford', 'Manchester', 'Melbourne', 'New York', 'Hawaii', 'Boston', 'Sydney', 'Berkeley', 'Chicago', 'Cambridge', 'Yale', 'Washington', 'Oxford', 'MIT', 'Dublin', 'Harvard'];

    const normalized = [];
    const seen = new Set();
    rawClasses.forEach(c => {
      const display = normalizeClassDisplay(c);
      if (!display || seen.has(display)) return;
      seen.add(display);
      normalized.push(display);
    });

    const inOrder = preferredOrder.filter(p => normalized.includes(p));
    const remaining = normalized.filter(c => !inOrder.includes(c)).sort((a, b) => a.localeCompare(b));

    // class_visibility is optional; default hidden=false if missing
    let visMap = new Map();
    try {
      const visRows = await client.query('class_visibility', {
        select: 'class_key, hidden',
        filters: [],
        limit: 5000,
      });
      visMap = new Map((visRows || []).map(r => [r?.class_key, !!r?.hidden]));
    } catch (_) {}

    const classes = [...inOrder, ...remaining].map(name => ({
      name,
      hidden: visMap.get(classKey(name)) || false,
    }));

    return jsonResponse({ success: true, classes, cached_at: null }, 200, origin);
  }

  // --- toggle_class_visibility (POST) ---
  if (action === 'toggle_class_visibility') {
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405, origin);
    }
    const className = String(url.searchParams.get('class') || '').trim();
    const hidden = String(url.searchParams.get('hidden') || '').toLowerCase();
    const toggleTo = hidden === '1' || hidden === 'true';
    if (!className) return jsonResponse({ success: false, error: 'Missing class' }, 400, origin);

    const payload = {
      class_key: classKey(className),
      class_name: className,
      hidden: toggleTo,
      updated_by: auth.userId,
      updated_at: new Date().toISOString(),
    };

    // Upsert with conflict on class_key
    const upsertOk = await client.upsert('class_visibility', payload, 'class_key');
    if (!upsertOk) {
      return jsonResponse({ success: false, error: 'Failed to update class visibility' }, 400, origin);
    }
    return jsonResponse({ success: true, class: className, hidden: toggleTo }, 200, origin);
  }

  // --- leaderboard ---
  if (action === 'leaderboard') {
    const className = String(url.searchParams.get('class') || '').trim();
    if (!className) return jsonResponse({ success: true, class: null, timeframe, leaderboard: [] }, 200, origin);

    const students = await client.query('profiles', {
      select: 'id, name, username, class, korean_name',
      filters: [
        { column: 'role', op: 'eq', value: 'student' },
        { column: 'class', op: 'eq', value: className },
      ],
      limit: 2000,
    });
    const ids = (students || []).map(s => s?.id).filter(Boolean);
    if (!ids.length) return jsonResponse({ success: true, class: className, timeframe, leaderboard: [] }, 200, origin);

    // Prefer daily snapshot table if available; otherwise fall back to raw aggregation.
    let dailyByUser = new Map();
    let dailyUsable = false;
    try {
      dailyByUser = await teacherLoadDailyAgg(client, ids, className, timeframe);
      for (const stats of dailyByUser.values()) {
        if ((stats?.stars || 0) > 0 || (stats?.points || 0) > 0 || (stats?.attempts || 0) > 0) {
          dailyUsable = true;
          break;
        }
      }
    } catch (_) {
      dailyByUser = new Map();
      dailyUsable = false;
    }

    let source = 'daily';
    let attemptsByUser = new Map();
    let starsByUser = new Map();
    let sessionsCountByUser = new Map();

    if (!dailyUsable) {
      source = 'raw';
      try {
        attemptsByUser = await teacherLoadAttemptsAgg(client, ids, timeframe);
      } catch (_) {
        attemptsByUser = new Map();
      }
      try {
        const sessAgg = await teacherLoadSessionStarsAgg(client, ids, timeframe);
        starsByUser = sessAgg.starsByUser || new Map();
        sessionsCountByUser = sessAgg.sessionsCountByUser || new Map();
      } catch (_) {
        starsByUser = new Map();
        sessionsCountByUser = new Map();
      }
    }

    const rows = (students || []).map(student => {
      const base = { stars: 0, points: 0, attempts: 0, correct: 0, sessions: 0 };
      let stats = base;

      if (dailyUsable) {
        stats = dailyByUser.get(student.id) || base;
      } else {
        const a = attemptsByUser.get(student.id) || { points: 0, attempts: 0, correct: 0 };
        stats = {
          stars: starsByUser.get(student.id) || 0,
          points: a.points || 0,
          attempts: a.attempts || 0,
          correct: a.correct || 0,
          sessions: sessionsCountByUser.get(student.id) || 0,
        };
      }

      const accuracy = stats.attempts ? Math.round((stats.correct / stats.attempts) * 100) : 0;
      return {
        user_id: student.id,
        name: student.name || student.username || 'Unknown',
        korean_name: student.korean_name || null,
        class: className,
        stars: stats.stars || 0,
        points: stats.points || 0,
        accuracy,
        attempts: stats.attempts || 0,
        sessions: stats.sessions || 0,
      };
    });

    rows.sort((a, b) => (b.stars - a.stars) || (b.points - a.points) || String(a.name).localeCompare(String(b.name)));
    rows.forEach((r, i) => { r.rank = i + 1; });

    return jsonResponse({ success: true, class: className, timeframe, leaderboard: rows, cached_at: null, source }, 200, origin);
  }

  // --- student_details ---
  if (action === 'student_details') {
    const targetId = String(url.searchParams.get('user_id') || '').trim();
    if (!targetId) return jsonResponse({ success: false, error: 'Missing user_id' }, 400, origin);

    const student = await client.query('profiles', {
      select: 'id, name, username, class, korean_name',
      filters: [{ column: 'id', op: 'eq', value: targetId }],
      single: true,
    });

    // Totals from daily stats (fast)
    let totals = { attempts: 0, correct: 0, accuracy: 0, points: 0, stars: 0 };
    let sessionsCount = 0;
    try {
      const filters = [{ column: 'user_id', op: 'eq', value: targetId }];
      if (timeframe === 'month') filters.push({ column: 'date', op: 'gte', value: monthStartISO().slice(0, 10) });
      const dailyRows = await client.query('progress_daily_stats', {
        select: 'attempts, correct, points_earned, stars_earned, sessions',
        filters,
        limit: 5000,
      });
      (dailyRows || []).forEach(r => {
        totals.attempts += Number(r?.attempts) || 0;
        totals.correct += Number(r?.correct) || 0;
        totals.points += Number(r?.points_earned) || 0;
        totals.stars += Number(r?.stars_earned) || 0;
        sessionsCount += Number(r?.sessions) || 0;
      });
      totals.accuracy = totals.attempts ? Math.round((totals.correct / totals.attempts) * 100) : 0;
    } catch (_) {}

    // Recent sessions for activity + list aggregation
    const sessFilters = [
      { column: 'user_id', op: 'eq', value: targetId },
      { column: 'ended_at', op: 'not.is', value: 'null' },
    ];
    if (timeframe === 'month') sessFilters.push({ column: 'ended_at', op: 'gte', value: monthStartISO() });
    let sessions = [];
    try {
      sessions = await client.query('progress_sessions', {
        select: 'list_name, mode, summary, ended_at, started_at',
        filters: sessFilters,
        order: { column: 'ended_at', ascending: false },
        limit: 500,
      });
    } catch (_) {
      sessions = [];
    }

    const recent = (sessions || []).map(s => ({
      list_name: s?.list_name || null,
      mode: s?.mode || null,
      summary: s?.summary || null,
      ended_at: s?.ended_at || null,
      started_at: s?.started_at || null,
    }));

    // Build list-mode aggregates similar to Netlify function (enough for UI)
    const listModeMap = new Map();
    const modeAgg = new Map();
    recent.forEach(sess => {
      const list = String(sess.list_name || '').trim();
      const mode = String(sess.mode || '').trim();
      if (!list || !mode) return;
      const summary = safeParseSummary(sess.summary);
      const stars = deriveStars(summary);
      const key = `${list}||${mode}`;
      const prev = listModeMap.get(key) || { list_name: list, mode, count: 0, stars: 0, last_played: null };
      prev.count += 1;
      prev.stars = Math.max(prev.stars, stars);
      const ended = sess.ended_at || null;
      if (ended && (!prev.last_played || ended > prev.last_played)) prev.last_played = ended;
      listModeMap.set(key, prev);

      const m = modeAgg.get(mode) || { mode, _accSum: 0, _accN: 0 };
      if (typeof summary?.accuracy === 'number') { m._accSum += summary.accuracy; m._accN += 1; }
      modeAgg.set(mode, m);
    });

    const lists = Array.from(listModeMap.values());
    const modes = Array.from(modeAgg.values()).map(m => ({
      mode: m.mode,
      accuracy: m._accN ? Math.round((m._accSum / m._accN) * 100) : null,
    }));

    return jsonResponse({
      success: true,
      student,
      timeframe,
      totals,
      sessions: { count: sessionsCount },
      lists,
      modes,
      recent,
    }, 200, origin);
  }

  return jsonResponse({ success: false, error: 'Unknown action', action }, 400, origin);
}

// Supabase REST client
class SupabaseClient {
  constructor(url, serviceKey) {
    this.url = url;
    this.serviceKey = serviceKey;
  }

  async verifyToken(token) {
    if (!token) return null;
    try {
      const resp = await fetch(`${this.url}/auth/v1/user`, {
        headers: {
          'apikey': this.serviceKey,
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!resp.ok) return null;
      return await resp.json();
    } catch {
      return null;
    }
  }

  async query(table, options = {}) {
    const { select = '*', filters = [], order, limit, range, single = false } = options;
    let url = `${this.url}/rest/v1/${table}?select=${encodeURIComponent(select)}`;
    
    filters.forEach(f => {
      if (f.op === 'in') {
        url += `&${f.column}=in.(${f.value.map(v => encodeURIComponent(v)).join(',')})`;
      } else if (f.op === 'not.is') {
        url += `&${f.column}=not.is.${f.value}`;
      } else {
        url += `&${f.column}=${f.op}.${encodeURIComponent(f.value)}`;
      }
    });
    
    if (order) {
      url += `&order=${order.column}.${order.ascending ? 'asc' : 'desc'}`;
    }
    if (limit) {
      url += `&limit=${limit}`;
    }
    if (range) {
      url += `&offset=${range.from}&limit=${range.to - range.from + 1}`;
    }

    const headers = {
      'apikey': this.serviceKey,
      'Authorization': `Bearer ${this.serviceKey}`,
    };
    if (single) {
      headers['Accept'] = 'application/vnd.pgrst.object+json';
    }

    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Supabase error ${resp.status}: ${text}`);
    }
    return resp.json();
  }

  async count(table, filters = []) {
    let url = `${this.url}/rest/v1/${table}?select=*`;
    filters.forEach(f => {
      if (f.op === 'in') {
        url += `&${f.column}=in.(${f.value.map(v => encodeURIComponent(v)).join(',')})`;
      } else if (f.op === 'not.is') {
        url += `&${f.column}=not.is.${f.value}`;
      } else {
        url += `&${f.column}=${f.op}.${encodeURIComponent(f.value)}`;
      }
    });
    
    const resp = await fetch(url, {
      method: 'HEAD',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Prefer': 'count=exact',
      },
    });
    const countHeader = resp.headers.get('content-range');
    if (countHeader) {
      const match = countHeader.match(/\/(\d+)$/);
      if (match) return parseInt(match[1], 10);
    }
    return 0;
  }

  async rpc(fnName, params = {}) {
    const resp = await fetch(`${this.url}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`RPC error ${resp.status}: ${text}`);
    }
    return resp.json();
  }

  async upsert(table, data, onConflict) {
    let url = `${this.url}/rest/v1/${table}`;
    if (onConflict) {
      url += `?on_conflict=${onConflict}`;
    }
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(Array.isArray(data) ? data : [data]),
    });
    return resp.ok;
  }

  async delete(table, filters = []) {
    let url = `${this.url}/rest/v1/${table}?`;
    filters.forEach((f, i) => {
      if (i > 0) url += '&';
      url += `${f.column}=${f.op}.${encodeURIComponent(f.value)}`;
    });
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: {
        'apikey': this.serviceKey,
        'Authorization': `Bearer ${this.serviceKey}`,
      },
    });
    return resp.ok;
  }
}

// Helper functions
function getMonthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString();
}

function safeParseSummary(input) {
  try {
    if (!input) return null;
    if (typeof input === 'string') return JSON.parse(input);
    return input;
  } catch {
    return null;
  }
}

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

function finalizeLeaderboard(entries) {
  entries.sort((a, b) => (b.points || 0) - (a.points || 0) || (a.name || '').localeCompare(b.name || ''));
  entries.forEach((entry, idx) => {
    const stars = Number(entry.stars) || 0;
    const points = Number(entry.points) || 0;
    entry.stars = stars;
    entry.points = points;
    entry.superScore = Math.round((stars * points) / 1000);
    entry.rank = idx + 1;
  });
  return entries;
}

function coerceNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeLeaderboardRow(row, userId) {
  const user_id = row?.user_id ?? row?.userId ?? row?.id ?? null;
  const name = row?.name ?? row?.username ?? 'Student';
  const avatar = row?.avatar ?? null;
  const className = row?.class ?? row?.class_name ?? row?.className ?? row?.class_name_text ?? null;
  const stars = coerceNumber(row?.total_stars ?? row?.totalStars ?? row?.stars, 0);
  const points = coerceNumber(row?.total_points ?? row?.totalPoints ?? row?.points, 0);
  const self = Boolean(row?.is_self ?? row?.self) || (user_id && userId && String(user_id) === String(userId));
  const rank = row?.rank != null ? coerceNumber(row.rank, null) : null;
  return {
    user_id,
    name,
    avatar,
    class: className,
    stars,
    points,
    ...(rank != null ? { rank } : {}),
    self,
  };
}

function buildStarsByUserMap(sessions) {
  const bestKey = new Map();
  (sessions || []).forEach(sess => {
    if (!sess || !sess.user_id) return;
    const list = (sess.list_name || '').trim();
    const mode = (sess.mode || '').trim();
    if (!list || !mode) return;
    const parsed = safeParseSummary(sess.summary);
    if (parsed && parsed.completed === false) return;
    const stars = deriveStars(parsed);
    if (stars <= 0) return;
    const composite = `${sess.user_id}||${list}||${mode}`;
    const prev = bestKey.get(composite) || 0;
    if (stars > prev) bestKey.set(composite, stars);
  });

  const totals = new Map();
  bestKey.forEach((value, composite) => {
    const [uid] = composite.split('||');
    totals.set(uid, (totals.get(uid) || 0) + value);
  });
  return totals;
}

async function aggregatePointsForIds(client, ids, firstOfMonthIso) {
  if (!ids || !ids.length) return [];
  const chunkSize = 200;
  const pageSize = 1000;
  const totals = new Map();
  
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    let offset = 0;
    
    while (true) {
      const filters = [
        { column: 'user_id', op: 'in', value: chunk },
        { column: 'points', op: 'not.is', value: 'null' },
      ];
      if (firstOfMonthIso) {
        filters.push({ column: 'created_at', op: 'gte', value: firstOfMonthIso });
      }
      
      const data = await client.query('progress_attempts', {
        select: 'user_id,points',
        filters,
        order: { column: 'id', ascending: true },
        range: { from: offset, to: offset + pageSize - 1 },
      });
      
      if (!data || !data.length) break;
      data.forEach(row => {
        if (!row || !row.user_id) return;
        const value = Number(row.points) || 0;
        totals.set(row.user_id, (totals.get(row.user_id) || 0) + value);
      });
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  
  return Array.from(totals.entries())
    .map(([user_id, points]) => ({ user_id, points }))
    .sort((a, b) => b.points - a.points);
}

async function fetchSessionsForUsers(client, userIds, firstOfMonthIso) {
  if (!userIds || !userIds.length) return [];
  const chunkSize = 150;
  const pageSize = 1000;
  const sessions = [];
  
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    let offset = 0;
    
    while (true) {
      const filters = [
        { column: 'user_id', op: 'in', value: chunk },
        { column: 'ended_at', op: 'not.is', value: 'null' },
      ];
      if (firstOfMonthIso) {
        filters.push({ column: 'ended_at', op: 'gte', value: firstOfMonthIso });
      }
      
      const data = await client.query('progress_sessions', {
        select: 'user_id,list_name,mode,summary,ended_at',
        filters,
        order: { column: 'id', ascending: true },
        range: { from: offset, to: offset + pageSize - 1 },
      });
      
      if (!data || !data.length) break;
      sessions.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  return sessions;
}

async function fetchAllApprovedStudents(client) {
  const batchSize = 500;
  const students = [];
  let offset = 0;

  while (true) {
    const batch = await client.query('profiles', {
      select: 'id,name,username,avatar,class',
      filters: [
        { column: 'role', op: 'eq', value: 'student' },
        { column: 'approved', op: 'eq', value: 'true' },
      ],
      order: { column: 'id', ascending: true },
      range: { from: offset, to: offset + batchSize - 1 },
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    students.push(...batch);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  return students;
}

async function computeGlobalLeaderboardPayload(client, timeframe) {
  const firstOfMonthIso = timeframe === 'month' ? getMonthStartIso() : null;
  const students = await fetchAllApprovedStudents(client);
  const filtered = (students || []).filter(p => !p.username || p.username.length > 1);
  if (!filtered.length) {
    return {
      timeframe: timeframe || 'all',
      cached_at: new Date().toISOString(),
      topEntries: [],
      userPoints: {},
    };
  }

  const ids = filtered.map(p => p.id).filter(Boolean);
  const pointTotals = await aggregatePointsForIds(client, ids, firstOfMonthIso);
  const pointsMap = new Map(pointTotals.map(row => [row.user_id, row.points]));
  const sessions = await fetchSessionsForUsers(client, ids, firstOfMonthIso);
  const starsByUser = buildStarsByUserMap(sessions);

  const entries = filtered.map(profile => ({
    user_id: profile.id,
    name: profile.name || profile.username || 'Student',
    avatar: profile.avatar || null,
    class: profile.class || null,
    points: Math.round(pointsMap.get(profile.id) || 0),
    stars: starsByUser.get(profile.id) || 0,
  }));

  entries.sort((a, b) => (b.points || 0) - (a.points || 0) || (a.name || '').localeCompare(b.name || ''));
  const finalized = finalizeLeaderboard(entries.map(entry => ({ ...entry })));
  const topEntries = finalized.slice(0, 15);

  const userPoints = {};
  finalized.forEach((entry, idx) => {
    if (!entry || !entry.user_id) return;
    userPoints[entry.user_id] = {
      name: entry.name,
      class: entry.class,
      avatar: entry.avatar,
      points: entry.points,
      stars: entry.stars,
      rank: idx + 1,
    };
  });

  return {
    timeframe: timeframe || 'all',
    cached_at: new Date().toISOString(),
    topEntries,
    userPoints,
  };
}

// Section handlers
async function handleKpi(client, userId, origin) {
  const attempts = await client.query('progress_attempts', {
    select: 'is_correct,created_at',
    filters: [{ column: 'user_id', op: 'eq', value: userId }],
    order: { column: 'created_at', ascending: true },
  });

  const attemptsCount = attempts?.length || 0;
  const correct = attempts?.filter(a => a.is_correct)?.length || 0;

  let best = 0, cur = 0;
  (attempts || []).forEach(a => {
    cur = a.is_correct ? cur + 1 : 0;
    best = Math.max(best, cur);
  });

  return jsonResponse({
    attempts: attemptsCount,
    accuracy: attemptsCount ? correct / attemptsCount : null,
    best_streak: best,
  }, 200, origin);
}

async function handleModes(client, userId, origin) {
  const data = await client.query('progress_attempts', {
    select: 'mode,is_correct',
    filters: [{ column: 'user_id', op: 'eq', value: userId }],
  });

  const byMode = {};
  (data || []).forEach(r => {
    const m = r.mode || 'unknown';
    byMode[m] = byMode[m] || { mode: m, correct: 0, total: 0 };
    byMode[m].total += 1;
    if (r.is_correct) byMode[m].correct += 1;
  });
  
  return jsonResponse(Object.values(byMode), 200, origin);
}

async function handleSessions(client, userId, listName, origin) {
  const filters = [
    { column: 'user_id', op: 'eq', value: userId },
    { column: 'ended_at', op: 'not.is', value: 'null' },
  ];
  if (listName) {
    filters.push({ column: 'list_name', op: 'eq', value: listName });
  }

  const sessions = await client.query('progress_sessions', {
    select: 'session_id,mode,list_name,started_at,ended_at,summary',
    filters,
    order: { column: 'ended_at', ascending: false },
    limit: 500,
  });

  return jsonResponse(sessions || [], 200, origin);
}

async function handleAttempts(client, userId, origin) {
  const data = await client.query('progress_attempts', {
    select: 'created_at,mode,word,is_correct,points',
    filters: [{ column: 'user_id', op: 'eq', value: userId }],
    order: { column: 'created_at', ascending: false },
    limit: 50,
  });

  return jsonResponse(data || [], 200, origin);
}

async function handleBadges(client, userId, origin) {
  const [attempts, sessions] = await Promise.all([
    client.query('progress_attempts', {
      select: 'is_correct,created_at',
      filters: [{ column: 'user_id', op: 'eq', value: userId }],
    }),
    client.query('progress_sessions', {
      select: 'summary',
      filters: [{ column: 'user_id', op: 'eq', value: userId }],
    }),
  ]);

  const totalCorrect = (attempts || []).filter(a => a.is_correct).length;

  let best = 0, cur = 0;
  (attempts || [])
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .forEach(a => {
      cur = a.is_correct ? cur + 1 : 0;
      best = Math.max(best, cur);
    });

  const badgeMap = new Map();
  if (totalCorrect >= 1) badgeMap.set('first_correct', { id: 'first_correct', name: 'First Steps', emoji: '🥇' });
  if (best >= 5) badgeMap.set('streak_5', { id: 'streak_5', name: 'Hot Streak', emoji: '🔥' });
  if (totalCorrect >= 100) badgeMap.set('hundred_correct', { id: 'hundred_correct', name: 'Century', emoji: '💯' });

  (sessions || []).forEach(s => {
    const sum = safeParseSummary(s.summary);
    if (!sum) return;
    const acc =
      typeof sum.accuracy === 'number' ? sum.accuracy
        : (typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) ? sum.score / sum.total
        : (typeof sum.score === 'number' && typeof sum.max === 'number' && sum.max > 0) ? sum.score / sum.max
        : null;
    if ((acc !== null && acc >= 1) || sum.perfect === true) {
      badgeMap.set('perfect_round', { id: 'perfect_round', name: 'Perfectionist', emoji: '🌟' });
    }
  });

  return jsonResponse(Array.from(badgeMap.values()), 200, origin);
}

async function handleOverview(client, userId, origin, debug = false) {
  const startMs = Date.now();
  const PAGE = 1000;

  // Fetch sessions and attempts with pagination
  const sessions = [];
  const attempts = [];
  
  let offset = 0;
  while (true) {
    const batch = await client.query('progress_sessions', {
      select: 'session_id,mode,list_name,summary,started_at,ended_at',
      filters: [{ column: 'user_id', op: 'eq', value: userId }],
      order: { column: 'started_at', ascending: false },
      range: { from: offset, to: offset + PAGE - 1 },
    });
    if (!batch || !batch.length) break;
    sessions.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  offset = 0;
  while (true) {
    const batch = await client.query('progress_attempts', {
      select: 'word,is_correct,created_at,mode,points',
      filters: [{ column: 'user_id', op: 'eq', value: userId }],
      order: { column: 'created_at', ascending: false },
      range: { from: offset, to: offset + PAGE - 1 },
    });
    if (!batch || !batch.length) break;
    attempts.push(...batch);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  attempts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Calculate total points
  let total_points = 0;
  try {
    const rpcVal = await client.rpc('sum_points_for_user', { uid: userId });
    total_points = typeof rpcVal === 'number' ? rpcVal : (rpcVal?.sum || 0);
  } catch {
    total_points = attempts.reduce((sum, a) => sum + (Number(a.points) || 0), 0);
  }

  const isPerfect = (sumRaw) => {
    const s = safeParseSummary(sumRaw) || {};
    if (s.completed === false) return false;
    if (s.accuracy === 1 || s.perfect === true) return true;
    if (typeof s.score === 'number' && typeof s.total === 'number') return s.score >= s.total;
    if (typeof s.score === 'number' && typeof s.max === 'number') return s.score >= s.max;
    return false;
  };

  const listNames = new Set(sessions.filter(s => s.list_name).map(s => s.list_name));
  const lists_explored = listNames.size;
  const perfect_runs = sessions.reduce((n, s) => n + (isPerfect(s.summary) ? 1 : 0), 0);

  const masteredPairs = new Set();
  sessions.forEach(s => {
    if (s.list_name && isPerfect(s.summary)) {
      masteredPairs.add(`${s.list_name}||${s.mode || 'unknown'}`);
    }
  });
  const mastered = masteredPairs.size;

  let best = 0, cur = 0;
  attempts.forEach(a => {
    cur = a.is_correct ? cur + 1 : 0;
    best = Math.max(best, cur);
  });
  const best_streak = best;

  const words_discovered = new Set(attempts.map(a => a.word).filter(Boolean)).size;

  const perWord = new Map();
  attempts.forEach(a => {
    if (!a.word) return;
    const cur = perWord.get(a.word) || { total: 0, correct: 0 };
    cur.total += 1;
    if (a.is_correct) cur.correct += 1;
    perWord.set(a.word, cur);
  });
  let words_mastered = 0;
  perWord.forEach(({ total, correct }) => {
    if (total > 0 && (correct / total) >= 0.8) words_mastered += 1;
  });

  const sessions_played = sessions.length;

  // Stars calculation
  const starsByListMode = new Map();
  sessions.forEach(s => {
    const list = s.list_name || '';
    const mode = s.mode || '';
    const key = `${list}||${mode}`;
    const parsed = safeParseSummary(s.summary);
    if (parsed && parsed.completed === false) return;
    const stars = deriveStars(parsed);
    const prev = starsByListMode.get(key) || 0;
    if (stars > prev) starsByListMode.set(key, stars);
  });
  let stars_total = 0;
  starsByListMode.forEach(v => { stars_total += v; });

  // Badges count
  let badges_count = 0;
  const totalCorrect = attempts.filter(a => a.is_correct).length;
  if (totalCorrect >= 1) badges_count++;
  if (best_streak >= 5) badges_count++;
  sessions.forEach(s => {
    const sum = safeParseSummary(s.summary);
    if (!sum) return;
    const acc = typeof sum.accuracy === 'number' ? sum.accuracy
      : (typeof sum.score === 'number' && typeof sum.total === 'number' && sum.total > 0) ? sum.score / sum.total
      : null;
    if ((acc !== null && acc >= 1) || sum.perfect === true) badges_count++;
  });

  // Favorite list
  const listCounts = new Map();
  sessions.forEach(s => {
    if (s.list_name) listCounts.set(s.list_name, (listCounts.get(s.list_name) || 0) + 1);
  });
  let favorite_list = null;
  if (listCounts.size) {
    let top = null;
    listCounts.forEach((cnt, name) => {
      if (!top || cnt > top.cnt) top = { name, cnt };
    });
    favorite_list = top;
  }

  // Hardest word
  const wordStats = new Map();
  attempts.forEach(a => {
    if (!a.word) return;
    const s = wordStats.get(a.word) || { total: 0, correct: 0 };
    s.total += 1;
    if (a.is_correct) s.correct += 1;
    wordStats.set(a.word, s);
  });
  let hardest_word = null;
  wordStats.forEach((s, w) => {
    const incorrect = s.total - s.correct;
    if (s.total < 3 || incorrect <= s.correct) return;
    const acc = s.correct / s.total;
    if (!hardest_word || incorrect > hardest_word.misses || (incorrect === hardest_word.misses && acc < hardest_word.accuracy)) {
      hardest_word = { word: w, misses: incorrect, attempts: s.total, accuracy: acc };
    }
  });

  const payload = {
    stars: stars_total,
    lists_explored,
    perfect_runs,
    mastered,
    mastered_lists: mastered,
    best_streak,
    words_discovered,
    words_mastered,
    sessions_played,
    badges_count,
    favorite_list,
    hardest_word,
    points: total_points,
  };

  if (debug) {
    payload.meta = {
      sessions_fetched: sessions.length,
      attempts_fetched: attempts.length,
    };
  }

  return timedJsonResponse(payload, 200, origin, startMs, true);
}

async function handleLeaderboardClass(client, userId, origin) {
  const startMs = Date.now();
  
  // Get user's class
  const meProf = await client.query('profiles', {
    select: 'class',
    filters: [{ column: 'id', op: 'eq', value: userId }],
    single: true,
  });
  
  const className = meProf?.class || null;
  if (!className || className.length === 1) {
    return timedJsonResponse({ success: true, leaderboard: [], class: null }, 200, origin, startMs, false);
  }

  // Get classmates
  const classmates = await client.query('profiles', {
    select: 'id,name,username,avatar',
    filters: [
      { column: 'role', op: 'eq', value: 'student' },
      { column: 'class', op: 'eq', value: className },
      { column: 'approved', op: 'eq', value: true },
    ],
    limit: 200,
  });

  if (!classmates || !classmates.length) {
    return timedJsonResponse({ success: true, leaderboard: [], class: className }, 200, origin, startMs, false);
  }

  const filtered = classmates.filter(p => !p.username || p.username.length > 1);
  if (!filtered.length) {
    return timedJsonResponse({ success: true, leaderboard: [], class: className }, 200, origin, startMs, false);
  }

  const ids = filtered.map(p => p.id);
  const pointTotals = await aggregatePointsForIds(client, ids, null);
  const pointsMap = new Map(pointTotals.map(row => [row.user_id, row.points]));

  const entries = filtered.map(p => ({
    user_id: p.id,
    name: p.name || p.username || 'Player',
    avatar: p.avatar || null,
    class: className,
    points: pointsMap.get(p.id) || 0,
    self: p.id === userId,
  }));
  entries.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
  entries.forEach((e, i) => e.rank = i + 1);

  let top = entries.slice(0, 5);
  const me = entries.find(e => e.self);
  if (me && !top.some(e => e.user_id === me.user_id)) top = [...top, me];

  return timedJsonResponse({ success: true, class: className, leaderboard: top }, 200, origin, startMs, false);
}

async function handleLeaderboardStarsClass(client, userId, timeframe, origin) {
  const startMs = Date.now();
  const firstOfMonthIso = timeframe === 'month' ? getMonthStartIso() : null;

  // Fast path: use Supabase RPC function if deployed.
  // Disabled for now - RPC may not be deployed or have type mismatches
  const USE_RPC = false;
  if (USE_RPC) {
    try {
      const me = await client.query('profiles', {
        select: 'class',
        filters: [{ column: 'id', op: 'eq', value: userId }],
        single: true,
      });
      const className = me?.class || null;
      if (!className || String(className).trim().length <= 1) {
        return timedJsonResponse({ success: true, leaderboard: [], class: null }, 200, origin, startMs, false);
      }

      const rpcRows = await client.rpc('get_class_leaderboard_stars', {
        p_class_name: className,
        p_timeframe: timeframe || 'all',
        p_user_id: userId,
      });

      if (Array.isArray(rpcRows) && rpcRows.length > 0) {
        const leaderboard = rpcRows
          .map(r => normalizeLeaderboardRow(r, userId))
          .filter(r => r && r.user_id);
        return timedJsonResponse(
          { success: true, class: className, timeframe, leaderboard },
          200,
          origin,
          startMs,
          false
        );
      }
    } catch (e) {
      console.warn('[progress-summary] RPC class leaderboard unavailable, falling back to JS:', e?.message || e);
    }
  }

  const meProf = await client.query('profiles', {
    select: 'class',
    filters: [{ column: 'id', op: 'eq', value: userId }],
    single: true,
  });

  const className = meProf?.class || null;
  if (!className || className.length === 1) {
    return timedJsonResponse({ success: true, leaderboard: [], class: null }, 200, origin, startMs, false);
  }

  const classmates = await client.query('profiles', {
    select: 'id,name,username,avatar',
    filters: [
      { column: 'role', op: 'eq', value: 'student' },
      { column: 'class', op: 'eq', value: className },
      { column: 'approved', op: 'eq', value: true },
    ],
    limit: 400,
  });

  if (!classmates || !classmates.length) {
    return timedJsonResponse({ success: true, leaderboard: [], class: className }, 200, origin, startMs, false);
  }

  const filtered = classmates.filter(p => !p.username || p.username.length > 1);
  if (!filtered.length) {
    return timedJsonResponse({ success: true, leaderboard: [], class: className }, 200, origin, startMs, false);
  }

  const ids = filtered.map(p => p.id).filter(Boolean);
  const pointTotals = await aggregatePointsForIds(client, ids, firstOfMonthIso);
  const pointsMap = new Map(pointTotals.map(row => [row.user_id, row.points]));
  const sessions = await fetchSessionsForUsers(client, ids, firstOfMonthIso);
  const starsByUser = buildStarsByUserMap(sessions);

  const sortedEntries = filtered.map(profile => ({
    user_id: profile.id,
    name: profile.name || profile.username || 'Student',
    avatar: profile.avatar || null,
    class: className,
    points: Math.round(pointsMap.get(profile.id) || 0),
    stars: starsByUser.get(profile.id) || 0,
  }));

  const finalized = finalizeLeaderboard(sortedEntries);
  
  // Format response
  const condensed = finalized.slice(0, 5).map(entry => ({ ...entry, self: entry.user_id === userId }));
  const me = finalized.find(entry => entry.user_id === userId);
  if (me && !condensed.some(e => e.user_id === me.user_id)) {
    condensed.push({ ...me, self: true });
  }

  return timedJsonResponse({
    success: true,
    class: className,
    timeframe,
    leaderboard: condensed,
  }, 200, origin, startMs, false);
}

async function handleLeaderboardStarsGlobal(client, userId, timeframe, origin, env) {
  const startMs = Date.now();
  const kvKey = `leaderboard_stars_global_v2_${timeframe || 'all'}`;

  // Fast path 1: Check KV cache (instant, edge)
  try {
    const kvData = await env.LEADERBOARD_CACHE.get(kvKey);
    if (kvData) {
      console.log('[progress-summary] KV cache hit for leaderboard_stars_global', timeframe);
      const data = JSON.parse(kvData);
      return timedJsonResponse({
        success: true,
        timeframe: data.timeframe,
        leaderboard: data.leaderboard,
        _cached: 'kv',
        _cached_at: data._cached_at,
      }, 200, origin, startMs, false);
    }
  } catch (e) {
    console.warn('[progress-summary] KV cache read error:', e?.message);
    // Fall through to database cache
  }

  // Fast path 2: Check leaderboard_cache table (populated by cron)
  try {
    const cacheRows = await client.query('leaderboard_cache', {
      select: 'payload,updated_at',
      filters: [
        { column: 'section', op: 'eq', value: 'leaderboard_stars_global' },
        { column: 'timeframe', op: 'eq', value: timeframe || 'all' },
      ],
      limit: 1,
    });

    const cacheData = Array.isArray(cacheRows) && cacheRows.length > 0 ? cacheRows[0] : null;

    if (cacheData && cacheData.payload) {
      console.log('[progress-summary] DB cache hit for leaderboard_stars_global', timeframe);
      const payload = typeof cacheData.payload === 'string' ? JSON.parse(cacheData.payload) : cacheData.payload;
      
      if (payload.topEntries && Array.isArray(payload.topEntries)) {
        const leaderboard = payload.topEntries.map(entry => ({
          user_id: entry.user_id,
          name: entry.name || 'Student',
          avatar: entry.avatar || null,
          class: entry.class || null,
          points: entry.points || 0,
          stars: entry.stars || 0,
          superScore: entry.superScore || 0,
          rank: entry.rank || 0,
          self: entry.user_id === userId,
        }));

        const hasUser = leaderboard.some(e => e.user_id === userId);
        if (!hasUser && userId && payload.userPoints && payload.userPoints[userId]) {
          const up = payload.userPoints[userId];
          const userStars = up.stars || 0;
          const userPoints = up.points || 0;
          leaderboard.push({
            user_id: userId,
            name: up.name || 'You',
            avatar: up.avatar || null,
            class: up.class || null,
            points: userPoints,
            stars: userStars,
            superScore: Math.round((userStars * userPoints) / 1000),
            rank: up.rank || 999,
            self: true,
          });
        }

        const response = {
          success: true,
          timeframe: payload.timeframe || timeframe,
          leaderboard,
          _cached: 'db',
          _cached_at: payload.cached_at || cacheData.updated_at,
        };

        // Store in KV for future requests (1 hour TTL)
        try {
          await env.LEADERBOARD_CACHE.put(kvKey, JSON.stringify({
            timeframe: payload.timeframe || timeframe,
            leaderboard,
            _cached_at: payload.cached_at || cacheData.updated_at,
          }), { expirationTtl: 3600 });
          console.log('[progress-summary] Stored leaderboard in KV cache for', timeframe);
        } catch (e) {
          console.warn('[progress-summary] Failed to store in KV:', e?.message);
        }

        return timedJsonResponse(response, 200, origin, startMs, false);
      }
    }
  } catch (e) {
    console.warn('[progress-summary] DB cache read failed for leaderboard_stars_global:', e?.message);
  }

  // Fallback: Use RPC function to compute in a single query (avoids subrequest limit)
  console.log('[progress-summary] Cache miss for leaderboard_stars_global, using RPC. Timeframe:', timeframe);
  try {
    // Use the Supabase RPC function - only 1 subrequest instead of 50+
    const rpcRows = await client.rpc('get_global_leaderboard_stars', {
      p_timeframe: timeframe || 'all',
      p_user_id: userId,
      p_limit: 20,
    });

    if (!Array.isArray(rpcRows)) {
      throw new Error('RPC returned non-array');
    }

    const leaderboard = rpcRows.map(row => ({
      user_id: row.user_id,
      name: row.name || 'Student',
      avatar: row.avatar || null,
      class: row.class_name || null,
      points: Number(row.total_points) || 0,
      stars: Number(row.total_stars) || 0,
      superScore: Number(row.super_score) || 0,
      rank: Number(row.rank) || 0,
      self: row.user_id === userId,
    }));

    const cachedAt = new Date().toISOString();
    const response = {
      success: true,
      timeframe: timeframe || 'all',
      leaderboard,
      _cached: false,
      _computed_ms: Date.now() - startMs,
      _cached_at: cachedAt,
    };

    // Store in KV for future requests (30 min TTL)
    try {
      await env.LEADERBOARD_CACHE.put(kvKey, JSON.stringify({
        timeframe: timeframe || 'all',
        leaderboard,
        _cached_at: cachedAt,
      }), { expirationTtl: 1800 });
      console.log('[progress-summary] Stored RPC result in KV cache for', timeframe);
    } catch (kvErr) {
      console.warn('[progress-summary] Failed to store RPC result in KV:', kvErr?.message);
    }

    return timedJsonResponse(response, 200, origin, startMs, false);
  } catch (e) {
    console.error('[progress-summary] RPC computation failed for leaderboard_stars_global:', e?.message || e);
    return timedJsonResponse({
      success: false,
      message: 'Failed to compute leaderboard',
      error: e?.message,
    }, 500, origin, startMs, false);
  }
}

async function handleChallengingV2(client, userId, origin) {
  try {
    const data = await client.rpc('challenging_words_v2', { p_user_id: userId, p_limit: 30 });
    
    const sanitizeWord = (s) => {
      if (!s || typeof s !== 'string') return '';
      return s.replace(/\s{2,}/g, ' ').trim();
    };
    
    const badSuffix = /_(sentence|broken|fillblank)\b/i;
    const out = (data || []).map(r => ({
      word: sanitizeWord(r.word_en || r.word || ''),
      word_en: sanitizeWord(r.word_en || r.word || ''),
      word_kr: sanitizeWord(r.word_kr || ''),
      attempts: r.attempts,
      correct: r.correct,
      incorrect: r.incorrect,
      accuracy: typeof r.accuracy === 'number' ? Number(r.accuracy) : null,
    }))
      .filter(r => r.word_en && r.word_kr)
      .filter(r => !r.word_en.includes('_') && !badSuffix.test(r.word_en));
    
    return jsonResponse(out, 200, origin);
  } catch (e) {
    console.error('[progress-summary] challenging_v2 error:', e);
    return jsonResponse([], 200, origin);
  }
}

// Generate leaderboard cache (called by cron trigger)
async function generateLeaderboardCache(client, timeframe, env) {
  const startMs = Date.now();
  const kvKey = `leaderboard_stars_global_v2_${timeframe || 'all'}`;

  try {
    console.log('[cron] Generating leaderboard cache for timeframe:', timeframe);
    
    // Use RPC for single-query computation (avoids subrequest limits)
    const rpcRows = await client.rpc('get_global_leaderboard_stars', {
      p_timeframe: timeframe || 'all',
      p_user_id: null,
      p_limit: 100, // More entries for cache
    });

    if (!Array.isArray(rpcRows) || rpcRows.length === 0) {
      console.warn('[cron] Empty RPC result for', timeframe);
      return;
    }

    const topEntries = rpcRows.map(row => ({
      user_id: row.user_id,
      name: row.name || 'Student',
      avatar: row.avatar || null,
      class: row.class_name || null,
      points: Number(row.total_points) || 0,
      stars: Number(row.total_stars) || 0,
      superScore: Number(row.super_score) || 0,
      rank: Number(row.rank) || 0,
    }));

    const cachedAt = new Date().toISOString();
    const payload = {
      timeframe: timeframe || 'all',
      cached_at: cachedAt,
      topEntries,
      userPoints: Object.fromEntries(topEntries.map(e => [e.user_id, e])),
    };

    try {
      await env.LEADERBOARD_CACHE.put(kvKey, JSON.stringify({
        timeframe: payload.timeframe,
        leaderboard: payload.topEntries,
        _cached_at: payload.cached_at,
      }), { expirationTtl: 3600 });
      console.log('[cron] Stored leaderboard in KV for', timeframe);
    } catch (kvErr) {
      console.warn('[cron] Failed to store KV leaderboard:', kvErr?.message);
    }

    try {
      const resp = await fetch(`${client.url}/rest/v1/leaderboard_cache?on_conflict=section,timeframe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': client.serviceKey,
          'Authorization': `Bearer ${client.serviceKey}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          section: 'leaderboard_stars_global',
          timeframe: payload.timeframe,
          payload,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!resp.ok) {
        const body = await resp.text();
        console.warn('[cron] leaderboard_cache upsert failed:', resp.status, body);
      }
    } catch (dbErr) {
      console.warn('[cron] Failed to upsert leaderboard_cache:', dbErr?.message);
    }

    console.log('[cron] Leaderboard cache generated for', timeframe, 'in', Date.now() - startMs, 'ms');
  } catch (e) {
    console.error('[cron] Error generating leaderboard cache for', timeframe, ':', e?.message);
  }
}

// Main handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: getCorsHeaders(origin) });
    }

    // Teacher analytics endpoint (used by Student Tracker)
    if (url.pathname === '/teacher_summary' || url.pathname === '/teacher_summary/') {
      // Allow GET + POST for this route
      if (request.method !== 'GET' && request.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405, origin);
      }
      try {
        return await teacherHandle(request, env, origin);
      } catch (e) {
        console.error('[progress-summary] teacher_summary error:', e);
        return jsonResponse({ success: false, error: e?.message || 'Internal error' }, 500, origin);
      }
    }

    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method Not Allowed' }, 405, origin);
    }

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
      console.error('[progress-summary] Missing env vars');
      return jsonResponse({ error: 'Server misconfigured' }, 500, origin);
    }

    const client = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

    // Get access token
    const accessToken = getAccessToken(request);
    if (!accessToken) {
      return jsonResponse({ error: 'Not signed in (cookie missing or invalid)' }, 401, origin);
    }

    // Verify user
    const userData = await client.verifyToken(accessToken);
    if (!userData || !userData.id) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401, origin);
    }
    const userId = userData.id;

    // Route by section
    const section = (url.searchParams.get('section') || 'kpi').toLowerCase();
    const timeframe = (url.searchParams.get('timeframe') || 'all').toLowerCase();
    const listName = url.searchParams.get('list_name') || null;
    const debug = url.searchParams.get('debug') === '1';

    try {
      switch (section) {
        case 'kpi':
          return handleKpi(client, userId, origin);
        case 'modes':
          return handleModes(client, userId, origin);
        case 'sessions':
          return handleSessions(client, userId, listName, origin);
        case 'attempts':
          return handleAttempts(client, userId, origin);
        case 'badges':
          return handleBadges(client, userId, origin);
        case 'overview':
          return handleOverview(client, userId, origin, debug);
        case 'leaderboard_class':
          return handleLeaderboardClass(client, userId, origin);
        case 'leaderboard_stars_class':
          return handleLeaderboardStarsClass(client, userId, timeframe, origin);
        case 'leaderboard_stars_global':
          return handleLeaderboardStarsGlobal(client, userId, timeframe, origin, env);
        case 'leaderboard_global':
          return handleLeaderboardStarsGlobal(client, userId, 'all', origin, env);
        case 'challenging_v2':
          return handleChallengingV2(client, userId, origin);
        case 'challenging':
          // For now, use v2 for challenging as well
          return handleChallengingV2(client, userId, origin);
        default:
          return jsonResponse({ error: 'Unknown section', section }, 400, origin);
      }
    } catch (e) {
      console.error('[progress-summary] Error:', e);
      return jsonResponse({ error: e.message || 'Internal error' }, 500, origin);
    }
  },

  // Cron handler for leaderboard cache generation
  async scheduled(event, env, ctx) {
    try {
      console.log('[cron] Leaderboard cache generation started');
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
        console.error('[cron] Missing env vars');
        return;
      }
      
      const client = new SupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
      
      // Generate cache for both timeframes
      await Promise.all([
        generateLeaderboardCache(client, 'all', env),
        generateLeaderboardCache(client, 'month', env),
      ]);
      
      console.log('[cron] Leaderboard cache generation completed');
    } catch (e) {
      console.error('[cron] Fatal error in leaderboard generation:', e);
    }
  },
};
