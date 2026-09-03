(function(){
'use strict';
const $=(s,r=document)=>r.querySelector(s);
let holding=false,lastSelection=null,wrongIds=new Set(),sessionSeen=false;

function snapshotSelection(){
 const s=window.WillenaAssignedTestPrep?.selection;
 if(s?.plan&&s?.lesson){lastSelection={plan:s.plan,lesson:s.lesson,section:s.section,unitId:s.unitId,bookId:s.bookId,reviewMode:!!s.reviewMode,reviewIds:Array.isArray(s.reviewIds)?[...s.reviewIds]:[]};}
}
function resultVisible(){const card=$('#card');return !!card?.querySelector('.result,.tp-review-result')}
function keepPracticeVisible(){
 if(!holding||!resultVisible())return;
 const home=$('#assignmentHome'),quiz=$('#assignedQuizPane');
 if(home)home.style.display='none';
 if(quiz)quiz.style.display='block';
 const s=lastSelection||window.WillenaAssignedTestPrep?.selection;
 if(history.state?.tp!=='practice'&&s){
  const cur=history.state||{};
  history.replaceState({...cur,tp:'practice',planId:s.plan?.id||cur.planId||null,lesson:s.lesson||cur.lesson||null,skill:s.section||cur.skill||null,returnTo:cur.returnTo||'lesson',review:!!s.reviewMode},'',location.href);
 }
 addSeosulRetry();
}
function addSeosulRetry(){
 const card=$('#card');
 if(!card||!resultVisible()||!wrongIds.size||card.querySelector('#retry,.tp-result-retry-wrong,.tp-review-next'))return;
 const isSeosul=String(lastSelection?.section||window.WillenaAssignedTestPrep?.selection?.section||'').toLowerCase();
 if(!['constructed_response','seosul'].includes(isSeosul))return;
 const actions=card.querySelector('.actions')||card.querySelector('.result');
 if(!actions)return;
 const b=document.createElement('button');
 b.type='button';b.className='primary tp-result-retry-wrong';b.textContent='오답 다시 풀기';
 b.onclick=async()=>{
  const snap=lastSelection||window.WillenaAssignedTestPrep?.selection;if(!snap)return;
  holding=false;
  const live=window.WillenaAssignedTestPrep?.selection;
  if(live){live.reviewMode=true;live.reviewIds=[...wrongIds];}
  const quiz=$('#assignedQuizPane'),home=$('#assignmentHome');if(home)home.style.display='none';if(quiz)quiz.style.display='block';
  await window.WillenaSeosulEngine?.start?.({unitId:snap.unitId,lesson:snap.lesson,plan:snap.plan,reviewMode:true,reviewIds:[...wrongIds]});
 };
 actions.appendChild(b);
}
function beginHold(){
 if(!resultVisible())return;
 snapshotSelection();
 holding=true;
 keepPracticeVisible();
}
function releaseIfQuestion(){if(holding&&!resultVisible()){holding=false}}

window.addEventListener('testprep:tracking',e=>{
 const d=e.detail||{};
 if(d.type==='session_started'){wrongIds.clear();sessionSeen=true;snapshotSelection();return;}
 if(d.type==='attempt_saved'){
  snapshotSelection();
  if(d.is_correct===false&&d.question_id)wrongIds.add(String(d.question_id));
  else if(d.is_correct===true&&d.corrected_previous&&d.question_id)wrongIds.delete(String(d.question_id));
  return;
 }
 if(d.type==='session_completed')setTimeout(beginHold,0);
});

document.addEventListener('click',e=>{
 const t=e.target instanceof Element?e.target:null;if(!t)return;
 if(t.closest('.back-assign,.tp-back')){holding=false;return;}
 if(t.closest('#retry,#again,#authoredAgain,#seosulAgain,.tp-result-retry-wrong')){holding=false;return;}
},true);

function boot(){
 snapshotSelection();
 const card=$('#card');
 if(card)new MutationObserver(()=>queueMicrotask(()=>{snapshotSelection();if(resultVisible())beginHold();else releaseIfQuestion()})).observe(card,{childList:true,subtree:true});
 window.addEventListener('testprep:student-state-refresh',()=>setTimeout(keepPracticeVisible,0));
 setInterval(()=>{snapshotSelection();if(resultVisible())beginHold();keepPracticeVisible()},500);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
