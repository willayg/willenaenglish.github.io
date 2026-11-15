// Shared student-header character milestones (all Genius apps).
// Exactly-once acknowledgement lives in the Scores DB, not in localStorage.
// Any signed-in student can earn and celebrate while using any Genius app.
import {charactersInMenu,getCharacter} from '/shared/free-talking-character-catalog.js?v=20261115-p2-b';
import {characterThumbnailMarkup} from '/students/characters-v2/character-runtime.js?v=20261115-unique-svg-resources1';
const ENDPOINT='/api/free-talking-character-unlocks';
const TTS='/api/free-talking-realtime-eleven';
const SCORES='https://fiieuiktlsivwfgyivai.supabase.co';
const PUB='sb_publishable_e-K50PquV9gHdfmefG6tmg_o-vVSl0e';
const earnedCharacters=charactersInMenu().filter(c=>c.unlockPoints>0).sort((a,b)=>a.unlockPoints-b.unlockPoints);
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
 const pointsRes=await fetch(SCORES+'/rest/v1/rpc/student_own_total_points',{
  method:'POST',cache:'no-store',headers:{...headers,'Content-Type':'application/json'},
  body:'{}'});
 if(!pointsRes.ok)throw Error('Checking points failed: '+pointsRes.status);
 const points=Number(await pointsRes.json());
 if(!Number.isFinite(points))throw Error('Points unavailable');
 const saved=await fetch(base+'?select=character&student_id=eq.'+encodeURIComponent(uid),{headers,cache:'no-store'});
 if(!saved.ok)throw Error('Checking past unlocks failed: '+saved.status);
 const celebrated=(await saved.json()).map(x=>x.character);
 const pending=earnedCharacters
  .filter(c=>points>=c.unlockPoints&&!celebrated.includes(c.id))
  .map(c=>c.id);
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
// The shared header's overview is independently fetched from the authenticated
// points endpoint. Use that verified figure when the milestone endpoint is down.
function localKey(uid,character){return 'willena-milestone-seen-v3:'+uid+':'+character}
function hasSeen(uid,character){try{return localStorage.getItem(localKey(uid,character))==='1'}catch{return false}}
function markSeen(uid,character){try{localStorage.setItem(localKey(uid,character),'1')}catch{}}
export async function checkStudentCharacterUnlocks(verifiedPoints=null,verifiedUserId=null){
 if(inProgress||!document.body||document.hidden)return;
 if(Date.now()-lastCheck<1600)return;
 lastCheck=Date.now();inProgress=true;
 try{
  let uid=verifiedUserId;
  if(!uid){
   const token=window.WillenaAPI?.getLocalAccessToken?.();
   if(validToken(token))uid=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).sub;
  }
  if(!/^[a-f0-9-]{36}$/i.test(String(uid||'')))return;
  let pending=[];
  try{
   const res=await request({action:'status'});
   if(!res.ok)throw Error('Unlock status HTTP '+res.status);
   const status=await res.json();
   if(!Array.isArray(status.pending))throw Error('Invalid unlock status');
   pending=status.pending.filter(id=>earnedCharacters.some(c=>c.id===id));
  }catch(e){
   console.warn('[Student unlock] Using verified-header points fallback:',String(e));
   const points=Number(verifiedPoints);
   if(!Number.isFinite(points)||points<100)return;
   pending=earnedCharacters.filter(c=>points>=c.unlockPoints).map(c=>c.id);
  }
  // Celebrate milestones in earned order, only one at a time.
  pending.sort((a,b)=>(getCharacter(a)?.unlockPoints??Infinity)-(getCharacter(b)?.unlockPoints??Infinity));
  for(const character of pending){
   if(!document.body||document.hidden)break;
   if(hasSeen(uid,character))continue;
   const seen=await showOne(character,uid);
   if(!seen)break;
  }
 }catch(e){console.warn('[Student unlock]',e)}
 finally{inProgress=false}
}
async function showOne(character,uid){
 const config=getCharacter(character);
 if(!config||config.unlockPoints<=0)return false;
 const sentences={
  bunny:'Bunny Fox is ready for your next space adventure!',
  pigfish:'Splash! Pigfish is here to practise English with you!',
  dusk:'Well, well... Five thousand points. You found me. Welcome to the shadows!',
  steve:'[surprised] WHAT?! EIGHT THOUSAND POINTS?! YOU HAVE EARNED MY RESPECT, RECRUIT!'
 };
 const sentence=sentences[character]||'A new English friend is ready!';
 const visibleText=sentence.replace(/\[[^\]]+\]\s*/g,'');
 const host=document.createElement('div');
 host.className='willena-student-milestone-host';
 host.style.cssText='position:fixed;inset:0;z-index:2147483646;display:block;isolation:isolate;';
 const root=host.attachShadow({mode:'open'});
 const link=document.createElement('link');link.rel='stylesheet';link.href=styles;
 const fallback=document.createElement('style');
 fallback.textContent=':host{position:fixed;inset:0;display:block;z-index:2147483646}.ft-character-unlock-celebration{position:fixed;inset:0;z-index:3;display:grid;place-items:center;background:#15232be8;padding:16px}.ft-milestone-card{background:#fff;border:5px solid #65ced2;border-radius:22px;padding:22px;max-width:390px;width:100%;text-align:center;display:grid;justify-items:center;gap:10px}.ft-milestone-art{width:170px;height:170px;overflow:hidden;border-radius:50%}.ft-milestone-art svg,.ft-milestone-art img{width:100%;height:100%}.ft-milestone-actions{display:grid;gap:8px;width:100%}.ft-milestone-actions button{min-height:48px}';
 const wrap=document.createElement('section');
 wrap.className='ft-character-unlock-celebration is-'+character;
 wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
 wrap.setAttribute('aria-label',config.name+' unlocked');
 const portrait='<span class="ft-milestone-dusk">'+characterThumbnailMarkup(character,'earned-'+character)+'</span>';
 wrap.innerHTML='<div class="ft-milestone-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>'+
 '<div class="ft-milestone-card"><div class="ft-milestone-eyebrow">NEW CHARACTER UNLOCKED!</div>'+
 '<div class="ft-milestone-art">'+portrait+'</div><h2>'+config.name.toUpperCase()+'</h2>'+
 '<p class="ft-milestone-points">'+config.unlockPoints.toLocaleString('en-US')+' POINTS</p>'+
 '<p class="ft-milestone-quote">'+visibleText+'</p>'+
 '<p class="ft-milestone-korean">새로운 대화 친구가 열렸어요!</p>'+
 '<div class="ft-milestone-actions"><button type="button" class="ft-milestone-listen">🔊 목소리 듣기</button>'+
 '<button type="button" class="ft-milestone-continue">친구 만나기</button></div>'+
 '<p class="ft-milestone-status" role="status" aria-live="polite"></p></div>';
 root.append(fallback,link,wrap);document.body.append(host);
 const listen=wrap.querySelector('.ft-milestone-listen'),next=wrap.querySelector('.ft-milestone-continue'),status=wrap.querySelector('.ft-milestone-status');
 let audio=null,busy=false,done=false,voiceUrl=null,voiceFailure='';
 const stop=()=>{
  if(audio){try{audio.pause();audio.removeAttribute('src');audio.load()}catch{}audio=null}
  if(voiceUrl){URL.revokeObjectURL(voiceUrl);voiceUrl=null}
 };
 async function prepareVoice(){
  if(done||busy||voiceUrl)return;
  busy=true;listen.disabled=true;listen.textContent='🔊 음성 준비 중…';status.textContent='';
  try{
   const r=await request({action:'tts',character,text:sentence});
   if(!r.ok){
    const data=await r.json().catch(()=>null);
    throw Error('HTTP '+r.status+(data?.error?': '+String(data.error).slice(0,120):''));
   }
   const type=r.headers.get('content-type')||'';
   if(!type.includes('audio/'))throw Error('Unexpected speech response ('+type+')');
   const blob=await r.blob();
   if(blob.size<500)throw Error('Empty speech audio');
   if(done)return;
   voiceUrl=URL.createObjectURL(blob);
   audio=new Audio();
   audio.preload='auto';
   audio.src=voiceUrl;
   audio.load();
   audio.onended=()=>{if(!done)listen.textContent='🔊 다시 듣기'};
   listen.textContent='🔊 목소리 듣기';
  }catch(e){
   voiceFailure=String(e?.message||e);
   console.warn('[Character milestone voice]',character,voiceFailure);
   if(!done){
    listen.textContent='🔄 음성 다시 시도';
    status.textContent='음성 서비스 오류 ('+voiceFailure.slice(0,80)+')';
   }
  }finally{busy=false;if(!done)listen.disabled=false}
 }
 function playPrepared(){
  // Playback happens synchronously inside a tap handler: Android browsers
  // otherwise reject audio.play() after the awaited speech API request.
  if(!audio)return;
  try{
   audio.currentTime=0;
   const result=audio.play();
   if(result?.catch)result.catch(e=>{
    if(!done){status.textContent='음성 재생이 차단됐어요. 다시 눌러 주세요.';
     console.warn('[Character milestone playback]',String(e))}
   });
   listen.textContent='🔊 다시 듣기';status.textContent='';
  }catch(e){status.textContent='음성 재생 오류: '+String(e?.message||e).slice(0,60)}
 }
 listen.addEventListener('click',()=>{
  if(done||busy)return;
  if(audio){playPrepared();return}
  void prepareVoice();
 });
 // Fetch the clip on card display but NEVER treat blocked autoplay as a
 // speech-service failure. The first user tap can play an already-loaded MP3.
 // Avoid spending credits before a student explicitly requests the voice.
 next.focus();
 return await new Promise(resolve=>{
  next.addEventListener('click',async()=>{
   if(done||next.disabled)return;
   next.disabled=true;next.textContent='저장 중…';
   try{
    const r=await request({action:'claim',character});
    if(!r.ok)throw Error('Claim HTTP '+r.status);
   }catch(e){
    // The milestone is a display acknowledgement, not an award of points or
    // character access. Persist locally if the sync service is unavailable.
    console.warn('[Student unlock] Remote acknowledgement deferred:',String(e));
   }
   markSeen(uid,character);
   done=true;stop();host.remove();resolve(true);
  });
  const close=()=>{
   if(done)return;done=true;stop();host.remove();resolve(false);
  };
  // Do not permanently obscure a new page after navigation or account change.
  window.addEventListener('pagehide',close,{once:true});
 });
}
