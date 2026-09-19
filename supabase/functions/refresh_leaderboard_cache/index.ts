import { createClient } from 'npm:@supabase/supabase-js';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_URL_OVERRIDE') || '';
const SERVICE_KEY =
  Deno.env.get('LEADERBOARD_SERVICE_ROLE_KEY') ||
  Deno.env.get('SERVICE_ROLE_KEY') ||
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase URL or service-role key');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function mapRows(rows: any[]) {
  return (rows || []).map((row: any) => ({
    user_id: row.user_id,
    name: row.name || row.username || 'Student',
    avatar: row.avatar || null,
    class: row.class_name || null,
    points: Number(row.total_points) || 0,
    stars: Number(row.total_stars) || 0,
    superScore: Number(row.super_score) || 0,
    rank: Number(row.rank) || null,
    self: false
  }));
}

async function upsertCache(section: string, timeframe: string, payload: any) {
  const { error } = await supabase
    .from('leaderboard_cache')
    .upsert(
      { section, timeframe, payload, updated_at: new Date().toISOString() },
      { onConflict: 'section,timeframe', returning: 'minimal' }
    );
  if (error) throw error;
}

async function loadLeaderboard(timeframe: 'all' | 'month') {
  const { data, error } = await supabase.rpc('progress_leaderboard_v1', {
    p_class: null,
    p_timeframe: timeframe
  });
  if (error) throw error;
  return mapRows(Array.isArray(data) ? data : []);
}

async function computeAndCacheGlobal() {
  try {
    const { data: last, error } = await supabase
      .from('leaderboard_cache')
      .select('updated_at')
      .eq('section', 'leaderboard_stars_global')
      .eq('timeframe', 'all')
      .single();
    if (!error && last?.updated_at) {
      const ageMs = Date.now() - new Date(last.updated_at).getTime();
      if (ageMs < 100000) return { skipped: true, age_seconds: Math.round(ageMs / 1000) };
    }
  } catch {}

  const [allRows, monthRows] = await Promise.all([
    loadLeaderboard('all'),
    loadLeaderboard('month')
  ]);

  const allTop = allRows.slice(0, 50);
  const monthTop = monthRows.slice(0, 50);
  const now = new Date().toISOString();

  await Promise.all([
    upsertCache('leaderboard_global', 'all', { success: true, leaderboard: allTop.slice(0, 20) }),
    upsertCache('leaderboard_stars_global', 'all', {
      success: true, timeframe: 'all', cached_at: now, leaderboard: allTop.slice(0, 20)
    }),
    upsertCache('leaderboard_stars_global', 'month', {
      success: true, timeframe: 'month', cached_at: now, leaderboard: monthTop.slice(0, 20)
    })
  ]);

  return { success: true, all_rows: allRows.length, month_rows: monthRows.length };
}

Deno.serve(async (_req: Request) => {
  try {
    const result = await computeAndCacheGlobal();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('refresh error', e);
    return new Response(JSON.stringify({ error: e?.message || 'internal' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
