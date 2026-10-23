'use strict';
// Word Genius optional audio fallback. Audio lives only in memory during this request.
// Server-side credentials only. Never log submitted audio or transcripts.
const {corsJsonResponse,handleCorsPreflightIfNeeded}=require('./lib/cors');
const ENDPOINT='https://api.openai.com/v1/audio/';
const limits=new Map();
function fail(event,status,error){return corsJsonResponse(event,status,{success:false,error},{'Cache-Control':'no-store'})}
function tokenFrom(event){
  const h=event.headers||{};
  const cookie=String(h.cookie||h.Cookie||'');
  const m=cookie.match(/(?:^|;\s*)sb_access=([^;]+)/);
  if(m){try{return decodeURIComponent(m[1])}catch(_){}}
  const header=String(h.authorization||h.Authorization||'');
  return /^Bearer\s+/i.test(header)?header.replace(/^Bearer\s+/i,'').trim():'';
}
async function authenticatedStudent(event){
  const token=tokenFrom(event);
  const base=process.env.SUPABASE_URL||process.env.SUPABASE_PROJECT_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY;
  if(!token||!base||!key)return null;
  const headers={apikey:key,Authorization:'Bearer '+token};
  const response=await fetch(base.replace(/\/$/,'')+'/auth/v1/user',{headers,signal:AbortSignal.timeout(8000)});
  if(!response.ok)return null;
  const user=await response.json().catch(()=>null);
  if(!user?.id)return null;
  // Verify an approved student rather than accepting arbitrary valid users.
  const lookup=await fetch(base.replace(/\/$/,'')+'/rest/v1/profiles?select=id,role,approved&id=eq.'+encodeURIComponent(user.id),{
    headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(8000)
  });
  if(!lookup.ok)return null;
  const rows=await lookup.json().catch(()=>[]);
  if(!Array.isArray(rows)||rows[0]?.role!=='student'||rows[0]?.approved===false)return null;
  return user.id;
}
function permitted(id,action){
  const now=Date.now(),key=id+'|'+action;
  const history=(limits.get(key)||[]).filter(t=>now-t<3600000);
  if(history.length>=(action==='listen'?90:24)){limits.set(key,history);return false}
  history.push(now);limits.set(key,history);
  if(limits.size>500)for(const [k,v] of limits){if(!v.length||now-v[v.length-1]>3600000)limits.delete(k)}
  return true;
}
exports.handler=async event=>{
  const preflight=handleCorsPreflightIfNeeded(event);
  if(preflight)return preflight;
  if(event.httpMethod!=='POST')return fail(event,405,'POST required');
  if(event.isBase64Encoded)return fail(event,400,'JSON required');
  if(String(event.body||'').length>1600000)return fail(event,413,'Audio too large');
  let body;
  try{body=JSON.parse(event.body||'{}')}catch(_){return fail(event,400,'Invalid JSON')}
  const action=body.action==='listen'?'listen':body.action==='transcribe'?'transcribe':null;
  if(!action)return fail(event,400,'Invalid action');
  let userId;
  try{userId=await authenticatedStudent(event)}catch(_){return fail(event,503,'Authentication unavailable')}
  if(!userId)return fail(event,401,'Student sign-in required');
  if(!permitted(userId,action))return fail(event,429,'Too many AI requests; continue with browser practice');
  const apiKey=process.env.OPENAI_API_KEY||process.env.OPENAI_API||process.env.OPENAI_KEY;
  if(!apiKey)return fail(event,503,'AI audio service is not configured');
  try{
    if(action==='listen'){
      const input=String(body.text||'').trim();
      if(!input||input.length>100||!/[a-z]/i.test(input))return fail(event,400,'Invalid word');
      const voiceResponse=await fetch(ENDPOINT+'speech',{
        method:'POST',
        headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
        body:JSON.stringify({
          model:'gpt-4o-mini-tts',voice:'onyx',input,speed:0.9,
          instructions:'Speak only the supplied English word or phrase in a natural adult American masculine-sounding voice, clearly, slightly slowly, with a neutral US accent. No added words.',
          response_format:'mp3'
        }),
        signal:AbortSignal.timeout(18000)
      });
      if(!voiceResponse.ok)return fail(event,502,'Pronunciation audio unavailable');
      const audio=Buffer.from(await voiceResponse.arrayBuffer());
      if(!audio.length||audio.length>650000)return fail(event,502,'Invalid pronunciation audio');
      return corsJsonResponse(event,200,{success:true,audio:audio.toString('base64'),content_type:'audio/mpeg',ai_generated:true},{'Cache-Control':'private, no-store'});
    }
    const raw=String(body.audio_base64||'');
    const mime=String(body.mime_type||'').toLowerCase();
    const ext=mime.startsWith('audio/webm')?'webm':mime.startsWith('audio/ogg')?'ogg':mime.startsWith('audio/mp4')?'mp4':'';
    if(!ext||!raw||raw.length>1450000||!/^[A-Za-z0-9+/=]+$/.test(raw))return fail(event,400,'Unsupported audio recording');
    const audio=Buffer.from(raw,'base64');
    if(audio.length<400||audio.length>1050000)return fail(event,413,'Recording must be short');
    const form=new FormData();
    const ctype=ext==='webm'?'audio/webm':ext==='ogg'?'audio/ogg':'audio/mp4';
    form.append('file',new Blob([audio],{type:ctype}),'speaking-check.'+ext);
    form.append('model','gpt-transcribe');
    form.append('language','en');
    form.append('response_format','json');
    // Do not supply the expected target word to the model; avoid answer bias.
    const response=await fetch(ENDPOINT+'transcriptions',{
      method:'POST',headers:{Authorization:'Bearer '+apiKey},body:form,signal:AbortSignal.timeout(20000)
    });
    if(!response.ok)return fail(event,502,'AI transcription unavailable');
    const result=await response.json().catch(()=>null);
    const transcript=String(result?.text||'').trim().slice(0,250);
    return corsJsonResponse(event,200,{success:true,transcript},{'Cache-Control':'private, no-store'});
  }catch(error){
    console.warn('[vocab_ai_speech] request failed',error?.name||'unknown');
    return fail(event,503,'AI service unavailable; use normal speaking practice');
  }
};
