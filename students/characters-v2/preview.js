import {CHARACTER_REGISTRY,registryDiagnostics} from './character-registry.js?v=20261115-modular-p2-2';
import {mountCharacter,characterThumbnailMarkup,validateCharacterAssets} from './character-runtime.js?v=20261115-unique-svg-resources1';
const $=s=>document.querySelector(s);
let current=null;
let characterStage=null;
let effectTimer=null;
let previewAudio=null;
let previewObjectUrl=null;
let previewAbort=null;
const SAMPLES={willi:'Hello! I am Willo. Tell me something interesting about your day!',willy:'[excited] Hello! I am AI Willi. Ready for a brilliant English adventure?',bunny:'[giggles] Hi! Bunny Fox here! Want to fly through space with me?',pigfish:'[laughing] Oink! Splash! I am Pigfish! What is your favourite animal?',dusk:'Good evening. I am Dusk. Tell me, what mysterious thing did you discover today?',steve:'[grumble] GOOD GRIEF, RECRUIT! [shout] ARE YOU READY TO SPEAK ENGLISH?'};
function stopSample(){previewAbort?.abort();previewAbort=null;if(previewAudio){previewAudio.pause();previewAudio.onplay=null;previewAudio.onpause=null;previewAudio.onended=null;previewAudio.onerror=null;previewAudio.removeAttribute('src');previewAudio.load();previewAudio.hidden=true;}previewAudio=null;if(previewObjectUrl)URL.revokeObjectURL(previewObjectUrl);previewObjectUrl=null;characterStage?.setPhase('idle');const button=$('#playVoice');if(button){button.disabled=false;button.textContent='▶ Play voice sample'}}
function jwtValid(token){if(!token||token.split('.').length!==3)return false;try{const c=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));return Number(c.exp)*1000>Date.now()+30000}catch{return false}}
async function teacherPreviewToken(){
 if(window.parent===window)return '';
 const teacherOrigin='https://teachers.willenaenglish.com';
 let parentOrigin='';
 try{parentOrigin=new URL(document.referrer).origin}catch{}
 if(parentOrigin!==teacherOrigin)return '';
 const nonce=crypto.randomUUID();
 return await new Promise(resolve=>{
  let completed=false;
  const finish=value=>{if(completed)return;completed=true;clearTimeout(timer);window.removeEventListener('message',receive);resolve(value)};
  const receive=event=>{
   if(event.origin!==teacherOrigin||event.source!==window.parent)return;
   if(event.data?.type!=='willena:character-preview-token-response'||event.data.nonce!==nonce)return;
   const token=String(event.data.token||'');
   finish(jwtValid(token)?token:'');
  };
  const timer=setTimeout(()=>finish(''),4500);
  window.addEventListener('message',receive);
  window.parent.postMessage({type:'willena:character-preview-token-request',nonce},teacherOrigin);
 });
}
async function previewToken(){
 const gateway=window.WillenaAPI;
 const cached=gateway?.getLocalAccessToken?.();
 if(jwtValid(cached))return cached;
 // The Teachers dashboard has a different origin: ask its embedded host
 // for a one-use bearer, on the Play click only, and never put it in a URL.
 const teacher=await teacherPreviewToken();
 if(teacher)return teacher;
 try{
  const fn=gateway?.fetch?gateway.fetch.bind(gateway):fetch;
  const r=await fn('/.netlify/functions/supabase_auth?action=refresh',{credentials:'include',cache:'no-store'});
  const data=await r.json().catch(()=>({}));
  if(r.ok&&jwtValid(data.access_token)){gateway?.setLocalTokens?.(data.access_token,data.refresh_token||'');return data.access_token}
 }catch{}
 throw Error('No authenticated teacher session available for voice preview. Open the Teachers dashboard and sign in again.');
}
async function playSample(){if(!current||!characterStage)return;stopSample();const character=current.id;const text=$('#sampleSentence').value.trim();if(text.length<2||text.length>300){$('#voiceStatus').textContent='Enter 2–300 characters.';return}const b=$('#playVoice');b.disabled=true;b.textContent='Generating voice…';$('#voiceStatus').textContent='Requesting current '+current.name+' voice…';const controller=new AbortController();previewAbort=controller;try{const token=await previewToken();if(controller.signal.aborted)return;const response=await fetch('/api/free-talking-realtime-eleven',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({character,text}),signal:controller.signal,cache:'no-store'});if(!response.ok){let detail=await response.json().catch(()=>({}));throw Error(detail.error||'Voice service HTTP '+response.status)}const blob=await response.blob();if(blob.size<400)throw Error('Voice recording was empty');if(controller.signal.aborted||current.id!==character)return;previewObjectUrl=URL.createObjectURL(blob);
 const audio=$('#voicePlayback');previewAudio=audio;audio.hidden=false;audio.src=previewObjectUrl;
 audio.onplay=()=>{if(previewAudio!==audio||current?.id!==character)return;characterStage?.setPhase('speaking');b.textContent='Playing…';$('#voiceStatus').textContent='Playing '+current.name+' voice'};
 audio.onpause=()=>{if(previewAudio===audio)characterStage?.setPhase('idle')};
 audio.onended=()=>{if(previewAudio===audio){characterStage?.setPhase('idle');b.disabled=false;b.textContent='▶ Play voice sample';$('#voiceStatus').textContent='Voice preview finished. Tap the player to hear it again.'}};
 audio.onerror=()=>{if(previewAudio===audio){$('#voiceStatus').textContent='Audio playback failed';b.disabled=false;b.textContent='▶ Try voice again'}};
 b.disabled=false;b.textContent='▶ Play voice sample';
 $('#voiceStatus').textContent='Recording ready';
 try{await audio.play()}catch(err){
  if(err.name==='NotAllowedError'){
   $('#voiceStatus').textContent='Voice ready — tap Play on the audio player (mobile playback restriction).';
  }else throw err;
 }
 }catch(err){if(!controller.signal.aborted){$('#voiceStatus').textContent=String(err.message||err);b.textContent='▶ Try voice again';b.disabled=false;characterStage?.setPhase('idle')}}}

const portrait=(c,instance)=>characterThumbnailMarkup(c.id,instance);
function selectCharacter(id){
 const c=CHARACTER_REGISTRY.find(c=>c.id===id);if(!c)return;
 stopSample();current=c;
 $('#sampleSentence').value=SAMPLES[c.id]||('Hello! I am '+c.name+'. Nice to meet you!');
 $('#voiceStatus').textContent='Tap Play to hear the current voice.';
 for(const node of document.querySelectorAll('.character'))node.setAttribute('aria-pressed',String(node.dataset.id===id));
 const stage=$('#stage');if(effectTimer){clearTimeout(effectTimer);effectTimer=null}
 characterStage?.destroy?.();characterStage=mountCharacter(stage,c.id);
 $('#name').textContent=c.name;$('#personality').textContent=c.personality;
 const info=$('#info');info.replaceChildren();
 const fields=[['Character ID',c.id],['Unlock points',c.unlockPoints.toLocaleString()],['Voice provider',c.voiceProvider],['Voice ID',c.voiceId],['Animation states',c.states.join(', ')],['Publishing status',c.status]];
 for(const [key,value]of fields){const label=document.createElement('dt'),out=document.createElement('dd');label.textContent=key;out.textContent=value;info.append(label,out)}
 const controls=$('#states');controls.replaceChildren();
 const available=c.states.slice();
 if(c.id==='willy')available.push('happy','sad','angry','cat');
 if(c.id==='dusk')available.push('squint','glance','nod','shake','spark','aura');
 if(c.id==='steve')available.push('grumpy');
 for(const state of [...new Set(available)]){
  const b=document.createElement('button');b.type='button';b.textContent=state;b.dataset.state=state;b.setAttribute('aria-pressed',String(state==='idle'));
  b.onclick=()=>{
   if(effectTimer){clearTimeout(effectTimer);effectTimer=null}
   const actor=characterStage.actor;
   const dusk=actor.querySelector('.ft-dusk-actor');
   if(dusk)delete dusk.dataset.duskEffect;
   actor.dataset.mood='neutral';
   if(['happy','sad','angry','cat'].includes(state)){
     characterStage.setPhase('speaking');actor.dataset.mood=state;
   }else if(['squint','glance','nod','shake','spark','aura'].includes(state)){
     characterStage.setPhase('idle');
     if(dusk){
       // Restart one-shot CSS keyframes when the same reaction is pressed twice.
       void dusk.offsetWidth;
       dusk.dataset.duskEffect=state;
       if(state!=='squint'&&state!=='glance')effectTimer=setTimeout(()=>{if(dusk.isConnected)delete dusk.dataset.duskEffect},1800);
     }
   }else if(state==='grumpy'){
     characterStage.setPhase('idle');actor.dataset.steveMood='stern';
   }else{
     characterStage.setPhase(state);
   }
   for(const button of controls.children)button.setAttribute('aria-pressed',String(button===b));
   $('#previewStatus').textContent='Preview: '+state+' · using Free Talking animation rules';
  };
  controls.append(b);
 }
 $('#previewStatus').textContent='Preview: idle · live animation styles';
}
function mount(){
 const issues=[...registryDiagnostics(),...validateCharacterAssets()];
 $('#health').textContent=issues.length?issues.length+' registry issues':'✓ '+CHARACTER_REGISTRY.length+' registered characters';
 $('#health').title=issues.join('\n');
 const box=$('#characters');
 for(const c of CHARACTER_REGISTRY){
  const button=document.createElement('button');button.type='button';button.className='character';button.dataset.id=c.id;button.setAttribute('aria-pressed','false');
  const icon=document.createElement('span');icon.className='portrait';icon.innerHTML=portrait(c,'picker-'+c.id);
  const details=document.createElement('span');const name=document.createElement('strong'),small=document.createElement('small');name.textContent=c.name;small.textContent=c.unlockPoints.toLocaleString()+' points · '+c.status;details.append(name,small);button.append(icon,details);button.onclick=()=>selectCharacter(c.id);box.append(button);
 }
 $('#playVoice').onclick=()=>void playSample();
 $('#copy').onclick=()=>{if(!current)return;navigator.clipboard?.writeText(JSON.stringify(current,null,2)).then(()=>{$('#previewStatus').textContent='Configuration copied'},()=>{$('#previewStatus').textContent='Clipboard unavailable'})};
 selectCharacter('steve');
}
async function checkStaff(){
 try{
  const request=async(path)=>{const target=window.WillenaAPI?.getApiUrl?.(path)||path;const res=await fetch(target,{credentials:'include'});const data=await res.json();if(!res.ok||data.success===false)throw Error(data.error||'Not authenticated');return data};
  const who=await request('/.netlify/functions/supabase_auth?action=whoami');
  if(!who.user_id)throw Error('Please sign in as a teacher');
  const role=await request('/.netlify/functions/supabase_auth?action=get_role&user_id='+encodeURIComponent(who.user_id));
  if(!['teacher','admin','owner'].includes(String(role.role||'').toLowerCase()))throw Error('Teacher access required');
  $('#identity').textContent='Staff preview only';$('#main').hidden=false;mount();
 }catch(error){$('#identity').textContent='Access restricted';$('#access').textContent=String(error.message||error)+'. Sign in through the Teachers Dashboard first.'}
}
mount();