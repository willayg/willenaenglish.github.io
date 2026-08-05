(function(){
'use strict';
var completed=false;
var student=null;
var gradePrefill=null;
var gradeApplied=false;
var nativeFetch=window.fetch.bind(window);

// The adaptive loader still requests ./js/app-classic.js. Redirect that one
// request to the open test's source-of-truth engine so both tests always run
// exactly the same core file.
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
 return String(data&&data.name||data&&data.username||data&&data.user_id||'Student').trim();
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
function gradeLabel(bucket,ko){
 var labels=ko?{2:'초등학교 1–2학년',4:'초등학교 3–4학년',6:'초등학교 5–6학년',8:'중학교',9:'고등학교'}:{2:'Elementary 1–2',4:'Elementary 3–4',6:'Elementary 5–6',8:'Middle school',9:'High school'};
 return labels[bucket]||'';
}
function exposeStudent(authData,profileData){
 var profile=profileData&&profileData.success?profileData:null;
 gradePrefill=normalizeGrade(profile&&profile.grade);
 student={
  id:authData.user_id||profile&&profile.id||null,
  name:studentName(profile||authData),
  grade:gradePrefill,
  raw:authData,
  profile:profile
 };
 window.WillenaLevelTestContext={mode:'student',student:student,setup:{grade:gradePrefill}};
 document.documentElement.dataset.studentRecognized='true';
 document.documentElement.dataset.gradePrefilled=gradePrefill===null?'false':'true';
 updateGreeting();
 applyGradePrefill();
}
async function loadStudentProfile(){
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=get_profile&_='+Date.now());
  var data=await response.json().catch(function(){return{}});
  return response.ok&&data.success?data:null;
 }catch(error){
  console.warn('[StudentLevelTest] profile grade lookup failed; grade will be asked',error);
  return null;
 }
}
async function requireStudent(){
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
  var data=await response.json().catch(function(){return{}});
  if(!response.ok||!data.success){signin();return}
  var profile=await loadStudentProfile();
  exposeStudent(data,profile);
  document.documentElement.classList.remove('auth-pending');
 }catch(error){console.error('[StudentLevelTest] auth failed',error);signin()}
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
 var ko=(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0;
 var subtitle=document.getElementById('brandSubtitle');
 if(subtitle)subtitle.textContent=(ko?'안녕하세요, ':'Hi, ')+student.name;
 var welcome=document.querySelector('.welcome-panel h1');
 if(welcome){
  var grade=student.grade!==null?' · '+gradeLabel(student.grade,ko):'';
  welcome.textContent=(ko?'안녕하세요, ':'Hi, ')+student.name+'!'+grade;
 }
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