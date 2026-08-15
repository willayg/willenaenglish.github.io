-- Make completion robust for Daily Study sessions that were already past 10/20
-- when the generous reward system was deployed. Any session completing after this
-- migration still receives the full 50-point base mission reward.

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
  v_existing_points integer := 0;
  v_base_needed integer := 0;
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
  if new.track <> 'live' or new.cursor <= old.cursor then
    return new;
  end if;

  v_old_resolved := jsonb_array_length(coalesce(old.resolved_keys, '[]'::jsonb));
  v_new_resolved := jsonb_array_length(coalesce(new.resolved_keys, '[]'::jsonb));
  v_correct := v_new_resolved > v_old_resolved;
  v_progress_session_id := 'daily-study:' || new.id::text;

  select coalesce(sum(points),0)::integer
  into v_existing_points
  from public.progress_attempts
  where user_id = new.student_id
    and session_id = v_progress_session_id
    and mode = 'daily_study';

  if v_old_resolved < 10 and v_new_resolved >= 10 then
    v_answer_points := v_answer_points + greatest(0, 20 - v_existing_points);
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

    v_base_needed := greatest(0, 50 - (v_existing_points + v_answer_points));
    v_answer_points := v_answer_points + v_base_needed + v_bonus_points;
  end if;

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

revoke all on function public.daily_study_rewards_after_answer() from public, anon, authenticated;
