(function(){
'use strict';
const wrong=new Set();
let correctionMode=false;
let correctionIds=[];
let sessionWrongIds=[];
let lastResultKey='';
let lastQuestionMarker='';

function selection(){return window.WillenaAssignedTestPrep?.selection||{};}
function isSeosul(){
 const s=selection();
 const key=String(s.section||s.practiceType||s.practice_type||'').toLowerCase();
 return key==='constructed_response'||key==='seosul'||!!document.querySelector('#seosulAnswer');
}
function launch(ids){
 const sel=selection(),plan=sel.plan;
 const clean=[...new Set((ids||[]).map(String).filter(Boolean))];
 if(!plan?.id||!sel.lesson||!clean.length)return false;
 correctionMode=true;
 correctionIds=clean;
 sessionWrongIds=[];
 wrong.clear();
 window.WillenaAssignedTestPrep?.startSelection?.(plan.id,sel.lesson,'constructed_response',{reviewMode:true,reviewIds:correctionIds});
 return true;
}

window.addEventListener('testprep:tracking',e=>{
 const d=e.detail||{};
 const practice=String(d.practice_type||'').toLowerCase();
 if(d.type==='attempt_saved'&&practice==='constructed_response'){
  const id=String(d.question_id||'');if(!id)return;
  if(d.is_correct)wrong.delete(id);else wrong.add(id);
  return;
 }
 if(d.type==='session_completed'&&practice==='constructed_response'){
  sessionWrongIds=[...new Set((Array.isArray(d.wrong_ids)?d.wrong_ids:[]).map(String).filter(Boolean))];
 }
});

function resultWrongCount(){
 const result=document.querySelector('#card .result');if(!result)return 0;
 const p=result.textContent||'';
 const m=p.match(/(?:다시 볼 문제|틀린 문제|오답)\s*(\d+)개/);
 return m?Number(m[1])||0:0;
}
function handleQuestionStart(){
 const q=document.querySelector('#card .qnum');if(!q||!isSeosul())return;
 const marker=(q.textContent||'').trim();
 if(marker===lastQuestionMarker)return;
 lastQuestionMarker=marker;
 if(/^1\s*\/\s*20$/.test(marker)&&!correctionMode){wrong.clear();sessionWrongIds=[];lastResultKey='';}
}
function handleResult(){
 const result=document.querySelector('#card .result');if(!result||!isSeosul())return;
 const count=resultWrongCount();
 const key=(result.textContent||'').trim().slice(0,180)+'|'+count+'|'+correctionMode;
 if(key===lastResultKey)return;
 lastResultKey=key;

 if(count>0){
  const ids=sessionWrongIds.length?sessionWrongIds:[...wrong];
  const actions=result.querySelector('.actions');
  if(!actions)return;
  actions.innerHTML=`<button class="primary" id="seosulRequiredRetry">틀린 문제 ${count}개 다시 풀기 →</button>`;
  const btn=document.getElementById('seosulRequiredRetry');
  btn.onclick=()=>{
   btn.disabled=true;btn.textContent='오답을 준비하는 중…';
   setTimeout(()=>{
    if(!launch(ids)){
     btn.disabled=false;
     btn.textContent=`틀린 문제 ${count}개 다시 풀기 →`;
     console.warn('[seosul-required-corrections] retry ids missing',{count,tracked:[...wrong],sessionWrongIds});
    }
   },80);
  };
  return;
 }

 if(correctionMode){
  correctionMode=false;correctionIds=[];sessionWrongIds=[];wrong.clear();
  const actions=result.querySelector('.actions');
  if(actions){
   actions.innerHTML='<button class="primary" id="seosulCorrectionsDone">완료 →</button>';
   document.getElementById('seosulCorrectionsDone').onclick=()=>{
    window.WillenaTestPrepAuth?.refreshStats?.().finally(()=>window.WillenaTestPrepUX?.renderLesson?.(selection()?.plan?.id,selection()?.lesson,'constructed_response'));
   };
  }
 }
}

function tick(){try{handleQuestionStart();handleResult()}catch(e){console.warn('[seosul-required-corrections]',e)}}
setInterval(tick,250);
})();
