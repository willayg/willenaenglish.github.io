(function(){
'use strict';
var completed=false;
var student=null;
var gradePrefill=null;
var gradeApplied=false;
var greetingIndex=Math.floor(Math.random()*3);
var nativeFetch=window.fetch.bind(window);

// Keep the open test engine as the single source of truth.
window.fetch=function(input,init){
 var url=typeof input==='string'?input:(input&&input.url)||'';
 var resolved=new URL(url,location.href);
 if(/(?:^|\/)students\/level-test\/js\/app-classic\.js(?:\?|$)/.test(resolved.pathname+resolved.search)||/^\.\/js\/app-classic\.js(?:\?|$)/.test(url)){
  return nativeFetch('/free-level-test/js/app-classic.js?v=20260731-4',init);
 }
 return nativeFetch(input,init);
};

function signin(){location.replace('/students/signin.html?next='+encodeURIComponent('/students/level-test/'))}
function studentName(data){
 return String(data&&data.name||data&&data.username||'Student').trim();
}
function normalizeGrade(grade){
 var text=String(grade==null?'':grade).trim().toLowerCase();
 if(!text||text==='미정')return null;
 if(/^초?[12]$/.test(text)||/^초등?[학교\s]*[12](?:학년)?$/.test(text))return 2;
 if(/^초?[34]$/.test(text)||/^초등?[학교\s]*[34](?:학년)?$/.test(text))return 4;
 if(/^초?[56]$/.test(text)||/^초등?[학교\s]*[56](?:학년)?$/.test(text))return 6;
 if(/^중[123]$/.test(text)||/^중학교\s*[123](?:학년)?$/.test(text))return 8;
 if(/^고[123]$/.test(text)||/^고등학교\s*[123](?:학년)?$/.test(text))return 9;
 return null;
}
function greeting(name){
 var messages=['Hey, '+name+'!','Hello, '+name+'!','What’s up, '+name+'?'];
 return messages[greetingIndex%messages.length];
}
function exposeStudent(profile){
 gradePrefill=normalizeGrade(profile&&profile.grade);
 student={
  id:profile&&profile.id||null,
  name:studentName(profile),
  grade:gradePrefill,
  profile:profile
 };
 window.WillenaLevelTestContext={mode:'student',student:student,setup:{grade:gradePrefill}};
 document.documentElement.dataset.studentRecognized='true';
 document.documentElement.dataset.gradePrefilled=gradePrefill===null?'false':'true';
 updateGreeting();
 applyGradePrefill();
}
async function requireStudent(){
 try{
  // One authenticated request now handles both login validation and profile data.
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=get_profile&_='+Date.now());
  var profile=await response.json().catch(function(){return{}});
  if(!response.ok||!profile.success){signin();return}
  exposeStudent(profile);
  document.documentElement.classList.remove('auth-pending');
 }catch(error){console.error('[StudentLevelTest] profile lookup failed',error);signin()}
}
function applyGradePrefill(){
 if(gradeApplied||gradePrefill===null)return;
 var holder=document.querySelector('.setup-options[data-key="grade"]');
 if(!holder)return;
 var option=holder.querySelector('[data-value="'+gradePrefill+'"]');
 if(!option)return;
 gradeApplied=true;
 option.setAttribute('data-profile-prefill','true');
 requestAnimationFrame(function(){option.click()});
}
function updateGreeting(){
 if(!student)return;
 var message=greeting(student.name);
 var subtitle=document.getElementById('brandSubtitle');
 if(subtitle)subtitle.textContent=message;
 var welcome=document.querySelector('.welcome-panel h1');
 if(welcome)welcome.textContent=message;
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
new MutationObserver(function(){requestAnimationFrame(function(){updateGreeting();applyGradePrefill();replaceReport()})}).observe(document.documentElement,{childList:true,subtree:true});
requireStudent();
})();