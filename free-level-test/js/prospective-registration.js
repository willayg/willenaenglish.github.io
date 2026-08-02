(function(){
'use strict';

var STORAGE_KEY='willena_prospective_level_test_candidate_v1';
var params=new URLSearchParams(window.location.search);
if(params.get('new')==='1')sessionStorage.removeItem(STORAGE_KEY);

function apiBase(){
  var host=window.location.hostname;
  if(host==='students.willenaenglish.com'||host==='willenaenglish.netlify.app'||host==='localhost'||host==='127.0.0.1')return '';
  if(host==='staging.willenaenglish.com'||host==='cf.willenaenglish.com'||host==='teachers.willenaenglish.com'||/\.pages\.dev$/.test(host))return 'https://api.willenaenglish.com';
  return 'https://students.willenaenglish.com';
}

function savedCandidate(){
  try{return JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');}catch(_){return null;}
}

function expose(candidate){
  window.WillenaProspectiveCandidate=candidate;
  document.documentElement.setAttribute('data-candidate-ready','true');
  window.dispatchEvent(new CustomEvent('willena:candidate-ready',{detail:candidate}));
}

var existing=savedCandidate();
if(existing&&existing.id){expose(existing);return;}

document.documentElement.setAttribute('data-candidate-ready','false');

function gradeOptions(){
  var rows=[['초등학교 1학년','Elementary 1'],['초등학교 2학년','Elementary 2'],['초등학교 3학년','Elementary 3'],['초등학교 4학년','Elementary 4'],['초등학교 5학년','Elementary 5'],['초등학교 6학년','Elementary 6'],['중학교 1학년','Middle 1'],['중학교 2학년','Middle 2'],['중학교 3학년','Middle 3'],['고등학교 1학년','High 1'],['고등학교 2학년','High 2'],['고등학교 3학년','High 3']];
  return rows.map(function(row){return '<option value="'+row[0]+'">'+row[0]+' · '+row[1]+'</option>';}).join('');
}

function mount(){
  var style=document.createElement('style');
  style.textContent='html[data-candidate-ready="false"]{overflow:hidden} .candidate-gate{position:fixed;inset:0;z-index:99999;background:linear-gradient(145deg,#f5f8ff,#fff);display:grid;place-items:center;padding:20px;font-family:Poppins,system-ui,sans-serif}.candidate-card{width:min(520px,100%);background:#fff;border:1px solid #dce5f4;border-radius:26px;box-shadow:0 22px 70px rgba(42,63,102,.18);padding:28px}.candidate-brand{font-size:13px;font-weight:800;letter-spacing:.08em;color:#5271ff;text-transform:uppercase}.candidate-card h1{font-size:28px;line-height:1.2;margin:8px 0 6px;color:#18233b}.candidate-card .intro{margin:0 0 24px;color:#61708c;line-height:1.55}.candidate-field{display:block;margin:0 0 16px}.candidate-field span{display:block;margin:0 0 7px;font-size:14px;font-weight:700;color:#27344d}.candidate-field input,.candidate-field select{box-sizing:border-box;width:100%;min-height:52px;border:1px solid #ccd7e8;border-radius:14px;padding:0 15px;background:#fff;font:inherit;font-size:16px;color:#18233b;outline:none}.candidate-field input:focus,.candidate-field select:focus{border-color:#5271ff;box-shadow:0 0 0 4px rgba(82,113,255,.12)}.candidate-submit{width:100%;min-height:54px;border:0;border-radius:15px;background:#5271ff;color:#fff;font:800 16px Poppins,system-ui,sans-serif;cursor:pointer}.candidate-submit:disabled{opacity:.6;cursor:wait}.candidate-error{min-height:22px;margin:10px 0 0;color:#c23030;font-size:14px}.candidate-note{margin:14px 0 0;text-align:center;color:#8792a8;font-size:12px}@media(max-width:520px){.candidate-card{padding:22px;border-radius:20px}.candidate-card h1{font-size:24px}}';
  document.head.appendChild(style);

  var gate=document.createElement('div');
  gate.className='candidate-gate';
  gate.innerHTML='<form class="candidate-card" novalidate><div class="candidate-brand">Willena English</div><h1>레벨 테스트 학생 정보</h1><p class="intro">테스트를 시작하기 전에 학생 정보를 입력해 주세요.<br><small>Please enter the student information before starting.</small></p><label class="candidate-field"><span>학생 이름 · Student name</span><input name="student_name" autocomplete="name" maxlength="80" required placeholder="예: 김민준"></label><label class="candidate-field"><span>학교 · School</span><input name="school_name" maxlength="120" required placeholder="예: 장현초등학교"></label><label class="candidate-field"><span>학년 · Grade</span><select name="school_grade" required><option value="">학년을 선택하세요</option>'+gradeOptions()+'</select></label><button class="candidate-submit" type="submit">정보 저장 후 시작하기</button><p class="candidate-error" role="alert"></p><p class="candidate-note">입력한 정보와 테스트 결과는 상담 및 레벨 안내에 사용됩니다.</p></form>';
  document.body.appendChild(gate);

  var form=gate.querySelector('form');
  var button=gate.querySelector('button');
  var errorBox=gate.querySelector('.candidate-error');

  form.addEventListener('submit',async function(event){
    event.preventDefault();
    errorBox.textContent='';
    var data=new FormData(form);
    var payload={student_name:String(data.get('student_name')||'').trim(),school_name:String(data.get('school_name')||'').trim(),school_grade:String(data.get('school_grade')||'').trim(),language:document.documentElement.lang||'ko'};
    if(payload.student_name.length<2){errorBox.textContent='학생 이름을 입력하세요.';return;}
    if(payload.school_name.length<2){errorBox.textContent='학교 이름을 입력하세요.';return;}
    if(!payload.school_grade){errorBox.textContent='학년을 선택하세요.';return;}

    button.disabled=true;
    button.textContent='저장 중...';
    try{
      var response=await fetch(apiBase()+'/.netlify/functions/prospective_level_test',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
      var json=await response.json().catch(function(){return{};});
      if(!response.ok||!json.success||!json.candidate)throw new Error(json.error||'정보를 저장할 수 없습니다.');
      sessionStorage.setItem(STORAGE_KEY,JSON.stringify(json.candidate));
      expose(json.candidate);
      gate.remove();
      document.documentElement.style.overflow='';
    }catch(error){
      errorBox.textContent=error&&error.message?error.message:'정보를 저장할 수 없습니다. 다시 시도해 주세요.';
      button.disabled=false;
      button.textContent='정보 저장 후 시작하기';
    }
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
