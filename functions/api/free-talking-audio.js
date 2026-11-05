// Free Talking Genius: authenticated question audio, cached in Willena's existing R2 audio store.
// Question text comes from the published Content Database, never from browser-supplied text.
import {generateQuestionWav} from '../_lib/free-talking-realtime-wav.js';
const SCORES='https://fiieuiktlsivwfgyivai.supabase.co';
const SCORES_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
// Audio is authorized by published question ID, not a single hardcoded textbook.
// Cloudflare Pages R2 binding; no remote Netlify storage calls.
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
// ElevenLabs requires the API key on Cloudflare, not Netlify.
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
 throw Error('ELEVENLABS_KEY_NOT_CONFIGURED_ON_CLOUDFLARE');
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
// Reuse Willena's existing get-audio-urls Cloudflare Worker and its bound R2
// bucket, instead of depending on R2 bindings on Pages Preview deployments.
const AUDIO_WORKER='https://get-audio-urls.willena.workers.dev/free-talking-store';
function studentBearer(request){
 const value=request.headers.get('Authorization')||'';
 if(!/^Bearer\s+\S{40,}/i.test(value))throw Error('STUDENT_AUTH_REQUIRED');
 return value;
}
async function audioStore(request,body){
 let response;
 try{
  response=await fetch(AUDIO_WORKER,{method:'POST',
   headers:{Authorization:studentBearer(request),'Content-Type':'application/json'},
   body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
 }catch(e){
  console.warn('[Free Talking] shared audio worker unavailable',String(e?.message||e).slice(0,100));
  throw Error('SHARED_AUDIO_WORKER_UNAVAILABLE');
 }
 const result=await response.json().catch(()=>null);
 if(!response.ok||!result?.success){
  const code=String(result?.code||'SHARED_AUDIO_WORKER_ERROR');
  console.warn('[Free Talking] shared storage HTTP',response.status,code);
  throw Error(code);
 }
 return result;
}
function base64(bytes){
 const a=new Uint8Array(bytes);let s='';
 for(let i=0;i<a.length;i+=8192)s+=String.fromCharCode(...a.subarray(i,i+8192));
 return btoa(s);
}
async function cachedAudio(key,format='wav',request){
 const r=await audioStore(request,{action:'get',key,format});
 return r.found?{audio:r.audio,source:'r2_shared',stored:true}:null;
}
async function saveR2(key,audio,format='wav',request,questionId,modelId,voiceId,variant){
 const r=await audioStore(request,{action:'put',key,audio,format,
  question_id:questionId,model:modelId,voice:voiceId,variant});
 if(!r.stored)throw Error('R2_WRITE_FAILED');
 return {stored:true,path:'shared_worker'};
}
// Inventory-first preload: check all published questions in one R2 manifest pass.
// Never invoke a TTS provider while assembling an inventory.
async function audioInventory(bookId,env,request){
 const res=await fetch(CONTENT+'/rest/v1/free_talking_questions?select=id,question_en&book_id=eq.'+
  encodeURIComponent(bookId)+'&is_published=eq.true&order=unit_number.asc,question_number.asc&limit=200',{
  headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},
  cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!res.ok)throw Error('INVENTORY_CONTENT_UNAVAILABLE');
 const rows=await res.json();
 if(!Array.isArray(rows)||rows.length>200)throw Error('INVENTORY_INVALID');
 const records=[];
 for(const q of rows){
  if(!UUID.test(q.id)||!q.question_en)continue;
  const text=String(q.question_en).trim();
  records.push({
   id:q.id,
   marin:await cacheKey(text,model(env),'marin'),
   lili:await cacheKey(text,ELEVEN_MODEL,ELEVEN_VOICES['bunny-v3'],'elevenlabs'),
   fallback:await cacheKey(text,'gpt-4o-mini-tts','marin','fallback')
  });
 }
 const files=records.flatMap(r=>[r.marin+'.wav',r.lili+'.mp3',r.fallback+'.mp3']);
 const result=await audioStore(request,{action:'inventory',files});
 const statuses=new Map();
 for(const file of files){const key=file.slice(0,file.lastIndexOf('.'));statuses.set(key,{exists:!!result.exists?.[file],url:null});}
 return {
  success:true,book_id:bookId,questions:records.map(r=>{
   const willi=statuses.get(r.marin),backup=statuses.get(r.fallback),lili=statuses.get(r.lili);
   const williResolved=willi?.exists?willi:backup?.exists?backup:{exists:false,url:null};
   return {id:r.id,marin:{cached:!!williResolved.exists,url:williResolved.url,
     model:willi?.exists?model(env):'gpt-4o-mini-tts',voice:'marin',
     source:williResolved.url?'r2_shared':'r2_direct',content_type:willi?.exists?'audio/wav':'audio/mpeg'},
    'bunny-v3':{cached:!!lili?.exists,url:lili?.url||null,
     model:ELEVEN_MODEL,voice:'bunny',source:lili?.url?'r2_shared':'r2_direct',
     content_type:'audio/mpeg'}};
  })
 };
}
// Check storage readiness before paid TTS. The shared Worker probes its own bucket.
async function probeAudioStorage(request){
 const result=await audioStore(request,{action:'probe'});
 return {success:result.stored===true,storage_ready:result.stored===true,
  storage_path:'shared_worker',code:result.code||'R2_READY'};
}
export async function onRequestPost({request,env,context}){
 try{
  const userId=await verifyStudent(request);
  if(!userId)return json(401,{success:false,error:'학생 로그인을 확인해 주세요.'});
  const body=await request.json().catch(()=>null);
  if(body?.storage_probe===true){
   try{
    const probe=await probeAudioStorage(request);
    return json(probe.success?200:503,probe);
   }catch(e){
    console.warn('[Free Talking] R2 storage preflight',String(e?.message||e).slice(0,150));
    const reason=String(e?.message||e);
    return json(503,{success:false,storage_ready:false,code:reason==='R2_WRITE_FAILED'?reason:'R2_PROBE_FAILED'});
   }
  }
  if(body?.inventory_book_id){
   const bookId=String(body.inventory_book_id);
   if(!UUID.test(bookId))return json(400,{success:false,error:'Invalid book'});
   try{return json(200,await audioInventory(bookId,env,request))}
   catch(e){
    console.warn('[Free Talking] R2 inventory',String(e?.message||e).slice(0,150));
    return json(503,{success:false,error:'R2 inventory unavailable; no new audio generated',code:'INVENTORY_UNAVAILABLE'});
   }
  }
  const id=String(body?.question_id||'');
  // Preloader receives cache status only; it never downloads the audio bytes.
  const warmOnly=body?.warm_only===true;
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
   const hit=await cachedAudio(cache,'mp3',request);
   if(hit)return json(200,{success:true,...(warmOnly?{}:hit),cache_status:'hit',source:hit.source,model:elevenModel,
    voice:chosenVoice,provider:'elevenlabs',content_type:'audio/mpeg',ai_generated:true,stored:true});
   try{
    const bytes=await elevenAudio({env,text:t,voiceId:elevenId,modelId:elevenModel});
    const audio=base64(bytes);
    const saved=await saveR2(cache,audio,'mp3',request,id,elevenModel,elevenId,'elevenlabs');
    return json(200,{success:true,...(warmOnly?{}:{audio}),cache_status:saved.stored?'generated_saved':'generated_unsaved',source:'elevenlabs',model:elevenModel,
     voice:chosenVoice,provider:'elevenlabs',content_type:'audio/mpeg',
     stored:saved.stored,r2_status:saved.path||'not_saved',ai_generated:true});
   }catch(e){
    const reason=String(e?.message||e);
    if(reason==='R2_WRITE_FAILED')return json(503,{success:false,error:reason,code:reason,cache_status:'storage_error'});
    if(reason==='ELEVENLABS_KEY_NOT_CONFIGURED_ON_CLOUDFLARE')return json(503,{success:false,error:reason,code:reason});
    console.warn('[Free Talking audio] ElevenLabs generation failed',reason.slice(0,160));
    // Report category, not provider response bodies or credentials.
    const category=/429|rate.limit/i.test(reason)?'rate_limit':
     /timeout|timed.out|abort/i.test(reason)?'timeout':
     /proxy|HTTP 5\d\d/i.test(reason)?'provider_unavailable':'generation_error';
    return json(502,{success:false,error:'ElevenLabs '+category+'; this clip will be retried.',code:category});
   }
  }
  const ttsModel=model(env),ttsVoice=chosenVoice||voice(env),key=await cacheKey(t,ttsModel,ttsVoice);
  const url=await cachedAudio(key,'wav',request);
  if(url)return json(200,{success:true,...(warmOnly?{}:url),stored:true,cache_status:'hit',source:url.source,model:ttsModel,content_type:'audio/wav',voice:ttsVoice,ai_generated:true});
  // Once Marin's compatible MP3 fallback exists, reuse it immediately.
  // Do not repeatedly attempt a failed Realtime generation on every reload.
  const fallbackVoice='marin',fallbackModel='gpt-4o-mini-tts';
  const fallbackKey=await cacheKey(t,fallbackModel,fallbackVoice,'fallback');
  const existingFallback=await cachedAudio(fallbackKey,'mp3',request);
  if(existingFallback)return json(200,{success:true,...(warmOnly?{}:existingFallback),
   cache_status:'hit',source:'r2_fallback',model:fallbackModel,voice:fallbackVoice,
   content_type:'audio/mpeg',stored:true,ai_generated:true});
  const apiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!apiKey)return json(503,{success:false,error:'AI voice is not configured'});
  // Realtime is preferred, but never let a WebSocket failure silence the lesson.
  try{
   const wav=await generateQuestionWav({apiKey,text:t,model:ttsModel,voice:ttsVoice});
   if(!wav.byteLength||wav.byteLength>1250000)throw Error('Invalid Realtime WAV');
   const audio=base64(wav);
   const saved=await saveR2(key,audio,'wav',request,id,ttsModel,ttsVoice,'realtime');
   return json(200,{success:true,...(warmOnly?{}:{audio}),cache_status:saved.stored?'generated_saved':'generated_unsaved',content_type:'audio/wav',source:'openai_realtime',model:ttsModel,
     stored:saved.stored,r2_status:saved.path||'not_saved',voice:ttsVoice,ai_generated:true});
  }catch(realtimeError){
   if(String(realtimeError?.message||realtimeError)==='R2_WRITE_FAILED')throw realtimeError;
   console.warn('[Free Talking audio] realtime generation failed; trying speech fallback',String(realtimeError?.message||realtimeError).slice(0,160));
  }
  // Temporary Marin-voice compatibility fallback. Uses the existing OpenAI TTS endpoint
  // until Realtime generation is fully verified; never touches other apps.
  // No existing fallback; generate a new one only after Realtime fails.
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
  const fallbackSaved=await saveR2(fallbackKey,fallbackAudio,'mp3',request,id,fallbackModel,fallbackVoice,'fallback');
  return json(200,{success:true,...(warmOnly?{}:{audio:fallbackAudio}),cache_status:fallbackSaved.stored?'generated_saved':'generated_unsaved',content_type:'audio/mpeg',source:'openai_tts_fallback',model:fallbackModel,
    stored:fallbackSaved.stored,r2_status:fallbackSaved.path||'not_saved',voice:fallbackVoice,ai_generated:true});
 }catch(e){const reason=String(e?.message||e);console.warn('[Free Talking audio] failure',reason);
  if(/^(SHARED_AUDIO_|SHARED_R2_|R2_|STUDENT_AUTH_|INVALID_|AUDIO_KEY_)/.test(reason))
   return json(503,{success:false,error:reason,code:reason,cache_status:'storage_error'});
  return json(503,{success:false,error:'Question audio unavailable'});}
}
export async function onRequestGet({env}){
 return json(200,{success:true,service:'free-talking-question-audio',configured:!!(env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY),r2:'shared-worker',direct_r2_bound:false,storage_worker:AUDIO_WORKER,elevenlabs_configured:!!(env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY),format:'wav',model:model(env),voice:voice(env)});
}
