-- ============================================================
-- Supabase Migration: Leaderboard RPC Functions
-- Deploy with: supabase db push  OR  run in Supabase SQL Editor
-- ============================================================

-- 1. Class Leaderboard (stars + points)
-- Called by progress_summary.js when USE_SQL_LEADERBOARD=1
CREATE OR REPLACE FUNCTION get_class_leaderboard_stars(
  p_class_name TEXT,
  p_timeframe TEXT DEFAULT 'all',
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar TEXT,
  class_name TEXT,
  total_points BIGINT,
  total_stars BIGINT,
  super_score BIGINT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start TIMESTAMPTZ;
BEGIN
  -- Determine time filter
  IF p_timeframe = 'month' THEN
    v_month_start := date_trunc('month', now());
  ELSE
    v_month_start := NULL;
  END IF;

  RETURN QUERY
  WITH class_students AS (
    -- Get approved students in the class (exclude single-letter test usernames)
    SELECT p.id, p.name, p.username, p.avatar
    FROM profiles p
    WHERE p.class = p_class_name
      AND p.role = 'student'
      AND p.approved = true
      AND (p.username IS NULL OR length(p.username) > 1)
  ),
  student_points AS (
    -- Sum points for each student (optionally filtered by month)
    SELECT pa.user_id, COALESCE(SUM(pa.points), 0)::BIGINT AS total_points
    FROM progress_attempts pa
    WHERE pa.user_id IN (SELECT id FROM class_students)
      AND pa.points IS NOT NULL
      AND (v_month_start IS NULL OR pa.created_at >= v_month_start)
    GROUP BY pa.user_id
  ),
  session_stars AS (
    -- Best stars per (user, list_name, mode) pair
    SELECT
      ps.user_id,
      ps.list_name,
      ps.mode,
      MAX(
        CASE
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 1 THEN 5
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.95 THEN 4
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.90 THEN 3
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.80 THEN 2
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.60 THEN 1
          ELSE 0
        END
      ) AS best_stars
    FROM progress_sessions ps
    WHERE ps.user_id IN (SELECT id FROM class_students)
      AND ps.ended_at IS NOT NULL
      AND ps.list_name IS NOT NULL
      AND ps.mode IS NOT NULL
      AND (v_month_start IS NULL OR ps.ended_at >= v_month_start)
    GROUP BY ps.user_id, ps.list_name, ps.mode
  ),
  student_stars AS (
    -- Total stars per student (sum of best stars across all list/mode pairs)
    SELECT ss.user_id, COALESCE(SUM(ss.best_stars), 0)::BIGINT AS total_stars
    FROM session_stars ss
    GROUP BY ss.user_id
  )
  SELECT
    cs.id AS user_id,
    COALESCE(cs.name, cs.username, 'Student')::TEXT AS name,
    cs.avatar::TEXT,
    p_class_name AS class_name,
    COALESCE(sp.total_points, 0)::BIGINT AS total_points,
    COALESCE(sst.total_stars, 0)::BIGINT AS total_stars,
    ROUND((COALESCE(sst.total_stars, 0) * COALESCE(sp.total_points, 0)) / 1000.0)::BIGINT AS super_score,
    ROW_NUMBER() OVER (ORDER BY COALESCE(sp.total_points, 0) DESC, COALESCE(cs.name, cs.username) ASC)::BIGINT AS rank
  FROM class_students cs
  LEFT JOIN student_points sp ON sp.user_id = cs.id
  LEFT JOIN student_stars sst ON sst.user_id = cs.id
  ORDER BY total_points DESC, name ASC;
END;
$$;


-- 2. Global Leaderboard (stars + points across all classes)
CREATE OR REPLACE FUNCTION get_global_leaderboard_stars(
  p_timeframe TEXT DEFAULT 'all',
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar TEXT,
  class_name TEXT,
  total_points BIGINT,
  total_stars BIGINT,
  super_score BIGINT,
  rank BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_month_start TIMESTAMPTZ;
BEGIN
  IF p_timeframe = 'month' THEN
    v_month_start := date_trunc('month', now());
  ELSE
    v_month_start := NULL;
  END IF;

  RETURN QUERY
  WITH all_students AS (
    SELECT p.id, p.name, p.username, p.avatar, p.class
    FROM profiles p
    WHERE p.role = 'student'
      AND p.approved = true
      AND (p.username IS NULL OR length(p.username) > 1)
  ),
  student_points AS (
    SELECT pa.user_id, COALESCE(SUM(pa.points), 0)::BIGINT AS total_points
    FROM progress_attempts pa
    WHERE pa.user_id IN (SELECT id FROM all_students)
      AND pa.points IS NOT NULL
      AND (v_month_start IS NULL OR pa.created_at >= v_month_start)
    GROUP BY pa.user_id
  ),
  session_stars AS (
    SELECT
      ps.user_id,
      ps.list_name,
      ps.mode,
      MAX(
        CASE
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 1 THEN 5
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.95 THEN 4
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.90 THEN 3
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.80 THEN 2
          WHEN (ps.summary->>'accuracy')::NUMERIC >= 0.60 THEN 1
          ELSE 0
        END
      ) AS best_stars
    FROM progress_sessions ps
    WHERE ps.user_id IN (SELECT id FROM all_students)
      AND ps.ended_at IS NOT NULL
      AND ps.list_name IS NOT NULL
      AND ps.mode IS NOT NULL
      AND (v_month_start IS NULL OR ps.ended_at >= v_month_start)
    GROUP BY ps.user_id, ps.list_name, ps.mode
  ),
  student_stars AS (
    SELECT ss.user_id, COALESCE(SUM(ss.best_stars), 0)::BIGINT AS total_stars
    FROM session_stars ss
    GROUP BY ss.user_id
  ),
  ranked AS (
    SELECT
      s.id AS user_id,
      COALESCE(s.name, s.username, 'Student')::TEXT AS name,
      s.avatar::TEXT,
      s.class::TEXT AS class_name,
      COALESCE(sp.total_points, 0)::BIGINT AS total_points,
      COALESCE(sst.total_stars, 0)::BIGINT AS total_stars,
      ROUND((COALESCE(sst.total_stars, 0) * COALESCE(sp.total_points, 0)) / 1000.0)::BIGINT AS super_score,
      ROW_NUMBER() OVER (ORDER BY COALESCE(sp.total_points, 0) DESC, COALESCE(s.name, s.username) ASC)::BIGINT AS rank
    FROM all_students s
    LEFT JOIN student_points sp ON sp.user_id = s.id
    LEFT JOIN student_stars sst ON sst.user_id = s.id
  )
  SELECT * FROM ranked
  WHERE rank <= p_limit
     OR user_id = p_user_id
  ORDER BY rank ASC;
END;
$$;


-- 3. (Optional) Grant execute permissions if using Row Level Security
-- GRANT EXECUTE ON FUNCTION get_class_leaderboard_stars TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_global_leaderboard_stars TO authenticated;

-- Done! After deploying, set USE_SQL_LEADERBOARD=1 in Netlify env vars.
