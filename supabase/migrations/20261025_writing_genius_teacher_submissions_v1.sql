-- Approved staff can review submitted Writing Genius work, never student drafts.
CREATE OR REPLACE FUNCTION public.writing_genius_teacher_submissions_v1(p_class text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $fn$
DECLARE v_rows jsonb;v_classes jsonb;v_class text:=nullif(btrim(coalesce(p_class,'')),'');
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.profiles p
   WHERE p.id=auth.uid() AND p.role IN ('teacher','admin') AND p.approved IS true)
 THEN RAISE EXCEPTION 'Teacher access required' USING errcode='42501'; END IF;
 SELECT coalesce(jsonb_agg(x.name ORDER BY x.name),'[]'::jsonb) INTO v_classes
 FROM (SELECT c.name FROM public.classes c
    WHERE c.status='active' AND lower(c.name)<>'test' ORDER BY c.name) x;
 SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.submitted_at DESC),'[]'::jsonb)
 INTO v_rows
 FROM (
   SELECT w.id,w.student_id,p.name,p.korean_name,p.class AS class_name,
     w.kind,w.title,w.body,w.prompt_text,w.writing_date,w.submitted_at,w.updated_at
   FROM public.writing_genius_entries w
   JOIN public.profiles p ON p.id=w.student_id
   JOIN public.classes c ON c.name=p.class AND c.status='active'
   WHERE w.status='submitted' AND p.role='student'
     AND p.approved IS DISTINCT FROM false
     AND lower(coalesce(p.class,''))<>'test'
     AND (v_class IS NULL OR p.class=v_class)
   ORDER BY w.submitted_at DESC LIMIT 250
 ) x;
 RETURN jsonb_build_object('success',true,'entries',v_rows,'classes',v_classes);
END $fn$;
REVOKE ALL ON FUNCTION public.writing_genius_teacher_submissions_v1(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.writing_genius_teacher_submissions_v1(text) TO authenticated;
