/**
 * Scheduled function to populate student_daily_stats table
 * 
 * This runs daily via Netlify scheduled functions to snapshot
 * each student's activity from the previous day.
 * 
 * Schedule: Runs at 5:00 AM UTC daily (configured in netlify.toml)
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Allow manual trigger via HTTP or scheduled trigger
  const isScheduled = event.httpMethod === undefined;
  
  // For manual runs, allow specifying a date via query param
  let targetDate;
  if (!isScheduled && event.queryStringParameters?.date) {
    targetDate = event.queryStringParameters.date; // e.g., "2025-12-10"
  } else {
    // Default: yesterday
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' })
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`[populate_daily_stats] Running for date: ${targetDate}`);

  try {
    // Use raw SQL for the upsert since it's more efficient for this aggregation
    const { data, error } = await supabase.rpc('populate_student_daily_stats', {
      run_date: targetDate
    });

    if (error) {
      // If the RPC doesn't exist, fall back to manual query
      if (error.message.includes('function') || error.code === '42883') {
        console.log('[populate_daily_stats] RPC not found, using direct query');
        return await populateDirectly(supabase, targetDate);
      }
      throw error;
    }

    console.log(`[populate_daily_stats] Success via RPC for ${targetDate}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        date: targetDate,
        method: 'rpc'
      })
    };

  } catch (err) {
    console.error('[populate_daily_stats] Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

/**
 * Direct aggregation fallback if the stored procedure doesn't exist
 */
async function populateDirectly(supabase, targetDate) {
  const startOfDay = `${targetDate}T00:00:00Z`;
  const endOfDay = `${targetDate}T23:59:59.999Z`;

  // Get all students (profiles with role = student or no role specified)
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, class')
    .or('role.eq.student,role.is.null');

  if (profErr) {
    throw new Error(`Failed to fetch profiles: ${profErr.message}`);
  }

  if (!profiles || profiles.length === 0) {
    console.log('[populate_daily_stats] No student profiles found');
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, date: targetDate, studentsProcessed: 0 })
    };
  }

  const userIds = profiles.map(p => p.id);
  const userClassMap = Object.fromEntries(profiles.map(p => [p.id, p.class]));

  // Fetch attempts for the day
  const { data: attempts, error: attErr } = await supabase
    .from('progress_attempts')
    .select('user_id, is_correct, points')
    .in('user_id', userIds)
    .gte('created_at', startOfDay)
    .lt('created_at', endOfDay);

  if (attErr) {
    throw new Error(`Failed to fetch attempts: ${attErr.message}`);
  }

  // Fetch sessions for the day
  const { data: sessions, error: sessErr } = await supabase
    .from('progress_sessions')
    .select('user_id, id')
    .in('user_id', userIds)
    .gte('started_at', startOfDay)
    .lt('started_at', endOfDay);

  if (sessErr) {
    throw new Error(`Failed to fetch sessions: ${sessErr.message}`);
  }

  // Aggregate per user
  const statsMap = {};
  for (const uid of userIds) {
    statsMap[uid] = {
      user_id: uid,
      date: targetDate,
      class: userClassMap[uid] || null,
      stars_earned: 0,
      points_earned: 0,
      attempts: 0,
      correct: 0,
      sessions: 0
    };
  }

  // Count attempts and points
  for (const att of (attempts || [])) {
    const s = statsMap[att.user_id];
    if (s) {
      s.attempts++;
      s.points_earned += att.points || 0;
      if (att.is_correct) s.correct++;
    }
  }

  // Count distinct sessions
  const sessionsByUser = {};
  for (const sess of (sessions || [])) {
    if (!sessionsByUser[sess.user_id]) sessionsByUser[sess.user_id] = new Set();
    sessionsByUser[sess.user_id].add(sess.id);
  }
  for (const [uid, sessSet] of Object.entries(sessionsByUser)) {
    if (statsMap[uid]) statsMap[uid].sessions = sessSet.size;
  }

  // Filter to only users who had activity (or insert all if you want zeros too)
  const rowsToUpsert = Object.values(statsMap).filter(
    s => s.attempts > 0 || s.sessions > 0
  );

  if (rowsToUpsert.length === 0) {
    console.log(`[populate_daily_stats] No activity found for ${targetDate}`);
    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, date: targetDate, studentsProcessed: 0, note: 'No activity' })
    };
  }

  // Upsert in batches
  const batchSize = 100;
  let totalUpserted = 0;

  for (let i = 0; i < rowsToUpsert.length; i += batchSize) {
    const batch = rowsToUpsert.slice(i, i + batchSize);
    const { error: upsertErr } = await supabase
      .from('student_daily_stats')
      .upsert(batch, { onConflict: 'user_id,date' });

    if (upsertErr) {
      throw new Error(`Upsert failed at batch ${i}: ${upsertErr.message}`);
    }
    totalUpserted += batch.length;
  }

  console.log(`[populate_daily_stats] Upserted ${totalUpserted} rows for ${targetDate}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      date: targetDate,
      studentsProcessed: totalUpserted,
      method: 'direct'
    })
  };
}
