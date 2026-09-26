-- Vocabulary Study Pass 3: study-day streaks + permanent Golden Unit achievements.

create table if not exists public.student_achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null,
  achievement_type text not null,
  book_id uuid,
  unit_id uuid,
  earned_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  constraint student_achievements_vocab_type_chk
    check (achievement_type in ('vocab_golden_unit')),
  constraint student_achievements_vocab_identity_uniq
    unique (student_id, achievement_type, book_id, unit_id)
);

create index if not exists student_achievements_student_type_idx
  on public.student_achievements(student_id, achievement_type, earned_at desc);

alter table public.student_achievements enable row level security;

revoke all on table public.student_achievements from anon, authenticated;
grant all on table public.student_achievements to service_role;

create or replace function public.get_vocab_motivation_snapshot_v1(
  p_student_id uuid,
  p_book_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_dates date[];
  v_d date;
  v_prev date := null;
  v_last date := null;
  v_run integer := 0;
  v_best integer := 0;
  v_current integer := 0;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_golden jsonb := '[]'::jsonb;
begin
  select array_agg(study_date order by study_date)
  into v_dates
  from (
    select distinct (ps.ended_at at time zone 'Asia/Seoul')::date as study_date
    from public.progress_sessions ps
    where ps.user_id = p_student_id
      and ps.ended_at is not null
      and ps.mode in ('vocab_quiz','vocab_spelling_test','vocab_speaking')
      and coalesce(ps.summary->>'reward_scheme','') = 'vocab-study-v1'
      and coalesce((ps.summary->>'completed')::boolean, true)
      and (ps.ended_at at time zone 'Asia/Seoul')::date <= v_today
  ) d;

  if coalesce(array_length(v_dates,1),0) > 0 then
    foreach v_d in array v_dates loop
      if v_prev is not null and v_d = v_prev + 1 then
        v_run := v_run + 1;
      else
        v_run := 1;
      end if;
      v_best := greatest(v_best,v_run);
      v_prev := v_d;
      v_last := v_d;
    end loop;
    v_current := v_run;
    if v_last < v_today - 1 then
      v_current := 0;
    end if;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'book_id',sa.book_id,
      'unit_id',sa.unit_id,
      'earned_at',sa.earned_at,
      'metadata',sa.metadata
    )
    order by sa.earned_at
  ),'[]'::jsonb)
  into v_golden
  from public.student_achievements sa
  where sa.student_id = p_student_id
    and sa.achievement_type = 'vocab_golden_unit'
    and (p_book_id is null or sa.book_id = p_book_id);

  return jsonb_build_object(
    'success',true,
    'student_id',p_student_id,
    'current_streak',v_current,
    'best_streak',v_best,
    'last_study_date',v_last,
    'studied_today',(v_last = v_today),
    'golden_units',v_golden
  );
end;
$$;

create or replace function public.award_vocab_golden_unit_v1(
  p_student_id uuid,
  p_book_id uuid,
  p_unit_id uuid,
  p_quiz_total integer,
  p_spelling_total integer,
  p_speaking_total integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.student_vocab_unit_snapshot_v1;
  v_existing public.student_achievements;
  v_row public.student_achievements;
  v_earned_now boolean := false;
begin
  if p_quiz_total <= 0 or p_spelling_total <= 0 or p_speaking_total < 0 then
    return jsonb_build_object('success',false,'eligible',false,'reason','invalid_eligible_counts');
  end if;

  select * into v_existing
  from public.student_achievements
  where student_id=p_student_id
    and achievement_type='vocab_golden_unit'
    and book_id=p_book_id
    and unit_id=p_unit_id;

  if found then
    return jsonb_build_object(
      'success',true,'eligible',true,'earned',true,'earned_now',false,
      'achievement',jsonb_build_object(
        'book_id',v_existing.book_id,'unit_id',v_existing.unit_id,
        'earned_at',v_existing.earned_at,'metadata',v_existing.metadata
      )
    );
  end if;

  s := public.refresh_student_vocab_unit_snapshot_v1(p_student_id,p_book_id,p_unit_id,'study-v1');

  if coalesce(s.vocabulary_passed_count,0) < p_quiz_total
     or coalesce(s.spelling_test_passed_count,0) < p_spelling_total
     or (p_speaking_total > 0 and coalesce(s.speaking_passed_count,0) < p_speaking_total) then
    return jsonb_build_object(
      'success',true,'eligible',false,'earned',false,'earned_now',false,
      'progress',jsonb_build_object(
        'quiz_passed',coalesce(s.vocabulary_passed_count,0),
        'quiz_total',p_quiz_total,
        'spelling_passed',coalesce(s.spelling_test_passed_count,0),
        'spelling_total',p_spelling_total,
        'speaking_passed',coalesce(s.speaking_passed_count,0),
        'speaking_total',p_speaking_total
      )
    );
  end if;

  insert into public.student_achievements(
    student_id,achievement_type,book_id,unit_id,metadata
  ) values (
    p_student_id,'vocab_golden_unit',p_book_id,p_unit_id,
    jsonb_build_object(
      'quiz_total',p_quiz_total,
      'spelling_total',p_spelling_total,
      'speaking_total',p_speaking_total,
      'reward_scheme','vocab-golden-unit-v1'
    )
  )
  on conflict (student_id,achievement_type,book_id,unit_id) do nothing
  returning * into v_row;

  if found then
    v_earned_now := true;
  else
    select * into v_row
    from public.student_achievements
    where student_id=p_student_id
      and achievement_type='vocab_golden_unit'
      and book_id=p_book_id
      and unit_id=p_unit_id;
  end if;

  return jsonb_build_object(
    'success',true,'eligible',true,'earned',true,'earned_now',v_earned_now,
    'achievement',jsonb_build_object(
      'book_id',v_row.book_id,'unit_id',v_row.unit_id,
      'earned_at',v_row.earned_at,'metadata',v_row.metadata
    )
  );
end;
$$;

revoke execute on function public.get_vocab_motivation_snapshot_v1(uuid,uuid) from public, anon, authenticated;
revoke execute on function public.award_vocab_golden_unit_v1(uuid,uuid,uuid,integer,integer,integer) from public, anon, authenticated;
grant execute on function public.get_vocab_motivation_snapshot_v1(uuid,uuid) to service_role;
grant execute on function public.award_vocab_golden_unit_v1(uuid,uuid,uuid,integer,integer,integer) to service_role;
