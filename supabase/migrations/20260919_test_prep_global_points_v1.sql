-- P2: award global points for future Test Prep correct answers without
-- duplicating Test Prep attempts into progress_attempts.

create table if not exists public.test_prep_point_events (
  attempt_id uuid primary key references public.test_prep_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid references public.test_prep_plans(id) on delete set null,
  points integer not null default 1 check (points >= 0),
  created_at timestamptz not null default now()
);

create index if not exists test_prep_point_events_user_created_idx
  on public.test_prep_point_events(user_id, created_at desc);

alter table public.test_prep_point_events enable row level security;
revoke all on public.test_prep_point_events from anon, authenticated;
grant select, insert, update, delete on public.test_prep_point_events to service_role;

create or replace function public.test_prep_award_global_point_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.is_correct is true then
    insert into public.test_prep_point_events(attempt_id,user_id,plan_id,points,created_at)
    values(new.id,new.student_id,new.plan_id,1,coalesce(new.attempted_at,now()))
    on conflict(attempt_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_test_prep_award_global_point_v1 on public.test_prep_attempts;
create trigger trg_test_prep_award_global_point_v1
after insert on public.test_prep_attempts
for each row execute function public.test_prep_award_global_point_v1();

create or replace function public.sum_points_for_user(uid uuid)
returns integer
language sql
stable
set search_path=public
as $$
  select
    coalesce((select sum(points) from public.progress_attempts where user_id=uid),0)::int
    +
    coalesce((select sum(points) from public.test_prep_point_events where user_id=uid),0)::int;
$$;

revoke all on function public.sum_points_for_user(uuid) from public,anon,authenticated;
grant execute on function public.sum_points_for_user(uuid) to service_role;
