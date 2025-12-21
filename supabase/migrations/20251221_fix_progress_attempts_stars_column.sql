-- 2025-12-21: Ensure progress_attempts has a stars column
-- The Cloudflare progress-summary worker no longer relies on this column
-- for calculations (stars are derived from progress_sessions.summary),
-- but some existing database objects on the Supabase side still reference
-- progress_attempts.stars. When the column is missing, Supabase REST/RPC
-- queries can fail with:
--   code 42703: column progress_attempts.stars does not exist
--
-- To make the schema tolerant and avoid breaking queries, we reintroduce
-- a simple integer column if it is missing. It defaults to 0 and is not
-- used by current application code.

ALTER TABLE IF EXISTS public.progress_attempts
  ADD COLUMN IF NOT EXISTS stars INTEGER DEFAULT 0;
