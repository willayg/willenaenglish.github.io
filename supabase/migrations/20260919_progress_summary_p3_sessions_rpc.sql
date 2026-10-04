-- P3: keep progress_summary response contracts while moving expensive
-- session-summary reconstruction into Postgres. No raw data is modified.

create or replace function public.progress_summary_sessions_v1(
  p_user_id uuid,
  p_list_name text default null
)
returns table (
  session_id text,
  mode text,
  list_name text,
  started_at timestamptz,
  ended_at timestamptz,
  summary jsonb
)
language sql
security definer
set search_path = public
as $$
  with base as materialized (
    select s.session_id, s.mode, s.list_name, s.started_at, s.ended_at, s.summary
    from public.progress_sessions s
    where s.user_id = p_user_id
      and s.ended_at is not null
      and (p_list_name is null or s.list_name = p_list_name)
    order by s.ended_at desc
    limit 500
  ),
  needs as (
    select b.session_id
    from base b
    where b.summary is null
       or b.summary = '{}'::jsonb
       or not (
         (jsonb_typeof(b.summary->'accuracy') = 'number')
         or (
           jsonb_typeof(b.summary->'score') = 'number'
           and jsonb_typeof(b.summary->'total') = 'number'
           and (b.summary->>'total')::numeric > 0
         )
         or (
           jsonb_typeof(b.summary->'score') = 'number'
           and jsonb_typeof(b.summary->'max') = 'number'
           and (b.summary->>'max')::numeric > 0
         )
       )
  ),
  agg as (
    select a.session_id,
           count(*)::int as total,
           count(*) filter (where a.is_correct)::int as correct
    from public.progress_attempts a
    join needs n on n.session_id = a.session_id
    where a.user_id = p_user_id
    group by a.session_id
  )
  select
    b.session_id,
    b.mode,
    b.list_name,
    b.started_at,
    b.ended_at,
    case
      when n.session_id is null then b.summary
      when coalesce(a.total,0) > 0 then jsonb_build_object(
        'score', a.correct,
        'total', a.total,
        'accuracy', a.correct::double precision / a.total,
        'derived', true
      )
      else b.summary
    end as summary
  from base b
  left join needs n on n.session_id = b.session_id
  left join agg a on a.session_id = b.session_id
  order by b.ended_at desc;
$$;

revoke all on function public.progress_summary_sessions_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.progress_summary_sessions_v1(uuid,text) to service_role;
