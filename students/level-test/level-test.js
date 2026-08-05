(function(){
'use strict';
var completed=false;
var student=null;
var nativeFetch=window.fetch.bind(window);

// The adaptive loader still requests ./js/app-classic.js. Redirect that one
// request to the open test's source-of-truth engine so both tests always run
// exactly the same core file.
window.fetch=function(input,init){
 var url=typeof input==='string'?input:(input&&input.url)||'';
 if(/(?:^|\/)students\/level-test\/js\/app-classic\.js(?:\?|$)/.test(new URL(url,location.href).pathname+new URL(url,location.href).search)||/^\.\/js\/app-classic\.js(?:\?|$)/.test(url)){
  return nativeFetch('/free-level-test/js/app-classic.js?v=20260731-4',init);
 }
 return nativeFetch(input,init);
};

function signin(){location.replace('/students/signin.html?next='+encodeURIComponent('/students/level-test/'))}
function studentName(data){
 return String(data.display_name||data.student_name||data.full_name||data.name||data.username||data.user_id||'Student').trim();
}
function exposeStudent(data){
 student={
  id:data.user_id||data.id||null,
  name:studentName(data),
  raw:data
 };
 window.WillenaLevelTestContext={mode:'student',student:student,setup:{}};
 document.documentElement.dataset.studentRecognized='true';
 updateGreeting();
}
async function requireStudent(){
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
  var data=await response.json().catch(function(){return{}});
  if(!response.ok||!data.success){signin();return}
  exposeStudent(data);
  document.documentElement.classList.remove('auth-pending');
 }catch(error){console.error('[StudentLevelTest] auth failed',error);signin()}
}
function updateGreeting(){
 if(!student)return;
 var ko=(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0;
 var subtitle=document.getElementById('brandSubtitle');
 if(subtitle)subtitle.textContent=(ko?'안녕하세요, ':'Hi, ')+student.name;
 var welcome=document.querySelector('.welcome-panel h1');
 if(welcome)welcome.textContent=(ko?'안녕하세요, ':'Hi, ')+student.name+'!';
}
function completionMarkup(){
 var ko=(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0;
 var name=student&&student.name?student.name:'';
 return '<section class="student-complete"><div class="student-complete-card"><div class="student-complete-icon">✓</div><h1>'+(ko?'테스트가 끝났습니다':'Test complete')+'</h1><p>'+(ko?(name?name+' 학생, 답변이 완료되었습니다. ': '답변이 완료되었습니다. ')+'결과는 아직 저장되지 않습니다. 다음 단계에서 학생 계정과 데이터베이스에 연결할 예정입니다.':(name?name+', you have completed the test. ':'You have completed the test. ')+'Results are not being saved yet; database wiring will be added next.')+'</p><a href="/students/dashboard.html">'+(ko?'학생 홈으로 돌아가기':'Return to student dashboard')+'</a></div></section>';
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
new MutationObserver(function(){requestAnimationFrame(function(){updateGreeting();replaceReport()})}).observe(document.documentElement,{childList:true,subtree:true});
requireStudent();
})();