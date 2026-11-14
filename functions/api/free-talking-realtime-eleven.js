// Demo-only authenticated ElevenLabs v3 Conversational TTS proxy.
// The existing Free Talking Genius endpoints and files are untouched.
const ROOT='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const VOICES={willi:'marin',willy:'GSGMGjgDtwaXe25hDMNI',bunny:'M7zl2TS7ORAIGUejDfoy',pigfish:'W7UbuMY4ypluqgZS2UzT',dusk:'0yhUIig4twaXoIhuQoCQ'};
const reply=(status,message)=>new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
export async function onRequestPost({request,env}){
 const origin=request.headers.get('Origin');
 if(origin&&origin!==new URL(request.url).origin)return reply(403,'Invalid origin');
 if(!request.headers.get('content-type')?.startsWith('application/json'))return reply(415,'JSON required');
 const bearer=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(bearer.length<40)return reply(401,'Sign in first');
 let data;try{data=await request.json()}catch{return reply(400,'Invalid request')}
 const character=String(data?.character||''),sentence=String(data?.text||'').trim();
 // AI Willy uses consistent baseline delivery; keep emotion tags supplied by the conversation model.
 // The baseline tags go ONLY to ElevenLabs, not into the visible conversation transcript.
 // Willi 2 uses natural, unprefixed text; preserve model-supplied emotion tags.
 const ttsText=character==='dusk'
  ? sentence.replace(/\[(?:chuckling|laughing|giggles|giggling|surprised|whispering|crying|screaming|bombastic|irish)\]/gi,'').replace(/\s+/g,' ').trim()
  : sentence;
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
  const voiceSettings=character==='dusk'
   ? {stability:0.75,similarity_boost:0.9,use_speaker_boost:false}
   : {stability:0.5,similarity_boost:0.8,use_speaker_boost:false};
  let directError='not-configured';
  if(key){
   try{
    const upstream=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voiceId)+'/stream?output_format=mp3_44100_128',{
     method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
     body:JSON.stringify({text:ttsText,model_id:selectedModel.id,voice_settings:voiceSettings}),
     signal:AbortSignal.timeout(24000)
    });
    if(upstream.ok&&upstream.body)
     return new Response(upstream.body,{status:200,headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Willena-TTS':selectedModel.id,'X-Willena-TTS-Route':'direct'}});
    directError='HTTP '+upstream.status;
    const detail=await upstream.json().catch(()=>null);
    const code=String(detail?.detail?.status||detail?.error?.code||'').slice(0,64);
    console.warn('[Free Talking TTS] direct ElevenLabs failed',upstream.status,code);
   }catch(ex){
    directError=ex?.name==='TimeoutError'?'timeout':'connection-error';
    console.warn('[Free Talking TTS] direct ElevenLabs connection failed',directError);
   }
  }
  // Do not leave the conversation silent after a Cloudflare direct-request
  // failure. The existing Netlify proxy uses independently configured secrets.
  try{
   const fallback=await fetch('https://willenaenglish.netlify.app/.netlify/functions/eleven_labs_proxy',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:ttsText,voice_id:voiceId,model_id:selectedModel.id,voice_settings:voiceSettings}),
    signal:AbortSignal.timeout(30000)
   });
   if(!fallback.ok){
    console.warn('[Free Talking TTS] both paths failed',{direct:directError,fallbackStatus:fallback.status});
    return reply(502,'Voice unavailable (direct '+directError+', backup HTTP '+fallback.status+')');
   }
   const payload=await fallback.json().catch(()=>null);
   if(typeof payload?.audio!=='string')return reply(502,'Voice backup returned no audio (direct '+directError+')');
   const bytes=Uint8Array.from(atob(payload.audio),c=>c.charCodeAt(0));
   if(bytes.length<500||bytes.length>1200000)return reply(502,'Voice backup returned invalid audio');
   return new Response(bytes,{status:200,headers:{'Content-Type':'audio/mpeg','Content-Length':String(bytes.length),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Willena-TTS':selectedModel.id,'X-Willena-TTS-Route':'netlify-fallback'}});
  }catch(ex){
   console.warn('[Free Talking TTS] backup connection failed',{direct:directError,backup:String(ex?.name||'error')});
   return reply(502,'Voice unavailable (direct '+directError+', backup connection failed)');
  }
 }catch(error){console.warn('ElevenLabs realtime demo error',String(error));return reply(502,'Speech connection failed')}
}
