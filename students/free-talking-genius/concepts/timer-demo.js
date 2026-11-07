/* Free Talking timer concepts. Presentation-only; the canonical app owns
   character selection, question audio, microphone, grading and persistence. */
(()=>{
 const mode=document.documentElement.dataset.ftConcept;
 if(mode!=='ring'&&mode!=='bar')return;
 const circle=document.getElementById('ftTurnCircle');
 const voice=document.getElementById('ftWilliVoice');
 const session=document.getElementById('ftSession');
 if(!circle||!voice||!session)return;
 const stage=document.createElement('div');
 stage.className='ft-concept-character-stage';
 const anchor=document.createElement('div');
 anchor.className='ft-concept-avatar-anchor';
 voice.insertBefore(stage,circle);
 stage.appendChild(anchor);
 anchor.appendChild(circle);
 const timer=document.createElement('div');
 timer.className='ft-concept-timer';
 timer.setAttribute('role','timer');
 timer.setAttribute('aria-label','Recording time remaining');
 timer.innerHTML=mode==='ring'
  ?'<svg class="ft-concept-ring-svg" viewBox="0 0 284 284" aria-hidden="true"><circle class="ft-concept-ring-track" cx="142" cy="142" r="130" pathLength="100"/><circle class="ft-concept-ring-fill" cx="142" cy="142" r="130" pathLength="100"/></svg><span class="ft-concept-ring-seconds">30s</span>'
  :'<div class="ft-concept-bar-header"><span class="ft-concept-rec-dot"></span><span>Recording</span><strong class="ft-concept-bar-seconds">30s</strong></div><div class="ft-concept-bar-track"><span class="ft-concept-bar-fill"></span></div>';
 if(mode==='ring')stage.appendChild(timer);
 else voice.insertBefore(timer,stage.nextSibling);
 const tick=()=>{
  const progress=Number.parseFloat(circle.style.getPropertyValue('--ft-record-offset'))||0;
  const clamped=Math.min(100,Math.max(0,progress));
  const remaining=Math.ceil(30*(100-clamped)/100);
  const listening=circle.dataset.aiRecording==='true'||circle.dataset.listening==='true';
  const character=session.dataset.character||'marin';
  const active=character!=='marin'&&listening&&session.hidden===false;
  session.dataset.conceptRecording=active?'true':'false';
  session.dataset.conceptCharacter=character;
  stage.style.setProperty('--concept-progress',String(clamped));
  if(mode==='ring')timer.querySelector('.ft-concept-ring-seconds').textContent=remaining+'s';
  else{
   timer.querySelector('.ft-concept-bar-seconds').textContent=remaining+'s';
   timer.querySelector('.ft-concept-bar-fill').style.width=(100-clamped)+'%';
  }
 };
 const observer=new MutationObserver(tick);
 observer.observe(circle,{attributes:true,attributeFilter:['style','data-listening','data-ai-recording','data-phase']});
 observer.observe(session,{attributes:true,attributeFilter:['data-character','hidden']});
 // Original app temporarily moves the same circle into its correction screen.
 // Reattach to the presentation stage whenever the next normal question starts.
 observer.observe(voice,{childList:true});
 const resettle=()=>{
  if(!session.hidden && !session.querySelector('#ftQuestionStage[data-step="repeat"]') &&
     circle.parentElement!==anchor)anchor.appendChild(circle);
 };
 const reconcile=new MutationObserver(()=>{resettle();tick()});
 reconcile.observe(document.getElementById('ftQuestionStage'),{attributes:true,attributeFilter:['data-step']});
 observer.observe(voice,{childList:true});
 tick();
 // Observer keeps timer tied to the exact progress already produced by app.js.
})();