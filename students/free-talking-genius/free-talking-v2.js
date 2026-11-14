// Free Talking V2 — native, independently mounted activity.
// Shares Willena character art, menu template, auth and existing server contracts.
// No iframe, second student header, migrations, or changes to Speaking/V1 logic.
import {BUNNY_FOX_ART,PIGFISH_ART} from './character-art.js?v=20261113-willy-wave3';
import {AI_WILLY_HEAD_SVG} from './willy-svg.js?v=20261114-electric-cat-v3';
import {scopedCharacterArt} from './character-actor.js?v=20261114-p4-visual1';

const $=(root,id)=>root.querySelector('#'+id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;'}[c]));
const CHARACTERS={ 'bunny-v3':{api:'bunny',name:'Bunny Fox',art:BUNNY_FOX_ART},
 'pigfish':{api:'pigfish',name:'Pigfish',art:PIGFISH_ART},
 'willy':{api:'willy',name:'AI Willi 2',art:AI_WILLY_HEAD_SVG},
 'marin':{api:'willi',name:'Willo',art:'<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="49" fill="#effbfc" stroke="#49c4d0" stroke-width="7"/><circle cx="60" cy="60" r="22" fill="none" stroke="#80d8df" stroke-width="10"/><path d="M39 75 Q60 92 81 70" fill="none" stroke="#e99cc2" stroke-width="7" stroke-linecap="round"/></svg>'}};
function checkTestAccess(){
 try{if(sessionStorage.getItem('willena_willy_testing')==='yes')return true}catch{}
 const answer=prompt('AI 윌리는 선생님 테스트 중이에요. PIN을 입력하세요.');
 if(answer!=='2282')return false;
 try{sessionStorage.setItem('willena_willy_testing','yes')}catch{}return true;
}
function makeCharacterMenu(root){
 const menu=window.WillenaFTSharedMenu?.makeMenu?.();
 if(!menu)throw Error('Shared character menu is unavailable');
 // Prefix IDs to avoid conflicting with Speaking's retained character screen.
 for(const node of [menu,...menu.querySelectorAll('[id]')])if(node.id)node.id='ft2-'+node.id;
 menu.hidden=false;
 menu.querySelector('#ft2-ftCharacterRound')?.remove();
 menu.querySelector('#ft2-ftCharacterBack')?.remove();
 root.append(menu);
 return menu;
}
export function createFreeTalkingV2({host,getToken,onBack,onProgress}){
 const state={bookId:null,unitId:null,character:null,sessionId:null,turnNo:0,anchors:[],index:0,
  phase:'menu',inFlight:false,recording:null,stream:null,chunks:[],audio:null,audioURL:null,
  saving:Promise.resolve(),history:[],turns:0,closing:false,controller:null,started:false,replyCount:0};
 host.classList.add('ft-v2');host.hidden=true;
 const menuSlot=document.createElement('div');menuSlot.className='ft2-character';
 const scene=document.createElement('section');scene.className='ft2-scene';scene.hidden=true;
 scene.innerHTML='<div class="ft2-progress" aria-label="Conversation question progress"></div>'+
 '<div class="ft2-portrait" data-state="idle" aria-label="Character"></div>'+
 '<div class="ft2-question" aria-live="polite"></div>'+
 '<div class="ft2-status" role="status"></div>'+
 '<div class="ft2-transcript" aria-label="Conversation transcript"></div>'+
 '<div class="ft2-actions"><button class="ft2-btn ft2-primary" data-action="record" type="button">Start speaking</button>'+
 '<button class="ft2-btn" data-action="finish" type="button">Finish conversation</button></div>'+
 '<p class="ft2-notice">AI feedback and saved transcripts use the existing Free Talking records. Audio is not stored.</p>';
 const result=document.createElement('section');result.className='ft2-result';result.hidden=true;
 const head=document.createElement('div');head.className='ft2-head';
 const back=document.createElement('button');back.className='ft2-back';back.type='button';back.textContent='← 교재로 돌아가기';
 const name=document.createElement('strong');name.textContent='Free Talking';
 head.append(back,name);host.replaceChildren(head,menuSlot,scene,result);
 const menu=makeCharacterMenu(menuSlot);
 const menuButtons=[...menu.querySelectorAll('.ft-character-option')];
 const start=menu.querySelector('#ft2-ftCharacterContinue');
 const portrait=scene.querySelector('.ft2-portrait');
 const question=scene.querySelector('.ft2-question');
 const status=scene.querySelector('.ft2-status');
 const log=scene.querySelector('.ft2-transcript');
 const record=scene.querySelector('[data-action=record]');
 const finish=scene.querySelector('[data-action=finish]');
 const progress=scene.querySelector('.ft2-progress');
 const uiStatus=s=>{status.textContent=s;};
 const request=async(body,signal)=>{
  const token=await getToken();
  const response=await fetch('/api/free-talking-hybrid-lab',{method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.error||'Free Talking request failed ('+response.status+')');
  return data;
 };
 const append=(role,message)=>{
  const p=document.createElement('p');p.className=role==='student'?'student':'character';
  const b=document.createElement('strong');b.textContent=(role==='student'?'You':CHARACTERS[state.character]?.name||'Friend')+': ';
  p.append(b,document.createTextNode(String(message||'')));log.append(p);log.scrollTop=log.scrollHeight;
 };
 const paintProgress=()=>{
  progress.replaceChildren();
  for(let i=0;i<8;i++){const span=document.createElement('span');span.className=i<state.index?'done':i===state.index?'now':'';progress.append(span)}
 };
 const paintCharacter=()=>{
  const c=CHARACTERS[state.character];portrait.replaceChildren();
  const actor=document.createElement('span');actor.className='bf-actor';actor.dataset.state='idle';
  actor.innerHTML=scopedCharacterArt(c.art,'v2-'+state.sessionId?.slice(0,8));
  portrait.append(actor);portrait.dataset.state='idle';
 };
 const paintQuestion=(text)=>{
  question.textContent=text;paintProgress();
 };
 const stopAudio=()=>{
  const audio=state.audio;state.audio=null;
  if(audio){audio.pause();audio.removeAttribute('src');audio.load()}
  if(state.audioURL){URL.revokeObjectURL(state.audioURL);state.audioURL=null}
  portrait.dataset.state='idle';
 };
 const stopMic=()=>{
  if(state.recording&&state.recording.state==='recording'){try{state.recording.stop()}catch{}}
  state.recording=null;
  if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}
 };
 const stopMedia=()=>{stopMic();stopAudio();state.controller?.abort();state.controller=null};
 const setReady=(ready)=>{
  record.disabled=!ready;record.textContent='Start speaking';finish.disabled=state.inFlight;
  portrait.dataset.state=ready?'listening':'idle';state.phase=ready?'ready':'busy';
 };
 async function speak(text){
  if(!text||state.closing)return;
  stopMic();
  uiStatus('Your friend is speaking…');portrait.dataset.state='speaking';
  try{
   const token=await getToken();
   const controller=new AbortController();state.controller=controller;
   const response=await fetch('/api/free-talking-realtime-eleven',{method:'POST',credentials:'same-origin',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({character:CHARACTERS[state.character].api,text}),signal:controller.signal});
   if(!response.ok)throw Error('Voice unavailable');
   const blob=await response.blob();
   if(state.closing)return;
   const url=URL.createObjectURL(blob);state.audioURL=url;
   const audio=new Audio(url);audio.playsInline=true;state.audio=audio;
   await audio.play();
   await new Promise((resolve,reject)=>{audio.onended=resolve;audio.onerror=()=>reject(Error('Playback failed'))});
  }catch(ex){if(!state.closing&&ex.name!=='AbortError')uiStatus('Voice could not play; read the question below.')}
  finally{stopAudio();state.controller=null}
 }
 const persist=async(speaker,text,extra={})=>{
  const turn=++state.turnNo;
  const body={action:'transcript',session_id:state.sessionId,turn_number:turn,
   book_id:state.bookId,unit_id:state.unitId,character:CHARACTERS[state.character].api,
   speaker,transcript_text:String(text).slice(0,1500),...extra};
  const op=state.saving.then(()=>request(body));
  state.saving=op.catch(error=>{console.error('[Free Talking V2] transcript save',error);throw error});
  await op;
 };
 async function askAnchor(){
  if(state.closing)return;
  const anchor=state.anchors[state.index];
  if(!anchor){await complete();return}
  paintQuestion(anchor.text);append('character',anchor.text);
  state.history.push({role:'assistant',text:anchor.text});
  await persist('character',anchor.text,{message_source:'textbook_question'});
  await speak(anchor.text);
  if(!state.closing){setReady(true);uiStatus('Your turn. Tap Start speaking, then Stop.')}
 }
 async function replyToStudent(text){
  const data=await request({action:'reply',book_id:state.bookId,unit_id:state.unitId,
   character:CHARACTERS[state.character].api,model:'gpt-6-luna',
   session_id:state.sessionId,directive:'Reply naturally and briefly to the student. Ask a simple relevant follow-up question. Do not award points here.',
   history:state.history.slice(-18),asked_questions:state.anchors.map(a=>a.text)});
  const answer=String(data.text||'').trim();
  if(!answer)throw Error('AI did not return a reply');
  append('character',answer);state.history.push({role:'assistant',text:answer});
  await persist('character',answer,{message_source:'ai_reply'});
  await speak(answer);
 }
 const processAudio=async(blob)=>{
  state.inFlight=true;setReady(false);uiStatus('Checking what you said…');
  try{
   const token=await getToken();
   const form=new FormData();form.append('audio',blob,'student-answer.webm');
   const response=await fetch('/api/free-talking-hybrid-transcribe',{method:'POST',
    headers:{Authorization:'Bearer '+token,'X-Willena-STT':'openai-mini'},body:form});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw Error(data.error||'Speech recognition failed');
   const text=String(data.text||'').trim();
   if(!text)throw Error('I could not hear your answer. Please try again.');
   append('student',text);state.history.push({role:'user',text});
   await persist('student',text);
   state.turns++;
   if(state.replyCount===0){
    state.replyCount=1;
    await replyToStudent(text);
    if(!state.closing){setReady(true);uiStatus('Answer the follow-up question.')}
   }else{
    state.replyCount=0;state.index++;paintProgress();
    if(state.index>=state.anchors.length)await complete();
    else await askAnchor();
   }
  }catch(error){if(!state.closing){uiStatus('Could not process your answer: '+error.message);setReady(true)}}
  finally{state.inFlight=false;finish.disabled=false}
 };
 async function startRecording(){
  if(state.inFlight||state.closing)return;
  try{
   if(!window.MediaRecorder)throw Error('This browser does not support recording.');
   const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
   if(state.closing){stream.getTracks().forEach(t=>t.stop());return}
   state.stream=stream;state.chunks=[];
   const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'';
   const recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});
   state.recording=recorder;
   recorder.ondataavailable=e=>{if(e.data?.size)state.chunks.push(e.data)};
   recorder.onstop=()=>{
    const blob=new Blob(state.chunks,{type:recorder.mimeType||'audio/webm'});
    state.chunks=[];if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null}
    if(!state.closing&&state.phase!=='review'&&blob.size>400)void processAudio(blob);
    else if(!state.closing&&state.phase!=='review'){setReady(true);uiStatus('Recording was too short. Please try again.')}
   };
   recorder.start();record.textContent='Stop recording';portrait.dataset.state='listening';uiStatus('Listening… tap Stop when finished');
  }catch(error){uiStatus('Microphone problem: '+error.message)}
 }
 const stopRecording=()=>{
  const recorder=state.recording;
  if(recorder?.state==='recording'){recorder.stop();state.recording=null;record.disabled=true}
 };
 async function complete(){
  if(state.closing||state.phase==='review')return;
  state.phase='review';state.inFlight=true;record.disabled=true;finish.disabled=true;
  stopMic();
  uiStatus('Saving and reviewing your conversation…');
  try{
   await state.saving;
   const review=await request({action:'review',session_id:state.sessionId,book_id:state.bookId,unit_id:state.unitId});
   if(!Array.isArray(review.credits))throw Error('Review results unavailable');
   for(const credit of review.credits){
    await request({action:'transcript',book_id:state.bookId,unit_id:state.unitId,
      session_id:state.sessionId,turn_number:credit.turn_number,original_turn_number:credit.original_turn_number,
      speaker:'student',character:CHARACTERS[state.character].api,transcript_text:credit.text,
      message_source:'review_credit',verdict:credit.qualifies?'QUALIFIES':'NEEDS_MORE',
      verdict_at:credit.stamp,verdict_proof:credit.proof,
      review_points:credit.points,review_qualifies:credit.qualifies,review_reason:credit.reason});
   }
   const saved=await request({action:'result',session_id:state.sessionId,book_id:state.bookId,unit_id:state.unitId});
   await request({action:'progress',book_id:state.bookId,unit_id:state.unitId});
   scene.hidden=true;result.hidden=false;result.replaceChildren();
   const title=document.createElement('strong');title.textContent='Great conversation!';
   const points=document.createElement('div');points.textContent='+'+(Number(saved.points)||0)+' points · '+(Number(saved.stars)||0)+' stars';
   const feedback=document.createElement('p');feedback.textContent=String(review.feedback||'');
   const home=document.createElement('button');home.type='button';home.className='ft2-btn ft2-primary';home.textContent='Back to Units';home.addEventListener('click',()=>close());
   result.append(title,points,feedback,home);
   onProgress?.();
  }catch(error){state.phase='review-failed';scene.hidden=false;uiStatus('Review could not be saved: '+error.message+' — tap Finish to retry.')}
  finally{state.inFlight=false;finish.disabled=false}
 }
 async function begin(){
  if(!state.character||state.inFlight)return;
  state.inFlight=true;start.disabled=true;menuSlot.hidden=true;scene.hidden=false;
  state.sessionId=crypto.randomUUID();state.turnNo=0;state.index=0;state.turns=0;state.replyCount=0;state.history=[];state.saving=Promise.resolve();
  state.closing=false;state.started=true;state.phase='starting';log.replaceChildren();
  try{
   uiStatus('Preparing your textbook conversation…');
   const lesson=await request({action:'lesson',book_id:state.bookId,unit_id:state.unitId,guided:true});
   state.anchors=Array.isArray(lesson.lesson?.anchors)?lesson.lesson.anchors.filter(a=>a.id&&a.text).slice(0,8):[];
   if(!state.anchors.length)throw Error('No published questions for this unit.');
   state.inFlight=false;await askAnchor();
  }catch(error){uiStatus('Could not start: '+error.message);state.inFlight=false;finish.disabled=false;record.disabled=true}
 }
 function close({notify=true}={}){
  if(state.closing&&host.hidden)return;
  state.closing=true;stopMedia();host.hidden=true;menuSlot.hidden=false;scene.hidden=true;result.hidden=true;
  state.character=null;state.started=false;state.phase='menu';
  if(notify)onBack?.();
 }
 function open({bookId,unitId}){
  if(!bookId||!unitId)throw Error('Select a unit first');
  state.bookId=bookId;state.unitId=unitId;state.closing=false;state.character=null;
  state.phase='menu';state.started=false;state.inFlight=false;state.anchors=[];state.history=[];
  menuSlot.hidden=false;scene.hidden=true;result.hidden=true;host.hidden=false;
  start.disabled=true;menuButtons.forEach(b=>b.setAttribute('aria-pressed','false'));
 }
 menuButtons.forEach(button=>button.addEventListener('click',()=>{
  const selected=button.dataset.voice;
  if(selected==='willy'&&!checkTestAccess())return;
  state.character=selected;menuButtons.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  start.disabled=false;
 }));
 start.addEventListener('click',()=>void begin());
 back.addEventListener('click',()=>{
  if(state.recording){stopRecording();return}
  close();
 });
 record.addEventListener('click',()=>state.recording?.state==='recording'?stopRecording():void startRecording());
 finish.addEventListener('click',()=>void complete());
 return {open,close,isOpen:()=>!host.hidden};
}
