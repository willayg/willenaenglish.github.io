-- Writing Genius: 10 questions, retries (up to 10/question), no daily session cap,
-- canonical textbook DB first, Luna-accepted variations and first-try stars.
-- Preserve all existing 5-question records and previously earned unit gold.
BEGIN;
ALTER TABLE public.writing_genius_sentence_sessions
 DROP CONSTRAINT IF EXISTS writing_genius_sentence_sessions_questions_check,
 DROP CONSTRAINT IF EXISTS writing_genius_sentence_sessions_responses_check,
 DROP CONSTRAINT IF EXISTS writing_genius_sentence_sessions_current_index_check,
 DROP CONSTRAINT IF EXISTS wg_sentence_questions_5_or_10,
 DROP CONSTRAINT IF EXISTS wg_sentence_responses_up_to_10,
 DROP CONSTRAINT IF EXISTS wg_sentence_index_up_to_10,
 DROP CONSTRAINT IF EXISTS wg_sentence_finished_at_end;
ALTER TABLE public.writing_genius_sentence_sessions
 ADD CONSTRAINT wg_sentence_questions_5_or_10 CHECK (jsonb_typeof(questions)='array' AND jsonb_array_length(questions) IN (5,10)),
 ADD CONSTRAINT wg_sentence_responses_up_to_10 CHECK (jsonb_typeof(responses)='array' AND jsonb_array_length(responses)<=10),
 ADD CONSTRAINT wg_sentence_index_up_to_10 CHECK (current_index BETWEEN 0 AND jsonb_array_length(questions)),
 ADD CONSTRAINT wg_sentence_finished_at_end CHECK (status<>'completed' OR current_index=jsonb_array_length(questions));
DROP INDEX IF EXISTS public.wg_sentence_one_make_session_per_kst_day;
ALTER TABLE public.writing_genius_sentence_checks ADD COLUMN IF NOT EXISTS attempt_no smallint NOT NULL DEFAULT 1;
ALTER TABLE public.writing_genius_sentence_checks
 DROP CONSTRAINT IF EXISTS writing_genius_sentence_checks_question_index_check,
 DROP CONSTRAINT IF EXISTS writing_genius_sentence_checks_session_id_question_index_key,
 DROP CONSTRAINT IF EXISTS wg_sentence_question_index_ten,
 DROP CONSTRAINT IF EXISTS wg_sentence_attempt_one_to_ten,
 DROP CONSTRAINT IF EXISTS wg_sentence_check_unique_attempt;
ALTER TABLE public.writing_genius_sentence_checks
 ADD CONSTRAINT wg_sentence_question_index_ten CHECK(question_index BETWEEN 0 AND 9),
 ADD CONSTRAINT wg_sentence_attempt_one_to_ten CHECK(attempt_no BETWEEN 1 AND 10),
 ADD CONSTRAINT wg_sentence_check_unique_attempt UNIQUE(session_id,question_index,attempt_no);
CREATE INDEX IF NOT EXISTS wg_sentence_checks_order
 ON public.writing_genius_sentence_checks(session_id,question_index,attempt_no);
DROP POLICY IF EXISTS wg_sentence_session_owner_insert ON public.writing_genius_sentence_sessions;
CREATE POLICY wg_sentence_session_owner_insert ON public.writing_genius_sentence_sessions FOR INSERT TO authenticated
 WITH CHECK (student_id=(SELECT auth.uid()) AND exercise_type='make'
  AND practice_day=(now() AT TIME ZONE 'Asia/Seoul')::date
  AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
   AND p.role='student' AND p.approved IS TRUE));
DROP POLICY IF EXISTS wg_sentence_checks_insert ON public.writing_genius_sentence_checks;
CREATE POLICY wg_sentence_checks_insert ON public.writing_genius_sentence_checks FOR INSERT TO authenticated
 WITH CHECK(student_id=auth.uid() AND EXISTS(
  SELECT 1 FROM public.writing_genius_sentence_sessions s
  WHERE s.id=session_id AND s.student_id=auth.uid()
   AND s.exercise_type='make' AND s.status='in_progress'
   AND s.current_index=question_index AND question_index<jsonb_array_length(s.questions)));
CREATE TABLE IF NOT EXISTS public.writing_genius_sentence_variants(
 source_sentence_id uuid NOT NULL,normalized_answer text NOT NULL,answer_text text NOT NULL,
 first_seen_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(source_sentence_id,normalized_answer),
 CHECK(char_length(normalized_answer) BETWEEN 3 AND 200),
 CHECK(char_length(answer_text) BETWEEN 3 AND 250)
);
ALTER TABLE public.writing_genius_sentence_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.writing_genius_sentence_variants FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.writing_genius_sentence_variants TO authenticated;
DROP POLICY IF EXISTS wg_variants_read ON public.writing_genius_sentence_variants;
CREATE POLICY wg_variants_read ON public.writing_genius_sentence_variants FOR SELECT TO authenticated USING(true);
CREATE OR REPLACE FUNCTION public.wg_sentence_session_touch_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp'
AS $fn$
BEGIN
 IF ROW(NEW.student_id,NEW.exercise_type,NEW.book_id,NEW.book_title,
        NEW.unit_id,NEW.practice_day,NEW.questions,NEW.created_at)
 IS DISTINCT FROM
    ROW(OLD.student_id,OLD.exercise_type,OLD.book_id,OLD.book_title,
        OLD.unit_id,OLD.practice_day,OLD.questions,OLD.created_at)
 THEN RAISE EXCEPTION 'Session identity and prompts cannot change'; END IF;
 IF NEW.current_index<OLD.current_index OR NEW.current_index>OLD.current_index+1
 THEN RAISE EXCEPTION 'Invalid question progression'; END IF;
 IF OLD.status='completed' AND
    (NEW.status IS DISTINCT FROM OLD.status OR NEW.responses IS DISTINCT FROM OLD.responses)
 THEN RAISE EXCEPTION 'Completed practice is final'; END IF;
 IF NEW.status='completed' AND NEW.current_index<>jsonb_array_length(NEW.questions)
 THEN RAISE EXCEPTION 'All questions must be completed'; END IF;
 IF OLD.status IS DISTINCT FROM 'completed' AND NEW.status='completed'
 THEN NEW.completed_at=now(); END IF;
 NEW.updated_at=now();
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_session_touch_v1() FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.wg_sentence_variant_capture_v1()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','pg_temp' AS $fn$
DECLARE question jsonb; model text; canonical text; norm text; model_norm text;
BEGIN
 IF NEW.feedback IS NULL OR NEW.feedback->>'grade'<>'correct'
  OR NEW.feedback->>'source'<>'luna' OR OLD.feedback IS NOT NULL THEN RETURN NEW; END IF;
 SELECT s.questions->NEW.question_index INTO question
 FROM public.writing_genius_sentence_sessions s WHERE s.id=NEW.session_id;
 IF question IS NULL OR coalesce(question->'sourceIds'->>0,'') !~ '^[a-f0-9-]{36}$'
 THEN RETURN NEW; END IF;
 canonical:=btrim(NEW.answer_text);model:=coalesce(question->>'model','');
 norm:=btrim(regexp_replace(lower(replace(replace(canonical,'’',''''),'‘','''')),
                         '[^a-z0-9'']+',' ','g'));
 model_norm:=btrim(regexp_replace(lower(replace(replace(model,'’',''''),'‘','''')),
                         '[^a-z0-9'']+',' ','g'));
 IF length(norm)<3 OR length(norm)>200 OR norm=model_norm THEN RETURN NEW; END IF;
 INSERT INTO public.writing_genius_sentence_variants(source_sentence_id,normalized_answer,answer_text)
 VALUES ((question->'sourceIds'->>0)::uuid,norm,left(canonical,250)) ON CONFLICT DO NOTHING;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_variant_capture_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS wg_sentence_variant_capture ON public.writing_genius_sentence_checks;
CREATE TRIGGER wg_sentence_variant_capture AFTER UPDATE OF feedback ON public.writing_genius_sentence_checks
 FOR EACH ROW EXECUTE FUNCTION public.wg_sentence_variant_capture_v1();
CREATE OR REPLACE FUNCTION public.wg_sentence_unit_rewards_v1()
RETURNS TABLE(book_id text,unit_id text,best_percent integer,best_stars integer,golden boolean,completed_sessions bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public','pg_temp'
AS $fn$
WITH rows AS (
 SELECT s.id AS session_id,s.book_id,s.unit_id,
  jsonb_array_length(s.questions) AS n,q.i AS question_index,
  s.questions->q.i AS question,s.responses->q.i AS response,
  (SELECT c.feedback FROM public.writing_genius_sentence_checks c
    WHERE c.session_id=s.id AND c.question_index=q.i AND c.feedback IS NOT NULL
    ORDER BY c.attempt_no ASC LIMIT 1) AS first_feedback,
  (SELECT c.feedback FROM public.writing_genius_sentence_checks c
    WHERE c.session_id=s.id AND c.question_index=q.i AND c.feedback IS NOT NULL
    ORDER BY c.attempt_no DESC LIMIT 1) AS last_feedback
 FROM public.writing_genius_sentence_sessions s
 CROSS JOIN LATERAL generate_series(0,jsonb_array_length(s.questions)-1) AS q(i)
 WHERE s.student_id=(SELECT auth.uid()) AND s.exercise_type='make'
  AND s.status='completed' AND s.unit_id IS NOT NULL
),
agg AS (
 SELECT r.session_id,r.book_id,r.unit_id,max(r.n)::int AS n,
  count(*) FILTER(WHERE r.first_feedback IS NOT NULL)::int AS checked,
  sum(CASE r.first_feedback->>'grade'
   WHEN 'correct' THEN 4 WHEN 'almost' THEN 2 ELSE 0 END)::int AS points,
  bool_and(
    COALESCE(r.last_feedback->>'grade'='correct',false)
    OR (r.n=5 AND r.first_feedback IS NOT NULL AND
     length(coalesce(r.response->>'revised',''))>=3 AND
     (lower(regexp_replace(coalesce(r.response->>'revised',''),'[^a-zA-Z0-9]+','','g')) =
      lower(regexp_replace(coalesce(r.first_feedback->>'suggestion',''),'[^a-zA-Z0-9]+','','g'))
      OR lower(regexp_replace(coalesce(r.response->>'revised',''),'[^a-zA-Z0-9]+','','g')) =
      lower(regexp_replace(coalesce(r.question->>'model',''),'[^a-zA-Z0-9]+','','g'))))
  ) AS mastered,
  bool_and(r.question->>'sourceUnitId'=r.unit_id) AS single_unit
 FROM rows r GROUP BY r.session_id,r.book_id,r.unit_id
),
result AS (
 SELECT a.book_id,a.unit_id,
   round(a.points*100.0/(4*a.n))::int AS percent,
   a.mastered AND a.single_unit AS gold
 FROM agg a WHERE a.checked=a.n AND a.n IN (5,10)
),
with_stars AS (
 SELECT r.*,CASE WHEN r.percent>=100 THEN 5 WHEN r.percent>=90 THEN 4
  WHEN r.percent>=80 THEN 3 WHEN r.percent>=70 THEN 2
  WHEN r.percent>=60 THEN 1 ELSE 0 END AS stars FROM result r
)
SELECT a.book_id,a.unit_id,max(a.percent)::int,max(a.stars)::int,
 bool_or(a.gold),count(*)::bigint
FROM with_stars a GROUP BY a.book_id,a.unit_id
$fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_unit_rewards_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wg_sentence_unit_rewards_v1() TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
