// Demo-only authenticated ElevenLabs Flash streaming proxy.
// The existing Free Talking Genius endpoints and files are untouched.
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const VOICES={bunny:'M7zl2TS7ORAIGUejDfoy',pigfish:'W7UbuMY4ypluqgZS2UzT'};
const reply=(status,message)=>new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return reply(403,'Invalid origin');
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,'JSON required');
 const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(bearer.length<40)return reply(401,'Sign in first');
 let data;try{data=await request.json()}catch{return reply(400,'Invalid request')}
 const character=String(data?.character||''),sentence=String(data?.text||'').trim();
 if(!Object.hasOwn(VOICES,character)||sentence.length<2||sentence.length>350)return reply(400,'Invalid voice or response length');
 const key=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY||env.ELEVENLABS_API||env.ELEVENLABS_KEY;
 if(!key)return reply(503,'ElevenLabs key not configured');
 try{
  const auth=await fetch(ROOT+'/auth/v1/user',{headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply(401,'Session expired');
  const user=await auth.json();
  const p=await fetch(ROOT+'/rest/v1/profiles?select=role,approved&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{
   headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  const profile=p.ok?(await p.json())[0]:null;
  if(!profile||profile.approved!==true||!['student','teacher','admin','owner'].includes(profile.role))return reply(403,'Not authorized');
  const upstream=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+VOICES[character]+'/stream?output_format=mp3_44100_128',{
   method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
   body:JSON.stringify({text:sentence,model_id:'eleven_flash_v2_5',voice_settings:{stability:0.5,similarity_boost:0.8,style:0,use_speaker_boost:false,speed:1}}),
   signal:AbortSignal.timeout(24000)
  });
  if(!upstream.ok||!upstream.body){console.warn('ElevenLabs Flash error',upstream.status);return reply(502,'ElevenLabs speech unavailable ('+upstream.status+')')}
  return new Response(upstream.body,{status:200,headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Willena-TTS':'eleven_flash_v2_5'}});
 }catch(error){console.warn('ElevenLabs realtime demo error',String(error));return reply(502,'Speech connection failed')}
}
