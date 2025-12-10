-- ============================================================
-- RLS for student_daily_stats
-- Run this in Supabase SQL Editor
-- Safe to re-run (drops existing policies first)
-- ============================================================

-- Enable RLS
ALTER TABLE public.student_daily_stats ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (makes script idempotent)
DROP POLICY IF EXISTS "student_daily_stats_select" ON public.student_daily_stats;
DROP POLICY IF EXISTS "student_daily_stats_insert_none" ON public.student_daily_stats;
DROP POLICY IF EXISTS "student_daily_stats_update_none" ON public.student_daily_stats;
DROP POLICY IF EXISTS "student_daily_stats_delete_none" ON public.student_daily_stats;

-- Students can read their own rows; teachers/admins can read any
CREATE POLICY "student_daily_stats_select" ON public.student_daily_stats
  FOR SELECT TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('teacher','admin')
    )
  );

-- Block client inserts/updates/deletes; service role only
CREATE POLICY "student_daily_stats_insert_none" ON public.student_daily_stats
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "student_daily_stats_update_none" ON public.student_daily_stats
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY "student_daily_stats_delete_none" ON public.student_daily_stats
  FOR DELETE TO authenticated USING (false);


-- ============================================================
-- IMPORTANT: Stars calculation is complex (requires parsing session JSON,
-- finding best stars per list+mode combo, then summing). The SQL below
-- sets stars_earned = 0 as a placeholder.
--
-- For accurate star calculation, use the Netlify function instead:
--   curl "https://YOUR-SITE.netlify.app/.netlify/functions/populate_daily_stats?date=2025-12-10"
--
-- Or run it for multiple dates by calling the function repeatedly.
-- ============================================================

-- Simple backfill (points/attempts/sessions only, stars = 0)
-- Use the Netlify function for accurate stars!
INSERT INTO public.student_daily_stats
  (user_id, date, class, stars_earned, points_earned, attempts, correct, sessions)
SELECT
  p.id AS user_id,
  (CURRENT_DATE - INTERVAL '1 day')::date AS date,
  p.class AS class,
  0 AS stars_earned,  -- Use Netlify function for accurate stars
  COALESCE(SUM(a.points), 0)::int AS points_earned,
  COUNT(a.id)::int AS attempts,
  COALESCE(SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END), 0)::int AS correct,
  COUNT(DISTINCT s.id)::int AS sessions
FROM profiles p
LEFT JOIN progress_attempts a
  ON a.user_id = p.id
  AND a.created_at >= (CURRENT_DATE - INTERVAL '1 day')
  AND a.created_at < CURRENT_DATE
LEFT JOIN progress_sessions s
  ON s.user_id = p.id
  AND s.started_at >= (CURRENT_DATE - INTERVAL '1 day')
  AND s.started_at < CURRENT_DATE
WHERE p.role = 'student' OR p.role IS NULL
GROUP BY p.id, p.class
ON CONFLICT (user_id, date)
DO UPDATE SET
  stars_earned = EXCLUDED.stars_earned,
  points_earned = EXCLUDED.points_earned,
  attempts = EXCLUDED.attempts,
  correct = EXCLUDED.correct,
  sessions = EXCLUDED.sessions;


-- ============================================================
-- Backfill multiple days at once (last 30 days example)
-- ============================================================

INSERT INTO public.student_daily_stats
  (user_id, date, class, stars_earned, points_earned, attempts, correct, sessions)
SELECT
  p.id AS user_id,
  d.day::date AS date,
  p.class AS class,
  0 AS stars_earned,
  COALESCE(SUM(a.points), 0)::int AS points_earned,
  COUNT(a.id)::int AS attempts,
  COALESCE(SUM(CASE WHEN a.is_correct THEN 1 ELSE 0 END), 0)::int AS correct,
  COUNT(DISTINCT s.id)::int AS sessions
FROM profiles p
CROSS JOIN generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  INTERVAL '1 day'
) AS d(day)
LEFT JOIN progress_attempts a
  ON a.user_id = p.id
  AND a.created_at >= d.day
  AND a.created_at < d.day + INTERVAL '1 day'
LEFT JOIN progress_sessions s
  ON s.user_id = p.id
  AND s.started_at >= d.day
  AND s.started_at < d.day + INTERVAL '1 day'
WHERE p.role = 'student' OR p.role IS NULL
GROUP BY p.id, p.class, d.day
ON CONFLICT (user_id, date)
DO UPDATE SET
  stars_earned = EXCLUDED.stars_earned,
  points_earned = EXCLUDED.points_earned,
  attempts = EXCLUDED.attempts,
  correct = EXCLUDED.correct,
  sessions = EXCLUDED.sessions;


-- ============================================================
-- Verify RLS is enabled
-- ============================================================
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'student_daily_stats';
