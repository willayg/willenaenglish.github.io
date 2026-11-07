/* Live Free Talking: Bunny Fox and Pigfish presentation layer.
   The original #ftTurnCircle remains the sole source of listen, record and
   rerecord actions. No separate audio, API, grading, progress or voice code. */
(()=>{
 const $=id=>document.getElementById(id);
 const session=$('ftSession'),voice=$('ftWilliVoice'),circle=$('ftTurnCircle');
 const questionStage=$('ftQuestionStage'),repeatMount=$('ftRepeatCircleMount');
 const correction=$('ftRepeatScreen')?.querySelector('.ft-repeat-sentence.is-corrected');
 if(!session||!voice||!circle||!questionStage||!correction)return;
 const animals=['bunny-v3','pigfish'];
 const stage=document.createElement('div');stage.className='ft-animal-stage';
 const anchor=document.createElement('div');anchor.className='ft-animal-avatar';
 const timer=document.createElement('div');timer.className='ft-animal-timer';
 timer.setAttribute('role','timer');timer.setAttribute('aria-label','녹음 시간');
 timer.innerHTML='<svg viewBox="0 0 240 240" aria-hidden="true"><circle class="ft-animal-track" cx="120" cy="120" r="110" pathLength="100"/><circle class="ft-animal-progress" cx="120" cy="120" r="110" pathLength="100"/></svg>';
 stage.append(anchor,timer);
 // The real button keeps all of its original listeners and recording timer.
 voice.insertBefore(stage,circle);
 anchor.appendChild(circle);
 const pill=document.createElement('button');
 pill.type='button';pill.className='ft-animal-action';
 const spinner=document.createElement('span');spinner.className='ft-animal-spinner';
 spinner.setAttribute('aria-hidden','true');
 const spinnerInner=document.createElement('i');spinner.appendChild(spinnerInner);
 const pillText=document.createElement('span');pillText.className='ft-animal-action-label';
 pill.append(spinner,pillText);stage.insertAdjacentElement('afterend',pill);
 const repeat=document.createElement('button');
 repeat.type='button';repeat.className='ft-animal-rerecord';
 repeat.textContent='눌러서 다시 녹음하기';repeat.hidden=true;
 correction.insertAdjacentElement('afterend',repeat);
 const onAction=control=>{if(!control.hidden&&!control.disabled)circle.click()};
 pill.addEventListener('click',()=>onAction(pill));
 repeat.addEventListener('click',()=>onAction(repeat));
 let relocating=false,updating=false;
 function update(){
  if(updating)return;updating=true;
  try{
   const animal=animals.includes(session.dataset.character)&&!session.hidden;
   const step=questionStage.dataset.step||'';
   const normal=animal&&step!=='score'&&step!=='repeat';
   const repeating=animal&&step==='repeat';
   // Main app moves the original circle for score/repeat and each new
   // question. Do not fight its correction placement.
   if(!relocating&&normal&&circle.parentElement!==anchor){
    relocating=true;anchor.appendChild(circle);relocating=false;
   }
   stage.hidden=!normal;pill.hidden=!normal;repeat.hidden=!repeating;
   if(!animal){session.dataset.animalThinking='false';return}
   const phase=circle.dataset.phase||'ready';
   const recording=circle.dataset.aiRecording==='true'||circle.dataset.listening==='true';
   const transcribing=circle.dataset.transcribing==='true';
   const processing=transcribing||phase==='thinking'||(repeating&&circle.disabled);
   const state=processing?'thinking':recording?'recording':phase==='ai'?'playing':phase==='ready'?'listen':'speak';
   session.dataset.animalThinking=processing?'true':'false';
   const progress=Math.min(100,Math.max(0,parseFloat(circle.style.getPropertyValue('--ft-record-offset'))||0));
   stage.style.setProperty('--ft-animal-record-progress',recording?String(progress):'0');
   stage.dataset.recording=recording?'true':'false';
   const labels={thinking:'생각 중…',recording:'녹음 중…',playing:'듣는 중…',listen:'눌러서 듣기',speak:'눌러서 말하기'};
   pill.dataset.state=state;
   pillText.textContent=labels[state];
   pill.disabled=processing||phase==='ai'||phase==='feedback';
   pill.setAttribute('aria-label',labels[state]);
   if(repeating){
    const text=processing?'확인 중…':recording?'녹음 끝내기':'눌러서 다시 녹음하기';
    repeat.textContent=text;
    repeat.dataset.state=processing?'thinking':recording?'recording':'ready';
    repeat.disabled=processing;
   }
   // Do not show the old recorder instructions next to the new state pill.
  }finally{updating=false}
 }
 const observer=new MutationObserver(update);
 observer.observe(circle,{attributes:true,attributeFilter:['data-phase','data-listening','data-ai-recording','data-transcribing','style','disabled']});
 observer.observe(session,{attributes:true,attributeFilter:['hidden','data-character']});
 observer.observe(questionStage,{attributes:true,attributeFilter:['data-step']});
 observer.observe(voice,{childList:true});
 if(repeatMount)observer.observe(repeatMount,{childList:true});
 update();
})();
