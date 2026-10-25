-- Willena Genius teacher snapshots (2026-10-25)
-- Design: mirrored on the 내신 dashboard dirty-queue and snapshot reader.
-- Word Genius Gold remains sourced from permanent achievements, not percentages.
-- Run in the operational Supabase project; no changes to student grading paths.

CREATE TABLE IF NOT EXISTS public.genius_teacher_dashboard_snapshots_v1 (
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app text NOT NULL CHECK(app IN ('word','grammar','sentence')),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_version text NOT NULL DEFAULT 'genius-v1',
  source_last_activity timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(student_id,app)
);
CREATE TABLE IF NOT EXISTS public.genius_teacher_dashboard_dirty_v1 (
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app text NOT NULL CHECK(app IN ('word','grammar','sentence')),
  dirty_since timestamptz NOT NULL DEFAULT now(),
  last_event_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT 'activity',
  PRIMARY KEY(student_id,app)
);
CREATE INDEX IF NOT EXISTS genius_teacher_dirty_age_v1
  ON public.genius_teacher_dashboard_dirty_v1(dirty_since);
CREATE INDEX IF NOT EXISTS genius_teacher_snap_updated_v1
  ON public.genius_teacher_dashboard_snapshots_v1(app,updated_at);
ALTER TABLE public.genius_teacher_dashboard_snapshots_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genius_teacher_dashboard_dirty_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.genius_teacher_dashboard_snapshots_v1 FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.genius_teacher_dashboard_dirty_v1 FROM PUBLIC,anon,authenticated;

-- genius_teacher_mark_dirty_v1
CREATE OR REPLACE FUNCTION public.genius_teacher_mark_dirty_v1(p_student_id uuid, p_app text, p_reason text DEFAULT 'activity'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF p_student_id IS NULL OR p_app NOT IN ('word','grammar','sentence') THEN RETURN;END IF;
 INSERT INTO public.genius_teacher_dashboard_dirty_v1(student_id,app,reason)
 VALUES(p_student_id,p_app,coalesce(p_reason,'activity'))
 ON CONFLICT(student_id,app) DO UPDATE SET
  last_event_at=now(),reason=excluded.reason;
END $function$
;

-- genius_teacher_study_attempt_dirty_trg_v1
CREATE OR REPLACE FUNCTION public.genius_teacher_study_attempt_dirty_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE r record;v_app text;
BEGIN
 IF tg_op IN ('DELETE','UPDATE') THEN
  v_app:=CASE
   WHEN old.metadata->>'sentence_genius'='true' AND old.skill IN ('sentence_coach','sentence_unscramble','sentence_speaking') THEN 'sentence'
   WHEN old.metadata->>'vocab_study'='true' AND old.skill IN ('vocabulary','spelling','speaking') THEN 'word'
   ELSE NULL END;
  PERFORM public.genius_teacher_mark_dirty_v1(old.student_id,v_app,'study_'||lower(tg_op));
 END IF;
 IF tg_op IN ('INSERT','UPDATE') THEN
  v_app:=CASE
   WHEN new.metadata->>'sentence_genius'='true' AND new.skill IN ('sentence_coach','sentence_unscramble','sentence_speaking') THEN 'sentence'
   WHEN new.metadata->>'vocab_study'='true' AND new.skill IN ('vocabulary','spelling','speaking') THEN 'word'
   ELSE NULL END;
  PERFORM public.genius_teacher_mark_dirty_v1(new.student_id,v_app,'study_'||lower(tg_op));
 END IF;
 RETURN CASE WHEN tg_op='DELETE' THEN old ELSE new END;
END $function$
;

-- genius_teacher_grammar_dirty_trg_v1
CREATE OR REPLACE FUNCTION public.genius_teacher_grammar_dirty_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF tg_op IN ('UPDATE','DELETE') THEN
  PERFORM public.genius_teacher_mark_dirty_v1(old.student_id,'grammar',tg_table_name||'_'||lower(tg_op));
 END IF;
 IF tg_op IN ('UPDATE','INSERT') THEN
  PERFORM public.genius_teacher_mark_dirty_v1(new.student_id,'grammar',tg_table_name||'_'||lower(tg_op));
 END IF;
 RETURN CASE WHEN tg_op='DELETE' THEN old ELSE new END;
END $function$
;

-- genius_teacher_word_dirty_trg_v1
CREATE OR REPLACE FUNCTION public.genius_teacher_word_dirty_trg_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
 IF tg_op IN ('DELETE','UPDATE') THEN
  PERFORM public.genius_teacher_mark_dirty_v1(old.student_id,'word',tg_table_name||'_'||lower(tg_op));
 END IF;
 IF tg_op IN ('INSERT','UPDATE') THEN
  PERFORM public.genius_teacher_mark_dirty_v1(new.student_id,'word',tg_table_name||'_'||lower(tg_op));
 END IF;
 RETURN CASE WHEN tg_op='DELETE' THEN old ELSE new END;
END $function$
;

-- genius_teacher_refresh_student_v1
CREATE OR REPLACE FUNCTION public.genius_teacher_refresh_student_v1(p_student_id uuid, p_app text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
 v_days integer; v_window jsonb; v_windows jsonb:='{}'::jsonb;
 v_total integer;v_correct integer;v_by_skill jsonb;
 v_today integer:=0;v_last timestamptz;v_units jsonb:='[]'::jsonb;
 v_levels integer:=0;v_passed integer:=0;v_challenges integer:=0;
 v_recent_count integer:=0;v_recent_correct integer:=0;
 v_stats jsonb;
BEGIN
 IF p_app NOT IN ('word','grammar','sentence') OR p_student_id IS NULL THEN
  RAISE EXCEPTION 'Invalid Genius snapshot target' USING errcode='22023';
 END IF;
 IF p_app IN ('word','sentence') THEN
  FOR v_days IN SELECT unnest(ARRAY[7,14,30,60,90]) LOOP
   SELECT coalesce(sum(q.n),0)::integer,coalesce(sum(q.c),0)::integer,
    coalesce(jsonb_object_agg(q.skill,jsonb_build_object('attempts',q.n,'correct',q.c)),'{}'::jsonb)
    INTO v_total,v_correct,v_by_skill
   FROM (
    SELECT a.skill,count(*)::integer n,count(*) FILTER(WHERE a.is_correct IS TRUE)::integer c
    FROM public.study_attempts a
    WHERE a.student_id=p_student_id AND a.created_at >= now()-make_interval(days=>v_days)
      AND ((p_app='word' AND a.metadata->>'vocab_study'='true'
            AND a.skill IN ('vocabulary','spelling','speaking'))
        OR (p_app='sentence' AND a.metadata->>'sentence_genius'='true'
            AND a.skill IN ('sentence_coach','sentence_unscramble','sentence_speaking')))
    GROUP BY a.skill
   ) q;
   v_windows:=v_windows||jsonb_build_object(v_days::text,
      jsonb_build_object('attempts',v_total,'correct',v_correct,'skills',v_by_skill));
  END LOOP;
  SELECT count(*) FILTER(WHERE (a.created_at AT TIME ZONE 'Asia/Seoul')::date =
                                     (now() AT TIME ZONE 'Asia/Seoul')::date)::integer,
         max(a.created_at)
   INTO v_today,v_last
  FROM public.study_attempts a WHERE a.student_id=p_student_id
   AND ((p_app='word' AND a.metadata->>'vocab_study'='true'
          AND a.skill IN ('vocabulary','spelling','speaking'))
    OR (p_app='sentence' AND a.metadata->>'sentence_genius'='true'
          AND a.skill IN ('sentence_coach','sentence_unscramble','sentence_speaking')));
  IF p_app='sentence' THEN
   SELECT coalesce(jsonb_agg(jsonb_build_object(
      'book_id',z.book_id,'unit_id',z.unit_id,
      'attempts',z.attempts,'last_activity',z.last_activity,
      'coach_passed',jsonb_array_length(z.coach_ids),
      'unscramble_passed',jsonb_array_length(z.unscramble_ids),
      'speaking_passed',jsonb_array_length(z.speaking_ids),
      'coach_ids',z.coach_ids,'unscramble_ids',z.unscramble_ids,'speaking_ids',z.speaking_ids
    ) ORDER BY z.last_activity DESC),'[]'::jsonb) INTO v_units
   FROM (
    SELECT a.book_id,a.unit_id,count(*)::integer attempts,max(a.created_at) last_activity,
      coalesce(jsonb_agg(DISTINCT a.content_id) FILTER(
        WHERE a.skill='sentence_coach' AND a.is_correct IS TRUE AND a.content_id IS NOT NULL),'[]'::jsonb) coach_ids,
      coalesce(jsonb_agg(DISTINCT a.content_id) FILTER(
        WHERE a.skill='sentence_unscramble' AND a.is_correct IS TRUE AND a.content_id IS NOT NULL),'[]'::jsonb) unscramble_ids,
      coalesce(jsonb_agg(DISTINCT a.content_id) FILTER(
        WHERE a.skill='sentence_speaking' AND a.is_correct IS TRUE AND a.content_id IS NOT NULL),'[]'::jsonb) speaking_ids
    FROM public.study_attempts a WHERE a.student_id=p_student_id
      AND a.metadata->>'sentence_genius'='true'
      AND a.skill IN ('sentence_coach','sentence_unscramble','sentence_speaking')
      AND a.book_id IS NOT NULL AND a.unit_id IS NOT NULL
    GROUP BY a.book_id,a.unit_id
   ) z;
  ELSE
   SELECT coalesce(jsonb_agg(jsonb_build_object(
     'book_id',z.book_id,'unit_id',z.unit_id,
     'quiz_passed',coalesce(z.vocabulary_passed_count,0),
     'spelling_passed',coalesce(z.spelling_test_passed_count,0),
     'speaking_passed',coalesce(z.speaking_passed_count,0),
     'quiz_attempted',coalesce(z.vocabulary_attempted_count,0),
     'spelling_attempted',coalesce(z.spelling_attempted_count,0),
     'speaking_attempted',coalesce(z.speaking_attempted_count,0),
     'updated_at',z.updated_at,'golden',z.earned_at IS NOT NULL,'earned_at',z.earned_at
   ) ORDER BY z.earned_at DESC NULLS LAST,z.updated_at DESC NULLS LAST),'[]'::jsonb)
   INTO v_units
   FROM (
    SELECT coalesce(s.book_id,a.book_id) book_id,coalesce(s.unit_id,a.unit_id) unit_id,
     s.vocabulary_passed_count,s.spelling_test_passed_count,s.speaking_passed_count,
     s.vocabulary_attempted_count,s.spelling_attempted_count,s.speaking_attempted_count,
     s.updated_at,a.earned_at
    FROM (SELECT * FROM public.student_vocab_unit_snapshot_v1 WHERE student_id=p_student_id) s
    FULL JOIN (
     SELECT book_id,unit_id,min(earned_at) earned_at
     FROM public.student_achievements
     WHERE student_id=p_student_id AND achievement_type='vocab_golden_unit'
     GROUP BY book_id,unit_id
    ) a ON a.book_id=s.book_id AND a.unit_id=s.unit_id
    WHERE (s.student_id=p_student_id OR s.student_id IS NULL)
      AND coalesce(s.book_id,a.book_id) IS NOT NULL AND coalesce(s.unit_id,a.unit_id) IS NOT NULL
   ) z;
  END IF;
 ELSE
  FOR v_days IN SELECT unnest(ARRAY[7,14,30,60,90]) LOOP
   WITH sessions AS (
    SELECT results,completed_at FROM public.grammar_foundation_stage_runs
     WHERE student_id=p_student_id AND completed_at>=now()-make_interval(days=>v_days)
    UNION ALL
    SELECT results,completed_at FROM public.grammar_foundation_challenge_runs
     WHERE student_id=p_student_id AND completed_at>=now()-make_interval(days=>v_days)
   ), responses AS (
    SELECT (r.item->>'correct' = 'true') AS correct
    FROM sessions s CROSS JOIN LATERAL jsonb_array_elements(
     CASE WHEN jsonb_typeof(s.results)='array' THEN s.results ELSE '[]'::jsonb END
    ) r(item)
   )
   SELECT count(*)::integer,count(*) FILTER(WHERE correct IS TRUE)::integer
     INTO v_total,v_correct FROM responses;
   v_windows:=v_windows||jsonb_build_object(v_days::text,jsonb_build_object(
    'attempts',v_total,'correct',v_correct,'skills','{}'::jsonb));
  END LOOP;
  WITH runs AS (
   SELECT completed_at,results,id FROM public.grammar_foundation_stage_runs WHERE student_id=p_student_id
   UNION ALL
   SELECT completed_at,results,id FROM public.grammar_foundation_challenge_runs WHERE student_id=p_student_id
  ), ordered AS (
   SELECT r.item->>'correct' AS correct
   FROM runs s CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(s.results)='array' THEN s.results ELSE '[]'::jsonb END
   ) WITH ORDINALITY r(item,ord)
   ORDER BY s.completed_at DESC,s.id DESC,r.ord DESC LIMIT 50
  )
  SELECT count(*)::integer,count(*) FILTER(WHERE correct='true')::integer
   INTO v_recent_count,v_recent_correct FROM ordered;
  SELECT coalesce(sum(x.num),0)::integer,max(x.last_activity)
   INTO v_today,v_last FROM (
    SELECT count(*) FILTER(WHERE (completed_at AT TIME ZONE 'Asia/Seoul')::date=
      (now() AT TIME ZONE 'Asia/Seoul')::date)::integer num,max(completed_at) last_activity
    FROM public.grammar_foundation_stage_runs WHERE student_id=p_student_id
    UNION ALL
    SELECT count(*) FILTER(WHERE (completed_at AT TIME ZONE 'Asia/Seoul')::date=
      (now() AT TIME ZONE 'Asia/Seoul')::date)::integer num,max(completed_at) last_activity
    FROM public.grammar_foundation_challenge_runs WHERE student_id=p_student_id
   ) x;
  SELECT count(*)::integer,count(*) FILTER(WHERE passed IS TRUE)::integer INTO v_levels,v_passed
   FROM public.grammar_foundation_stage_progress WHERE student_id=p_student_id;
  SELECT count(*) FILTER(WHERE passed IS TRUE)::integer INTO v_challenges
   FROM public.grammar_foundation_challenge_progress WHERE student_id=p_student_id;
  SELECT coalesce(sum(jsonb_array_length(CASE WHEN jsonb_typeof(r.results)='array'
    THEN r.results ELSE '[]'::jsonb END)),0)::integer INTO v_today
  FROM (
   SELECT completed_at,results FROM public.grammar_foundation_stage_runs WHERE student_id=p_student_id
   UNION ALL
   SELECT completed_at,results FROM public.grammar_foundation_challenge_runs WHERE student_id=p_student_id
  ) r WHERE (r.completed_at AT TIME ZONE 'Asia/Seoul')::date =
             (now() AT TIME ZONE 'Asia/Seoul')::date;
  IF v_levels>0 OR v_challenges>0 THEN
  v_units:=jsonb_build_array(jsonb_build_object(
   'levels_started',v_levels,'levels_passed',v_passed,'challenges_passed',v_challenges));
  ELSE v_units:='[]'::jsonb;
  END IF;
 END IF;
 v_stats:=jsonb_build_object('windows',v_windows,'today_attempts',coalesce(v_today,0),
     'last_activity',v_last,'unit_list',coalesce(v_units,'[]'::jsonb),
     'recent_count',v_recent_count,'recent_correct',v_recent_correct,
     'levels_started',v_levels,'levels_passed',v_passed,'challenges_passed',v_challenges);
 INSERT INTO public.genius_teacher_dashboard_snapshots_v1(student_id,app,stats,
       source_last_activity,snapshot_version,updated_at)
 VALUES(p_student_id,p_app,v_stats,v_last,'genius-v1',now())
 ON CONFLICT(student_id,app) DO UPDATE SET
  stats=excluded.stats,source_last_activity=excluded.source_last_activity,
  snapshot_version=excluded.snapshot_version,updated_at=excluded.updated_at;
 DELETE FROM public.genius_teacher_dashboard_dirty_v1
  WHERE student_id=p_student_id AND app=p_app;
 RETURN jsonb_build_object('student_id',p_student_id,'app',p_app,'refreshed',true);
END $function$
;

-- genius_teacher_process_dirty_v1
CREATE OR REPLACE FUNCTION public.genius_teacher_process_dirty_v1(p_app text, p_limit integer DEFAULT 40, p_class text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_row record;v_count integer:=0;v_failed integer:=0;v_start timestamptz:=clock_timestamp();
BEGIN
 IF p_app NOT IN ('word','grammar','sentence') THEN
  RAISE EXCEPTION 'Unknown Genius app' USING errcode='22023';
 END IF;
 FOR v_row IN
  SELECT p.id FROM public.profiles p
  LEFT JOIN public.genius_teacher_dashboard_snapshots_v1 s ON s.student_id=p.id AND s.app=p_app
  LEFT JOIN public.genius_teacher_dashboard_dirty_v1 d ON d.student_id=p.id AND d.app=p_app
  WHERE p.role='student' AND p.approved IS DISTINCT FROM false
    AND (nullif(trim(p_class),'') IS NULL OR p.class=trim(p_class))
    AND (d.student_id IS NOT NULL OR s.student_id IS NULL OR s.snapshot_version<>'genius-v1'
      OR (s.updated_at AT TIME ZONE 'Asia/Seoul')::date < (now() AT TIME ZONE 'Asia/Seoul')::date)
  ORDER BY (s.student_id IS NULL) DESC,d.dirty_since NULLS LAST,p.id
  LIMIT greatest(0,least(coalesce(p_limit,40),200))
 LOOP
  BEGIN
   PERFORM public.genius_teacher_refresh_student_v1(v_row.id,p_app);
   v_count:=v_count+1;
  EXCEPTION WHEN others THEN
   v_failed:=v_failed+1;
   PERFORM public.genius_teacher_mark_dirty_v1(v_row.id,p_app,'refresh_error');
  END;
 END LOOP;
 RETURN jsonb_build_object('processed',v_count,'failed',v_failed,
  'ms',round(extract(epoch from clock_timestamp()-v_start)*1000));
END $function$
;

-- genius_teacher_snapshot_read_v1
CREATE OR REPLACE FUNCTION public.genius_teacher_snapshot_read_v1(p_app text, p_class text DEFAULT NULL::text, p_days integer DEFAULT 30, p_refresh_limit integer DEFAULT 40)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_role text;v_approved boolean;v_class text;
v_students jsonb;v_refresh jsonb;v_days integer;v_pending integer;
BEGIN
 SELECT lower(trim(role)),approved INTO v_role,v_approved
 FROM public.profiles WHERE id=auth.uid();
 IF v_role NOT IN ('teacher','admin') OR v_approved IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Teacher access required' USING errcode='42501';END IF;
 IF p_app NOT IN ('word','grammar','sentence') THEN RAISE EXCEPTION 'Unknown Genius app' USING errcode='22023';END IF;
 v_class:=nullif(trim(coalesce(p_class,'')),'');
 v_days:=CASE WHEN p_days IN (7,14,30,60,90) THEN p_days ELSE 30 END;
 v_refresh:=public.genius_teacher_process_dirty_v1(p_app,p_refresh_limit,v_class);
 SELECT count(*)::integer INTO v_pending FROM public.profiles p
  LEFT JOIN public.genius_teacher_dashboard_snapshots_v1 s ON s.student_id=p.id AND s.app=p_app
  LEFT JOIN public.genius_teacher_dashboard_dirty_v1 d ON d.student_id=p.id AND d.app=p_app
 WHERE p.role='student' AND p.approved IS DISTINCT FROM false
   AND (v_class IS NULL OR p.class=v_class)
   AND (d.student_id IS NOT NULL OR s.student_id IS NULL
    OR (s.updated_at AT TIME ZONE 'Asia/Seoul')::date < (now() AT TIME ZONE 'Asia/Seoul')::date);
 SELECT coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'user_id',p.id,'name',p.name,'korean_name',p.korean_name,
  'class',p.class,'class_name',p.class,'grade',p.grade,
  'attempts',coalesce((s.stats->'windows'->(v_days::text)->>'attempts')::integer,0),
  'correct',coalesce((s.stats->'windows'->(v_days::text)->>'correct')::integer,0),
  'skills',coalesce(s.stats->'windows'->(v_days::text)->'skills','{}'::jsonb),
  'today_attempts',coalesce((s.stats->>'today_attempts')::integer,0),
  'questions_today',coalesce((s.stats->>'today_attempts')::integer,0),
  'last_activity',s.stats->>'last_activity',
  'unit_list',coalesce(s.stats->'unit_list','[]'::jsonb),
  'units',jsonb_array_length(coalesce(s.stats->'unit_list','[]'::jsonb)),
  'recent_count',coalesce((s.stats->>'recent_count')::integer,0),
  'recent_correct',coalesce((s.stats->>'recent_correct')::integer,0),
  'recent_accuracy',CASE
   WHEN coalesce((s.stats->>'recent_count')::integer,0)>0
   THEN round(100.0*(s.stats->>'recent_correct')::numeric /
        (s.stats->>'recent_count')::numeric)
   ELSE NULL END,
  'levels_started',coalesce((s.stats->>'levels_started')::integer,0),
  'levels_passed',coalesce((s.stats->>'levels_passed')::integer,0),
  'challenges_passed',coalesce((s.stats->>'challenges_passed')::integer,0),
  'snapshot_at',s.updated_at
 ) ORDER BY lower(coalesce(nullif(p.korean_name,''),p.name)),p.class),'[]'::jsonb)
 INTO v_students
 FROM public.profiles p
 LEFT JOIN public.genius_teacher_dashboard_snapshots_v1 s
   ON s.student_id=p.id AND s.app=p_app
 WHERE p.role='student' AND p.approved IS DISTINCT FROM false
   AND (v_class IS NULL OR p.class=v_class);
 RETURN jsonb_build_object('success',true,'app',p_app,'days',v_days,
   'students',v_students,'refreshed',v_refresh,'pending',v_pending);
END $function$
;

-- sg_teacher_statistics_v1
CREATE OR REPLACE FUNCTION public.sg_teacher_statistics_v1(p_class text DEFAULT NULL::text, p_days integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_res jsonb;v_students jsonb;
BEGIN
 v_res:=public.genius_teacher_snapshot_read_v1('sentence',p_class,p_days,60);
 SELECT coalesce(jsonb_agg(s.item || jsonb_build_object(
   'coach_attempts',coalesce((s.item->'skills'->'sentence_coach'->>'attempts')::integer,0),
   'coach_correct',coalesce((s.item->'skills'->'sentence_coach'->>'correct')::integer,0),
   'unscramble_attempts',coalesce((s.item->'skills'->'sentence_unscramble'->>'attempts')::integer,0),
   'unscramble_correct',coalesce((s.item->'skills'->'sentence_unscramble'->>'correct')::integer,0),
   'speaking_attempts',coalesce((s.item->'skills'->'sentence_speaking'->>'attempts')::integer,0),
   'speaking_correct',coalesce((s.item->'skills'->'sentence_speaking'->>'correct')::integer,0)
 )),'[]'::jsonb) INTO v_students FROM jsonb_array_elements(v_res->'students') s(item);
 RETURN v_res||jsonb_build_object('students',v_students);
END $function$
;

-- sg_teacher_unit_mastery_v1
CREATE OR REPLACE FUNCTION public.sg_teacher_unit_mastery_v1(p_student_id uuid, p_book_id uuid, p_unit_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_role text;v_approved boolean;v_rec jsonb;v_snapshot jsonb;
BEGIN
 SELECT lower(trim(role)),approved INTO v_role,v_approved FROM public.profiles WHERE id=auth.uid();
 IF v_role NOT IN ('teacher','admin') OR v_approved IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Teacher access required' USING errcode='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_student_id AND role='student')
 THEN RAISE EXCEPTION 'Student not found' USING errcode='22023';END IF;
 IF EXISTS(SELECT 1 FROM public.genius_teacher_dashboard_dirty_v1
  WHERE app='sentence' AND student_id=p_student_id)
   OR NOT EXISTS(SELECT 1 FROM public.genius_teacher_dashboard_snapshots_v1
   WHERE app='sentence' AND student_id=p_student_id) THEN
  PERFORM public.genius_teacher_refresh_student_v1(p_student_id,'sentence');
 END IF;
 SELECT s.stats INTO v_snapshot FROM public.genius_teacher_dashboard_snapshots_v1 s
 WHERE s.app='sentence' AND s.student_id=p_student_id;
 SELECT r.item INTO v_rec FROM jsonb_array_elements(coalesce(v_snapshot->'unit_list','[]'::jsonb)) r(item)
 WHERE r.item->>'book_id'=p_book_id::text AND r.item->>'unit_id'=p_unit_id::text LIMIT 1;
 RETURN jsonb_build_object('success',true,'mastered',jsonb_build_object(
  'coach',coalesce(v_rec->'coach_ids','[]'::jsonb),
  'unscramble',coalesce(v_rec->'unscramble_ids','[]'::jsonb),
  'speaking',coalesce(v_rec->'speaking_ids','[]'::jsonb)));
END $function$
;

-- Trigger writes invalidate only their own student/app. No public table access.
REVOKE ALL ON FUNCTION public.genius_teacher_mark_dirty_v1(uuid,text,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.genius_teacher_study_attempt_dirty_trg_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.genius_teacher_grammar_dirty_trg_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.genius_teacher_word_dirty_trg_v1() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.genius_teacher_refresh_student_v1(uuid,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.genius_teacher_process_dirty_v1(text,integer,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.genius_teacher_snapshot_read_v1(text,text,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.genius_teacher_snapshot_read_v1(text,text,integer,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.sg_teacher_statistics_v1(text,integer) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.sg_teacher_unit_mastery_v1(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sg_teacher_statistics_v1(text,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sg_teacher_unit_mastery_v1(uuid,uuid,uuid) TO authenticated;

DROP TRIGGER IF EXISTS trg_genius_teacher_study_dirty_v1 ON public.study_attempts;
CREATE TRIGGER trg_genius_teacher_study_dirty_v1
AFTER INSERT OR UPDATE OR DELETE ON public.study_attempts
FOR EACH ROW EXECUTE FUNCTION public.genius_teacher_study_attempt_dirty_trg_v1();
DO $triggers$ DECLARE t text;BEGIN
 FOR t IN SELECT unnest(ARRAY[
   'grammar_foundation_stage_runs','grammar_foundation_challenge_runs',
   'grammar_foundation_stage_progress','grammar_foundation_challenge_progress'])
 LOOP
   EXECUTE format('DROP TRIGGER IF EXISTS trg_genius_teacher_grammar_dirty_v1 ON public.%I',t);
   EXECUTE format('CREATE TRIGGER trg_genius_teacher_grammar_dirty_v1 AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.genius_teacher_grammar_dirty_trg_v1()',t);
 END LOOP;
END $triggers$;
DROP TRIGGER IF EXISTS trg_genius_teacher_word_snapshot_dirty_v1 ON public.student_vocab_unit_snapshot_v1;
CREATE TRIGGER trg_genius_teacher_word_snapshot_dirty_v1
AFTER INSERT OR UPDATE OR DELETE ON public.student_vocab_unit_snapshot_v1
FOR EACH ROW EXECUTE FUNCTION public.genius_teacher_word_dirty_trg_v1();
DROP TRIGGER IF EXISTS trg_genius_teacher_word_achievement_dirty_v1 ON public.student_achievements;
CREATE TRIGGER trg_genius_teacher_word_achievement_dirty_v1
AFTER INSERT OR UPDATE OR DELETE ON public.student_achievements
FOR EACH ROW EXECUTE FUNCTION public.genius_teacher_word_dirty_trg_v1();

-- Initial one-time backfill. Later reads process dirty students on demand.
SELECT public.genius_teacher_process_dirty_v1('word',200,NULL);
SELECT public.genius_teacher_process_dirty_v1('grammar',200,NULL);
SELECT public.genius_teacher_process_dirty_v1('sentence',200,NULL);
