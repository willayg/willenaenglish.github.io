// Word Genius optional speech assessment, hosted on the student Cloudflare Pages site.
// Audio is never persisted here. Never place API credentials in client scripts.
const BASE='https://api.openai.com/v1/audio/';
const AUTH='https://api.willenaenglish.com/.netlify/functions/supabase_auth';
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
function authCookie(request){
  const cookie=request.headers.get('Cookie')||'';
  if(/(?:^|;\s*)sb_access=/.test(cookie))return cookie;
  const header=request.headers.get('Authorization')||'';
  if(/^Bearer\s+/i.test(header))return 'sb_access='+encodeURIComponent(header.replace(/^Bearer\s+/i,'').trim());
  return '';
}
async function requireStudent(request){
  const cookie=authCookie(request);
  if(!cookie)return null;
  const headers={Cookie:cookie};
  const check=await fetch(AUTH+'?action=whoami',{
    headers,redirect:'manual',signal:AbortSignal.timeout(10000),cache:'no-store'
  });
  if(!check.ok)return null;
  const user=await check.json().catch(()=>null);
  if(!user?.success||!user?.user_id)return null;
  const roleRequest=await fetch(AUTH+'?action=get_role&user_id='+encodeURIComponent(user.user_id),{
    headers,redirect:'manual',signal:AbortSignal.timeout(10000),cache:'no-store'
  });
  if(!roleRequest.ok)return null;
  const role=await roleRequest.json().catch(()=>null);
  if(role?.success!==true||role?.role!=='student')return null;
  return String(user.user_id);
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
  let userId;
  try{userId=await requireStudent(request)}
  catch(e){
    console.warn('[vocab-ai-speech] auth service unavailable',e?.name||'error');
    return error(503,'Authentication service unavailable');
  }
  if(!userId)return error(401,'Student sign-in required');
  if(!allow(userId,action))return error(429,'AI service limit reached');
  const apiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!apiKey)return error(503,'AI audio service not configured in student Pages');
  try{
    if(action==='listen'){
      const input=String(body.text||'').trim();
      if(!input||input.length>100||!/[a-z]/i.test(input))return error(400,'Invalid pronunciation text');
      const response=await fetch(BASE+'speech',{
        method:'POST',
        headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'gpt-4o-mini-tts',voice:'onyx',input,speed:.9,
          instructions:'Say only the English word or phrase in a natural adult American masculine-sounding voice. Speak clearly and slightly slowly with a neutral US accent. Do not add other words.',
          response_format:'mp3'
        }),signal:AbortSignal.timeout(20000)
      });
      if(!response.ok){console.warn('[vocab-ai-speech] TTS upstream',response.status);return error(502,'AI listening unavailable ('+response.status+')')}
      const bytes=await response.arrayBuffer();
      if(!bytes.byteLength||bytes.byteLength>650000)return error(502,'Invalid AI listening audio');
      return json(200,{success:true,audio:toBase64(bytes),content_type:'audio/mpeg',ai_generated:true});
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
