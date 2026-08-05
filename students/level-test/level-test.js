(function(){
'use strict';
var completed=false;
function signin(){location.replace('/students/signin.html?next='+encodeURIComponent('/students/level-test/'))}
async function requireStudent(){
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
  var data=await response.json().catch(function(){return{}});
  if(!response.ok||!data.success){signin();return}
  document.documentElement.classList.remove('auth-pending');
 }catch(error){console.error('[StudentLevelTest] auth failed',error);signin()}
}
function completionMarkup(){
 var ko=(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0;
 return '<section class="student-complete"><div class="student-complete-card"><div class="student-complete-icon">✓</div><h1>'+(ko?'테스트가 끝났습니다':'Test complete')+'</h1><p>'+(ko?'답변이 완료되었습니다. 결과는 아직 저장되지 않습니다. 다음 단계에서 학생 계정과 데이터베이스에 연결할 예정입니다.':'You have completed the test. Results are not being saved yet; database wiring will be added next.')+'</p><a href="/students/dashboard.html">'+(ko?'학생 홈으로 돌아가기':'Return to student dashboard')+'</a></div></section>';
}
function replaceReport(){
 if(completed)return;
 var root=document.getElementById('app');
 if(!root)return;
 var resultButton=root.querySelector('#retry,#home');
 var report=root.querySelector('.report-card,.result-card,.result-layout');
 if(!resultButton&&!report)return;
 completed=true;
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 root.innerHTML=completionMarkup();
 document.body.classList.remove('welcome-mode');
}
new MutationObserver(function(){requestAnimationFrame(replaceReport)}).observe(document.documentElement,{childList:true,subtree:true});
requireStudent();
})();