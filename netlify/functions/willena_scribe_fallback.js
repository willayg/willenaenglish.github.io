// Willena Scribe fallback for Cloudflare Pages preview deployments.
// Isolated from the existing ElevenLabs voice proxy.
// Requires a valid approved Willena login for every request.
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
const reply=(status,body)=>({statusCode:status,headers,body:JSON.stringify(body)});
exports.handler=async(event)=>{
 if(event.httpMethod!=='POST')return reply(405,{error:'POST required'});
 const auth=String(event.headers?.authorization||event.headers?.Authorization||'');
 const token=auth.replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return reply(401,{error:'Willena login required'});
 let body;
 try{body=JSON.parse(event.body||'{}')}catch{return reply(400,{error:'Invalid request JSON'})}
 const action=body?.action;
 if(action!=='token'&&action!=='transcribe')return reply(400,{error:'Unsupported Scribe action'});
 const key=process.env.ELEVEN_LABS_API_KEY||process.env.ELEVENLABS_API_KEY||process.env.ELEVENLABS_API||process.env.ELEVENLABS_KEY;
 if(!key)return reply(503,{error:'ElevenLabs API key unavailable on Netlify'});
 try{
  const a=await fetch(ROOT+'/auth/v1/user',{headers:{apikey:PUB,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});
  if(!a.ok)return reply(401,{error:'Willena login expired'});
  const user=await a.json();
  const p=await fetch(ROOT+'/rest/v1/profiles?select=role,approved&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{
   headers:{apikey:PUB,Authorization:'Bearer '+token},signal:AbortSignal.timeout(8000)});
  const profile=p.ok?(await p.json())[0]:null;
  if(!profile||profile.approved!==true||!['student','teacher','admin','owner'].includes(profile.role))return reply(403,{error:'Willena approval required'});
  if(action==='token'){
   const r=await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',{
    method:'POST',headers:{'xi-api-key':key},signal:AbortSignal.timeout(12000)});
   const data=await r.json().catch(()=>({}));
   if(!r.ok||!data.token)return reply(502,{error:'ElevenLabs token rejected ('+r.status+'): '+String(data?.detail?.message||data?.detail||'').slice(0,140)});
   return reply(200,{token:data.token,model:'scribe_v2_realtime',provider:'netlify'});
  }
  const base64=String(body?.audio_base64||'');
  if(base64.length<480||base64.length>2100000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
   return reply(400,{error:'Invalid encoded recording'});
  const bytes=Buffer.from(base64,'base64');
  if(bytes.length<350||bytes.length>1500000)return reply(400,{error:'Recording size out of range'});
  const form=new FormData();
  form.set('model_id','scribe_v2');
  form.set('language_code','eng');
  form.set('tag_audio_events','false');
  form.set('diarize','false');
  form.set('file',new Blob([bytes],{type:'audio/webm'}),'answer.webm');
  const r=await fetch('https://api.elevenlabs.io/v1/speech-to-text',{
   method:'POST',headers:{'xi-api-key':key},body:form,signal:AbortSignal.timeout(26000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)return reply(502,{error:'ElevenLabs STT failed ('+r.status+'): '+String(data?.detail?.message||data?.detail||'').slice(0,140)});
  return reply(200,{text:String(data?.text||'').slice(0,500),model:'scribe_v2',provider:'netlify'});
 }catch(e){
  console.warn('Willena Scribe fallback',String(e));
  return reply(502,{error:'Scribe fallback temporarily unavailable'});
 }
};