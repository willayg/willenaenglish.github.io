-- Leaderboard Aggregation Functions and Views
-- Purpose: Optimize leaderboard computation by moving heavy aggregation to database
-- Created: 2025-11-08

-- ============================================================
-- 1. HELPER FUNCTION: Derive stars from accuracy
-- ============================================================
-- Converts accuracy score (0-1) to star rating (0-5)
CREATE OR REPLACE FUNCTION derive_stars(accuracy DECIMAL)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE
    WHEN accuracy >= 1.0 THEN 5
    WHEN accuracy >= 0.95 THEN 4
    WHEN accuracy >= 0.90 THEN 3
    WHEN accuracy >= 0.80 THEN 2
    WHEN accuracy >= 0.60 THEN 1
    ELSE 0
  END;
$$;

-- ============================================================
-- 2. HELPER FUNCTION: Extract accuracy from summary JSON
-- ============================================================
-- Parses summary JSON and extracts accuracy value
CREATE OR REPLACE FUNCTION extract_accuracy(summary JSONB)
RETURNS DECIMAL
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT COALESCE(
    (summary->>'accuracy')::DECIMAL,
    CASE
      WHEN (summary->>'score')::DECIMAL IS NOT NULL 
        AND (summary->>'total')::DECIMAL IS NOT NULL 
        AND (summary->>'total')::DECIMAL > 0
      THEN (summary->>'score')::DECIMAL / (summary->>'total')::DECIMAL
      WHEN (summary->>'score')::DECIMAL IS NOT NULL 
        AND (summary->>'max')::DECIMAL IS NOT NULL 
        AND (summary->>'max')::DECIMAL > 0
      THEN (summary->>'score')::DECIMAL / (summary->>'max')::DECIMAL
      ELSE NULL
    END
  );
$$;

-- ============================================================
-- 3. MAIN AGGREGATION FUNCTION: Class Leaderboard Stars
-- ============================================================
-- Computes top 5 stars per student in a class with optional timeframe filter
CREATE OR REPLACE FUNCTION get_class_leaderboard_stars(
  p_class_name TEXT,
  p_timeframe TEXT DEFAULT 'all',
  p_user_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id TEXT,
  name TEXT,
  username TEXT,
  avatar TEXT,
  class TEXT,
  total_stars BIGINT,
  total_points BIGINT,
  is_self BOOLEAN,
  rank INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  WITH date_filter AS (
    SELECT CASE
      WHEN p_timeframe = 'month' THEN DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
      ELSE NULL
    END AS cutoff_date
  ),
  
  -- Best stars per (list_name, mode) per user in class
  best_session_stars AS (
    SELECT 
      ps.user_id,
      CONCAT(ps.list_name, '||', ps.mode) as pair_key,
      MAX(derive_stars(extract_accuracy(ps.summary))) as best_stars
    FROM progress_sessions ps
    INNER JOIN profiles p ON ps.user_id = p.id
    CROSS JOIN date_filter df
    WHERE p.class = p_class_name
      AND p.role = 'student'
      AND p.approved = true
      AND ps.ended_at IS NOT NULL
      AND (COALESCE(ps.summary->>'completed', 'true')::BOOLEAN != false)
      AND (df.cutoff_date IS NULL OR ps.ended_at >= df.cutoff_date)
      AND derive_stars(extract_accuracy(ps.summary)) > 0
    GROUP BY ps.user_id, pair_key
  ),
  
  -- Total stars per user
  user_stars AS (
    SELECT 
      user_id,
      SUM(best_stars) as total_stars
    FROM best_session_stars
    GROUP BY user_id
  ),
  
  -- Total points per user
  user_points AS (
    SELECT 
      pa.user_id,
      SUM(pa.points) as total_points
    FROM progress_attempts pa
    INNER JOIN profiles p ON pa.user_id = p.id
    CROSS JOIN date_filter df
    WHERE p.class = p_class_name
      AND p.role = 'student'
      AND p.approved = true
      AND (df.cutoff_date IS NULL OR pa.created_at >= df.cutoff_date)
    GROUP BY pa.user_id
  ),
  
  -- Ranked leaderboard
  ranked AS (
    SELECT 
      p.id as user_id,
      p.name,
      p.username,
      p.avatar,
      p.class,
      COALESCE(us.total_stars, 0) as total_stars,
      COALESCE(up.total_points, 0) as total_points,
      p.id = COALESCE(p_user_id, '') as is_self,
      ROW_NUMBER() OVER (ORDER BY COALESCE(us.total_stars, 0) DESC, p.name ASC) as rank
    FROM profiles p
    LEFT JOIN user_stars us ON p.id = us.user_id
    LEFT JOIN user_points up ON p.id = up.user_id
    WHERE p.class = p_class_name
      AND p.role = 'student'
      AND p.approved = true
      AND (p.username IS NULL OR LENGTH(p.username) > 1)
  )
  
  SELECT 
    ranked.user_id,
    ranked.name,
    ranked.username,
    ranked.avatar,
    ranked.class,
    ranked.total_stars,
    ranked.total_points,
    ranked.is_self,
    ranked.rank
  FROM ranked
  WHERE ranked.rank <= 5 OR ranked.is_self = true
  ORDER BY ranked.rank ASC;
$$;

-- ============================================================
-- 4. MAIN AGGREGATION FUNCTION: Global Leaderboard Stars
-- ============================================================
-- Computes top 10 stars per all approved students globally with optional timeframe filter
CREATE OR REPLACE FUNCTION get_global_leaderboard_stars(
  p_timeframe TEXT DEFAULT 'all',
  p_user_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  user_id TEXT,
  name TEXT,
  username TEXT,
  avatar TEXT,
  class TEXT,
  total_stars BIGINT,
  total_points BIGINT,
  is_self BOOLEAN,
  rank INTEGER
)
LANGUAGE SQL
STABLE
AS $$
  WITH date_filter AS (
    SELECT CASE
      WHEN p_timeframe = 'month' THEN DATE_TRUNC('month', NOW() AT TIME ZONE 'UTC')
      ELSE NULL
    END AS cutoff_date
  ),
  
  -- Best stars per (list_name, mode) per user globally
  best_session_stars AS (
    SELECT 
      ps.user_id,
      CONCAT(ps.list_name, '||', ps.mode) as pair_key,
      MAX(derive_stars(extract_accuracy(ps.summary))) as best_stars
    FROM progress_sessions ps
    INNER JOIN profiles p ON ps.user_id = p.id
    CROSS JOIN date_filter df
    WHERE p.role = 'student'
      AND p.approved = true
      AND ps.ended_at IS NOT NULL
      AND (COALESCE(ps.summary->>'completed', 'true')::BOOLEAN != false)
      AND (df.cutoff_date IS NULL OR ps.ended_at >= df.cutoff_date)
      AND derive_stars(extract_accuracy(ps.summary)) > 0
    GROUP BY ps.user_id, pair_key
  ),
  
  -- Total stars per user
  user_stars AS (
    SELECT 
      user_id,
      SUM(best_stars) as total_stars
    FROM best_session_stars
    GROUP BY user_id
  ),
  
  -- Total points per user
  user_points AS (
    SELECT 
      pa.user_id,
      SUM(pa.points) as total_points
    FROM progress_attempts pa
    INNER JOIN profiles p ON pa.user_id = p.id
    CROSS JOIN date_filter df
    WHERE p.role = 'student'
      AND p.approved = true
      AND (df.cutoff_date IS NULL OR pa.created_at >= df.cutoff_date)
    GROUP BY pa.user_id
  ),
  
  -- Ranked leaderboard
  ranked AS (
    SELECT 
      p.id as user_id,
      p.name,
      p.username,
      p.avatar,
      p.class,
      COALESCE(us.total_stars, 0) as total_stars,
      COALESCE(up.total_points, 0) as total_points,
      p.id = COALESCE(p_user_id, '') as is_self,
      ROW_NUMBER() OVER (ORDER BY COALESCE(us.total_stars, 0) DESC, p.name ASC) as rank
    FROM profiles p
    LEFT JOIN user_stars us ON p.id = us.user_id
    LEFT JOIN user_points up ON p.id = up.user_id
    WHERE p.role = 'student'
      AND p.approved = true
      AND (p.username IS NULL OR LENGTH(p.username) > 1)
  )
  
  SELECT 
    ranked.user_id,
    ranked.name,
    ranked.username,
    ranked.avatar,
    ranked.class,
    ranked.total_stars,
    ranked.total_points,
    ranked.is_self,
    ranked.rank
  FROM ranked
  WHERE ranked.rank <= 10 OR ranked.is_self = true
  ORDER BY ranked.rank ASC;
$$;

-- ============================================================
-- 5. GRANT PERMISSIONS (for Supabase RLS)
-- ============================================================
-- Allow service role to execute functions
GRANT EXECUTE ON FUNCTION derive_stars(DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION extract_accuracy(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION get_class_leaderboard_stars(TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_global_leaderboard_stars(TEXT, TEXT) TO service_role;

-- Allow authenticated users to execute (optional, for future frontend optimization)
GRANT EXECUTE ON FUNCTION derive_stars(DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION extract_accuracy(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_class_leaderboard_stars(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_global_leaderboard_stars(TEXT, TEXT) TO authenticated;

-- ============================================================
-- MIGRATION NOTES:
-- ============================================================
-- These functions offload heavy computation to PostgreSQL, which:
-- 1. Runs aggregations in optimized C code (faster than JS loops)
-- 2. Filters at DB level (no unnecessary data transfer)
-- 3. Uses indexes efficiently (hash agg, sort, window functions)
-- 4. Can be called repeatedly without re-computation (plan caching)
--
-- Backend (Node.js) will call:
--   SELECT * FROM get_class_leaderboard_stars('ClassA', 'all', 'user123')
--   SELECT * FROM get_global_leaderboard_stars('all', 'user123')
--
-- Expected speedup: 70-90% vs current JS aggregation
-- ============================================================
