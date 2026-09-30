(function(){
'use strict';
var VERSION='adaptive-2026-09-v2';
var FLOW_VERSION='shared-speaking-phase11';
var overlay=null,speakingInstance=null,speakingState=null,driveTimer=null,lastDrive='';
window.WillenaVisitorV2Config=window.WillenaVisitorV2Config||{};
window.WillenaVisitorV2Config.enabled=false;
window.WillenaVisitorV2Config.version=VERSION;
if(typeof window.WillenaVisitorV2Config.bankReady!=='boolean')window.WillenaVisitorV2Config.bankReady=false;

function isKo(){return(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0}
function studentName(){return String(window.WillenaProspectiveCandidate&&window.WillenaProspectiveCandidate.student_name||'').trim()}
function candidateId(){return String(window.WillenaProspectiveCandidate&&window.WillenaProspectiveCandidate.id||'visitor')}
function speakingKey(){return'willena_visitor_speaking_v1:'+candidateId()}
function ensureContext(){
 var ctx=window.WillenaLevelTestContext=window.WillenaLevelTestContext||{mode:'visitor',setup:{}};
 ctx.mode='visitor';
 ctx.setup=Object.assign({},ctx.setup||{},{source:'willena-visitor',visitor_version:VERSION,visitor_flow:FLOW_VERSION});
 return ctx;
}
function loadSpeaking(){try{return JSON.parse(sessionStorage.getItem(speakingKey())||'null')}catch(_){return null}}
function saveSpeaking(state){speakingState=state;try{sessionStorage.setItem(speakingKey(),JSON.stringify(state))}catch(_){}}
ensureContext();

function installStyle(){
 if(document.getElementById('visitor-v2-style'))return;
 var style=document.createElement('style');
 style.id='visitor-v2-style';
 style.textContent='\
.visitor-v2-overlay{position:fixed;inset:0;z-index:100500;background:linear-gradient(180deg,#effcfd 0%,#fff5f8 100%);overflow:auto;padding:18px;font-family:Poppins,system-ui,sans-serif}.visitor-v2-wrap{width:min(1020px,100%);margin:0 auto;padding:18px 0 38px}.visitor-v2-intro{margin:0 auto 14px;padding:15px 18px;border:1px solid #dbe8ee;border-radius:18px;background:rgba(255,255,255,.9);color:#17243f}.visitor-v2-intro strong{display:block;font-size:16px}.visitor-v2-intro span{display:block;margin-top:4px;color:#71809a;font-size:12px;line-height:1.5}.visitor-v2-overlay .willena-speaking-record{display:none}.visitor-v2-overlay .willena-speaking-actions [data-back]{display:none}.visitor-v2-overlay .willena-speaking-actions{display:flex;justify-content:flex-end}.visitor-v2-card{background:#fff;border:1px solid #dbe8ee;border-radius:30px;padding:clamp(24px,4vw,40px);box-shadow:0 22px 65px rgba(38,66,88,.13)}.visitor-v2-handoff{text-align:center;padding:42px 12px}.visitor-v2-handoff h2{color:#17243f;margin:12px 0 8px}.visitor-v2-handoff p{color:#71809a;line-height:1.55}.visitor-v2-spinner{width:48px;height:48px;margin:0 auto;border:5px solid #dff4f6;border-top-color:#25b9c5;border-radius:50%;animation:v2spin .8s linear infinite}.visitor-v2-go{min-height:58px;border:0;border-radius:17px;padding:0 25px;background:linear-gradient(135deg,#66d7df,#25b9c5);color:#fff;font:800 16px Poppins,system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 24px rgba(37,185,197,.22)}@keyframes v2spin{to{transform:rotate(360deg)}}@media(max-width:650px){.visitor-v2-overlay{padding:9px}.visitor-v2-wrap{padding:8px 0 24px}.visitor-v2-intro{padding:11px 13px;margin-bottom:8px}.visitor-v2-intro strong{font-size:14px}.visitor-v2-intro span{font-size:10px}.visitor-v2-overlay .willena-speaking-actions{display:block}.visitor-v2-overlay .willena-speaking-actions [data-complete]{width:100%}}';
 document.head.appendChild(style);
}

function destroySpeaking(){if(speakingInstance){speakingInstance.destroy();speakingInstance=null}}
function introHtml(){
 var name=studentName();
 if(isKo())return'<div class="visitor-v2-intro"><strong>'+(name?name+' 학생 말하기 평가':'학생 말하기 평가')+'</strong><span>필요한 질문만 사용하고 답변을 1–5점으로 채점하세요. 앱 추천 레벨을 그대로 사용하거나 컴퓨터 테스트 시작 레벨을 직접 바꿀 수 있습니다.</span></div>';
 return'<div class="visitor-v2-intro"><strong>'+(name?'Speaking check · '+name:'Student speaking check')+'</strong><span>Use only the prompts you need and score responses from 1–5. Accept the recommended computer-test start level or override it.</span></div>';
}
function renderSpeaking(){
 installStyle();
 var module=window.WillenaAssessmentSpeaking;
 if(!module||typeof module.create!=='function'){
  console.error('[VisitorPhase11] shared speaking module missing');
  showStartupError();return;
 }
 destroySpeaking();
 if(!overlay){overlay=document.createElement('div');overlay.className='visitor-v2-overlay';document.body.appendChild(overlay)}
 overlay.innerHTML='<div class="visitor-v2-wrap">'+introHtml()+'<div id="visitorSpeakingHost"></div></div>';
 var seed=loadSpeaking()||{current_level:3};
 speakingInstance=module.create({
  host:overlay.querySelector('#visitorSpeakingHost'),
  lang:isKo()?'ko':'en',
  state:seed,
  onChange:function(state){saveSpeaking(state)},
  onComplete:function(state){saveSpeaking(state);beginStudentTest(state)}
 });
 speakingState=speakingInstance.getState();saveSpeaking(speakingState);
}

function stopDrive(){if(driveTimer)clearInterval(driveTimer);driveTimer=null;lastDrive=''}
function showStartupError(){
 stopDrive();installStyle();
 if(!overlay){overlay=document.createElement('div');overlay.className='visitor-v2-overlay';document.body.appendChild(overlay)}
 destroySpeaking();
 overlay.innerHTML='<div class="visitor-v2-wrap"><section class="visitor-v2-card visitor-v2-handoff" role="alert"><h2>'+(isKo()?'테스트를 불러오지 못했어요':'Could not load the test')+'</h2><p>'+(isKo()?'페이지를 새로고침한 뒤 다시 시작해 주세요.':'Please refresh the page and start again.')+'</p><button type="button" class="visitor-v2-go" id="visitorV2Refresh">'+(isKo()?'새로고침':'Refresh')+'</button></section></div>';
 overlay.querySelector('#visitorV2Refresh').onclick=function(){location.reload()};
}
function handoff(startLevel){
 destroySpeaking();
 if(!overlay)return;
 overlay.innerHTML='<div class="visitor-v2-wrap"><section class="visitor-v2-card visitor-v2-handoff"><div class="visitor-v2-spinner"></div><h2>'+(isKo()?'학생 테스트를 준비하고 있어요':'Preparing the student test')+'</h2><p>'+(isKo()?'컴퓨터 테스트 시작 레벨: 내부 '+startLevel+'<br>잠시 후 학생에게 기기를 넘겨 주세요.':'Computer test starting level: Internal '+startLevel+'<br>You can hand the device to the student in a moment.')+'</p></section></div>';
}

function driveSetup(){
 stopDrive();
 var ctx=ensureContext(),candidate=window.WillenaProspectiveCandidate||{},startedAt=Date.now();
 driveTimer=setInterval(function(){
  var card=document.querySelector('.question-card');
  if(card){stopDrive();if(overlay){overlay.remove();overlay=null}return}
  if(document.querySelector('#app .error')||Date.now()-startedAt>=45000){showStartupError();return}
  if(!window.WillenaVisitorV2Config.bankReady)return;
  var actions=[['grade',candidate.setup_grade],['years',0],['listening',1],['length',50]];
  for(var i=0;i<actions.length;i++){
   var key=actions[i][0],value=actions[i][1];if(value==null)continue;
   var holder=document.querySelector('.setup-options[data-key="'+key+'"]');if(!holder)continue;
   var token=key+':'+value;if(lastDrive===token)return;
   var option=holder.querySelector('[data-value="'+value+'"]');
   if(option){lastDrive=token;ctx.setup[key]=Number(value);option.click();return}
  }
 },80);
}

function beginStudentTest(state){
 state=state||speakingState||{};
 var rec=state.recommendation||{},startLevel=Number(state.teacher_selected_start_level),speakingLevel=Number(state.teacher_level)||Number(rec.recommended_level)||startLevel;
 if(!Number.isFinite(startLevel)||startLevel<1||startLevel>12)return;
 if(!Number.isFinite(speakingLevel)||speakingLevel<1||speakingLevel>12)speakingLevel=startLevel;
 var cfg=window.WillenaVisitorV2Config;
 cfg.enabled=true;cfg.version=VERSION;cfg.speakingLevel=speakingLevel;cfg.teacherStartLevel=startLevel;cfg.speakingState=state;
 var ctx=ensureContext(),candidate=window.WillenaProspectiveCandidate||{};
 ctx.setup=Object.assign({},ctx.setup||{}, {
  source:'willena-visitor',visitor_version:VERSION,visitor_flow:FLOW_VERSION,teacher_prior:true,
  speaking_level:speakingLevel,
  speaking_recommended_level:Number(rec.recommended_level)||null,
  speaking_estimate:Number(rec.estimate)||null,
  speaking_confidence:rec.confidence||null,
  speaking_evidence_count:Number(rec.evidence_count)||0,
  speaking_evidence:Array.isArray(state.evidence)?state.evidence:[],
  teacher_speaking_level:Number(state.teacher_level)||null,
  teacher_start_level:startLevel,
  teacher_start_overridden:state.teacher_start_overridden===true,
  teacher_notes:String(state.teacher_notes||''),
  grade:Number(candidate.setup_grade)||null,listening:1,length:50
 });
 try{sessionStorage.setItem('willena_visitor_v2_teacher_assessment',JSON.stringify({version:VERSION,flow:FLOW_VERSION,speaking:state,at:new Date().toISOString()}))}catch(_){}
 handoff(startLevel);
 var recorder=window.WillenaLevelTestRecorder;
 if(recorder&&typeof recorder.syncSetup==='function'){
  recorder.syncSetup().catch(function(error){console.warn('[VisitorPhase11] speaking setup sync failed',error)}).then(driveSetup,driveSetup);
 }else driveSetup();
}

window.addEventListener('willena:candidate-ready',function(){setTimeout(renderSpeaking,0)});
new MutationObserver(function(){if(speakingInstance)speakingInstance.setLanguage(isKo()?'ko':'en')}).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
})();
