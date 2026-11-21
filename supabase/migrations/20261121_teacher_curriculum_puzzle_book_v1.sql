-- Book-wide puzzle completion records for teacher curriculum grids
-- Applied to project fiieuiktlsivwfgyivai on 2026-11-21.
CREATE OR REPLACE FUNCTION public.teacher_curriculum_puzzle_book_v1(p_class text, p_book_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or not exists (
  select 1 from public.profiles p
  where p.id=auth.uid() and p.approved=true and p.role in ('teacher','admin')
 ) then raise exception 'Staff login required' using errcode='42501'; end if;
 if p_book_id is null or nullif(trim(coalesce(p_class,'')),'') is null or not exists(
  select 1 from public.class_book_assignments a
  join public.classes c on c.id=a.class_id
  where a.book_id=p_book_id and a.status='active' and c.status='active'
  and lower(trim(c.name))=lower(trim(p_class))
 ) then raise exception 'Book not assigned to this class' using errcode='22023'; end if;
 with roster as (
  select p.id from public.profiles p
  where lower(trim(p.class))=lower(trim(p_class))
  and p.role='student' and p.approved=true and coalesce(p.is_ghost,false)=false
 ), finished as (
  select s.user_id,s.mode,s.ended_at,s.id
  from public.progress_sessions s join roster r on r.id=s.user_id
  where s.mode in ('wordsearch','crossword','boggle','mixmatch','wordle')
    and s.summary->>'book_id'=p_book_id::text
    and s.ended_at is not null and s.summary->>'completed'='true'
 ), grouped as (
  select user_id,count(distinct id) sessions,
   count(distinct mode) completed_modes,max(ended_at) last_at,
   jsonb_agg(distinct mode) modes
  from finished group by user_id
 )
 select coalesce(jsonb_agg(jsonb_build_object(
  'student_id',user_id,'sessions',sessions,
  'completed_modes',completed_modes,'modes',modes,'last_at',last_at
  )),'[]'::jsonb) into result from grouped;
 return result;
end $function$;
REVOKE ALL ON FUNCTION public.teacher_curriculum_puzzle_book_v1(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.teacher_curriculum_puzzle_book_v1(text,uuid) TO authenticated,service_role;
