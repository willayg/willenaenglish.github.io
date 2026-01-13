-- =============================================
-- Talk the Talk - Supabase Schema
-- Speech practice session logging for students
-- =============================================

-- ─────────────────────────────────────────────
-- Table: talk_sessions
-- Stores each recording session with transcript and correction
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS talk_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Student reference (nullable for guest/anonymous usage)
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Session data
  transcript TEXT NOT NULL,
  corrected_sentence TEXT NOT NULL,
  teacher_note TEXT,
  
  -- Metadata
  audio_duration_seconds SMALLINT,          -- How long they spoke
  had_errors BOOLEAN DEFAULT false,         -- Was correction different from transcript?
  error_types TEXT[],                        -- Array: ['grammar', 'tense', 'plural', 'article', 'missing_word']
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Optional: device/session info for analytics
  user_agent TEXT,
  session_token TEXT                         -- Anonymous session tracking
);

-- Index for fast student lookups
CREATE INDEX IF NOT EXISTS idx_talk_sessions_student_id 
  ON talk_sessions(student_id);

-- Index for recent sessions
CREATE INDEX IF NOT EXISTS idx_talk_sessions_created_at 
  ON talk_sessions(created_at DESC);

-- Index for anonymous session tracking
CREATE INDEX IF NOT EXISTS idx_talk_sessions_session_token 
  ON talk_sessions(session_token) 
  WHERE session_token IS NOT NULL;


-- ─────────────────────────────────────────────
-- Table: talk_progress
-- Aggregated progress stats per student (updated periodically)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS talk_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Counts
  total_sessions INT DEFAULT 0,
  sessions_with_errors INT DEFAULT 0,
  sessions_perfect INT DEFAULT 0,
  
  -- Streaks
  current_streak INT DEFAULT 0,              -- Consecutive days practiced
  longest_streak INT DEFAULT 0,
  last_practice_date DATE,
  
  -- Error breakdown
  grammar_errors INT DEFAULT 0,
  tense_errors INT DEFAULT 0,
  plural_errors INT DEFAULT 0,
  article_errors INT DEFAULT 0,
  missing_word_errors INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(student_id)
);

-- Index for student lookup
CREATE INDEX IF NOT EXISTS idx_talk_progress_student_id 
  ON talk_progress(student_id);


-- ─────────────────────────────────────────────
-- Row Level Security (RLS)
-- ─────────────────────────────────────────────

-- Enable RLS on both tables
ALTER TABLE talk_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE talk_progress ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- RLS Policies: talk_sessions
-- ─────────────────────────────────────────────

-- Students can view their own sessions
CREATE POLICY "Students can view own sessions"
  ON talk_sessions
  FOR SELECT
  USING (
    auth.uid() = student_id
  );

-- Students can insert their own sessions
CREATE POLICY "Students can insert own sessions"
  ON talk_sessions
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id 
    OR student_id IS NULL  -- Allow anonymous sessions
  );

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access to sessions"
  ON talk_sessions
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Teachers can view all sessions (assuming teachers have a role claim)
CREATE POLICY "Teachers can view all sessions"
  ON talk_sessions
  FOR SELECT
  USING (
    auth.jwt() ->> 'user_role' = 'teacher'
  );


-- ─────────────────────────────────────────────
-- RLS Policies: talk_progress
-- ─────────────────────────────────────────────

-- Students can view their own progress
CREATE POLICY "Students can view own progress"
  ON talk_progress
  FOR SELECT
  USING (
    auth.uid() = student_id
  );

-- Students can insert their own progress row
CREATE POLICY "Students can insert own progress"
  ON talk_progress
  FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
  );

-- Students can update their own progress
CREATE POLICY "Students can update own progress"
  ON talk_progress
  FOR UPDATE
  USING (
    auth.uid() = student_id
  );

-- Service role can do everything
CREATE POLICY "Service role full access to progress"
  ON talk_progress
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Teachers can view all progress
CREATE POLICY "Teachers can view all progress"
  ON talk_progress
  FOR SELECT
  USING (
    auth.jwt() ->> 'user_role' = 'teacher'
  );


-- ─────────────────────────────────────────────
-- Function: Update progress after session insert
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_talk_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if student_id is set
  IF NEW.student_id IS NOT NULL THEN
    INSERT INTO talk_progress (student_id, total_sessions, sessions_with_errors, sessions_perfect)
    VALUES (
      NEW.student_id,
      1,
      CASE WHEN NEW.had_errors THEN 1 ELSE 0 END,
      CASE WHEN NOT NEW.had_errors THEN 1 ELSE 0 END
    )
    ON CONFLICT (student_id) DO UPDATE SET
      total_sessions = talk_progress.total_sessions + 1,
      sessions_with_errors = talk_progress.sessions_with_errors + CASE WHEN NEW.had_errors THEN 1 ELSE 0 END,
      sessions_perfect = talk_progress.sessions_perfect + CASE WHEN NOT NEW.had_errors THEN 1 ELSE 0 END,
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update progress
DROP TRIGGER IF EXISTS trigger_update_talk_progress ON talk_sessions;
CREATE TRIGGER trigger_update_talk_progress
  AFTER INSERT ON talk_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_talk_progress();


-- ─────────────────────────────────────────────
-- Sample queries (for reference)
-- ─────────────────────────────────────────────

-- Get student's recent sessions
-- SELECT * FROM talk_sessions 
-- WHERE student_id = 'uuid-here' 
-- ORDER BY created_at DESC 
-- LIMIT 10;

-- Get student's progress
-- SELECT * FROM talk_progress WHERE student_id = 'uuid-here';

-- Get all sessions for a teacher view
-- SELECT s.*, u.email as student_email
-- FROM talk_sessions s
-- LEFT JOIN auth.users u ON s.student_id = u.id
-- ORDER BY s.created_at DESC
-- LIMIT 50;
