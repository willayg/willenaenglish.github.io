import {createVisitorIntake} from './visitor-intake.js?v=20260911-phase3';
import {
  SESSION_PHASE,
  SESSION_STATUS,
  createAssessmentSession,
  loadAssessmentSession,
  clearAssessmentSession,
  isResumableSession,
  beginSpeaking,
  setSessionPhase
} from './assessment-session.js?v=20260911-phase3';

const app=document.querySelector('#app');
const subtitle=document.querySelector('#brandSubtitle');
const footer=document.querySelector('#footerText');
const choices=[...document.querySelectorAll('[data-language-choice]')];
let lang='ko';
let session=loadAssessmentSession();
let intake=null;

const T={
  ko:{brand:'무료 영어 레벨 테스트',footer:'Willena English · 스테이징 진단 테스트',title:'레벨 테스트',start:'시작하기',resume:'계속하기',newTest:'새 테스트',handoff:'학생 정보가 준비되었습니다',handoffText:'다음 단계에서는 선생님 말하기 평가를 시작합니다.',back:'정보 수정',continue:'말하기 평가로 이동',resumeTitle:'진행 중인 테스트가 있습니다',resumeText:'저장된 단계부터 이어서 할 수 있습니다.',speakingTitle:'말하기 평가 준비 완료',speakingText:'Phase 5에서 실제 말하기 인터뷰 화면이 연결됩니다.'},
  en:{brand:'Free Level Test',footer:'Willena English · Staging assessment',title:'Level Test',start:'Start',resume:'Resume',newTest:'New test',handoff:'Student information is ready',handoffText:'The next phase will begin the teacher-led speaking assessment.',back:'Edit details',continue:'Continue to speaking',resumeTitle:'A test is already in progress',resumeText:'You can continue from the saved stage.',speakingTitle:'Speaking assessment ready',speakingText:'The real teacher speaking workspace will be connected in Phase 5.'}
};
const tx=k=>T[lang][k]||k;

function setLanguage(next){
  lang=next;
  document.documentElement.lang=lang;
  subtitle.textContent=tx('brand');
  footer.textContent=tx('footer');
  choices.forEach(b=>b.classList.toggle('is-active',b.dataset.languageChoice===lang));
  routeSession();
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
  const resumable=isResumableSession(session);
  screen(`<div class="welcome-layout"><img class="welcome-logo" src="/Assets/Images/Logo.png?v=20260911-phase3" alt="Willena English Academy"><div class="welcome-panel"><h1>${tx('title')}</h1>${resumable?`<p class="lead">${tx('resumeText')}</p><div class="actions"><button class="btn btn-ghost" id="newTest" type="button">${tx('newTest')}</button><button class="welcome-start" id="resumeTest" type="button">${tx('resume')}</button></div>`:`<button class="welcome-start" id="welcomeStart" type="button">${tx('start')}</button>`}</div></div>`);
}

function renderIntake(){
  document.body.classList.remove('welcome-mode');
  app.innerHTML='<div class="candidate-flow-host"></div>';
  intake=createVisitorIntake({
    host:app.querySelector('.candidate-flow-host'),
    lang,
    onCancel:renderWelcome,
    onComplete:data=>{
      session=createAssessmentSession(data);
      renderSpeakingHandoff();
    }
  });
}

function visitorSummary(){
  const visitor=session?.visitor||{};
  return `<div class="candidate-summary handoff-summary"><div><small>${lang==='ko'?'학생':'Student'}</small><strong>${visitor.student_name||''}</strong></div><div><small>${lang==='ko'?'학교 / 학년':'School / grade'}</small><strong>${visitor.school_name||''} · ${visitor.school_grade||''}</strong></div><div><small>${lang==='ko'?'보호자 연락처':'Parent phone'}</small><strong>${visitor.parent_phone_display||''}</strong></div></div>`;
}

function renderSpeakingHandoff(){
  document.body.classList.remove('welcome-mode');
  screen(`<div class="eyebrow">Level Test v2</div><h2>${tx('handoff')}</h2><p class="lead">${tx('handoffText')}</p>${visitorSummary()}<div class="actions"><button class="btn btn-ghost" id="editIntake" type="button">${tx('back')}</button><button class="btn btn-primary" id="startSpeaking" type="button">${tx('continue')}</button></div>`);
}

function renderSpeakingPlaceholder(){
  document.body.classList.remove('welcome-mode');
  screen(`<div class="eyebrow">Level Test v2 · Session ${session?.id?.slice(0,8)||''}</div><h2>${tx('speakingTitle')}</h2><p class="lead">${tx('speakingText')}</p>${visitorSummary()}<div class="candidate-summary"><div><small>Status</small><strong>${session?.status||''}</strong></div><div><small>Phase</small><strong>${session?.phase||''}</strong></div><div><small>Actor</small><strong>${session?.actor||''}</strong></div></div><div class="actions"><button class="btn btn-ghost" id="backToHandoff" type="button">${tx('back')}</button></div>`);
}

function routeSession(){
  if(!isResumableSession(session)){renderWelcome();return;}
  if(session.phase===SESSION_PHASE.SPEAKING_HANDOFF){renderSpeakingHandoff();return;}
  if(session.phase===SESSION_PHASE.SPEAKING){renderSpeakingPlaceholder();return;}
  if(session.phase===SESSION_PHASE.STUDENT_HANDOFF||session.phase===SESSION_PHASE.STUDENT_TEST){renderSpeakingPlaceholder();return;}
  renderWelcome();
}

choices.forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.languageChoice)));
app.addEventListener('click',e=>{
  if(e.target.closest('#welcomeStart')) renderIntake();
  if(e.target.closest('#resumeTest')) routeSession();
  if(e.target.closest('#newTest')){clearAssessmentSession();session=null;renderIntake();}
  if(e.target.closest('#editIntake')){clearAssessmentSession();session=null;renderIntake();}
  if(e.target.closest('#startSpeaking')){session=beginSpeaking(session);renderSpeakingPlaceholder();}
  if(e.target.closest('#backToHandoff')){session=setSessionPhase(session,{phase:SESSION_PHASE.SPEAKING_HANDOFF,status:SESSION_STATUS.SPEAKING_IN_PROGRESS,actor:'teacher'});renderSpeakingHandoff();}
});

if(isResumableSession(session)) routeSession(); else renderWelcome();
