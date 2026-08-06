-- A test is "new" until an administrator opens its detail drawer.
alter table public.student_assessment_attempts
  add column if not exists admin_opened_at timestamptz;

alter table public.prospective_level_test_attempts
  add column if not exists admin_opened_at timestamptz;

comment on column public.student_assessment_attempts.admin_opened_at is
  'First time an administrator opened this level-test attempt.';
comment on column public.prospective_level_test_attempts.admin_opened_at is
  'First time an administrator opened this level-test attempt.';
