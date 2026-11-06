// Free Talking: preload the fixed quiet-audio encouragement for both characters.
// Server returns audio only after verifying the clip is saved to shared R2.
export function createFreeTalkingRetryVoice({getToken,onFinished}){
 const voices=['marin','bunny-v3'];
 const files=new Map(),inflight=new Map(),attempted=new Set();
 let sound=null,disposed=false;
 const status={marin:'not_loaded','bunny-v3':'not_loaded'};
 const parseAudio=base64=>{
  const binary=atob(base64),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes],{type:'audio/mpeg'}));
 };
 async function preload(voice){
  if(disposed||!voices.includes(voice))return false;
  if(files.has(voice))return true;
  if(inflight.has(voice))return inflight.get(voice);
  if(attempted.has(voice))return false; // no endless paid retry loops on a broken provider
  attempted.add(voice);status[voice]='loading';
  const work=(async()=>{
   try{
    const send=async token=>fetch('/api/free-talking-retry-voice',{
     method:'POST',credentials:'include',cache:'no-store',
     headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({voice}),signal:AbortSignal.timeout(85000)});
    let response=await send(await getToken());
    if(response.status===401)response=await send(await getToken(true));
    const body=await response.json().catch(()=>null);
    if(!response.ok||body?.success!==true||body.stored!==true||!body.audio)
     throw Error(body?.error||'R2 encouragement unavailable');
    if(body.voice!==voice)throw Error('Voice mismatch');
    if(disposed)return false;
    const url=parseAudio(body.audio);
    files.set(voice,url);
    status[voice]='ready';
    return true;
   }catch(error){
    status[voice]='unavailable';
    console.warn('[Free Talking] Encouragement preload',voice,String(error?.message||error).slice(0,100));
    return false;
   }
  })().finally(()=>inflight.delete(voice));
  inflight.set(voice,work);
  return work;
 }
 function preloadBoth(){for(const voice of voices)void preload(voice)}
 async function play(voice){
  if(disposed||!voices.includes(voice))return false;
  stop();
  if(!await preload(voice)||disposed)return false;
  const audio=new Audio(files.get(voice));
  audio.preload='auto';
  sound=audio;
  audio.addEventListener('ended',()=>{if(sound===audio){sound=null;onFinished?.()}},{once:true});
  audio.addEventListener('error',()=>{if(sound===audio){sound=null;onFinished?.()}},{once:true});
  try{await audio.play();return true}
  catch(error){
   if(sound===audio){sound=null;onFinished?.()}
   console.warn('[Free Talking] Encouragement audio blocked',String(error?.name||error));
   return false;
  }
 }
 function stop(){
  if(sound){try{sound.pause();sound.currentTime=0}catch{}sound=null}
 }
 function destroy(){disposed=true;stop();for(const url of files.values())URL.revokeObjectURL(url);files.clear()}
 return {preload,preloadBoth,play,stop,destroy,status};
}
