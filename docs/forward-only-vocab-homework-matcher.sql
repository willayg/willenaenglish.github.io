-- Forward-only Word Genius homework recognition, deployed on 2026-11-03.
-- Trigger only affects newly INSERTed attempts. No backfill of historical records.
-- Ambiguous overlaps are not linked. Points/stars remain unchanged.

CREATE OR REPLACE FUNCTION public.willena_match_new_vocab_homework_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_match uuid;
  v_count integer;
  v_mode text;
  v_class text;
begin
  -- INSERT ONLY: existing attempts are not reconsidered or modified.
  if new.assignment_id is not null
     or new.mastery_content_id is null
     or new.mastery_content_type is distinct from 'lexical_entry'
     or new.book_id is null or new.unit_id is null
     or new.metadata->>'vocab_study' is distinct from 'true'
     or coalesce((new.metadata->>'preview_mode')::boolean,false)
  then return new; end if;

  v_mode:=new.metadata->>'vocab_mode';
  if v_mode not in ('quiz','spelling_test','speaking') then return new; end if;
  if (v_mode='quiz' and new.skill<>'vocabulary')
      or (v_mode='spelling_test' and new.skill<>'spelling')
      or (v_mode='speaking' and new.skill<>'speaking')
  then return new; end if;

  select p.class into v_class
  from public.profiles p
  where p.id=new.student_id and p.role='student' and p.approved=true;
  if v_class is null then return new; end if;

  select min(h.id::text)::uuid,count(*) into v_match,v_count
  from public.homework_assignments h
  where h.source_type='vocab_study'
    and h.class=v_class and h.active is true
    and h.status='active' and h.ended_at is null
    and (h.start_at is null or h.start_at<=new.created_at)
    and h.created_at<=new.created_at
    and (h.due_at is null or h.due_at>=new.created_at)
    and h.list_meta->>'source_book_id'=new.book_id::text
    and (h.list_meta->>'source_unit_id'=new.unit_id::text
         or h.list_meta->>'unit_id'=new.unit_id::text
         or (jsonb_typeof(h.list_meta->'source_unit_ids')='array'
             and h.list_meta->'source_unit_ids' ? new.unit_id::text))
    and (jsonb_typeof(h.list_meta->'target_student_ids') is distinct from 'array'
         or jsonb_array_length(h.list_meta->'target_student_ids')=0
         or h.list_meta->'target_student_ids' ? new.student_id::text)
    and (case when jsonb_typeof(h.list_meta->'required_modes')='array'
          and jsonb_array_length(h.list_meta->'required_modes')>0
       then h.list_meta->'required_modes' ? v_mode
       else v_mode in ('quiz','spelling_test','speaking') end)
    and exists(
      select 1 from public.study_assignment_targets t
      where t.assignment_id=h.id and t.lexical_entry_id=new.mastery_content_id
    );
  -- Multiple overlapping eligible assignments: do not guess.
  if v_count=1 then
    new.assignment_id:=v_match;
    new.metadata:=coalesce(new.metadata,'{}'::jsonb) ||
      jsonb_build_object('assignment_id',v_match,'auto_homework_match',true,
                         'homework_match_version','v1-forward-only');
  end if;
  return new;
end;
$function$


REVOKE ALL ON FUNCTION public.willena_match_new_vocab_homework_v1() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS willena_match_new_vocab_homework_insert_v1 ON public.study_attempts;
CREATE TRIGGER willena_match_new_vocab_homework_insert_v1 BEFORE INSERT ON public.study_attempts
FOR EACH ROW EXECUTE FUNCTION public.willena_match_new_vocab_homework_v1();
