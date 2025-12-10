-- ============================================================
-- Supabase Migration: Row Level Security (RLS) policies
-- Created: 2025-12-10
-- Purpose: Enable RLS and add sensible policies for tables
-- visible in the screenshots (profiles, progress_*, images, game_* etc.)
-- Deploy with: `supabase db push` or run in Supabase SQL Editor
-- ============================================================

-- NOTE: service_role (server key) bypasses RLS. Policies below are
-- written for JWT-authenticated users (use `auth.uid()` where appropriate).

-- === profiles ===
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles: select own or approved students" ON public.profiles;
CREATE POLICY "Profiles: select own or approved students"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR (role = 'student' AND approved = true)
  );

DROP POLICY IF EXISTS "Profiles: insert if owner" ON public.profiles;
CREATE POLICY "Profiles: insert if owner"
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Profiles: update own" ON public.profiles;
CREATE POLICY "Profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No delete policy: only service role / DB admins should delete profiles.

-- === progress_attempts ===
ALTER TABLE IF EXISTS public.progress_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ProgressAttempts: insert own" ON public.progress_attempts;
CREATE POLICY "ProgressAttempts: insert own"
  ON public.progress_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ProgressAttempts: select own" ON public.progress_attempts;
CREATE POLICY "ProgressAttempts: select own"
  ON public.progress_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- === progress_sessions ===
ALTER TABLE IF EXISTS public.progress_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ProgressSessions: insert own" ON public.progress_sessions;
CREATE POLICY "ProgressSessions: insert own"
  ON public.progress_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ProgressSessions: select own" ON public.progress_sessions;
CREATE POLICY "ProgressSessions: select own"
  ON public.progress_sessions FOR SELECT
  USING (auth.uid() = user_id);

-- === user_daily_plays ===
ALTER TABLE IF EXISTS public.user_daily_plays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "UserDailyPlays: insert own" ON public.user_daily_plays;
CREATE POLICY "UserDailyPlays: insert own"
  ON public.user_daily_plays FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "UserDailyPlays: select own" ON public.user_daily_plays;
CREATE POLICY "UserDailyPlays: select own"
  ON public.user_daily_plays FOR SELECT
  USING (auth.uid() = user_id);

-- === timer_scores ===
ALTER TABLE IF EXISTS public.timer_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TimerScores: insert own" ON public.timer_scores;
CREATE POLICY "TimerScores: insert own"
  ON public.timer_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "TimerScores: select own" ON public.timer_scores;
CREATE POLICY "TimerScores: select own"
  ON public.timer_scores FOR SELECT
  USING (auth.uid() = user_id);

-- === tests ===
ALTER TABLE IF EXISTS public.tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tests: insert own" ON public.tests;
CREATE POLICY "Tests: insert own"
  ON public.tests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tests: select own" ON public.tests;
CREATE POLICY "Tests: select own"
  ON public.tests FOR SELECT
  USING (auth.uid() = user_id);

-- === images and game_images (metadata) ===
ALTER TABLE IF EXISTS public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.game_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Images: select public" ON public.images;
CREATE POLICY "Images: select public" ON public.images FOR SELECT USING (true);

DROP POLICY IF EXISTS "GameImages: select public" ON public.game_images;
CREATE POLICY "GameImages: select public" ON public.game_images FOR SELECT USING (true);

DROP POLICY IF EXISTS "Images: insert authenticated" ON public.images;
CREATE POLICY "Images: insert authenticated" ON public.images FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (uploader_id IS NULL OR uploader_id = auth.uid())
  );

DROP POLICY IF EXISTS "GameImages: insert authenticated" ON public.game_images;
CREATE POLICY "GameImages: insert authenticated" ON public.game_images FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (uploader_id IS NULL OR uploader_id = auth.uid())
  );

-- === game_data, live_games ===
ALTER TABLE IF EXISTS public.game_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.live_games ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LiveGames: select authenticated" ON public.live_games;
CREATE POLICY "LiveGames: select authenticated" ON public.live_games FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "LiveGames: insert creator" ON public.live_games;
CREATE POLICY "LiveGames: insert creator" ON public.live_games FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (creator_id IS NULL OR creator_id = auth.uid()));

DROP POLICY IF EXISTS "GameData: select own" ON public.game_data;
CREATE POLICY "GameData: select own" ON public.game_data FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "GameData: insert own" ON public.game_data;
CREATE POLICY "GameData: insert own" ON public.game_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- === leaderboard_cache (readable publicly) ===
ALTER TABLE IF EXISTS public.leaderboard_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "LeaderboardCache: select public" ON public.leaderboard_cache;
CREATE POLICY "LeaderboardCache: select public" ON public.leaderboard_cache FOR SELECT USING (true);

-- === worksheets, sentences, word_sentences ===
ALTER TABLE IF EXISTS public.worksheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sentences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.word_sentences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Worksheets: select public" ON public.worksheets;
CREATE POLICY "Worksheets: select public" ON public.worksheets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sentences: select public" ON public.sentences;
CREATE POLICY "Sentences: select public" ON public.sentences FOR SELECT USING (true);

DROP POLICY IF EXISTS "WordSentences: select public" ON public.word_sentences;
CREATE POLICY "WordSentences: select public" ON public.word_sentences FOR SELECT USING (true);

-- === users (aux table if present) ===
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users: select own" ON public.users;
CREATE POLICY "Users: select own" ON public.users FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "Users: insert own" ON public.users;
CREATE POLICY "Users: insert own" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- End of RLS policies migration
-- Instructions:
-- 1) Review the policies above and adjust the USING / WITH CHECK logic to fit
--    your application's authorship or teacher/admin access rules.
-- 2) Deploy via `supabase db push` or paste this SQL into the Supabase SQL Editor
-- 3) Test with the client using a non-service JWT (the `authenticated` key)
-- ============================================================
