-- Daily Study V3 follow-up: a weak item stays high priority when it is due,
-- but a correct streak can now push it out by 1/3/7/14/30 study days.

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
               case when i.lapses > 0 then 0 else 1 end as priority_rank
        from public.daily_study_item_progress i
        left join public.daily_study_book_state s
          on s.student_id=i.student_id and s.book_id=i.book_id and s.track=i.track
        where i.student_id = p_student_id
          and i.track = p_track
          and i.next_due_study_day <= coalesce(s.total_study_days,0) + 1
        order by priority_rank, i.lapses desc, i.next_due_study_day, i.last_seen_study_day
        limit 200
      ) q
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.daily_study_v3_progress_snapshot(uuid,text,date) from public, anon, authenticated;
grant execute on function public.daily_study_v3_progress_snapshot(uuid,text,date) to service_role;
