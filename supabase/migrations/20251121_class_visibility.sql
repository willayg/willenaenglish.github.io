-- Create metadata table for per-class visibility toggles
-- Stores whether a class should be hidden from non-admin teachers

create table if not exists public.class_visibility (
  class_key text primary key,
  class_name text not null,
  hidden boolean not null default false,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.class_visibility is 'Stores per-class visibility toggles for teacher dashboards';
comment on column public.class_visibility.class_key is 'Lowercase normalized key (e.g., new york) to keep aliases consistent';
comment on column public.class_visibility.class_name is 'Canonical display name for the class';
comment on column public.class_visibility.hidden is 'True when the class should be hidden from non-admin teachers';

create index if not exists class_visibility_hidden_idx on public.class_visibility (hidden);
