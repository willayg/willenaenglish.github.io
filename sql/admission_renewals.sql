-- Apply to the academy admissions/auth database. Household submissions are write-only.
create table public.admission_renewals (
  id uuid primary key default gen_random_uuid(),
  cohort_year smallint not null check (cohort_year between 2027 and 2100),
  created_at timestamptz not null default now(),
  student_name text not null check (length(btrim(student_name)) between 1 and 50),
  birth_grade text not null check (length(btrim(birth_grade)) between 1 and 50),
  guardian_phone text not null check (guardian_phone ~ '^0[0-9]{8,10}$'),
  school text not null check (length(btrim(school)) between 1 and 80),
  parent_note text not null default '' check (length(parent_note) <= 400),
  guardian_consent boolean not null check (guardian_consent),
  confirmed_at timestamptz,
  notified_at timestamptz,
  seminar_applied_at timestamptz,
  invitation_key uuid not null unique default gen_random_uuid(),
  check (confirmed_at is not null or (notified_at is null and seminar_applied_at is null))
);
create unique index admission_renewals_student_idx on public.admission_renewals
  (cohort_year, guardian_phone, lower(regexp_replace(student_name, '[[:space:]]+', '', 'g')));
create index admission_renewals_year_date_idx on public.admission_renewals (cohort_year, created_at desc, id);
alter table public.admission_renewals enable row level security;
revoke all on public.admission_renewals from public, anon, authenticated;
grant select, insert, update, delete on public.admission_renewals to service_role;
grant select, delete, update (confirmed_at, notified_at) on public.admission_renewals to authenticated;
create policy admissions_read on public.admission_renewals for select to authenticated
  using ((select public.willena_push_is_admin()));
create policy admissions_confirm on public.admission_renewals for update to authenticated
  using ((select public.willena_push_is_admin())) with check ((select public.willena_push_is_admin()));
create policy admissions_remove on public.admission_renewals for delete to authenticated
  using ((select public.willena_push_is_admin()));

create function public.submit_admission_renewal_2027(
  p_name text, p_grade text, p_phone text, p_school text, p_note text, p_consent boolean
) returns text language plpgsql security invoker set search_path = '' as $$
begin
  if statement_timestamp() >= timestamptz '2026-11-27 00:00:00 Asia/Seoul' then return 'closed'; end if;
  -- Serialize concurrent submissions from one number. Siblings retain separate records.
  perform pg_advisory_xact_lock(hashtextextended(p_phone, 2027));
  if exists (select 1 from public.admission_renewals where cohort_year=2027 and guardian_phone=p_phone
      and lower(regexp_replace(student_name,'[[:space:]]+','','g'))=lower(regexp_replace(p_name,'[[:space:]]+','','g'))) then
    return 'received';
  end if;
  if (select count(*) from public.admission_renewals where cohort_year=2027 and guardian_phone=p_phone
      and created_at > now() - interval '1 hour') >= 8 then return 'rate_limited'; end if;
  insert into public.admission_renewals (cohort_year,student_name,birth_grade,guardian_phone,school,parent_note,guardian_consent)
    values (2027,p_name,p_grade,p_phone,p_school,p_note,p_consent) on conflict do nothing;
  return 'received';
end $$;
revoke all on function public.submit_admission_renewal_2027(text,text,text,text,text,boolean) from public, anon, authenticated;
grant execute on function public.submit_admission_renewal_2027(text,text,text,text,text,boolean) to service_role;

-- Only a confirmed student's private invitation can record an actual seminar application.
create function public.respond_admission_briefing_2027(p_key uuid, p_apply boolean)
returns text language plpgsql security invoker set search_path = '' as $$
declare booked timestamptz;
begin
  if p_apply and statement_timestamp() < timestamptz '2027-01-09 11:00:00 Asia/Seoul' then
    update public.admission_renewals set seminar_applied_at=coalesce(seminar_applied_at,now())
      where cohort_year=2027 and invitation_key=p_key and confirmed_at is not null returning seminar_applied_at into booked;
  else
    select seminar_applied_at into booked from public.admission_renewals
      where cohort_year=2027 and invitation_key=p_key and confirmed_at is not null;
  end if;
  if not found then return 'invalid'; end if;
  if booked is not null then return 'booked'; end if;
  if statement_timestamp() >= timestamptz '2027-01-09 11:00:00 Asia/Seoul' then return 'closed'; end if;
  return 'eligible';
end $$;
revoke all on function public.respond_admission_briefing_2027(uuid,boolean) from public, anon, authenticated;
grant execute on function public.respond_admission_briefing_2027(uuid,boolean) to service_role;

create function public.admin_admission_list(p_year integer)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc, r.id), '[]'::jsonb)
  from (select id, created_at, student_name, birth_grade, guardian_phone, school, parent_note,
         confirmed_at, notified_at, seminar_applied_at,
         case when confirmed_at is not null and cohort_year=2027 then invitation_key end as invitation_key
       from public.admission_renewals where cohort_year=p_year) as r;
$$;
create function public.admin_admission_update(p_year integer,p_id uuid,p_action text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  if p_action='confirm' then
    update public.admission_renewals set confirmed_at=coalesce(confirmed_at,now())
      where id=p_id and cohort_year=p_year;
  elsif p_action='notified' then
    update public.admission_renewals set notified_at=coalesce(notified_at,now())
      where id=p_id and cohort_year=p_year and confirmed_at is not null;
  elsif p_action='remove' then
    delete from public.admission_renewals where id=p_id and cohort_year=p_year;
  else
    return false;
  end if;
  return found;
end $$;
revoke all on function public.admin_admission_list(integer),public.admin_admission_update(integer,uuid,text)
  from public, anon, authenticated;
grant execute on function public.admin_admission_list(integer),public.admin_admission_update(integer,uuid,text) to authenticated;
