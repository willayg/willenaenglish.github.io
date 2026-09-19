// scripts/refresh_leaderboard_cache.js
// Refresh global leaderboard caches using server-side SQL aggregation.
// This intentionally does not page through progress_attempts/progress_sessions.

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

function mapRows(rows) {
  return (rows || []).map(row => ({
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

async function load(timeframe) {
  const { data, error } = await supabase.rpc('progress_leaderboard_v1', {
    p_class: null,
    p_timeframe: timeframe
  });
  if (error) throw error;
  return mapRows(Array.isArray(data) ? data : []);
}

async function upsert(section, timeframe, payload) {
  const { error } = await supabase
    .from('leaderboard_cache')
    .upsert(
      { section, timeframe, payload, updated_at: new Date().toISOString() },
      { onConflict: 'section,timeframe', returning: 'minimal' }
    );
  if (error) throw error;
}

(async () => {
  try {
    const [allRows, monthRows] = await Promise.all([load('all'), load('month')]);
    const now = new Date().toISOString();
    const allTop = allRows.slice(0, 50);
    const monthTop = monthRows.slice(0, 50);

    await Promise.all([
      upsert('leaderboard_global', 'all', { success: true, leaderboard: allTop.slice(0, 20) }),
      upsert('leaderboard_stars_global', 'all', {
        success: true, timeframe: 'all', cached_at: now, leaderboard: allTop.slice(0, 20)
      }),
      upsert('leaderboard_stars_global', 'month', {
        success: true, timeframe: 'month', cached_at: now, leaderboard: monthTop.slice(0, 20)
      })
    ]);

    console.log('Leaderboard caches refreshed without exporting raw history.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(2);
  }
})();
