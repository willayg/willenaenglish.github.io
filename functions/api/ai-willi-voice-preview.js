// Read-only teacher voice audition. A single fixed phrase; no student or R2 writes.
// API key remains server-side. Each new model+voice choice can incur a small API charge.
const SUPA='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY='sb_publishable_G-FYhHfDL4OGdL892gY1Zg_epdbEeqO';
const WORKER='https://get-audio-urls.willena.workers.dev/free-talking-store';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VOICES={
 lili:{model:'eleven_v3',voice:'M7zl2TS7ORAIGUejDfoy',variant:'elevenlabs',prefix:'ft_eleven_v1_',tag:'free_talking_elevenlabs_question_mp3_v1'},
 pigfish:{model:'eleven_v3',voice:'W7UbuMY4ypluqgZS2UzT',variant:'elevenlabs',prefix:'ft_eleven_v1_',tag:'free_talking_elevenlabs_question_mp3_v1'},
 willi_mp3:{model:'gpt-4o-mini-tts',voice:'marin',variant:'fallback',prefix:'ft_fallback_v1_',tag:'free_talking_legacy_fallback_mp3_v1'}
};
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function teacher(request){
 const token=String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return null;
 const headers={apikey:KEY,Authorization:'Bearer '+token};
 const user=await fetch(SUPA+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!user.ok)return null;
 const info=await user.json().catch(()=>null);
 if(!UUID.test(info?.id||''))return null;
 const role=await fetch(SUPA+'/rest/v1/profiles?select=role&id=eq.'+info.id+'&limit=1',{
  headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!role.ok)return null;
 const profile=(await role.json().catch(()=>[]))?.[0];
 return ['teacher','admin'].includes(String(profile?.role||'').toLowerCase())?{id:info.id,token}:null;
}

const PHRASE="Hello, my name is AI Willi. I'm here to help you learn English!";
const MODELS=new Set(['gpt-4o-mini-tts','gpt-4o-mini-tts-2025-12-15','tts-1','tts-1-hd']);
const VOICE_IDS=new Set(['alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer','verse','marin','cedar']);
export async function onRequestPost({request,env}){
 try {
  const auth=await teacher(request);
  if(!auth)return json(403,{success:false,error:'Teacher or admin sign-in required'});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body!=='object')return json(400,{success:false,error:'Invalid request'});
  const model=String(body.model||''),voice=String(body.voice||'');
  if(!MODELS.has(model)||!VOICE_IDS.has(voice))return json(400,{success:false,error:'Unsupported OpenAI speech model or voice'});
  const key=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
  if(!key)return json(503,{success:false,error:'OPENAI_API_KEY not configured on this deployment'});
  const isMini=model.startsWith('gpt-4o-mini-tts');
  const payload={model,voice,input:PHRASE,response_format:'mp3'};
  if(isMini)payload.instructions="Speak clearly in friendly, playful American English, with a cheerful and slightly mischievous character. Natural rhythm, warm and upbeat, not overly high-pitched. Say exactly the provided words.";
  const res=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(40000)});
  if(!res.ok){const detail=await res.json().catch(()=>null);return json(res.status===429?429:502,{success:false,error:'OPENAI_SPEECH_'+res.status+': '+String(detail?.error?.message||'Speech generation failed').slice(0,180)})}
  const buffer=await res.arrayBuffer();if(buffer.byteLength<500||buffer.byteLength>1500000)throw Error('Invalid speech size');
  const bytes=new Uint8Array(buffer);if(!((bytes[0]===73&&bytes[1]===68&&bytes[2]===51)||(bytes[0]===255&&(bytes[1]&224)===224)))throw Error('Invalid MP3 response');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return json(200,{success:true,model,voice,phrase:PHRASE,audio:btoa(binary),mime:'audio/mpeg'});
 }catch(e){return json(503,{success:false,error:String(e?.message||e).slice(0,180)})}
}
