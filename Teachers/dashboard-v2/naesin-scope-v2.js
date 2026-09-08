(()=>{
'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const GROUP_API='https://fiieuiktlsivwfgyivai.supabase.co/functions/v1/test-prep-groups';
const CONTENT_URL='https://gxwfsqxyuufqtitspfqg.supabase.co';
const CONTENT_KEY=['sb_publishable_','G-FYhHfDL4OGdL892gY1Zg_','epdbEeqO'].join('');
let wasOpen=false,editingGroupId=null,groupScopes=new Map(),fetchPatched=false;
let externalCatalog=[],externalLoadPromise=null,externalLoadedAt=0;

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const practiceLabel=v=>({vocabulary:'Vocabulary',vocab_test:'Vocabulary Test',communication:'Communication',grammar:'Grammar',reading:'Reading',constructed_response:'서술형'}[v]||String(v||''));

async function contentRows(path){const r=await fetch(`${CONTENT_URL}/rest/v1/${path}`,{headers:{apikey:CONTENT_KEY,Authorization:`Bearer ${CONTENT_KEY}`},cache:'no-store'});if(!r.ok)throw new Error(`Curriculum DB ${r.status}`);return r.json()}
async function loadExternalCatalog(force=false){
  if(!force&&externalCatalog.length&&Date.now()-externalLoadedAt<30000)return externalCatalog;
  if(externalLoadPromise)return externalLoadPromise;
  externalLoadPromise=contentRows('test_prep_external_unit_catalog_v1?select=book_id,book_key,book_label,unit_id,unit_key,unit_label,unit_number,unit_type,status,school_grade,school,semester,exam_type,exam_year,external_passage_number,sections,has_vocabulary,has_passage,content_revision&status=eq.published&order=external_passage_number.asc,unit_label.asc')
    .then(rows=>{externalCatalog=Array.isArray(rows)?rows:[];externalLoadedAt=Date.now();return externalCatalog})
    .catch(e=>{console.warn('[naesin external catalog]',e);externalCatalog=[];return externalCatalog})
    .finally(()=>{externalLoadPromise=null});
  return externalLoadPromise;
}
function normalizeSchool(v){return String(v||'').toLowerCase().replace(/\s+/g,'').replace(/학교/g,'')}
function sameSchool(a,b){const x=normalizeSchool(a),y=normalizeSchool(b);return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x))}
function selectedGrade(){const text=$('#naBook option:checked')?.textContent||'';const m=text.match(/중\s*([123])/);if(m)return Number(m[1]);const picked=$$('#naStudentPick input:checked').map(i=>i.closest('label')?.textContent||'').join(' '),m2=picked.match(/중\s*([123])/);return m2?Number(m2[1]):null}
function selectedExamYear(){const d=String($('#naDate')?.value||'');const y=Number(d.slice(0,4));return Number.isFinite(y)&&y>2000?y:new Date().getFullYear()}
function selectedTerm(){return Number($('#naTerm .na-choice.on')?.dataset.v)||null}
function selectedExamType(){return String($('#naType .na-choice.on')?.dataset.v||'')||null}
function currentExternalScope(){return groupScopes.get(String(editingGroupId||''))?.external_passages||[]}
function matchingExternalUnits(){
  const school=$('#naSchool')?.value||'',grade=selectedGrade(),term=selectedTerm(),examType=selectedExamType(),year=selectedExamYear();
  const savedIds=new Set(currentExternalScope().map(x=>String(x?.unit_id||'')).filter(Boolean));
  return externalCatalog.filter(x=>{
    if(savedIds.has(String(x.unit_id)))return true;
    if(String(x.status)!=='published')return false;
    if(x.school&&!sameSchool(school,x.school))return false;
    if(grade&&x.school_grade&&Number(x.school_grade)!==grade)return false;
    if(term&&x.semester&&Number(x.semester)!==term)return false;
    if(examType&&x.exam_type&&String(x.exam_type)!==examType)return false;
    if(year&&x.exam_year&&Number(x.exam_year)!==year)return false;
    return !!school;
  }).sort((a,b)=>(Number(a.external_passage_number)||999)-(Number(b.external_passage_number)||999)||String(a.unit_label).localeCompare(String(b.unit_label),'ko'));
}
function renderExternalScope(){
  const scope=$('#naScope');if(!scope)return;
  $$('.na-external-heading,.na-scope[data-unit-type="external_passage"]',scope).forEach(x=>x.remove());
  const units=matchingExternalUnits();if(!units.length)return;
  const savedMap=new Map(currentExternalScope().map(x=>[String(x.unit_id||''),new Set((x.sections||[]).map(String))]));
  const heading=document.createElement('div');heading.className='na-external-heading';heading.style.cssText='grid-column:1/-1;margin:10px 2px 0;padding-top:12px;border-top:2px solid #e7eef0;color:#343343;font-size:.78rem;font-weight:800';heading.innerHTML='외부지문 <small style="display:block;margin-top:3px;color:#8a929b;font-size:.61rem;font-weight:700">이 학교·학년·학기·시험에 맞는 published 외부지문이 자동으로 표시됩니다.</small>';scope.appendChild(heading);
  for(const u of units){
    const sections=Array.isArray(u.sections)?u.sections:[];
    const chosen=savedMap.get(String(u.unit_id))||new Set();
    const row=document.createElement('div');row.className='na-scope wizard-selected';row.dataset.lesson=String(u.unit_label||'외부지문');row.dataset.unit=String(u.unit_id);row.dataset.unitType='external_passage';
    row.innerHTML=`<div class="na-scope-head"><span>${esc(u.unit_label||'외부지문')}</span><small>외부지문 · ${sections.length?'영역 선택':'문제 없음'}</small></div><div class="na-scope-body">${sections.map(s=>`<button type="button" class="na-scope-chip ${chosen.has(s)?'on':''}" data-section="${esc(s)}">${esc(practiceLabel(s))}</button>`).join('')}</div>`;
    const head=$('.na-scope-head',row);head.onclick=()=>{const chips=$$('.na-scope-chip',row);if(!chips.length)return;const all=chips.every(x=>x.classList.contains('on'));chips.forEach(x=>x.classList.toggle('on',!all));syncCountState()};
    $$('.na-scope-chip',row).forEach(c=>c.onclick=e=>{e.stopPropagation();c.classList.toggle('on');syncCountState()});
    scope.appendChild(row);
  }
}
async function refreshExternalScope(force=false){await loadExternalCatalog(force);renderExternalScope()}

function addChip(row,section,label,defaultOn=false){if(!row||$(`.na-scope-chip[data-section="${section}"]`,row))return;const body=$('.na-scope-body',row);if(!body)return;const b=document.createElement('button');b.type='button';b.className='na-scope-chip'+(defaultOn?' on':'');b.dataset.section=section;b.textContent=label;b.onclick=e=>{e.stopPropagation();b.classList.toggle('on');syncCountState()};body.appendChild(b)}
function addCountControl(){const step=$('.na-wizard-step[data-step="3"]');if(!step||$('#naSeosulMockBox'))return;const box=document.createElement('div');box.id='naSeosulMockBox';box.style.cssText='margin-top:14px;padding:14px 15px;border:1.5px solid #dce4e7;border-radius:14px;background:#f8fafb';box.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:14px"><div><b style="display:block;font-size:.82rem;color:#343343">모의고사 서술형 문항 수</b><small style="display:block;margin-top:3px;color:#858d96;font-size:.62rem">학교에서 서술형 문항 수를 알려 준 경우 설정하세요. 0이면 모의고사에는 넣지 않습니다.</small></div><input id="naSeosulMockCount" type="number" min="0" max="10" step="1" value="0" style="width:72px;border:1.5px solid #d7e0e3;border-radius:10px;padding:9px;text-align:center;font-weight:800;background:#fff"></div>';step.appendChild(box);$('#naSeosulMockCount').addEventListener('input',()=>{let n=Math.max(0,Math.min(10,Number($('#naSeosulMockCount').value)||0));$('#naSeosulMockCount').value=String(n);if(n>0)$$('#naScope .na-scope.wizard-selected:not([data-unit-type="external_passage"]) .na-scope-chip[data-section="constructed_response"]').forEach(x=>x.classList.add('on'))});loadCountForEditor();syncCountState()}
function syncCountState(){const box=$('#naSeosulMockBox'),input=$('#naSeosulMockCount');if(!box||!input)return;const any=$$('#naScope .na-scope:not([data-unit-type="external_passage"]) .na-scope-chip[data-section="constructed_response"].on').length>0;box.style.opacity=any?'1':'.7';input.disabled=!any;if(!any)input.value='0'}
function decorate(){const bg=$('#naFreshEditBg');if(!bg)return;$$('#naScope .na-scope:not([data-unit-type="external_passage"])').forEach(row=>{if(!$$('.na-scope-chip',row).length)return;addChip(row,'vocabulary','Vocabulary',true);addChip(row,'constructed_response','서술형',false)});const practice=$('#naTaskPractice');if(practice&&!practice.querySelector('option[value="constructed_response"]')){const o=document.createElement('option');o.value='constructed_response';o.textContent='서술형';practice.appendChild(o)};addCountControl();const open=bg.classList.contains('open');if(open&&!wasOpen){bg.dataset.seosulDefaulted='0';setTimeout(loadCountForEditor,20);setTimeout(()=>refreshExternalScope(true),30)}wasOpen=open}
function defaultSeosulOffOnce(){const bg=$('#naFreshEditBg');if(!bg||bg.dataset.seosulDefaulted==='1')return;if(!(($('#naEditTitle')?.textContent||'').includes('새 시험')))return;if(!$('.na-wizard-step[data-step="3"].active',bg))return;$$('#naScope .na-scope-chip[data-section="constructed_response"].on').forEach(x=>x.classList.remove('on'));bg.dataset.seosulDefaulted='1';const input=$('#naSeosulMockCount');if(input)input.value='0';syncCountState()}
function loadCountForEditor(){const input=$('#naSeosulMockCount');if(!input)return;const fresh=($('#naEditTitle')?.textContent||'').includes('새 시험');if(fresh){if($('#naFreshEditBg')?.dataset.seosulDefaulted!=='1')input.value='0';return}const scope=groupScopes.get(String(editingGroupId||''));if(scope)input.value=String(Math.max(0,Math.min(10,Number(scope.constructed_response_count)||0)));syncCountState()}
function rememberGroups(data){for(const item of data?.groups||[]){const g=item?.group||item;if(g?.id)groupScopes.set(String(g.id),g.scope||{})}}
function patchFetch(){if(fetchPatched)return;fetchPatched=true;const original=window.fetch.bind(window);window.fetch=async function(input,init={}){const url=typeof input==='string'?input:input?.url||'';let nextInit=init;if(url.startsWith(GROUP_API)&&init?.body&&String(init.method||'GET').toUpperCase()==='POST'){try{const u=new URL(url),action=u.searchParams.get('action');if(action==='create_group'||action==='update_group'){const body=JSON.parse(init.body);body.scope=body.scope&&typeof body.scope==='object'?body.scope:{};const extRows=$$('#naScope .na-scope[data-unit-type="external_passage"]');const extIds=new Set(extRows.map(r=>String(r.dataset.unit||'')));const rawLessons=Array.isArray(body.scope.lessons)?body.scope.lessons:[];body.scope.lessons=rawLessons.filter(x=>!extIds.has(String(x?.unit_id||'')));body.scope.external_passages=extRows.map(r=>({unit_id:String(r.dataset.unit||''),label:String(r.dataset.lesson||''),sections:$$('.na-scope-chip.on',r).map(c=>String(c.dataset.section||'')).filter(Boolean)})).filter(x=>x.unit_id&&x.sections.length);body.scope.scope_controls_v2=true;body.scope.constructed_response_count=Math.max(0,Math.min(10,Number($('#naSeosulMockCount')?.value)||0));nextInit={...init,body:JSON.stringify(body)}}}catch(_){}}const r=await original(input,nextInit);if(url.startsWith(GROUP_API)){try{const clone=r.clone(),data=await clone.json();rememberGroups(data)}catch(_){}}return r}}
function boot(){patchFetch();loadExternalCatalog(true);decorate();new MutationObserver(()=>{decorate();syncCountState()}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});document.addEventListener('click',e=>{const el=e.target instanceof Element?e.target:null;const edit=el?.closest('[data-edit]');if(edit){editingGroupId=edit.dataset.edit;setTimeout(()=>{loadCountForEditor();refreshExternalScope(true)},80)}if(el?.closest('#naFreshCreate')){editingGroupId=null;setTimeout(()=>{loadCountForEditor();refreshExternalScope(true)},80)}if(el?.closest('#naWizardNext'))setTimeout(()=>{decorate();defaultSeosulOffOnce();refreshExternalScope(false);syncCountState()},0);if(el?.closest('#naTerm .na-choice,#naType .na-choice'))setTimeout(()=>refreshExternalScope(false),0)},true);document.addEventListener('change',e=>{const el=e.target;if(!(el instanceof Element))return;if(el.matches('#naBook,#naDate'))setTimeout(()=>refreshExternalScope(false),0)},true);document.addEventListener('blur',e=>{const el=e.target;if(el instanceof Element&&el.matches('#naSchool'))setTimeout(()=>refreshExternalScope(false),0)},true)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();