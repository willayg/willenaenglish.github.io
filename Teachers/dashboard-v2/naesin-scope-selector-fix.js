(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let modalWasOpen=false;
let currentStep=1;
let selectedLessons=new Set();
let editMode=false;

function addStyles(){
  if($('#naScopeSelectorFixStyles')) return;
  const s=document.createElement('style');
  s.id='naScopeSelectorFixStyles';
  s.textContent=`
    #naFreshEditBg .na-modal{width:min(900px,96vw)!important}
    #naFreshEditBg .na-modal-head{align-items:center!important}
    #naFreshEditBg .na-wizard-progress{display:flex;gap:6px;margin-top:8px}
    #naFreshEditBg .na-wizard-dot{height:5px;width:34px;border-radius:99px;background:#e2e6e9}
    #naFreshEditBg .na-wizard-dot.on{background:#58c3d2}
    #naFreshEditBg .na-wizard-step{display:none}
    #naFreshEditBg .na-wizard-step.active{display:block}
    #naFreshEditBg .na-step-heading{margin:0 0 16px}
    #naFreshEditBg .na-step-heading h3{margin:0;font-size:1rem;color:#343343}
    #naFreshEditBg .na-step-heading p{margin:4px 0 0;font-size:.7rem;color:#7d8390}
    #naFreshEditBg .na-field:has(#naBook){border:1.5px solid #dfe4e8;border-radius:14px;padding:13px;background:#fff;margin-bottom:14px}
    #naFreshEditBg .na-field:has(#naBook)>label,#naFreshEditBg .na-field:has(#naScope)>label{font-size:.78rem!important;color:#343343!important;margin-bottom:8px!important}
    #naFreshEditBg #naBook{border:2px solid #cfd7dc!important;min-height:46px;font-weight:600}
    #naFreshEditBg .na-lesson-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    #naFreshEditBg .na-lesson-tile{min-height:88px;border:2px solid #d9e0e4;border-radius:16px;background:#fff;padding:15px;text-align:left;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:12px;color:#343343;transition:.14s ease}
    #naFreshEditBg .na-lesson-tile:hover{border-color:#a9dce3}
    #naFreshEditBg .na-lesson-tile.on{border-color:#58c3d2;background:#effafb;box-shadow:0 0 0 2px rgba(88,195,210,.13)}
    #naFreshEditBg .na-lesson-name{font-size:.95rem;font-weight:800}
    #naFreshEditBg .na-lesson-meta{font-size:.62rem;color:#8a929b;margin-top:4px}
    #naFreshEditBg .na-lesson-check{width:28px;height:28px;border-radius:999px;border:2px solid #d9e0e4;display:grid;place-items:center;font-size:.75rem;font-weight:900;color:transparent;background:#fff;flex:0 0 auto}
    #naFreshEditBg .na-lesson-tile.on .na-lesson-check{border-color:#58c3d2;background:#58c3d2;color:#fff}
    #naFreshEditBg .na-selected-count{margin-top:12px;padding:10px 12px;border-radius:11px;background:#f5f7f8;color:#69717b;font-size:.68rem;font-weight:700}
    #naFreshEditBg .na-field:has(#naScope){border-top:0;padding-top:0;margin-top:0}
    #naFreshEditBg #naScope{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
    #naFreshEditBg .na-scope{display:none;margin:0!important;border:2px solid #d9e0e4!important;border-radius:15px!important;background:#fff!important;overflow:hidden;transition:border-color .14s ease,background .14s ease,box-shadow .14s ease}
    #naFreshEditBg .na-scope.wizard-selected{display:block}
    #naFreshEditBg .na-scope:hover{border-color:#a9dce3!important}
    #naFreshEditBg .na-scope.has-selected{border-color:#58c3d2!important;background:#f0fbfc!important;box-shadow:0 0 0 2px rgba(88,195,210,.15)}
    #naFreshEditBg .na-scope-head{padding:13px 14px!important;min-height:49px;background:#f8fafb!important;font-size:.84rem!important;cursor:pointer;border-bottom:1px solid #edf0f2}
    #naFreshEditBg .na-scope.has-selected .na-scope-head{background:#dff6f8!important;color:#176f78!important;border-bottom-color:#c7edf1}
    #naFreshEditBg .na-scope-head span{font-weight:800;font-size:.88rem}
    #naFreshEditBg .na-scope-head small{font-size:.62rem;color:#8a929b;font-weight:700}
    #naFreshEditBg .na-scope.has-selected .na-scope-head small{color:#287b85}
    #naFreshEditBg .na-scope-body{padding:11px 12px 12px!important;gap:6px!important;background:transparent!important}
    #naFreshEditBg .na-scope-chip{border:1.5px solid #dce2e6!important;background:#fff!important;color:#68717c!important;border-radius:9px!important;padding:7px 9px!important;font-size:.64rem!important;font-weight:700!important;transition:.12s ease}
    #naFreshEditBg .na-scope-chip.on{border-color:#58c3d2!important;background:#58c3d2!important;color:#fff!important;box-shadow:0 2px 6px rgba(52,164,178,.18)}
    #naFreshEditBg .na-scope-chip.on:before{content:'✓ ';font-weight:900}
    #naFreshEditBg .na-modal-body{scroll-behavior:smooth}
    #naFreshEditBg .na-modal-foot{position:sticky;bottom:0;z-index:3;align-items:center}
    #naFreshEditBg .na-foot-spacer{flex:1}
    #naFreshEditBg #naWizardBack{display:none}
    #naFreshEditBg #naEditSave{display:none}
    #naFreshEditBg #naWizardNext{min-width:110px}
    @media(max-width:700px){
      #naFreshEditBg .na-lesson-grid,#naFreshEditBg #naScope{grid-template-columns:1fr;gap:9px}
      #naFreshEditBg .na-lesson-tile{min-height:74px;padding:13px}
      #naFreshEditBg .na-scope-head{min-height:46px;padding:12px 13px!important}
    }
  `;
  document.head.appendChild(s);
}

function updateUnitStates(){
  $$('#naScope .na-scope').forEach(row=>{
    const selected=$$('.na-scope-chip.on',row);
    row.classList.toggle('has-selected',selected.length>0);
    const small=$('.na-scope-head small',row);
    if(small){
      const total=$$('.na-scope-chip',row).length;
      small.textContent=selected.length ? `${selected.length}/${total} 선택됨` : (total ? '영역 선택' : '문제 없음');
    }
  });
}

function ensureWizard(){
  const bg=$('#naFreshEditBg');
  const body=bg?.querySelector('.na-modal-body');
  const foot=bg?.querySelector('.na-modal-foot');
  if(!bg||!body||!foot||body.dataset.wizardBuilt==='1') return;
  body.dataset.wizardBuilt='1';

  const children=[...body.children];
  const status=$('#naEditStatus');
  const scopeField=$('#naScope')?.closest('.na-field');
  const bookField=$('#naBook')?.closest('.na-field');

  const step1=document.createElement('div');
  step1.className='na-wizard-step'; step1.dataset.step='1';
  step1.innerHTML='<div class="na-step-heading"><h3>시험 정보</h3><p>학교, 학생, 교재와 시험 일정을 설정합니다.</p></div>';
  children.forEach(el=>{if(el!==scopeField&&el!==status)step1.appendChild(el)});

  const step2=document.createElement('div');
  step2.className='na-wizard-step'; step2.dataset.step='2';
  step2.innerHTML='<div class="na-step-heading"><h3>시험 범위</h3><p>시험에 포함되는 Lesson을 먼저 선택하세요.</p></div><div id="naLessonPicker" class="na-lesson-grid"></div><div id="naLessonCount" class="na-selected-count">선택된 Lesson 없음</div>';

  const step3=document.createElement('div');
  step3.className='na-wizard-step'; step3.dataset.step='3';
  step3.innerHTML='<div class="na-step-heading"><h3>영역 선택</h3><p>선택한 Lesson에서 시험에 포함할 영역을 조정하세요.</p></div>';
  if(scopeField) step3.appendChild(scopeField);

  body.innerHTML='';
  body.append(step1,step2,step3);
  if(status) body.appendChild(status);

  const headMain=$('.na-modal-head-main',bg);
  if(headMain&&!$('#naWizardProgress',headMain)){
    const p=document.createElement('div');
    p.id='naWizardProgress'; p.className='na-wizard-progress';
    p.innerHTML='<span class="na-wizard-dot"></span><span class="na-wizard-dot"></span><span class="na-wizard-dot"></span>';
    headMain.appendChild(p);
  }

  const cancel=$('#naEditCancel');
  const save=$('#naEditSave');
  const back=document.createElement('button'); back.type='button'; back.className='na-btn'; back.id='naWizardBack'; back.textContent='이전';
  const spacer=document.createElement('div'); spacer.className='na-foot-spacer';
  const next=document.createElement('button'); next.type='button'; next.className='na-btn dark'; next.id='naWizardNext'; next.textContent='다음';
  foot.innerHTML='';
  if(cancel) foot.appendChild(cancel);
  foot.append(back,spacer,next);
  if(save) foot.appendChild(save);

  back.onclick=()=>goStep(currentStep-1);
  next.onclick=()=>advance();
}

function scopeRows(){return $$('#naScope .na-scope')}
function lessonKey(row){return String(row?.dataset.lesson||'')}

function renderLessonPicker(){
  const box=$('#naLessonPicker'); if(!box) return;
  const rows=scopeRows();
  box.innerHTML=rows.map(row=>{
    const key=lessonKey(row), count=$$('.na-scope-chip',row).length;
    return `<button type="button" class="na-lesson-tile ${selectedLessons.has(key)?'on':''}" data-lesson="${key.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"><span><span class="na-lesson-name">${key.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span><span class="na-lesson-meta">${count}개 영역</span></span><span class="na-lesson-check">✓</span></button>`;
  }).join('');
  $$('.na-lesson-tile',box).forEach(btn=>btn.onclick=()=>{
    const key=btn.dataset.lesson;
    selectedLessons.has(key)?selectedLessons.delete(key):selectedLessons.add(key);
    btn.classList.toggle('on',selectedLessons.has(key));
    updateLessonCount();
  });
  updateLessonCount();
}

function updateLessonCount(){
  const n=selectedLessons.size;
  const el=$('#naLessonCount');
  if(el) el.textContent=n?`${n}개 Lesson 선택됨`:'선택된 Lesson 없음';
}

function syncRowsForSelectedLessons(){
  scopeRows().forEach(row=>{
    const key=lessonKey(row), on=selectedLessons.has(key);
    row.classList.toggle('wizard-selected',on);
    const chips=$$('.na-scope-chip',row);
    if(on){
      if(!chips.some(c=>c.classList.contains('on'))) chips.forEach(c=>c.classList.add('on'));
    }else{
      chips.forEach(c=>c.classList.remove('on'));
    }
  });
  updateUnitStates();
}

function setStatus(msg=''){
  const s=$('#naEditStatus'); if(s) s.textContent=msg;
}

function validateStep1(){
  if(!($('#naSchool')?.value||'').trim()){setStatus('학교를 입력하세요.');return false}
  if(!($('#naDate')?.value||'')){setStatus('시험일을 선택하세요.');return false}
  if(!$$('#naStudentPick input:checked').length){setStatus('학생을 한 명 이상 선택하세요.');return false}
  if(!($('#naBook')?.value||'')){setStatus('교재를 선택하세요.');return false}
  setStatus(''); return true;
}

function advance(){
  if(currentStep===1){if(!validateStep1())return;goStep(2);return}
  if(currentStep===2){
    if(!selectedLessons.size){setStatus('시험에 포함할 Lesson을 하나 이상 선택하세요.');return}
    syncRowsForSelectedLessons(); setStatus(''); goStep(3); return;
  }
}

function goStep(step){
  currentStep=Math.max(1,Math.min(3,step));
  $$('.na-wizard-step').forEach(el=>el.classList.toggle('active',Number(el.dataset.step)===currentStep));
  $$('.na-wizard-dot').forEach((d,i)=>d.classList.toggle('on',i<currentStep));
  const back=$('#naWizardBack'),next=$('#naWizardNext'),save=$('#naEditSave');
  if(back) back.style.display=currentStep>1?'inline-flex':'none';
  if(next) next.style.display=currentStep<3?'inline-flex':'none';
  if(save){save.style.display=currentStep===3?'inline-flex':'none';save.textContent=editMode?'변경 저장':'시험 만들기'}
  const subtitle=$('.na-modal-head-main p');
  if(subtitle) subtitle.textContent=currentStep===1?'학교, 학생, 교재와 시험 정보를 설정합니다.':currentStep===2?'시험에 포함할 Lesson을 선택합니다.':'선택한 Lesson의 영역을 조정합니다.';
  const body=$('#naFreshEditBg .na-modal-body'); if(body) body.scrollTop=0;
  setStatus('');
}

function initializeFromScope(){
  editMode=!(($('#naEditTitle')?.textContent||'').includes('새 시험'));
  selectedLessons=new Set();
  if(!editMode){
    // Core defaults Lesson 1 on new groups; the wizard should start blank.
    $$('#naScope .na-scope-chip.on').forEach(c=>c.classList.remove('on'));
  }
  scopeRows().forEach(row=>{
    if($$('.na-scope-chip.on',row).length) selectedLessons.add(lessonKey(row));
  });
  renderLessonPicker();
  syncRowsForSelectedLessons();
  goStep(1);
}

function wire(){
  addStyles();
  ensureWizard();
  const scope=$('#naScope');
  if(scope&&!scope.dataset.unitSelectorWired){
    scope.dataset.unitSelectorWired='1';
    scope.addEventListener('click',()=>setTimeout(updateUnitStates,0));
  }
  const book=$('#naBook');
  if(book&&!book.dataset.unitSelectorWired){
    book.dataset.unitSelectorWired='1';
    book.addEventListener('change',()=>setTimeout(()=>{
      selectedLessons=new Set();
      $$('#naScope .na-scope-chip.on').forEach(c=>c.classList.remove('on'));
      renderLessonPicker();
      syncRowsForSelectedLessons();
    },0));
  }
  updateUnitStates();
  onModalState();
}

function onModalState(){
  const bg=$('#naFreshEditBg'); if(!bg)return;
  const open=bg.classList.contains('open');
  if(open&&!modalWasOpen){
    modalWasOpen=true;
    requestAnimationFrame(()=>setTimeout(initializeFromScope,0));
  }else if(!open&&modalWasOpen){
    modalWasOpen=false;
  }
}

let raf=0;
function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(wire)}
function boot(){wire();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class'])}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();