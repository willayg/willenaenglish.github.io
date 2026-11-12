// Keep the strongest recognized attempt for the current speaking question.
// A later STT failure can never lower an already achieved grade.
export function createSpeakingBestProgress(host){
 const controls=host?.querySelector('.speaking-control');
 const mic=controls?.querySelector('[data-speaking-mic]');
 const meter=document.createElement('div');meter.className='speaking-best-meter';
 meter.setAttribute('role','progressbar');meter.setAttribute('aria-label','최고 말하기 점수');
 meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','4');meter.setAttribute('aria-valuenow','0');
 meter.innerHTML='<div class="speaking-best-track"><div class="speaking-best-fill"></div></div>';
 if(mic)mic.insertAdjacentElement('afterend',meter);
 let best={points:0,level:'red',transcript:'',alternatives:[],matchedBy:null,correct:false};
 const palette={green:['#168345','#ebfff2','#77c99a'],lime:['#719D19','#f0fbd7','#B5DB70'],
  yellow:['#A87C07','#fff8da','#F1D079'],orange:['#B9631A','#fff0df','#F3B477'],red:['#cf304c','#fff0f2','#efa4ae']};
 const render=()=>{
  const [fg,bg,border]=palette[best.level]||palette.red;
  meter.style.setProperty('--best-color',fg);meter.querySelector('.speaking-best-fill').style.width=best.points*25+'%';
  meter.setAttribute('aria-valuenow',String(best.points));
  const preview=host?.querySelector('[data-speaking-transcript]');
  if(preview&&best.points>0){
   preview.hidden=false;
   preview.textContent='“'+best.transcript+'”';
   preview.dataset.accepted=best.level==='green'?'true':best.level;
   preview.style.setProperty('color',fg,'important');
   preview.style.setProperty('background-color',bg,'important');
   preview.style.setProperty('border-color',border,'important');
  }
 };
 return {
  observe(grade,alternatives){
   if(Number(grade?.points)>best.points){
    best={...grade,alternatives:Array.isArray(alternatives)?alternatives.slice(0,5):[String(grade.transcript||'')]};
   }
   render();return best;
  },
  get best(){return best},
  render,
  dispose(){meter.remove()}
 };
}
