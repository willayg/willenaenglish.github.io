(function(){
'use strict';
var root=document.getElementById('app'),finishing=false;
if(!root)return;
function ko(){return(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0}
function name(){return String(window.WillenaProspectiveCandidate&&window.WillenaProspectiveCandidate.student_name||'').trim()}
function card(state,message){
 var title=state==='done'?(ko()?'정말 잘했어요!':'Great job!'):(state==='error'?(ko()?'저장이 완료되지 않았어요':'The test was not saved'):(ko()?'테스트를 저장하고 있어요':'Saving your test'));
 var icon=state==='done'?'✓':state==='error'?'!':'…';
 var action=state==='error'?'<button class="welcome-start" id="visitorRetrySave" type="button">'+(ko()?'다시 저장하기':'Try saving again')+'</button>':'';
 root.innerHTML='<section class="student-complete"><div class="student-complete-card"><div class="student-complete-icon">'+icon+'</div><h1>'+title+'</h1><p>'+message+'</p>'+action+'</div></section>';
 document.body.classList.remove('welcome-mode');
}
function done(){
 var student=name(),message=ko()?(student?student+' 학생, 테스트를 모두 마쳤어요. 선생님에게 알려 주세요.':'테스트를 모두 마쳤어요. 선생님에게 알려 주세요.'):(student?'You finished the test, '+student+'. Please let your teacher know.':'You finished the test. Please let your teacher know.');
 card('done',message);
}
function save(){
 if(finishing)return;
 var report=root.querySelector('.report-screen');
 if(!report||!window.WillenaLevelTestRecorder)return;
 finishing=true;
 var finishPromise=window.WillenaLevelTestRecorder.finish();
 card('saving',ko()?'잠시만 기다려 주세요.':'Please wait a moment.');
 finishPromise.then(done).catch(function(){
  finishing=false;
  card('error',ko()?'답변은 이 화면에 남아 있습니다. 선생님에게 알려 주세요.':'Your answers are still on this device. Please tell your teacher.');
 });
}
document.addEventListener('click',function(event){
 if(event.target&&event.target.id==='visitorRetrySave')save();
});
window.addEventListener('willena:recording-finished',done);
new MutationObserver(function(){requestAnimationFrame(save)}).observe(root,{childList:true,subtree:true});
save();
})();