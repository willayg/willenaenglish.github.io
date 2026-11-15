// Shared student-header character milestones (all Genius apps).
// Exactly-once acknowledgement lives in the Scores DB, not in localStorage.
// Any signed-in student can earn and celebrate while using any Genius app.
import {DUSK_ART} from '/students/free-talking-genius/dusk-character.js?v=20261114-no-legacy-card1';
const ENDPOINT='/api/free-talking-character-unlocks';
const TTS='/api/free-talking-realtime-eleven';
const SCORES='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const artSteve='/students/free-talking-genius/steve-portrait.svg?v=20261115-steve-cropfix4';
let inProgress=false, lastCheck=0;
const styles='/students/free-talking-genius/character-unlock-celebrations.css?v=20261115-unlock-cards1';
function validToken(token){
 if(!token||token.split('.').length!==3)return false;
 try{const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
  return Number(claims.exp)*1000>Date.now()+30000;
 }catch{return false}
}
async function studentToken(force=false){
 const api=window.WillenaAPI;
 const cached=api?.getLocalAccessToken?.();
 if(!force&&validToken(cached))return cached;
 // Some students use cookie login with no usable local token. Reuse the
 // exact authenticated refresh path the Free Talking engine already uses.
 const fn=api?.fetch?api.fetch.bind(api):fetch;
 const res=await fn('/.netlify/functions/supabase_auth?action=refresh&_='+Date.now(),{credentials:'include',cache:'no-store'});
 const data=await res.json().catch(()=>null);
 if(!res.ok||!validToken(data?.access_token))throw Error('Student token not available');
 api?.setLocalTokens?.(data.access_token,data.refresh_token||'');
 return data.access_token;
}
// Read and acknowledge unlocks directly through the existing secured Scores
// database. This works across all Genius hosts without depending on a
// Cloudflare /api route that some app domains do not serve.
async function directUnlockRequest(body,token){
 const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
 const uid=claims.sub;
 if(!/^[a-f0-9-]{36}$/i.test(String(uid||'')))throw Error('Missing account identity');
 const headers={apikey:PUB,Authorization:'Bearer '+token};
 const base=SCORES+'/rest/v1/free_talking_character_unlocks';
 if(body.action==='claim'){
  const response=await fetch(base,{method:'POST',cache:'no-store',
   headers:{...headers,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
   body:JSON.stringify({student_id:uid,character:body.character})});
  if(!response.ok)throw Error('Saving unlock failed: '+response.status);
  return {ok:true,json:async()=>({success:true,character:body.character})};
 }
 const pointsRes=await fetch(SCORES+'/rest/v1/rpc/sum_points_for_user',{
  method:'POST',cache:'no-store',headers:{...headers,'Content-Type':'application/json'},
  body:JSON.stringify({uid})});
 if(!pointsRes.ok)throw Error('Checking points failed: '+pointsRes.status);
 const points=Number(await pointsRes.json());
 if(!Number.isFinite(points))throw Error('Points unavailable');
 const saved=await fetch(base+'?select=character&student_id=eq.'+encodeURIComponent(uid),{headers,cache:'no-store'});
 if(!saved.ok)throw Error('Checking past unlocks failed: '+saved.status);
 const celebrated=(await saved.json()).map(x=>x.character);
 const pending=[['dusk',5000],['steve',8000]]
  .filter(([character,min])=>points>=min&&!celebrated.includes(character))
  .map(([character])=>character);
 return {ok:true,json:async()=>({points,celebrated,pending})};
}
async function request(body){
 const token=await studentToken();
 if(body.action!=='tts'){
  try{return await directUnlockRequest(body,token)}
  catch(e){
   console.warn('[Student unlock] Direct Scores API fallback:',String(e));
   // Keep compatibility with the original authenticated Pages endpoint.
  }
 }
 const path=body.action==='tts'?TTS:ENDPOINT;
 const payload=JSON.stringify(body.action==='tts'?{character:body.character,text:body.text}:body);
 const call=jwt=>fetch(path,{method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{Authorization:'Bearer '+jwt,'Content-Type':'application/json'},body:payload});
 let response=await call(token);
 if(response.status===401)response=await call(await studentToken(true));
 return response;
}
export async function checkStudentCharacterUnlocks(){
 if(inProgress||!document.body||document.hidden)return;
 // Small throttle stops duplicate calls from simultaneous points/stars events.
 if(Date.now()-lastCheck<1600)return;
 lastCheck=Date.now();inProgress=true;
 try{
  const res=await request({action:'status'});
  if(!res.ok)return;
  const status=await res.json();
  const pending=Array.isArray(status.pending)?status.pending.filter(c=>c==='dusk'||c==='steve'):[];
  for(const character of pending){
   if(!document.body||document.hidden)break;
   const seen=await showOne(character);
   if(!seen)break;
  }
 }catch(e){console.warn('[Student unlock]',e)}
 finally{inProgress=false}
}
async function showOne(character){
 const steve=character==='steve';
 const sentence=steve
  ? '[surprised] WHAT?! EIGHT THOUSAND POINTS?! YOU HAVE EARNED MY RESPECT, RECRUIT!'
  : 'Well, well... Five thousand points. You found me. Welcome to the shadows!';
 const visibleText=sentence.replace(/\[[^\]]+\]\s*/g,'');
 const host=document.createElement('div');
 host.className='willena-student-milestone-host';
 host.style.cssText='position:fixed;inset:0;z-index:2147483646;display:block;isolation:isolate;';
 const root=host.attachShadow({mode:'open'});
 const link=document.createElement('link');link.rel='stylesheet';link.href=styles;
 const fallback=document.createElement('style');
 fallback.textContent=':host{position:fixed;inset:0;display:block;z-index:2147483646}.ft-character-unlock-celebration{position:fixed;inset:0;z-index:3;display:grid;place-items:center;background:#15232be8;padding:16px}.ft-milestone-card{background:#fff;border:5px solid #65ced2;border-radius:22px;padding:22px;max-width:390px;width:100%;text-align:center;display:grid;justify-items:center;gap:10px}.ft-milestone-art{width:170px;height:170px;overflow:hidden;border-radius:50%}.ft-milestone-art svg,.ft-milestone-art img{width:100%;height:100%}.ft-milestone-actions{display:grid;gap:8px;width:100%}.ft-milestone-actions button{min-height:48px}';
 const wrap=document.createElement('section');
 wrap.className='ft-character-unlock-celebration '+(steve?'is-steve':'is-dusk');
 wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
 wrap.setAttribute('aria-label',(steve?'Sergeant Steve':'Dusk')+' unlocked');
 const portrait=steve?'<img src="'+artSteve+'" alt="Sergeant Steve" draggable="false">':'<span class="ft-milestone-dusk">'+DUSK_ART+'</span>';
 wrap.innerHTML='<div class="ft-milestone-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
 '<div class="ft-milestone-card"><div class="ft-milestone-eyebrow">NEW CHARACTER UNLOCKED!</div>'+
 '<div class="ft-milestone-art">'+portrait+'</div><h2>'+(steve?'SERGEANT STEVE':'DUSK')+'</h2>'+
 '<p class="ft-milestone-points">'+(steve?'8,000':'5,000')+' POINTS</p>'+
 '<p class="ft-milestone-quote">'+visibleText+'</p>'+
 '<p class="ft-milestone-korean">새로운 대화 친구가 열렸어요!</p>'+
 '<div class="ft-milestone-actions"><button type="button" class="ft-milestone-listen">🔊 목소리 듣기</button>'+
 '<button type="button" class="ft-milestone-continue">친구 만나기</button></div>'+
 '<p class="ft-milestone-status" role="status" aria-live="polite"></p></div>';
 root.append(fallback,link,wrap);document.body.append(host);
 const listen=wrap.querySelector('.ft-milestone-listen'),next=wrap.querySelector('.ft-milestone-continue'),status=wrap.querySelector('.ft-milestone-status');
 let audio=null,busy=false,done=false;
 const stop=()=>{if(audio){audio.pause();URL.revokeObjectURL(audio.src);audio=null}};
 async function play(){
  if(done||busy)return;busy=true;listen.disabled=true;listen.textContent='🔊 준비 중…';
  try{
   stop();
   const r=await request({action:'tts',character,text:sentence});
   if(!r.ok)throw Error('TTS HTTP '+r.status);
   const blob=await r.blob();if(done)return;
   if(blob.size<500)throw Error('Empty voice');
   audio=new Audio();audio.src=URL.createObjectURL(blob);
   await audio.play();listen.textContent='🔊 다시 듣기';status.textContent='';
  }catch(e){if(!done){listen.textContent='🔊 다시 듣기';status.textContent='음성을 재생할 수 없어요. 다시 듣기를 눌러 주세요.'}}
  finally{busy=false;if(!done)listen.disabled=false}
 }
 listen.addEventListener('click',()=>void play());
 // Mobile autoplay is best effort; students can always tap Replay.
 void play();
 next.focus();
 return await new Promise(resolve=>{
  next.addEventListener('click',async()=>{
   if(done||next.disabled)return;
   next.disabled=true;next.textContent='저장 중…';
   try{
    const r=await request({action:'claim',character});
    if(!r.ok)throw Error('Claim HTTP '+r.status);
    done=true;stop();host.remove();resolve(true);
   }catch(e){
    next.disabled=false;next.textContent='다시 시도';
    status.textContent='잠금 해제 기록을 저장하지 못했어요. 다시 시도해 주세요.';
   }
  });
  const close=()=>{
   if(done)return;done=true;stop();host.remove();resolve(false);
  };
  // Do not permanently obscure a new page after navigation or account change.
  window.addEventListener('pagehide',close,{once:true});
 });
}
