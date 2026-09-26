-- Word Test Study: expose best 0-10 stars per assigned section in assignment progress.
-- Applied live before this migration was committed.
CREATE OR REPLACE FUNCTION public.get_vocab_assignment_progress_v1(p_assignment_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with assignment as (
  select h.*,
    case
      when jsonb_typeof(h.list_meta->'required_modes')='array' and jsonb_array_length(h.list_meta->'required_modes')>0
      then h.list_meta->'required_modes'
      else '["quiz","spelling_test","speaking"]'::jsonb
    end as required_modes
  from public.homework_assignments h
  where h.id=p_assignment_id
    and h.source_type='vocab_study'
),
targets as (
  select t.*
  from public.study_assignment_targets t
  where t.assignment_id=p_assignment_id
),
modes as (
  select jsonb_array_elements_text(a.required_modes) as mode
  from assignment a
),
students as (
  select p.id,p.name,p.korean_name
  from public.profiles p, assignment a
  where p.role='student'
    and p.class=a.class
    and (
      jsonb_typeof(a.list_meta->'target_student_ids') is distinct from 'array'
      or jsonb_array_length(a.list_meta->'target_student_ids')=0
      or exists (
        select 1
        from jsonb_array_elements_text(a.list_meta->'target_student_ids') x(student_id)
        where x.student_id=p.id::text
      )
    )
),
cells as (
  select s.id as student_id,m.mode,t.lexical_entry_id,
    exists(
      select 1
      from public.study_attempts sa
      where sa.assignment_id=p_assignment_id
        and sa.student_id=s.id
        and sa.mastery_content_id=t.lexical_entry_id
        and sa.is_correct=true
        and sa.retry_count=0
        and (
          (m.mode='quiz' and sa.metadata->>'vocab_mode'='quiz')
          or (m.mode='spelling_test' and sa.metadata->>'vocab_mode'='spelling_test')
          or (m.mode='speaking' and sa.metadata->>'vocab_mode'='speaking')
        )
    ) as clean_pass
  from students s cross join modes m cross join targets t
),
assignment_stars as (
  select
    ps.user_id as student_id,
    ps.summary->>'vocab_mode' as mode,
    max(
      greatest(
        0,
        least(
          10,
          floor(
            coalesce(
              nullif(ps.summary->>'percent','')::numeric,
              nullif(ps.summary->>'accuracy','')::numeric * 100,
              case
                when nullif(ps.summary->>'total','')::numeric > 0
                then nullif(ps.summary->>'score','')::numeric * 100 / nullif(ps.summary->>'total','')::numeric
                else 0
              end,
              0
            ) / 10
          )::int
        )
      )
    )::int as stars
  from public.progress_sessions ps
  where ps.ended_at is not null
    and ps.summary->>'assignment_id'=p_assignment_id::text
    and ps.summary->>'vocab_mode' in (select mode from modes)
  group by ps.user_id,ps.summary->>'vocab_mode'
),
mode_rollup as (
  select
    c.student_id,
    c.mode,
    count(*)::int as total,
    count(*) filter(where c.clean_pass)::int as clean,
    coalesce(ast.stars,0)::int as stars
  from cells c
  left join assignment_stars ast
    on ast.student_id=c.student_id and ast.mode=c.mode
  group by c.student_id,c.mode,ast.stars
),
student_rollup as (
  select s.id,s.name,s.korean_name,
    exists(
      select 1 from public.study_attempts sa
      where sa.assignment_id=p_assignment_id and sa.student_id=s.id
    ) as started,
    coalesce(sum(mr.clean),0)::int as clean_cells,
    coalesce(sum(mr.total),0)::int as total_cells,
    coalesce(
      jsonb_object_agg(
        mr.mode,
        jsonb_build_object(
          'clean',mr.clean,
          'total',mr.total,
          'percent',case when mr.total>0 then round(100.0*mr.clean/mr.total) else 0 end,
          'stars',mr.stars,
          'star_max',10
        )
      ) filter(where mr.mode is not null),
      '{}'::jsonb
    ) as modes
  from students s
  left join mode_rollup mr on mr.student_id=s.id
  group by s.id,s.name,s.korean_name
)
select coalesce((
  select jsonb_build_object(
    'success',true,
    'assignment',jsonb_build_object(
      'id',a.id,
      'class',a.class,
      'title',a.title,
      'description',a.description,
      'source_type',a.source_type,
      'start_at',a.start_at,
      'due_at',a.due_at,
      'status',a.status,
      'active',a.active,
      'created_by',a.created_by,
      'required_modes',a.required_modes,
      'star_max_per_mode',10
    ),
    'target_count',(select count(*) from targets),
    'targets',coalesce((
      select jsonb_agg(jsonb_build_object(
        'lexical_entry_id',t.lexical_entry_id,
        'position',t.position,
        'english',t.english_snapshot,
        'korean',t.korean_snapshot
      ) order by t.position,t.created_at)
      from targets t
    ),'[]'::jsonb),
    'students',coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id',sr.id,
        'name',sr.name,
        'korean_name',sr.korean_name,
        'status',case
          when sr.total_cells>0 and sr.clean_cells>=sr.total_cells then 'complete'
          when sr.started then 'in_progress'
          else 'not_started'
        end,
        'completion_percent',case when sr.total_cells>0 then round(100.0*sr.clean_cells/sr.total_cells) else 0 end,
        'clean_cells',sr.clean_cells,
        'total_cells',sr.total_cells,
        'modes',sr.modes
      ) order by coalesce(sr.korean_name,sr.name),sr.name)
      from student_rollup sr
    ),'[]'::jsonb)
  )
  from assignment a
),jsonb_build_object('success',false,'error','Assignment not found or is not vocab_study'));
$function$

