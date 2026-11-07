/* Free Talking ring/bar comparison.
   UI-only. The canonical app controls audio, recording, grading and progress. */
(()=>{
 const mode=document.documentElement.dataset.ftConcept;
 if(!['ring','bar'].includes(mode))return;
 const get=id=>document.getElementById(id);
 const voice=get('ftWilliVoice'),circle=get('ftTurnCircle');
 const session=get('ftSession'),questionStage=get('ftQuestionStage');
 if(!voice||!circle||!session||!questionStage)return;
 const stage=document.createElement('div');stage.className='ft-concept-character-stage';
 const anchor=document.createElement('div');anchor.className='ft-concept-avatar-anchor';
 const timing=document.createElement('div');timing.className='ft-concept-timer';
 timing.setAttribute('role','timer');timing.setAttribute('aria-label','Recording time left');
 if(mode==='ring'){
  timing.innerHTML='<svg class="ft-concept-ring-svg" viewBox="0 0 240 240" aria-hidden="true"><circle class="ft-concept-ring-track" cx="120" cy="120" r="110" pathLength="100"/><circle class="ft-concept-ring-fill" cx="120" cy="120" r="110" pathLength="100"/></svg><span class="ft-concept-ring-seconds">30s</span>';
 }else{
  timing.innerHTML='<span class="ft-concept-bar-title">Recording</span><div class="ft-concept-bar-track"><span class="ft-concept-bar-fill"></span></div><strong class="ft-concept-bar-seconds">30s</strong>';
 }
 voice.insertBefore(stage,circle);
 stage.appendChild(anchor);
 // The UI shell follows the real button. This exact button is still used for tap/record.
 anchor.appendChild(circle);
 if(mode==='ring')stage.appendChild(timing);
 else voice.insertBefore(timing,stage.nextSibling);
 let syncing=false;
 function resettle(){
  if(syncing||session.hidden||questionStage.dataset.step==='repeat')return;
  if(circle.parentElement!==anchor){
   syncing=true;anchor.appendChild(circle);syncing=false;
  }
 }
 function update(){
  resettle();
  const progress=Math.min(100,Math.max(0,Number.parseFloat(circle.style.getPropertyValue('--ft-record-offset'))||0));
  const character=session.dataset.character||'marin';
  const active=circle.dataset.aiRecording==='true'||circle.dataset.listening==='true';
  const speaking=character!=='marin'&&!session.hidden;
  session.dataset.conceptCharacter=character;
  session.dataset.conceptRecording=speaking&&active?'true':'false';
  stage.style.setProperty('--concept-progress',String(progress));
  const seconds=active?Math.max(0,Math.ceil(30*(100-progress)/100)):30;
  const element=timing.querySelector('.ft-concept-ring-seconds, .ft-concept-bar-seconds');
  if(element)element.textContent=seconds+'s';
  const fill=timing.querySelector('.ft-concept-bar-fill');
  if(fill)fill.style.width=(active?(100-progress):100)+'%';
  // The decorated button remains touchable, including between recordings.
  if(speaking)circle.setAttribute('aria-label',active?'Stop recording, '+seconds+' seconds remaining':
   circle.dataset.phase==='ready'?'Tap character to hear the question':'Tap character to speak');
 }
 const observer=new MutationObserver(update);
 observer.observe(circle,{attributes:true,attributeFilter:['style','data-listening','data-ai-recording','data-phase']});
 observer.observe(session,{attributes:true,attributeFilter:['data-character','hidden']});
 observer.observe(questionStage,{attributes:true,attributeFilter:['data-step']});
 // app.js legitimately moves the button on every new question and correction
 // round; reattach it immediately during normal play, without touching its events.
 const voiceObserver=new MutationObserver(update);
 voiceObserver.observe(voice,{childList:true});
 // When reinserted at the beginning of voice host, observer receives a childList change.
 update();
})();