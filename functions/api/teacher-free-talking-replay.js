// Staff-only read-only re-evaluation of stored Free Talking conversations.
// This endpoint NEVER writes to student scores, progress, assignments or transcripts.
const SCORE='https://fiieuiktlsivwfgyivai.supabase.co';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const PUBLISHABLE='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const send=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function get(url,headers){const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('Data request failed ('+r.status+')');return r.json()}
const fmt=(t,n=350)=>String(t??'').trim().slice(0,n);
export async function onRequestPost({request,env}){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return send(403,{error:'Origin rejected'});
 let input;try{input=await request.json()}catch{return send(400,{error:'Invalid JSON'})}
 if(!['list','replay'].includes(input?.action))return send(400,{error:'Unknown action'});
 try{
  // Trust the existing server-side teacher login check, not browser-supplied identity.
  const loginURL=new URL('/.netlify/functions/supabase_auth?action=whoami',request.url);
  const sessionResponse=await fetch(loginURL,{headers:{Cookie:request.headers.get('Cookie')||''},cache:'no-store',signal:AbortSignal.timeout(10000)});
  const session=await sessionResponse.json().catch(()=>({}));
  if(!sessionResponse.ok||!session.success||!UUID.test(session.user_id||''))return send(401,{error:'Please sign in to the Teachers Dashboard'});
  const key=env.SUPABASE_SERVICE_ROLE_KEY||env.SUPABASE_SERVICE_ROLE||env.SUPABASE_SECRET_KEY||env.SUPABASE_SERVICE_KEY;
  if(!key)return send(503,{error:'Replay database access is not configured for this deployment'});
  const headers={apikey:key,Authorization:'Bearer '+key};
  const profile=(await get(SCORE+'/rest/v1/profiles?select=id,name,role,approved&id=eq.'+encodeURIComponent(session.user_id)+'&limit=1',headers))[0];
  if(!profile||profile.approved!==true||!['teacher','admin','owner'].includes(profile.role))return send(403,{error:'Approved teaching staff only'});
  if(input.action==='list'){
   const days=Math.min(14,Math.max(1,Number(input.days)||1));
   const since=new Date(Date.now()-days*86400000).toISOString();
   const records=await get(SCORE+'/rest/v1/free_talking_hybrid_transcripts?select=session_id,student_id,book_id,unit_id,character,speaker,message_source,created_at,review_points&created_at=gte.'+encodeURIComponent(since)+'&order=created_at.desc&limit=3000',headers);
   const bySession=new Map();
   for(const row of records){
    let s=bySession.get(row.session_id);
    if(!s){s={session_id:row.session_id,student_id:row.student_id,book_id:row.book_id,unit_id:row.unit_id,character:row.character,last_at:row.created_at,first_at:row.created_at,turns:0,reviewed:0,original_points:0};bySession.set(row.session_id,s)}
    if(row.created_at<s.first_at)s.first_at=row.created_at;
    if(row.speaker==='student'&&row.message_source!=='review_credit')s.turns++;
    if(row.message_source==='review_credit'){s.reviewed++;s.original_points+=Number(row.review_points)||0}
   }
   const sessions=[...bySession.values()].sort((a,b)=>b.last_at.localeCompare(a.last_at)).slice(0,80);
   const ids=[...new Set(sessions.map(s=>s.student_id))];
   let names=new Map();
   if(ids.length){const profiles=await get(SCORE+'/rest/v1/profiles?select=id,name,class&id=in.('+ids.filter(x=>UUID.test(x)).join(',')+')',headers);names=new Map(profiles.map(p=>[p.id,p]))}
   return send(200,{sessions:sessions.map(s=>({...s,name:names.get(s.student_id)?.name||'Student',class_name:names.get(s.student_id)?.class||''})),read_only:true});
  }
  const sessionId=String(input.session_id||'');
  if(!UUID.test(sessionId))return send(400,{error:'Select a recorded session'});
  const entries=await get(SCORE+'/rest/v1/free_talking_hybrid_transcripts?select=turn_number,speaker,transcript_text,message_source,review_points,review_reason,book_id,unit_id,student_id,character,created_at&session_id=eq.'+sessionId+'&order=turn_number.asc&limit=150',headers);
  if(!entries.length)return send(404,{error:'Transcript unavailable or expired'});
  const first=entries[0],original=entries.filter(e=>e.message_source!=='review_credit'&&e.message_source!=='evaluation_feedback');
  const students=original.filter(x=>x.speaker==='student'&&x.turn_number>0&&x.turn_number<75).slice(0,8);
  if(!students.length)return send(400,{error:'No student answers in this transcript'});
  const ordinal=new Map(students.map((t,i)=>[t.turn_number,i+1]));
  const transcript=original.map(t=>({n:t.speaker==='student'?ordinal.get(t.turn_number)||null:null,speaker:t.speaker,text:fmt(t.transcript_text)}));
  const bookRows=await get(CONTENT+'/rest/v1/content_books?select=public_level,title&id=eq.'+first.book_id+'&limit=1',{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY}).catch(()=>[]);
  const level=Number.isInteger(Number(bookRows[0]?.public_level))?Math.max(0,Math.min(10,Number(bookRows[0].public_level))):2;
  const beginner=level<=2;
  const prompt=[
   'Evaluate fairly for textbook level '+level+'. This is the single END-OF-SESSION review, never real-time assessment. Judge all student turns together in context.',
   'Return exactly one score for each numbered STUDENT turn. Character turns n=null are context only. Score 0-4 and separately decide qualifies true or false for homework.',
   'For Starter and levels 1-2, a relevant short answer, a single colour, a yes/no answer, a basic English phrase or understandable simple sentence can earn 4/4. Never demand extra detail or complex grammar.',
   '4 = a relevant, understandable genuine answer or question at the learner level; 3 = relevant but somewhat incomplete; 2 = partially relevant; 1 = weak or vague attempt; 0 = meaningless, unrelated filler or repeated empty answers.',
   'QUALIFICATION IS INDEPENDENT OF POINTS: qualifies=true only when the student genuinely attempts to communicate an answer, meaning, preference, question, joke, clarification or substantive new idea in English. Simple beginner answers, creative silliness, spontaneous curiosity, conversational questions and genuine attempts despite speech-recognition errors qualify.',
   'qualifies=false for repeated empty filler (Oh, Maybe, Hello, I do not know) without new meaning, repeated attempts to switch into Korean/Japanese or another chat language, deliberate evasion, meaningless words or greetings recycled to avoid the subject. Consider repetitions across the entire transcript.',
   'A request to repeat an unheard question or explain a word is legitimate communication: give fair consideration; it is not automatically evasion. A single Maybe can qualify if it truly answers a question; repeated Maybe that never answers anything cannot.',
   'Do not count an answer just because the AI character politely responds. Do not penalize a student because STT plausibly misheard them. Prefer qualifying an ambiguous good-faith attempt.',
   'Maintain the fun: do not penalize harmless jokes, slang, changing subject naturally, unusual but comprehensible ideas or playful responses.',
   'The character goodbye feedback must remain encouraging, specific and in ENGLISH, never promising a Korean/Japanese conversation. Never blame the child for speech recognition. No scores spoken in feedback.',
   'Return only the requested JSON. Include every student turn once.'
  ].join('\n');
  const schema={type:'object',additionalProperties:false,required:['scores','feedback'],properties:{scores:{type:'array',items:{type:'object',additionalProperties:false,required:['turn','points','qualifies','reason'],properties:{turn:{type:'integer'},points:{type:'integer',enum:[0,1,2,3,4]},qualifies:{type:'boolean'},reason:{type:'string'}}}},feedback:{type:'string'}}};
  const openai=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!openai)return send(503,{error:'Replay AI model key is not configured for this deployment'});
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:'Bearer '+openai,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-6-luna',reasoning:{effort:'none'},max_output_tokens:1800,store:false,text:{format:{type:'json_schema',name:'willena_eight_turn_review',strict:true,schema}},instructions:prompt,input:[{role:'user',content:JSON.stringify({level,transcript})}]}),signal:AbortSignal.timeout(26000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)return send(502,{error:'AI evaluation unavailable ('+response.status+')'});
  let parsed;try{parsed=JSON.parse(String(data.output_text||data.output?.flatMap(x=>x.content||[]).map(x=>x.text||'').join('')||''))}catch{return send(502,{error:'AI returned invalid review data'})}
  const valid=new Set(students.map((_,i)=>i+1));
  if(!Array.isArray(parsed.scores)||parsed.scores.length!==students.length||new Set(parsed.scores.map(s=>s.turn)).size!==students.length||parsed.scores.some(s=>!valid.has(s.turn)||typeof s.qualifies!=='boolean'||!Number.isInteger(s.points)||s.points<0||s.points>4))return send(502,{error:'AI did not review every turn correctly'});
  const old=entries.filter(e=>e.message_source==='review_credit');
  const scored=parsed.scores.sort((a,b)=>a.turn-b.turn).map(s=>({turn:s.turn,student_text:students[s.turn-1]?.transcript_text||'',points:s.points,qualifies:s.qualifies,reason:fmt(s.reason,240),old_points:old.find(x=>150-x.turn_number===students[s.turn-1]?.turn_number)?.review_points??null}));
  const total=scored.reduce((n,x)=>n+x.points,0),qualifying=scored.filter(s=>s.qualifies).length;
  return send(200,{read_only:true,session_id:sessionId,level,book_title:bookRows[0]?.title||'',student_id:first.student_id,character:first.character,transcript,original_points:old.reduce((n,x)=>n+(Number(x.review_points)||0),0),points:total,qualifying,reviewed:scored.length,scores:scored,feedback:fmt(parsed.feedback,380),model:'gpt-6-luna'});
 }catch(e){console.error('[teacher replay]',String(e));return send(502,{error:'Replay unavailable: '+fmt(e.message,150)})}
}
