// Free Talking Genius: authenticated question audio, cached in Willena's existing R2 audio store.
// Question text comes from the published Content Database, never from browser-supplied text.
import {generateQuestionWav} from '../_lib/free-talking-realtime-wav.js';
const SCORES='https://fiieuiktlsivwfgyivai.supabase.co';
const SCORES_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const BUZZ6='8e949813-fa91-4adc-a709-905efc980d8b';
const R2='https://api.willenaenglish.com/.netlify/functions/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const model=env=>env.FREE_TALKING_REALTIME_MODEL||'gpt-realtime-2.1-mini';
const voice=env=>env.FREE_TALKING_REALTIME_VOICE||'marin';
async function verifyStudent(request){
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
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
async function cacheKey(text,ttsModel,ttsVoice,variant='realtime'){
 const source=[variant==='realtime'?'free_talking_realtime_question_wav_v1':'free_talking_legacy_fallback_mp3_v1',ttsModel,ttsVoice,'natural_voice_1',text.trim()].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
 const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 return (variant==='realtime'?'ft_realtime_v1_':'ft_fallback_v1_')+hex.slice(0,32);
}
async function cachedAudio(key,format='wav',env={}){
 const bucket=env.FREE_TALKING_AUDIO_BUCKET||env.AUDIO_BUCKET;
 if(bucket){
  try{
   const object=await bucket.get(key+'.'+format);
   if(object)return {audio:base64(await object.arrayBuffer()),source:'r2_direct',stored:true};
  }catch(e){console.warn('[Free Talking audio] bound R2 read failed',e?.message||'error')}
 }
 try{
  const res=await fetch(R2+'get_audio_urls',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({words:[key],format}),signal:AbortSignal.timeout(5000),cache:'no-store'});
  if(!res.ok)return null;
  const data=await res.json().catch(()=>null);
  const found=data?.results?.[key];
  return found?.exists&&String(found.url||'').startsWith('https://')?{audio_url:found.url,source:'r2_shared',stored:true}:null;
 }catch(e){console.warn('[Free Talking audio] R2 lookup failed',e?.name||'error');return null}
}
function base64(bytes){
 const a=new Uint8Array(bytes);let s='';
 for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));
 return btoa(s);
}
async function saveR2(key,audio,format='wav',env={}){
 const filename=key+'.'+format;
 const bucket=env.FREE_TALKING_AUDIO_BUCKET||env.AUDIO_BUCKET;
 if(bucket){
  try{
   const binary=atob(audio),bytes=new Uint8Array(binary.length);
   for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
   await bucket.put(filename,bytes,{httpMetadata:{
    contentType:format==='wav'?'audio/wav':'audio/mpeg',
    cacheControl:'public, max-age=31536000, immutable'
   }});
   const saved=await bucket.head(filename);
   if(saved?.size===bytes.byteLength)return {stored:true,path:'r2_direct'};
   throw Error('R2 saved object did not verify');
  }catch(e){console.warn('[Free Talking audio] bound R2 write failed',String(e?.message||e).slice(0,130))}
 }
 // Compatibility with the same shared MP3 pipeline used by Word Genius.
 // WAV requires the shared endpoint to support format=wav; it must verify the suffix.
 try{
  const res=await fetch(R2+'upload_audio',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({word:key,fileDataBase64:audio,format}),signal:AbortSignal.timeout(15000),cache:'no-store'});
  const data=await res.json().catch(()=>null);
  if(!res.ok||data?.success!==true||data?.path!==filename)throw Error('R2 upload not confirmed ('+res.status+')');
  return {stored:true,path:'r2_shared'};
 }catch(e){
  console.warn('[Free Talking audio] cache write failed',String(e?.message||e).slice(0,130));
  return {stored:false,path:null};
 }
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
  const url=await cachedAudio(key,'wav',env);
  if(url)return json(200,{success:true,...url,source:url.source,model:ttsModel,content_type:'audio/wav',voice:ttsVoice,ai_generated:true});
  const apiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!apiKey)return json(503,{success:false,error:'AI voice is not configured'});
  // Realtime is preferred, but never let a WebSocket failure silence the lesson.
  try{
   const wav=await generateQuestionWav({apiKey,text:t,model:ttsModel,voice:ttsVoice});
   if(!wav.byteLength||wav.byteLength>1250000)throw Error('Invalid Realtime WAV');
   const audio=base64(wav);
   const saved=await saveR2(key,audio,'wav',env);
   return json(200,{success:true,audio,content_type:'audio/wav',source:'openai_realtime',model:ttsModel,
     stored:saved.stored,r2_status:saved.path||'not_saved',voice:ttsVoice,ai_generated:true});
  }catch(realtimeError){
   console.warn('[Free Talking audio] realtime generation failed; trying speech fallback',String(realtimeError?.message||realtimeError).slice(0,160));
  }
  // Temporary compatibility fallback. Uses the existing OpenAI TTS endpoint
  // until Realtime generation is fully verified; never touches other apps.
  const fallbackVoice='shimmer',fallbackModel='gpt-4o-mini-tts';
  const fallbackKey=await cacheKey(t,fallbackModel,fallbackVoice,'fallback');
  const fallbackUrl=await cachedAudio(fallbackKey,'mp3',env);
  if(fallbackUrl)return json(200,{success:true,...fallbackUrl,content_type:'audio/mpeg',
    source:'r2_fallback',model:fallbackModel,voice:fallbackVoice,stored:true,ai_generated:true});
  const response=await fetch('https://api.openai.com/v1/audio/speech',{
   method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
   body:JSON.stringify({model:fallbackModel,voice:fallbackVoice,input:t,response_format:'mp3',
    instructions:'Ask this question naturally, with friendly American English intonation. Speak at a comfortable, unhurried pace without exaggerating syllables. Say only the question.'}),
   signal:AbortSignal.timeout(22000)
  });
  if(!response.ok){
   console.warn('[Free Talking audio] fallback TTS failed',response.status);
   return json(502,{success:false,error:'Both Realtime and backup question voices are unavailable'});
  }
  const mp3=await response.arrayBuffer();
  if(mp3.byteLength<500||mp3.byteLength>1200000)throw Error('Invalid backup MP3');
  const fallbackAudio=base64(mp3);
  const fallbackSaved=await saveR2(fallbackKey,fallbackAudio,'mp3',env);
  return json(200,{success:true,audio:fallbackAudio,content_type:'audio/mpeg',source:'openai_tts_fallback',model:fallbackModel,
    stored:fallbackSaved.stored,r2_status:fallbackSaved.path||'not_saved',voice:fallbackVoice,ai_generated:true});
 }catch(e){console.warn('[Free Talking audio] failure',e?.message||'error');return json(503,{success:false,error:'Question audio unavailable'})}
}
export async function onRequestGet({env}){
 return json(200,{success:true,service:'free-talking-question-audio',configured:!!(env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY),r2:(env.FREE_TALKING_AUDIO_BUCKET||env.AUDIO_BUCKET)?'direct-binding':'shared-audio-endpoints',direct_r2_bound:!!(env.FREE_TALKING_AUDIO_BUCKET||env.AUDIO_BUCKET),format:'wav',model:model(env),voice:voice(env)});
}
