// Free Talking Genius: authenticated question audio, cached in Willena's existing R2 audio store.
// Question text comes from the published Content Database, never from browser-supplied text.
import {generateQuestionWav} from '../_lib/free-talking-realtime-wav.js';
const SCORES='https://fiieuiktlsivwfgyivai.supabase.co';
const SCORES_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
// Audio is authorized by published question ID, not a single hardcoded textbook.
const R2='https://api.willenaenglish.com/.netlify/functions/';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const model=env=>env.FREE_TALKING_REALTIME_MODEL||'gpt-realtime-2.1-mini';
const voice=env=>env.FREE_TALKING_REALTIME_VOICE||'marin';
// Only these two voices are selectable. Prize voices remain registered separately
// but are not reachable through this endpoint until an authenticated unlock system exists.
const SELECTABLE_VOICES=new Set(['marin','bunny-v3']);
const ELEVEN_VOICES=Object.freeze({
 bunny:'M7zl2TS7ORAIGUejDfoy',
 'bunny-v3':'M7zl2TS7ORAIGUejDfoy'
});
const ELEVEN_MODEL='eleven_v3';
const ELEVEN_PROXY='https://api.willenaenglish.com/.netlify/functions/eleven_labs_proxy';
async function elevenAudio({env,text,voiceId,modelId=ELEVEN_MODEL}){
 const settings=modelId==='eleven_v3'?{stability:0.5}:{stability:0.55,similarity_boost:0.8,style:0,use_speaker_boost:false};
 const key=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY;
 if(key){
  const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voiceId)+'?output_format=mp3_44100_128',{
   method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
   body:JSON.stringify({text,model_id:modelId,voice_settings:settings}),
   signal:AbortSignal.timeout(25000)
  });
  if(!response.ok)throw Error('ElevenLabs TTS HTTP '+response.status);
  const audio=await response.arrayBuffer();
  if(audio.byteLength<500||audio.byteLength>1200000)throw Error('Invalid ElevenLabs MP3');
  return audio;
 }
 // English Arcade's existing Netlify ElevenLabs backend has the credentials.
 // Only this authenticated Pages Function sends textbook-controlled text here.
 const response=await fetch(ELEVEN_PROXY,{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({text,voice_id:voiceId,model_id:modelId,
   voice_settings:settings}),
  signal:AbortSignal.timeout(30000)
 });
 if(!response.ok)throw Error('Existing ElevenLabs proxy HTTP '+response.status);
 const data=await response.json().catch(()=>null);
 const encoded=String(data?.audio||'');
 if(encoded.length<700||encoded.length>1650000||!/^[a-zA-Z0-9+/=]+$/.test(encoded))throw Error('Existing ElevenLabs proxy returned invalid audio');
 const binary=atob(encoded),bytes=new Uint8Array(binary.length);
 for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
 return bytes.buffer;
}
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
 return UUID.test(String(row?.book_id||''))&&row.is_published===true?row:null;
}
async function cacheKey(text,ttsModel,ttsVoice,variant='realtime'){
 const source=[variant==='realtime'?'free_talking_realtime_question_wav_v1':variant==='elevenlabs'?'free_talking_elevenlabs_question_mp3_v1':'free_talking_legacy_fallback_mp3_v1',ttsModel,ttsVoice,'natural_voice_1',text.trim()].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
 const hex=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
 return (variant==='realtime'?'ft_realtime_v1_':variant==='elevenlabs'?'ft_eleven_v1_':'ft_fallback_v1_')+hex.slice(0,32);
}
// Cache lookup must fail closed: an R2 outage is NOT a cache miss.
// Otherwise every refresh can regenerate all questions and consume paid TTS credits.
async function cachedAudio(key,format='wav',env={}){
 const bucket=env.FREE_TALKING_AUDIO_BUCKET||env.AUDIO_BUCKET;
 let directError=null;
 if(bucket){
  try{
   const object=await bucket.get(key+'.'+format);
   if(object)return {audio:base64(await object.arrayBuffer()),source:'r2_direct',stored:true};
  }catch(e){
   directError=e;
   console.warn('[Free Talking audio] direct R2 lookup failed',String(e?.message||e).slice(0,130));
  }
 }
 try{
  const res=await fetch(R2+'get_audio_urls',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({words:[key],format}),signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!res.ok)throw Error('Shared R2 lookup HTTP '+res.status);
  const data=await res.json();
  const found=data?.results?.[key];
  if(!found||typeof found.exists!=='boolean')throw Error('Shared R2 lookup returned invalid status');
  if(found.exists){
   if(typeof found.url!=='string'||!found.url.startsWith('https://'))throw Error('Shared R2 has object but URL is missing');
   return {audio_url:found.url,source:'r2_shared',stored:true};
  }
  // If an R2 binding failed, a missing shared object cannot prove it is absent.
  if(directError)throw Error('Direct R2 unavailable and shared cache has no matching file');
  return null;
 }catch(e){
  console.warn('[Free Talking audio] R2 lookup unavailable',String(e?.message||e).slice(0,130));
  // Distinguish an unreachable cache from a confirmed miss.
  throw Error('R2_LOOKUP_UNAVAILABLE');
 }
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
  // A 200 from upload alone is insufficient: verify through the reader used on reload.
  const verified=await cachedAudio(key,format,{});
  if(!verified||verified.source!=='r2_shared')throw Error('R2 upload not readable after writing');
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
  const chosenVoice=body?.voice==null?'':String(body.voice).toLowerCase().trim();
  // Accept the previously working Bunny comparison protocol for AI Lili.
  const comparison=chosenVoice==='bunny'&&body?.compare_model==='eleven_v3';
  if(!comparison&&(!SELECTABLE_VOICES.has(chosenVoice)||body?.compare_model))
   return json(400,{success:false,error:'This voice is not available yet.'});
  const elevenModel=ELEVEN_MODEL;
  const elevenId=ELEVEN_VOICES[chosenVoice]||null;
  if(elevenId){
   const cache=await cacheKey(t,elevenModel,elevenId,'elevenlabs');
   const hit=await cachedAudio(cache,'mp3',env);
   if(hit)return json(200,{success:true,...hit,cache_status:'hit',source:hit.source,model:elevenModel,
    voice:chosenVoice,provider:'elevenlabs',content_type:'audio/mpeg',ai_generated:true,stored:true});
   try{
    const bytes=await elevenAudio({env,text:t,voiceId:elevenId,modelId:elevenModel});
    const audio=base64(bytes);
    const saved=await saveR2(cache,audio,'mp3',env);
    return json(200,{success:true,audio,cache_status:saved.stored?'generated_saved':'generated_unsaved',source:'elevenlabs',model:elevenModel,
     voice:chosenVoice,provider:'elevenlabs',content_type:'audio/mpeg',
     stored:saved.stored,r2_status:saved.path||'not_saved',ai_generated:true});
   }catch(e){
    console.warn('[Free Talking audio] ElevenLabs generation failed',String(e?.message||e).slice(0,160));
    return json(502,{success:false,error:'ElevenLabs voice unavailable. Please select another voice.'});
   }
  }
  const ttsModel=model(env),ttsVoice=chosenVoice||voice(env),key=await cacheKey(t,ttsModel,ttsVoice);
  const url=await cachedAudio(key,'wav',env);
  if(url)return json(200,{success:true,...url,cache_status:'hit',source:url.source,model:ttsModel,content_type:'audio/wav',voice:ttsVoice,ai_generated:true});
  const apiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!apiKey)return json(503,{success:false,error:'AI voice is not configured'});
  // Realtime is preferred, but never let a WebSocket failure silence the lesson.
  try{
   const wav=await generateQuestionWav({apiKey,text:t,model:ttsModel,voice:ttsVoice});
   if(!wav.byteLength||wav.byteLength>1250000)throw Error('Invalid Realtime WAV');
   const audio=base64(wav);
   const saved=await saveR2(key,audio,'wav',env);
   return json(200,{success:true,audio,cache_status:saved.stored?'generated_saved':'generated_unsaved',content_type:'audio/wav',source:'openai_realtime',model:ttsModel,
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
    source:'r2_fallback',cache_status:'hit',model:fallbackModel,voice:fallbackVoice,stored:true,ai_generated:true});
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
  return json(200,{success:true,audio:fallbackAudio,cache_status:fallbackSaved.stored?'generated_saved':'generated_unsaved',content_type:'audio/mpeg',source:'openai_tts_fallback',model:fallbackModel,
    stored:fallbackSaved.stored,r2_status:fallbackSaved.path||'not_saved',voice:fallbackVoice,ai_generated:true});
 }catch(e){const reason=String(e?.message||e);console.warn('[Free Talking audio] failure',reason);
  if(reason==='R2_LOOKUP_UNAVAILABLE')return json(503,{success:false,error:'R2 cache temporarily unavailable; audio generation skipped to avoid duplicate charges.',cache_status:'lookup_error'});
  return json(503,{success:false,error:'Question audio unavailable'});}
}
export async function onRequestGet({env}){
 return json(200,{success:true,service:'free-talking-question-audio',configured:!!(env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY),r2:(env.FREE_TALKING_AUDIO_BUCKET||env.AUDIO_BUCKET)?'direct-binding':'shared-audio-endpoints',direct_r2_bound:!!(env.FREE_TALKING_AUDIO_BUCKET||env.AUDIO_BUCKET),format:'wav',model:model(env),voice:voice(env)});
}
