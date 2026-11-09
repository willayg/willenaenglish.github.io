// Short-lived token for ElevenLabs Scribe v2 Realtime. Never expose the API key.
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return reply(403,{error:'Origin rejected'});
 const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(bearer.length<40)return reply(401,{error:'Sign in to Willena first'});
 const key=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY||env.ELEVENLABS_API||env.ELEVENLABS_KEY;
 if(!key)return reply(503,{error:'ElevenLabs key is missing on this deployment'});
 try{
  const auth=await fetch(ROOT+'/auth/v1/user',{headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply(401,{error:'Login expired'});
  const user=await auth.json();
  const p=await fetch(ROOT+'/rest/v1/profiles?select=role,approved&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{
   headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  const profile=p.ok?(await p.json())[0]:null;
  if(!profile||profile.approved!==true||!['student','teacher','admin','owner'].includes(profile.role))return reply(403,{error:'Not authorized'});
  const result=await fetch('https://api.elevenlabs.io/v1/single-use-token/realtime_scribe',{
   method:'POST',headers:{'xi-api-key':key},signal:AbortSignal.timeout(11000)});
  const data=await result.json().catch(()=>null);
  if(!result.ok||typeof data?.token!=='string')return reply(502,{error:'ElevenLabs Scribe token failed ('+result.status+'): '+String(data?.detail?.message||data?.detail||'').slice(0,120)});
  return reply(200,{token:data.token,model:'scribe_v2_realtime'});
 }catch(e){console.warn('ElevenLabs Scribe token',String(e));return reply(502,{error:'Could not start ElevenLabs Scribe'})}
}