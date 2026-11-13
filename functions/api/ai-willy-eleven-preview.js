// Teacher-only AI Willy ElevenLabs v3 audition. No R2, voice configuration or student writes.
const SUPA='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const ID='0yhUIig4twaXoIhuQoCQ';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond=(code,body)=>new Response(JSON.stringify(body),{status:code,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function isTeacher(request){
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return false;
 const headers={apikey:PUB,Authorization:'Bearer '+token};
 const r=await fetch(SUPA+'/auth/v1/user',{headers,signal:AbortSignal.timeout(9000)});
 const user=r.ok?await r.json().catch(()=>null):null;
 if(!UUID.test(user?.id||''))return false;
 const p=await fetch(SUPA+'/rest/v1/profiles?select=role&id=eq.'+user.id+'&limit=1',{headers,signal:AbortSignal.timeout(9000)});
 const role=p.ok?(await p.json().catch(()=>[]))?.[0]?.role:null;
 return ['teacher','admin'].includes(String(role||'').toLowerCase());
}
const b64=buffer=>{let value='';const b=new Uint8Array(buffer);for(let i=0;i<b.length;i+=8192)value+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(value)};
export async function onRequestPost({request,env}){
 try{
  if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return respond(403,{success:false,error:'Invalid origin'});
  if(!await isTeacher(request))return respond(403,{success:false,error:'Teacher sign-in required'});
  const data=await request.json().catch(()=>null);
  if(!data||typeof data!=='object')return respond(400,{success:false,error:'Invalid input'});
  const text=String(data.text||'').trim();
  if(text.length<2||text.length>250)return respond(400,{success:false,error:'Use between 2 and 250 characters'});
  // Eleven v3 stability is tested at the supported creative / natural / robust presets.
  const stability=Number(data.stability);
  const similarity=Number(data.similarity),style=Number(data.style);
  const format=String(data.format||'mp3_44100_128');
  if(![0,0.5,1].includes(stability)||!Number.isFinite(similarity)||similarity<0||similarity>1||
    !Number.isFinite(style)||style<0||style>1||!['mp3_44100_128','mp3_44100_192'].includes(format))
    return respond(400,{success:false,error:'Invalid voice settings'});
  const settings={stability,similarity_boost:similarity,style,use_speaker_boost:data.boost===true};
  const key=String(env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY||'').trim();
  const payload={text,model_id:'eleven_v3',voice_settings:settings};
  let buffer=null,provider='';
  if(key.startsWith('sk_')){
   const r=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+ID+'?output_format='+format,{
    method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
    body:JSON.stringify(payload),signal:AbortSignal.timeout(32000)});
   if(r.ok){buffer=await r.arrayBuffer();provider='Cloudflare direct'}
   else {const d=await r.json().catch(()=>null);return respond(502,{success:false,error:'ElevenLabs HTTP '+r.status+': '+String(d?.detail?.message||d?.detail?.status||'Check voice settings').slice(0,150)})}
  }else{
   // The established Netlify bridge has the provider secret on preview projects.
   const r=await fetch('https://willenaenglish.netlify.app/.netlify/functions/eleven_labs_proxy',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text,voice_id:ID,model_id:'eleven_v3',voice_settings:settings}),
    signal:AbortSignal.timeout(36000)});
   if(!r.ok)return respond(502,{success:false,error:'ElevenLabs proxy HTTP '+r.status});
   const d=await r.json().catch(()=>null);
   if(typeof d?.audio!=='string')throw Error('Proxy returned no preview audio');
   buffer=Uint8Array.from(atob(d.audio),c=>c.charCodeAt(0)).buffer;provider='Netlify bridge';
  }
  const b=new Uint8Array(buffer);
  if(b.length<500||b.length>1250000||!((b[0]===73&&b[1]===68&&b[2]===51)||(b[0]===255&&(b[1]&224)===224)))throw Error('Invalid MP3 from provider');
  return respond(200,{success:true,audio:b64(buffer),mime:'audio/mpeg',provider,settings,format:provider==='Netlify bridge'?'mp3_44100_128':format});
 }catch(e){return respond(503,{success:false,error:String(e?.message||e).slice(0,160)})}
}
