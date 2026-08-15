-- Daily Study V3: paced per-book progression, historical weak-point review,
-- spaced review scheduling, and an isolated staging test track.

alter table public.daily_study_sessions
  add column if not exists track text not null default 'live';

alter table public.daily_study_book_state
  add column if not exists track text not null default 'live',
  add column if not exists pace_type text not null default 'course',
  add column if not exists current_unit_study_days integer not null default 0,
  add column if not exists total_study_days integer not null default 0,
  add column if not exists current_unit_started_date date,
  add column if not exists last_study_date date,
  add column if not exists last_promotion_date date,
  add column if not exists attention_needed boolean not null default false;

alter table public.daily_study_unit_progress
  add column if not exists track text not null default 'live',
  add column if not exists study_days integer not null default 0,
  add column if not exists first_study_date date,
  add column if not exists last_study_date date,
  add column if not exists seen_keys jsonb not null default '[]'::jsonb;

alter table public.daily_study_sessions
  drop constraint if exists daily_study_sessions_student_id_study_date_key;
alter table public.daily_study_sessions
  add constraint daily_study_sessions_student_date_track_key unique(student_id, study_date, track);

alter table public.daily_study_book_state
  drop constraint if exists daily_study_book_state_pkey;
alter table public.daily_study_book_state
  add constraint daily_study_book_state_pkey primary key(student_id, book_id, track);

alter table public.daily_study_unit_progress
  drop constraint if exists daily_study_unit_progress_pkey;
alter table public.daily_study_unit_progress
  add constraint daily_study_unit_progress_pkey primary key(student_id, book_id, unit_id, track);

create table if not exists public.daily_study_item_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  book_id text not null,
  unit_id text not null,
  track text not null default 'live',
  daily_key text not null,
  unit_number integer,
  skill text,
  attempts integer not null default 0,
  correct integer not null default 0,
  lapses integer not null default 0,
  streak integer not null default 0,
  recent_results jsonb not null default '[]'::jsonb,
  first_seen_date date,
  last_seen_date date,
  last_seen_study_day integer not null default 0,
  next_due_study_day integer not null default 1,
  last_role text,
  updated_at timestamptz not null default now(),
  primary key(student_id, book_id, daily_key, track)
);

create index if not exists daily_study_item_progress_review_idx
  on public.daily_study_item_progress(student_id, track, book_id, next_due_study_day, lapses desc);

alter table public.daily_study_item_progress enable row level security;
revoke all on public.daily_study_item_progress from anon, authenticated;

create or replace function public.daily_study_v3_progress_snapshot(
  p_student_id uuid,
  p_track text,
  p_study_date date
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'track', p_track,
    'study_date', p_study_date,
    'book_states', coalesce((
      select jsonb_agg(to_jsonb(s) order by s.book_id)
      from public.daily_study_book_state s
      where s.student_id = p_student_id and s.track = p_track
    ), '[]'::jsonb),
    'unit_progress', coalesce((
      select jsonb_agg(to_jsonb(u) order by u.book_id, u.unit_number, u.unit_id)
      from public.daily_study_unit_progress u
      where u.student_id = p_student_id and u.track = p_track
    ), '[]'::jsonb),
    'review_items', coalesce((
      select jsonb_agg(to_jsonb(q) order by q.priority_rank, q.lapses desc, q.next_due_study_day, q.last_seen_study_day)
      from (
        select i.*,
               case
                 when i.lapses > 0 and i.next_due_study_day <= coalesce(s.total_study_days,0) + 1 then 0
                 when i.lapses > 0 then 1
                 when i.next_due_study_day <= coalesce(s.total_study_days,0) + 1 then 2
                 else 3
               end as priority_rank
        from public.daily_study_item_progress i
        left join public.daily_study_book_state s
          on s.student_id=i.student_id and s.book_id=i.book_id and s.track=i.track
        where i.student_id = p_student_id
          and i.track = p_track
          and (
            i.lapses > 0
            or i.next_due_study_day <= coalesce(s.total_study_days,0) + 1
          )
        order by priority_rank, i.lapses desc, i.next_due_study_day, i.last_seen_study_day
        limit 200
      ) q
    ), '[]'::jsonb)
  );
$$;

create or replace function public.daily_study_v3_get(
  p_student_id uuid,
  p_study_date date,
  p_track text
)
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
  if p_track not in ('live','test') then raise exception 'Invalid Daily Study track'; end if;
  v_snapshot := public.daily_study_v3_progress_snapshot(p_student_id,p_track,p_study_date);

  select * into v_row
  from public.daily_study_sessions
  where student_id=p_student_id and study_date=p_study_date and track=p_track;

  if found then
    return jsonb_build_object(
      'success',true,
      'needs_plan',false,
      'session',to_jsonb(v_row),
      'resolved_count',jsonb_array_length(v_row.resolved_keys)
    ) || v_snapshot;
  end if;

  select wrong_items into v_carry
  from public.daily_study_sessions
  where student_id=p_student_id
    and study_date<p_study_date
    and track=p_track
    and jsonb_array_length(wrong_items)>0
  order by study_date desc
  limit 1;

  return jsonb_build_object(
    'success',true,
    'needs_plan',true,
    'carryover',coalesce(v_carry,'[]'::jsonb),
    'resolved_count',0
  ) || v_snapshot;
end;
$$;

create or replace function public.daily_study_v3_create(
  p_student_id uuid,
  p_study_date date,
  p_plan jsonb,
  p_track text
)
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
  v_pace_type text;
  v_snapshot jsonb;
begin
  if p_track not in ('live','test') then raise exception 'Invalid Daily Study track'; end if;
  if p_student_id is null or not exists(select 1 from public.profiles where id=p_student_id and role='student') then
    raise exception 'Invalid student';
  end if;
  if jsonb_typeof(p_plan) <> 'array' then raise exception 'Daily plan must be an array'; end if;
  if jsonb_array_length(p_plan) < 20 then raise exception 'Daily plan needs at least 20 candidates'; end if;
  if jsonb_array_length(p_plan) > 80 then raise exception 'Daily plan is too large'; end if;

  select wrong_items into v_carry
  from public.daily_study_sessions
  where student_id=p_student_id
    and study_date<p_study_date
    and track=p_track
    and jsonb_array_length(wrong_items)>0
  order by study_date desc
  limit 1;

  with combined as (
    select item, ord,
           coalesce(nullif(item->>'daily_key',''),nullif(item->>'id','')) as k
    from jsonb_array_elements(coalesce(v_carry,'[]'::jsonb) || p_plan) with ordinality e(item,ord)
  ), dedup as (
    select distinct on (k) item, ord
    from combined
    where k is not null
    order by k, ord
  )
  select coalesce(jsonb_agg(item order by ord),'[]'::jsonb)
  into v_plan
  from dedup;

  if jsonb_array_length(v_plan) < 20 then raise exception 'Daily plan has fewer than 20 unique candidates'; end if;

  insert into public.daily_study_sessions(student_id,study_date,target,plan,track)
  values(p_student_id,p_study_date,20,v_plan,p_track)
  on conflict(student_id,study_date,track) do nothing
  returning * into v_row;

  if not found then
    select * into v_row
    from public.daily_study_sessions
    where student_id=p_student_id and study_date=p_study_date and track=p_track;
    v_snapshot := public.daily_study_v3_progress_snapshot(p_student_id,p_track,p_study_date);
    return jsonb_build_object(
      'success',true,'needs_plan',false,'session',to_jsonb(v_row),
      'resolved_count',jsonb_array_length(v_row.resolved_keys)
    ) || v_snapshot;
  end if;

  for v_book_id, v_assignment_unit_id, v_assignment_unit_number,
      v_current_unit_id, v_current_unit_number, v_pace_type in
    select distinct
      nullif(item #>> '{metadata,book_id}',''),
      nullif(item #>> '{metadata,daily_assignment_unit_id}',''),
      nullif(item #>> '{metadata,daily_assignment_unit_number}','')::integer,
      nullif(item #>> '{metadata,daily_cursor_unit_id}',''),
      nullif(item #>> '{metadata,daily_cursor_unit_number}','')::integer,
      coalesce(nullif(item #>> '{metadata,daily_pace_type}',''),'course')
    from jsonb_array_elements(p_plan) item
    where item #>> '{metadata,daily_role}'='current'
      and nullif(item #>> '{metadata,book_id}','') is not null
      and nullif(item #>> '{metadata,daily_cursor_unit_id}','') is not null
  loop
    if v_pace_type not in ('reading','course','supplementary') then v_pace_type := 'course'; end if;

    insert into public.daily_study_book_state(
      student_id,book_id,track,pace_type,
      assignment_unit_id,assignment_unit_number,
      current_unit_id,current_unit_number,
      current_unit_study_days,total_study_days,
      current_unit_started_date,last_study_date,attention_needed,updated_at
    ) values (
      p_student_id,v_book_id,p_track,v_pace_type,
      v_assignment_unit_id,v_assignment_unit_number,
      v_current_unit_id,v_current_unit_number,
      1,1,p_study_date,p_study_date,false,now()
    )
    on conflict(student_id,book_id,track) do update set
      pace_type=excluded.pace_type,
      assignment_unit_id=excluded.assignment_unit_id,
      assignment_unit_number=excluded.assignment_unit_number,
      current_unit_id=case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then excluded.current_unit_id
        else public.daily_study_book_state.current_unit_id
      end,
      current_unit_number=case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then excluded.current_unit_number
        else public.daily_study_book_state.current_unit_number
      end,
      previous_unit_id=case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then null
        else public.daily_study_book_state.previous_unit_id
      end,
      previous_unit_number=case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then null
        else public.daily_study_book_state.previous_unit_number
      end,
      current_unit_study_days=case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then 1
        when public.daily_study_book_state.last_study_date is distinct from p_study_date
        then public.daily_study_book_state.current_unit_study_days+1
        else public.daily_study_book_state.current_unit_study_days
      end,
      total_study_days=case
        when public.daily_study_book_state.last_study_date is distinct from p_study_date
        then public.daily_study_book_state.total_study_days+1
        else public.daily_study_book_state.total_study_days
      end,
      current_unit_started_date=case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then p_study_date
        else coalesce(public.daily_study_book_state.current_unit_started_date,p_study_date)
      end,
      last_study_date=p_study_date,
      attention_needed=case
        when excluded.assignment_unit_id is not null
         and public.daily_study_book_state.assignment_unit_id is distinct from excluded.assignment_unit_id
        then false
        else public.daily_study_book_state.attention_needed
      end,
      updated_at=now();
  end loop;

  v_snapshot := public.daily_study_v3_progress_snapshot(p_student_id,p_track,p_study_date);
  return jsonb_build_object(
    'success',true,'needs_plan',false,'session',to_jsonb(v_row),
    'resolved_count',jsonb_array_length(v_row.resolved_keys)
  ) || v_snapshot;
end;
$$;

create or replace function public.daily_study_v3_answer(
  p_student_id uuid,
  p_study_date date,
  p_daily_key text,
  p_correct boolean,
  p_track text
)
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
  v_skill text;
  v_role text;
  v_next_unit_id text;
  v_next_unit_number integer;
  v_up public.daily_study_unit_progress%rowtype;
  v_ip public.daily_study_item_progress%rowtype;
  v_state public.daily_study_book_state%rowtype;
  v_recent jsonb := '[]'::jsonb;
  v_seen jsonb := '[]'::jsonb;
  v_item_recent jsonb := '[]'::jsonb;
  v_recent_count integer := 0;
  v_recent_correct integer := 0;
  v_unique integer := 0;
  v_accuracy numeric := 0;
  v_book_day integer := 1;
  v_new_streak integer := 0;
  v_due_gap integer := 1;
  v_min_days integer := 5;
  v_normal_days integer := 10;
  v_fast_attempts integer := 25;
  v_normal_attempts integer := 35;
  v_slow_attempts integer := 50;
  v_fast boolean := false;
  v_normal boolean := false;
  v_slow_release boolean := false;
  v_snapshot jsonb;
begin
  if p_track not in ('live','test') then raise exception 'Invalid Daily Study track'; end if;

  select * into v_row
  from public.daily_study_sessions
  where student_id=p_student_id and study_date=p_study_date and track=p_track
  for update;

  if not found then raise exception 'Daily Study session not found'; end if;
  if v_row.status='completed' then
    v_snapshot := public.daily_study_v3_progress_snapshot(p_student_id,p_track,p_study_date);
    return jsonb_build_object(
      'success',true,'completed',true,'session',to_jsonb(v_row),
      'resolved_count',jsonb_array_length(v_row.resolved_keys)
    ) || v_snapshot;
  end if;
  if v_row.cursor >= jsonb_array_length(v_row.plan) then raise exception 'Daily Study candidate plan exhausted'; end if;

  v_item := v_row.plan -> v_row.cursor;
  v_expected := coalesce(nullif(v_item->>'daily_key',''),nullif(v_item->>'id',''));
  if v_expected is null or p_daily_key is distinct from v_expected then
    v_snapshot := public.daily_study_v3_progress_snapshot(p_student_id,p_track,p_study_date);
    return jsonb_build_object(
      'success',false,'stale',true,'expected_key',v_expected,
      'session',to_jsonb(v_row),'resolved_count',jsonb_array_length(v_row.resolved_keys)
    ) || v_snapshot;
  end if;

  v_resolved := v_row.resolved_keys;
  v_wrong := v_row.wrong_items;

  if p_correct then
    if not exists(select 1 from jsonb_array_elements_text(v_resolved) x where x=p_daily_key) then
      v_resolved := v_resolved || jsonb_build_array(p_daily_key);
    end if;
  else
    if not exists(
      select 1 from jsonb_array_elements(v_wrong) x
      where coalesce(nullif(x->>'daily_key',''),nullif(x->>'id',''))=p_daily_key
    ) then
      v_wrong := v_wrong || jsonb_build_array(v_item);
    end if;
  end if;

  v_meta := coalesce(v_item->'metadata','{}'::jsonb);
  v_book_id := nullif(v_meta->>'book_id','');
  v_unit_id := nullif(v_meta->>'unit_id','');
  v_unit_number := nullif(v_meta->>'daily_unit_number','')::integer;
  v_skill := coalesce(nullif(v_item->>'skill',''),nullif(v_meta->>'skill',''));
  v_role := coalesce(nullif(v_meta->>'daily_role',''),'current');
  v_next_unit_id := nullif(v_meta->>'daily_next_unit_id','');
  v_next_unit_number := nullif(v_meta->>'daily_next_unit_number','')::integer;

  if v_book_id is not null and v_unit_id is not null then
    select * into v_state
    from public.daily_study_book_state
    where student_id=p_student_id and book_id=v_book_id and track=p_track;
    if found then v_book_day := greatest(1,v_state.total_study_days); end if;

    select * into v_up
    from public.daily_study_unit_progress
    where student_id=p_student_id and book_id=v_book_id and unit_id=v_unit_id and track=p_track
    for update;

    if found then
      v_recent := coalesce(v_up.recent_results,'[]'::jsonb) || jsonb_build_array(p_correct);
      if jsonb_array_length(v_recent)>20 then
        select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
        into v_recent
        from jsonb_array_elements(v_recent) with ordinality e(value,ord)
        where ord>jsonb_array_length(v_recent)-20;
      end if;
      v_seen := coalesce(v_up.seen_keys,'[]'::jsonb);
      if not exists(select 1 from jsonb_array_elements_text(v_seen) x where x=p_daily_key) then
        v_seen := v_seen || jsonb_build_array(p_daily_key);
      end if;

      update public.daily_study_unit_progress
      set unit_number=coalesce(v_unit_number,unit_number),
          attempts=v_up.attempts+1,
          correct=v_up.correct+(case when p_correct then 1 else 0 end),
          recent_results=v_recent,
          seen_keys=v_seen,
          study_days=v_up.study_days+(case when v_up.last_study_date is distinct from p_study_date then 1 else 0 end),
          first_study_date=coalesce(v_up.first_study_date,p_study_date),
          last_study_date=p_study_date,
          updated_at=now()
      where student_id=p_student_id and book_id=v_book_id and unit_id=v_unit_id and track=p_track
      returning * into v_up;
    else
      insert into public.daily_study_unit_progress(
        student_id,book_id,unit_id,track,unit_number,attempts,correct,recent_results,
        study_days,first_study_date,last_study_date,seen_keys,updated_at
      ) values (
        p_student_id,v_book_id,v_unit_id,p_track,v_unit_number,1,
        case when p_correct then 1 else 0 end,jsonb_build_array(p_correct),
        1,p_study_date,p_study_date,jsonb_build_array(p_daily_key),now()
      ) returning * into v_up;
    end if;

    select * into v_ip
    from public.daily_study_item_progress
    where student_id=p_student_id and book_id=v_book_id and daily_key=p_daily_key and track=p_track
    for update;

    if found then
      v_item_recent := coalesce(v_ip.recent_results,'[]'::jsonb) || jsonb_build_array(p_correct);
      if jsonb_array_length(v_item_recent)>10 then
        select coalesce(jsonb_agg(value order by ord),'[]'::jsonb)
        into v_item_recent
        from jsonb_array_elements(v_item_recent) with ordinality e(value,ord)
        where ord>jsonb_array_length(v_item_recent)-10;
      end if;
      v_new_streak := case when p_correct then v_ip.streak+1 else 0 end;
      v_due_gap := case
        when not p_correct then 1
        when v_new_streak<=1 then 1
        when v_new_streak=2 then 3
        when v_new_streak=3 then 7
        when v_new_streak=4 then 14
        else 30
      end;
      update public.daily_study_item_progress
      set unit_id=v_unit_id,
          unit_number=coalesce(v_unit_number,unit_number),
          skill=coalesce(v_skill,skill),
          attempts=v_ip.attempts+1,
          correct=v_ip.correct+(case when p_correct then 1 else 0 end),
          lapses=v_ip.lapses+(case when p_correct then 0 else 1 end),
          streak=v_new_streak,
          recent_results=v_item_recent,
          first_seen_date=coalesce(v_ip.first_seen_date,p_study_date),
          last_seen_date=p_study_date,
          last_seen_study_day=v_book_day,
          next_due_study_day=v_book_day+v_due_gap,
          last_role=v_role,
          updated_at=now()
      where student_id=p_student_id and book_id=v_book_id and daily_key=p_daily_key and track=p_track
      returning * into v_ip;
    else
      v_new_streak := case when p_correct then 1 else 0 end;
      v_due_gap := 1;
      insert into public.daily_study_item_progress(
        student_id,book_id,unit_id,track,daily_key,unit_number,skill,
        attempts,correct,lapses,streak,recent_results,
        first_seen_date,last_seen_date,last_seen_study_day,next_due_study_day,last_role,updated_at
      ) values (
        p_student_id,v_book_id,v_unit_id,p_track,p_daily_key,v_unit_number,v_skill,
        1,case when p_correct then 1 else 0 end,case when p_correct then 0 else 1 end,
        v_new_streak,jsonb_build_array(p_correct),
        p_study_date,p_study_date,v_book_day,v_book_day+v_due_gap,v_role,now()
      ) returning * into v_ip;
    end if;

    if v_role='current' then
      select * into v_state
      from public.daily_study_book_state
      where student_id=p_student_id and book_id=v_book_id and track=p_track
      for update;

      if found and v_state.current_unit_id=v_unit_id then
        if v_state.pace_type='reading' then
          v_min_days:=3; v_normal_days:=5; v_fast_attempts:=16; v_normal_attempts:=22; v_slow_attempts:=30;
        elsif v_state.pace_type='supplementary' then
          v_min_days:=4; v_normal_days:=7; v_fast_attempts:=20; v_normal_attempts:=28; v_slow_attempts:=40;
        else
          v_min_days:=5; v_normal_days:=10; v_fast_attempts:=25; v_normal_attempts:=35; v_slow_attempts:=50;
        end if;

        v_recent_count := jsonb_array_length(coalesce(v_up.recent_results,'[]'::jsonb));
        select count(*) into v_recent_correct
        from jsonb_array_elements(coalesce(v_up.recent_results,'[]'::jsonb)) e(value)
        where e.value='true'::jsonb;
        v_accuracy := case when v_recent_count>0 then v_recent_correct::numeric/v_recent_count else 0 end;
        v_unique := jsonb_array_length(coalesce(v_up.seen_keys,'[]'::jsonb));

        v_fast := v_state.current_unit_study_days>=v_min_days
          and v_up.attempts>=v_fast_attempts and v_unique>=8
          and v_recent_count>=10 and v_accuracy>=0.93;
        v_normal := v_state.current_unit_study_days>=v_normal_days
          and v_up.attempts>=v_normal_attempts and v_unique>=10
          and v_recent_count>=10 and v_accuracy>=0.82;
        v_slow_release := v_state.current_unit_study_days>=v_normal_days*2
          and v_up.attempts>=v_slow_attempts and v_unique>=10
          and v_recent_count>=10 and v_accuracy>=0.72;

        if (v_fast or v_normal or v_slow_release) and v_next_unit_id is not null then
          update public.daily_study_book_state
          set previous_unit_id=current_unit_id,
              previous_unit_number=current_unit_number,
              current_unit_id=v_next_unit_id,
              current_unit_number=v_next_unit_number,
              current_unit_study_days=0,
              current_unit_started_date=null,
              last_promotion_date=p_study_date,
              attention_needed=false,
              updated_at=now()
          where student_id=p_student_id and book_id=v_book_id and track=p_track
            and current_unit_id=v_unit_id;
        elsif v_state.current_unit_study_days>=v_normal_days*2
          and v_recent_count>=10 and v_accuracy<0.72 then
          update public.daily_study_book_state
          set attention_needed=true,updated_at=now()
          where student_id=p_student_id and book_id=v_book_id and track=p_track;
        elsif v_accuracy>=0.72 then
          update public.daily_study_book_state
          set attention_needed=false,updated_at=now()
          where student_id=p_student_id and book_id=v_book_id and track=p_track;
        end if;
      end if;
    end if;
  end if;

  v_count := jsonb_array_length(v_resolved);
  v_next_cursor := v_row.cursor+1;

  update public.daily_study_sessions
  set cursor=v_next_cursor,
      resolved_keys=v_resolved,
      wrong_items=v_wrong,
      status=case when v_count>=20 then 'completed' else 'active' end,
      completed_at=case when v_count>=20 then coalesce(completed_at,now()) else completed_at end,
      updated_at=now()
  where id=v_row.id
  returning * into v_row;

  v_snapshot := public.daily_study_v3_progress_snapshot(p_student_id,p_track,p_study_date);
  return jsonb_build_object(
    'success',true,
    'completed',(v_row.status='completed'),
    'session',to_jsonb(v_row),
    'resolved_count',jsonb_array_length(v_row.resolved_keys)
  ) || v_snapshot;
end;
$$;

create or replace function public.reset_daily_study_v3_test(p_student_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.daily_study_sessions where student_id=p_student_id and track='test';
  delete from public.daily_study_item_progress where student_id=p_student_id and track='test';
  delete from public.daily_study_unit_progress where student_id=p_student_id and track='test';
  delete from public.daily_study_book_state where student_id=p_student_id and track='test';
  return jsonb_build_object('success',true,'track','test','reset',true);
end;
$$;

create or replace function public.get_daily_study_v2(p_student_id uuid,p_study_date date)
returns jsonb language sql security definer set search_path=public
as $$ select public.daily_study_v3_get(p_student_id,p_study_date,'live'); $$;

create or replace function public.create_daily_study_v2(p_student_id uuid,p_study_date date,p_plan jsonb)
returns jsonb language sql security definer set search_path=public
as $$ select public.daily_study_v3_create(p_student_id,p_study_date,p_plan,'live'); $$;

create or replace function public.answer_daily_study_v2(p_student_id uuid,p_study_date date,p_daily_key text,p_correct boolean)
returns jsonb language sql security definer set search_path=public
as $$ select public.daily_study_v3_answer(p_student_id,p_study_date,p_daily_key,p_correct,'live'); $$;

revoke all on function public.daily_study_v3_progress_snapshot(uuid,text,date) from public, anon, authenticated;
revoke all on function public.daily_study_v3_get(uuid,date,text) from public, anon, authenticated;
revoke all on function public.daily_study_v3_create(uuid,date,jsonb,text) from public, anon, authenticated;
revoke all on function public.daily_study_v3_answer(uuid,date,text,boolean,text) from public, anon, authenticated;
revoke all on function public.reset_daily_study_v3_test(uuid) from public, anon, authenticated;
revoke all on function public.get_daily_study_v2(uuid,date) from public, anon, authenticated;
revoke all on function public.create_daily_study_v2(uuid,date,jsonb) from public, anon, authenticated;
revoke all on function public.answer_daily_study_v2(uuid,date,text,boolean) from public, anon, authenticated;

grant execute on function public.daily_study_v3_progress_snapshot(uuid,text,date) to service_role;
grant execute on function public.daily_study_v3_get(uuid,date,text) to service_role;
grant execute on function public.daily_study_v3_create(uuid,date,jsonb,text) to service_role;
grant execute on function public.daily_study_v3_answer(uuid,date,text,boolean,text) to service_role;
grant execute on function public.reset_daily_study_v3_test(uuid) to service_role;
grant execute on function public.get_daily_study_v2(uuid,date) to service_role;
grant execute on function public.create_daily_study_v2(uuid,date,jsonb) to service_role;
grant execute on function public.answer_daily_study_v2(uuid,date,text,boolean) to service_role;
