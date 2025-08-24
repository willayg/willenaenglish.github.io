-- Tables for tracking sessions and per-word attempts
create table if not exists progress_sessions (
  id uuid primary key default gen_random_uuid(),
  session_id text unique,
  user_id uuid,
  mode text,
  list_name text,
  list_size int,
  started_at timestamptz default now(),
  ended_at timestamptz,
  summary jsonb
);

create table if not exists progress_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  session_id text,
  mode text,
  word text,
  is_correct boolean,
  answer text,
  correct_answer text,
  points int,
  attempt_index int,
  duration_ms int,
  round int,
  extra jsonb,
  created_at timestamptz default now()
);

create index if not exists progress_attempts_user_id_idx on progress_attempts (user_id);
create index if not exists progress_attempts_session_id_idx on progress_attempts (session_id);
create index if not exists progress_attempts_mode_idx on progress_attempts (mode);
create index if not exists progress_attempts_word_idx on progress_attempts (word);
