// Free Talking: one fixed child-friendly low-volume retry phrase.
// Authenticated, no arbitrary user text, voice constrained to the two active characters.
const BASE='https://fiieuiktlsivwfgyivai.supabase.co';
const KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const TEXT='잘 안 들렸어! 조금 더 크게 말해 줄래?';
const LILI_ID='M7zl2TS7ORAIGUejDfoy';
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function student(request){
 const token=String(request.headers.get('Authorization')||'').replace(/^Bearer\\s+/i,'').trim();
 if(token.length<40)return false;
 const headers={apikey:KEY,Authorization:'Bearer '+token};
 const r=await fetch(BASE+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(9000)});
 const user=r.ok?await r.json().catch(()=>null):null;
 if(!/^[0-9a-f-]{36}$/i.test(String(user?.id||'')))return false;
 const p=await fetch(BASE+'/rest/v1/profiles?select=role,approved&id=eq.'+user.id+'&limit=1',{headers,cache:'no-store',signal:AbortSignal.timeout(9000)});
 const rows=p.ok?await p.json().catch(()=>[]):[];
 return rows?.[0]?.role==='student'&&rows[0].approved===true;
}
export async function onRequestPost({request,env}){
 try{
  if(!await student(request))return reply(401,{success:false,error:'Student login required'});
  const data=await request.json().catch(()=>null);
  const voice=String(data?.voice||'');
  if(!['marin','bunny-v3'].includes(voice))return reply(400,{success:false,error:'Unknown character voice'});
  let response;
  if(voice==='bunny-v3'){
   const key=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY;
   const settings={stability:0.5};
   if(key){
    response=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+LILI_ID+'?output_format=mp3_44100_128',{
     method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
     body:JSON.stringify({text:TEXT,model_id:'eleven_v3',voice_settings:settings}),signal:AbortSignal.timeout(30000)});
   }else{
    const proxy=await fetch('https://willenaenglish.netlify.app/.netlify/functions/eleven_labs_proxy',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({text:TEXT,voice_id:LILI_ID,model_id:'eleven_v3',voice_settings:settings}),signal:AbortSignal.timeout(35000)});
    const body=proxy.ok?await proxy.json().catch(()=>null):null;
    if(!body?.audio)return reply(502,{success:false,error:'Voice unavailable'});
    return reply(200,{success:true,voice,audio:body.audio,content_type:'audio/mpeg'});
   }
  }else{
   const key=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
   if(!key)return reply(503,{success:false,error:'Voice unavailable'});
   response=await fetch('https://api.openai.com/v1/audio/speech',{
    method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
    body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'marin',input:TEXT,response_format:'mp3',
     instructions:'Speak this brief Korean encouragement gently and warmly to a young student. Do not add other words.'}),
    signal:AbortSignal.timeout(25000)});
  }
  if(!response?.ok)return reply(502,{success:false,error:'Voice unavailable'});
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<500||bytes.byteLength>1200000)return reply(502,{success:false,error:'Invalid voice audio'});
  const uint=new Uint8Array(bytes);
  let encoded='';
  for(let i=0;i<uint.length;i+=8192)encoded+=String.fromCharCode(...uint.subarray(i,i+8192));
  return reply(200,{success:true,voice,audio:btoa(encoded),content_type:'audio/mpeg'});
 }catch(e){
  console.warn('[Free Talking retry voice] unavailable',String(e?.message||e).slice(0,100));
  return reply(503,{success:false,error:'Voice unavailable'});
 }
}
