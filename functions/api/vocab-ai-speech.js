// Word Genius optional speech assessment, hosted on the student Cloudflare Pages site.
// Audio is never persisted here. Never place API credentials in client scripts.
const BASE='https://api.openai.com/v1/audio/';
const limits=new Map();
const json=(status,body)=>new Response(JSON.stringify(body),{
  status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff'}
});
const error=(status,message)=>json(status,{success:false,error:message});
const allow=(id,kind)=>{
  const key=id+':'+kind,now=Date.now();
  const stamps=(limits.get(key)||[]).filter(t=>now-t<3600000);
  const max=kind==='listen'?90:24;
  if(stamps.length>=max){limits.set(key,stamps);return false}
  stamps.push(now);limits.set(key,stamps);
  if(limits.size>500)for(const [k,v] of limits)if(!v.length||now-v[v.length-1]>3600000)limits.delete(k);
  return true;
};
// Validate the token itself against Supabase Auth. This does not depend on
// forwarding a browser cookie through the external API gateway.
const SUPABASE_URL='https://fiieuiktlsivwfgyivai.supabase.co';
const PUBLISHABLE_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
function authTokens(request){
  const header=request.headers.get('Authorization')||'';
  const cookie=request.headers.get('Cookie')||'';
  const values=[];
  const m=/(?:^|;\s*)sb_access=([^;]+)/.exec(cookie);
  if(m){try{values.push(decodeURIComponent(m[1]))}catch(_){}}
  if(/^Bearer\s+/i.test(header))values.push(header.replace(/^Bearer\s+/i,'').trim());
  return [...new Set(values.filter(value=>value&&value.length>40))];
}
async function requireStudent(request){
  const tokens=authTokens(request);
  if(!tokens.length)return {userId:null,reason:'missing_session'};
  for(const token of tokens){
    const headers={apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+token};
    const check=await fetch(SUPABASE_URL+'/auth/v1/user',{
      headers,redirect:'manual',signal:AbortSignal.timeout(10000),cache:'no-store'
    });
    if(check.status===401||check.status===403)continue; // Try a newer bearer/cookie token.
    if(!check.ok)throw new Error('Supabase Auth validation failed: '+check.status);
    const user=await check.json().catch(()=>null);
    if(!user?.id)continue;
    // Lookup is scoped to the identity verified by Supabase, never a client-supplied ID.
    const roleRequest=await fetch(SUPABASE_URL+'/rest/v1/profiles?select=id,role,approved&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{
      headers,redirect:'manual',signal:AbortSignal.timeout(10000),cache:'no-store'
    });
    if(!roleRequest.ok)throw new Error('Profile validation failed: '+roleRequest.status);
    const rows=await roleRequest.json().catch(()=>[]);
    const profile=Array.isArray(rows)?rows[0]:null;
    // Teachers and admins can use Word Genius in approved preview sessions.
    const allowed=['student','teacher','admin'].includes(String(profile?.role||'').toLowerCase());
    if(profile?.id!==user.id||!allowed||profile.approved!==true)
      return {userId:null,reason:'approved_account_required'};
    return {userId:String(user.id),reason:null};
  }
  return {userId:null,reason:'session_invalid'};
}
// Reuse the same R2 lookup/upload endpoints Study V2 uses.
// A versioned, hashed key keeps Shimmer audio distinct from the legacy
// word.mp3 files (often ElevenLabs) and from other voice/model versions.
const R2_AUDIO_API='https://api.willenaenglish.com/.netlify/functions/';
const TTS_VOICE='shimmer';
const TTS_MODEL='gpt-4o-mini-tts';
const TTS_SPEED=.9;
const TTS_VERSION='wg_shimmer_v1';
async function listeningCacheKey(input){
  const source=[TTS_VERSION,TTS_MODEL,TTS_VOICE,String(TTS_SPEED),input.trim()].join('|');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
  const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
  return TTS_VERSION+'_'+hash.slice(0,32);
}
async function lookupListeningMp3(key){
  try{
    const r=await fetch(R2_AUDIO_API+'get_audio_urls',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({words:[key]}),
      signal:AbortSignal.timeout(7000),cache:'no-store'
    });
    if(!r.ok){console.warn('[vocab-ai-speech] R2 lookup HTTP',r.status);return null}
    const data=await r.json().catch(()=>null);
    const row=data?.results?.[key];
    const url=String(row?.url||'');
    // The lookup endpoint returns an eight-hour presigned R2 URL.
    return row?.exists&&url.startsWith('https://')?url:null;
  }catch(e){console.warn('[vocab-ai-speech] R2 lookup unavailable',e?.name||'error');return null}
}
async function saveListeningMp3(key,audioBase64){
  try{
    const r=await fetch(R2_AUDIO_API+'upload_audio',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({word:key,fileDataBase64:audioBase64}),
      signal:AbortSignal.timeout(12000),cache:'no-store'
    });
    if(!r.ok){console.warn('[vocab-ai-speech] R2 MP3 upload HTTP',r.status);return false}
    const data=await r.json().catch(()=>null);
    return data?.success===true&&data?.path===key+'.mp3';
  }catch(e){console.warn('[vocab-ai-speech] R2 MP3 upload unavailable',e?.name||'error');return false}
}
function fromBase64(value){
  const binary=atob(value);
  const out=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);
  return out;
}
function toBase64(buffer){
  const bytes=new Uint8Array(buffer);
  let binary='';
  for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export async function onRequestPost({request,env}){
  const contentLength=Number(request.headers.get('Content-Length')||0);
  if(contentLength>1600000)return error(413,'Audio too large');
  let body;
  try{body=await request.json()}catch(_){return error(400,'Invalid JSON')}
  const action=body?.action;
  if(!['listen','transcribe'].includes(action))return error(400,'Invalid action');
  let identity;
  try{identity=await requireStudent(request)}
  catch(e){
    console.warn('[vocab-ai-speech] auth validation unavailable',e?.message||e?.name||'error');
    return json(503,{success:false,error:'AI sign-in verification unavailable',error_code:'auth_service'});
  }
  if(!identity?.userId){
    if(identity?.reason==='approved_account_required')return json(403,{success:false,error:'Approved student or staff account required',error_code:'account_role'});
    return json(401,{success:false,error:'AI session could not be verified',error_code:identity?.reason||'session_invalid'});
  }
  const userId=identity.userId;
  if(!allow(userId,action))return error(429,'AI service limit reached');
  const apiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!apiKey)return error(503,'AI audio service not configured in student Pages');
  try{
    if(action==='listen'){
      const input=String(body.text||'').trim();
      if(!input||input.length>100||!/[a-z]/i.test(input))return error(400,'Invalid pronunciation text');
      const cacheKey=await listeningCacheKey(input);
      const previous=await lookupListeningMp3(cacheKey);
      if(previous)return json(200,{success:true,audio_url:previous,content_type:'audio/mpeg',
        ai_generated:true,voice:TTS_VOICE,source:'r2',stored:true});
      const response=await fetch(BASE+'speech',{
        method:'POST',
        headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:TTS_MODEL,voice:TTS_VOICE,input,speed:TTS_SPEED,
          instructions:'Say only the English word or phrase in a clear, natural adult female American voice. Speak slightly slowly, with neutral US pronunciation and no additional words.',
          response_format:'mp3'
        }),signal:AbortSignal.timeout(20000)
      });
      if(!response.ok){console.warn('[vocab-ai-speech] TTS upstream',response.status);return error(502,'AI listening unavailable ('+response.status+')')}
      const bytes=await response.arrayBuffer();
      if(!bytes.byteLength||bytes.byteLength>650000)return error(502,'Invalid AI listening audio');
      const audio=toBase64(bytes);
      const stored=await saveListeningMp3(cacheKey,audio);
      return json(200,{success:true,audio,content_type:'audio/mpeg',ai_generated:true,
        voice:TTS_VOICE,source:'openai',stored});
    }
    const encoded=String(body.audio_base64||'');
    const mime=String(body.mime_type||'').toLowerCase();
    const ext=mime.startsWith('audio/webm')?'webm':mime.startsWith('audio/ogg')?'ogg':mime.startsWith('audio/mp4')?'mp4':null;
    if(!ext||!encoded||encoded.length>1450000||!/^[a-zA-Z0-9+/=]+$/.test(encoded))return error(400,'Invalid recording format');
    const bytes=fromBase64(encoded);
    if(bytes.length<400||bytes.length>1050000)return error(400,'Invalid recording length');
    const type=ext==='webm'?'audio/webm':ext==='ogg'?'audio/ogg':'audio/mp4';
    const form=new FormData();
    form.append('file',new Blob([bytes],{type}),'speech-review.'+ext);
    form.append('model','gpt-transcribe');
    form.append('languages[]','en');
    form.append('response_format','json');
    // No target hint: model must transcribe the spoken audio independently.
    const response=await fetch(BASE+'transcriptions',{
      method:'POST',headers:{Authorization:'Bearer '+apiKey},body:form,
      signal:AbortSignal.timeout(25000)
    });
    if(!response.ok){
      const failure=await response.json().catch(()=>null);
      const code=String(failure?.error?.code||failure?.error?.type||'upstream').slice(0,50);
      console.warn('[vocab-ai-speech] transcription upstream',response.status,code);
      return error(502,'AI transcription unavailable ('+response.status+')');
    }
    const result=await response.json().catch(()=>null);
    if(typeof result?.text!=='string')return error(502,'Invalid AI transcription result');
    return json(200,{success:true,transcript:result.text.trim().slice(0,250)});
  }catch(e){
    console.warn('[vocab-ai-speech] upstream unavailable',e?.name||'error');
    return error(503,'AI service connection failed');
  }
}
// Minimal health check helps distinguish a missing Pages deployment (404)
// from a deployed route with missing AI credentials (configured:false).
export async function onRequestGet({env}){
  return json(200,{success:true,service:'vocab-ai-speech',configured:!!(env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY)});
}
export async function onRequestOptions(){return new Response(null,{status:204,headers:{'Allow':'POST,OPTIONS','Cache-Control':'no-store'}})}
