// Demo-only authenticated ElevenLabs v3 Conversational TTS proxy.
// The existing Free Talking Genius endpoints and files are untouched.
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const VOICES={willi:'marin',bunny:'M7zl2TS7ORAIGUejDfoy',pigfish:'W7UbuMY4ypluqgZS2UzT'};
const reply=(status,message)=>new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return reply(403,'Invalid origin');
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,'JSON required');
 const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(bearer.length<40)return reply(401,'Sign in first');
 let data;try{data=await request.json()}catch{return reply(400,'Invalid request')}
 const character=String(data?.character||''),sentence=String(data?.text||'').trim();
 // Match the ElevenLabs model used to cache this character's textbook questions.
 // Never substitute an OpenAI voice for Bunny or Pigfish.
 const selectedModel={id:'eleven_v3'};
 if(!Object.hasOwn(VOICES,character)||sentence.length<2||sentence.length>350)return reply(400,'Invalid voice or response length');
 const key=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY||env.ELEVENLABS_API||env.ELEVENLABS_KEY;
 // Preserve the proven production Cloudflare-first, Netlify-fallback routes.
 try{
  const auth=await fetch(ROOT+'/auth/v1/user',{headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply(401,'Session expired');
  const user=await auth.json();
  const p=await fetch(ROOT+'/rest/v1/profiles?select=role,approved&id=eq.'+encodeURIComponent(user.id)+'&limit=1',{
   headers:{apikey:PUB,Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(8000)});
  const profile=p.ok?(await p.json())[0]:null;
  if(!profile||profile.approved!==true||!['student','teacher','admin','owner'].includes(profile.role))return reply(403,'Not authorized');
  if(character==='willi'){
   const openaiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
   if(!openaiKey)return reply(503,'OpenAI speech is not configured');
   const speech=await fetch('https://api.openai.com/v1/audio/speech',{
    method:'POST',headers:{Authorization:'Bearer '+openaiKey,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'marin',input:sentence,response_format:'mp3',speed:1.04}),
    signal:AbortSignal.timeout(25000)
   });
   if(!speech.ok||!speech.body)return reply(502,'AI Willi speech unavailable ('+speech.status+')');
   return new Response(speech.body,{status:200,headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Willena-TTS-Route':'openai-marin','X-Content-Type-Options':'nosniff'}});
  }
  const voiceId=VOICES[character];
  const voiceSettings={stability:0.5,similarity_boost:0.8,use_speaker_boost:false};
  if(key){
   const upstream=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voiceId)+'/stream?output_format=mp3_44100_128',{
    method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
    body:JSON.stringify({text:sentence,model_id:selectedModel.id,voice_settings:voiceSettings}),
    signal:AbortSignal.timeout(24000)
   });
   if(!upstream.ok||!upstream.body){console.warn('ElevenLabs TTS',selectedModel.id,upstream.status);return reply(502,'ElevenLabs '+selectedModel.id+' HTTP '+upstream.status)}
   return new Response(upstream.body,{status:200,headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Willena-TTS':selectedModel.id,'X-Willena-TTS-Route':'direct'}});
  }
  // Preview deployments often lack the Cloudflare ElevenLabs key. Reuse the
  // EXACT previous proxy service already used in functions/api/free-talking-audio.js.
  const fallback=await fetch('https://willenaenglish.netlify.app/.netlify/functions/eleven_labs_proxy',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({text:sentence,voice_id:voiceId,model_id:selectedModel.id,voice_settings:voiceSettings}),
   signal:AbortSignal.timeout(30000)
  });
  if(!fallback.ok){console.warn('ElevenLabs proxy',fallback.status);return reply(502,'ElevenLabs fallback HTTP '+fallback.status)}
  const payload=await fallback.json().catch(()=>null);
  if(typeof payload?.audio!=='string')return reply(502,'ElevenLabs fallback did not return audio');
  const bytes=Uint8Array.from(atob(payload.audio),c=>c.charCodeAt(0));
  if(bytes.length<500||bytes.length>1200000)return reply(502,'Invalid ElevenLabs audio');
  return new Response(bytes,{status:200,headers:{'Content-Type':'audio/mpeg','Content-Length':String(bytes.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Willena-TTS':selectedModel.id,'X-Willena-TTS-Route':'netlify-fallback'}});
 }catch(error){console.warn('ElevenLabs realtime demo error',String(error));return reply(502,'Speech connection failed')}
}
