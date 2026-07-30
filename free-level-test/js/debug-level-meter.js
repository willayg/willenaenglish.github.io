function ensureMeter(){
  let meter=document.querySelector("#debugLevelMeter");
  if(meter)return meter;
  meter=document.createElement("aside");
  meter.id="debugLevelMeter";
  meter.className="debug-level-meter";
  meter.setAttribute("aria-live","polite");
  meter.innerHTML=`
    <div class="debug-level-meter__top">
      <span class="debug-level-meter__label">Testing level</span>
      <strong class="debug-level-meter__value">—</strong>
    </div>
    <div class="debug-level-meter__track" aria-label="Question level from 1 to 10">
      ${Array.from({length:10},(_,i)=>`<span data-level="${i+1}"><b>${i+1}</b></span>`).join("")}
    </div>
  `;
  document.body.appendChild(meter);
  return meter;
}

function updateMeter(){
  const meter=ensureMeter();
  const card=document.querySelector(".question-card[data-question-level]");
  const level=Number(card?.dataset.questionLevel);
  const visible=Number.isFinite(level)&&level>=1&&level<=10;
  meter.classList.toggle("is-visible",visible);
  if(!visible)return;
  meter.querySelector(".debug-level-meter__value").textContent=`Level ${level}`;
  meter.querySelectorAll(".debug-level-meter__track span").forEach(segment=>{
    const segmentLevel=Number(segment.dataset.level);
    segment.classList.toggle("is-passed",segmentLevel<level);
    segment.classList.toggle("is-current",segmentLevel===level);
  });
}

const observer=new MutationObserver(()=>requestAnimationFrame(updateMeter));
observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["data-question-level"]});
updateMeter();