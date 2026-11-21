-- Read-only teacher usage dashboard aggregate, deployed to Willena Game Scores.
-- The Edge Function verifies staff access and calls this RPC with the service role.
CREATE OR REPLACE FUNCTION public.teacher_genius_usage_analytics_v1(p_days integer DEFAULT 30, p_class text DEFAULT NULL::text, p_app text DEFAULT NULL::text, p_start date DEFAULT NULL::date, p_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  v_end date;
  v_start date;
  v_prior_start date;
  v_app text;
  v_class text;
  v_result jsonb;
begin
  v_end := least(coalesce(p_end, (now() at time zone 'Asia/Seoul')::date), (now() at time zone 'Asia/Seoul')::date);
  v_start := coalesce(p_start, v_end - (least(greatest(coalesce(p_days, 30), 1), 90) - 1));
  if v_end < v_start or v_end - v_start > 89 then
    raise exception 'Date range must contain 1 to 90 days' using errcode='22023';
  end if;
  v_prior_start := v_start - (v_end - v_start + 1);
  v_app := nullif(lower(trim(coalesce(p_app,''))), '');
  v_class := nullif(trim(coalesce(p_class,'')), '');
  if v_app is not null and v_app not in ('word','sentence','grammar','talking','writing','puzzles','naesin') then
    raise exception 'Unknown app filter' using errcode='22023';
  end if;
  with roster as materialized (
    select id, coalesce(nullif(name,''),nullif(username,''),'Student') display_name,
           coalesce(nullif(trim(class),''),'Unassigned') class_name
    from public.profiles
    where role='student' and coalesce(is_ghost,false)=false
      and lower(coalesce(trim(class),''))<>'test'
      and (v_class is null or lower(coalesce(trim(class),''))=lower(v_class))
  ),
  raw as materialized (
    select s.id::text event_id,s.student_id,
      case when s.practice_mode in ('vocabulary','spelling','speaking') then 'word'
           when s.practice_mode in ('sentence_coach','sentence_unscramble','sentence_speaking','sentence_building') then 'sentence'
           when s.practice_mode='grammar' then 'grammar'
           when s.practice_mode='puzzle' then 'puzzles' end app,
      s.started_at occurred_at,1 source_priority
    from public.study_sessions s
    where s.started_at >= (v_prior_start::timestamp at time zone 'Asia/Seoul')
      and s.started_at < ((v_end+1)::timestamp at time zone 'Asia/Seoul')
      and s.practice_mode in ('vocabulary','spelling','speaking','sentence_coach','sentence_unscramble','sentence_speaking','sentence_building','grammar','puzzle')
    union all
    select g.id::text,g.student_id,'grammar',g.completed_at,1
    from public.grammar_foundation_stage_runs g
    where g.completed_at >= (v_prior_start::timestamp at time zone 'Asia/Seoul')
      and g.completed_at < ((v_end+1)::timestamp at time zone 'Asia/Seoul')
    union all
    select t.id::text,t.student_id,'talking',t.completed_at,1
    from public.free_talking_sessions t
    where t.status='completed' and t.completed_at >= (v_prior_start::timestamp at time zone 'Asia/Seoul')
      and t.completed_at < ((v_end+1)::timestamp at time zone 'Asia/Seoul')
    union all
    select w.id::text,w.student_id,'writing',coalesce(w.submitted_at,w.created_at),1
    from public.writing_genius_entries w
    where coalesce(w.submitted_at,w.created_at) >= (v_prior_start::timestamp at time zone 'Asia/Seoul')
      and coalesce(w.submitted_at,w.created_at) < ((v_end+1)::timestamp at time zone 'Asia/Seoul')
      and (w.submitted_at is not null or length(trim(coalesce(w.body,'')))>0)
    union all
    select n.id::text,n.student_id,'naesin',n.started_at,1
    from public.test_prep_sessions n
    where n.started_at >= (v_prior_start::timestamp at time zone 'Asia/Seoul')
      and n.started_at < ((v_end+1)::timestamp at time zone 'Asia/Seoul')
      and (n.completed_at is not null or exists (
        select 1 from public.test_prep_attempts a where a.session_id=n.id
      ))
    union all
    select p.id::text,p.user_id,
      case when p.mode in ('vocab_quiz','vocab_spelling_test','vocab_speaking','ai_coach') then 'word'
           when p.mode in ('sentence_coach','sentence_unscramble','sentence_speaking','sentence_building') then 'sentence'
           when p.mode like 'grammar_books_%' or p.mode like 'grammar_lesson_%' or p.mode in ('grammar_lesson','grammar_choose') then 'grammar'
           when p.mode in ('free_talking_natural','free_talking_speaking') then 'talking'
           when p.mode in ('boggle','mixmatch','wordsearch','crossword','memory_match','wordle') then 'puzzles' end,
      p.started_at,3
    from public.progress_sessions p
    where p.started_at >= (v_prior_start::timestamp at time zone 'Asia/Seoul')
      and p.started_at < ((v_end+1)::timestamp at time zone 'Asia/Seoul')
      and (p.mode in ('vocab_quiz','vocab_spelling_test','vocab_speaking','ai_coach',
                      'sentence_coach','sentence_unscramble','sentence_speaking','sentence_building',
                      'grammar_lesson','grammar_choose','free_talking_natural','free_talking_speaking',
                      'boggle','mixmatch','wordsearch','crossword','memory_match','wordle')
           or p.mode like 'grammar_books_%' or p.mode like 'grammar_lesson_%')
  ),
  events as materialized (
    select r.student_id,r.app,r.occurred_at,ro.display_name,ro.class_name,
           (r.occurred_at at time zone 'Asia/Seoul')::date local_day
    from raw r join roster ro on ro.id=r.student_id
    where r.app is not null and (v_app is null or r.app=v_app)
      and not exists (
        select 1 from raw canonical
        where r.source_priority>canonical.source_priority
          and canonical.student_id=r.student_id and canonical.app=r.app
          and canonical.occurred_at between r.occurred_at-interval '75 seconds' and r.occurred_at+interval '75 seconds'
      )
  ),
  current_events as materialized (select * from events where local_day between v_start and v_end),
  previous_events as materialized (select * from events where local_day between v_prior_start and v_start-1),
  summary as (select count(*) sessions,count(distinct student_id) active_students,count(distinct local_day) active_days from current_events),
  prev as (select count(*) sessions,count(distinct student_id) active_students from previous_events),
  day_series as (select d::date local_day from generate_series(v_start,v_end,interval '1 day') d),
  daily_stats as (
    select ds.local_day,count(e.student_id) sessions,count(distinct e.student_id) students
    from day_series ds left join current_events e on e.local_day=ds.local_day group by ds.local_day
  ),
  app_stats as (select app,count(*) sessions,count(distinct student_id) students from current_events group by app),
  prev_app as (select app,count(*) sessions from previous_events group by app),
  student_stats as (
    select student_id,max(display_name) display_name,max(class_name) class_name,
           count(*) sessions,count(distinct local_day) active_days,count(distinct app) apps_used
    from current_events group by student_id
  ),
  favorite_app as (
    select student_id,app,row_number() over(partition by student_id order by count(*) desc,app) rank
    from current_events group by student_id,app
  ),
  class_stats as (
    select r.class_name,count(distinct r.id) enrolled,count(distinct e.student_id) active_students,count(e.student_id) sessions
    from roster r left join current_events e on e.student_id=r.id group by r.class_name
  ),
  recent_events as (select * from current_events order by occurred_at desc limit 15)
  select jsonb_build_object(
    'range',jsonb_build_object('start',v_start,'end',v_end,'days',v_end-v_start+1,'timezone','Asia/Seoul'),
    'summary',jsonb_build_object(
      'sessions',(select sessions from summary),'activeStudents',(select active_students from summary),
      'activeDays',(select active_days from summary),'enrolledStudents',(select count(*) from roster),
      'priorSessions',(select sessions from prev),'priorActiveStudents',(select active_students from prev)
    ),
    'daily',coalesce((select jsonb_agg(jsonb_build_object('date',local_day,'sessions',sessions,'students',students) order by local_day) from daily_stats),'[]'::jsonb),
    'apps',coalesce((select jsonb_agg(jsonb_build_object('app',a.app,'sessions',a.sessions,'students',a.students,'priorSessions',coalesce(pa.sessions,0)) order by a.sessions desc,a.app) from app_stats a left join prev_app pa on pa.app=a.app),'[]'::jsonb),
    'students',coalesce((select jsonb_agg(jsonb_build_object('id',s.student_id,'name',s.display_name,'className',s.class_name,'sessions',s.sessions,'days',s.active_days,'apps',s.apps_used,'favoriteApp',coalesce(f.app,'')) order by s.sessions desc,s.display_name) from (select * from student_stats order by sessions desc,display_name limit 20) s left join favorite_app f on f.student_id=s.student_id and f.rank=1),'[]'::jsonb),
    'classes',coalesce((select jsonb_agg(jsonb_build_object('name',class_name,'students',enrolled,'activeStudents',active_students,'sessions',sessions,'participation',round(100.0*active_students/nullif(enrolled,0),1)) order by sessions desc,class_name) from class_stats),'[]'::jsonb),
    'inactive',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.display_name,'className',r.class_name) order by r.class_name,r.display_name) from (select r.* from roster r left join student_stats s on s.student_id=r.id where s.student_id is null order by r.class_name,r.display_name limit 20) r),'[]'::jsonb),
    'recent',coalesce((select jsonb_agg(jsonb_build_object('name',display_name,'className',class_name,'app',app,'at',occurred_at) order by occurred_at desc) from recent_events),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$function$;

REVOKE ALL ON FUNCTION public.teacher_genius_usage_analytics_v1(integer,text,text,date,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_genius_usage_analytics_v1(integer,text,text,date,date) TO service_role;
COMMENT ON FUNCTION public.teacher_genius_usage_analytics_v1(integer,text,text,date,date) IS 'Read-only service-role-only teacher analytics. Caller must verify approved teacher/admin session.';
