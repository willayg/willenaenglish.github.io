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
 return String(data.display_name||data.student_name||data.full_name||data.name||data.username||data.user_id||'Student').trim();
}
function firstValue(object,keys){
 for(var i=0;i<keys.length;i++){
  var value=object&&object[keys[i]];
  if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;
 }
 return null;
}
function directEngineGrade(profile){
 var value=firstValue(profile,['level_test_grade','level_test_stage','setup_grade','assessment_grade_bucket']);
 var number=Number(value);
 return [1,2,4,6,8,9].indexOf(number)>=0?number:null;
}
function normalizeGrade(profile){
 if(!profile)return null;
 var direct=directEngineGrade(profile);
 if(direct!==null)return direct;

 var raw=firstValue(profile,['school_grade','current_grade','student_grade','grade_level','grade','year_level','year','class_grade']);
 var stage=String(firstValue(profile,['school_type','school_stage','education_stage','stage','grade_type'])||'').toLowerCase();
 var text=String(raw==null?'':raw).trim().toLowerCase();
 var combined=(stage+' '+text).replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
 if(!combined)return null;

 if(/유치|유아|kindergarten|preschool|pre school|kinder/.test(combined))return 1;
 if(/고등|고교|high school|\bhs\b/.test(combined))return 9;
 if(/중학|중학교|middle school|junior high|\bms\b/.test(combined))return 8;

 var elementary=/초등|초등학교|elementary|primary|grade school|\bes\b/.test(combined);
 var match=combined.match(/(?:grade|year|학년|초|elementary|primary)?\s*([1-6])(?:\s*(?:학년|grade|year))?/);
 var number=match?Number(match[1]):Number(text);
 if(elementary&&number>=1&&number<=6){
  if(number<=2)return 2;
  if(number<=4)return 4;
  return 6;
 }

 // A bare 1–6 is only safe when a separate stage field explicitly says elementary.
 if(/elementary|primary|초등/.test(stage)&&number>=1&&number<=6){
  return number<=2?2:number<=4?4:6;
 }
 if(/middle|junior|중학/.test(stage))return 8;
 if(/high|고등/.test(stage))return 9;
 return null;
}
function gradeLabel(bucket,ko){
 var labels=ko?{1:'유치원',2:'초등학교 1–2학년',4:'초등학교 3–4학년',6:'초등학교 5–6학년',8:'중학교',9:'고등학교'}:{1:'Preschool',2:'Elementary 1–2',4:'Elementary 3–4',6:'Elementary 5–6',8:'Middle school',9:'High school'};
 return labels[bucket]||'';
}
function exposeStudent(data,profile){
 gradePrefill=normalizeGrade(profile);
 student={
  id:data.user_id||data.id||null,
  name:studentName(profile&&profile.success?profile:data),
  grade:gradePrefill,
  raw:data,
  profile:profile||null
 };
 window.WillenaLevelTestContext={mode:'student',student:student,setup:{grade:gradePrefill}};
 document.documentElement.dataset.studentRecognized='true';
 document.documentElement.dataset.gradePrefilled=gradePrefill===null?'false':'true';
 updateGreeting();
 applyGradePrefill();
}
async function loadProfile(){
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=get_profile&_='+Date.now());
  var data=await response.json().catch(function(){return{}});
  return response.ok&&data.success?data:null;
 }catch(error){
  console.warn('[StudentLevelTest] profile lookup failed; grade will be asked',error);
  return null;
 }
}
async function requireStudent(){
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=whoami&_='+Date.now());
  var data=await response.json().catch(function(){return{}});
  if(!response.ok||!data.success){signin();return}
  var profile=await loadProfile();
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