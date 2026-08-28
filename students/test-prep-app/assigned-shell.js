(function(){
'use strict';
const CONTENT='https://gxwfsqxyuufqtitspfqg.supabase.co';
const KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
const HEAD={apikey:KEY,Authorization:`Bearer ${KEY}`};
let selection=null;
function addScript(src,dataKey){if(document.querySelector(`script[${dataKey}]`))return;const s=document.createElement('script');s.src=src;s.setAttribute(dataKey,'1');document.head.appendChild(s)}
addScript('./tracking-phase1.js?v=20260827-phase10','data-testprep-phase1-tracking');
addScript('./vocab-practice.js?v=20260827-vocab9','data-testprep-vocab-practice');
addScript('./vocab-test-practice.js?v=20260827-vocabtest3','data-testprep-vocab-test-practice');
addScript('./sentence-practice.js?v=20260827-sentence8','data-testprep-sentence-practice');

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));

function headerIdentity(){
  return {
    name:localStorage.getItem('user_name')||sessionStorage.getItem('user_name')||localStorage.getItem('username')||sessionStorage.getItem('username')||'Student',
    avatar:localStorage.getItem('selectedEmojiAvatar')||sessionStorage.getItem('selectedEmojiAvatar')||localStorage.getItem('avatar')||sessionStorage.getItem('avatar')||'🙂'
  };
}
function renderHeaderValues(values={}){
  const header=document.getElementById('tpStudentHeader');if(!header)return;
  const identity=headerIdentity();
  const name=header.querySelector('[data-tp-name]'),avatar=header.querySelector('[data-tp-avatar]'),points=header.querySelector('[data-tp-points]'),stars=header.querySelector('[data-tp-stars]');
  if(name)name.textContent=values.name||identity.name;
  if(avatar)avatar.textContent=values.avatar||identity.avatar;
  if(points&&Number.isFinite(values.points))points.textContent=String(values.points);
  if(stars&&Number.isFinite(values.stars))stars.textContent=String(values.stars);
}
async function refreshHeader(){
  renderHeaderValues();
  try{
    const [profileRes,overviewRes]=await Promise.all([
      window.WillenaAPI?.fetch?.(`/.netlify/functions/supabase_auth?action=get_profile_name&_=${Date.now()}`),
      window.WillenaAPI?.fetch?.(`/.netlify/functions/progress_summary?section=overview&_=${Date.now()}`)
    ]);
    const profile=profileRes?.ok?await profileRes.json():null;
    const overview=overviewRes?.ok?await overviewRes.json():null;
    const values={};
    if(profile?.success){values.name=profile.name||profile.username||null;values.avatar=profile.avatar||null}
    if(typeof overview?.points==='number')values.points=overview.points;
    if(typeof overview?.stars==='number')values.stars=overview.stars;
    renderHeaderValues(values);
  }catch(_){}
}
function setProfileMenu(open){
  const header=document.getElementById('tpStudentHeader');if(!header)return;
  const menu=header.querySelector('#tpProfileMenu'),avatar=header.querySelector('.tp-header-avatar');
  if(!menu||!avatar)return;
  menu.hidden=!open;
  avatar.setAttribute('aria-expanded',String(open));
}
async function logoutStudent(){
  try{
    const keys=['user_name','username','name','user_id','userId','student_id','profile_id','selectedEmojiAvatar','avatar','user_role','sb_access_token'];
    for(const key of keys){localStorage.removeItem(key);sessionStorage.removeItem(key)}
    const opts='Path=/; Max-Age=0; SameSite=Lax';
    document.cookie='wa_guest_id=; '+opts;
    document.cookie='wa_guest_name=; '+opts;
    if(/willenaenglish\.com$/i.test(location.hostname)){
      document.cookie='wa_guest_id=; Domain=.willenaenglish.com; '+opts;
      document.cookie='wa_guest_name=; Domain=.willenaenglish.com; '+opts;
    }
    sessionStorage.removeItem('missionModalShown');
    sessionStorage.removeItem('wa_hw_tap_hint_shown');
  }catch(_){}
  try{await window.WillenaAPI?.fetch?.('/.netlify/functions/supabase_auth?action=logout',{method:'POST'})}catch(_){}
  try{window.dispatchEvent(new Event('auth:changed'))}catch(_){}
  location.href='/students/login.html?next='+encodeURIComponent(location.pathname);
}
function installHeader(){
  if(document.getElementById('tpStudentHeader'))return;
  const identity=headerIdentity();
  const header=document.createElement('header');
  header.id='tpStudentHeader';
  header.className='tp-student-header';
  header.innerHTML=`
    <div class="tp-header-orb" aria-hidden="true"></div>
    <div class="tp-header-inner">
      <div class="tp-header-profile">
        <div class="tp-header-name" data-tp-name>${esc(identity.name)}</div>
        <div class="tp-header-counters">
          <span class="tp-header-pill tp-header-points"><span class="tp-header-symbol">+</span><b data-tp-points>—</b></span>
          <span class="tp-header-pill tp-header-stars"><span class="tp-header-star">★</span><b data-tp-stars>—</b></span>
        </div>
      </div>
      <div class="tp-header-brand">
        <div class="tp-header-title">Test Prep</div>
        <div class="tp-profile-menu-wrap">
          <button class="tp-header-avatar" type="button" aria-label="프로필 메뉴" aria-haspopup="menu" aria-expanded="false"><span data-tp-avatar>${esc(identity.avatar)}</span></button>
          <div class="tp-profile-menu" id="tpProfileMenu" role="menu" hidden>
            <a class="tp-profile-menu-item" role="menuitem" href="/students/dashboard.html"><span class="tp-profile-menu-icon">⌂</span><span>Student Home</span></a>
            <a class="tp-profile-menu-item" role="menuitem" href="/students/profile.html"><span class="tp-profile-menu-icon">☺</span><span>My Profile</span></a>
            <a class="tp-profile-menu-item" role="menuitem" href="/Games/english_arcade/index.html"><span class="tp-profile-menu-icon">★</span><span>English Arcade</span></a>
            <div class="tp-profile-menu-divider" aria-hidden="true"></div>
            <button class="tp-profile-menu-item tp-profile-logout" id="tpProfileLogout" role="menuitem" type="button"><span class="tp-profile-menu-icon">↪</span><span>Logout</span></button>
          </div>
        </div>
      </div>
    </div>
    <div class="tp-header-curve" aria-hidden="true"></div>`;
  document.body.insertBefore(header,document.body.firstChild);
  const avatarBtn=header.querySelector('.tp-header-avatar');
  avatarBtn?.addEventListener('click',e=>{e.stopPropagation();setProfileMenu(avatarBtn.getAttribute('aria-expanded')!=='true')});
  header.querySelector('#tpProfileLogout')?.addEventListener('click',logoutStudent);
  header.querySelector('#tpProfileMenu')?.addEventListener('click',e=>e.stopPropagation());
  document.addEventListener('click',()=>setProfileMenu(false));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){setProfileMenu(false);avatarBtn?.focus()}});
  refreshHeader();
  window.addEventListener('focus',refreshHeader);
  window.addEventListener('points:update',refreshHeader);
  window.addEventListener('stars:refresh',refreshHeader);
  window.addEventListener('auth:changed',refreshHeader);
}
installHeader();

const app=document.querySelector('.app'),home=document.createElement('div'),quiz=document.createElement('div');
home.id='assignmentHome';quiz.id='assignedQuizPane';quiz.style.display='none';
if(app){const engine=document.getElementById('engineShell');app.append(home,quiz);if(engine)quiz.appendChild(engine)}
const practiceLabel=k=>({vocabulary:'단어 학습',vocab_test:'어휘 시험',sentences:'본문외우기',communication:'Communication',grammar:'Grammar',reading:'Reading'}[k]||k);
function installDebugPanel(){const qs=new URLSearchParams(location.search);if(qs.get('debug')!=='tracking'||document.getElementById('trackingDebug'))return;const panel=document.createElement('div');panel.id='trackingDebug';panel.innerHTML='<strong>Tracking debug</strong><pre>Answer a question to see the saved event.</pre>';document.body.appendChild(panel);const show=(type,detail)=>{const pre=panel.querySelector('pre');if(pre)pre.textContent=JSON.stringify({type,...detail},null,2)};window.addEventListener('testprep:tracking',e=>show('tracking',e.detail));window.addEventListener('testprep:vocab-attempt',e=>show('vocab-attempt',e.detail));window.addEventListener('testprep:sentence-attempt',e=>show('sentence-attempt',e.detail))}
function restorePractice(){window.WillenaVocabPractice?.restore?.();window.WillenaVocabTestPractice?.restore?.();window.WillenaSentencePractice?.restore?.()}
function activePracticeState(){return history.state?.tp==='practice'&&quiz.style.display!=='none'}
function showHomeSurface(){if(activePracticeState())return false;quiz.style.display='none';home.style.display='block';return true}
function renderHome(){if(activePracticeState())return false;restorePractice();selection=null;showHomeSurface();home.innerHTML='<div class="tp-shell-loading">시험 대비를 불러오는 중...</div>';return true}
async function contentGet(path){const r=await fetch(CONTENT+path,{headers:HEAD,cache:'no-store'});if(!r.ok)throw new Error(await r.text());return r.json()}
async function resolveIds(plan,lesson){const books=await contentGet(`/rest/v1/content_books?select=id,title&title=eq.${encodeURIComponent(plan.book_label)}&limit=1`);if(!books[0])throw new Error('교재를 콘텐츠 DB에서 찾지 못했습니다.');const units=await contentGet(`/rest/v1/content_units?select=id,title&book_id=eq.${books[0].id}&title=eq.${encodeURIComponent(lesson)}&limit=1`);if(!units[0])throw new Error('Lesson을 콘텐츠 DB에서 찾지 못했습니다.');return{bookId:books[0].id,unitId:units[0].id}}
async function waitFor(name){for(let i=0;i<80;i++){if(window[name])return window[name];await new Promise(r=>setTimeout(r,50))}throw new Error('Practice module did not load.')}
function showBack(plan){let back=document.getElementById('assignedBackRow');if(!back){back=document.createElement('div');back.id='assignedBackRow';back.className='quiz-top-back';quiz.insertBefore(back,quiz.firstChild)}back.innerHTML=`<button class="back-assign">${selection?.reviewMode?'← 오답 복습':`← ${esc(selection?.lesson||'Lesson')}`}</button><span class="quiz-context">${esc(plan.book_label)} · ${esc(selection.lesson)} · ${esc(practiceLabel(selection.section))}</span>`;return back}
function leavePractice(){const old=selection;restorePractice();quiz.style.display='none';home.style.display='block';if(old?.reviewMode&&window.WillenaTestPrepUX?.showWrongCenter){window.WillenaTestPrepUX.showWrongCenter();return}if(old?.plan&&old?.lesson&&window.WillenaTestPrepUX?.renderLesson){window.WillenaTestPrepUX.renderLesson(old.plan.id,old.lesson,old.section);return}window.WillenaTestPrepUX?.renderHome?.()}
async function start(btn){const state=window.WillenaTestPrepAuth.state,plan=state.plans.find(p=>String(p.id)===String(btn.dataset.plan));if(!plan)return;btn.classList.add('loading');try{const ids=await resolveIds(plan,btn.dataset.lesson),opts=btn.__reviewOptions||{};selection={plan,lesson:btn.dataset.lesson,section:String(btn.dataset.section||'communication').toLowerCase(),...ids,reviewMode:!!opts.reviewMode,reviewIds:Array.isArray(opts.reviewIds)?opts.reviewIds.map(String):[]};home.style.display='none';quiz.style.display='block';window.WillenaTestPrepAuth.setActivePlan(plan,selection.lesson);const back=showBack(plan);if(selection.section==='vocabulary'){window.WillenaVocabTestPractice?.restore?.();window.WillenaSentencePractice?.restore?.();back.querySelector('button').onclick=leavePractice;const mod=await waitFor('WillenaVocabPractice');await mod.start({quiz,unitId:selection.unitId,lesson:selection.lesson,bookLabel:plan.book_label,onlyIds:selection.reviewIds,reviewMode:selection.reviewMode});return}if(selection.section==='vocab_test'){window.WillenaVocabPractice?.restore?.();window.WillenaSentencePractice?.restore?.();back.querySelector('button').onclick=leavePractice;const mod=await waitFor('WillenaVocabTestPractice');await mod.start({quiz,unitId:selection.unitId,lesson:selection.lesson,bookLabel:plan.book_label,onlyIds:selection.reviewIds,reviewMode:selection.reviewMode});return}if(selection.section==='sentences'){window.WillenaVocabPractice?.restore?.();window.WillenaVocabTestPractice?.restore?.();back.querySelector('button').onclick=leavePractice;const mod=await waitFor('WillenaSentencePractice');await mod.start({quiz,unitId:selection.unitId,lesson:selection.lesson,bookLabel:plan.book_label,onlyIds:selection.reviewIds,reviewMode:selection.reviewMode});return}restorePractice();window.WillenaTestPrepAuth.beginStudyActivity?.();back.querySelector('button').onclick=async()=>{try{await window.WillenaTestPrepAuth.completeSession(0,0,[])}catch(_){}leavePractice()};const engine=window.WillenaTestPrepQuestionEngine;if(!engine?.loadSection)throw new Error('Question engine did not load.');await engine.loadSection(selection.section)}catch(e){console.error('[test-prep] activity start failed',e);alert(e.message||'시험 범위를 불러오지 못했습니다.');quiz.style.display='none';home.style.display='block';if(selection?.reviewMode&&window.WillenaTestPrepUX?.showWrongCenter)window.WillenaTestPrepUX.showWrongCenter();else if(window.WillenaTestPrepUX?.renderHome)window.WillenaTestPrepUX.renderHome()}finally{btn.classList.remove('loading')}}
async function startSelection(planId,lesson,section,opts={}){const b=document.createElement('button');b.dataset.plan=String(planId);b.dataset.lesson=String(lesson);b.dataset.section=String(section);b.__reviewOptions=opts;return start(b)}
function questionQuery(){if(!selection)return'';let q=`&book_id=eq.${encodeURIComponent(selection.bookId)}&unit_id=eq.${encodeURIComponent(selection.unitId)}`;if(selection.reviewIds?.length&&!['vocabulary','vocab_test','sentences'].includes(selection.section))q+=`&id=in.${encodeURIComponent('('+selection.reviewIds.join(',')+')')}`;return q}
function init(){installDebugPanel();renderHome()}
window.addEventListener('testprep:review-group-complete',()=>{restorePractice()});
window.WillenaAssignedTestPrep={init,renderHome,startSelection,questionQuery,showHomeSurface,get selection(){return selection}};
})();