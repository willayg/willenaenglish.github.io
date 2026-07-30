import{loadQuestionBank}from"./assessment-loader.js?v=20260730-8";

const clean=value=>String(value??"").trim().replace(/\s+/g," ");
let bank=[];

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

function currentQuestion(){
  const card=document.querySelector(".question-card");
  if(!card)return null;
  const scrambleTokens=[...card.querySelectorAll(".scramble-token")].map(x=>clean(x.textContent)).sort();
  if(scrambleTokens.length){
    return bank.find(q=>q.type==="sentence_unscramble"&&[...q.tokens].map(clean).sort().join("|")===scrambleTokens.join("|"))||null;
  }
  const prompt=clean(card.querySelector(".prompt")?.textContent);
  const choices=[...card.querySelectorAll(".choice")].map(x=>clean(x.textContent)).sort();
  return bank.find(q=>clean(q.q)===prompt&&[...q.choices].map(clean).sort().join("|")===choices.join("|"))||bank.find(q=>clean(q.q)===prompt)||null;
}

function updateMeter(){
  const meter=ensureMeter();
  const question=currentQuestion();
  const visible=Boolean(document.querySelector(".question-card")&&question);
  meter.classList.toggle("is-visible",visible);
  if(!visible)return;
  const level=Math.max(1,Math.min(10,Number(question.level)||1));
  meter.querySelector(".debug-level-meter__value").textContent=`Level ${level}`;
  meter.querySelectorAll(".debug-level-meter__track span").forEach(segment=>{
    const segmentLevel=Number(segment.dataset.level);
    segment.classList.toggle("is-passed",segmentLevel<level);
    segment.classList.toggle("is-current",segmentLevel===level);
  });
}

const observer=new MutationObserver(()=>requestAnimationFrame(updateMeter));
observer.observe(document.body,{childList:true,subtree:true,characterData:true});
loadQuestionBank().then(items=>{bank=items;updateMeter()}).catch(error=>console.warn("Level meter could not load the assessment bank",error));
updateMeter();