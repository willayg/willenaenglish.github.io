import{loadQuestionBank}from"./assessment-loader.js?v=20260730-6";

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
    <div class="debug-level-meter__gauge" aria-label="Question level from 1 to 10">
      <div class="debug-level-meter__needle" aria-hidden="true"><i></i></div>
      <div class="debug-level-meter__bar"><i></i></div>
      <div class="debug-level-meter__scale"><span>1</span><span>5</span><span>10</span></div>
    </div>
  `;
  document.body.appendChild(meter);
  return meter;
}

function currentQuestionSignature(){
  const prompt=document.querySelector(".question-card .prompt");
  if(!prompt)return null;
  const choices=[...document.querySelectorAll(".question-card .choice")].map(button=>clean(button.textContent)).sort();
  return{prompt:clean(prompt.textContent),choices};
}

function findQuestion(signature){
  if(!signature)return null;
  return bank.find(question=>{
    if(clean(question.q)!==signature.prompt)return false;
    const choices=[...question.choices].map(clean).sort();
    return choices.length===signature.choices.length&&choices.every((choice,index)=>choice===signature.choices[index]);
  })||bank.find(question=>clean(question.q)===signature.prompt)||null;
}

function updateMeter(){
  const meter=ensureMeter();
  const question=findQuestion(currentQuestionSignature());
  const visible=Boolean(document.querySelector(".question-card")&&question);
  meter.classList.toggle("is-visible",visible);
  if(!visible)return;
  const level=Math.max(1,Math.min(10,Number(question.level)||1));
  const position=((level-1)/9)*100;
  meter.querySelector(".debug-level-meter__value").textContent=`Level ${level}`;
  meter.style.setProperty("--level-position",`${position}%`);
}

const observer=new MutationObserver(()=>requestAnimationFrame(updateMeter));
observer.observe(document.body,{childList:true,subtree:true,characterData:true});

loadQuestionBank().then(items=>{bank=items;updateMeter()}).catch(error=>console.warn("Level meter could not load the assessment bank",error));
updateMeter();