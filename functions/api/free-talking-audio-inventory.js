// Free Talking Genius: inventory ALL R2 clips before generating missing audio.
// Authenticated student only; question text/voice keys resolved server-side.
const SCORES='https://fiieuiktlsivwfgyivai.supabase.co';
const SCORES_KEY='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const R2='https://api.willenaenglish.com/.netlify/functions/get_audio_urls';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const keyFor=async(text,model,voice,kind)=>{
 const prefix=kind==='eleven'?'free_talking_elevenlabs_question_mp3_v1':'free_talking_realtime_question_wav_v1';
 const encoded=[prefix,model,voice,'natural_voice_1',text.trim()].join('|');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(encoded));
 const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return (kind==='eleven'?'ft_eleven_v1_':'ft_realtime_v1_')+hex.slice(0,32);
};
async function verify(request){
 const token=(request.headers.get('Authorization')||'').replace(/^Bearer\s+/i,'').trim();
 if(token.length<40)return false;
 const headers={apikey:SCORES_KEY,Authorization:'Bearer '+token};
 const userRes=await fetch(SCORES+'/auth/v1/user',{headers,cache:'no-store',signal:AbortSignal.timeout(10000)});
 if(!userRes.ok)return false;
 const user=await userRes.json().catch(()=>null);
 if(!UUID.test(user?.id||''))return false;
 const roleRes=await fetch(SCORES+'/rest/v1/profiles?select=role,approved&id=eq.'+user.id+'&limit=1',{
  headers,cache:'no-store',signal:AbortSignal.timeout(9000)});
 if(!roleRes.ok)return false;
 const profiles=await roleRes.json().catch(()=>[]);
 return profiles?.[0]?.role==='student'&&profiles[0]?.approved===true;
}
async function batchExists(keys,format){
 if(!keys.length)return {};
 const res=await fetch(R2,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({words:keys,format,strict:true}),cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error('R2 inventory HTTP '+res.status);
 const data=await res.json().catch(()=>null);
 const results=data?.results;
 if(!results||typeof results!=='object')throw Error('R2 inventory response missing');
 for(const key of keys)if(typeof results[key]?.exists!=='boolean')throw Error('R2 inventory incomplete');
 return results;
}
export async function onRequestPost({request,env}){
 try{
  if(!await verify(request))return json(401,{success:false,error:'Student sign-in required'});
  const body=await request.json().catch(()=>null);
  const ids=[...new Set(Array.isArray(body?.question_ids)?body.question_ids:[])];
  if(!ids.length||ids.length>100||ids.some(id=>!UUID.test(id)))
   return json(400,{success:false,error:'Invalid question inventory request'});
  const res=await fetch(CONTENT+'/rest/v1/free_talking_questions?select=id,book_id,question_en,is_published&id=in.('+ids.join(',')+')&is_published=eq.true&limit=100',{
   headers:{apikey:CONTENT_KEY,Authorization:'Bearer '+CONTENT_KEY},
   cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('Content database inventory failed');
  const questions=await res.json();
  if(!Array.isArray(questions)||questions.length!==ids.length)throw Error('Some published questions were unavailable');
  const model=env.FREE_TALKING_REALTIME_MODEL||'gpt-realtime-2.1-mini';
  const lili=await Promise.all(questions.map(async q=>({id:q.id,key:await keyFor(q.question_en,'eleven_v3','M7zl2TS7ORAIGUejDfoy','eleven')})));
  const willi=await Promise.all(questions.map(async q=>({id:q.id,key:await keyFor(q.question_en,model,'marin','realtime')})));
  const indexed={};
  // Both voice inventories are checked before the frontend starts synthesis.
  for(const [name,format,rows] of [['bunny-v3','mp3',lili],['marin','wav',willi]]){
   const found=await batchExists(rows.map(row=>row.key),format);
   indexed[name]={};
   for(const row of rows)indexed[name][row.id]={cached:found[row.key].exists,source:'r2_shared'};
  }
  return json(200,{success:true,voices:indexed,questions:questions.length});
 }catch(e){
  console.warn('[Free Talking inventory]',String(e?.message||e).slice(0,150));
  return json(503,{success:false,error:'R2 inventory unavailable; generation paused to prevent duplicate audio charges'});
 }
}
