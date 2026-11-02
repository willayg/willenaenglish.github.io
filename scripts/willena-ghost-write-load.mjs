// Willena production ghost-only study write-load harness.
// Requires a manual GitHub workflow. Uses the existing record_study_attempt_v1 RPC.
import {writeFileSync} from "node:fs";
const BASE=(process.env.SUPABASE_URL||"").replace(/\/$/,"");
const KEY=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||"";
const LEVEL=Number(process.env.TEST_LEVEL||15),ROUNDS=Number(process.env.TEST_ROUNDS||2);
if(!BASE.startsWith("https://")||!KEY||![1,15,30,50].includes(LEVEL)||!Number.isInteger(ROUNDS)||ROUNDS<1||ROUNDS>10)throw Error("Missing credentials or invalid limits");
const headers={apikey:KEY,authorization:"Bearer "+KEY,"Content-Type":"application/json"};
const uuid=()=>crypto.randomUUID();
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function api(path,{method="GET",body,timeout=12000}={}){
 const t=performance.now();
 try{
  const res=await fetch(BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(timeout)});
  const raw=await res.text();let payload;try{payload=JSON.parse(raw)}catch{payload={raw:raw.slice(0,150)}}
  if(!res.ok)throw Error("HTTP "+res.status+" "+JSON.stringify(payload).slice(0,160));
  return {data:payload,ms:Math.round(performance.now()-t)};
 }catch(e){throw Error(String(e).slice(0,200))}
}
const roster=(await api("/rest/v1/willena_load_test_roster_v1?select=label,slot,auth_user_id,profile_id,enabled&order=slot.asc")).data;
if(roster.length!==50)throw Error("Ghost roster incomplete");
const actors=roster.slice(0,LEVEL);
for(const actor of actors){
 if(!actor.auth_user_id||actor.auth_user_id!==actor.profile_id)throw Error("Invalid ghost identity "+actor.label);
}
const ids=actors.map(x=>x.profile_id);
const filter="("+ids.join(",")+")";
const ghosts=(await api("/rest/v1/profiles?select=id,is_ghost,role,class&id=in."+encodeURIComponent(filter))).data;
if(ghosts.length!==LEVEL||ghosts.some(p=>p.is_ghost!==true||p.role!=="student"||p.class!=="Load Test"))throw Error("Ghost-only verification failed");
const skillKinds=["vocabulary","spelling","speaking","grammar","sentence_building","sentence_unscramble","sentence_coach","listening","conversation"];
const fixtures=[];
for(const skill of skillKinds){
 const rows=(await api("/rest/v1/study_attempts?select=book_id,unit_id,content_id,mastery_content_id,content_type,skill,response_type,activity_id&book_id=not.is.null&unit_id=not.is.null&content_id=not.is.null&skill=eq."+skill+"&limit=18")).data;
 fixtures.push(...rows.filter(x=>x.book_id&&x.unit_id&&x.content_id&&x.mastery_content_id));
}
if(fixtures.length<9)throw Error("Insufficient genuine study fixtures");
const choices=fixtures;
console.log("Verified",LEVEL,"ghost-only profiles. Fixture skills:",[...new Set(choices.map(x=>x.skill))].join(", "));
const report={started_at:new Date().toISOString(),actors:LEVEL,rounds:ROUNDS,mode:"study_rpc_real_writes",results:[],notes:["No genuine profile IDs are used.","Test Prep answer-write path not included in this version."]};
function percentile(vals,n){const x=vals.slice().sort((a,b)=>a-b);return x[Math.max(0,Math.ceil(x.length*n)-1)]||0}
let halted=false;
for(let round=0;round<ROUNDS&&!halted;round++){
 const stage=await Promise.all(actors.map(async(actor,i)=>{
  const fixture=choices[(i+round*LEVEL)%choices.length],id=uuid(),session=uuid(),correct=(i+round)%5!==0;
  // Each virtual student submits one genuine scoring RPC, then verifies persistence.
  const payload={session_id:session,client_attempt_id:id,book_id:fixture.book_id,unit_id:fixture.unit_id,content_id:fixture.content_id,mastery_content_id:fixture.mastery_content_id,content_type:fixture.content_type,mastery_content_type:fixture.content_type,skill:fixture.skill,response_type:fixture.response_type,activity_id:fixture.activity_id,score:correct?1:0,is_correct:correct,response_time_ms:750+(i%7)*260,student_answer:correct?"test-correct":"test-incorrect",correct_answer:"test-correct",stimulus_snapshot:{load_test:true},metadata:{willena_ghost_load_test:true,round,fixture:fixture.activity_id},scoring_version:"activity-v1",progress_version:"study-v1"};
  try{
   const start=performance.now();
   const sent=await api("/rest/v1/rpc/record_study_attempt_v1",{method:"POST",body:{p_student_id:actor.profile_id,p_payload:payload}});
   const recorded=await api("/rest/v1/study_attempts?select=id,student_id,client_attempt_id,skill,is_correct&client_attempt_id=eq."+id);
   const row=recorded.data?.[0];
   return {label:actor.label,skill:fixture.skill,ok:sent.data?.success===true&&row?.student_id===actor.profile_id&&row.client_attempt_id===id,ms:Math.round(performance.now()-start),reason:row?"":"attempt_not_persisted"};
  }catch(err){return {label:actor.label,skill:fixture.skill,ok:false,error:String(err).slice(0,200)}}
 }));
 report.results.push(...stage.map(x=>({...x,round:round+1})));
 const done=stage.filter(x=>x.ok),lat=done.map(x=>x.ms),p95=percentile(lat,.95);
 console.log("Round",round+1,":",done.length,"/",stage.length,"saved, p95",p95,"ms");
 for(const problem of stage.filter(x=>!x.ok).slice(0,5))console.error("FAILED",problem.label,problem.skill,problem.error||problem.reason||"unknown");
 if(done.length!==stage.length||p95>5000){console.log("HALT: failure or p95 above 5000ms");halted=true}
 if(!halted&&round+1<ROUNDS)await sleep(2500);
}
report.finished_at=new Date().toISOString();report.failed=report.results.filter(x=>!x.ok).length;report.success=report.results.length-report.failed;report.p95_ms=percentile(report.results.filter(x=>x.ok).map(x=>x.ms),.95);report.halted=halted;
writeFileSync("willena-ghost-write-report.json",JSON.stringify(report,null,2));
console.log("Report saved. Successful:",report.success,"Failed:",report.failed,"p95:",report.p95_ms);
if(halted||report.failed)process.exitCode=1;
