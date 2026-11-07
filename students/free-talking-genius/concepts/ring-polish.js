/* Concept A polish: character-only status pill. Original app still owns audio and grading. */
(()=>{
 if(document.documentElement.dataset.ftConcept!=='ring')return;
 const session=document.getElementById('ftSession');
 const circle=document.getElementById('ftTurnCircle');
 const voice=document.getElementById('ftWilliVoice');
 const stage=document.querySelector('#ftSession .ft-concept-character-stage');
 if(!session||!circle||!voice||!stage)return;
 const status=document.createElement('button');
 status.type='button';
 status.className='ft-ring-action-pill';
 status.setAttribute('aria-label','눌러서 듣기');
 status.textContent='눌러서 듣기';
 stage.insertAdjacentElement('afterend',status);
 // Correction flow: a real button directly beneath the corrected sentence.
 const correction=document.querySelector('#ftRepeatScreen .ft-repeat-sentence.is-corrected');
 const repeatButton=document.createElement('button');
 repeatButton.type='button';repeatButton.className='ft-ring-rerecord';
 repeatButton.textContent='눌러서 다시 녹음하기';
 repeatButton.setAttribute('aria-label','고친 문장 다시 녹음하기');
 repeatButton.hidden=true;
 correction?.insertAdjacentElement('afterend',repeatButton);
 repeatButton.addEventListener('click',()=>{
  if(!repeatButton.hidden&&!repeatButton.disabled)circle.click();
 });

 const update=()=>{
  const special=!session.hidden&&['bunny-v3','pigfish'].includes(session.dataset.character);
  const step=document.getElementById('ftQuestionStage')?.dataset.step;
  const usable=special&&step!=='score'&&step!=='repeat';
  status.hidden=!usable;
  const repeatActive=special&&step==='repeat';
  repeatButton.hidden=!repeatActive;
  if(repeatActive){
   const recording=circle.dataset.aiRecording==='true'||circle.dataset.listening==='true';
   const processing=circle.dataset.transcribing==='true'||circle.disabled;
   const label=processing?'확인 중…':recording?'녹음 끝내기':'눌러서 다시 녹음하기';
   if(repeatButton.textContent!==label)repeatButton.textContent=label;
   repeatButton.dataset.state=processing?'thinking':recording?'recording':'ready';
   repeatButton.disabled=processing;
  }
  if(!usable)return;
  const phase=circle.dataset.phase||'ready';
  const recording=circle.dataset.aiRecording==='true'||circle.dataset.listening==='true';
  const processing=circle.dataset.transcribing==='true'||phase==='thinking';
  const state=processing?'thinking':recording?'recording':phase==='ai'?'playing':phase==='ready'?'listen':'speak';
  const words={thinking:'생각 중…',recording:'녹음 중…',playing:'듣는 중…',listen:'눌러서 듣기',speak:'눌러서 말하기'};
  if(status.dataset.state!==state)status.dataset.state=state;
  if(status.textContent!==words[state])status.textContent=words[state];
  status.disabled=processing||phase==='ai'||phase==='feedback';
  status.setAttribute('aria-label',words[state]);
 };
 status.addEventListener('click',()=>{
  if(!status.disabled&&!status.hidden)circle.click();
 });
 const obs=new MutationObserver(update);
 obs.observe(circle,{attributes:true,attributeFilter:['data-phase','data-ai-recording','data-listening','data-transcribing']});
 obs.observe(session,{attributes:true,attributeFilter:['hidden','data-character']});
 const step=document.getElementById('ftQuestionStage');
 if(step)obs.observe(step,{attributes:true,attributeFilter:['data-step']});
 update();
})();