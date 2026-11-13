// Hybrid-only transcription proxy. No recordings saved.
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return reply(403,{error:'Origin rejected'});
 const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(bearer.length<40)return reply(401,{error:'Sign in first'});
 if(!request.headers.get('content-type')?.includes('multipart/form-data'))return reply(415,{error:'Multipart audio required'});
 const requested=request.headers.get('X-Willena-STT')||'openai-mini';
 if(!['openai-mini','eleven-scribe-v2'].includes(requested))return reply(400,{error:'Unknown STT engine'});
 const key=requested==='eleven-scribe-v2'
  ?(env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY||env.ELEVENLABS_API||env.ELEVENLABS_KEY)
  :(env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY);
 if(!key&&requested==='openai-mini')return reply(503,{error:'OpenAI key missing on this deployment'});
 try{
  const auth=await fetch(ROOT+'/auth/v1/user',{headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply(401,{error:'Session expired'});
  const user=await auth.json();
  const p=await fetch(ROOT+'/rest/v1/profiles?select=role,approved&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  const profile=p.ok?(await p.json())[0]:null;
  if(!profile||profile.approved!==true||!['student','teacher','admin','owner'].includes(profile.role))return reply(403,{error:'Not approved'});
  const form=await request.formData();
  const audio=form.get('audio');
  if(!(audio instanceof File)||audio.size<350||audio.size>1500000)return reply(400,{error:'Invalid recording size'});
  const eleven=requested==='eleven-scribe-v2';
  if(eleven&&!key){
   const bytes=new Uint8Array(await audio.arrayBuffer());
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   const fallback=await fetch('https://willenaenglish.netlify.app/.netlify/functions/willena_scribe_fallback',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+bearer},
    body:JSON.stringify({action:'transcribe',audio_base64:btoa(binary)}),signal:AbortSignal.timeout(29000)});
   const result=await fallback.json().catch(()=>({}));
   if(!fallback.ok)return reply(502,{error:'Netlify Scribe failed ('+fallback.status+'): '+String(result.error||'').slice(0,130)});
   return reply(200,{text:String(result.text||'').slice(0,500),model:'scribe_v2',provider:'netlify'});
  }
  const outgoing=new FormData();
  if(eleven){
   outgoing.set('model_id','scribe_v2');
   outgoing.set('language_code','eng');
   outgoing.set('tag_audio_events','false');
   outgoing.set('diarize','false');
   outgoing.set('file',audio,'answer.webm');
  }else{
   outgoing.set('model','gpt-4o-mini-transcribe');
   outgoing.set('language','en');
   outgoing.set('prompt','Korean students are speaking English to an English-learning character. Transcribe only words actually spoken in English, using English spelling. Never translate into Spanish or another language. Preserve imperfect but intelligible English. Avoid guessing from silence or inventing textbook answers.');
   outgoing.set('file',audio,'answer.webm');
  }
  const r=await fetch(eleven?'https://api.elevenlabs.io/v1/speech-to-text':'https://api.openai.com/v1/audio/transcriptions',{
   method:'POST',
   headers:eleven?{'xi-api-key':key}:{Authorization:'Bearer '+key},
   body:outgoing,signal:AbortSignal.timeout(25000)});
  const data=await r.json().catch(()=>null);
  if(!r.ok)return reply(502,{error:(eleven?'ElevenLabs':'OpenAI')+' STT failed ('+r.status+'): '+String(data?.detail?.message||data?.error?.message||'').slice(0,130)});
  const transcript=String(data?.text||'').trim().slice(0,500);
  // A silent/unclear recording can cause STT to hallucinate its own prompt.
  // Never return instructions as student speech, especially after a pause.
  const normalized=transcript.toLowerCase().replace(/[^a-z ]+/g,' ').replace(/\s+/g,' ').trim();
  const promptEcho=/(korean students are speaking english|transcribe only words actually spoken|never translate into spanish|preserve imperfect but intelligible english|avoid guessing from silence|inventing textbook answers)/i.test(normalized);
  if(promptEcho)return reply(200,{text:'',rejected:'transcription_prompt_echo',model:eleven?'scribe_v2':'gpt-4o-mini-transcribe',provider:eleven?'cloudflare':'openai'});
  return reply(200,{text:transcript,model:eleven?'scribe_v2':'gpt-4o-mini-transcribe',provider:eleven?'cloudflare':'openai'});
 }catch(e){console.warn('hybrid transcription',String(e));return reply(502,{error:'Transcription unavailable'})}
}