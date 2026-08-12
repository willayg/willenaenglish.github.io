-- Recoverable archive support for internal and prospective level-test attempts.
-- The public RPC surface is restricted to signed-in, approved administrators.

alter table public.student_assessment_attempts
  add column if not exists archived_at timestamptz;

alter table public.prospective_level_test_attempts
  add column if not exists archived_at timestamptz;

create index if not exists student_assessment_attempts_archived_at_idx
  on public.student_assessment_attempts (archived_at desc)
  where archived_at is not null;

create index if not exists prospective_level_test_attempts_archived_at_idx
  on public.prospective_level_test_attempts (archived_at desc)
  where archived_at is not null;

create or replace function public.admin_set_level_test_archived(
  p_source text,
  p_attempt_id uuid,
  p_archived boolean
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_archived_at timestamptz := case when p_archived then clock_timestamp() else null end;
  v_updated integer := 0;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'admin'
      and p.approved is distinct from false
  ) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  if p_source = 'internal' then
    update public.student_assessment_attempts
    set archived_at = v_archived_at
    where id = p_attempt_id;
  elsif p_source = 'prospective' then
    update public.prospective_level_test_attempts
    set archived_at = v_archived_at
    where id = p_attempt_id;
  else
    raise exception 'Invalid level test source' using errcode = '22023';
  end if;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    raise exception 'Level test not found' using errcode = 'P0002';
  end if;

  return v_archived_at;
end;
$$;

create or replace function public.admin_list_archived_level_tests()
returns table (
  source text,
  id uuid,
  student_name text,
  korean_name text,
  username text,
  grade text,
  school text,
  class_name text,
  status text,
  recommended_level integer,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz,
  archived_at timestamptz,
  is_new boolean
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and lower(coalesce(p.role, '')) = 'admin'
      and p.approved is distinct from false
  ) then
    raise exception 'Admins only' using errcode = '42501';
  end if;

  return query
  select * from (
  select
    'internal'::text,
    a.id,
    coalesce(p.name, p.korean_name, p.username, 'Student')::text,
    p.korean_name::text,
    p.username::text,
    p.grade::text,
    p.school::text,
    coalesce(a.metadata ->> 'class_at_test', p.class)::text,
    a.status::text,
    a.recommended_level::integer,
    a.started_at,
    a.completed_at,
    a.updated_at,
    a.archived_at,
    false
  from public.student_assessment_attempts a
  left join public.profiles p on p.id = a.student_id
  where a.archived_at is not null

  union all

  select
    'prospective'::text,
    a.id,
    coalesce(c.student_name, 'Prospective student')::text,
    null::text,
    null::text,
    c.school_grade::text,
    c.school_name::text,
    null::text,
    a.status::text,
    coalesce(a.recommended_level, a.display_level)::integer,
    a.started_at,
    a.completed_at,
    a.updated_at,
    a.archived_at,
    false
  from public.prospective_level_test_attempts a
  left join public.prospective_level_test_candidates c on c.id = a.candidate_id
  where a.archived_at is not null
  ) archived_tests
  order by archived_tests.archived_at desc;
end;
$$;

revoke all on function public.admin_set_level_test_archived(text, uuid, boolean) from public, anon;
revoke all on function public.admin_list_archived_level_tests() from public, anon;
grant execute on function public.admin_set_level_test_archived(text, uuid, boolean) to authenticated;
grant execute on function public.admin_list_archived_level_tests() to authenticated;
