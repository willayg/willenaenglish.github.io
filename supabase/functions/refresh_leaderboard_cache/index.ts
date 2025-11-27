import { createClient } from 'npm:@supabase/supabase-js';

// This Edge Function computes and upserts leaderboard cache rows.
// It expects the following secrets/environment variables to be set in the Supabase function
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY

// Read SUPABASE_URL from environment (standard name) or a fallback key
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_URL_OVERRIDE') || '';
// The CLI prevents secrets whose names start with `SUPABASE_`, so accept several allowed names.
const SERVICE_KEY = Deno.env.get('LEADERBOARD_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or service role key. Provide one of LEADERBOARD_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY as a secret, and SUPABASE_URL.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function getMonthStartIso() {
  const now = new Date();
  const firstUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  return firstUtc.toISOString();
}

function parseSummary(s: any) {
  try { if (!s) return null; if (typeof s === 'string') return JSON.parse(s); return s; }
  catch { return null; }
}

function deriveStars(summary: any) {
  const s = summary || {};
  let acc: number | null = null;
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

async function aggregatePointsForIds(client: any, ids: string[], firstOfMonthIso: string | null) {
  if (!ids || !ids.length) return [];
  const chunkSize = 200;
  const pageSize = 1000;
  const totals = new Map<string, number>();
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    let offset = 0;
    while (true) {
      let query = client
        .from('progress_attempts')
        .select('id, user_id, points')
        .in('user_id', chunk)
        .not('points', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (firstOfMonthIso) query = query.gte('created_at', firstOfMonthIso);
      const { data, error } = await query;
      if (error) throw error;
      if (!data || !data.length) break;
      data.forEach((row: any) => {
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

async function fetchSessionsForUsers(client: any, userIds: string[], firstOfMonthIso: string | null) {
  if (!userIds || !userIds.length) return [];
  const chunkSize = 150;
  const pageSize = 1000;
  const sessions: any[] = [];
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    let offset = 0;
    while (true) {
      let query = client
        .from('progress_sessions')
        .select('user_id, list_name, mode, summary, ended_at')
        .in('user_id', chunk)
        .not('ended_at', 'is', null)
        .order('id', { ascending: true })
        .range(offset, offset + pageSize - 1);
      if (firstOfMonthIso) query = query.gte('ended_at', firstOfMonthIso);
      const { data, error } = await query;
      if (error) throw error;
      if (!data || !data.length) break;
      sessions.push(...data);
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  return sessions;
}

function finalizeLeaderboard(entries: any[]) {
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

async function upsertCache(section: string, timeframe: string, payload: any) {
  const { error } = await supabase
    .from('leaderboard_cache')
    .upsert({ section, timeframe, payload }, { returning: 'minimal' });
  if (error) throw error;
}

async function computeAndCacheGlobal() {
  // Guard: skip if last update recent (100s)
  try {
    const { data: last, error: lastErr } = await supabase
      .from('leaderboard_cache')
      .select('updated_at')
      .eq('section', 'leaderboard_stars_global')
      .eq('timeframe', 'all')
      .single();
    if (!lastErr && last && last.updated_at) {
      const lastTs = new Date(last.updated_at).getTime();
      if (Date.now() - lastTs < 100000) {
        console.log('Skipping run; last update was', Math.round((Date.now() - lastTs) / 1000), 'seconds ago');
        return { skipped: true };
      }
    }
  } catch (e) {
    console.warn('Guard check failed, continuing', e && e.message);
  }

  // Fetch all approved students
  const students: any[] = [];
  let studentOffset = 0;
  const studentBatchSize = 500;
  while (true) {
    const { data: batch, error } = await supabase
      .from('profiles')
      .select('id, name, username, avatar, class')
      .eq('role', 'student')
      .eq('approved', true)
      .order('id', { ascending: true })
      .range(studentOffset, studentOffset + studentBatchSize - 1);
    if (error) throw error;
    if (!batch || batch.length === 0) break;
    students.push(...batch);
    if (batch.length < studentBatchSize) break;
    studentOffset += studentBatchSize;
  }

  const filtered = students.filter(p => !p.username || p.username.length > 1);
  const ids = filtered.map(p => p.id).filter(Boolean);

  const allPointsTotals = await aggregatePointsForIds(supabase, ids, null);
  const pointsMap = new Map(allPointsTotals.map((r: any) => [r.user_id, r.points]));
  const sortedPointsEntries = filtered.map(profile => ({
    user_id: profile.id,
    name: profile.name || profile.username || 'Student',
    avatar: profile.avatar || null,
    class: profile.class || null,
    points: Math.round(pointsMap.get(profile.id) || 0),
    self: false
  }));
  sortedPointsEntries.sort((a,b)=> b.points - a.points || a.name.localeCompare(b.name));
  const topPoints = sortedPointsEntries.slice(0, 50);
  finalizeLeaderboard(topPoints);

  const candidateIds = Array.from(new Set(topPoints.map(e => e.user_id))).slice(0, 200);
  const sessionsAll = await fetchSessionsForUsers(supabase, candidateIds, null);
  const sessionsMonth = await fetchSessionsForUsers(supabase, candidateIds, getMonthStartIso());

  function computeStarsForSessions(sessions: any[]) {
    const starsLookup = new Map();
    sessions.forEach(sess => {
      if (!sess || !sess.user_id) return;
      const list = (sess.list_name || '').trim();
      const mode = (sess.mode || '').trim();
      if (!list || !mode) return;
      const parsed = parseSummary(sess.summary);
      if (parsed && parsed.completed === false) return;
      const stars = deriveStars(parsed);
      if (stars <= 0) return;
      const key = `${sess.user_id}||${list}||${mode}`;
      const prev = starsLookup.get(key) || 0;
      if (stars > prev) starsLookup.set(key, stars);
    });
    const starsByUser = new Map();
    starsLookup.forEach((value, composite) => {
      const [uid] = composite.split('||');
      starsByUser.set(uid, (starsByUser.get(uid) || 0) + value);
    });
    return starsByUser;
  }

  const starsAll = computeStarsForSessions(sessionsAll);
  const starsMonth = computeStarsForSessions(sessionsMonth);

  topPoints.forEach(entry => { entry.stars = starsAll.get(entry.user_id) || 0; });
  const resultStarsAll = finalizeLeaderboard(topPoints.map(e => ({...e}))).slice(0, 50);

  const monthPointTotals = await aggregatePointsForIds(supabase, ids, getMonthStartIso());
  const monthMap = new Map(monthPointTotals.map((r: any) => [r.user_id, r.points]));
  const monthEntries = filtered.map(profile => ({
    user_id: profile.id,
    name: profile.name || profile.username || 'Student',
    avatar: profile.avatar || null,
    class: profile.class || null,
    points: Math.round(monthMap.get(profile.id) || 0),
    self: false
  }));
  monthEntries.sort((a,b)=> b.points - a.points || a.name.localeCompare(b.name));
  const topMonthPoints = monthEntries.slice(0, 50);
  topMonthPoints.forEach(entry => { entry.stars = starsMonth.get(entry.user_id) || 0; });
  const resultStarsMonth = finalizeLeaderboard(topMonthPoints.map(e => ({...e}))).slice(0, 50);

  await upsertCache('leaderboard_global', 'all', { success: true, leaderboard: topPoints.slice(0,20) });
  await upsertCache('leaderboard_stars_global', 'all', { success: true, leaderboard: resultStarsAll.slice(0,20) });
  await upsertCache('leaderboard_stars_global', 'month', { success: true, leaderboard: resultStarsMonth.slice(0,20) });

  return { success: true };
}

// Supabase Edge Function handler
export default async function handler(req: Request) {
  try {
    const res = await computeAndCacheGlobal();
    return new Response(JSON.stringify(res), { status: 200 });
  } catch (e) {
    console.error('refresh error', e && e.stack || e);
    return new Response(JSON.stringify({ error: e && e.message || 'internal' }), { status: 500 });
  }
}
