# WILLENA Biweekly Reporting (teachers branch)

Admin V2 → **Biweekly Reports** is a new menu appended after Level Tests. This is admin-only. The student roster, teacher/student login and existing assessment grid are unchanged.

## Existing database reused
- profiles + class_enrollments + classes: approved students in active non-Test classes.
- study_attempts: book-based attempts and skill/first-attempt evidence.
- progress_attempts: Arcade activity (shown separately to avoid double counting).
- grammar_foundation_stage_runs, writing_genius_sentence_checks, test_prep_attempts: additional separate evidence.

## New database migration already applied
Migration: create_admin_biweekly_reporting_engine_v1, Willena Game Scores project.
- biweekly_report_runs: exact 14-day dates, draft/published, publisher info.
- biweekly_report_student_snapshots: frozen per-student evidence JSONB, optional note.
- RPCs biweekly_report_generate(date,date), biweekly_report_save_note(uuid,text), biweekly_report_publish(uuid).
- Only authenticated, approved admins may use the RPCs or read the RLS-protected report tables.
- The snapshot is created once per 14-day period; repeated Generate requests load the same frozen data. Publishing locks notes.
- Source tables are never modified.
- A report is generated only after the 14 days end in Asia/Seoul.
- Student class membership is the active roster *when the snapshot is generated*, not a retroactive historical class lookup.

## Sharing
Open a student report drawer. **Copy image** uses a PNG ClipboardItem via the browser Canvas API on secure HTTPS. Paste into your message app. Browser clipboard support varies; **Download PNG** works as a fallback. **Copy message** copies a Korean plain-text summary. Printing also uses the report card.

## Important notes
- Distinct app response counts can overlap. They are displayed separately, never combined as a proficiency score.
- Skill percentages use first-response accuracy when available. Fewer than 10 graded responses suppresses the percentage; the overall percentage needs at least 20 first responses.
- Digital tasks named "speaking" reflect task accuracy, not human oral-fluency assessment.
- AI Writing means actual Writing Genius feedback events; no AI assessment is fabricated for students without those events.
- New RLS is independent from the pre-existing profiles permissions; audit the existing profiles policy before wider access.
- Test deployed route, authorizations, image clipboard and CSS in a staging session before distributing the first report.

## Production testing
1. Sign in as admin and open Biweekly Reports.
2. Generate a completed 14-day period, verify student count and a student's evidence against raw activity.
3. Re-generate to confirm idempotency and unchanged metrics.
4. Save a teacher note; confirm it appears in both image and plain-text copy.
5. Copy image to the target message app (Chrome/Edge); test Download PNG fallback (mobile Safari).
6. Publish only when reviews are complete; confirm notes lock and PDF/PNG still work.
7. Check no access for teachers/students/anon.
