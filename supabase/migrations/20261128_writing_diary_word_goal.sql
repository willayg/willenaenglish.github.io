CREATE OR REPLACE FUNCTION public.award_writing_diary_v1(p_entry_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_user uuid := auth.uid(); v_entry record; v_count int; v_points int; v_session text; v_added int;
begin
 if v_user is null then raise exception 'Not authenticated'; end if;
 select id,student_id,body,status into v_entry from public.writing_genius_entries where id=p_entry_id and student_id=v_user;
 if not found or v_entry.status <> 'submitted' then raise exception 'Completed diary not found'; end if;
 select count(*) into v_count from regexp_matches(coalesce(v_entry.body,''),'[^.!?\n]+[.!?]+(?=\s|$)','g');
 if v_count>30 then raise exception 'Invalid diary sentence count'; end if;
 if v_count<6 then
   if (select count(*) from regexp_matches(coalesce(v_entry.body,''), $words$[A-Za-z]+(?:['’-][A-Za-z]+)*$words$, 'g'))<35
      or not exists (
        select 1 from public.writing_genius_diary_reviews r
        where r.entry_id=p_entry_id and r.student_id=v_user and r.original_body=v_entry.body
          and r.feedback->>'review_version'='2' and (r.spoken_at is not null or r.typed_at is not null)
      ) then
     raise exception 'Diary word goal or final practice not complete';
   end if;
   -- Keep the per-sentence payout. Treat a reviewed unpunctuated paragraph as one practice line.
   v_count:=greatest(1,v_count);
 end if;
 v_points:=v_count*5;
 v_session:='writing-diary:'||p_entry_id::text;
 insert into public.progress_sessions(session_id,user_id,mode,list_name,list_size,started_at,ended_at,summary)
 values(v_session,v_user,'writing_diary','Writing Genius · Daily Diary',v_count,now(),now(),
 jsonb_build_object('completed',true,'stars',5,'points_earned',v_points,'score',v_count,'total',v_count,'percent',100,'reward_scheme','writing-diary-v1','entry_id',p_entry_id))
 on conflict(session_id) do nothing;
 get diagnostics v_added=row_count;
 if v_added=1 then
  insert into public.progress_attempts(user_id,session_id,mode,word,is_correct,answer,correct_answer,points,attempt_index,stars,extra)
  values(v_user,v_session,'writing_diary','Daily Diary',true,'completed','completed',v_points,1,5,jsonb_build_object('source','writing-genius','entry_id',p_entry_id,'sentences',v_count));
 end if;
 return jsonb_build_object('awarded',v_added=1,'points',v_points,'stars',5,'sentences',v_count);
end $function$;
