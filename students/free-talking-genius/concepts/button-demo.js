/* Concept C — UI-only adapter for the original Free Talking app.
   No independent recording, grading, audio, or progress implementation. */
(()=>{
 const session=document.getElementById('ftSession');
 const voice=document.getElementById('ftWilliVoice');
 const circle=document.getElementById('ftTurnCircle');
 const questionStage=document.getElementById('ftQuestionStage');
 const repeatMount=document.getElementById('ftRepeatCircleMount');
 if(!session||!voice||!circle||!questionStage)return;
 const stage=document.createElement('div');
 stage.className='ft-c-stage';
 const avatar=document.createElement('div');
 avatar.className='ft-c-avatar';
 const control=document.createElement('button');
 control.type='button';control.className='ft-c-control';
 control.innerHTML='<span class="ft-c-fill" aria-hidden="true"></span><span class="ft-c-swirl" aria-hidden="true"><i></i><i></i></span><span class="ft-c-label">눌러서 듣기</span><span class="ft-c-seconds" aria-hidden="true"></span>';
 stage.append(avatar,control);
 voice.insertBefore(stage,circle);
 avatar.appendChild(circle);
 const label=control.querySelector('.ft-c-label');
 const fill=control.querySelector('.ft-c-fill');
 const seconds=control.querySelector('.ft-c-seconds');
 let restoring=false;
 const inCorrection=()=>questionStage.dataset.step==='repeat';
 function attach(){
  if(restoring||session.hidden)return;
  // Let the original app keep its microphone in the correction flow;
  // the same proxy button will operate it there.
  if(inCorrection()){
   if(repeatMount&&control.parentElement!==repeatMount){
    restoring=true;repeatMount.appendChild(control);restoring=false;
   }
   return;
  }
  if(circle.parentElement!==avatar||control.parentElement!==stage){
   restoring=true;
   if(circle.parentElement!==avatar)avatar.appendChild(circle);
   if(control.parentElement!==stage)stage.appendChild(control);
   restoring=false;
  }
 }
 function update(){
  attach();
  const correction=inCorrection();
  const character=session.dataset.character||'marin';
  const phase=circle.dataset.phase||'ready';
  const listening=circle.dataset.aiRecording==='true'||circle.dataset.listening==='true';
  const transcribing=circle.dataset.transcribing==='true';
  const progress=Math.max(0,Math.min(100,parseFloat(circle.style.getPropertyValue('--ft-record-offset'))||0));
  const thinking=transcribing||phase==='thinking';
  const show=session.hidden===false&&questionStage.dataset.step!=='score'&&
    (correction||!['feedback'].includes(phase));
  const state=thinking?'processing':listening?'recording':phase==='ai'?'playing':
    phase==='ready'&&!correction?'listen':'speak';
  session.dataset.cAction=state;session.dataset.cCharacter=character;
  stage.hidden=!show||correction;
  control.hidden=!show;
  control.dataset.state=state;
  const count=Math.max(0,Math.ceil(30*(100-progress)/100));
  let message='';
  switch(state){
   case 'listen': message='눌러서 듣기';break;
   case 'playing': message='듣는 중…';break;
   case 'speak': message='눌러서 말하기';break;
   case 'recording':message='녹음 중 · 눌러서 끝내기';break;
   default:message='확인 중…';
  }
  if(!correction&&character==='marin'){
   // Willi uses the same standalone action control; its original visual
   // stays inside its own round graphic, without changing the app logic.
  }
  label.textContent=message;
  const remaining=state==='recording'?count+'s':'';
  seconds.textContent=remaining;
  control.setAttribute('aria-label',message+(remaining?', '+remaining:''));
  control.disabled=state==='processing'||state==='playing';
  fill.style.width=state==='recording'?(100-progress)+'%':'0%';
 }
 control.addEventListener('click',event=>{
  event.preventDefault();
  if(control.disabled||session.hidden)return;
  circle.click();
 });
 // Make artwork non-interactive while retaining the original working button
 // as the action target for app.js and its animations.
 circle.tabIndex=-1;
 const observer=new MutationObserver(update);
 observer.observe(circle,{attributes:true,attributeFilter:['data-phase','data-listening','data-ai-recording','data-transcribing','style']});
 observer.observe(session,{attributes:true,attributeFilter:['hidden','data-character']});
 observer.observe(questionStage,{attributes:true,attributeFilter:['data-step','data-phase']});
 observer.observe(voice,{childList:true});
 if(repeatMount)observer.observe(repeatMount,{childList:true});
 update();
})();