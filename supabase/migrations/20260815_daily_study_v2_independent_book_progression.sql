-- Daily Study V2: independent per-book progression.
-- Manual unit selection in Study V2 no longer controls the Daily Study cursor.

create table if not exists public.daily_study_book_state (
  student_id uuid not null references public.profiles(id) on delete cascade,
  book_id text not null,
  assignment_unit_id text,
  assignment_unit_number integer,
  current_unit_id text not null,
  current_unit_number integer,
  previous_unit_id text,
  previous_unit_number integer,
  updated_at timestamptz not null default now(),
  primary key (student_id, book_id)
);

create table if not exists public.daily_study_unit_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  book_id text not null,
  unit_id text not null,
  unit_number integer,
  attempts integer not null default 0,
  correct integer not null default 0,
  recent_results jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (student_id, book_id, unit_id)
);

create index if not exists daily_study_unit_progress_student_book_idx
  on public.daily_study_unit_progress(student_id, book_id);

alter table public.daily_study_book_state enable row level security;
alter table public.daily_study_unit_progress enable row level security;
revoke all on public.daily_study_book_state from anon, authenticated;
revoke all on public.daily_study_unit_progress from anon, authenticated;

create or replace function public.daily_study_v2_progress_snapshot(p_student_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'book_states', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.book_id)
      from public.daily_study_book_state s
      where s.student_id = p_student_id
    ), '[]'::jsonb),
    'unit_progress', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.book_id, u.unit_number, u.unit_id)
      from public.daily_study_unit_progress u
      where u.student_id = p_student_id
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_daily_study_v2(p_student_id uuid, p_study_date date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row public.daily_study_sessions%rowtype;
  v_carry jsonb := '[]'::jsonb;
  v_snapshot jsonb;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'Cannot read Daily Study for another student';
  end if;

  v_snapshot := public.daily_study_v2_progress_snapshot(p_student_id);

  select * into v_row
  from public.daily_study_sessions
  where student_id = p_student_id and study_date = p_study_date;

  if found then
    return jsonb_build_object(
      'success', true,
      'needs_plan', false,
      'session', to_jsonb(v_row),
      'resolved_count', jsonb_array_length(v_row.resolved_keys)
    ) || v_snapshot;
  end if;

  select wrong_items into v_carry
  from public.daily_study_sessions
  where student_id = p_student_id
    and study_date < p_study_date
    and jsonb_array_length(wrong_items) > 0
  order by study_date desc
  limit 1;

  return jsonb_build_object(
    'success', true,
    'needs_plan', true,
    'carryover', coalesce(v_carry, '[]'::jsonb),
    'resolved_count', 0
  ) || v_snapshot;
end;
$$;

create or replace function public.create_daily_study_v2(p_student_id uuid, p_study_date date, p_plan jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_carry jsonb := '[]'::jsonb;
  v_plan jsonb := '[]'::jsonb;
  v_row public.daily_study_sessions%rowtype;
  v_book_id text;
  v_assignment_unit_id text;
  v_assignment_unit_number integer;
  v_current_unit_id text;
  v_current_unit_number integer;
  v_snapshot jsonb;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'Cannot create Daily Study for another student';
  end if;
  if p_student_id is null or not exists(select 1 from public.profiles where id=p_student_id and role='student') then
    raise exception 'Invalid student';
  end if;
  if jsonb_typeof(p_plan) <> 'array' then raise exception 'Daily plan must be an array'; end if;
  if jsonb_array_length(p_plan) < 20 then raise exception 'Daily plan needs at least 20 candidates'; end if;
  if jsonb_array_length(p_plan) > 80 then raise exception 'Daily plan is too large'; end if;

  select wrong_items into v_carry
  from public.daily_study_sessions
  where student_id = p_student_id
    and study_date < p_study_date
    and jsonb_array_length(wrong_items) > 0
  order by study_date desc
  limit 1;

  with combined as (
    select item, ord,
           coalesce(nullif(item->>'daily_key',''), nullif(item->>'id','')) as k
    from jsonb_array_elements(coalesce(v_carry,'[]'::jsonb) || p_plan) with ordinality e(item,ord)
  ), dedup as (
    select distinct on (k) item, ord
    from combined
    where k is not null
    order by k, ord
  )
  select coalesce(jsonb_agg(item order by ord),'[]'::jsonb) into v_plan from dedup;

  if jsonb_array_length(v_plan) < 20 then raise exception 'Daily plan has fewer than 20 unique candidates'; end if;

  for v_book_id, v_assignment_unit_id, v_assignment_unit_number, v_current_unit_id, v_current_unit_number in
    select distinct
      nullif(item #>> '{metadata,book_id}', ''),
      nullif(item #>> '{metadata,daily_assignment_unit_id}', ''),
      nullif(item #>> '{metadata,daily_assignment_unit_number}', '')::integer,
      nullif(item #>> '{metadata,daily_cursor_unit_id}', ''),
      nullif(item #>> '{metadata,daily_cursor_unit_number}', '')::integer
    from jsonb_array_elements(p_plan) item
    where item #>> '{metadata,daily_role}' = 'current'
      and nullif(item #>> '{metadata,book_id}', '') is not null
      and nullif(item #>> '{metadata,daily_cursor_unit_id}', '') is not null
  loop
    insert into public.daily_study_book_state(
      student_id, book_id, assignment_unit_id, assignment_unit_number,
      current_unit_id, current_unit_number, updated_at
    ) values (
      p_student_id, v_book_id, v_assignment_unit_id, v_assignment_unit_number,
      v_current_unit_id, v_current_unit_number, now()
    )
    on conflict (student_id, book_id) do update set
      assignment_unit_id = excluded.assignment_unit_id,
      assignment_unit_number = excluded.assignment_unit_number,
      current_unit_id = case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then excluded.current_unit_id
        else public.daily_study_book_state.current_unit_id
      end,
      current_unit_number = case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then excluded.current_unit_number
        else public.daily_study_book_state.current_unit_number
      end,
      previous_unit_id = case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then null
        else public.daily_study_book_state.previous_unit_id
      end,
      previous_unit_number = case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then null
        else public.daily_study_book_state.previous_unit_number
      end,
      updated_at = now();
  end loop;

  insert into public.daily_study_sessions(student_id,study_date,target,plan)
  values(p_student_id,p_study_date,20,v_plan)
  on conflict(student_id,study_date) do nothing;

  select * into v_row
  from public.daily_study_sessions
  where student_id=p_student_id and study_date=p_study_date;

  v_snapshot := public.daily_study_v2_progress_snapshot(p_student_id);
  return jsonb_build_object(
    'success',true,
    'needs_plan',false,
    'session',to_jsonb(v_row),
    'resolved_count',jsonb_array_length(v_row.resolved_keys)
  ) || v_snapshot;
end;
$$;

create or replace function public.answer_daily_study_v2(p_student_id uuid, p_study_date date, p_daily_key text, p_correct boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.daily_study_sessions%rowtype;
  v_item jsonb;
  v_meta jsonb;
  v_expected text;
  v_resolved jsonb;
  v_wrong jsonb;
  v_count integer;
  v_next_cursor integer;
  v_book_id text;
  v_unit_id text;
  v_unit_number integer;
  v_next_unit_id text;
  v_next_unit_number integer;
  v_recent jsonb := '[]'::jsonb;
  v_attempts integer := 0;
  v_recent_count integer := 0;
  v_recent_correct integer := 0;
  v_snapshot jsonb;
begin
  if auth.uid() is not null and auth.uid() <> p_student_id then
    raise exception 'Cannot update Daily Study for another student';
  end if;

  select * into v_row
  from public.daily_study_sessions
  where student_id=p_student_id and study_date=p_study_date
  for update;

  if not found then raise exception 'Daily Study session not found'; end if;
  if v_row.status='completed' then
    v_snapshot := public.daily_study_v2_progress_snapshot(p_student_id);
    return jsonb_build_object('success',true,'completed',true,'session',to_jsonb(v_row),'resolved_count',jsonb_array_length(v_row.resolved_keys)) || v_snapshot;
  end if;
  if v_row.cursor >= jsonb_array_length(v_row.plan) then raise exception 'Daily Study candidate plan exhausted'; end if;

  v_item := v_row.plan -> v_row.cursor;
  v_expected := coalesce(nullif(v_item->>'daily_key',''), nullif(v_item->>'id',''));
  if v_expected is null or p_daily_key is distinct from v_expected then
    v_snapshot := public.daily_study_v2_progress_snapshot(p_student_id);
    return jsonb_build_object(
      'success',false,
      'stale',true,
      'expected_key',v_expected,
      'session',to_jsonb(v_row),
      'resolved_count',jsonb_array_length(v_row.resolved_keys)
    ) || v_snapshot;
  end if;

  v_resolved := v_row.resolved_keys;
  v_wrong := v_row.wrong_items;

  if p_correct then
    if not exists(select 1 from jsonb_array_elements_text(v_resolved) x where x=p_daily_key) then
      v_resolved := v_resolved || to_jsonb(p_daily_key);
    end if;
  else
    if not exists(
      select 1 from jsonb_array_elements(v_wrong) x
      where coalesce(nullif(x->>'daily_key',''),nullif(x->>'id','')) = p_daily_key
    ) then
      v_wrong := v_wrong || jsonb_build_array(v_item);
    end if;
  end if;

  v_meta := coalesce(v_item->'metadata','{}'::jsonb);
  v_book_id := nullif(v_meta->>'book_id','');
  v_unit_id := nullif(v_meta->>'unit_id','');
  v_unit_number := nullif(v_meta->>'daily_unit_number','')::integer;
  v_next_unit_id := nullif(v_meta->>'daily_next_unit_id','');
  v_next_unit_number := nullif(v_meta->>'daily_next_unit_number','')::integer;

  if v_book_id is not null and v_unit_id is not null then
    select recent_results into v_recent
    from public.daily_study_unit_progress
    where student_id=p_student_id and book_id=v_book_id and unit_id=v_unit_id
    for update;
    v_recent := coalesce(v_recent,'[]'::jsonb) || jsonb_build_array(p_correct);
    if jsonb_array_length(v_recent) > 20 then
      select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
      into v_recent
      from jsonb_array_elements(v_recent) with ordinality e(value,ord)
      where ord > jsonb_array_length(v_recent) - 20;
    end if;

    insert into public.daily_study_unit_progress(
      student_id,book_id,unit_id,unit_number,attempts,correct,recent_results,updated_at
    ) values (
      p_student_id,v_book_id,v_unit_id,v_unit_number,1,case when p_correct then 1 else 0 end,v_recent,now()
    )
    on conflict(student_id,book_id,unit_id) do update set
      unit_number=coalesce(excluded.unit_number,public.daily_study_unit_progress.unit_number),
      attempts=public.daily_study_unit_progress.attempts+1,
      correct=public.daily_study_unit_progress.correct+(case when p_correct then 1 else 0 end),
      recent_results=excluded.recent_results,
      updated_at=now();

    select attempts,recent_results into v_attempts,v_recent
    from public.daily_study_unit_progress
    where student_id=p_student_id and book_id=v_book_id and unit_id=v_unit_id;
    v_recent_count := jsonb_array_length(coalesce(v_recent,'[]'::jsonb));
    select count(*) into v_recent_correct
    from jsonb_array_elements(coalesce(v_recent,'[]'::jsonb)) e(value)
    where e.value = 'true'::jsonb;

    if v_attempts >= 20
       and v_recent_count >= 10
       and v_recent_correct::numeric / nullif(v_recent_count,0) >= 0.90
       and v_next_unit_id is not null
       and exists(
         select 1 from public.daily_study_book_state s
         where s.student_id=p_student_id and s.book_id=v_book_id and s.current_unit_id=v_unit_id
       ) then
      update public.daily_study_book_state
      set previous_unit_id=current_unit_id,
          previous_unit_number=current_unit_number,
          current_unit_id=v_next_unit_id,
          current_unit_number=v_next_unit_number,
          updated_at=now()
      where student_id=p_student_id and book_id=v_book_id and current_unit_id=v_unit_id;
    end if;
  end if;

  v_count := jsonb_array_length(v_resolved);
  v_next_cursor := v_row.cursor + 1;

  update public.daily_study_sessions
  set cursor=v_next_cursor,
      resolved_keys=v_resolved,
      wrong_items=v_wrong,
      status=case when v_count>=20 then 'completed' else 'active' end,
      completed_at=case when v_count>=20 then coalesce(completed_at,now()) else completed_at end,
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  v_snapshot := public.daily_study_v2_progress_snapshot(p_student_id);
  return jsonb_build_object(
    'success',true,
    'completed',(v_row.status='completed'),
    'session',to_jsonb(v_row),
    'resolved_count',jsonb_array_length(v_row.resolved_keys)
  ) || v_snapshot;
end;
$$;