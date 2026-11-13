// Free Talking: fixed Korean encouragement in the currently selected character voice.
// Strict R2-first: generate only on cache miss, verify put/get before serving audio.
const BASE='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const TEXT='I couldn’t hear you. Could you speak a little louder?';
const LILI_ID='M7zl2TS7ORAIGUejDfoy';
const PIGFISH_ID='W7UbuMY4ypluqgZS2UzT';
const WILLY_ID='0yhUIig4twaXoIhuQoCQ';
const STORAGE='https://get-audio-urls.willena.workers.dev/free-talking-store';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function student(request){
 const token=String(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return false;
 const headers={apikey:KEY,Authorization:'Bearer '+token};
 const r=await fetch(BASE+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(9000)});
 const user=r.ok?await r.json().catch(()=>null):null;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(user?.id||'')))return false;
 const p=await fetch(BASE+'/rest/v1/profiles?select=role,approved&id=eq.'+user.id+'&limit=1',{headers,cache:'no-store',signal:AbortSignal.timeout(9000)});
 const rows=p.ok?await p.json().catch(()=>[]):[];
 return rows?.[0]?.role==='student'&&rows[0].approved===true;
}
async function storage(request,body){
 const r=await fetch(STORAGE,{method:'POST',headers:{Authorization:request.headers.get('Authorization')||'','Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(20000)});
 const data=await r.json().catch(()=>null);
 if(!r.ok||data?.success!==true)throw Error('R2_STORE_'+String(data?.code||r.status));
 return data;
}
async function keyFor(voice){
 const model=voice==='marin'?'gpt-4o-mini-tts':'eleven_v3';
 const voiceId=voice==='marin'?'marin':voice==='pigfish'?PIGFISH_ID:voice==='willy'?WILLY_ID:LILI_ID;
 const source=['free_talking_retry_v1',model,voiceId,TEXT].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
 const key='ft_retry_v1_'+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('').slice(0,32);
 return {key,model,voiceId};
}
function b64(bytes){
 const b=new Uint8Array(bytes);let result='';
 for(let i=0;i<b.length;i+=8192)result+=String.fromCharCode(...b.subarray(i,i+8192));
 return btoa(result);
}
async function synthesize(voice,env){
 if(voice==='bunny-v3'||voice==='pigfish'||voice==='willy'){
  const elevenId=voice==='pigfish'?PIGFISH_ID:voice==='willy'?WILLY_ID:LILI_ID;
  const key=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY;
  const settings={stability:0.5};
  if(!key){
   const proxy=await fetch('https://willenaenglish.netlify.app/.netlify/functions/eleven_labs_proxy',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text:TEXT,voice_id:elevenId,model_id:'eleven_v3',voice_settings:settings}),
    signal:AbortSignal.timeout(35000)});
   const result=proxy.ok?await proxy.json().catch(()=>null):null;
   if(typeof result?.audio!=='string')throw Error('ElevenLabs proxy unavailable');
   return result.audio;
  }
  const response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+elevenId+'?output_format=mp3_44100_128',{
   method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
   body:JSON.stringify({text:TEXT,model_id:'eleven_v3',voice_settings:settings}),
   signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('ElevenLabs TTS '+response.status);
  return b64(await response.arrayBuffer());
 }
 const key=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
 if(!key)throw Error('OpenAI voice key missing');
 const response=await fetch('https://api.openai.com/v1/audio/speech',{
  method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
  body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'marin',input:TEXT,response_format:'mp3',
   instructions:'Say this short English encouragement warmly and naturally to a young English learner. Speak clearly, in English only, without adding anything.'}),
  signal:AbortSignal.timeout(25000)});
 if(!response.ok)throw Error('OpenAI TTS '+response.status);
 return b64(await response.arrayBuffer());
}
export async function onRequestPost({request,env}){
 try{
  if(!await student(request))return reply(401,{success:false,error:'Student login required'});
  const body=await request.json().catch(()=>null);
  const voice=String(body?.voice||'');
  if(!['marin','bunny-v3','pigfish','willy'].includes(voice))return reply(400,{success:false,error:'Unknown character voice'});
  const {key,model,voiceId}=await keyFor(voice);
  // Fetch saved R2 clip before making any billable TTS request.
  const cached=await storage(request,{action:'get',key,format:'mp3'});
  if(cached.found===true&&typeof cached.audio==='string'&&cached.audio.length>650)
   return reply(200,{success:true,voice,audio:cached.audio,content_type:'audio/mpeg',stored:true,source:'r2'});
  // R2 must be working and must confirm storage before we advertise ready.
  const audio=await synthesize(voice,env);
  if(typeof audio!=='string'||audio.length<650||audio.length>1680000)throw Error('Invalid TTS audio');
  const put=await storage(request,{action:'put',key,format:'mp3',audio,variant:'retry',model,voice:voiceId});
  if(put.stored!==true)throw Error('R2 write not verified');
  const verified=await storage(request,{action:'get',key,format:'mp3'});
  if(verified.found!==true||typeof verified.audio!=='string'||verified.audio.length<650)throw Error('R2 readback failed');
  return reply(200,{success:true,voice,audio:verified.audio,content_type:'audio/mpeg',stored:true,source:'r2_saved'});
 }catch(e){
  console.warn('[Free Talking retry voice] cache or generation unavailable',String(e?.message||e).slice(0,130));
  return reply(503,{success:false,error:'Encouragement voice is not ready in R2'});
 }
}
