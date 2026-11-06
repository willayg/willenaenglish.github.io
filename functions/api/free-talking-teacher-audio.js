// Teacher-only Free Talking audio preparation.
// Generates exactly the MP3 keys used by Free Talking Genius: ElevenLabs Bunny
// and OpenAI Marin fallback. Preferred Marin Realtime files remain WAV.
const SUPA='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY='sb_publishable_G-FYhHfDL4OGdL892gY1Zg_epdbEeqO';
const WORKER='https://get-audio-urls.willena.workers.dev/free-talking-store';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VOICES={
 lili:{model:'eleven_v3',voice:'M7zl2TS7ORAIGUejDfoy',variant:'elevenlabs',prefix:'ft_eleven_v1_',tag:'free_talking_elevenlabs_question_mp3_v1'},
 willi_mp3:{model:'gpt-4o-mini-tts',voice:'marin',variant:'fallback',prefix:'ft_fallback_v1_',tag:'free_talking_legacy_fallback_mp3_v1'}
};
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function teacher(request){
 const token=String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return null;
 const headers={apikey:KEY,Authorization:'Bearer '+token};
 const user=await fetch(SUPA+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!user.ok)return null;
 const info=await user.json().catch(()=>null);
 if(!UUID.test(info?.id||''))return null;
 const role=await fetch(SUPA+'/rest/v1/profiles?select=role&id=eq.'+info.id+'&limit=1',{
  headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!role.ok)return null;
 const profile=(await role.json().catch(()=>[]))?.[0];
 return ['teacher','admin'].includes(String(profile?.role||'').toLowerCase())?{id:info.id,token}:null;
}
async function contentRows(query){
 const res=await fetch(CONTENT+'/rest/v1/'+query,{
  headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},
  cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error('CONTENT_DATABASE_'+res.status);
 const rows=await res.json().catch(()=>null);
 if(!Array.isArray(rows))throw Error('CONTENT_DATABASE_INVALID');
 return rows;
}
async function hashKey(text,config){
 const raw=[config.tag,config.model,config.voice,'natural_voice_1',text.trim()].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
 const hex=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 return config.prefix+hex.slice(0,32);
}
async function store(token,body){
 const response=await fetch(WORKER,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(25000)});
 const data=await response.json().catch(()=>null);
 if(!response.ok||data?.success!==true)throw Error(String(data?.code||'R2_STORAGE_'+response.status));
 return data;
}
function base64(buffer){
 const bytes=new Uint8Array(buffer);let str='';
 for(let p=0;p<bytes.length;p+=8192)str+=String.fromCharCode(...bytes.subarray(p,p+8192));
 return btoa(str);
}
async function createMp3(env,text,voice){
 let response;
 if(voice==='lili'){
  const secret=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY;
  if(!secret)throw Error('ELEVEN_LABS_API_KEY_NOT_AVAILABLE_IN_TEACHERS_PREVIEW');
  response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+VOICES.lili.voice+'?output_format=mp3_44100_128',{
   method:'POST',headers:{'xi-api-key':secret,'Content-Type':'application/json','Accept':'audio/mpeg'},
   body:JSON.stringify({text,model_id:'eleven_v3',voice_settings:{stability:0.5}}),
   signal:AbortSignal.timeout(35000)});
 }else{
  const secret=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!secret)throw Error('OPENAI_KEY_NOT_AVAILABLE_IN_TEACHERS_PREVIEW');
  response=await fetch('https://api.openai.com/v1/audio/speech',{
   method:'POST',headers:{Authorization:'Bearer '+secret,'Content-Type':'application/json'},
   body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'marin',input:text,response_format:'mp3',
    instructions:'Ask this question naturally, with friendly American English intonation. Speak at a comfortable, unhurried pace without exaggerating syllables. Say only the question.'}),
   signal:AbortSignal.timeout(35000)});
 }
 if(!response.ok)throw Error((voice==='lili'?'ELEVENLABS':'OPENAI')+'_TTS_HTTP_'+response.status);
 const bytes=await response.arrayBuffer();
 if(bytes.byteLength<500||bytes.byteLength>1250000)throw Error('INVALID_TTS_MP3_SIZE');
 const data=new Uint8Array(bytes);
 const mp3=(data[0]===73&&data[1]===68&&data[2]===51)||(data[0]===255&&(data[1]&224)===224);
 if(!mp3)throw Error('INVALID_TTS_MP3_FORMAT');
 return bytes;
}
async function catalog(){
 const rows=await contentRows('free_talking_questions?select=id,book_id,unit_number,question_number,question_en&is_published=eq.true&order=book_id.asc,unit_number.asc,question_number.asc&limit=800');
 const ids=[...new Set(rows.map(q=>q.book_id).filter(id=>UUID.test(String(id))))];
 if(!ids.length)return {books:[],questions:[]};
 const books=await contentRows('content_books?select=id,title&id=in.('+ids.join(',')+')&limit=100');
 const titles=new Map(books.map(b=>[b.id,b.title]));
 return {books:ids.map(id=>({id,title:titles.get(id)||'Textbook',units:[...new Set(rows.filter(x=>x.book_id===id).map(x=>Number(x.unit_number)))].sort((a,b)=>a-b)})),
  questions:rows.filter(q=>UUID.test(String(q.id))&&UUID.test(String(q.book_id))&&String(q.question_en||'').trim()).map(q=>({id:q.id,book_id:q.book_id,unit_number:q.unit_number,question_number:q.question_number,text:q.question_en}))};
}
export async function onRequestPost({request,env}){
 try{
  const auth=await teacher(request);
  if(!auth)return json(403,{success:false,error:'Teacher or admin sign-in required'});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object')return json(400,{success:false,error:'Invalid request'});
  if(body.action==='catalog')return json(200,{success:true,...await catalog(),
   formats:{lili:'ElevenLabs Bunny v3 · MP3',willi_mp3:'OpenAI Marin fallback · MP3'}});
  const voice=String(body.voice||'');
  const config=VOICES[voice];
  if(!config)return json(400,{success:false,error:'Choose an available MP3 voice'});
  if(body.action==='inventory'){
   const ids=Array.isArray(body.question_ids)?body.question_ids:[];
   if(!ids.length||ids.length>150||ids.some(id=>!UUID.test(String(id))))return json(400,{success:false,error:'Invalid inventory selection'});
   const questionRows=await contentRows('free_talking_questions?select=id,question_en&is_published=eq.true&id=in.('+ids.join(',')+')&limit=150');
   if(questionRows.length!==new Set(ids).size)return json(409,{success:false,error:'Some questions are unpublished; refresh list'});
   const files=[];
   for(const q of questionRows)files.push((await hashKey(String(q.question_en),config))+'.mp3');
   const storage=await store(auth.token,{action:'inventory',files});
   return json(200,{success:true,files:questionRows.map((q,i)=>({id:q.id,file:files[i],exists:storage.exists?.[files[i]]===true}))});
  }
  if(body.action!=='generate')return json(400,{success:false,error:'Unknown action'});
  const questionId=String(body.question_id||'');
  if(!UUID.test(questionId))return json(400,{success:false,error:'Invalid question ID'});
  const question=(await contentRows('free_talking_questions?select=id,book_id,question_en&is_published=eq.true&id=eq.'+questionId+'&limit=1'))[0];
  if(!question||!UUID.test(String(question.book_id)))return json(404,{success:false,error:'Published question not found'});
  const text=String(question.question_en||'').trim();
  if(!text||text.length>600)return json(422,{success:false,error:'Unsupported question length'});
  const key=await hashKey(text,config),file=key+'.mp3';
  const before=await store(auth.token,{action:'inventory',files:[file]});
  if(before.exists?.[file])return json(200,{success:true,status:'already_cached',file});
  // Exactly one paid synthesis per request. UI uses a serialized queue.
  const audio=await createMp3(env,text,voice);
  const result=await store(auth.token,{action:'put',key,format:'mp3',question_id:questionId,
   model:config.model,voice:config.voice,variant:config.variant,audio:base64(audio)});
  if(result.stored!==true)throw Error('R2_WRITE_NOT_VERIFIED');
  const after=await store(auth.token,{action:'inventory',files:[file]});
  if(after.exists?.[file]!==true)throw Error('R2_WRITE_NOT_VISIBLE');
  return json(200,{success:true,status:'generated_saved',file,bytes:audio.byteLength,existing:result.existing===true});
 }catch(error){
  const reason=String(error?.message||error);
  console.error('[Free Talking teacher audio batch]',reason.slice(0,180));
  return json(/INVALID|UNKNOWN|CHOOSE/i.test(reason)?400:503,{success:false,error:reason.slice(0,140)});
 }
}
