-- Writing Genius: student-owned drafts, journals and topic writing.
-- Submitted work is visible to approved academy teachers, but never public.
CREATE TABLE IF NOT EXISTS public.writing_genius_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sentence','diary','topic')),
  title text NOT NULL DEFAULT '',
  prompt_key text,
  prompt_text text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  writing_date date NOT NULL DEFAULT (timezone('Asia/Seoul',now())::date),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  CONSTRAINT wg_title_length CHECK(char_length(title)<=120),
  CONSTRAINT wg_prompt_length CHECK(char_length(prompt_text)<=1500),
  CONSTRAINT wg_prompt_key_length CHECK(char_length(coalesce(prompt_key,''))<=120),
  CONSTRAINT wg_body_length CHECK(char_length(body)<=12000),
  CONSTRAINT wg_submit_requires_text CHECK(status <> 'submitted' OR char_length(btrim(body))>=3)
);
CREATE UNIQUE INDEX IF NOT EXISTS writing_genius_one_diary_per_day
ON public.writing_genius_entries(student_id,writing_date)
WHERE kind='diary';
CREATE INDEX IF NOT EXISTS writing_genius_student_recent
ON public.writing_genius_entries(student_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS writing_genius_submitted_by_date
ON public.writing_genius_entries(submitted_at DESC) WHERE status='submitted';

CREATE OR REPLACE FUNCTION public.writing_genius_touch_entry_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public','pg_temp'
AS $fn$
BEGIN
  NEW.updated_at:=now();
  IF NEW.status='submitted' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'submitted')
  THEN NEW.submitted_at:=now();
  ELSIF NEW.status='draft' THEN NEW.submitted_at:=NULL;
  END IF;
  RETURN NEW;
END $fn$;
DROP TRIGGER IF EXISTS writing_genius_touch_entry ON public.writing_genius_entries;
CREATE TRIGGER writing_genius_touch_entry
BEFORE INSERT OR UPDATE ON public.writing_genius_entries
FOR EACH ROW EXECUTE FUNCTION public.writing_genius_touch_entry_v1();

ALTER TABLE public.writing_genius_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.writing_genius_entries FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.writing_genius_entries TO authenticated;
REVOKE ALL ON FUNCTION public.writing_genius_touch_entry_v1() FROM PUBLIC,anon,authenticated;

DROP POLICY IF EXISTS writing_genius_read_v1 ON public.writing_genius_entries;
CREATE POLICY writing_genius_read_v1 ON public.writing_genius_entries FOR SELECT TO authenticated
USING (
  (student_id=(SELECT auth.uid()))
  OR (status='submitted' AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
      AND p.role IN ('teacher','admin') AND p.approved IS TRUE
  ))
);
DROP POLICY IF EXISTS writing_genius_insert_v1 ON public.writing_genius_entries;
CREATE POLICY writing_genius_insert_v1 ON public.writing_genius_entries FOR INSERT TO authenticated
WITH CHECK (
  student_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.role='student' AND p.approved IS DISTINCT FROM false)
);
DROP POLICY IF EXISTS writing_genius_update_v1 ON public.writing_genius_entries;
CREATE POLICY writing_genius_update_v1 ON public.writing_genius_entries FOR UPDATE TO authenticated
USING (student_id=(SELECT auth.uid()))
WITH CHECK (
  student_id=(SELECT auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid())
    AND p.role='student' AND p.approved IS DISTINCT FROM false)
);
DROP POLICY IF EXISTS writing_genius_delete_v1 ON public.writing_genius_entries;
CREATE POLICY writing_genius_delete_v1 ON public.writing_genius_entries FOR DELETE TO authenticated
USING (student_id=(SELECT auth.uid()) AND status='draft');
