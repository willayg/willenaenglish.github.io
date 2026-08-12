(function(){
'use strict';
var completed=false;
var student=null;
var gradePrefill=null;
var gradeApplied=false;
var resultReady=false;
var saveFailed=false;
var testActive=false;
var allowPageExit=false;
var leaveGuardOpen=false;
var setupSnapshot={grade:null,years:null,listening:null,length:null};
// Declare student mode synchronously. Authentication fills in the student
// later, but the recorder must choose the internal storage/API path while the
// remaining scripts are still loading.
window.WillenaLevelTestContext={mode:'student',student:null,setup:setupSnapshot};
var nativeFetch=window.fetch.bind(window);
var greetingIndex=0;
var AUTH_ENDPOINT='/.netlify/functions/supabase_auth';
var SESSION_REFRESH_INTERVAL=40*60*1000;
var lastSessionRefresh=0;
var sessionRefreshTimer=null;
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

function signin(){allowPageExit=true;location.replace('/students/signin.html?next='+encodeURIComponent('/students/level-test/'))}
function leaveGuard(){
 return document.getElementById('leaveGuard');
}
function showLeaveGuard(){
 if(!testActive||completed||leaveGuardOpen)return;
 var modal=leaveGuard();
 if(!modal)return;
 leaveGuardOpen=true;
 modal.hidden=false;
 document.body.style.overflow='hidden';
 var stay=document.getElementById('leaveGuardStay');
 if(stay)setTimeout(function(){stay.focus()},0);
}
function hideLeaveGuard(){
 var modal=leaveGuard();
 leaveGuardOpen=false;
 if(modal)modal.hidden=true;
 document.body.style.overflow='';
}
function activateLeaveGuard(){
 if(testActive||completed)return;
 testActive=true;
 history.pushState({willenaLevelTestGuard:true},'',location.href);
}
function deactivateLeaveGuard(){
 testActive=false;
 allowPageExit=true;
 hideLeaveGuard();
}
window.addEventListener('popstate',function(){
 if(!testActive||completed||allowPageExit)return;
 history.pushState({willenaLevelTestGuard:true},'',location.href);
 showLeaveGuard();
});
window.addEventListener('beforeunload',function(event){
 if(!testActive||completed||allowPageExit)return;
 event.preventDefault();
 event.returnValue='';
});
document.addEventListener('click',function(event){
 if(event.target&&event.target.id==='leaveGuardStay'){hideLeaveGuard();return}
 if(event.target&&event.target.id==='leaveGuardExit'){
  deactivateLeaveGuard();
  location.href='/students/dashboard.html';
 }
});
document.addEventListener('keydown',function(event){
 if(event.key==='Escape'&&leaveGuardOpen){event.preventDefault();hideLeaveGuard()}
});
function studentName(data){return String(data&&data.name||data&&data.username||'Student').trim()}
async function authRequest(action,params){
 var query=new URLSearchParams(Object.assign({action:action,_:Date.now()},params||{}));
 var response=await WillenaAPI.fetch(AUTH_ENDPOINT+'?'+query.toString(),{credentials:'include',cache:'no-store'});
 var data=await response.json().catch(function(){return{}});
 return{response:response,data:data};
}
async function refreshSession(){
 var result=await authRequest('refresh');
 if(!result.response.ok||!result.data.success)return false;
 if(result.data.access_token&&window.WillenaAPI&&WillenaAPI.setLocalTokens)WillenaAPI.setLocalTokens(result.data.access_token);
 lastSessionRefresh=Date.now();
 return true;
}
async function currentUser(){
 var result=await authRequest('whoami');
 if(result.response.ok&&result.data.success&&result.data.user_id)return result.data;
 if(!await refreshSession())return null;
 result=await authRequest('whoami');
 return result.response.ok&&result.data.success&&result.data.user_id?result.data:null;
}
function keepSessionAlive(){
 if(sessionRefreshTimer)return;
 sessionRefreshTimer=setInterval(function(){refreshSession().catch(function(error){console.debug('[StudentLevelTest] background session refresh failed',error)})},SESSION_REFRESH_INTERVAL);
 window.addEventListener('focus',function(){
  if(Date.now()-lastSessionRefresh>SESSION_REFRESH_INTERVAL/2)refreshSession().catch(function(error){console.debug('[StudentLevelTest] focus session refresh failed',error)});
 });
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
 setupSnapshot.grade=gradePrefill;
 student={id:profile&&profile.id||null,name:studentName(profile),grade:gradePrefill,profile:profile};
 window.WillenaLevelTestContext={mode:'student',student:student,setup:setupSnapshot};
 window.dispatchEvent(new CustomEvent('willena:student-ready',{detail:{student:student}}));
 document.documentElement.dataset.studentRecognized='true';
 document.documentElement.dataset.gradePrefilled=gradePrefill===null?'false':'true';
 updateGreeting();
 applyGradePrefill();
}
async function requireStudent(){
 try{
  // Match the dashboard auth flow: whoami owns identity, profile only adds
  // display fields. A stale access cookie is refreshed once before sign-in.
  var who=await currentUser();
  if(!who){signin();return}
  var profileResult=await authRequest('get_profile',{user_id:who.user_id});
  var profile=profileResult.data;
  if(!profileResult.response.ok||!profile.success){signin();return}
  exposeStudent(Object.assign({},profile,{id:who.user_id}));
  keepSessionAlive();
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
function completionMarkup(){
 var name=student&&student.name?student.name:'';
 return '<section class="student-complete"><div class="student-complete-card"><div class="student-complete-icon">✓</div><h1>Test complete</h1><p>'+(name?name+', ':'')+'your test has been recorded.</p><a href="/students/dashboard.html">Return to student dashboard</a></div></section>';
}
function saveErrorMarkup(){
 return '<section class="student-complete"><div class="student-complete-card"><h1>Almost finished</h1><p>Your answers are safe on this screen, but the test could not be recorded yet.</p><button class="welcome-start" id="retryRecording" type="button">Try saving again</button></div></section>';
}
function replaceReport(){
 if(completed)return;
 var root=document.getElementById('app');
 if(!root)return;
 var resultButton=root.querySelector('#retry,#home');
 var report=root.querySelector('.report-card,.result-card,.result-layout');
 if(!resultButton&&!report)return;
 resultReady=true;
 if(window.WillenaLevelTestRecorder)window.WillenaLevelTestRecorder.finish().catch(function(){});
}
document.addEventListener('click',function(event){
 var option=event.target.closest&&event.target.closest('.setup-option');
 if(!option)return;
 var holder=option.closest('.setup-options');
 var key=holder&&holder.getAttribute('data-key');
 if(!key)return;
 setupSnapshot[key]=Number(option.getAttribute('data-value'));
 if(key==='length'){activateLeaveGuard();setTimeout(function(){if(window.WillenaLevelTestRecorder){var begin=window.WillenaLevelTestRecorder.begin||window.WillenaLevelTestRecorder.start;begin().catch(function(error){console.warn('[StudentLevelTest] attempt start failed',error)})}},0)}
},true);
document.addEventListener('click',function(event){
 if(event.target&&event.target.id==='retryRecording'&&window.WillenaLevelTestRecorder){saveFailed=false;window.WillenaLevelTestRecorder.finish().catch(function(){})}
});
window.addEventListener('willena:recording-finished',function(){
 if(completed||!resultReady)return;
 completed=true;
 deactivateLeaveGuard();
 if(window.speechSynthesis)window.speechSynthesis.cancel();
 var root=document.getElementById('app');if(root)root.innerHTML=completionMarkup();
 document.body.classList.remove('welcome-mode');
});
window.addEventListener('willena:recording-failed',function(){
 if(completed||!resultReady||saveFailed)return;
 saveFailed=true;
 var root=document.getElementById('app');if(root)root.innerHTML=saveErrorMarkup();
});
new MutationObserver(function(){requestAnimationFrame(function(){updateGreeting();applyGradePrefill();replaceReport()})}).observe(document.documentElement,{childList:true,subtree:true});
requireStudent();
})();
