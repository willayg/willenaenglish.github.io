-- Writing Genius sentence rewards. First AI check sets stars; successful
-- correction counts toward permanent gold. Rewards are derived from server rows.
-- Stars match Word Genius: 100/90/80/70/60% => 5/4/3/2/1 stars.
CREATE OR REPLACE FUNCTION public.wg_sentence_session_guard_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp' AS $fn$
BEGIN
 IF ROW(NEW.student_id,NEW.exercise_type,NEW.book_id,NEW.book_title,NEW.unit_id,NEW.questions,NEW.practice_day,NEW.created_at)
    IS DISTINCT FROM
    ROW(OLD.student_id,OLD.exercise_type,OLD.book_id,OLD.book_title,OLD.unit_id,OLD.questions,OLD.practice_day,OLD.created_at)
 THEN RAISE EXCEPTION 'Session identity and questions are immutable'; END IF;
 IF OLD.status='completed' AND
    (NEW.status IS DISTINCT FROM OLD.status OR NEW.current_index IS DISTINCT FROM OLD.current_index)
 THEN RAISE EXCEPTION 'A completed session cannot be reopened'; END IF;
 IF NEW.current_index < OLD.current_index THEN RAISE EXCEPTION 'Progress cannot go backwards'; END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_session_guard_v1() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS wg_sentence_session_guard ON public.writing_genius_sentence_sessions;
CREATE TRIGGER wg_sentence_session_guard BEFORE UPDATE ON public.writing_genius_sentence_sessions
 FOR EACH ROW EXECUTE FUNCTION public.wg_sentence_session_guard_v1();

CREATE OR REPLACE FUNCTION public.wg_sentence_unit_rewards_v1()
RETURNS TABLE(book_id text,unit_id text,best_percent integer,best_stars integer,golden boolean,completed_sessions bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public','pg_temp'
AS $fn$
WITH graded AS (
 SELECT s.id,s.book_id,s.unit_id,s.questions,s.responses,
   count(c.id) FILTER(WHERE c.feedback IS NOT NULL) AS graded_count,
   COALESCE(sum(CASE c.feedback->>'grade' WHEN 'correct' THEN 4 WHEN 'almost' THEN 2 ELSE 0 END),0) AS first_points,
   count(c.id) FILTER(WHERE
    c.feedback IS NOT NULL AND
    (c.feedback->>'grade'='correct' OR (
      COALESCE(length(s.responses->c.question_index->>'revised'),0)>=3 AND
      (lower(regexp_replace(COALESCE(s.responses->c.question_index->>'revised',''),'[^a-zA-Z0-9]+','','g')) =
       lower(regexp_replace(COALESCE(c.feedback->>'suggestion',''),'[^a-zA-Z0-9]+','','g')) OR
       lower(regexp_replace(COALESCE(s.responses->c.question_index->>'revised',''),'[^a-zA-Z0-9]+','','g')) =
       lower(regexp_replace(COALESCE(s.questions->c.question_index->>'model',''),'[^a-zA-Z0-9]+','','g'))))
    )) AS mastered
 FROM public.writing_genius_sentence_sessions s
 LEFT JOIN public.writing_genius_sentence_checks c ON c.session_id=s.id
 WHERE s.student_id=(SELECT auth.uid()) AND s.exercise_type='make'
  AND s.status='completed' AND s.unit_id IS NOT NULL
 GROUP BY s.id
), results AS (
 SELECT g.book_id,g.unit_id,(g.first_points*5)::integer AS percent,
  CASE WHEN g.first_points>=20 THEN 5 WHEN g.first_points>=18 THEN 4
       WHEN g.first_points>=16 THEN 3 WHEN g.first_points>=14 THEN 2
       WHEN g.first_points>=12 THEN 1 ELSE 0 END::integer AS stars,
  (g.mastered=5) AS is_golden
 FROM graded g
 WHERE g.graded_count=5 AND jsonb_array_length(g.questions)=5
  AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(g.questions) q
     WHERE q->>'sourceUnitId' IS DISTINCT FROM g.unit_id)
)
SELECT r.book_id,r.unit_id,max(r.percent)::integer,max(r.stars)::integer,
 bool_or(r.is_golden),count(*)::bigint
FROM results r GROUP BY r.book_id,r.unit_id
$fn$;
REVOKE ALL ON FUNCTION public.wg_sentence_unit_rewards_v1() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wg_sentence_unit_rewards_v1() TO authenticated;
NOTIFY pgrst, 'reload schema';
