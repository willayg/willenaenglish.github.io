-- Vocabulary Study P4A: generic assignment envelope + canonical assignment tracking.

alter table public.homework_assignments
  drop constraint if exists homework_assignments_source_type_check;

alter table public.homework_assignments
  add constraint homework_assignments_source_type_check
  check (source_type in ('wordlist','saved_game','vocab_study'));

alter table public.study_attempts
  add column if not exists assignment_id uuid null
  references public.homework_assignments(id) on delete set null;

create index if not exists study_attempts_assignment_student_idx
  on public.study_attempts(assignment_id, student_id, created_at desc)
  where assignment_id is not null;

create index if not exists study_attempts_assignment_target_mode_idx
  on public.study_attempts(assignment_id, mastery_content_id, student_id)
  where assignment_id is not null;

create table if not exists public.study_assignment_targets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  lexical_entry_id uuid not null,
  position integer not null default 0,
  english_snapshot text,
  korean_snapshot text,
  created_at timestamptz not null default now(),
  unique (assignment_id, lexical_entry_id)
);

create index if not exists study_assignment_targets_assignment_position_idx
  on public.study_assignment_targets(assignment_id, position, lexical_entry_id);

alter table public.study_assignment_targets enable row level security;
revoke all on table public.study_assignment_targets from anon, authenticated;
grant all on table public.study_assignment_targets to service_role;

create or replace function public.study_attempts_capture_assignment_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_assignment_text text;
begin
  if new.assignment_id is not null then
    return new;
  end if;
  v_assignment_text := nullif(new.metadata->>'assignment_id','');
  if v_assignment_text is null then
    return new;
  end if;
  begin
    new.assignment_id := v_assignment_text::uuid;
  exception when invalid_text_representation then
    new.assignment_id := null;
  end;
  return new;
end;
$$;

drop trigger if exists study_attempts_capture_assignment_v1 on public.study_attempts;
create trigger study_attempts_capture_assignment_v1
before insert or update of metadata, assignment_id on public.study_attempts
for each row execute function public.study_attempts_capture_assignment_v1();

create or replace function public.get_vocab_assignment_progress_v1(p_assignment_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
with assignment as (
  select h.*,
    case
      when jsonb_typeof(h.list_meta->'required_modes')='array'
       and jsonb_array_length(h.list_meta->'required_modes')>0
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
mode_rollup as (
  select student_id,mode,
    count(*)::int as total,
    count(*) filter(where clean_pass)::int as clean
  from cells
  group by student_id,mode
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
          'percent',case when mr.total>0 then round(100.0*mr.clean/mr.total) else 0 end
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
      'required_modes',a.required_modes
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
$$;

revoke execute on function public.get_vocab_assignment_progress_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.get_vocab_assignment_progress_v1(uuid)
  to service_role;
