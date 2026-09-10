const PHONE_DIGITS = 11;

export function normalizeKoreanPhone(value='') {
  let digits=String(value).replace(/\D/g,'');
  if(digits.startsWith('82')) digits='0'+digits.slice(2);
  return digits.slice(0,PHONE_DIGITS);
}

export function formatKoreanPhone(value='') {
  const digits=normalizeKoreanPhone(value);
  if(digits.length<=3) return digits;
  if(digits.length<=7) return `${digits.slice(0,3)}-${digits.slice(3)}`;
  return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
}

export function isValidKoreanMobile(value='') {
  return /^010\d{8}$/.test(normalizeKoreanPhone(value));
}

export function createVisitorIntake({host,lang='ko',onComplete,onCancel}={}) {
  const T={
    ko:{subtitle:'무료 영어 레벨 테스트',nameQ:'학생 이름이 무엇인가요?',nameP:'학생의 이름을 입력해 주세요.',namePh:'예: 김민준',schoolQ:'어느 학교에 다니나요?',schoolP:'학교 이름을 입력해 주세요.',schoolPh:'예: 장현초등학교',typeQ:'어떤 학교에 다니나요?',typeP:'학교 종류를 선택해 주세요.',elementary:'초등학교',middle:'중학교',high:'고등학교',gradeQ:'현재 몇 학년인가요?',gradeP:'학년을 선택해 주세요.',phoneQ:'보호자 연락처를 입력해 주세요.',phoneP:'레벨 테스트 결과와 상담 기록을 확인할 보호자 휴대폰 번호입니다.',phonePh:'010-1234-5678',confirmQ:'이 정보로 시작할까요?',confirmP:'학생 정보를 확인해 주세요.',student:'학생',school:'학교',grade:'학년',phone:'보호자 연락처',back:'뒤로',next:'다음',start:'말하기 평가 시작',nameErr:'학생 이름을 입력하세요.',schoolErr:'학교 이름을 입력하세요.',phoneErr:'010으로 시작하는 휴대폰 번호 11자리를 입력하세요.'},
    en:{subtitle:'Free Level Test',nameQ:'What is the student’s name?',nameP:'Enter the student’s name.',namePh:'e.g. Minjun Kim',schoolQ:'Which school do they attend?',schoolP:'Enter the school name.',schoolPh:'e.g. Janghyeon Elementary School',typeQ:'What kind of school is it?',typeP:'Choose the school type.',elementary:'Elementary school',middle:'Middle school',high:'High school',gradeQ:'What grade are they in?',gradeP:'Choose the current grade.',phoneQ:'Enter the parent’s phone number.',phoneP:'We use this to identify the assessment and consultation record.',phonePh:'010-1234-5678',confirmQ:'Ready to begin?',confirmP:'Check the student information.',student:'Student',school:'School',grade:'Grade',phone:'Parent phone',back:'Back',next:'Next',start:'Start speaking assessment',nameErr:'Enter the student’s name.',schoolErr:'Enter the school name.',phoneErr:'Enter an 11-digit Korean mobile number beginning with 010.'}
  };
  const tx=k=>(T[lang]||T.ko)[k]||k;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const state={step:0,name:'',school:'',type:'',grade:0,parentPhone:''};
  const steps=6;

  function gradeLabel(){
    const prefix=lang==='ko'?(state.type==='elementary'?'초등학교 ':state.type==='middle'?'중학교 ':'고등학교 '):(state.type==='elementary'?'Elementary ':state.type==='middle'?'Middle ':'High ');
    return `${prefix}${state.grade}${lang==='ko'?'학년':''}`;
  }
  function progress(){return `<div class="candidate-progress">${Array.from({length:steps},(_,i)=>`<i class="${i<=state.step?'done':''}"></i>`).join('')}</div>`;}
  function shell(body,actions=true){
    return `<section class="candidate-slide"><div class="candidate-brand"><img src="/Assets/Images/Logo.png" alt="Willena English"><div><strong>Willena English</strong><span>${tx('subtitle')}</span></div></div>${progress()}${body}<p class="candidate-error" role="alert"></p>${actions?`<div class="candidate-actions">${state.step?`<button type="button" class="candidate-btn candidate-back">${tx('back')}</button>`:`<button type="button" class="candidate-btn candidate-back candidate-cancel">${tx('back')}</button>`}<button type="button" class="candidate-btn candidate-next">${state.step===5?tx('start'):tx('next')}</button></div>`:`<div class="candidate-actions"><button type="button" class="candidate-btn candidate-back">${tx('back')}</button></div>`}</section>`;
  }
  function render(){
    let body='',actions=true;
    if(state.step===0) body=`<h1>${tx('nameQ')}</h1><p>${tx('nameP')}</p><input class="candidate-input" id="candidateValue" autocomplete="name" maxlength="80" value="${esc(state.name)}" placeholder="${tx('namePh')}">`;
    if(state.step===1) body=`<h1>${tx('schoolQ')}</h1><p>${tx('schoolP')}</p><input class="candidate-input" id="candidateValue" maxlength="120" value="${esc(state.school)}" placeholder="${tx('schoolPh')}">`;
    if(state.step===2){actions=false;body=`<h1>${tx('typeQ')}</h1><p>${tx('typeP')}</p><div class="candidate-options school-types">${['elementary','middle','high'].map(x=>`<button type="button" class="candidate-option" data-type="${x}">${tx(x)}</button>`).join('')}</div>`;}
    if(state.step===3){actions=false;const max=state.type==='elementary'?6:3;body=`<h1>${tx('gradeQ')}</h1><p>${tx('gradeP')}</p><div class="candidate-options">${Array.from({length:max},(_,i)=>`<button type="button" class="candidate-option" data-grade="${i+1}">${lang==='ko'?`${i+1}학년`:`Grade ${i+1}`}</button>`).join('')}</div>`;}
    if(state.step===4) body=`<h1>${tx('phoneQ')}</h1><p>${tx('phoneP')}</p><input class="candidate-input candidate-phone" id="candidatePhone" inputmode="tel" autocomplete="tel" maxlength="13" value="${esc(formatKoreanPhone(state.parentPhone))}" placeholder="${tx('phonePh')}">`;
    if(state.step===5) body=`<h1>${tx('confirmQ')}</h1><p>${tx('confirmP')}</p><div class="candidate-summary"><div><small>${tx('student')}</small><strong>${esc(state.name)}</strong></div><div><small>${tx('school')}</small><strong>${esc(state.school)}</strong></div><div><small>${tx('grade')}</small><strong>${esc(gradeLabel())}</strong></div><div><small>${tx('phone')}</small><strong>${esc(formatKoreanPhone(state.parentPhone))}</strong></div></div>`;
    host.innerHTML=shell(body,actions);
    bind();
  }
  function go(step){state.step=Math.max(0,Math.min(steps-1,step));render();}
  function error(text){const el=host.querySelector('.candidate-error');if(el)el.textContent=text||'';}
  function bind(){
    const input=host.querySelector('#candidateValue');
    if(input){input.focus();input.addEventListener('input',()=>{if(state.step===0)state.name=input.value;else state.school=input.value;});input.addEventListener('keydown',e=>{if(e.key==='Enter')host.querySelector('.candidate-next')?.click();});}
    const phone=host.querySelector('#candidatePhone');
    if(phone){phone.focus();phone.addEventListener('input',()=>{state.parentPhone=normalizeKoreanPhone(phone.value);phone.value=formatKoreanPhone(state.parentPhone);});phone.addEventListener('keydown',e=>{if(e.key==='Enter')host.querySelector('.candidate-next')?.click();});}
    host.querySelectorAll('[data-type]').forEach(btn=>btn.addEventListener('click',()=>{state.type=btn.dataset.type;state.grade=0;go(3);}));
    host.querySelectorAll('[data-grade]').forEach(btn=>btn.addEventListener('click',()=>{state.grade=Number(btn.dataset.grade);go(4);}));
    host.querySelector('.candidate-back')?.addEventListener('click',()=>{if(state.step===0){onCancel?.();return;}go(state.step-1);});
    host.querySelector('.candidate-next')?.addEventListener('click',()=>{
      error('');
      if(state.step===0&&state.name.trim().length<2){error(tx('nameErr'));return;}
      if(state.step===1&&state.school.trim().length<2){error(tx('schoolErr'));return;}
      if(state.step===4&&!isValidKoreanMobile(state.parentPhone)){error(tx('phoneErr'));return;}
      if(state.step<5){go(state.step+1);return;}
      const visitor={student_name:state.name.trim(),school_name:state.school.trim(),school_type:state.type,school_grade:gradeLabel(),parent_phone_normalized:normalizeKoreanPhone(state.parentPhone),parent_phone_display:formatKoreanPhone(state.parentPhone)};
      onComplete?.(visitor);
    });
  }
  render();
  return {getState:()=>({...state}),destroy:()=>{host.innerHTML='';}};
}
