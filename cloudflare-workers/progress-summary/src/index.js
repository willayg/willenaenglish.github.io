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

async function handleLeaderboardStarsGlobal(client, userId, timeframe, origin) {
  const startMs = Date.now();
  const firstOfMonthIso = timeframe === 'month' ? getMonthStartIso() : null;

  // Fetch all approved students
  let students = [];
  let offset = 0;
  const batchSize = 500;
  
  while (true) {
    const batch = await client.query('profiles', {
      select: 'id,name,username,avatar,class',
      filters: [
        { column: 'role', op: 'eq', value: 'student' },
        { column: 'approved', op: 'eq', value: true },
      ],
      order: { column: 'id', ascending: true },
      range: { from: offset, to: offset + batchSize - 1 },
    });
    if (!batch || !batch.length) break;
    students.push(...batch);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  if (!students.length) {
    return timedJsonResponse({ success: true, leaderboard: [] }, 200, origin, startMs, false);
  }

  const filtered = students.filter(p => !p.username || p.username.length > 1);
  if (!filtered.length) {
    return timedJsonResponse({ success: true, leaderboard: [] }, 200, origin, startMs, false);
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
    class: profile.class || null,
    points: Math.round(pointsMap.get(profile.id) || 0),
    stars: starsByUser.get(profile.id) || 0,
  }));
  sortedEntries.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  const topLimit = 15;
  const topEntries = finalizeLeaderboard(sortedEntries.slice(0, topLimit).map(e => ({ ...e })));

  // Format with self marker
  const formatted = topEntries.map(entry => ({ ...entry, self: entry.user_id === userId }));
  let hasUser = formatted.some(e => e.user_id === userId);

  if (!hasUser && userId) {
    const userEntry = sortedEntries.find(e => e.user_id === userId);
    if (userEntry) {
      const rank = sortedEntries.findIndex(e => e.user_id === userId) + 1;
      formatted.push({
        ...userEntry,
        superScore: Math.round((userEntry.stars * userEntry.points) / 1000),
        rank,
        self: true,
      });
    }
  }

  return timedJsonResponse({
    success: true,
    timeframe,
    leaderboard: formatted,
  }, 200, origin, startMs, false);
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

// Main handler
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: getCorsHeaders(origin) });
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
          return handleLeaderboardStarsGlobal(client, userId, timeframe, origin);
        case 'leaderboard_global':
          return handleLeaderboardStarsGlobal(client, userId, 'all', origin);
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
};
