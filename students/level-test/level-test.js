(function(){
'use strict';
var completed=false;
var student=null;
var gradePrefill=null;
var gradeApplied=false;
var attemptId=null;
var attemptStartedAt=null;
var attemptStarting=false;
var attemptCompleting=false;
var setupSnapshot={grade:null,years:null,listening:null,length:null};
var nativeFetch=window.fetch.bind(window);
var greetingIndex=0;
try{
 var previous=Number(sessionStorage.getItem('willenaLevelGreeting')||'-1');
 greetingIndex=(previous+1)%3;
 sessionStorage.setItem('willenaLevelGreeting',String(greetingIndex));
}catch(error){greetingIndex=Math.floor(Math.random()*3)}

// Keep the open test engine as the single source of truth.
window.fetch=function(input,init){
 var url=typeof input==='string'?input:(input&&input.url)||'';
 var resolved=new URL(url,location.href);
 if(/(?:^|\/)students\/level-test\/js\/app-classic\.js(?:\?|$)/.test(resolved.pathname+resolved.search)||/^\.\/js\/app-classic\.js(?:\?|$)/.test(url)){
  return nativeFetch('/free-level-test/js/app-classic.js?v=20260731-4',init);
 }
 return nativeFetch(input,init);
};

function api(action,body){
 return WillenaAPI.fetch('/.netlify/functions/supabase_auth?action='+encodeURIComponent(action),{
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body:JSON.stringify(body||{})
 });
}
function signin(){location.replace('/students/signin.html?next='+encodeURIComponent('/students/level-test/'))}
function studentName(data){return String(data&&data.name||data&&data.username||'Student').trim()}
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
 setupSnapshot.grade=gradePrefill;
 student={id:profile&&profile.id||null,name:studentName(profile),grade:gradePrefill,profile:profile};
 window.WillenaLevelTestContext={mode:'student',student:student,setup:{grade:gradePrefill}};
 document.documentElement.dataset.studentRecognized='true';
 document.documentElement.dataset.gradePrefilled=gradePrefill===null?'false':'true';
 updateGreeting();
 applyGradePrefill();
}
async function requireStudent(){
 try{
  var response=await WillenaAPI.fetch('/.netlify/functions/supabase_auth?action=get_profile&_='+Date.now());
  var profile=await response.json().catch(function(){return{}});
  if(!response.ok||!profile.success){signin();return}
  exposeStudent(profile);
  if(window.__studentLoadingTimer)clearInterval(window.__studentLoadingTimer);
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
async function startAttempt(){
 if(attemptId||attemptStarting||!student)return;
 attemptStarting=true;
 attemptStartedAt=Date.now();
 try{
  var response=await api('start_internal_assessment',{setup:setupSnapshot,test_version:'2026-08-v1'});
  var data=await response.json().catch(function(){return{}});
  if(response.ok&&data.success&&data.attempt_id)attemptId=data.attempt_id;
  else console.warn('[StudentLevelTest] attempt start was not saved',data);
 }catch(error){console.warn('[StudentLevelTest] attempt start failed',error)}
 attemptStarting=false;
}
async function completeAttempt(reportText){
 if(attemptCompleting||!attemptId)return;
 attemptCompleting=true;
 try{
  var duration=attemptStartedAt?Math.max(0,Math.round((Date.now()-attemptStartedAt)/1000)):null;
  var response=await api('complete_internal_assessment',{
   attempt_id:attemptId,
   duration_seconds:duration,
   setup:setupSnapshot,
   report_text:String(reportText||'').trim()
  });
  var data=await response.json().catch(function(){return{}});
  if(!response.ok||!data.success)console.warn('[StudentLevelTest] attempt completion was not saved',data);
 }catch(error){console.warn('[StudentLevelTest] attempt completion failed',error)}
}
function completionMarkup(){
 var name=student&&student.name?student.name:'';
 return '<section class="student-complete"><div class="student-complete-card"><div class="student-complete-icon">✓</div><h1>Test complete</h1><p>'+(name?name+', ':'')+'your test has been recorded.</p><a href="/students/dashboard.html">Return to student dashboard</a></div></section>';
}
function replaceReport(){
 if(completed)return;
 var root=document.getElementById('app');
 if(!root)return;
 var resultButton=root.querySelector('#retry,#home');
 var report=root.querySelector('.report-card,.result-card,.result-layout');
 if(!resultButton&&!report)return;
 completed=true;
 completeAttempt(root.innerText||'');
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 root.innerHTML=completionMarkup();
 document.body.classList.remove('welcome-mode');
}
document.addEventListener('click',function(event){
 var option=event.target.closest&&event.target.closest('.setup-option');
 if(!option)return;
 var holder=option.closest('.setup-options');
 var key=holder&&holder.getAttribute('data-key');
 if(!key)return;
 setupSnapshot[key]=Number(option.getAttribute('data-value'));
 if(key==='length')setTimeout(startAttempt,0);
},true);
new MutationObserver(function(){requestAnimationFrame(function(){updateGreeting();applyGradePrefill();replaceReport()})}).observe(document.documentElement,{childList:true,subtree:true});
requireStudent();
})();