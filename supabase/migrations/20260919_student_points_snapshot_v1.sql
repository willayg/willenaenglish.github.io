create table if not exists public.student_points_snapshot_v1 (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  total_points integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.student_points_snapshot_v1 enable row level security;
revoke all on table public.student_points_snapshot_v1 from public, anon, authenticated;
grant select, insert, update, delete on table public.student_points_snapshot_v1 to service_role;

insert into public.student_points_snapshot_v1(user_id,total_points,updated_at)
select p.id, coalesce(sum(pa.points),0)::int, now()
from public.profiles p
left join public.progress_attempts pa on pa.user_id=p.id
group by p.id
on conflict(user_id) do update
set total_points=excluded.total_points, updated_at=excluded.updated_at;

create or replace function public.adjust_student_points_snapshot_v1(p_user_id uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if p_user_id is null or coalesce(p_delta,0)=0 then return; end if;
  insert into public.student_points_snapshot_v1(user_id,total_points,updated_at)
  values(p_user_id,greatest(0,coalesce(p_delta,0)),now())
  on conflict(user_id) do update
  set total_points=greatest(0,public.student_points_snapshot_v1.total_points + excluded.total_points),
      updated_at=now();
end;
$$;

revoke all on function public.adjust_student_points_snapshot_v1(uuid,integer) from public,anon,authenticated;
grant execute on function public.adjust_student_points_snapshot_v1(uuid,integer) to service_role;

create or replace function public.sync_student_points_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if tg_op='INSERT' then
    perform public.adjust_student_points_snapshot_v1(new.user_id,coalesce(new.points,0));
    return new;
  elsif tg_op='DELETE' then
    perform public.adjust_student_points_snapshot_v1(old.user_id,-coalesce(old.points,0));
    return old;
  else
    if old.user_id is distinct from new.user_id then
      perform public.adjust_student_points_snapshot_v1(old.user_id,-coalesce(old.points,0));
      perform public.adjust_student_points_snapshot_v1(new.user_id,coalesce(new.points,0));
    elsif old.points is distinct from new.points then
      perform public.adjust_student_points_snapshot_v1(new.user_id,coalesce(new.points,0)-coalesce(old.points,0));
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists trg_sync_student_points_snapshot_v1 on public.progress_attempts;
create trigger trg_sync_student_points_snapshot_v1
after insert or update of user_id,points or delete on public.progress_attempts
for each row execute function public.sync_student_points_snapshot_v1();

create or replace function public.sum_points_for_user(uid uuid)
returns integer
language sql
stable
set search_path=public
as $$
  select coalesce((select total_points from public.student_points_snapshot_v1 where user_id=uid),0)::int;
$$;

revoke all on function public.sum_points_for_user(uuid) from public,anon,authenticated;
grant execute on function public.sum_points_for_user(uuid) to service_role;
