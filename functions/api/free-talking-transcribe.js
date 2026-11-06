// Free Talking alpha: authenticated, bounded 60-second audio transcription.
// Student JWT + active session and question ownership are checked before any paid AI call.
const BASE='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function db(path,token){
 const r=await fetch(BASE+'/rest/v1/'+path,{headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(11000)});
 return {ok:r.ok,value:await r.json().catch(()=>null)};
}
async function student(request){
 const token=String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return null;
 const r=await fetch(BASE+'/auth/v1/user',{headers:{apikey:KEY,Authorization:'Bearer '+token},cache:'no-store',signal:AbortSignal.timeout(9000)});
 const user=r.ok?await r.json().catch(()=>null):null;
 if(!UUID.test(String(user?.id||'')))return null;
 const p=await db('profiles?select=role,approved&id=eq.'+user.id+'&limit=1',token);
 return p.ok&&p.value?.[0]?.role==='student'&&p.value[0].approved===true?{id:user.id,token}:null;
}
export async function onRequestPost({request,env}){
 try{
  const auth=await student(request);
  if(!auth)return reply(401,{success:false,error:'학생 로그인을 확인해 주세요.'});
  const type=String(request.headers.get('Content-Type')||'');
  if(!type.startsWith('multipart/form-data'))return reply(415,{success:false,error:'Audio upload required'});
  // The form has exactly one audio Blob plus the session and question IDs.
  const data=await request.formData();
  const sessionId=String(data.get('session_id')||'');
  const questionId=String(data.get('question_id')||'');
  const file=data.get('audio');
  if(!UUID.test(sessionId)||!UUID.test(questionId)||!file||typeof file.arrayBuffer!=='function')
   return reply(400,{success:false,error:'Missing recording information'});
  if(file.size<600||file.size>5_000_000)return reply(413,{success:false,error:'녹음 파일 크기가 올바르지 않아요.'});
  const mime=String(file.type||'').toLowerCase().split(';')[0];
  const extensions={'audio/webm':'webm','audio/mp4':'mp4','audio/ogg':'ogg','audio/mpeg':'mp3','audio/wav':'wav'};
  const extension=extensions[mime];
  if(!extension)return reply(415,{success:false,error:'지원하지 않는 녹음 형식이에요.'});
  const session=await db('free_talking_sessions?select=id,student_id,mode,status&student_id=eq.'+auth.id+'&id=eq.'+sessionId+'&limit=1',auth.token);
  if(!session.ok)return reply(503,{success:false,error:'Could not verify recording session'});
  if(session.value?.[0]?.status!=='in_progress'||session.value[0].mode!=='speaking')
   return reply(409,{success:false,error:'Start a speaking round first'});
  // Questions reside in Content DB, not score DB. Verify this question against
  // the session's assignment by using its actual Content DB record below.
  const active=await db('free_talking_sessions?select=book_id,unit_id,unit_number&student_id=eq.'+auth.id+'&id=eq.'+sessionId+'&limit=1',auth.token);
  if(!active.ok||!active.value?.[0])return reply(409,{success:false,error:'Unknown speaking unit'});
  const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
  const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
  const qr=await fetch(CONTENT+'/rest/v1/free_talking_questions?select=id,book_id,unit_id&is_published=eq.true&id=eq.'+questionId+'&limit=1',{
   headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store',signal:AbortSignal.timeout(9000)});
  const q=qr.ok?(await qr.json())?.[0]:null;
  if(!q||q.book_id!==active.value[0].book_id||q.unit_id!==active.value[0].unit_id)
   return reply(400,{success:false,error:'Question does not belong to this round'});
  const key=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!key)return reply(503,{success:false,error:'AI transcription unavailable'});
  const upstream=new FormData();
  upstream.append('file',file,'answer.'+extension);
  upstream.append('model','gpt-4o-mini-transcribe');
  upstream.append('language','en');
  // Only language=en: long context prompts can be echoed as transcripts
  // for quiet audio, exposing instructions to a student's answer UI.
  upstream.append('response_format','json');
  const result=await fetch('https://api.openai.com/v1/audio/transcriptions',{
   method:'POST',headers:{Authorization:'Bearer '+key},body:upstream,signal:AbortSignal.timeout(55000)});
  if(!result.ok){
   console.error('[Free Talking transcribe] OpenAI HTTP',result.status);
   return reply(502,{success:false,error:'음성 인식에 실패했어요. 녹음을 다시 해 주세요.'});
  }
  const payload=await result.json().catch(()=>null);
  const transcript=String(payload?.text||'').trim().slice(0,800);
  if(!transcript)return reply(422,{success:false,error:'음성이 잘 들리지 않았어요. 다시 녹음해 주세요.'});
  // Reject known prompt echoes and model instructions (do not display or grade).
  // Even if a transcription provider accidentally emits its own context,
  // a child's response must not be replaced with instructional prose.
  const leakedContext=/english\s+language\s+speaking\s+practice\s+by\s+korean\s+children|transcribe\s+the\s+english\s+actually\s+spoken|preserve\s+incomplete\s+sentences|do\s+not\s+translate\s+korean\s+speech|do\s+not\s+invent\s+an\s+answer/i;
  if(leakedContext.test(transcript)){
   console.warn('[Free Talking transcribe] rejected model prompt echo');
   return reply(422,{success:false,error:'음성을 제대로 듣지 못했어요. 다시 녹음해 주세요.'});
  }

  // Guard against mistaken language detection: don't silently translate Korean
  // or grade an unintended Korean-script transcript as an English answer.
  const hangul=(transcript.match(/[\uAC00-\uD7A3]/g)||[]).length;
  const letters=(transcript.match(/[a-z]/gi)||[]).length;
  if(hangul>0&&hangul>=letters/3){
   return reply(422,{success:false,error:'영어 답변으로 인식되지 않았어요. 영어로 다시 녹음해 주세요.'});
  }
  return reply(200,{success:true,transcript});
 }catch(e){
  console.error('[Free Talking transcribe]',String(e));
  return reply(503,{success:false,error:'음성을 확인하지 못했어요. 다시 시도해 주세요.'});
 }
}
