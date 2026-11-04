# Word Genius Coach-vs-Test Homework: Rollback

## Behaviour
- Teacher selects exactly one spelling mode: Spelling Test (default) or Spelling Coach (Level 1 and below).
- Existing assignments without `coach_golden_enabled` remain unchanged.
- Coach completion requires correct unassisted final attempts (support_level=0). Hints, retries and points are retained.
- Existing independent Spelling Test mastery is unchanged. Golden achievement remains unique per student/book/unit.

## Fast rollback without student data loss
1. Restore ONLY Teachers/dashboard-v2/word-genius-catalog-assignment.js and Teachers/index.html from teachers branch before the Coach commits. The stage-3 baseline is commit c3bb4aaedd3d8b4fd17e96530d32329adac285f2. Do not reset unrelated files.
2. Restore ONLY students/vocab-study/vocab-study.js and students/vocab-study/index.html from students branch before Coach commits 15eb10a2a6ceabe5703a789f11384c78aae8cf95 and 58bde950d7473ea289809b617c5d8a3c33527b91.
3. Disable Coach Golden eligibility per assignment (no deletes):
```sql
UPDATE public.homework_assignments
SET list_meta=jsonb_set(list_meta,'{coach_golden_enabled}','false'::jsonb,true)
WHERE source_type='vocab_study' AND list_meta->>'coach_golden_enabled'='true';
```
4. Do NOT delete or rewrite study_attempts, student_vocab_skill_state_v1 or student_achievements.

Coach assignments already created will no longer count as complete after rollback. Tell teachers and convert or re-enable them before expecting students to finish them.

## Re-enable
Restore those UI changes and set coach_golden_enabled=true for the intended Coach assignments. Existing saved attempts remain available.

## Database functions changed
- vocab_assignment_cell_pass_v2
- get_vocab_assignment_progress_v1
- get_vocab_assignment_student_detail_v1
- award_vocab_golden_unit_v1
- teacher_vocab_class_preview_v1

Database functions are gated by assignment metadata; reverting frontend and disabling the flag makes the Coach-specific branches dormant. No existing Golden Unit was removed or altered.

## Validation
SQL Coach assignment progress was checked in a rolled-back transaction; normal progress reads were checked. JS was syntax-checked. A controlled live student test of Gold awarding is still needed.