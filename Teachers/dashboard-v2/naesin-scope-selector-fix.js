(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
let modalOpen=false;
let currentStep=1;
let selectedLessons=new Set();
let editMode=false;

function addStyles(){
  if($('#naWizardStyles')) return;
  const s=document.createElement('style');
  s.id='naWizardStyles';
  s.textContent=`
#naFreshEditBg .na-modal{width:min(900px,96vw)!important;max-height:92vh!important;display:flex!important;flex-direction:column!important}
#naFreshEditBg .na-modal-head{flex:0 0 auto;align-items:center!important}
#naFreshEditBg .na-modal-body{flex:1 1 auto!important;min-height:0!important;overflow:auto!important;padding:20px!important}
#naFreshEditBg .na-modal-foot{flex:0 0 auto!important;display:flex!important;align-items:center!important;gap:8px!important;padding:13px 18px!important;border-top:1.5px solid #dfe4e8!important;background:#fff!important}
#naFreshEditBg .na-wizard-step{display:none!important}
#naFreshEditBg .na-wizard-step.active{display:block!important}
#naFreshEditBg .na-wizard-progress{display:flex!important;gap:6px!important;margin-top:8px!important}
#naFreshEditBg .na-wizard-dot{display:block!important;width:34px!important;height:5px!important;border-radius:99px!important;background:#e2e6e9!important}
#naFreshEditBg .na-wizard-dot.on{background:#58c3d2!important}
#naFreshEditBg .na-step-heading{margin:0 0 18px!important}
#naFreshEditBg .na-step-heading h3{margin:0!important;font-size:1rem!important;color:#343343!important}
#naFreshEditBg .na-step-heading p{margin:5px 0 0!important;font-size:.7rem!important;color:#7d8390!important}
#naFreshEditBg .na-lesson-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
#naFreshEditBg .na-lesson-tile{min-height:88px!important;border:2px solid #d9e0e4!important;border-radius:16px!important;background:#fff!important;padding:15px!important;text-align:left!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;color:#343343!important}
#naFreshEditBg .na-lesson-tile.on{border-color:#58c3d2!important;background:#effafb!important;box-shadow:0 0 0 2px rgba(88,195,210,.13)!important}
#naFreshEditBg .na-lesson-name{display:block!important;font-size:.95rem!important;font-weight:800!important}
#naFreshEditBg .na-lesson-meta{display:block!important;font-size:.62rem!important;color:#8a929b!important;margin-top:4px!important}
#naFreshEditBg .na-lesson-check{width:28px!important;height:28px!important;border-radius:999px!important;border:2px solid #d9e0e4!important;display:grid!important;place-items:center!important;color:transparent!important;background:#fff!important;flex:0 0 auto!important}
#naFreshEditBg .na-lesson-tile.on .na-lesson-check{border-color:#58c3d2!important;background:#58c3d2!important;color:#fff!important}
#naFreshEditBg .na-selected-count{margin-top:12px!important;padding:10px 12px!important;border-radius:11px!important;background:#f5f7f8!important;color:#69717b!important;font-size:.68rem!important;font-weight:700!important}
#naFreshEditBg #naScope{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:11px!important}
#naFreshEditBg #naScope .na-scope{display:none!important;margin:0!important;border:2px solid #d9e0e4!important;border-radius:15px!important;background:#fff!important;overflow:hidden!important}
#naFreshEditBg #naScope .na-scope.wizard-selected{display:block!important}
#naFreshEditBg #naScope .na-scope.has-selected{border-color:#58c3d2!important;background:#f0fbfc!important;box-shadow:0 0 0 2px rgba(88,195,210,.15)!important}
#naFreshEditBg #naScope .na-scope-head{padding:13px 14px!important;min-height:49px!important;background:#f8fafb!important;cursor:pointer!important;border-bottom:1px solid #edf0f2!important}
#naFreshEditBg #naScope .na-scope.has-selected .na-scope-head{background:#dff6f8!important;color:#176f78!important;border-bottom-color:#c7edf1!important}
#naFreshEditBg #naScope .na-scope-head span{font-weight:800!important;font-size:.88rem!important}
#naFreshEditBg #naScope .na-scope-head small{font-size:.62rem!important;color:#8a929b!important;font-weight:700!important}
#naFreshEditBg #naScope .na-scope-body{padding:11px 12px 12px!important;gap:6px!important;background:transparent!important}
#naFreshEditBg #naScope .na-scope-chip{border:1.5px solid #dce2e6!important;background:#fff!important;color:#68717c!important;border-radius:9px!important;padding:7px 9px!important;font-size:.64rem!important;font-weight:700!important}
#naFreshEditBg #naScope .na-scope-chip.on{border-color:#58c3d2!important;background:#58c3d2!important;color:#fff!important}
#naFreshEditBg #naScope .na-scope-chip.on:before{content:'✓ ';font-weight:900!important}
#naFreshEditBg .na-foot-spacer{flex:1!important}
#naFreshEditBg [hidden]{display:none!important}
#naFreshEditBg #naWizardNext,#naFreshEditBg #naEditSave{min-width:110px!important}
@media(max-width:700px){#naFreshEditBg .na-lesson-grid,#naFreshEditBg #naScope{grid-template-columns:1fr!important;gap:9px!important}#naFreshEditBg .na-lesson-tile{min-height:74px!important;padding:13px!important}}
`;
  document.head.appendChild(s);
}

function setStatus(msg=''){const el=$('#naEditStatus');if(el)el.textContent=msg}
function rows(){return $$('#naScope .na-scope')}
function lessonName(row){return String(row?.dataset.lesson||'')}
function updateRowState(row){
  const chips=$$('.na-scope-chip',row), picked=chips.filter(c=>c.classList.contains('on'));
  row.classList.toggle('has-selected',picked.length>0);
  const small=$('.na-scope-head small',row);
  if(small) small.textContent=picked.length?`${picked.length}/${chips.length} 선택됨`:(chips.length?'영역 선택':'문제 없음');
}
function updateAllRows(){rows().forEach(updateRowState)}

function ensureWizard(){
  const bg=$('#naFreshEditBg'),body=bg?.querySelector('.na-modal-body'),foot=bg?.querySelector('.na-modal-foot');
  if(!bg||!body||!foot||body.dataset.wizardBuilt==='1') return false;
  const scope=$('#naScope'),status=$('#naEditStatus');
  if(!scope||!status) return false;
  body.dataset.wizardBuilt='1';
  const scopeField=scope.closest('.na-field');
  const original=[...body.children];

  const step1=document.createElement('div');
  step1.className='na-wizard-step';step1.dataset.step='1';
  step1.innerHTML='<div class="na-step-heading"><h3>시험 정보</h3><p>학교, 학생, 교재와 시험 일정을 설정합니다.</p></div>';
  original.forEach(el=>{if(el!==scopeField&&el!==status)step1.appendChild(el)});

  const step2=document.createElement('div');
  step2.className='na-wizard-step';step2.dataset.step='2';
  step2.innerHTML='<div class="na-step-heading"><h3>시험 범위</h3><p>시험에 포함되는 Lesson을 선택하세요.</p></div><div id="naLessonPicker" class="na-lesson-grid"></div><div id="naLessonCount" class="na-selected-count">선택된 Lesson 없음</div>';

  const step3=document.createElement('div');
  step3.className='na-wizard-step';step3.dataset.step='3';
  step3.innerHTML='<div class="na-step-heading"><h3>영역 선택</h3><p>선택한 Lesson에서 포함할 영역을 조정하세요.</p></div>';
  step3.appendChild(scopeField);

  body.replaceChildren(step1,step2,step3,status);

  const headMain=$('.na-modal-head-main',bg);
  if(headMain&&!$('#naWizardProgress',headMain)){
    const p=document.createElement('div');p.id='naWizardProgress';p.className='na-wizard-progress';
    p.innerHTML='<span class="na-wizard-dot"></span><span class="na-wizard-dot"></span><span class="na-wizard-dot"></span>';
    headMain.appendChild(p);
  }

  const cancel=$('#naEditCancel'),save=$('#naEditSave');
  const back=document.createElement('button');back.type='button';back.id='naWizardBack';back.className='na-btn';back.textContent='이전';
  const spacer=document.createElement('div');spacer.className='na-foot-spacer';
  const next=document.createElement('button');next.type='button';next.id='naWizardNext';next.className='na-btn dark';next.textContent='다음';
  foot.replaceChildren();
  if(cancel)foot.appendChild(cancel);
  foot.append(back,spacer,next);
  if(save)foot.appendChild(save);
  back.onclick=()=>goStep(currentStep-1);
  next.onclick=advance;
  return true;
}

function renderLessonPicker(){
  const box=$('#naLessonPicker');if(!box)return;
  box.innerHTML=rows().map(row=>{
    const name=lessonName(row),count=$$('.na-scope-chip',row).length;
    const esc=name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
    return `<button type="button" class="na-lesson-tile ${selectedLessons.has(name)?'on':''}" data-lesson="${esc}"><span><span class="na-lesson-name">${esc}</span><span class="na-lesson-meta">${count}개 영역</span></span><span class="na-lesson-check">✓</span></button>`;
  }).join('');
  $$('.na-lesson-tile',box).forEach(btn=>btn.onclick=()=>{
    const name=btn.dataset.lesson;
    selectedLessons.has(name)?selectedLessons.delete(name):selectedLessons.add(name);
    btn.classList.toggle('on',selectedLessons.has(name));
    const c=$('#naLessonCount');if(c)c.textContent=selectedLessons.size?`${selectedLessons.size}개 Lesson 선택됨`:'선택된 Lesson 없음';
  });
  const c=$('#naLessonCount');if(c)c.textContent=selectedLessons.size?`${selectedLessons.size}개 Lesson 선택됨`:'선택된 Lesson 없음';
}

function syncSelectedRows(){
  rows().forEach(row=>{
    const on=selectedLessons.has(lessonName(row));
    row.classList.toggle('wizard-selected',on);
    const chips=$$('.na-scope-chip',row);
    if(on&&!chips.some(c=>c.classList.contains('on')))chips.forEach(c=>c.classList.add('on'));
    if(!on)chips.forEach(c=>c.classList.remove('on'));
    updateRowState(row);
  });
}

function validateStep1(){
  if(!($('#naSchool')?.value||'').trim()){setStatus('학교를 입력하세요.');return false}
  if(!($('#naDate')?.value||'')){setStatus('시험일을 선택하세요.');return false}
  if(!$$('#naStudentPick input:checked').length){setStatus('학생을 한 명 이상 선택하세요.');return false}
  if(!($('#naBook')?.value||'')){setStatus('교재를 선택하세요.');return false}
  setStatus('');return true;
}
function advance(){
  if(currentStep===1){if(validateStep1())goStep(2);return}
  if(currentStep===2){if(!selectedLessons.size){setStatus('시험에 포함할 Lesson을 하나 이상 선택하세요.');return}syncSelectedRows();goStep(3)}
}
function goStep(n){
  currentStep=Math.max(1,Math.min(3,n));
  $$('.na-wizard-step',$('#naFreshEditBg')).forEach(el=>el.classList.toggle('active',Number(el.dataset.step)===currentStep));
  $$('.na-wizard-dot',$('#naFreshEditBg')).forEach((el,i)=>el.classList.toggle('on',i<currentStep));
  const back=$('#naWizardBack'),next=$('#naWizardNext'),save=$('#naEditSave');
  if(back)back.hidden=currentStep===1;
  if(next)next.hidden=currentStep===3;
  if(save){save.hidden=currentStep!==3;save.textContent=editMode?'변경 저장':'시험 만들기'}
  const subtitle=$('#naFreshEditBg .na-modal-head-main p');
  if(subtitle)subtitle.textContent=currentStep===1?'학교, 학생, 교재와 시험 정보를 설정합니다.':currentStep===2?'시험에 포함할 Lesson을 선택합니다.':'선택한 Lesson의 영역을 조정합니다.';
  const body=$('#naFreshEditBg .na-modal-body');if(body)body.scrollTop=0;
  setStatus('');
}

function initialise(){
  editMode=!(($('#naEditTitle')?.textContent||'').includes('새 시험'));
  selectedLessons=new Set();
  if(!editMode)$$('#naScope .na-scope-chip.on').forEach(c=>c.classList.remove('on'));
  rows().forEach(row=>{if($$('.na-scope-chip.on',row).length)selectedLessons.add(lessonName(row))});
  renderLessonPicker();syncSelectedRows();goStep(1);
}

function wire(){
  addStyles();
  ensureWizard();
  const scope=$('#naScope');
  if(scope&&!scope.dataset.wizardWired){scope.dataset.wizardWired='1';scope.addEventListener('click',()=>setTimeout(updateAllRows,0))}
  const book=$('#naBook');
  if(book&&!book.dataset.wizardWired){book.dataset.wizardWired='1';book.addEventListener('change',()=>setTimeout(()=>{selectedLessons.clear();$$('#naScope .na-scope-chip.on').forEach(c=>c.classList.remove('on'));renderLessonPicker();syncSelectedRows()},0))}
  const bg=$('#naFreshEditBg');if(!bg)return;
  const open=bg.classList.contains('open');
  if(open&&!modalOpen){modalOpen=true;requestAnimationFrame(()=>setTimeout(initialise,0))}
  if(!open&&modalOpen)modalOpen=false;
}
let raf=0;
function scan(){cancelAnimationFrame(raf);raf=requestAnimationFrame(wire)}
function boot(){wire();new MutationObserver(scan).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();