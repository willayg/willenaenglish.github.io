-- Internal Willena student assessments
create extension if not exists pgcrypto;

create table if not exists public.student_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  assessment_key text not null default 'willena-internal-level-test',
  status text not null default 'in_progress' check (status in ('in_progress','completed','abandoned','invalid')),
  test_version text not null default '2026-08-v1',
  setup jsonb not null default '{}'::jsonb,
  starting_ability double precision,
  final_ability double precision,
  recommended_level integer,
  confirmed_level integer,
  total_questions integer not null default 0,
  answered_count integer not null default 0,
  correct_count integer not null default 0,
  duration_seconds integer,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  teacher_note text,
  parent_visible boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_assessment_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.student_assessment_attempts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  answer_index integer not null,
  assessment_item_id text not null,
  assessment_source_key text,
  question_level integer,
  item_type text,
  prompt_snapshot text,
  options_snapshot jsonb,
  selected_answer jsonb,
  correct_answer jsonb,
  is_correct boolean not null,
  ability_before double precision,
  ability_after double precision,
  response_time_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (attempt_id, answer_index),
  unique (attempt_id, assessment_item_id)
);

create table if not exists public.student_assessment_skill_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.student_assessment_attempts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  skill_key text not null,
  questions_seen integer not null default 0,
  questions_correct integer not null default 0,
  score_percent numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, skill_key)
);

create index if not exists idx_student_assessment_attempts_student_started
  on public.student_assessment_attempts(student_id, started_at desc);
create index if not exists idx_student_assessment_attempts_status
  on public.student_assessment_attempts(status, started_at desc);
create index if not exists idx_student_assessment_responses_attempt
  on public.student_assessment_responses(attempt_id, answer_index);
create index if not exists idx_student_assessment_skill_results_student
  on public.student_assessment_skill_results(student_id, created_at desc);

alter table public.student_assessment_attempts enable row level security;
alter table public.student_assessment_responses enable row level security;
alter table public.student_assessment_skill_results enable row level security;

-- The public browser does not write directly. The authenticated server function uses service role.
revoke all on public.student_assessment_attempts from anon, authenticated;
revoke all on public.student_assessment_responses from anon, authenticated;
revoke all on public.student_assessment_skill_results from anon, authenticated;
