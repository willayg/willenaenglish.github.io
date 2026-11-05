import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.10";
const SCORE_URL=Deno.env.get("SUPABASE_URL")!;
const SCORE_KEY=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CONTENT_URL="https://gxwfsqxyuufqtitspfqg.supabase.co";
const CONTENT_KEY="sb_publishable_G-FYhHfDL4OGdL892gY1Zg_epdbEeqO";
const sb=createClient(SCORE_URL,SCORE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
const headers={"Content-Type":"application/json","Cache-Control":"no-store","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type,authorization,apikey,x-client-info","Access-Control-Allow-Methods":"GET,POST,OPTIONS"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(message:string,status=400)=>response({ok:false,error:message},status);
const clean=(v:unknown)=>String(v??"").trim();
const pick=(arr:any[])=>arr[Math.floor(Math.random()*arr.length)];
const shuffle=<T,>(items:T[])=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
function cookie(req:Request,name:string){const raw=req.headers.get("Cookie")||"";const part=raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="));if(!part)return "";try{return decodeURIComponent(part.slice(name.length+1))}catch{return ""}}
async function user(req:Request){
 const bearer=req.headers.get("Authorization")?.replace(/^Bearer\s+/i,"")||"";
 const token=cookie(req,"sb_access")||bearer;
 if(!token)throw new Error("AUTH:Please sign in first.");
 const {data,error}=await sb.auth.getUser(token);
 if(error||!data.user?.id)throw new Error("AUTH:Your session expired. Please sign in again.");
 const {data:profile,error:pe}=await sb.from("profiles").select("id,role,approved,name,username,class").eq("id",data.user.id).maybeSingle();
 if(pe||!profile||profile.approved===false)throw new Error("AUTH:An approved Willena account is required.");
 return {id:data.user.id,role:clean(profile.role).toLowerCase(),name:clean(profile.name||profile.username||"Player"),class:clean(profile.class)};
}
async function content(path:string){
 const res=await fetch(CONTENT_URL+"/rest/v1/"+path,{headers:{"apikey":CONTENT_KEY,"Accept":"application/json"}});
 const body=await res.json().catch(()=>[]);
 if(!res.ok)throw new Error("Content database: "+(body?.message||res.status));
 return body;
}
async function room(pin:string){
 if(!/^\d{6}$/.test(pin))throw new Error("Invalid game PIN.");
 const {data,error}=await sb.from("genius_live_rooms_v1").select("*").eq("pin",pin).maybeSingle();
 if(error)throw error;
 if(!data||Date.parse(data.expires_at)<Date.now())throw new Error("Game not found or expired.");
 return data;
}
function publicQ(q:any,revealed:boolean){return {book:q.book,unit:q.unit,skill:"Word Genius · Quiz",prompt:q.prompt,options:q.options,...(revealed?{correct:q.correct,explanation:q.explanation}:{} )}}
async function snapshot(r:any,who:any){
 const teacher=who.id===r.teacher_id&&["teacher","admin"].includes(who.role);
 const {data:players,error:pe}=await sb.from("genius_live_players_v1").select("id,user_id,display_name,team,score").eq("room_id",r.id).order("joined_at",{ascending:true});
 if(pe)throw pe;
 const me=players?.find((p:any)=>p.user_id===who.id);
 if(!teacher&&!me)throw new Error("You have not joined this game.");
 let answers:any[]=[];
 if(r.question_index>=0&&["question","reveal"].includes(r.status)){
  const {data,error}=await sb.from("genius_live_answers_v1").select("player_id,choice,points").eq("room_id",r.id).eq("question_index",r.question_index);
  if(error)throw error;answers=data||[];
 }
 const mine=me?answers.find(x=>x.player_id===me.id):null;
 const q=r.question_index>=0?r.questions[r.question_index]:null;
 return {ok:true,pin:r.pin,teacher,status:r.status,classId:r.settings.classId||null,className:r.settings.className||"",mode:r.settings.mode,teamCount:r.settings.teamCount,seconds:r.settings.seconds,
 questionNumber:r.question_index+1,total:r.questions.length,deadline:r.deadline,players:(players||[]).map((p:any)=>({name:p.display_name,team:p.team,score:p.score,id:teacher?p.id:undefined})),
 answeredCount:answers.length,answeredPlayerIds:teacher?answers.map(x=>x.player_id):undefined,
 question:q?publicQ(q,r.status==="reveal"||r.status==="finished"):null,
 myPlayerId:me?.id||null,myAnswer:mine?.choice??null,myPoints:mine?.points??0};
}
async function buildQuestions(selections:any,count:number){
 if(!Array.isArray(selections)||!selections.length||selections.length>12)throw new Error("Select 1–12 books.");
 const unitIds=[...new Set(selections.flatMap((s:any)=>Array.isArray(s.units)?s.units:[]))].filter(x=>/^[a-f0-9-]{36}$/.test(x));
 if(!unitIds.length||unitIds.length>80)throw new Error("Select between 1 and 80 units.");
 const confirmed=await content("content_units?select=id,book_id,unit_number,content_books!inner(id,title,status)&id=in.("+unitIds.join(",")+")&status=in.(review,published)&limit=100");
 const allowed=new Set(selections.map((s:any)=>clean(s.bookId)));
 const units=(confirmed as any[]).filter(u=>allowed.has(u.book_id)&&["review","published"].includes(u.content_books?.status));
 if(!units.length)throw new Error("No published units found in those books.");
 const ids=units.map(u=>u.id),valid=new Map(units.map(u=>[u.id,u]));
 const all:any[]=[];
 for(let k=0;k<ids.length;k+=15){
  const items=await content("unit_vocab_targets?select=unit_id,lexical_entry_id,lexical_entries!inner(canonical_text,translation_ko,status)&active=eq.true&unit_id=in.("+ids.slice(k,k+15).join(",")+")&lexical_entries.status=eq.published&limit=2000");
  all.push(...items);
 }
 const unique=new Map<string,any>();
 for(const t of all){
  const e=t.lexical_entries,u=valid.get(t.unit_id),word=clean(e?.canonical_text),kr=clean(e?.translation_ko);
  if(!u||!word||!kr||word.length>70||kr.length>130)continue;
  const key=word.toLowerCase();
  if(!unique.has(key))unique.set(key,{word,kr,book:u.content_books.title,unit:u.unit_number});
 }
 const pool=[...unique.values()];
 if(pool.length<4)throw new Error("At least four translated vocabulary words are needed. Choose more units.");
 const viable=pool.filter(e=>pool.filter(w=>w.word!==e.word&&w.kr!==e.kr).length>=3);
 if(!viable.length)throw new Error("Not enough distinct vocabulary choices in these units.");
 const qs:any[]=[];
 for(const target of shuffle(viable).slice(0,Math.min(count,viable.length))){
  const usedKr=new Set([target.kr]);
  const falseWords:any[]=[];
  for(const w of shuffle(pool)){
   if(w.word===target.word||usedKr.has(w.kr))continue;
   usedKr.add(w.kr);falseWords.push(w);if(falseWords.length===3)break;
  }
  if(falseWords.length<3)continue;
  const options=shuffle([target,...falseWords]).map(x=>x.word);
  qs.push({book:target.book,unit:target.unit,prompt:"‘"+target.kr+"’의 영어 표현은?",options,correct:options.indexOf(target.word),explanation:target.word+" = "+target.kr});
 }
 if(!qs.length)throw new Error("Could not generate unambiguous quiz questions.");
 return qs;
}
async function action(req:Request){
 if(req.method==="OPTIONS")return new Response(null,{headers});
 if(req.method!=="POST")return fail("POST required",405);
 const p=await req.json().catch(()=>({}));
 const mode=clean(p.action);
 const who=await user(req);
 if(mode==="catalog"){
  if(!["teacher","admin"].includes(who.role))return fail("Teacher access required",403);
  const {data:classes,error:classError}=await sb.from("classes").select("id,name").order("name",{ascending:true});
  if(classError)throw classError;
  const {data:assigned,error:assignmentError}=await sb.from("class_book_assignments").select("class_id,book_id").eq("status","active").not("book_id","is",null);
  if(assignmentError)throw assignmentError;
  const assignments:Record<string,string[]>={};
  for(const row of assigned||[]){const id=clean(row.class_id),book=clean(row.book_id);if(!id||!book)continue;(assignments[id]??=[]).push(book)}
  for(const id of Object.keys(assignments))assignments[id]=[...new Set(assignments[id])];
  const data=await content("content_books?select=id,title,content_units(id,unit_number,title,status)&status=in.(review,published)&order=title.asc&limit=1000");
  return response({ok:true,classes:(classes||[]).filter((c:any)=>clean(c.name)),classBookIds:assignments,books:(data as any[]).map(b=>({id:b.id,title:b.title,units:(b.content_units||[]).filter((u:any)=>["review","published"].includes(u.status)).sort((a:any,b:any)=>a.unit_number-b.unit_number)})).filter(b=>b.units.length)});
 }
 if(mode==="create"){
  if(!["teacher","admin"].includes(who.role))return fail("Teacher access required",403);
  const count=Math.max(1,Math.min(40,Number(p.count)||10)),seconds=Math.max(8,Math.min(60,Number(p.seconds)||20));
  const gameMode=p.mode==="individual"?"individual":"team",teamCount=Math.max(2,Math.min(8,Number(p.teamCount)||2));
  const classId=clean(p.classId);
  if(!/^[0-9a-f-]{36}$/i.test(classId))return fail("Choose a class first.");
  const {data:selectedClass,error:classError}=await sb.from("classes").select("id,name").eq("id",classId).maybeSingle();
  if(classError)throw classError;
  if(!selectedClass)return fail("Selected class was not found.");
  const {data:assigned,error:assignmentError}=await sb.from("class_book_assignments").select("book_id").eq("class_id",selectedClass.id).eq("status","active").not("book_id","is",null);
  if(assignmentError)throw assignmentError;
  const allowedBooks=new Set((assigned||[]).map((row:any)=>clean(row.book_id)));
  if(!allowedBooks.size)return fail("This class has no active assigned books.");
  if(!Array.isArray(p.selections)||!p.selections.length||p.selections.some((item:any)=>!allowedBooks.has(clean(item.bookId))))return fail("Only books actively assigned to this class can be selected.");
  const qs=await buildQuestions(p.selections,count);
  let saved:any=null,error:any=null;
  for(let attempt=0;attempt<4;attempt++){
   const pin=String(100000+Math.floor(Math.random()*900000));
   const result=await sb.from("genius_live_rooms_v1").insert({pin,teacher_id:who.id,settings:{seconds,mode:gameMode,teamCount,classId:selectedClass.id,className:selectedClass.name},questions:qs}).select("pin").single();
   if(!result.error){saved=result.data;break}error=result.error;
   if(result.error.code!=="23505")break;
  }
  if(!saved)throw error||new Error("Room could not be created");
  return response({ok:true,pin:saved.pin,total:qs.length});
 }
 if(mode==="preview"){
  if(!["teacher","admin"].includes(who.role))return fail("Teacher access required.",403);
  const r=await room(clean(p.pin));
  if(r.teacher_id!==who.id)return fail("Only the hosting teacher can preview this game.",403);
  if(r.status!=="lobby")return fail("Word preview is available before the game starts.",409);
  return response({ok:true,pin:r.pin,words:r.questions.map((q:any,i:number)=>({
    number:i+1,word:clean(q.options?.[q.correct]),meaning:clean(q.explanation).split(" = ").slice(1).join(" = "),
    book:clean(q.book),unit:q.unit
  }))});
 }
 if(mode==="join"){
  const r=await room(clean(p.pin));
  if(r.status!=="lobby")return fail("This game has already started.");
  const {data:existing}=await sb.from("genius_live_players_v1").select("id").eq("room_id",r.id).eq("user_id",who.id).maybeSingle();
  if(!existing){
   const {count}=await sb.from("genius_live_players_v1").select("id",{count:"exact",head:true}).eq("room_id",r.id);
   if((count||0)>=80)return fail("Room is full.");
   const team=r.settings.mode==="team"?(count||0)%r.settings.teamCount:0;
   const {error}=await sb.from("genius_live_players_v1").insert({room_id:r.id,user_id:who.id,display_name:who.name,team});
   if(error&&error.code!=="23505")throw error;
  }
  return response(await snapshot(r,who));
 }
 if(mode==="state"){
  const r=await room(clean(p.pin));
  return response(await snapshot(r,who));
 }
 if(mode==="answer"){
  const r=await room(clean(p.pin));
  const {data:player}=await sb.from("genius_live_players_v1").select("id").eq("room_id",r.id).eq("user_id",who.id).maybeSingle();
  if(!player)return fail("Join the game first.",403);
  const choice=Number(p.choice),index=Number(p.questionIndex);
  if(!Number.isInteger(choice)||choice<0||choice>3)return fail("Invalid answer.");
  const {data,error}=await sb.rpc("genius_live_submit_v1",{p_room:r.id,p_player:player.id,p_question:index,p_choice:choice});
  if(error)throw error;
  if(!data)return fail("Answer closed or already submitted.",409);
  return response({ok:true,accepted:true});
 }
 const r=await room(clean(p.pin));
 if(r.teacher_id!==who.id||!["teacher","admin"].includes(who.role))return fail("Only the hosting teacher can control this room.",403);
 if(["set_team","balance_teams","randomize_teams"].includes(mode)){
  if(r.status!=="lobby")return fail("Teams can only be changed before the game starts.",409);
  if(r.settings.mode!=="team")return fail("This game uses individual scoring.");
  const teamCount=Number(r.settings.teamCount);
  if(!Number.isInteger(teamCount)||teamCount<2||teamCount>8)return fail("Invalid team setup.");
  const {data:players,error:pe}=await sb.from("genius_live_players_v1").select("id,team,joined_at").eq("room_id",r.id).order("joined_at",{ascending:true});
  if(pe)throw pe;
  if(mode==="set_team"){
   const playerId=clean(p.playerId),target=Number(p.team);
   if(!/^[0-9a-f-]{36}$/i.test(playerId)||!Number.isInteger(target)||target<0||target>=teamCount)return fail("Invalid player or team.");
   if(!(players||[]).some((x:any)=>x.id===playerId))return fail("Player is not in this game.",404);
   const {data:changed,error}=await sb.from("genius_live_players_v1").update({team:target}).eq("room_id",r.id).eq("id",playerId).select("id");
   if(error)throw error;if(!changed?.length)return fail("Team update did not save.",409);
  }else{
   const rows=[...(players||[])];
   if(mode==="randomize_teams"){
    // Fisher-Yates, using crypto instead of Math.random for unbiased independent shuffles.
    const numbers=new Uint32Array(1);
    for(let i=rows.length-1;i>0;i--){crypto.getRandomValues(numbers);const j=numbers[0]%(i+1);[rows[i],rows[j]]=[rows[j],rows[i]]}
   }
   // Round-robin always keeps team sizes within one student.
   const updates=rows.filter((x:any,i:number)=>x.team!==i%teamCount).map((x:any)=>({id:x.id,team:rows.indexOf(x)%teamCount}));
   const results=await Promise.all(updates.map((x:any)=>sb.from("genius_live_players_v1").update({team:x.team}).eq("room_id",r.id).eq("id",x.id).select("id")));
   for(const result of results){if(result.error)throw result.error;if(!result.data?.length)throw new Error("A team assignment could not be saved.");}
  }
 }
 else if(mode==="start"){
  if(r.status!=="lobby")return fail("Game has already started.");
  const {count}=await sb.from("genius_live_players_v1").select("id",{count:"exact",head:true}).eq("room_id",r.id);
  if(!count)return fail("At least one player must join.");
  const {error}=await sb.from("genius_live_rooms_v1").update({status:"question",question_index:0,deadline:new Date(Date.now()+r.settings.seconds*1000).toISOString()}).eq("id",r.id).eq("status","lobby");if(error)throw error;
 }
 else if(mode==="reveal"){
  const {data,error}=await sb.rpc("genius_live_reveal_v1",{p_room:r.id,p_teacher:who.id});
  if(error)throw error;if(!data&&r.status!=="reveal")return fail("Question not active.",409);
 }
 else if(mode==="next"){
  if(r.status!=="reveal")return fail("Reveal the current answer first.");
  const end=r.question_index+1>=r.questions.length;
  const {error}=await sb.from("genius_live_rooms_v1").update(end?{status:"finished",deadline:null}:{status:"question",question_index:r.question_index+1,deadline:new Date(Date.now()+r.settings.seconds*1000).toISOString()}).eq("id",r.id).eq("status","reveal");if(error)throw error;
 }
 else if(mode==="cancel"){
  const {error}=await sb.from("genius_live_rooms_v1").update({status:"cancelled",deadline:null}).eq("id",r.id);if(error)throw error;
 }
 else return fail("Unknown action.");
 const latest=await room(r.pin);
 return response(await snapshot(latest,who));
}
Deno.serve(async(req:Request)=>{try{return await action(req)}catch(e){const m=e instanceof Error?e.message:String(e);const auth=m.startsWith("AUTH:");console.error("[genius-live]",auth?"auth rejection":m);return fail(auth?m.slice(5):m,auth?401:500)}});
