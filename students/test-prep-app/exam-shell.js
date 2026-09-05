(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];

function styles(){if($('#exam45Styles'))return;const s=document.createElement('style');s.id='exam45Styles';s.textContent=`
.tp-exam45-card{width:100%;box-sizing:border-box;display:flex;align-items:center;gap:14px;border:1.5px solid #e4cf72;background:linear-gradient(135deg,#fffdf3,#fff8d9);border-radius:20px;padding:16px 18px;margin:14px 0;cursor:pointer;text-align:left;box-shadow:0 8px 24px rgba(123,96,16,.08);font-family:Poppins,'Noto Sans KR',sans-serif;color:#3b3524}
.tp-exam45-card:hover{transform:translateY(-1px);box-shadow:0 10px 28px rgba(123,96,16,.12)}
.tp-exam45-card:disabled{opacity:.55;cursor:wait;transform:none}.tp-exam45-icon{display:grid;place-items:center;flex:0 0 50px;width:50px;height:50px;border-radius:16px;background:#f0c84b;color:#5a4710;font-weight:900;font-size:15px}.tp-exam45-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.tp-exam45-copy b{font-size:16px}.tp-exam45-copy small{font-size:11px;color:#756d53;font-weight:600}.tp-exam45-go{margin-left:auto;font-size:11px;font-weight:900;color:#8b6a0c}
.tp-exam45-active #assignedBackRow{position:relative}.tp-exam45-active #assignedBackRow .quiz-context{white-space:normal}
.exam45-result{padding:28px 18px!important}
@media(max-width:560px){.tp-exam45-card{padding:14px}.tp-exam45-icon{width:44px;height:44px;flex-basis:44px;border-radius:14px}.tp-exam45-copy b{font-size:14px}.tp-exam45-go{display:none}}
`;document.head.appendChild(s)}
function session(){return window.WillenaExamSession}
function planExists(id){return !!window.WillenaTestPrepAuth?.state?.plans?.some(p=>String(p.id)===String(id))}
async function launch(btn,fn){if(btn.disabled)return;btn.disabled=true;const old=btn.querySelector('.tp-exam45-go')?.textContent;if(btn.querySelector('.tp-exam45-go'))btn.querySelector('.tp-exam45-go').textContent='LOADING';try{await fn()}catch(e){console.error('[REV45d] exam launch failed',e);alert(e?.message||'모의고사를 시작하지 못했습니다.');btn.disabled=false;if(btn.querySelector('.tp-exam45-go'))btn.querySelector('.tp-exam45-go').textContent=old||'START →'}}
function button(label,sub){const b=document.createElement('button');b.type='button';b.className='tp-exam45-card';b.innerHTML=`<span class="tp-exam45-icon">25</span><span class="tp-exam45-copy"><b>${label}</b><small>${sub}</small></span><span class="tp-exam45-go">START →</span>`;return b}

function injectLesson(){
 const home=$('#assignmentHome'),subway=home?.querySelector('.tp-subway');if(!home||!subway||home.querySelector('.tp-exam45-lesson'))return;
 const hs=history.state||{},planId=hs.planId,lesson=hs.lesson;if(!planId||!lesson||!planExists(planId))return;
 const b=button('모의고사',`25문제 · ${lesson} 시험 범위 · 모든 지원 문제 유형`);b.classList.add('tp-exam45-lesson');b.onclick=()=>launch(b,()=>session().startLesson(planId,lesson));subway.insertAdjacentElement('afterend',b)
}
function injectAll(){
 const home=$('#assignmentHome');if(!home)return;
 for(const section of $$('.tp-exam-section',home)){
  if(section.querySelector('.tp-exam45-all'))continue;
  const lessons=section.querySelector('.tp-lessons'),first=section.querySelector('.tp-lesson-card[data-lesson-plan]');if(!lessons||!first)continue;
  const planId=first.dataset.lessonPlan;if(!planId||!planExists(planId))continue;
  const b=button('전체 범위 모의고사','25문제 · 모든 Lesson · 문제 유형에 맞는 기존 엔진 사용');b.classList.add('tp-exam45-all');b.onclick=()=>launch(b,()=>session().startAll(planId));lessons.insertAdjacentElement('afterend',b)
 }
}
function inject(){styles();if(history.state?.skill==='exam45')return;injectLesson();injectAll()}
function boot(){styles();inject();const root=$('#assignmentHome')||document.body;new MutationObserver(()=>queueMicrotask(inject)).observe(root,{childList:true,subtree:true});window.addEventListener('popstate',()=>setTimeout(inject,0));window.addEventListener('testprep:student-state-refresh',()=>setTimeout(inject,0))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
