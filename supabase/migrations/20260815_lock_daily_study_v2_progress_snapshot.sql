revoke all on function public.daily_study_v2_progress_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.daily_study_v2_progress_snapshot(uuid) to service_role;
