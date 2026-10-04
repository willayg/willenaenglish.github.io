-- P1 foundation for snapshot-backed legacy progress_summary.
-- No frontend reads are switched by this migration.
-- Backfill separately with: select public.refresh_all_student_progress_snapshots_v1();

create table if not exists public.student_progress_snapshot_v1 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  class text,
  attempts integer not null default 0,
  correct integer not null default 0,
  accuracy double precision,
  points bigint not null default 0,
  best_streak integer not null default 0,
  lists_explored integer not null default 0,
  perfect_runs integer not null default 0,
  mastered integer not null default 0,
  mastered_lists integer not null default 0,
  words_discovered integer not null default 0,
  words_mastered integer not null default 0,
  sessions_played integer not null default 0,
  stars integer not null default 0,
  badges_count integer not null default 0,
  badge_ids jsonb not null default '[]'::jsonb,
  favorite_list jsonb,
  hardest_word jsonb,
  mode_stats jsonb not null default '[]'::jsonb,
  last_activity timestamptz,
  source_attempt_rows integer not null default 0,
  source_session_rows integer not null default 0,
  snapshot_version integer not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.student_progress_snapshot_v1 enable row level security;
revoke all on public.student_progress_snapshot_v1 from anon, authenticated;
grant select, insert, update, delete on public.student_progress_snapshot_v1 to service_role;

create or replace function public.progress_summary_stars_v1(s jsonb)
returns integer language sql immutable as $$
  select case
    when s is null then 0
    when jsonb_typeof(s->'stars')='number' then greatest(0,(s->>'stars')::integer)
    when jsonb_typeof(s->'stars_preview')='number' then greatest(0,(s->>'stars_preview')::integer)
    when jsonb_typeof(s->'accuracy')='number' then case
      when (s->>'accuracy')::numeric>=1 then 5 when (s->>'accuracy')::numeric>=0.95 then 4
      when (s->>'accuracy')::numeric>=0.90 then 3 when (s->>'accuracy')::numeric>=0.80 then 2
      when (s->>'accuracy')::numeric>=0.60 then 1 else 0 end
    when jsonb_typeof(s->'score')='number' and jsonb_typeof(s->'total')='number' and (s->>'total')::numeric>0 then case
      when (s->>'score')::numeric/(s->>'total')::numeric>=1 then 5 when (s->>'score')::numeric/(s->>'total')::numeric>=0.95 then 4
      when (s->>'score')::numeric/(s->>'total')::numeric>=0.90 then 3 when (s->>'score')::numeric/(s->>'total')::numeric>=0.80 then 2
      when (s->>'score')::numeric/(s->>'total')::numeric>=0.60 then 1 else 0 end
    when jsonb_typeof(s->'score')='number' and jsonb_typeof(s->'max')='number' and (s->>'max')::numeric>0 then case
      when (s->>'score')::numeric/(s->>'max')::numeric>=1 then 5 when (s->>'score')::numeric/(s->>'max')::numeric>=0.95 then 4
      when (s->>'score')::numeric/(s->>'max')::numeric>=0.90 then 3 when (s->>'score')::numeric/(s->>'max')::numeric>=0.80 then 2
      when (s->>'score')::numeric/(s->>'max')::numeric>=0.60 then 1 else 0 end
    else 0 end;
$$;

create or replace function public.progress_summary_is_perfect_v1(s jsonb)
returns boolean language sql immutable as $$
  select case
    when s is null then false
    when lower(coalesce(s->>'completed','true'))='false' then false
    when jsonb_typeof(s->'accuracy')='number' and (s->>'accuracy')::numeric=1 then true
    when lower(coalesce(s->>'perfect','false'))='true' then true
    when jsonb_typeof(s->'score')='number' and jsonb_typeof(s->'total')='number'
      and (s->>'score')::numeric >= (s->>'total')::numeric then true
    when jsonb_typeof(s->'score')='number' and jsonb_typeof(s->'max')='number'
      and (s->>'score')::numeric >= (s->>'max')::numeric then true
    else false end;
$$;

create or replace function public.refresh_student_progress_snapshot_v1(p_user_id uuid)
returns public.student_progress_snapshot_v1
language plpgsql security definer set search_path=public as $$
declare out_row public.student_progress_snapshot_v1;
begin
  if p_user_id is null then raise exception 'p_user_id is required'; end if;
  with
  a as materialized (
    select id,user_id,word,mode,is_correct,points,created_at from public.progress_attempts where user_id=p_user_id
  ),
  s as materialized (
    select id,user_id,session_id,list_name,mode,summary,started_at,ended_at from public.progress_sessions where user_id=p_user_id
  ),
  a_tot as (
    select count(*)::int attempts,count(*) filter(where is_correct)::int correct,
      coalesce(sum(points),0)::bigint points,max(created_at) last_attempt from a
  ),
  streak_rows as (
    select is_correct,sum(case when not coalesce(is_correct,false) then 1 else 0 end)
      over(order by created_at,id rows unbounded preceding) grp from a
  ),
  streak as (
    select coalesce(max(run),0)::int best_streak from (
      select grp,count(*)::int run from streak_rows where is_correct group by grp
    ) q
  ),
  word_rollup as (
    select word,count(*)::int total,count(*) filter(where is_correct)::int correct,min(created_at) first_seen
    from a where word is not null and btrim(word)<>'' group by word
  ),
  word_summary as (
    select count(*)::int words_discovered,
      count(*) filter(where total>0 and correct::numeric/total::numeric>=0.8)::int words_mastered
    from word_rollup
  ),
  hardest as (
    select jsonb_build_object('word',word,'misses',total-correct,'attempts',total,
      'accuracy',correct::double precision/nullif(total,0)) hardest_word
    from word_rollup where total>=3 and (total-correct)>correct
    order by (total-correct) desc,(correct::double precision/nullif(total,0)) asc,first_seen,word limit 1
  ),
  modes as (
    select coalesce(jsonb_agg(jsonb_build_object('mode',mode_key,'correct',correct,'total',total,
      'accuracy',case when total>0 then round(correct::numeric*100/total)::int else 0 end)
      order by total desc,mode_key),'[]'::jsonb) mode_stats
    from (
      select coalesce(mode,'unknown') mode_key,count(*)::int total,count(*) filter(where is_correct)::int correct
      from a group by coalesce(mode,'unknown')
    ) m
  ),
  session_base as (
    select *,public.progress_summary_is_perfect_v1(summary) is_perfect,
      case when lower(coalesce(summary->>'completed','true'))='false' then 0
           else public.progress_summary_stars_v1(summary) end stars_for_pair from s
  ),
  s_tot as (
    select count(*)::int sessions_played,count(*) filter(where is_perfect)::int perfect_runs,
      (count(distinct list_name) filter(where list_name is not null))::int lists_explored,
      max(coalesce(ended_at,started_at)) last_session from session_base
  ),
  mastered as (
    select count(*)::int mastered from (
      select distinct list_name,coalesce(mode,'unknown') from session_base where list_name is not null and is_perfect
    ) x
  ),
  star_best as (
    select list_name,mode,max(stars_for_pair)::int best_stars from session_base group by list_name,mode
  ),
  star_total as (select coalesce(sum(best_stars),0)::int stars from star_best),
  favorite as (
    select jsonb_build_object('name',list_name,'cnt',cnt) favorite_list from (
      select list_name,count(*)::int cnt,max(coalesce(ended_at,started_at)) latest
      from session_base where list_name is not null group by list_name
      order by cnt desc,latest desc nulls last,list_name limit 1
    ) f
  ),
  badge_values as (
    select (
      case when at.correct>=1 then 1 else 0 end +
      case when st.best_streak>=5 then 1 else 0 end +
      coalesce((select count(*) from session_base where
        (jsonb_typeof(summary->'accuracy')='number' and (summary->>'accuracy')::numeric>=1)
        or lower(coalesce(summary->>'perfect','false'))='true'
        or (jsonb_typeof(summary->'score')='number' and jsonb_typeof(summary->'total')='number'
            and (summary->>'total')::numeric>0 and (summary->>'score')::numeric/(summary->>'total')::numeric>=1)
        or (jsonb_typeof(summary->'score')='number' and jsonb_typeof(summary->'max')='number'
            and (summary->>'max')::numeric>0 and (summary->>'score')::numeric/(summary->>'max')::numeric>=1)
      ),0))::int badges_count,
      (select coalesce(jsonb_agg(id order by ord),'[]'::jsonb) from (
        select 'first_correct'::text id,1 ord where at.correct>=1
        union all select 'streak_5',2 where st.best_streak>=5
        union all select 'hundred_correct',3 where at.correct>=100
        union all select 'perfect_round',4 where exists (
          select 1 from session_base where
            (jsonb_typeof(summary->'accuracy')='number' and (summary->>'accuracy')::numeric>=1)
            or lower(coalesce(summary->>'perfect','false'))='true'
            or (jsonb_typeof(summary->'score')='number' and jsonb_typeof(summary->'total')='number'
                and (summary->>'total')::numeric>0 and (summary->>'score')::numeric/(summary->>'total')::numeric>=1)
            or (jsonb_typeof(summary->'score')='number' and jsonb_typeof(summary->'max')='number'
                and (summary->>'max')::numeric>0 and (summary->>'score')::numeric/(summary->>'max')::numeric>=1)
        )
      ) b) badge_ids
    from a_tot at cross join streak st
  )
  insert into public.student_progress_snapshot_v1(
    user_id,class,attempts,correct,accuracy,points,best_streak,lists_explored,perfect_runs,mastered,mastered_lists,
    words_discovered,words_mastered,sessions_played,stars,badges_count,badge_ids,favorite_list,hardest_word,mode_stats,
    last_activity,source_attempt_rows,source_session_rows,snapshot_version,updated_at)
  select p_user_id,p.class,at.attempts,at.correct,
    case when at.attempts>0 then at.correct::double precision/at.attempts else null end,
    at.points,st.best_streak,stot.lists_explored,stot.perfect_runs,ma.mastered,ma.mastered,
    ws.words_discovered,ws.words_mastered,stot.sessions_played,stars.stars,bv.badges_count,bv.badge_ids,
    fav.favorite_list,hard.hardest_word,md.mode_stats,
    case when at.last_attempt is null then stot.last_session when stot.last_session is null then at.last_attempt
         else greatest(at.last_attempt,stot.last_session) end,
    at.attempts,stot.sessions_played,1,now()
  from (select class from public.profiles where id=p_user_id) p
  cross join a_tot at cross join streak st cross join word_summary ws cross join s_tot stot
  cross join mastered ma cross join star_total stars cross join badge_values bv cross join modes md
  left join favorite fav on true left join hardest hard on true
  on conflict(user_id) do update set
    class=excluded.class,attempts=excluded.attempts,correct=excluded.correct,accuracy=excluded.accuracy,
    points=excluded.points,best_streak=excluded.best_streak,lists_explored=excluded.lists_explored,
    perfect_runs=excluded.perfect_runs,mastered=excluded.mastered,mastered_lists=excluded.mastered_lists,
    words_discovered=excluded.words_discovered,words_mastered=excluded.words_mastered,sessions_played=excluded.sessions_played,
    stars=excluded.stars,badges_count=excluded.badges_count,badge_ids=excluded.badge_ids,
    favorite_list=excluded.favorite_list,hardest_word=excluded.hardest_word,mode_stats=excluded.mode_stats,
    last_activity=excluded.last_activity,source_attempt_rows=excluded.source_attempt_rows,
    source_session_rows=excluded.source_session_rows,snapshot_version=excluded.snapshot_version,updated_at=excluded.updated_at
  returning * into out_row;
  if out_row.user_id is null then
    insert into public.student_progress_snapshot_v1(user_id,updated_at) values(p_user_id,now())
    on conflict(user_id) do update set updated_at=excluded.updated_at returning * into out_row;
  end if;
  return out_row;
end;
$$;

revoke all on function public.refresh_student_progress_snapshot_v1(uuid) from public,anon,authenticated;
grant execute on function public.refresh_student_progress_snapshot_v1(uuid) to service_role;

create or replace function public.refresh_all_student_progress_snapshots_v1()
returns integer language plpgsql security definer set search_path=public as $$
declare r record; n integer:=0;
begin
  for r in select id from public.profiles where coalesce(lower(role),'student')='student' loop
    perform public.refresh_student_progress_snapshot_v1(r.id); n:=n+1;
  end loop;
  return n;
end;
$$;

revoke all on function public.refresh_all_student_progress_snapshots_v1() from public,anon,authenticated;
grant execute on function public.refresh_all_student_progress_snapshots_v1() to service_role;

create index if not exists student_progress_snapshot_v1_class_idx on public.student_progress_snapshot_v1(class);
create index if not exists student_progress_snapshot_v1_updated_at_idx on public.student_progress_snapshot_v1(updated_at desc);
