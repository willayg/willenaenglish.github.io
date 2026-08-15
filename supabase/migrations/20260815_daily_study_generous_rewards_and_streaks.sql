-- Daily Study generous mission rewards + streak tracking.
-- Live Daily Study answers are mirrored into the existing Willena progress system
-- so points, stars, profiles and leaderboards continue using their current sources.

create unique index if not exists progress_attempts_daily_study_answer_once_idx
  on public.progress_attempts(user_id, session_id, attempt_index)
  where mode = 'daily_study';

create or replace function public.daily_study_streak_snapshot(
  p_student_id uuid,
  p_track text,
  p_as_of_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dates date[];
  v_d date;
  v_prev date := null;
  v_last date := null;
  v_current integer := 0;
  v_longest integer := 0;
  v_gap_has_weekday boolean := false;
begin
  if p_track not in ('live','test') then
    raise exception 'Invalid Daily Study track';
  end if;

  select array_agg(study_date order by study_date)
  into v_dates
  from public.daily_study_sessions
  where student_id = p_student_id
    and track = p_track
    and status = 'completed'
    and study_date <= p_as_of_date;

  if coalesce(array_length(v_dates, 1), 0) = 0 then
    return jsonb_build_object(
      'current_streak', 0,
      'longest_streak', 0,
      'last_completed_date', null,
      'completed_today', false
    );
  end if;

  foreach v_d in array v_dates loop
    if v_prev is null then
      v_current := 1;
    else
      select exists(
        select 1
        from generate_series(v_prev + 1, v_d - 1, interval '1 day') as g(day)
        where extract(isodow from g.day) between 1 and 5
      ) into v_gap_has_weekday;

      if v_gap_has_weekday then
        v_current := 1;
      else
        v_current := v_current + 1;
      end if;
    end if;

    v_longest := greatest(v_longest, v_current);
    v_prev := v_d;
    v_last := v_d;
  end loop;

  -- Today itself never counts as a missed day until it has passed.
  select exists(
    select 1
    from generate_series(v_last + 1, p_as_of_date - 1, interval '1 day') as g(day)
    where extract(isodow from g.day) between 1 and 5
  ) into v_gap_has_weekday;

  if v_gap_has_weekday then
    v_current := 0;
  end if;

  return jsonb_build_object(
    'current_streak', v_current,
    'longest_streak', v_longest,
    'last_completed_date', v_last,
    'completed_today', (v_last = p_as_of_date)
  );
end;
$$;

create or replace function public.daily_study_rewards_after_answer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_resolved integer := 0;
  v_new_resolved integer := 0;
  v_correct boolean := false;
  v_answer_points integer := 0;
  v_completed_now boolean := false;
  v_streak_snapshot jsonb := '{}'::jsonb;
  v_streak integer := 0;
  v_longest integer := 0;
  v_bonus_points integer := 0;
  v_bonus_stars integer := 0;
  v_rating_stars integer := 0;
  v_total_stars integer := 0;
  v_accuracy numeric := 0;
  v_progress_session_id text;
begin
  -- Never let the staging simulator contaminate live Willena rewards.
  if new.track <> 'live' or new.cursor <= old.cursor then
    return new;
  end if;

  v_old_resolved := jsonb_array_length(coalesce(old.resolved_keys, '[]'::jsonb));
  v_new_resolved := jsonb_array_length(coalesce(new.resolved_keys, '[]'::jsonb));
  v_correct := v_new_resolved > v_old_resolved;
  v_progress_session_id := 'daily-study:' || new.id::text;

  -- Daily Study is a mission, not a point-per-question game.
  if v_old_resolved < 10 and v_new_resolved >= 10 then
    v_answer_points := v_answer_points + 20;
  end if;

  v_completed_now := old.status <> 'completed'
    and new.status = 'completed'
    and v_old_resolved < 20
    and v_new_resolved >= 20;

  if v_completed_now then
    v_streak_snapshot := public.daily_study_streak_snapshot(new.student_id, new.track, new.study_date);
    v_streak := coalesce((v_streak_snapshot->>'current_streak')::integer, 0);
    v_longest := coalesce((v_streak_snapshot->>'longest_streak')::integer, v_streak);

    if v_streak = 3 then
      v_bonus_points := 10;
    elsif v_streak = 5 then
      v_bonus_points := 20;
      v_bonus_stars := 1;
    elsif v_streak = 10 then
      v_bonus_points := 50;
      v_bonus_stars := 2;
    elsif v_streak = 20 then
      v_bonus_points := 100;
      v_bonus_stars := 3;
    elsif v_streak = 30 then
      v_bonus_points := 150;
    elsif v_streak >= 40 and mod(v_streak, 10) = 0 then
      v_bonus_points := v_streak * 5;
      v_bonus_stars := 3;
    end if;

    v_answer_points := v_answer_points + 30 + v_bonus_points;
  end if;

  -- Mirror the actual answer into the legacy/global attempt stream. This keeps
  -- accuracy meaningful while letting mission points flow through the existing
  -- Willena point totals and leaderboards without synthetic fake-correct rows.
  insert into public.progress_attempts(
    user_id,
    session_id,
    mode,
    word,
    is_correct,
    points,
    attempt_index,
    extra,
    created_at
  ) values (
    new.student_id,
    v_progress_session_id,
    'daily_study',
    null,
    v_correct,
    v_answer_points,
    new.cursor,
    jsonb_build_object(
      'daily_study', true,
      'study_date', new.study_date,
      'daily_session_id', new.id,
      'resolved_count', v_new_resolved,
      'mission_points', v_answer_points,
      'track', new.track
    ),
    now()
  )
  on conflict do nothing;

  if v_completed_now then
    v_accuracy := case when new.cursor > 0 then v_new_resolved::numeric / new.cursor::numeric else 0 end;
    v_rating_stars := case
      when v_accuracy >= 0.95 then 5
      when v_accuracy >= 0.85 then 4
      else 3
    end;
    v_total_stars := v_rating_stars + v_bonus_stars;

    insert into public.progress_sessions(
      session_id,
      user_id,
      mode,
      list_name,
      list_size,
      started_at,
      ended_at,
      summary
    ) values (
      v_progress_session_id,
      new.student_id,
      'daily_study',
      'Daily Study ' || new.study_date::text,
      20,
      new.created_at,
      coalesce(new.completed_at, now()),
      jsonb_build_object(
        'completed', true,
        'stars', v_total_stars,
        'daily_rating_stars', v_rating_stars,
        'streak_bonus_stars', v_bonus_stars,
        'streak_bonus_points', v_bonus_points,
        'daily_streak', v_streak,
        'longest_daily_streak', v_longest,
        'daily_attempts', new.cursor,
        'daily_accuracy', round(v_accuracy * 1000) / 1000,
        'daily_streak_badge', (v_streak >= 30),
        'reward_model', 'daily-mission-v1'
      )
    )
    on conflict(session_id) do update set
      user_id = excluded.user_id,
      mode = excluded.mode,
      list_name = excluded.list_name,
      list_size = excluded.list_size,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      summary = excluded.summary;
  end if;

  return new;
end;
$$;

drop trigger if exists daily_study_rewards_after_answer_trigger on public.daily_study_sessions;
create trigger daily_study_rewards_after_answer_trigger
after update of cursor, resolved_keys, status
on public.daily_study_sessions
for each row
when (new.cursor > old.cursor)
execute function public.daily_study_rewards_after_answer();

create or replace function public.daily_study_reward_snapshot(
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
  v_session public.daily_study_sessions%rowtype;
  v_progress_session_id text;
  v_points integer := 0;
  v_summary jsonb := '{}'::jsonb;
  v_streak jsonb := '{}'::jsonb;
  v_current integer := 0;
  v_longest integer := 0;
  v_resolved integer := 0;
  v_accuracy numeric := 0;
  v_next_milestone integer := 3;
begin
  if p_track not in ('live','test') then
    raise exception 'Invalid Daily Study track';
  end if;

  v_streak := public.daily_study_streak_snapshot(p_student_id, p_track, p_study_date);
  v_current := coalesce((v_streak->>'current_streak')::integer, 0);
  v_longest := coalesce((v_streak->>'longest_streak')::integer, 0);

  if v_current < 3 then v_next_milestone := 3;
  elsif v_current < 5 then v_next_milestone := 5;
  elsif v_current < 10 then v_next_milestone := 10;
  elsif v_current < 20 then v_next_milestone := 20;
  elsif v_current < 30 then v_next_milestone := 30;
  else v_next_milestone := ((v_current / 10) + 1) * 10;
  end if;

  select * into v_session
  from public.daily_study_sessions
  where student_id = p_student_id
    and study_date = p_study_date
    and track = p_track;

  if not found then
    return jsonb_build_object(
      'track', p_track,
      'study_date', p_study_date,
      'completed', false,
      'resolved_count', 0,
      'attempts', 0,
      'today_points', 0,
      'today_stars', 0,
      'daily_rating_stars', 0,
      'streak_bonus_points', 0,
      'streak_bonus_stars', 0,
      'daily_accuracy', 0,
      'current_streak', v_current,
      'longest_streak', v_longest,
      'next_streak_milestone', v_next_milestone,
      'base_completion_points', 50,
      'minimum_completion_stars', 3
    );
  end if;

  v_resolved := jsonb_array_length(coalesce(v_session.resolved_keys, '[]'::jsonb));
  v_accuracy := case when v_session.cursor > 0 then v_resolved::numeric / v_session.cursor::numeric else 0 end;
  v_progress_session_id := 'daily-study:' || v_session.id::text;

  if p_track = 'live' then
    select coalesce(sum(points), 0)::integer
    into v_points
    from public.progress_attempts
    where user_id = p_student_id
      and session_id = v_progress_session_id
      and mode = 'daily_study';

    select coalesce(summary, '{}'::jsonb)
    into v_summary
    from public.progress_sessions
    where session_id = v_progress_session_id
    limit 1;
  end if;

  return jsonb_build_object(
    'track', p_track,
    'study_date', p_study_date,
    'completed', (v_session.status = 'completed'),
    'resolved_count', v_resolved,
    'attempts', v_session.cursor,
    'today_points', case when p_track='live' then v_points else 0 end,
    'today_stars', case when p_track='live' then coalesce((v_summary->>'stars')::integer,0) else 0 end,
    'daily_rating_stars', case when p_track='live' then coalesce((v_summary->>'daily_rating_stars')::integer,0) else 0 end,
    'streak_bonus_points', case when p_track='live' then coalesce((v_summary->>'streak_bonus_points')::integer,0) else 0 end,
    'streak_bonus_stars', case when p_track='live' then coalesce((v_summary->>'streak_bonus_stars')::integer,0) else 0 end,
    'daily_accuracy', case when p_track='live' and v_session.status='completed' and v_summary ? 'daily_accuracy' then (v_summary->>'daily_accuracy')::numeric else round(v_accuracy*1000)/1000 end,
    'current_streak', v_current,
    'longest_streak', v_longest,
    'next_streak_milestone', v_next_milestone,
    'base_completion_points', 50,
    'minimum_completion_stars', 3,
    'daily_streak_badge', case when p_track='live' then coalesce((v_summary->>'daily_streak_badge')::boolean,false) else false end
  );
end;
$$;

revoke all on function public.daily_study_streak_snapshot(uuid,text,date) from public, anon, authenticated;
revoke all on function public.daily_study_reward_snapshot(uuid,date,text) from public, anon, authenticated;
revoke all on function public.daily_study_rewards_after_answer() from public, anon, authenticated;
grant execute on function public.daily_study_streak_snapshot(uuid,text,date) to service_role;
grant execute on function public.daily_study_reward_snapshot(uuid,date,text) to service_role;
