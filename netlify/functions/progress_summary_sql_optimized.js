// netlify/functions/progress_summary_sql_optimized.js
// Alternative version using SQL functions for leaderboard aggregation
// This is a reference implementation showing how to use the Supabase SQL functions
// Deploy to progress_summary.js when ready to switch from JS to SQL aggregation

// To activate:
// 1. Deploy the SQL migration: supabase/migrations/20251108_leaderboard_aggregation_functions.sql
// 2. Uncomment the SQL-based sections in progress_summary.js
// 3. Comment out the JS-based aggregation loops

// ============================================================
// SQL-BASED LEADERBOARD FETCH (replaces JS aggregation loops)
// ============================================================

async function getClassLeaderboardStarsSql(adminClient, className, timeframe, userId) {
  /**
   * Replace the current JS aggregation loop with a single SQL function call
   * 
   * BEFORE (current JS approach):
   *   - Fetch all sessions for class
   *   - Fetch all attempts for class
   *   - Loop through all sessions, compute stars per (list, mode), aggregate per user
   *   - Sort all entries
   *   - Return top 5 + self
   *   ≈ 1000-2000ms for 500+ students
   * 
   * AFTER (SQL function approach):
   *   - Call SQL function with parameters
   *   - SQL does all aggregation, filtering, ranking at DB level
   *   ≈ 100-300ms for 500+ students
   */
  
  const { data, error } = await adminClient
    .rpc('get_class_leaderboard_stars', {
      p_class_name: className,
      p_timeframe: timeframe || 'all',
      p_user_id: userId
    });
  
  if (error) throw error;
  return data;
}

async function getGlobalLeaderboardStarsSql(adminClient, timeframe, userId) {
  /**
   * Replace the current JS aggregation loop with a single SQL function call
   * 
   * BEFORE (current JS approach):
   *   - Fetch all approved students
   *   - Fetch all sessions for those students
   *   - Fetch all attempts for those students
   *   - Loop through all sessions, compute stars per (list, mode), aggregate per user
   *   - Sort all entries
   *   - Return top 10 + self
   *   ≈ 2000-5000ms for 1000+ students
   * 
   * AFTER (SQL function approach):
   *   - Call SQL function with parameters
   *   - SQL does all aggregation, filtering, ranking at DB level
   *   ≈ 200-600ms for 1000+ students
   */
  
  const { data, error } = await adminClient
    .rpc('get_global_leaderboard_stars', {
      p_timeframe: timeframe || 'all',
      p_user_id: userId
    });
  
  if (error) throw error;
  return data;
}

// ============================================================
// REFACTORED HANDLER SECTIONS (replace in progress_summary.js)
// ============================================================

// Example: Class leaderboard_stars_class section using SQL
async function handleClassLeaderboardSql(adminClient, section, event, userId) {
  if (section !== 'leaderboard_stars_class') return null;
  
  try {
    const timeframe = ((event.queryStringParameters?.timeframe) || 'all').toLowerCase();
    
    // ===== CACHE CHECK =====
    const cachedResult = getCachedLeaderboard('stars_class', timeframe, userId);
    if (cachedResult) {
      console.log(`[progress_summary] Cache hit for leaderboard_stars_class (${timeframe})`);
      return { statusCode: 200, body: JSON.stringify(cachedResult) };
    }
    // ===== END CACHE CHECK =====
    
    // Get user's class
    const { data: meProf, error: meErr } = await adminClient
      .from('profiles')
      .select('class')
      .eq('id', userId)
      .single();
    
    if (meErr || !meProf) {
      return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Profile missing' }) };
    }
    
    const className = meProf.class || null;
    if (!className) {
      return { statusCode: 200, body: JSON.stringify({ success: true, leaderboard: [], class: null }) };
    }
    
    // ===== SQL FUNCTION CALL (replaces 300+ lines of JS aggregation) =====
    const leaderboard = await getClassLeaderboardStarsSql(adminClient, className, timeframe, userId);
    
    // Format result
    const result = { 
      success: true, 
      class: className, 
      leaderboard: leaderboard.map(row => ({
        user_id: row.user_id,
        name: row.name,
        avatar: row.avatar,
        class: row.class,
        stars: Number(row.total_stars),
        points: Number(row.total_points),
        rank: row.rank,
        self: row.is_self
      }))
    };
    
    setCachedLeaderboard('stars_class', timeframe, userId, result);
    return { statusCode: 200, body: JSON.stringify(result) };
    
  } catch (e) {
    console.error('[progress_summary] leaderboard_stars_class error:', e);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal error', details: e?.message }) };
  }
}

// Example: Global leaderboard_stars_global section using SQL
async function handleGlobalLeaderboardSql(adminClient, section, event, userId) {
  if (section !== 'leaderboard_stars_global') return null;
  
  try {
    const timeframe = ((event.queryStringParameters?.timeframe) || 'all').toLowerCase();
    
    // ===== CACHE CHECK =====
    const cachedResult = getCachedLeaderboard('stars_global', timeframe, userId);
    if (cachedResult) {
      console.log(`[progress_summary] Cache hit for leaderboard_stars_global (${timeframe})`);
      return { statusCode: 200, body: JSON.stringify(cachedResult) };
    }
    // ===== END CACHE CHECK =====
    
    // ===== SQL FUNCTION CALL (replaces 300+ lines of JS aggregation) =====
    const leaderboard = await getGlobalLeaderboardStarsSql(adminClient, timeframe, userId);
    
    // Format result
    const result = { 
      success: true, 
      leaderboard: leaderboard.map(row => ({
        user_id: row.user_id,
        name: row.name,
        avatar: row.avatar,
        class: row.class,
        stars: Number(row.total_stars),
        points: Number(row.total_points),
        rank: row.rank,
        self: row.is_self
      }))
    };
    
    setCachedLeaderboard('stars_global', timeframe, userId, result);
    return { statusCode: 200, body: JSON.stringify(result) };
    
  } catch (e) {
    console.error('[progress_summary] leaderboard_stars_global error:', e);
    return { statusCode: 500, body: JSON.stringify({ success: false, error: 'Internal error', details: e?.message }) };
  }
}

// ============================================================
// DEPLOYMENT INSTRUCTIONS
// ============================================================
/*
Step 1: Deploy SQL Functions
  - Run supabase/migrations/20251108_leaderboard_aggregation_functions.sql in Supabase Console
  - Or use: supabase migration up
  - Verify: SELECT * FROM get_class_leaderboard_stars('ClassA', 'all', 'test-user-id');

Step 2: Update progress_summary.js (when ready)
  Option A (Gradual):
    - Keep JS version running in production
    - Add SQL version alongside for A/B testing
    - Monitor performance
    - Switch when confident
  
  Option B (Direct):
    - Replace entire leaderboard_stars_class section
    - Replace entire leaderboard_stars_global section
    - Keep caching layer (still provides cache hits)
    - Deploy

Step 3: Verify
  - Test leaderboard with ?section=leaderboard_stars_class&timeframe=all
  - Test leaderboard with ?section=leaderboard_stars_global&timeframe=month
  - Monitor Netlify logs for performance metrics
  - Check Supabase function execution time

Expected Results:
  - Class leaderboard: 1500ms → 200ms (7.5x faster)
  - Global leaderboard: 3000ms → 400ms (7.5x faster)
  - Combined with caching: 60-80x faster on cache hits
*/

module.exports = {
  getClassLeaderboardStarsSql,
  getGlobalLeaderboardStarsSql,
  handleClassLeaderboardSql,
  handleGlobalLeaderboardSql
};
