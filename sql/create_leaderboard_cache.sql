-- SQL to create a simple cache table for leaderboard payloads
-- Run this in Supabase SQL editor or psql as a privileged user

create table if not exists public.leaderboard_cache (
  section text not null,
  timeframe text not null,
  payload jsonb not null,
  updated_at timestamptz default now(),
  primary key (section, timeframe)
);

-- Example upsert
-- insert into public.leaderboard_cache (section, timeframe, payload)
-- values ('leaderboard_stars_global', 'all', '{"success": true, "leaderboard": []}'::jsonb)
-- on conflict (section, timeframe) do update set payload = excluded.payload, updated_at = now();
