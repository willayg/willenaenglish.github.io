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
 const key=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
 if(!key)return reply(503,{error:'Transcription not configured'});
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
  const outgoing=new FormData();
  outgoing.set('model','gpt-4o-mini-transcribe');
  outgoing.set('language','en');
  outgoing.set('file',audio,'answer.webm');
  const r=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:'Bearer '+key},body:outgoing,signal:AbortSignal.timeout(25000)});
  const data=await r.json().catch(()=>null);
  if(!r.ok)return reply(502,{error:'Transcription failed ('+r.status+')'});
  return reply(200,{text:String(data?.text||'').slice(0,500),model:'gpt-4o-mini-transcribe'});
 }catch(e){console.warn('hybrid transcription',String(e));return reply(502,{error:'Transcription unavailable'})}
}