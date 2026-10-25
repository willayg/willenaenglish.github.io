import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL=Deno.env.get('SUPABASE_URL')!;
const ANON=Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':'GET,OPTIONS',
  'Content-Type':'application/json',
  'Cache-Control':'private, max-age=45, stale-while-revalidate=90'
};
const out=(status:number,body:any)=>new Response(JSON.stringify(body),{status,headers:cors});
const pct=(c:number,n:number)=>n?Math.round(c/n*100):null;
const chunks=<T,>(xs:T[],size:number)=>{const out:T[][]=[];for(let i=0;i<xs.length;i+=size)out.push(xs.slice(i,i+size));return out};
const time=(v:any)=>{const n=new Date(v||0).getTime();return Number.isFinite(n)?n:0};
const later=(a:any,b:any)=>time(a)>=time(b)?a:b;
const seoulDay=(v:any)=>{if(!v)return'';try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(v))}catch{return String(v).slice(0,10)}};
const todaySeoul=()=>seoulDay(new Date().toISOString());

async function fetchAll(admin:any,table:string,select:string,apply:(q:any)=>any,orderCol?:string,pageSize=1000){
  const rows:any[]=[];
  for(let from=0;;from+=pageSize){
    let q=admin.from(table).select(select);
    q=apply(q);
    if(orderCol)q=q.order(orderCol,{ascending:false});
    q=q.range(from,from+pageSize-1);
    const r=await q;
    if(r.error)throw r.error;
    const page=r.data||[];rows.push(...page);
    if(page.length<pageSize)break;
  }
  return rows;
}

function resultEntries(run:any){
  const rows=Array.isArray(run?.results)?run.results:[];
  return rows.map((r:any,i:number)=>({
    correct:r?.correct===true,
    question_id:r?.questionId||r?.question_id||null,
    source_key:r?.sourceKey||r?.source_key||null,
    response:r?.response??null,
    completed_at:run.completed_at,
    module_id:run.module_id,
    stage_id:run.stage_id||null,
    kind:run.kind||'stage',
    order:i
  }));
}
function recentAnswerSummary(runs:any[],limit=50){
  const answers:any[]=[];
  const sorted=[...runs].sort((a,b)=>time(b.completed_at)-time(a.completed_at));
  for(const run of sorted){
    const items=resultEntries(run).reverse();
    for(const item of items){answers.push(item);if(answers.length>=limit)break}
    if(answers.length>=limit)break;
  }
  const correct=answers.filter(x=>x.correct).length;
  return {accuracy:pct(correct,answers.length),count:answers.length,correct};
}
function questionsOnDay(runs:any[],day:string){
  let n=0;
  for(const run of runs)if(seoulDay(run.completed_at)===day)n+=resultEntries(run).length;
  return n;
}

Deno.serve(async(req:Request)=>{
  if(req.method==='OPTIONS')return new Response('',{status:200,headers:cors});
  if(req.method!=='GET')return out(405,{success:false,error:'GET required'});
  try{
    const auth=req.headers.get('Authorization')||'';
    if(!auth.startsWith('Bearer '))return out(401,{success:false,error:'Not signed in'});
    const userClient=createClient(SUPABASE_URL,ANON,{global:{headers:{Authorization:auth}},auth:{persistSession:false}});
    const admin=createClient(SUPABASE_URL,SERVICE,{auth:{persistSession:false}});
    const {data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData?.user)return out(401,{success:false,error:'Not signed in'});
    const uid=userData.user.id;
    const roleRow=await admin.from('profiles').select('id,role,approved').eq('id',uid).maybeSingle();
    if(roleRow.error)throw roleRow.error;
    const role=String(roleRow.data?.role||'').toLowerCase();
    if(!roleRow.data?.approved||!['teacher','admin'].includes(role))return out(403,{success:false,error:'Teacher access required'});

    const url=new URL(req.url);
    const action=url.searchParams.get('action')||'students';
    // Fast teacher roster: same snapshot/dirty refresh architecture as 내신.
    // Keep the detailed lesson/question reader below for student_detail.
    if(action==='students'){
      const {data:insights,error:insightsError}=await userClient.rpc('genius_teacher_snapshot_read_v1',{
        p_app:'grammar',p_class:null,p_days:30,p_refresh_limit:80
      });
      if(insightsError||insights?.success!==true)
        throw new Error(insightsError?.message||'Grammar Genius snapshot unavailable');
      const students=(insights.students||[])
        .filter((s:any)=>Number(s.attempts)>0||Number(s.levels_started)>0||
          Number(s.challenges_passed)>0)
        .map((s:any)=>({
          user_id:s.id,name:s.name||'Student',korean_name:s.korean_name||'',
          class:s.class||'',grade:s.grade||'',school:'',
          recent_accuracy:s.recent_accuracy,recent_count:s.recent_count,
          recent_correct:s.recent_correct,
          questions_today:s.today_attempts||0,last_activity:s.last_activity,
          levels_passed:s.levels_passed||0,levels_started:s.levels_started||0,
          challenge_passed:s.challenges_passed||0
        }))
        .sort((a:any,b:any)=>time(b.last_activity)-time(a.last_activity));
      return out(200,{success:true,students,generated_at:new Date().toISOString(),
        recent_window:50,snapshot_source:'genius_teacher_dashboard_snapshots_v1',
        pending:insights.pending||0});
    }


    const [stageProgress,challengeProgress]=await Promise.all([
      fetchAll(admin,'grammar_foundation_stage_progress','student_id,module_id,stage_id,attempt_count,best_score,latest_score,total,passed,first_passed_at,last_attempt_at,updated_at',q=>q,'last_attempt_at'),
      fetchAll(admin,'grammar_foundation_challenge_progress','student_id,module_id,attempt_count,best_score,latest_score,total,passed,first_passed_at,last_attempt_at,updated_at',q=>q,'last_attempt_at')
    ]);
    const studentIds=[...new Set([...stageProgress,...challengeProgress].map((r:any)=>String(r.student_id||'')).filter(Boolean))];
    if(!studentIds.length){
      if(action==='students')return out(200,{success:true,students:[],generated_at:new Date().toISOString(),recent_window:50});
      return out(404,{success:false,error:'No Grammar Foundations activity found'});
    }

    let profiles:any[]=[];
    for(const ids of chunks(studentIds,100)){
      const r=await admin.from('profiles').select('id,name,korean_name,username,class,grade,school').in('id',ids);
      if(r.error)throw r.error;profiles.push(...(r.data||[]));
    }
    const profileMap=new Map(profiles.map((p:any)=>[String(p.id),p]));

    async function runsFor(ids:string[]){
      const stageRuns:any[]=[];const challengeRuns:any[]=[];
      for(const part of chunks(ids,80)){
        const [s,c]=await Promise.all([
          fetchAll(admin,'grammar_foundation_stage_runs','id,student_id,module_id,stage_id,score,total,passed,results,completed_at',q=>q.in('student_id',part),'completed_at'),
          fetchAll(admin,'grammar_foundation_challenge_runs','id,student_id,module_id,score,total,passed,question_ids,results,completed_at',q=>q.in('student_id',part),'completed_at')
        ]);
        stageRuns.push(...s.map((x:any)=>({...x,kind:'stage'})));
        challengeRuns.push(...c.map((x:any)=>({...x,kind:'challenge',stage_id:null})));
      }
      return [...stageRuns,...challengeRuns];
    }

    if(action==='students'){
      const runs=await runsFor(studentIds);
      const byStudent=new Map<string,any[]>();
      for(const run of runs){const sid=String(run.student_id);if(!byStudent.has(sid))byStudent.set(sid,[]);byStudent.get(sid)!.push(run)}
      const today=todaySeoul();
      const rows=studentIds.map(sid=>{
        const sp=stageProgress.filter((r:any)=>String(r.student_id)===sid);
        const cp=challengeProgress.filter((r:any)=>String(r.student_id)===sid);
        const rr=byStudent.get(sid)||[];
        const recent=recentAnswerSummary(rr,50);
        const latestRun=[...rr].sort((a,b)=>time(b.completed_at)-time(a.completed_at))[0]||null;
        let lastActivity:any=null;
        for(const r of [...sp,...cp])if(!lastActivity||time(r.last_attempt_at)>time(lastActivity))lastActivity=r.last_attempt_at;
        if(latestRun?.completed_at)lastActivity=lastActivity?later(lastActivity,latestRun.completed_at):latestRun.completed_at;
        const p=profileMap.get(sid)||{id:sid};
        return {
          user_id:sid,name:p.name||p.username||'Student',korean_name:p.korean_name||'',class:p.class||'',grade:p.grade||'',school:p.school||'',
          recent_accuracy:recent.accuracy,recent_count:recent.count,recent_correct:recent.correct,
          questions_today:questionsOnDay(rr,today),last_activity:lastActivity,
          latest_module_id:latestRun?.module_id||null,latest_stage_id:latestRun?.stage_id||null,latest_kind:latestRun?.kind||null,
          levels_passed:sp.filter((r:any)=>r.passed===true).length,levels_started:sp.length,
          challenge_passed:cp.filter((r:any)=>r.passed===true).length,
          stage_attempts:sp.reduce((n:number,r:any)=>n+Number(r.attempt_count||0),0),
          challenge_attempts:cp.reduce((n:number,r:any)=>n+Number(r.attempt_count||0),0)
        };
      }).sort((a,b)=>time(b.last_activity)-time(a.last_activity));
      return out(200,{success:true,students:rows,generated_at:new Date().toISOString(),recent_window:50,today_timezone:'Asia/Seoul',snapshot_source:'grammar_foundation_stage_progress'});
    }

    if(action==='student_detail'){
      const sid=String(url.searchParams.get('student_id')||'');
      if(!sid||!studentIds.includes(sid))return out(404,{success:false,error:'Student not found in Grammar Foundations activity'});
      const rr=await runsFor([sid]);
      const sp=stageProgress.filter((r:any)=>String(r.student_id)===sid).sort((a:any,b:any)=>time(b.last_attempt_at)-time(a.last_attempt_at));
      const cp=challengeProgress.filter((r:any)=>String(r.student_id)===sid).sort((a:any,b:any)=>time(b.last_attempt_at)-time(a.last_attempt_at));
      const recent=recentAnswerSummary(rr,50);
      const latest=[...rr].sort((a,b)=>time(b.completed_at)-time(a.completed_at));
      const p=profileMap.get(sid)||{id:sid};
      const recentRuns=latest.slice(0,30).map((r:any)=>({
        id:r.id,kind:r.kind,module_id:r.module_id,stage_id:r.stage_id||null,score:r.score,total:r.total,passed:r.passed,
        answered:resultEntries(r).length,completed_at:r.completed_at,
        question_ids:Array.isArray(r.question_ids)?r.question_ids:[],
        results:Array.isArray(r.results)?r.results:[]
      }));
      const challengeLatest=new Map<string,any>();
      for(const r of latest){
        if(r.kind!=='challenge')continue;
        const k=String(r.module_id);
        if(!challengeLatest.has(k))challengeLatest.set(k,r);
      }
      const challengeRuns=[...challengeLatest.values()].map((r:any)=>({
        id:r.id,module_id:r.module_id,score:r.score,total:r.total,passed:r.passed,completed_at:r.completed_at,
        question_ids:Array.isArray(r.question_ids)?r.question_ids:[],
        results:Array.isArray(r.results)?r.results:[]
      }));
      let lastActivity:any=null;
      for(const r of [...sp,...cp])if(!lastActivity||time(r.last_attempt_at)>time(lastActivity))lastActivity=r.last_attempt_at;
      if(latest[0]?.completed_at)lastActivity=lastActivity?later(lastActivity,latest[0].completed_at):latest[0].completed_at;
      return out(200,{success:true,
        student:{id:sid,name:p.name||p.username||'Student',korean_name:p.korean_name||'',class:p.class||'',grade:p.grade||'',school:p.school||''},
        summary:{recent_accuracy:recent.accuracy,recent_count:recent.count,recent_correct:recent.correct,last_activity:lastActivity,levels_passed:sp.filter((r:any)=>r.passed===true).length,levels_started:sp.length,stage_attempts:sp.reduce((n:number,r:any)=>n+Number(r.attempt_count||0),0),challenge_passed:cp.filter((r:any)=>r.passed===true).length,challenge_started:cp.length,challenge_attempts:cp.reduce((n:number,r:any)=>n+Number(r.attempt_count||0),0)},
        stage_progress:sp,challenge_progress:cp,challenge_runs:challengeRuns,recent_runs:recentRuns,recent_window:50,snapshot_source:'grammar_foundation_stage_progress'});
    }

    return out(400,{success:false,error:'Unknown action'});
  }catch(e:any){
    console.error('[grammar-foundations-teacher-v1]',e);
    return out(500,{success:false,error:e?.message||'Server error'});
  }
});