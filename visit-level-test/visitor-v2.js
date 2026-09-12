(function(){
'use strict';
var VERSION='adaptive-2026-09-v2';
var overlay=null,speakingLevel=null,startLevel=null,driveTimer=null,lastDrive='';
window.WillenaVisitorV2Config=window.WillenaVisitorV2Config||{enabled:false,version:VERSION,speakingLevel:null,teacherStartLevel:null};

function isKo(){return(document.documentElement.lang||'ko').toLowerCase().indexOf('ko')===0}
function publicLabel(level){level=Number(level)||1;return level<=2?'Starter '+level:'Public Level '+(level-2)}
function studentName(){return String(window.WillenaProspectiveCandidate&&window.WillenaProspectiveCandidate.student_name||'').trim()}
function ensureContext(){
 var ctx=window.WillenaLevelTestContext=window.WillenaLevelTestContext||{mode:'visitor',setup:{}};
 ctx.mode='visitor';
 ctx.setup=Object.assign({},ctx.setup||{},{source:'willena-visitor',visitor_version:VERSION});
 return ctx;
}
ensureContext();

function installStyle(){
 if(document.getElementById('visitor-v2-style'))return;
 var style=document.createElement('style');
 style.id='visitor-v2-style';
 style.textContent='\
.visitor-v2-overlay{position:fixed;inset:0;z-index:100500;background:linear-gradient(180deg,#effcfd 0%,#fff5f8 100%);overflow:auto;padding:18px;font-family:Poppins,system-ui,sans-serif}.visitor-v2-wrap{width:min(900px,100%);margin:0 auto;padding:18px 0 38px}.visitor-v2-card{background:#fff;border:1px solid #dbe8ee;border-radius:30px;padding:clamp(24px,4vw,40px);box-shadow:0 22px 65px rgba(38,66,88,.13)}.visitor-v2-kicker{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border-radius:999px;background:#eefbfc;color:#178f99;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}.visitor-v2-card h1{margin:14px 0 8px;color:#17243f;font-size:clamp(28px,5vw,42px);line-height:1.15}.visitor-v2-lead{margin:0 0 24px;color:#6d7d96;line-height:1.65;font-weight:500}.visitor-v2-guide{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 28px}.visitor-v2-guide div{border:1px solid #e1e9ee;border-radius:18px;padding:14px;background:#fbfdfe}.visitor-v2-guide strong{display:block;color:#17243f;margin-bottom:5px}.visitor-v2-guide span{display:block;color:#71809a;font-size:13px;line-height:1.45}.visitor-v2-label{margin:0 0 10px;color:#17243f;font-weight:800}.visitor-v2-levels{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}.visitor-v2-level{min-height:68px;border:1px solid #d8e4ea;border-radius:16px;background:#fff;color:#17243f;font:800 19px Poppins,system-ui,sans-serif;cursor:pointer;transition:.15s}.visitor-v2-level small{display:block;margin-top:2px;color:#8792a7;font-size:10px;font-weight:700}.visitor-v2-level:hover{transform:translateY(-1px);border-color:#66d7df}.visitor-v2-level.selected{border-color:#25b9c5;background:#effcfd;box-shadow:0 0 0 3px rgba(37,185,197,.12)}.visitor-v2-start{margin-top:24px;padding:18px;border-radius:20px;background:#f8fafc;border:1px solid #e3e9ee;display:flex;align-items:center;justify-content:space-between;gap:14px}.visitor-v2-start-copy strong{display:block;color:#17243f}.visitor-v2-start-copy span{display:block;color:#7a879b;font-size:13px;margin-top:3px}.visitor-v2-stepper{display:flex;align-items:center;gap:10px}.visitor-v2-stepper button{width:42px;height:42px;border:0;border-radius:13px;background:#fff;color:#17243f;font-size:22px;font-weight:800;box-shadow:0 2px 8px rgba(30,50,70,.1);cursor:pointer}.visitor-v2-stepper output{min-width:128px;text-align:center;color:#17243f;font-weight:800}.visitor-v2-actions{display:flex;justify-content:flex-end;margin-top:24px}.visitor-v2-go{min-height:58px;border:0;border-radius:17px;padding:0 25px;background:linear-gradient(135deg,#66d7df,#25b9c5);color:#fff;font:800 16px Poppins,system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 24px rgba(37,185,197,.22)}.visitor-v2-go:disabled{opacity:.45;cursor:not-allowed;box-shadow:none}.visitor-v2-handoff{text-align:center;padding:36px 8px}.visitor-v2-handoff h2{color:#17243f;margin:12px 0 8px}.visitor-v2-handoff p{color:#71809a}.visitor-v2-spinner{width:48px;height:48px;margin:0 auto;border:5px solid #dff4f6;border-top-color:#25b9c5;border-radius:50%;animation:v2spin .8s linear infinite}@keyframes v2spin{to{transform:rotate(360deg)}}@media(max-width:720px){.visitor-v2-guide{grid-template-columns:1fr 1fr}.visitor-v2-levels{grid-template-columns:repeat(4,minmax(0,1fr))}.visitor-v2-start{align-items:flex-start;flex-direction:column}.visitor-v2-stepper{width:100%;justify-content:space-between}}';
 document.head.appendChild(style);
}

function guideHtml(){
 var ko=isKo();
 var rows=ko?[
  ['1–2','이름, 인사, What is this? 같은 아주 기본적인 대답'],
  ['3–4','Where is the pencil? / What is she doing? / What do you like?'],
  ['5–6','학교 가는 방법, 어제 한 일, 간단한 조언 말하기'],
  ['7–8','사람 묘사, 경험 말하기, 간단한 이유 설명'],
  ['9–10','가정 상황, 선택 비교, 조금 길게 설명하기'],
  ['11–12','의견을 근거와 함께 말하고 복잡한 생각 설명하기']
 ]:[
  ['1–2','Name, greetings, and very basic answers such as “What is this?”'],
  ['3–4','Where is the pencil? / What is she doing? / What do you like?'],
  ['5–6','Routines, yesterday, and simple advice'],
  ['7–8','Describe a person, talk about experience, give a reason'],
  ['9–10','Hypothetical situations, compare choices, explain at length'],
  ['11–12','Support an opinion and explain more complex ideas']
 ];
 return rows.map(function(r){return'<div><strong>Internal '+r[0]+'</strong><span>'+r[1]+'</span></div>'}).join('');
}

function render(){
 installStyle();
 if(!overlay){overlay=document.createElement('div');overlay.className='visitor-v2-overlay';document.body.appendChild(overlay)}
 var ko=isKo(),name=studentName();
 overlay.innerHTML='<div class="visitor-v2-wrap"><section class="visitor-v2-card">'+
  '<span class="visitor-v2-kicker">Visitor test · '+VERSION+'</span>'+
  '<h1>'+(ko?'선생님 말하기 체크':'Teacher speaking check')+'</h1>'+
  '<p class="visitor-v2-lead">'+(ko?(name?name+' 학생과 2–4분 정도 영어로 이야기한 뒤, 학생이 <strong>편하게 사용할 수 있는</strong> 가장 높은 내부 레벨을 선택하세요.':'학생과 2–4분 정도 영어로 이야기한 뒤, 학생이 <strong>편하게 사용할 수 있는</strong> 가장 높은 내부 레벨을 선택하세요.'):(name?'Talk with '+name+' in English for about 2–4 minutes. Choose the highest internal level the student can <strong>use comfortably</strong>.':'Talk with the student in English for about 2–4 minutes. Choose the highest internal level they can <strong>use comfortably</strong>.'))+'</p>'+
  '<div class="visitor-v2-guide">'+guideHtml()+'</div>'+
  '<p class="visitor-v2-label">'+(ko?'말하기 내부 레벨':'Speaking internal level')+'</p>'+
  '<div class="visitor-v2-levels">'+Array.from({length:12},function(_,i){var n=i+1;return'<button type="button" class="visitor-v2-level '+(speakingLevel===n?'selected':'')+'" data-v2-level="'+n+'">'+n+'<small>'+publicLabel(n)+'</small></button>'}).join('')+'</div>'+
  '<div class="visitor-v2-start"><div class="visitor-v2-start-copy"><strong>'+(ko?'컴퓨터 테스트 시작 레벨':'Computer test starting level')+'</strong><span>'+(ko?'기본값은 말하기 레벨입니다. 필요하면 선생님이 조정할 수 있어요.':'Defaults to the speaking level. Adjust it if your overall judgment is different.')+'</span></div><div class="visitor-v2-stepper"><button type="button" data-v2-step="-1" '+(!startLevel||startLevel<=1?'disabled':'')+'>−</button><output>'+(startLevel?'Internal '+startLevel:'—')+'</output><button type="button" data-v2-step="1" '+(!startLevel||startLevel>=12?'disabled':'')+'>+</button></div></div>'+
  '<div class="visitor-v2-actions"><button type="button" class="visitor-v2-go" id="visitorV2Go" '+(speakingLevel?'':'disabled')+'>'+(ko?'학생 테스트 시작':'Start student test')+'</button></div>'+
  '</section></div>';
 overlay.querySelectorAll('[data-v2-level]').forEach(function(btn){btn.onclick=function(){speakingLevel=Number(btn.dataset.v2Level);startLevel=speakingLevel;render()}});
 overlay.querySelectorAll('[data-v2-step]').forEach(function(btn){btn.onclick=function(){if(!startLevel)return;startLevel=Math.max(1,Math.min(12,startLevel+Number(btn.dataset.v2Step)));render()}});
 var go=overlay.querySelector('#visitorV2Go');if(go)go.onclick=beginStudentTest;
}

function stopDrive(){
 if(driveTimer)clearInterval(driveTimer);
 driveTimer=null;lastDrive='';
}

function showStartupError(){
 stopDrive();
 if(!overlay)return;
 overlay.innerHTML='<div class="visitor-v2-wrap"><section class="visitor-v2-card visitor-v2-handoff" role="alert"><h2>'+(isKo()?'테스트를 불러오지 못했어요':'Could not load the test')+'</h2><p>'+(isKo()?'페이지를 새로고침한 뒤 다시 시작해 주세요.':'Please refresh the page and start again.')+'</p><button type="button" class="visitor-v2-go" id="visitorV2Refresh">'+(isKo()?'새로고침':'Refresh')+'</button></section></div>';
 overlay.querySelector('#visitorV2Refresh').onclick=function(){location.reload()};
}

function driveSetup(){
 stopDrive();
 var ctx=ensureContext(),candidate=window.WillenaProspectiveCandidate||{};
 var startedAt=Date.now();
 driveTimer=setInterval(function(){
  var card=document.querySelector('.question-card');
  if(card){stopDrive();if(overlay){overlay.remove();overlay=null}return}
  if(document.querySelector('#app .error')||Date.now()-startedAt>=45000){showStartupError();return}
  // Do not start an empty test while the question bank is still loading.
  if(!window.WillenaVisitorV2Config.bankReady)return;
  var actions=[['grade',candidate.setup_grade],['years',0],['listening',1],['length',50]];
  for(var i=0;i<actions.length;i++){
   var key=actions[i][0],value=actions[i][1];if(value==null)continue;
   var holder=document.querySelector('.setup-options[data-key="'+key+'"]');
   if(!holder)continue;
   var token=key+':'+value;if(lastDrive===token)return;
   var option=holder.querySelector('[data-value="'+value+'"]');
   if(option){lastDrive=token;ctx.setup[key]=Number(value);option.click();return}
  }
 },80);
}

function beginStudentTest(){
 if(!speakingLevel||!startLevel)return;
 var cfg=window.WillenaVisitorV2Config;
 cfg.enabled=true;cfg.version=VERSION;cfg.speakingLevel=speakingLevel;cfg.teacherStartLevel=startLevel;
 var ctx=ensureContext(),candidate=window.WillenaProspectiveCandidate||{};
 ctx.setup=Object.assign({},ctx.setup||{}, {
  source:'willena-visitor',visitor_version:VERSION,teacher_prior:true,
  speaking_level:speakingLevel,teacher_start_level:startLevel,
  grade:Number(candidate.setup_grade)||null,listening:1,length:50
 });
 try{sessionStorage.setItem('willena_visitor_v2_teacher_assessment',JSON.stringify({version:VERSION,speaking_level:speakingLevel,teacher_start_level:startLevel,at:new Date().toISOString()}))}catch(_){}
 if(overlay){overlay.innerHTML='<div class="visitor-v2-wrap"><section class="visitor-v2-card visitor-v2-handoff"><div class="visitor-v2-spinner"></div><h2>'+(isKo()?'학생 테스트를 준비하고 있어요':'Preparing the student test')+'</h2><p>'+(isKo()?'잠시 후 학생에게 기기를 넘겨 주세요.':'You can hand the device to the student in a moment.')+'</p></section></div>'}
 driveSetup();
}

window.addEventListener('willena:candidate-ready',function(){setTimeout(render,0)});
})();
