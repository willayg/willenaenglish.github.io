-- Make a Sentence: one new five-question session per student per Korean day.
-- AI Willi/Luna checks: one reservation and immutable result per question.
ALTER TABLE public.writing_genius_sentence_sessions
 ADD COLUMN IF NOT EXISTS practice_day date NOT NULL
 DEFAULT ((now() AT TIME ZONE 'Asia/Seoul')::date);
UPDATE public.writing_genius_sentence_sessions
 SET practice_day=(created_at AT TIME ZONE 'Asia/Seoul')::date
 WHERE practice_day IS DISTINCT FROM (created_at AT TIME ZONE 'Asia/Seoul')::date;
CREATE UNIQUE INDEX IF NOT EXISTS wg_sentence_one_make_session_per_kst_day
 ON public.writing_genius_sentence_sessions(student_id,practice_day)
 WHERE exercise_type='make';
DROP POLICY IF EXISTS wg_sentence_session_owner_insert ON public.writing_genius_sentence_sessions;
CREATE POLICY wg_sentence_session_owner_insert
 ON public.writing_genius_sentence_sessions FOR INSERT TO authenticated
 WITH CHECK (
  student_id=(SELECT auth.uid()) AND exercise_type='make'
  AND practice_day=(now() AT TIME ZONE 'Asia/Seoul')::date
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
   AND p.role='student' AND p.approved IS TRUE)
 );
CREATE OR REPLACE FUNCTION public.wg_sentence_session_touch_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp'
AS $fn$
BEGIN
 IF ROW(NEW.student_id,NEW.exercise_type,NEW.book_id,NEW.book_title,
        NEW.unit_id,NEW.practice_day,NEW.questions,NEW.created_at)
  IS DISTINCT FROM
    ROW(OLD.student_id,OLD.exercise_type,OLD.book_id,OLD.book_title,
        OLD.unit_id,OLD.practice_day,OLD.questions,OLD.created_at)
  THEN RAISE EXCEPTION 'Session identity and daily quota cannot be changed'; END IF;
 IF NEW.current_index<OLD.current_index OR NEW.current_index>OLD.current_index+1
  THEN RAISE EXCEPTION 'Invalid question progression'; END IF;
 IF OLD.status='completed' AND
   (NEW.status IS DISTINCT FROM OLD.status OR NEW.responses IS DISTINCT FROM OLD.responses)
  THEN RAISE EXCEPTION 'Completed practice is final'; END IF;
 IF NEW.status='completed' AND NEW.current_index<>5
  THEN RAISE EXCEPTION 'Five questions required'; END IF;
 IF OLD.status IS DISTINCT FROM 'completed' AND NEW.status='completed'
  THEN NEW.completed_at=now(); END IF;
 NEW.updated_at=now();
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_session_touch_v1() FROM PUBLIC,anon,authenticated;

CREATE TABLE IF NOT EXISTS public.writing_genius_sentence_checks (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES public.writing_genius_sentence_sessions(id) ON DELETE CASCADE,
 student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 question_index smallint NOT NULL CHECK(question_index BETWEEN 0 AND 4),
 answer_text text NOT NULL CHECK(char_length(answer_text) BETWEEN 3 AND 600),
 feedback jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 UNIQUE(session_id,question_index)
);
CREATE INDEX IF NOT EXISTS wg_sentence_checks_student_idx
 ON public.writing_genius_sentence_checks(student_id,created_at DESC);
ALTER TABLE public.writing_genius_sentence_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.writing_genius_sentence_checks FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.writing_genius_sentence_checks TO authenticated;
DROP POLICY IF EXISTS wg_sentence_checks_read ON public.writing_genius_sentence_checks;
CREATE POLICY wg_sentence_checks_read ON public.writing_genius_sentence_checks
 FOR SELECT TO authenticated USING(student_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS wg_sentence_checks_insert ON public.writing_genius_sentence_checks;
CREATE POLICY wg_sentence_checks_insert ON public.writing_genius_sentence_checks
 FOR INSERT TO authenticated WITH CHECK(student_id=(SELECT auth.uid()) AND EXISTS(
  SELECT 1 FROM public.writing_genius_sentence_sessions s WHERE s.id=session_id
   AND s.student_id=(SELECT auth.uid()) AND s.exercise_type='make'
   AND s.status='in_progress' AND s.current_index=question_index
 ));
DROP POLICY IF EXISTS wg_sentence_checks_update ON public.writing_genius_sentence_checks;
CREATE POLICY wg_sentence_checks_update ON public.writing_genius_sentence_checks
 FOR UPDATE TO authenticated USING(student_id=(SELECT auth.uid()))
 WITH CHECK(student_id=(SELECT auth.uid()));
DROP POLICY IF EXISTS wg_sentence_checks_delete ON public.writing_genius_sentence_checks;
CREATE POLICY wg_sentence_checks_delete ON public.writing_genius_sentence_checks
 FOR DELETE TO authenticated USING(
  student_id=(SELECT auth.uid()) AND feedback IS NULL
  AND created_at<now()-interval '45 seconds');
CREATE OR REPLACE FUNCTION public.wg_sentence_check_lock_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
 IF TG_OP='INSERT' THEN
  IF NEW.feedback IS NOT NULL OR NEW.completed_at IS NOT NULL
   THEN RAISE EXCEPTION 'Only pending checks can be reserved'; END IF;
  RETURN NEW;
 ELSIF TG_OP='UPDATE' THEN
  IF OLD.feedback IS NOT NULL OR OLD.completed_at IS NOT NULL
   THEN RAISE EXCEPTION 'Finished AI grade is immutable'; END IF;
  IF ROW(NEW.session_id,NEW.student_id,NEW.question_index,NEW.answer_text,NEW.created_at)
   IS DISTINCT FROM
     ROW(OLD.session_id,OLD.student_id,OLD.question_index,OLD.answer_text,OLD.created_at)
   THEN RAISE EXCEPTION 'AI reservation cannot be reassigned'; END IF;
  IF NEW.feedback IS NULL OR jsonb_typeof(NEW.feedback)<>'object'
    OR COALESCE(NEW.feedback->>'grade','') NOT IN ('correct','almost','needs_work')
    OR NEW.completed_at IS NULL THEN RAISE EXCEPTION 'Invalid AI feedback'; END IF;
  IF COALESCE(NEW.feedback->>'checked_text','') IS DISTINCT FROM OLD.answer_text
   THEN RAISE EXCEPTION 'AI feedback answer mismatch'; END IF;
  RETURN NEW;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_check_lock_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS wg_sentence_check_lock ON public.writing_genius_sentence_checks;
CREATE TRIGGER wg_sentence_check_lock BEFORE INSERT OR UPDATE
 ON public.writing_genius_sentence_checks FOR EACH ROW
 EXECUTE FUNCTION public.wg_sentence_check_lock_v1();
NOTIFY pgrst,'reload schema';
