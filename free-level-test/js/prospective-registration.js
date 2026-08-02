(function(){
'use strict';
var STORAGE_KEY='willena_prospective_level_test_candidate_v3';
var ENDPOINT='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/prospective-level-test';
var bypassStart=false;
var wizardOpen=false;

// Every test attempt starts with a fresh student identity.
sessionStorage.removeItem(STORAGE_KEY);
sessionStorage.removeItem('willena_prospective_level_test_candidate_v2');
sessionStorage.removeItem('willena_prospective_level_test_candidate_v1');
window.WillenaProspectiveCandidate=null;
document.documentElement.dataset.candidateReady='false';

function expose(candidate){
  window.WillenaProspectiveCandidate=candidate;
  sessionStorage.setItem(STORAGE_KEY,JSON.stringify(candidate));
  document.documentElement.dataset.candidateReady='true';
  window.dispatchEvent(new CustomEvent('willena:candidate-ready',{detail:candidate}));
}

function gradeRows(){return [
 ['초등학교 1학년','Elementary 1'],['초등학교 2학년','Elementary 2'],['초등학교 3학년','Elementary 3'],['초등학교 4학년','Elementary 4'],['초등학교 5학년','Elementary 5'],['초등학교 6학년','Elementary 6'],
 ['중학교 1학년','Middle 1'],['중학교 2학년','Middle 2'],['중학교 3학년','Middle 3'],
 ['고등학교 1학년','High 1'],['고등학교 2학년','High 2'],['고등학교 3학년','High 3']
]}
function gradeRangeValue(label){
 if(/^초등학교 [12]학년$/.test(label))return 2;
 if(/^초등학교 [34]학년$/.test(label))return 4;
 if(/^초등학교 [56]학년$/.test(label))return 6;
 if(/^중학교/.test(label))return 8;
 return 9;
}

function installStyles(){
 if(document.getElementById('candidate-flow-style'))return;
 var style=document.createElement('style');style.id='candidate-flow-style';style.textContent='\
.candidate-flow{position:fixed;inset:0;z-index:99999;background:linear-gradient(180deg,#f7f9ff,#fff);display:grid;place-items:center;padding:22px;font-family:Poppins,system-ui,sans-serif}.candidate-slide{width:min(720px,100%);background:#fff;border:1px solid #e3e9f4;border-radius:28px;padding:clamp(25px,5vw,44px);box-shadow:0 20px 60px rgba(38,55,94,.14)}.candidate-brand{display:flex;align-items:center;gap:12px;margin-bottom:24px}.candidate-brand img{width:52px;height:52px;object-fit:contain}.candidate-brand strong{display:block;color:#18233b}.candidate-brand span{font-size:13px;color:#7c879d}.candidate-progress{display:flex;gap:7px;margin-bottom:28px}.candidate-progress i{height:7px;flex:1;border-radius:99px;background:#e8edf7}.candidate-progress i.done{background:#5271ff}.candidate-slide h1{font-size:clamp(27px,5vw,40px);line-height:1.18;margin:0 0 10px;color:#18233b}.candidate-slide p{margin:0 0 24px;color:#6d7890;line-height:1.55}.candidate-input{width:100%;height:64px;border:1px solid #d2dbea;border-radius:18px;padding:0 18px;background:#fff;color:#18233b;font:600 18px Poppins,system-ui,sans-serif;outline:none}.candidate-input:focus{border-color:#5271ff;box-shadow:0 0 0 4px rgba(82,113,255,.12)}.candidate-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.candidate-option{min-height:58px;border:1px solid #d8e0ee;border-radius:16px;background:#fff;color:#24324b;font:700 15px Poppins,system-ui,sans-serif;text-align:left;padding:12px 15px;cursor:pointer}.candidate-option:hover,.candidate-option.selected{border-color:#5271ff;background:#f3f5ff;color:#3f5ce0}.candidate-actions{display:flex;justify-content:space-between;gap:10px;margin-top:26px}.candidate-btn{min-height:56px;border:0;border-radius:16px;padding:0 24px;font:800 16px Poppins,system-ui,sans-serif;cursor:pointer}.candidate-next{margin-left:auto;background:linear-gradient(135deg,#5271ff,#4564ec);color:#fff;box-shadow:0 10px 24px rgba(82,113,255,.22)}.candidate-back{background:#eef2f8;color:#42516b}.candidate-btn:disabled{opacity:.5;cursor:not-allowed}.candidate-error{min-height:22px;margin:12px 0 0!important;color:#c33b45!important;font-size:14px}.candidate-summary{display:grid;gap:10px;margin:18px 0}.candidate-summary div{background:#f6f8fc;border-radius:14px;padding:13px 15px}.candidate-summary small{display:block;color:#8792a7;margin-bottom:3px}@media(max-width:600px){.candidate-flow{padding:14px;align-items:flex-start;overflow:auto}.candidate-slide{margin:18px 0;padding:24px 20px;border-radius:22px}.candidate-options{grid-template-columns:1fr}.candidate-input{height:58px}.candidate-actions{position:sticky;bottom:0;background:#fff;padding-top:10px}.candidate-btn{flex:1;padding:0 14px}}';document.head.appendChild(style);
}

function startWizard(startButton){
 if(wizardOpen)return;wizardOpen=true;installStyles();
 var state={step:0,name:'',school:'',grade:''};
 var flow=document.createElement('div');flow.className='candidate-flow';document.body.appendChild(flow);
 function render(){
  var progress='<div class="candidate-progress">'+[0,1,2,3].map(function(i){return '<i class="'+(i<=state.step?'done':'')+'"></i>'}).join('')+'</div>';
  var body='';
  if(state.step===0)body='<h1>학생 이름이 무엇인가요?</h1><p>What is the student’s name?</p><input class="candidate-input" id="candidateValue" autocomplete="name" maxlength="80" value="'+escapeAttr(state.name)+'" placeholder="예: 김민준">';
  if(state.step===1)body='<h1>어느 학교에 다니나요?</h1><p>Which school does the student attend?</p><input class="candidate-input" id="candidateValue" maxlength="120" value="'+escapeAttr(state.school)+'" placeholder="예: 장현초등학교">';
  if(state.step===2)body='<h1>현재 학년을 선택해 주세요</h1><p>Select the student’s current grade.</p><div class="candidate-options">'+gradeRows().map(function(row){return '<button type="button" class="candidate-option '+(state.grade===row[0]?'selected':'')+'" data-grade="'+row[0]+'">'+row[0]+' · '+row[1]+'</button>'}).join('')+'</div>';
  if(state.step===3)body='<h1>이 정보로 시작할까요?</h1><p>Please check the student information before beginning.</p><div class="candidate-summary"><div><small>Student</small><strong>'+escapeText(state.name)+'</strong></div><div><small>School</small><strong>'+escapeText(state.school)+'</strong></div><div><small>Grade</small><strong>'+escapeText(state.grade)+'</strong></div></div>';
  flow.innerHTML='<section class="candidate-slide"><div class="candidate-brand"><img src="/Assets/Images/Logo.png" alt="Willena English"><div><strong>Willena English</strong><span>Free Level Test</span></div></div>'+progress+body+'<p class="candidate-error" role="alert"></p><div class="candidate-actions">'+(state.step?'<button type="button" class="candidate-btn candidate-back">뒤로</button>':'')+'<button type="button" class="candidate-btn candidate-next">'+(state.step===3?'테스트 시작하기':'다음')+'</button></div></section>';
  var input=flow.querySelector('#candidateValue');if(input){setTimeout(function(){input.focus()},50);input.addEventListener('input',function(){if(state.step===0)state.name=input.value;else state.school=input.value})}
  flow.querySelectorAll('[data-grade]').forEach(function(button){button.onclick=function(){state.grade=button.dataset.grade;render()}});
  var back=flow.querySelector('.candidate-back');if(back)back.onclick=function(){state.step--;render()};
  flow.querySelector('.candidate-next').onclick=async function(){
   var error=flow.querySelector('.candidate-error');error.textContent='';
   if(state.step===0&&state.name.trim().length<2){error.textContent='학생 이름을 입력하세요.';return}
   if(state.step===1&&state.school.trim().length<2){error.textContent='학교 이름을 입력하세요.';return}
   if(state.step===2&&!state.grade){error.textContent='학년을 선택하세요.';return}
   if(state.step<3){state.step++;render();return}
   var next=flow.querySelector('.candidate-next');next.disabled=true;next.textContent='저장 중...';
   try{
    var payload={action:'register',student_name:state.name.trim(),school_name:state.school.trim(),school_grade:state.grade,language:document.documentElement.lang||'ko'};
    var response=await fetch(ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    var json=await response.json().catch(function(){return {}});
    if(!response.ok||!json.success||!json.candidate)throw new Error(json.error||'정보를 저장할 수 없습니다.');
    json.candidate.setup_grade=gradeRangeValue(state.grade);
    expose(json.candidate);flow.remove();wizardOpen=false;
    bypassStart=true;startButton.click();bypassStart=false;
   }catch(err){error.textContent=err.message||'정보를 저장할 수 없습니다.';next.disabled=false;next.textContent='테스트 시작하기'}
  };
 }
 render();
}
function escapeText(value){return String(value||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function escapeAttr(value){return escapeText(value)}

// Put student details behind the normal Start button.
document.addEventListener('click',function(event){
 var retry=event.target.closest('#retry,#home');
 if(retry){event.preventDefault();event.stopImmediatePropagation();location.href=location.pathname+'?new=1';return}
 var start=event.target.closest('#welcomeStart');
 if(!start||bypassStart)return;
 event.preventDefault();event.stopImmediatePropagation();startWizard(start);
},true);

// Reuse the entered school grade and skip the duplicate setup question.
var observer=new MutationObserver(function(){
 var candidate=window.WillenaProspectiveCandidate;
 if(!candidate||!candidate.setup_grade)return;
 var holder=document.querySelector('.setup-options[data-key="grade"]');
 if(!holder)return;
 var root=document.querySelector('#app');if(root)root.style.visibility='hidden';
 var option=holder.querySelector('[data-value="'+candidate.setup_grade+'"]');
 if(option){option.click();requestAnimationFrame(function(){if(root)root.style.visibility=''})}
});
observer.observe(document.documentElement,{childList:true,subtree:true});
})();