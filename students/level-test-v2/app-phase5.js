import {createVisitorIntake} from './visitor-intake.js?v=20260911-phase5';
import {createNavigator} from './navigation.js?v=20260911-phase5';
import {createSpeakingAssessment} from './speaking-assessment.js?v=20260911-phase5';
import {
  SESSION_PHASE,
  SESSION_STATUS,
  createAssessmentSession,
  loadAssessmentSession,
  saveAssessmentSession,
  clearAssessmentSession,
  isResumableSession,
  beginSpeaking,
  markSpeakingComplete,
  setSessionPhase
} from './assessment-session.js?v=20260911-phase5';

const app=document.querySelector('#app');
const subtitle=document.querySelector('#brandSubtitle');
const footer=document.querySelector('#footerText');
const choices=[...document.querySelectorAll('[data-language-choice]')];
let lang='ko';
let session=loadAssessmentSession();
let activeView=null;
let navigator;

const T={
  ko:{brand:'무료 영어 레벨 테스트',footer:'Willena English · 스테이징 진단 테스트',title:'레벨 테스트',start:'시작하기',resume:'계속하기',newTest:'새 테스트',handoff:'학생 정보가 준비되었습니다',handoffText:'선생님이 먼저 말하기 평가를 진행합니다.',back:'뒤로',edit:'정보 수정',continue:'말하기 평가로 이동',done:'말하기 평가가 저장되었습니다',doneText:'다음 단계에서 말하기 추천 레벨과 시작 레벨 선택이 연결됩니다.'},
  en:{brand:'Free Level Test',footer:'Willena English · Staging assessment',title:'Level Test',start:'Start',resume:'Resume',newTest:'New test',handoff:'Student information is ready',handoffText:'The teacher completes the speaking assessment first.',back:'Back',edit:'Edit details',continue:'Continue to speaking',done:'Speaking assessment saved',doneText:'The speaking recommendation and start-level decision are connected in the next phase.'}
};
const tx=k=>T[lang][k]||k;
const routeForSession=s=>!isResumableSession(s)?'welcome':s.phase===SESSION_PHASE.SPEAKING_HANDOFF?'handoff':s.phase===SESSION_PHASE.SPEAKING?'speaking':s.phase===SESSION_PHASE.STUDENT_HANDOFF?'speaking-complete':'welcome';

function setLanguage(next){lang=next;document.documentElement.lang=lang;subtitle.textContent=tx('brand');footer.textContent=tx('footer');choices.forEach(b=>b.classList.toggle('is-active',b.dataset.languageChoice===lang));renderRoute(navigator.current());}
function clearView(){activeView?.destroy?.();activeView=null;}
function screen(html){clearView();app.classList.add('is-swapping');app.innerHTML=`<section class="screen screen-safe-in">${html}</section>`;requestAnimationFrame(()=>requestAnimationFrame(()=>{app.querySelector('.screen')?.classList.add('screen-safe-ready');app.classList.remove('is-swapping');}));}
function visitorSummary(){const v=session?.visitor||{};return `<div class="candidate-summary handoff-summary"><div><small>${lang==='ko'?'학생':'Student'}</small><strong>${v.student_name||''}</strong></div><div><small>${lang==='ko'?'학교 / 학년':'School / grade'}</small><strong>${v.school_name||''} · ${v.school_grade||''}</strong></div><div><small>${lang==='ko'?'보호자 연락처':'Parent phone'}</small><strong>${v.parent_phone_display||''}</strong></div></div>`;}

function renderWelcome(){document.body.classList.add('welcome-mode');const resumable=isResumableSession(session);screen(`<div class="welcome-layout"><img class="welcome-logo" src="/Assets/Images/Logo.png?v=20260911-phase5" alt="Willena English Academy"><div class="welcome-panel"><h1>${tx('title')}</h1>${resumable?`<div class="actions"><button class="btn btn-ghost" id="newTest" type="button">${tx('newTest')}</button><button class="welcome-start" id="resumeTest" type="button">${tx('resume')}</button></div>`:`<button class="welcome-start" id="welcomeStart" type="button">${tx('start')}</button>`}</div></div>`);}
function renderIntake(){clearView();document.body.classList.remove('welcome-mode');app.innerHTML='<div class="candidate-flow-host"></div>';activeView=createVisitorIntake({host:app.querySelector('.candidate-flow-host'),lang,onCancel:()=>navigator.back(),onComplete:data=>{session=createAssessmentSession(data);navigator.go('handoff');}});}
function renderHandoff(){document.body.classList.remove('welcome-mode');screen(`<div class="eyebrow">Level Test v2</div><h2>${tx('handoff')}</h2><p class="lead">${tx('handoffText')}</p>${visitorSummary()}<div class="actions"><button class="btn btn-ghost" id="editIntake" type="button">${tx('edit')}</button><button class="btn btn-primary" id="startSpeaking" type="button">${tx('continue')}</button></div>`);}
function renderSpeaking(){clearView();document.body.classList.remove('welcome-mode');app.innerHTML='<div class="speaking-flow-host"></div>';activeView=createSpeakingAssessment({host:app.querySelector('.speaking-flow-host'),session,lang,onChange:speaking=>{session=saveAssessmentSession({...session,speaking:{...(session.speaking||{}),...speaking}});},onBack:()=>navigator.back(),onComplete:speaking=>{session=saveAssessmentSession({...session,speaking:{...(session.speaking||{}),...speaking}});session=markSpeakingComplete(session);navigator.go('speaking-complete');}});}
function renderSpeakingComplete(){document.body.classList.remove('welcome-mode');screen(`<div class="eyebrow">Level Test v2</div><h2>${tx('done')}</h2><p class="lead">${tx('doneText')}</p>${visitorSummary()}<div class="candidate-summary"><div><small>${lang==='ko'?'선생님 말하기 레벨':'Teacher speaking level'}</small><strong>${session?.speaking?.teacher_level?`Level ${session.speaking.teacher_level}`:'—'}</strong></div><div><small>${lang==='ko'?'채점한 응답':'Scored responses'}</small><strong>${session?.speaking?.evidence?.length||0}</strong></div></div><div class="actions"><button class="btn btn-ghost" id="backToSpeaking" type="button">${tx('back')}</button></div>`);}

function renderRoute(route){if(route==='welcome')return renderWelcome();if(route==='intake')return renderIntake();if(route==='handoff')return renderHandoff();if(route==='speaking')return renderSpeaking();if(route==='speaking-complete')return renderSpeakingComplete();renderWelcome();}

choices.forEach(b=>b.addEventListener('click',()=>setLanguage(b.dataset.languageChoice)));
app.addEventListener('click',e=>{
  if(e.target.closest('#welcomeStart')) navigator.go('intake');
  if(e.target.closest('#resumeTest')) navigator.go(routeForSession(session));
  if(e.target.closest('#newTest')){clearAssessmentSession();session=null;navigator.go('intake');}
  if(e.target.closest('#editIntake')){clearAssessmentSession();session=null;navigator.go('intake');}
  if(e.target.closest('#startSpeaking')){session=beginSpeaking(session);navigator.go('speaking');}
  if(e.target.closest('#backToSpeaking')){session=setSessionPhase(session,{phase:SESSION_PHASE.SPEAKING,status:SESSION_STATUS.SPEAKING_IN_PROGRESS,actor:'teacher'});navigator.go('speaking');}
});

navigator=createNavigator({initialRoute:routeForSession(session),onRoute:renderRoute});
navigator.start(routeForSession(session));
