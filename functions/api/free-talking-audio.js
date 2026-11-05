// Free Talking Genius: authenticated question audio, cached in Willena's existing R2 audio store.
// Question text comes from the published Content Database, never from browser-supplied text.
const SCORES='https://fiieuiktlsivwfgyivai.supabase.co';
const SCORES_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const BUZZ6='8e949813-fa91-4adc-a709-905efc980d8b';
const R2='https://api.willenaenglish.com/.netlify/functions/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const model=env=>env.FREE_TALKING_TTS_MODEL||'gpt-4o-mini-tts';
const voice=env=>env.FREE_TALKING_TTS_VOICE||'shimmer';
async function verifyStudent(request){
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();
 if(token.length<40)return null;
 const headers={apikey:SCORES_KEY,Authorization:'Bearer '+token};
 const userResponse=await fetch(SCORES+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!userResponse.ok)return null;
 const user=await userResponse.json().catch(()=>null);
 if(!UUID.test(user?.id||''))return null;
 const roleResponse=await fetch(SCORES+'/rest/v1/profiles?select=role,approved&id=eq.'+user.id+'&limit=1',{headers,cache:'no-store',signal:AbortSignal.timeout(9000)});
 if(!roleResponse.ok)return null;
 const rows=await roleResponse.json().catch(()=>[]);
 if(rows?.[0]?.role!=='student'||rows[0].approved!==true)return null;
 return user.id;
}
async function questionById(id){
 const res=await fetch(CONTENT+'/rest/v1/free_talking_questions?select=id,book_id,question_en,is_published&id=eq.'+encodeURIComponent(id)+'&is_published=eq.true&limit=1',{
  headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},cache:'no-store',signal:AbortSignal.timeout(9000)});
 if(!res.ok)throw Error('Content Database unavailable');
 const data=await res.json().catch(()=>[]);
 const row=data?.[0];
 return row?.book_id===BUZZ6&&row.is_published===true?row:null;
}
async function cacheKey(text,ttsModel,ttsVoice){
 const source=['free_talking_question_audio_v1',ttsModel,ttsVoice,'0.94',text.trim()].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
 const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 return 'ft_question_v1_'+hex.slice(0,32);
}
async function cachedAudio(key){
 try{
  const res=await fetch(R2+'get_audio_urls',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({words:[key]}),signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!res.ok)return null;
  const data=await res.json().catch(()=>null);
  const found=data?.results?.[key];
  return found?.exists&&String(found.url||'').startsWith('https://')?found.url:null;
 }catch(e){console.warn('[Free Talking audio] R2 lookup failed',e?.name||'error');return null}
}
function base64(bytes){
 const a=new Uint8Array(bytes);let s='';
 for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));
 return btoa(s);
}
async function saveR2(key,audio){
 try{
  const res=await fetch(R2+'upload_audio',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({word:key,fileDataBase64:audio}),signal:AbortSignal.timeout(15000),cache:'no-store'});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.success!==true||data?.path!==key+'.mp3')throw Error('R2 upload failed');
 }catch(e){console.warn('[Free Talking audio] cache write failed',e?.name||'error')}
}
export async function onRequestPost({request,env,context}){
 try{
  const userId=await verifyStudent(request);
  if(!userId)return json(401,{success:false,error:'학생 로그인을 확인해 주세요.'});
  const body=await request.json().catch(()=>null);
  const id=String(body?.question_id||'');
  if(!UUID.test(id))return json(400,{success:false,error:'Invalid question'});
  const q=await questionById(id);
  if(!q)return json(404,{success:false,error:'Question unavailable'});
  const t=String(q.question_en||'').trim();
  if(!t||t.length>600)return json(422,{success:false,error:'Question audio text unavailable'});
  const ttsModel=model(env),ttsVoice=voice(env),key=await cacheKey(t,ttsModel,ttsVoice);
  const url=await cachedAudio(key);
  if(url)return json(200,{success:true,audio_url:url,source:'r2',voice:ttsVoice,ai_generated:true});
  const apiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!apiKey)return json(503,{success:false,error:'AI voice is not configured'});
  const response=await fetch('https://api.openai.com/v1/audio/speech',{
   method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({model:ttsModel,voice:ttsVoice,input:t,speed:0.94,response_format:'mp3',
    instructions:'Read this question only. Friendly, clear American English for Korean children learning English. Natural conversational intonation, slightly slower than usual. Do not add an introduction or extra words.'}),
   signal:AbortSignal.timeout(28000)
  });
  if(!response.ok){console.warn('[Free Talking audio] TTS HTTP',response.status);return json(502,{success:false,error:'AI voice generation unavailable'})}
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength||bytes.byteLength>1200000)return json(502,{success:false,error:'Invalid question audio'});
  const audio=base64(bytes);
  // A cache miss plays immediately; the existing R2 endpoint persists the MP3 asynchronously.
  if(context?.waitUntil)context.waitUntil(saveR2(key,audio));
  else await saveR2(key,audio);
  return json(200,{success:true,audio,source:'openai',saving:true,voice:ttsVoice,ai_generated:true});
 }catch(e){console.warn('[Free Talking audio] failure',e?.message||'error');return json(503,{success:false,error:'Question audio unavailable'})}
}
export async function onRequestGet({env}){
 return json(200,{success:true,service:'free-talking-question-audio',configured:!!(env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY),r2:'shared-audio-endpoints',model:model(env),voice:voice(env)});
}
