import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS=["https://staging.willenaenglish.com","https://teachers.willenaenglish.com","https://willenaenglish.com","https://www.willenaenglish.com"];
const LEVELS=new Set(["S1","S2","1","2","3","4","5","6","7","8","9","10","Mixed"]);
const CONTENT_ADMIN="https://gxwfsqxyuufqtitspfqg.supabase.co/functions/v1/source_content_admin";

function cors(req:Request){
  const origin=req.headers.get("origin")||"";
  const ok=ALLOWED_ORIGINS.includes(origin)||origin.startsWith("http://localhost:")||origin.startsWith("http://127.0.0.1:");
  return {
    "Access-Control-Allow-Origin":ok?origin:ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers":"content-type,x-user-id",
    "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
    "Access-Control-Allow-Credentials":"true",
    "Vary":"Origin",
    "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store"
  };
}
function reply(req:Request,status:number,body:unknown){return new Response(JSON.stringify(body),{status,headers:cors(req)})}

async function approvedAdmin(req:Request){
  const userId=(req.headers.get("x-user-id")||"").trim();
  if(!userId)return false;
  const r=await fetch(`https://api.willenaenglish.com/.netlify/functions/supabase_auth?action=get_profile&user_id=${encodeURIComponent(userId)}`,{headers:{Accept:"application/json"}});
  if(!r.ok)return false;
  const p=await r.json().catch(()=>({}));
  return p?.success===true&&p?.approved===true&&String(p?.role||"").toLowerCase()==="admin";
}

function cleanLevel(raw:unknown,hasBooks:boolean){
  if(hasBooks)return null;
  const value=String(raw||"").trim();
  if(!value)return null;
  if(!LEVELS.has(value))throw new Error("Invalid level");
  return value;
}

async function validateBooks(req:Request,rawBooks:unknown){
  const books=(Array.isArray(rawBooks)?rawBooks:[]).slice(0,3).map((raw:any)=>{
    const title=String(raw?.title||raw?.book_title||"").trim().replace(/\s+/g," ");
    if(!title)return null;
    const catalog=raw?.source_type==="catalog"&&raw?.book_id;
    return {book_id:catalog?String(raw.book_id):null,book_title:title,source_type:catalog?"catalog":"manual",series:String(raw?.series||raw?.catalog_series||"").trim()||null,level:String(raw?.level||raw?.catalog_level||"").trim()||null};
  }).filter(Boolean) as any[];
  const catalog=books.filter(b=>b.book_id);
  if(catalog.length){
    const userId=(req.headers.get("x-user-id")||"").trim();
    const r=await fetch(CONTENT_ADMIN,{method:"POST",headers:{"content-type":"application/json","x-user-id":userId},body:JSON.stringify({action:"validate_books",book_ids:catalog.map(b=>b.book_id)})});
    const payload=await r.json().catch(()=>({}));
    if(!r.ok||payload?.error)throw new Error(payload?.error||"Could not validate curriculum books");
    const map=new Map((payload.data||[]).map((b:any)=>[String(b.id),b]));
    if(map.size!==new Set(catalog.map(b=>b.book_id)).size)throw new Error("One or more curriculum books no longer exist");
    for(const b of catalog){const row:any=map.get(b.book_id);b.book_title=row.title;b.series=row.series||null;b.level=row.level||null;}
  }
  return books.map(b=>({book_id:b.book_id,book_title:b.book_title,source_type:b.source_type,catalog_series:b.source_type==="catalog"?b.series:null,catalog_level:b.source_type==="catalog"?b.level:null,resolved_at:b.source_type==="catalog"?new Date().toISOString():null}));
}

async function listClasses(db:any){
  const {data:classes,error}=await db.from("classes").select("id,name,display_name,status,level,room,capacity,notes,created_at,updated_at").eq("status","active").order("name");
  if(error)throw error;
  const ids=(classes||[]).map((c:any)=>c.id);
  let assignments:any[]=[];
  if(ids.length){const result=await db.from("class_book_assignments").select("id,class_id,book_id,book_title,source_type,catalog_series,catalog_level,resolved_at,status,created_at").in("class_id",ids).eq("status","active").order("created_at");if(result.error)throw result.error;assignments=result.data||[];}
  const byClass=new Map<string,any[]>();
  for(const item of assignments){if(!byClass.has(item.class_id))byClass.set(item.class_id,[]);byClass.get(item.class_id)!.push(item);}
  return (classes||[]).map((c:any)=>({...c,books:(byClass.get(c.id)||[]).slice(0,3)}));
}


async function listLevelTests(db:any){
  const internalResult=await db.from("student_assessment_attempts").select("id,student_id,assessment_key,status,test_version,setup,total_questions,answered_count,correct_count,recommended_level,duration_seconds,started_at,completed_at,updated_at,metadata").order("started_at",{ascending:false}).limit(250);
  if(internalResult.error)throw internalResult.error;
  const publicResult=await db.from("prospective_level_test_attempts").select("id,candidate_id,status,test_version,setup,recommended_level,display_level,total_questions,correct_count,duration_seconds,started_at,completed_at,updated_at,metadata").order("started_at",{ascending:false}).limit(250);
  if(publicResult.error)throw publicResult.error;
  const internalRows=internalResult.data||[],publicRows=publicResult.data||[];
  const studentIds=[...new Set(internalRows.map((row:any)=>row.student_id).filter(Boolean))],candidateIds=[...new Set(publicRows.map((row:any)=>row.candidate_id).filter(Boolean))],internalIds=internalRows.map((row:any)=>row.id),publicIds=publicRows.map((row:any)=>row.id);
  const profiles=studentIds.length?await db.from("profiles").select("id,name,korean_name,username,grade,school,class").in("id",studentIds):{data:[],error:null};if(profiles.error)throw profiles.error;
  const candidates=candidateIds.length?await db.from("prospective_level_test_candidates").select("id,student_name,school_name,school_grade").in("id",candidateIds):{data:[],error:null};if(candidates.error)throw candidates.error;
  const internalSkills=internalIds.length?await db.from("student_assessment_skill_results").select("attempt_id,skill_key,questions_seen,questions_correct,score_percent").in("attempt_id",internalIds):{data:[],error:null};if(internalSkills.error)throw internalSkills.error;
  const publicSkills=publicIds.length?await db.from("prospective_level_test_skill_results").select("attempt_id,skill_key,questions_seen,questions_correct,score_percent").in("attempt_id",publicIds):{data:[],error:null};if(publicSkills.error)throw publicSkills.error;
  const publicResponses=publicIds.length?await db.from("prospective_level_test_responses").select("attempt_id,answer_index").in("attempt_id",publicIds):{data:[],error:null};if(publicResponses.error)throw publicResponses.error;
  const profileById=new Map((profiles.data||[]).map((row:any)=>[String(row.id),row])),candidateById=new Map((candidates.data||[]).map((row:any)=>[String(row.id),row])),skillsByAttempt=new Map<string,any[]>(),publicAnswerCounts=new Map<string,number>();
  for(const row of [...(internalSkills.data||[]),...(publicSkills.data||[])]){const key=String(row.attempt_id);if(!skillsByAttempt.has(key))skillsByAttempt.set(key,[]);skillsByAttempt.get(key)!.push({skill:row.skill_key,questions_seen:Number(row.questions_seen)||0,questions_correct:Number(row.questions_correct)||0,score_percent:Number(row.score_percent)||0});}
  for(const row of publicResponses.data||[]){const key=String(row.attempt_id);publicAnswerCounts.set(key,(publicAnswerCounts.get(key)||0)+1);}
  const internal=internalRows.map((row:any)=>{const profile:any=profileById.get(String(row.student_id))||{},metadata=row.metadata&&typeof row.metadata==="object"?row.metadata:{};return{id:row.id,source:"internal",assessment_key:row.assessment_key,student_id:row.student_id,student_name:profile.name||profile.korean_name||profile.username||"Student",korean_name:profile.korean_name||null,username:profile.username||null,grade:profile.grade||null,school:profile.school||null,class_name:metadata.class_at_test||profile.class||null,status:row.status,test_version:row.test_version,total_questions:Number(row.total_questions)||0,answered_count:Number(row.answered_count)||0,correct_count:Number(row.correct_count)||0,recommended_level:Number(row.recommended_level)||null,duration_seconds:Number(row.duration_seconds)||0,started_at:row.started_at,completed_at:row.completed_at,updated_at:row.updated_at,setup:row.setup||{},skills:skillsByAttempt.get(String(row.id))||[]};});
  const prospective=publicRows.map((row:any)=>{const candidate:any=candidateById.get(String(row.candidate_id))||{};return{id:row.id,source:"prospective",candidate_id:row.candidate_id,student_name:candidate.student_name||"Prospective student",grade:candidate.school_grade||null,school:candidate.school_name||null,class_name:null,status:row.status,test_version:row.test_version,total_questions:Number(row.total_questions)||0,answered_count:publicAnswerCounts.get(String(row.id))||0,correct_count:Number(row.correct_count)||0,recommended_level:Number(row.recommended_level||row.display_level)||null,duration_seconds:Number(row.duration_seconds)||0,started_at:row.started_at,completed_at:row.completed_at,updated_at:row.updated_at,setup:row.setup||{},skills:skillsByAttempt.get(String(row.id))||[]};});
  return [...internal,...prospective].sort((a:any,b:any)=>new Date(b.started_at||b.updated_at||0).getTime()-new Date(a.started_at||a.updated_at||0).getTime()).slice(0,250);
}

async function createClass(req:Request,db:any,body:any){
  const name=String(body?.name||"").trim().replace(/\s+/g," ");
  if(name.length<2||name.length>80)throw new Error("Class name must be 2–80 characters");
  const books=await validateBooks(req,body?.books);
  const level=cleanLevel(body?.level,books.length>0);
  const exists=await db.from("classes").select("id").ilike("name",name).limit(1);if(exists.error)throw exists.error;if(exists.data?.length)throw new Error("Class name already exists");
  const created=await db.from("classes").insert({name,display_name:name,legacy_class_name:name,status:"active",level}).select().single();if(created.error)throw created.error;
  if(books.length){const result=await db.from("class_book_assignments").insert(books.map((book:any)=>({class_id:created.data.id,...book,started_at:new Date().toISOString().slice(0,10),status:"active",notes:book.source_type==="manual"?"Unresolved manual book; link to curriculum catalog when available.":null})));if(result.error)throw result.error;}
  return (await listClasses(db)).find((c:any)=>c.id===created.data.id);
}

async function updateClass(req:Request,db:any,body:any){
  const classId=String(body?.class_id||"").trim();if(!classId)throw new Error("Missing class ID");
  const books=await validateBooks(req,body?.books);const level=cleanLevel(body?.level,books.length>0);
  const update=await db.from("classes").update({level,updated_at:new Date().toISOString()}).eq("id",classId);if(update.error)throw update.error;
  const archive=await db.from("class_book_assignments").update({status:"archived",finished_at:new Date().toISOString().slice(0,10)}).eq("class_id",classId).eq("status","active");if(archive.error)throw archive.error;
  if(books.length){const result=await db.from("class_book_assignments").insert(books.map((book:any)=>({class_id:classId,...book,started_at:new Date().toISOString().slice(0,10),status:"active",notes:book.source_type==="manual"?"Unresolved manual book; link to curriculum catalog when available.":null})));if(result.error)throw result.error;}
  const found=(await listClasses(db)).find((c:any)=>c.id===classId);if(!found)throw new Error("Class not found");return found;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
  try{
    if(!(await approvedAdmin(req)))return reply(req,401,{success:false,error:"Approved admin login required"});
    const db=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});
    const url=new URL(req.url);
    if(req.method==="GET"&&url.searchParams.get("action")==="list_level_tests")return reply(req,200,{success:true,tests:await listLevelTests(db)});
    if(req.method==="GET")return reply(req,200,{success:true,classes:await listClasses(db)});
    if(req.method!=="POST")return reply(req,405,{success:false,error:"Method not allowed"});
    const body=await req.json().catch(()=>null);if(!body)return reply(req,400,{success:false,error:"Invalid JSON"});
    const action=String(body.action||"");
    if(action==="update_class")return reply(req,200,{success:true,class:await updateClass(req,db,body)});
    if(action==="create_class"||!action)return reply(req,201,{success:true,class:await createClass(req,db,body)});
    return reply(req,400,{success:false,error:"Unknown action"});
  }catch(error){return reply(req,400,{success:false,error:error instanceof Error?error.message:String(error)})}
});
