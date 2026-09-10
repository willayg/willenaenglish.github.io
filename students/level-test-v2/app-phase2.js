import {createVisitorIntake} from './visitor-intake.js?v=20260911-phase2c';

const app=document.querySelector('#app');
const subtitle=document.querySelector('#brandSubtitle');
const footer=document.querySelector('#footerText');
const choices=[...document.querySelectorAll('[data-language-choice]')];
let lang='ko';
let visitor=null;
let intake=null;

const T={
  ko:{brand:'무료 영어 레벨 테스트',footer:'Willena English · 스테이징 진단 테스트',title:'레벨 테스트',start:'시작하기',handoff:'학생 정보가 준비되었습니다',handoffText:'다음 단계에서는 선생님 말하기 평가를 시작합니다.',back:'정보 수정',continue:'말하기 평가로 이동'},
  en:{brand:'Free Level Test',footer:'Willena English · Staging assessment',title:'Level Test',start:'Start',handoff:'Student information is ready',handoffText:'The next phase will begin the teacher-led speaking assessment.',back:'Edit details',continue:'Continue to speaking'}
};
const tx=k=>T[lang][k]||k;

function setLanguage(next){
  lang=next;
  document.documentElement.lang=lang;
  subtitle.textContent=tx('brand');
  footer.textContent=tx('footer');
  choices.forEach(b=>b.classList.toggle('is-active',b.dataset.languageChoice===lang));
  if(document.body.classList.contains('welcome-mode')) renderWelcome();
}

function screen(html){
  app.classList.add('is-swapping');
  app.innerHTML=`<section class="screen screen-safe-in">${html}</section>`;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    app.querySelector('.screen')?.classList.add('screen-safe-ready');
    app.classList.remove('is-swapping');
  }));
}

function renderWelcome(){
  intake?.destroy?.();
  intake=null;
  document.body.classList.add('welcome-mode');
  screen(`<div class="welcome-layout"><img class="welcome-logo" src="/Assets/Images/Logo.png" alt="Willena English Academy"><div class="welcome-panel"><h1>${tx('title')}</h1><button class="welcome-start" id="welcomeStart" type="button">${tx('start')}</button></div></div>`);
}

function renderIntake(){
  document.body.classList.remove('welcome-mode');
  app.innerHTML='<div class="candidate-flow-host"></div>';
  intake=createVisitorIntake({
    host:app.querySelector('.candidate-flow-host'),
    lang,
    onCancel:renderWelcome,
    onComplete:data=>{visitor=data;renderSpeakingHandoff();}
  });
}

function renderSpeakingHandoff(){
  document.body.classList.remove('welcome-mode');
  screen(`<div class="eyebrow">Level Test v2</div><h2>${tx('handoff')}</h2><p class="lead">${tx('handoffText')}</p><div class="candidate-summary handoff-summary"><div><small>${lang==='ko'?'학생':'Student'}</small><strong>${visitor?.student_name||''}</strong></div><div><small>${lang==='ko'?'학교 / 학년':'School / grade'}</small><strong>${visitor?.school_name||''} · ${visitor?.school_grade||''}</strong></div><div><small>${lang==='ko'?'보호자 연락처':'Parent phone'}</small><strong>${visitor?.parent_phone_display||''}</strong></div></div><div class="actions"><button class="btn btn-ghost" id="editIntake" type="button">${tx('back')}</button><button class="btn btn-primary" id="speakingPlaceholder" type="button">${tx('continue')}</button></div>`);
}

choices.forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.languageChoice)));
app.addEventListener('click',e=>{
  if(e.target.closest('#welcomeStart')) renderIntake();
  if(e.target.closest('#editIntake')) renderIntake();
  if(e.target.closest('#speakingPlaceholder')){
    const btn=e.target.closest('#speakingPlaceholder');
    btn.textContent=lang==='ko'?'Phase 5에서 연결됩니다':'Connected in Phase 5';
    btn.disabled=true;
  }
});

renderWelcome();
