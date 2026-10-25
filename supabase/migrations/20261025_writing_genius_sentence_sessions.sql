-- Writing Genius Sentence Practice, 2026-10-25.
-- Authentic textbook prompts and students' own revisions. No AI charges.
CREATE TABLE IF NOT EXISTS public.writing_genius_sentence_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 exercise_type text NOT NULL CHECK(exercise_type IN ('make','expand','answer','connect')),
 book_id text NOT NULL,
 book_title text NOT NULL DEFAULT '',
 unit_id text,
 questions jsonb NOT NULL CHECK(jsonb_typeof(questions)='array' AND jsonb_array_length(questions)=5),
 responses jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(responses)='array' AND jsonb_array_length(responses)<=5),
 current_index smallint NOT NULL DEFAULT 0 CHECK(current_index BETWEEN 0 AND 5),
 status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','completed')),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 CHECK(char_length(book_title)<=150),
 CHECK(char_length(questions::text)<=20000),
 CHECK(char_length(responses::text)<=16000),
 CHECK(status<>'completed' OR current_index=5)
);
CREATE INDEX IF NOT EXISTS wg_sentence_sessions_student_updated ON
 public.writing_genius_sentence_sessions(student_id,updated_at DESC);
ALTER TABLE public.writing_genius_sentence_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.writing_genius_sentence_sessions FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.writing_genius_sentence_sessions TO authenticated;
DROP POLICY IF EXISTS wg_sentence_session_owner_read ON public.writing_genius_sentence_sessions;
CREATE POLICY wg_sentence_session_owner_read ON public.writing_genius_sentence_sessions
 FOR SELECT TO authenticated USING (student_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS wg_sentence_session_owner_insert ON public.writing_genius_sentence_sessions;
CREATE POLICY wg_sentence_session_owner_insert ON public.writing_genius_sentence_sessions
 FOR INSERT TO authenticated WITH CHECK(
 student_id=(SELECT auth.uid()) AND EXISTS(
  SELECT 1 FROM public.profiles p
  WHERE p.id=(SELECT auth.uid()) AND p.role='student' AND p.approved IS TRUE
 ));
DROP POLICY IF EXISTS wg_sentence_session_owner_update ON public.writing_genius_sentence_sessions;
CREATE POLICY wg_sentence_session_owner_update ON public.writing_genius_sentence_sessions
 FOR UPDATE TO authenticated USING (student_id=(SELECT auth.uid()))
 WITH CHECK(
  student_id=(SELECT auth.uid()) AND EXISTS(
   SELECT 1 FROM public.profiles p
   WHERE p.id=(SELECT auth.uid()) AND p.role='student' AND p.approved IS TRUE
  ));
CREATE OR REPLACE FUNCTION public.wg_sentence_session_touch_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
 NEW.updated_at=now();
 IF NEW.status='completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
   NEW.completed_at=now();
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_session_touch_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS wg_sentence_session_touch ON public.writing_genius_sentence_sessions;
CREATE TRIGGER wg_sentence_session_touch BEFORE UPDATE ON public.writing_genius_sentence_sessions
 FOR EACH ROW EXECUTE FUNCTION public.wg_sentence_session_touch_v1();
NOTIFY pgrst, 'reload schema';
