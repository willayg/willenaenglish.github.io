import{loadQuestionBank}from"./assessment-loader.js?v=20260730-1";

const root=document.querySelector("#app");
const langBtn=document.querySelector("#languageBtn");
let bank=[];
let lang="ko";
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const shuffle=a=>[...a].sort(()=>Math.random()-.5);
const T={
  en:{title:"Level Test",start:"Start",grade:"What school stage is the learner in?",years:"How long has the learner studied English?",length:"How detailed should the test be?",preschool:"Preschool",e12:"Elementary 1–2",e34:"Elementary 3–4",e56:"Elementary 5–6",middle:"Middle school",older:"High school or adult",none:"Not yet",under1:"Less than 1 year",y12:"1–2 years",y35:"3–5 years",over5:"More than 5 years",q20:"Quick · 20 questions",q30:"Standard · 30 questions",q40:"Detailed · 40 questions",back:"Back",question:"Question",next:"Next",result:"Estimated level",broad:"This is a broad starting point based on adaptive questions.",answered:"Questions answered",correct:"Correct answers",retry:"Try again",home:"Back to start",loadFail:"Could not load the test"},
  ko:{title:"레벨 테스트",start:"시작하기",grade:"학생의 현재 학교 단계는 무엇인가요?",years:"영어를 얼마나 오래 공부했나요?",length:"어느 정도 자세한 테스트를 원하시나요?",preschool:"유치원",e12:"초등학교 1–2학년",e34:"초등학교 3–4학년",e56:"초등학교 5–6학년",middle:"중학교",older:"고등학생 또는 성인",none:"아직 배우지 않음",under1:"1년 미만",y12:"1–2년",y35:"3–5년",over5:"5년 이상",q20:"간단 · 20문제",q30:"기본 · 30문제",q40:"자세히 · 40문제",back:"뒤로",question:"문제",next:"다음",result:"예상 영어 단계",broad:"적응형 문제 결과를 바탕으로 한 대략적인 시작 단계입니다.",answered:"푼 문제",correct:"정답",retry:"다시 하기",home:"처음으로",loadFail:"테스트를 불러올 수 없습니다"}
};
const tx=k=>T[lang][k]||k;
let S={view:"setup",step:0,setup:{grade:2,years:1,length:30},ability:2,maxQ:30,used:new Set(),answers:[],current:null,selected:null,wrongByLevel:{}};
function screen(html){root.innerHTML=`<section class="screen">${html}</section>`}
function chrome(){document.documentElement.lang=lang;langBtn.textContent=lang==="ko"?"English":"한국어"}
langBtn.onclick=()=>{lang=lang==="ko"?"en":"ko";chrome();render()};
function optionButtons(items,key){return `<div class="option-grid">${items.map(([v,label])=>`<button class="route-card" data-key="${key}" data-value="${v}"><strong>${label}</strong><span>→</span></button>`).join("")}</div>`}
function setup(){
  if(S.step===0){screen(`<span class="eyebrow">Willena English</span><h1>${tx("title")}</h1><p class="lead">100 carefully authored questions across Levels 1–10.</p><div class="actions"><button class="btn btn-primary" id="startSetup">${tx("start")} →</button></div>`);return}
  if(S.step===1){screen(`<div class="step-meta"><span>1 / 3</span></div><h2>${tx("grade")}</h2>${optionButtons([[1,tx("preschool")],[2,tx("e12")],[4,tx("e34")],[6,tx("e56")],[8,tx("middle")],[9,tx("older")]],"grade")}<div class="actions"><button class="btn btn-ghost" id="back">${tx("back")}</button></div>`);return}
  if(S.step===2){screen(`<div class="step-meta"><span>2 / 3</span></div><h2>${tx("years")}</h2>${optionButtons([[0,tx("none")],[1,tx("under1")],[2,tx("y12")],[4,tx("y35")],[6,tx("over5")]],"years")}<div class="actions"><button class="btn btn-ghost" id="back">${tx("back")}</button></div>`);return}
  screen(`<div class="step-meta"><span>3 / 3</span></div><h2>${tx("length")}</h2>${optionButtons([[20,tx("q20")],[30,tx("q30")],[40,tx("q40")]],"length")}<div class="actions"><button class="btn btn-ghost" id="back">${tx("back")}</button></div>`)
}
root.addEventListener("click",e=>{
  if(e.target.closest("#startSetup")){S.step=1;render();return}
  if(e.target.closest("#back")){S.step=Math.max(0,S.step-1);render();return}
  const option=e.target.closest("[data-key]");if(!option)return;
  S.setup[option.dataset.key]=Number(option.dataset.value);
  if(S.step===3){startTest();return}
  S.step++;render();
});
function startAbility(years,grade){return clamp(1+(years*1.15)+((grade-1)*.45),1,9.2)}
function startTest(){S={...S,view:"test",ability:startAbility(S.setup.years,S.setup.grade),maxQ:S.setup.length,used:new Set(),answers:[],current:null,selected:null,wrongByLevel:{}};nextQuestion()}
function pickQuestion(){const target=clamp(Math.round(S.ability),1,10);const pool=bank.filter(q=>!S.used.has(q.id));if(!pool.length)return null;return pool.map(q=>({q,d:Math.abs(q.level-target)+Math.random()*.45})).sort((a,b)=>a.d-b.d)[0].q}
function nextQuestion(){if(S.answers.length>=S.maxQ){finish();return}S.current=pickQuestion();if(!S.current){finish();return}S.used.add(S.current.id);S.selected=null;renderTest()}
function esc(s){return String(s).replaceAll("&","&amp;").replaceAll('"',"&quot;")}
function renderTest(){const q=S.current,n=S.answers.length+1;screen(`<div class="question-meta"><span>${tx("question")} ${n}</span><span>${n} / ${S.maxQ}</span></div><div class="progress"><i style="width:${(S.answers.length/S.maxQ)*100}%"></i></div><div class="question-card"><p class="prompt">${q.q}</p><div class="choices">${shuffle(q.choices).map(c=>`<button class="choice" data-value="${esc(c)}">${c}</button>`).join("")}</div></div><div class="actions"><button class="btn btn-primary" id="next" disabled>${tx("next")} →</button></div>`)}
root.addEventListener("click",e=>{const choice=e.target.closest(".choice");if(choice){document.querySelectorAll(".choice").forEach(x=>x.classList.remove("selected"));choice.classList.add("selected");S.selected=choice.dataset.value;document.querySelector("#next").disabled=false;return}if(e.target.closest("#next"))submit();if(e.target.closest("#retry")||e.target.closest("#home")){S.view="setup";S.step=0;render()}});
function submit(){const q=S.current,ok=S.selected===q.a;const expected=1/(1+Math.exp((q.level-S.ability)*1.1));let delta=.85*((ok?1:0)-expected);if(!ok)S.wrongByLevel[q.level]=(S.wrongByLevel[q.level]||0)+1;S.ability=clamp(S.ability+delta,1,10);S.answers.push({id:q.id,level:q.level,correct:ok,selected:S.selected,answer:q.a});nextQuestion()}
function finish(){const level=clamp(Math.round(S.ability),1,10),correct=S.answers.filter(x=>x.correct).length;S.view="result";S.result={level,correct};render()}
function result(){screen(`<span class="eyebrow">${tx("result")}</span><div class="result-title">Level ${S.result.level}</div><p class="lead">${tx("broad")}</p><div class="result-grid"><div class="result-card"><span>${tx("answered")}</span><strong>${S.answers.length}</strong></div><div class="result-card"><span>${tx("correct")}</span><strong>${S.result.correct}</strong></div></div><div class="actions"><button class="btn btn-primary" id="retry">${tx("retry")}</button><button class="btn btn-ghost" id="home">${tx("home")}</button></div>`)}
function render(){S.view==="test"?renderTest():S.view==="result"?result():setup()}
loadQuestionBank().then(rows=>{bank=rows;chrome();render()}).catch(error=>screen(`<h2>${tx("loadFail")}</h2><p class="error">${error.message}</p>`));
