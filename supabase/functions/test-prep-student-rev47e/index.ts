import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const URL=Deno.env.get('SUPABASE_URL')!, ANON=Deno.env.get('SUPABASE_ANON_KEY')!, SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json'};
const out=(s:number,b:any)=>new Response(JSON.stringify(b),{status:s,headers:cors});
const arr=(v:any)=>Array.isArray(v)?v:[];
const n=(v:any)=>Number.isFinite(Number(v))?Number(v):0;
const plusMinutes=(m:number)=>new Date(Date.now()+m*60000).toISOString();
const isReview=(m:any)=>!!(m&&typeof m==='object'&&(m.review_mode===true||m.reviewMode===true||m.source==='wrong-review'));
function normalizeGroupForStudent(g:any){
 if(!g)return g;
 const scope=g.scope&&typeof g.scope==='object'?g.scope:{};
 const lessons=arr(scope.lessons).map((x:any)=>({...x}));
 const external_passages=arr(scope.external_passages).map((x:any)=>({...x,lesson:String(x?.lesson||x?.label||x?.unit_label||'외부지문'),unit_type:'external_passage'}));
 return {...g,scope:{...scope,lessons,external_passages}};
}
function summary(at:any[],se:any[],st:any[],plan:any){
 const first=new Map<string,any>(),latest=new Map<string,any>();
 for(const a of at){const k=String(a.question_id);if(!first.has(k))first.set(k,a);latest.set(k,a)}
 const fv=[...first.values()], attempts=at.length, unique=latest.size;
 const scope=new Set(arr(plan.practice_types).map((x:any)=>String(x).toLowerCase()));
 const examUnique=new Set(at.filter(a=>scope.has(String(a.practice_type).toLowerCase())).map(a=>String(a.question_id))).size;
 const accuracy=attempts?Math.round(at.filter(a=>a.is_correct).length/attempts*100):null;
 const firstAcc=fv.length?Math.round(fv.filter(a=>a.is_correct).length/fv.length*100):null;
 const unresolved=st.filter(x=>x.unresolved===true);
 const due=unresolved.filter(x=>!x.next_review_at||new Date(x.next_review_at).getTime()<=Date.now());
 const next=unresolved.filter(x=>x.next_review_at).sort((a,b)=>new Date(a.next_review_at).getTime()-new Date(b.next_review_at).getTime())[0]?.next_review_at||null;
 const initialWrong=fv.filter(a=>!a.is_correct).length, corrected=st.filter(x=>!x.unresolved&&n(x.wrong_count)>0).length;
 const by:any={}, byLessonPractice:any={};
 for(const a of at){const k=String(a.practice_type||'other'),lesson=String(a.unit_key||'');by[k]??={attempts:0,correct:0,unique:new Set<string>()};by[k].attempts++;if(a.is_correct)by[k].correct++;by[k].unique.add(String(a.question_id));if(lesson){const lk=`${lesson}||${k}`;byLessonPractice[lk]??={attempts:0,correct:0,unique:new Set<string>()};byLessonPractice[lk].attempts++;if(a.is_correct)byLessonPractice[lk].correct++;byLessonPractice[lk].unique.add(String(a.question_id))}}
 const norm=(o:any)=>Object.fromEntries(Object.entries(o).map(([k,v]:any)=>[k,{attempts:v.attempts,accuracy:v.attempts?Math.round(v.correct/v.attempts*100):null,unique:v.unique.size}]));
 const byPractice=norm(by),byLesson=norm(byLessonPractice),dueBy:any={};for(const x of due){const k=String(x.practice_type||'other');dueBy[k]=(dueBy[k]||0)+1}
 const active=se.reduce((x,s)=>x+n(s.active_time_ms),0),target=n(plan.question_target),completion=target?Math.min(100,Math.round(examUnique/target*100)):null;
 return{attempts,unique_questions:unique,exam_unique_questions:examUnique,accuracy,first_attempt_accuracy:firstAcc,unresolved_wrong:unresolved.length,due_review_count:due.length,next_review_at:next,correction_rate:initialWrong?Math.round(corrected/initialWrong*100):null,corrected,active_time_ms:active,sessions:se.length,last_study:se[0]?.started_at||null,retries:at.filter(a=>a.is_retry).length,completion,by_practice:byPractice,by_lesson_practice:byLesson,due_by_practice:dueBy};
}
function taskProgress(task:any,attempts:any[]){const created=new Date(task.created_at).getTime();const seen=new Set(attempts.filter(a=>a.plan_id===task.plan_id&&String(a.unit_key||'')===String(task.lesson||'')&&String(a.practice_type||'').toLowerCase()===String(task.practice_type||'').toLowerCase()&&new Date(a.attempted_at).getTime()>=created).map(a=>String(a.question_id)));const done=seen.size,target=Math.max(1,n(task.target_count)||10);return{done,target,remaining:Math.max(0,target-done),percent:Math.min(100,Math.round(done/target*100))}}
async function processAttempt(admin:any,uid:string,s:any,b:any){
 const qid=String(b?.question_id||'');if(!qid)throw new Error('question_id required');
 const clientId=b?.client_attempt_id?String(b.client_attempt_id):null;
 if(clientId){const ex=await admin.from('test_prep_attempts').select('id,attempted_at,attempt_number,is_retry,corrected_previous,response_time_ms').eq('student_id',uid).eq('client_attempt_id',clientId).maybeSingle();if(ex.error)throw ex.error;if(ex.data)return{success:true,duplicate:true,client_attempt_id:clientId,attempt:ex.data,review:null}}
 const prev=await admin.from('test_prep_question_state').select('*').eq('student_id',uid).eq('plan_id',s.plan_id).eq('question_id',qid).maybeSingle();if(prev.error)throw prev.error;
 const ps=prev.data||{}, attemptNo=n(ps.attempt_count)+1, retry=attemptNo>1, metadata=b.metadata&&typeof b.metadata==='object'?b.metadata:{}, review=isReview(metadata);
 const row={session_id:s.id,student_id:uid,plan_id:s.plan_id,book_key:s.book_key,unit_key:s.unit_key,question_id:qid,practice_type:s.practice_type,question_type:b.question_type?String(b.question_type):null,targets:arr(b.targets),selected_answer:b.selected_answer??null,correct_answer_snapshot:b.correct_answer??null,is_correct:!!b.is_correct,attempt_number:attemptNo,is_retry:retry,corrected_previous:!!b.is_correct&&!!ps.unresolved,response_time_ms:Math.max(0,Math.round(n(b.response_time_ms)))||null,metadata,client_attempt_id:clientId};
 let ir=await admin.from('test_prep_attempts').insert(row).select('id,attempted_at,attempt_number,is_retry,corrected_previous,response_time_ms').single();
 if(ir.error){if(clientId&&ir.error.code==='23505'){const ex=await admin.from('test_prep_attempts').select('id,attempted_at,attempt_number,is_retry,corrected_previous,response_time_ms').eq('student_id',uid).eq('client_attempt_id',clientId).maybeSingle();if(ex.error)throw ex.error;if(ex.data)return{success:true,duplicate:true,client_attempt_id:clientId,attempt:ex.data,review:null}}throw ir.error}
 const now=new Date().toISOString();let state:any;
 if(!b.is_correct){
   state={...ps,student_id:uid,plan_id:s.plan_id,question_id:qid,practice_type:s.practice_type,unit_key:s.unit_key,question_type:b.question_type||ps.question_type||null,targets:arr(b.targets).length?arr(b.targets):arr(ps.targets),attempt_count:attemptNo,wrong_count:n(ps.wrong_count)+1,correct_review_streak:0,review_stage:0,unresolved:true,first_wrong_at:ps.first_wrong_at||now,last_wrong_at:now,last_attempt_at:now,corrected_at:null,next_review_at:review?plusMinutes(60):now,metadata};
 } else if(ps.unresolved){
   if(!review){
     state={...ps,student_id:uid,plan_id:s.plan_id,question_id:qid,attempt_count:attemptNo,last_attempt_at:now};
   } else {
     const due=!ps.next_review_at||new Date(ps.next_review_at).getTime()<=Date.now();
     if(!due){state={...ps,student_id:uid,plan_id:s.plan_id,question_id:qid,attempt_count:attemptNo,last_attempt_at:now};}
     else {const repeatWrong=n(ps.wrong_count)>=2,required=repeatWrong?2:1,stage=n(ps.review_stage)+1,resolved=stage>=required;state={...ps,student_id:uid,plan_id:s.plan_id,question_id:qid,practice_type:s.practice_type,unit_key:s.unit_key,question_type:b.question_type||ps.question_type||null,targets:arr(b.targets).length?arr(b.targets):arr(ps.targets),attempt_count:attemptNo,correct_review_streak:n(ps.correct_review_streak)+1,review_stage:stage,unresolved:!resolved,last_attempt_at:now,corrected_at:resolved?now:null,next_review_at:resolved?null:plusMinutes(60),metadata};}
   }
 } else {
   state={...ps,student_id:uid,plan_id:s.plan_id,question_id:qid,practice_type:s.practice_type,unit_key:s.unit_key,question_type:b.question_type||ps.question_type||null,targets:arr(b.targets).length?arr(b.targets):arr(ps.targets),attempt_count:attemptNo,last_attempt_at:now,metadata};
 }
 const up=await admin.from('test_prep_question_state').upsert(state,{onConflict:'student_id,plan_id,question_id'});if(up.error)throw up.error;
 return{success:true,duplicate:false,client_attempt_id:clientId,attempt:ir.data,review:{unresolved:state.unresolved,review_stage:state.review_stage,next_review_at:state.next_review_at,wrong_count:state.wrong_count}};
}
Deno.serve(async(req:Request)=>{if(req.method==='OPTIONS')return new Response('',{status:200,headers:cors});try{
 const auth=req.headers.get('Authorization')||'';if(!auth.startsWith('Bearer '))return out(401,{success:false,error:'Not signed in'});
 const uc=createClient(URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}}),admin=createClient(URL,SERVICE,{auth:{persistSession:false}});
 const {data:u,error:ue}=await uc.auth.getUser();if(ue||!u?.user)return out(401,{success:false,error:'Not signed in'});const uid=u.user.id;
 const {data:profile,error:pe}=await admin.from('profiles').select('id,name,korean_name,username,class,grade,school,role,approved').eq('id',uid).maybeSingle();if(pe)throw pe;if(!profile?.approved)return out(403,{success:false,error:'Account is not approved'});
 const url=new globalThis.URL(req.url),action=url.searchParams.get('action')||'me';
 if(action==='me'&&req.method==='GET'){
   const fast=await admin.rpc('test_prep_student_me_fast_payload_v1',{p_student_id:uid});if(fast.error)throw fast.error;
   const payload=fast.data&&typeof fast.data==='object'?fast.data:{plans:[],tasks:[]};
   const plans=arr(payload.plans).map((p:any)=>({...p,group:p?.group?normalizeGroupForStudent(p.group):null}));
   const tasks=arr(payload.tasks);
   return out(200,{success:true,user:profile,plans,tasks,source:'fast-snapshot-v1'});
 }
 if(action==='start_session'&&req.method==='POST'){const b=await req.json();if(!b.plan_id||!b.practice_type)return out(400,{success:false,error:'plan_id and practice_type required'});const pr=await admin.from('test_prep_plans').select('*').eq('id',b.plan_id).eq('student_id',uid).eq('active',true).maybeSingle();if(pr.error)throw pr.error;if(!pr.data)return out(404,{success:false,error:'Active plan not found'});const p=pr.data,practice=String(b.practice_type).toLowerCase(),unit=b.unit_key?String(b.unit_key):null;const r=await admin.from('test_prep_sessions').insert({student_id:uid,plan_id:p.id,group_id:p.group_id||null,school:profile.school||null,exam_name:p.exam_name||null,book_key:p.book_key,unit_key:unit,practice_type:practice,question_count:0,correct_count:0,active_time_ms:0,unique_question_count:0,retry_count:0,unresolved_wrong_count:0,metadata:{source:'test-prep-app-rev47e',book_label:p.book_label||null}}).select().single();if(r.error)throw r.error;return out(200,{success:true,session:r.data})}
 if(action==='batch_attempts'&&req.method==='POST'){const b=await req.json(),sessionId=String(b?.session_id||''),attempts=arr(b?.attempts).slice(0,50);if(!sessionId||!attempts.length)return out(400,{success:false,error:'session_id and attempts required'});const sr=await admin.from('test_prep_sessions').select('id,plan_id,book_key,unit_key,practice_type').eq('id',sessionId).eq('student_id',uid).maybeSingle();if(sr.error)throw sr.error;if(!sr.data)return out(404,{success:false,error:'Session not found'});const results:any[]=[];for(const a of attempts){try{results.push(await processAttempt(admin,uid,sr.data,a))}catch(e:any){results.push({success:false,client_attempt_id:a?.client_attempt_id||null,error:e?.message||'Attempt failed'})}}return out(200,{success:true,saved:results.filter(r=>r.success&&!r.duplicate).length,duplicates:results.filter(r=>r.duplicate).length,failed:results.filter(r=>!r.success).length,results})}
 if(action==='complete_session'&&req.method==='POST'){const b=await req.json();if(!b.session_id)return out(400,{success:false,error:'session_id required'});const ar=await admin.from('test_prep_attempts').select('question_id,is_correct,is_retry').eq('session_id',b.session_id).eq('student_id',uid).order('attempted_at',{ascending:true});if(ar.error)throw ar.error;const at=ar.data||[],latest=new Map<string,boolean>();for(const a of at)latest.set(String(a.question_id),!!a.is_correct);const up=await admin.from('test_prep_sessions').update({completed_at:new Date().toISOString(),correct_count:at.filter(a=>a.is_correct).length,question_count:at.length,active_time_ms:Math.max(0,Math.round(n(b.active_time_ms))),unique_question_count:latest.size,retry_count:at.filter(a=>a.is_retry).length,unresolved_wrong_count:[...latest.values()].filter(v=>!v).length}).eq('id',b.session_id).eq('student_id',uid).select().maybeSingle();if(up.error)throw up.error;return out(200,{success:true,session:up.data})}
 if(action==='question_history'&&req.method==='GET'){const pid=url.searchParams.get('plan_id');if(!pid)return out(400,{success:false,error:'plan_id required'});const r=await admin.from('test_prep_question_state').select('*').eq('plan_id',pid).eq('student_id',uid);if(r.error)throw r.error;return out(200,{success:true,history:r.data||[]})}
 return out(404,{success:false,error:'Unknown action'});
}catch(e:any){console.error(e);return out(500,{success:false,error:e?.message||'Server error'})}});