// Five character-specific review-bridge clips per voice, using shared R2 audio storage.
// Generated on first authenticated warm-up and reused; NEVER scores student speech.
const SCORE='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const STORE='https://get-audio-urls.willena.workers.dev/free-talking-store';
const VOICES={willi:'marin',bunny:'M7zl2TS7ORAIGUejDfoy',pigfish:'W7UbuMY4ypluqgZS2UzT'};
const LINES={
 willi:[
  "That was a great chat! Let's see how you did.",
  "We've reached the end of our chat. I'll check how we did!",
  "Thanks for talking with me! Let's look at your results.",
  "I enjoyed our chat. Let's find out how you did today!",
  "That's all for now! Let's see how our conversation went."
 ],
 bunny:[
  "Zoom! Our chat is finished! Let's see how you did!",
  "That was fun! Bunny Fox is checking your conversation!",
  "Time for a little space break! Let's see your results!",
  "We've reached the finish line! Let's see how you did!",
  "Our space chat is done for now! Time to see your results!"
 ],
 pigfish:[
  "Splash! That's our chat for today! Let's see how you did!",
  "Oink, oink! Time to check our silly little chat!",
  "Well, my fins need a break! Let's look at your results!",
  "That was a fun swim! Let's see how you did!",
  "Bubble time! Our chat is done. Let's see your results!"
 ]
};
const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
const b64=bytes=>{const a=new Uint8Array(bytes);let out='';for(let i=0;i<a.length;i+=8192)out+=String.fromCharCode(...a.subarray(i,i+8192));return btoa(out)};
async function store(token,body){
 const response=await fetch(STORE,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(13000)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.success)throw Error('R2 store unavailable ('+(data.code||response.status)+')');
 return data;
}
export async function onRequestPost({request,env}){
 const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin)return reply(403,{error:'Invalid origin'});
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/,'').trim();
 if(token.length<40)return reply(401,{error:'Student sign-in required'});
 let input;try{input=await request.json()}catch{return reply(400,{error:'Invalid JSON'})}
 const character=String(input?.character||'').toLowerCase(),index=Number(input?.index);
 const questionId=String(input?.question_id||'');
 if(!Object.hasOwn(LINES,character)||!Number.isInteger(index)||index<0||index>=5||
  !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(questionId))return reply(400,{error:'Invalid goodbye selection'});
 try{
  const auth={apikey:PUB,Authorization:'Bearer '+token};
  const userRes=await fetch(SCORE+'/auth/v1/user',{headers:auth,signal:AbortSignal.timeout(8000)});
  if(!userRes.ok)return reply(401,{error:'Sign in again'});
  const user=await userRes.json();
  const profileRes=await fetch(SCORE+'/rest/v1/profiles?select=role,approved&id=eq.'+user.id+'&limit=1',{headers:auth,signal:AbortSignal.timeout(8000)});
  const profile=profileRes.ok?(await profileRes.json())[0]:null;
  if(!profile||profile.approved!==true||!['student','teacher','admin','owner'].includes(profile.role))return reply(403,{error:'Not approved'});
  const questionRes=await fetch(CONTENT+'/rest/v1/free_talking_questions?select=id&id=eq.'+questionId+'&is_published=eq.true&limit=1',
   {headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},signal:AbortSignal.timeout(9000)});
  if(!questionRes.ok||!(await questionRes.json())[0])return reply(404,{error:'Published unit question unavailable'});
  const text=LINES[character][index];
  const voice=VOICES[character],model=character==='willi'?'gpt-4o-mini-tts':'eleven_v3';
  // Use the same key family and variant types already accepted by the shared
  // R2 audio worker; unique salted digest keeps outros separate from questions.
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('review-outro-v1|'+character+'|'+index+'|'+text+'|'+model+'|'+voice));
  const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  const key=(character==='willi'?'ft_fallback_v1_':'ft_eleven_v1_')+hex.slice(0,32);
  const storageVariant=character==='willi'?'fallback':'elevenlabs';
  try{
   const cached=await store(token,{action:'get',key,format:'mp3'});
   if(cached.found&&cached.audio)return reply(200,{success:true,character,index,text,audio:cached.audio,source:'r2',stored:true});
  }catch(e){console.warn('[FT outro] R2 read',String(e))}
  let audio;
  if(character==='willi'){
   const apiKey=env.OPENAI_API_KEY||env.OPENAI_API||env.OPENAI_KEY;
   if(!apiKey)return reply(503,{error:'Willi voice not configured'});
   const response=await fetch('https://api.openai.com/v1/audio/speech',{method:'POST',
    headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
    body:JSON.stringify({model,voice,input:text,response_format:'mp3',speed:1.04}),signal:AbortSignal.timeout(25000)});
   if(!response.ok)return reply(502,{error:'Willi goodbye audio unavailable'});
   audio=await response.arrayBuffer();
  }else{
   // Same voice IDs and same Netlify fallback as the existing working
   // Free Talking ElevenLabs route (preview envs can omit provider keys).
   const key=env.ELEVEN_LABS_API_KEY||env.ELEVENLABS_API_KEY||env.ELEVENLABS_API||env.ELEVENLABS_KEY;
   const settings={stability:0.5,similarity_boost:0.8,use_speaker_boost:false};
   if(key){
    try{
     const direct=await fetch('https://api.elevenlabs.io/v1/text-to-speech/'+encodeURIComponent(voice)+'?output_format=mp3_44100_128',{
      method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json','Accept':'audio/mpeg'},
      body:JSON.stringify({text,model_id:model,voice_settings:settings}),signal:AbortSignal.timeout(24000)});
     if(direct.ok)audio=await direct.arrayBuffer();
    }catch(e){console.warn('[FT outro] direct voice error',String(e).slice(0,80))}
   }
   if(!audio){
    const fallback=await fetch('https://willenaenglish.netlify.app/.netlify/functions/eleven_labs_proxy',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({text,voice_id:voice,model_id:model,voice_settings:settings}),signal:AbortSignal.timeout(30000)});
    if(!fallback.ok)return reply(502,{error:'Character goodbye voice unavailable'});
    const payload=await fallback.json().catch(()=>({}));
    if(typeof payload.audio!=='string')return reply(502,{error:'Character goodbye voice returned no recording'});
    const binary=atob(payload.audio),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    audio=bytes.buffer;
   }
  }
  if(audio.byteLength<500||audio.byteLength>1200000)return reply(502,{error:'Invalid goodbye recording'});
  const encoded=b64(audio);
  let stored=false,storage_error=null;
  try{
   const saved=await store(token,{action:'put',key,audio:encoded,format:'mp3',question_id:questionId,model,voice,variant:storageVariant});
   stored=!!saved.stored;
  }catch(e){storage_error=String(e.message||e).slice(0,110);console.warn('[FT outro] R2 write',storage_error)}
  return reply(200,{success:true,character,index,text,audio:encoded,source:stored?'generated_r2':'generated_not_cached',stored,storage_error});
 }catch(e){console.warn('[FT outro]',String(e));return reply(502,{error:'Goodbye audio unavailable'})}
}
