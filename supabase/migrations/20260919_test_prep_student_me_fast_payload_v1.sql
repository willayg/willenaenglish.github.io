-- P6: compact payload for test-prep-student-rev47e?action=me.
-- Keeps the client response shape while eliminating raw history downloads.

create or replace function public.test_prep_student_me_fast_payload_v1(p_student_id uuid)
returns jsonb
language sql
security definer
set search_path=public,pg_temp
as $$
with plans as materialized (
  select p.*
  from public.test_prep_plans p
  where p.student_id=p_student_id and p.active=true
  order by p.exam_date asc nulls last
),
groups as materialized (
  select g.*
  from public.test_prep_groups g
  where g.id in (select group_id from plans where group_id is not null)
),
snap as materialized (
  select s.plan_id,s.stats,s.today,s.review,s.updated_at,s.snapshot_version
  from public.test_prep_teacher_dashboard_snapshots s
  where s.plan_id in (select id from plans)
),
task_rows as materialized (
  select t.*,
         greatest(1,coalesce(t.target_count,10)) as target_safe,
         coalesce((
           select count(distinct a.question_id)
           from public.test_prep_attempts a
           where a.student_id=p_student_id
             and a.plan_id=t.plan_id
             and coalesce(a.unit_key,'')=coalesce(t.lesson,'')
             and lower(coalesce(a.practice_type,''))=lower(coalesce(t.practice_type,''))
             and a.attempted_at>=t.created_at
         ),0)::int as done_count
  from public.test_prep_tasks t
  where t.student_id=p_student_id
    and t.plan_id in (select id from plans)
    and t.active=true
),
task_json as materialized (
  select t.plan_id,
         jsonb_agg(
           to_jsonb(t)-'target_safe'-'done_count' ||
           jsonb_build_object(
             'progress',jsonb_build_object(
               'done',t.done_count,
               'target',t.target_safe,
               'remaining',greatest(0,t.target_safe-t.done_count),
               'percent',least(100,round(t.done_count::numeric/t.target_safe*100)::int)
             )
           )
           order by t.due_at asc nulls last,t.created_at desc
         ) as tasks
  from task_rows t
  group by t.plan_id
),
plan_json as (
  select
    p.id,
    (
      to_jsonb(p)
      || jsonb_build_object(
        'group',case when g.id is null then null else to_jsonb(g) end,
        'summary',coalesce(s.stats->'summary','{}'::jsonb),
        'tasks',coalesce(tj.tasks,'[]'::jsonb),
        '_fast_snapshot',jsonb_build_object(
          'updated_at',s.updated_at,
          'snapshot_version',s.snapshot_version,
          'today',coalesce(s.today,'{}'::jsonb),
          'review',coalesce(s.review,'{}'::jsonb)
        )
      )
    ) as item
  from plans p
  left join groups g on g.id=p.group_id
  left join snap s on s.plan_id=p.id
  left join task_json tj on tj.plan_id=p.id
)
select jsonb_build_object(
  'plans',coalesce((select jsonb_agg(item order by (item->>'exam_date')::timestamptz asc nulls last) from plan_json),'[]'::jsonb),
  'tasks',coalesce((select jsonb_agg(to_jsonb(t)-'target_safe'-'done_count' ||
    jsonb_build_object('progress',jsonb_build_object(
      'done',t.done_count,'target',t.target_safe,'remaining',greatest(0,t.target_safe-t.done_count),
      'percent',least(100,round(t.done_count::numeric/t.target_safe*100)::int)
    )) order by t.due_at asc nulls last,t.created_at desc) from task_rows t),'[]'::jsonb)
);
$$;

revoke all on function public.test_prep_student_me_fast_payload_v1(uuid) from public,anon,authenticated;
grant execute on function public.test_prep_student_me_fast_payload_v1(uuid) to service_role;
