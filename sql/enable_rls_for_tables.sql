-- Enable RLS for tables that currently lack it
-- Run this in Supabase SQL Editor
-- NOTE: Service role key bypasses RLS, so Netlify functions will continue working

-- ============================================
-- 1. auth_password_audit
-- This is a security-sensitive audit log - very restrictive access
-- ============================================
ALTER TABLE public.auth_password_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit logs (via service key)
-- No direct user access - all access through service role
CREATE POLICY "auth_password_audit_admin_only" ON public.auth_password_audit
  FOR ALL USING (false);
-- Service role bypasses this, so Netlify functions can still read/write


-- ============================================
-- 2. class_visibility
-- Teachers need to read/write visibility settings for their classes
-- ============================================
ALTER TABLE public.class_visibility ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read class visibility (needed for UI)
CREATE POLICY "class_visibility_select_authenticated" ON public.class_visibility
  FOR SELECT TO authenticated USING (true);

-- Teachers/admins can update class visibility
CREATE POLICY "class_visibility_modify_teachers" ON public.class_visibility
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('teacher', 'admin')
    )
  );


-- ============================================
-- 3. homework_assignments
-- Teachers create, students in same class can view
-- ============================================
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;

-- Students can view assignments for their class
CREATE POLICY "homework_assignments_select_own_class" ON public.homework_assignments
  FOR SELECT TO authenticated USING (
    class = (SELECT class FROM profiles WHERE profiles.id = auth.uid())
    -- Enable Row-Level Security (RLS) for `student_daily_stats` only
    -- Run this in the Supabase SQL Editor
    -- NOTE: Service role key bypasses RLS, so server-side functions will continue working

    -- ============================================
    -- student_daily_stats (daily snapshots for leaderboards)
    -- ============================================
    ALTER TABLE public.student_daily_stats ENABLE ROW LEVEL SECURITY;

    -- Students can read their own daily rows; teachers/admins can read any
    CREATE POLICY "student_daily_stats_select" ON public.student_daily_stats
      FOR SELECT TO authenticated USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('teacher','admin')
        )
      );

    -- No client inserts/updates/deletes; service role only
    CREATE POLICY "student_daily_stats_insert_none" ON public.student_daily_stats
      FOR INSERT TO authenticated WITH CHECK (false);

    CREATE POLICY "student_daily_stats_update_none" ON public.student_daily_stats
      FOR UPDATE TO authenticated USING (false);

    CREATE POLICY "student_daily_stats_delete_none" ON public.student_daily_stats
      FOR DELETE TO authenticated USING (false);

    -- Verification: confirm RLS is enabled for the table
    SELECT tablename, rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'student_daily_stats';
    )
