(function(){
'use strict';

const KO={
  be_present:'be동사 현재형',
  simple_present:'일반동사 현재형',
  questions:'의문문',
  imperatives:'명령문',
  modal_can_will:'조동사 can / will',
  present_progressive:'현재진행형',
  simple_past:'과거시제',
  gerund:'동명사',
  be_going_to:'be going to 미래 표현',
  there_is_are:'There is / There are 구문',
  comparison:'비교 표현',
  to_infinitives:'to부정사',
  that_clauses:'that절',
  time_clauses:'시간 부사절',
  ditransitive_verbs:'수여동사 (4형식)',
  dummy_it:'비인칭·가주어 it',
  to_infinitive_object:'to부정사의 목적어 역할',
  sensory_linking_verbs:'감각동사 + 형용사',
  comparatives:'비교급',
  when_clause:'when절',
  that_clause:'that절',
  to_infinitive_nominal:'to부정사의 명사적 용법',
  reflexive_pronouns:'재귀대명사',
  should:'조동사 should',
  when_time_clause:'접속사 when의 시간 부사절',
  superlatives:'최상급',
  to_infinitive_purpose:'to부정사의 부사적 용법 (목적)',
  dummy_it_to_infinitive:'가주어 it + to부정사',
  comparative_correlative:'the 비교급, the 비교급',
  subject_verb_agreement:'주어와 동사의 수일치',
  perception_verbs:'지각동사',
  present_participle:'현재분사',
  as_as_comparison:'원급 비교 as ~ as',
  noun_modifier:'명사를 수식하는 표현',
  passive_voice:'수동태',
  have_to:'have to',
  infinitive_to:'to부정사',
  ask_to:'ask + 목적어 + to부정사',
  want_to:'want + to부정사',
  verb_to_infinitive:'동사 + to부정사',
  infinitive_usage:'to부정사의 쓰임',
  emphatic_reflexive:'재귀대명사의 강조 용법',
  reflexive_pronoun:'재귀대명사',
  himself:'재귀대명사 himself',
  herself:'재귀대명사 herself',
  yourself:'재귀대명사 yourself',
  yourselves:'재귀대명사 yourselves',
  ourselves:'재귀대명사 ourselves',
  themselves:'재귀대명사 themselves'
};

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number.isFinite(Number(v))?Number(v):0;
const human=v=>String(v||'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
const key=v=>String(v||'').trim().toLowerCase();
const lessonKey=v=>String(v||'').trim();

function grammarRows(){
  const d=window.NaesinV2StudentDetail?.getCurrentData?.()||{};
  const rows=d.grammar_patterns||d.stats?.grammar_patterns||[];
  return (Array.isArray(rows)?rows:[]).filter(r=>n(r.recent_count)>0||n(r.unique_count)>0||n(r.current_wrong)>0);
}

function wrongTargets(w){
  const out=[];
  const push=v=>{if(v==null)return;if(Array.isArray(v)){v.forEach(push);return}const s=String(v).trim();if(s&&!out.includes(s))out.push(s)};
  push(w?.targets);push(w?.target);push(w?.raw_targets);push(w?.metadata?.targets);
  return out;
}

function matchesRow(w,row){
  const kind=key(w?.practice_type||w?.section||w?.question_type||'');
  if(!(kind.includes('grammar')||wrongTargets(w).length))return false;
  if(lessonKey(w?.lesson||w?.unit_key||'')!==lessonKey(row?.lesson||''))return false;
  const rt=key(row?.target);
  return wrongTargets(w).some(t=>key(t)===rt);
}

function answer(v){
  if(v==null||v==='')return'—';
  if(Array.isArray(v))return v.map(answer).join(' / ');
  if(typeof v==='object')return answer(v.text??v.answer??v.value??v.word??v.response??JSON.stringify(v));
  return String(v);
}

function contextText(v){
  if(v==null||v==='')return'';
  if(typeof v==='string')return v;
  if(Array.isArray(v))return v.map(contextText).filter(Boolean).join(' / ');
  if(typeof v==='object'){
    const order=['korean','translation_ko','definition','definition_en','sentence','text','passage','dialogue','initial'];
    const parts=[];for(const k of order)if(v[k]!=null&&v[k]!=='')parts.push(contextText(v[k]));
    return parts.filter(Boolean).join(' / ');
  }
  return String(v);
}

function wrongCard(r){
  const ctx=contextText(r.context);
  const student=r.selected_display||answer(r.selected_answer??r.student_answer);
  const correct=r.correct_display||answer(r.correct_answer);
  return `<article class="na2-grammar-wrong na2-canonical-wrong"><div class="na2-exact-meta"><span>${esc(r.lesson||r.unit_key||'Lesson')}</span><span>문법</span>${n(r.wrong_count)>1?`<span class="repeat">${n(r.wrong_count)}회 오답</span>`:''}</div><p>${esc(r.prompt||'Recorded question')}</p>${ctx?`<div class="na2-exact-context">${esc(ctx)}</div>`:''}<div class="na2-answer-row"><div class="na2-answer-box"><small>학생 답</small><strong>${esc(student)}</strong></div><div class="na2-answer-box ok"><small>정답</small><strong>${esc(correct)}</strong></div></div></article>`;
}

function decorateRows(){
  const body=$('#na2DetailBody');
  if(!body||!body.querySelector('.na2-grammar-list'))return;
  const rows=grammarRows();
  $$('.na2-grammar-row',body).forEach((btn,i)=>{
    const r=rows[i];if(!r)return;
    btn.dataset.canonicalTarget=String(r.target||'');
    btn.dataset.canonicalLesson=String(r.lesson||'');
    const copy=$('.na2-grammar-copy',btn);if(!copy)return;
    const ko=KO[key(r.target)]||'기타 문법 패턴';
    copy.innerHTML=`<b class="na2-grammar-ko">${esc(ko)}</b><small class="na2-grammar-en">${esc(human(r.target))}</small><em class="na2-grammar-lesson">${esc(r.lesson||'')}</em>`;
  });
}

async function openCanonical(btn){
  const body=$('#na2DetailBody');if(!body)return;
  const i=Number(btn.dataset.grammarIndex);
  const rows=grammarRows(),row=rows[i];
  const panel=body.querySelector(`[data-grammar-expand="${i}"]`);
  if(!row||!panel)return;
  const wasHidden=panel.hidden;
  $$('.na2-grammar-expand',body).forEach(x=>x.hidden=true);
  $$('.na2-grammar-row',body).forEach(x=>x.classList.remove('open'));
  if(!wasHidden)return;
  panel.hidden=false;btn.classList.add('open');
  panel.innerHTML='<div class="na2-detail-loading">이 문법 패턴의 오답 문제를 불러오는 중…</div>';
  try{
    const ctx=window.NaesinV2StudentDetail?.getContext?.()||{};
    const data=await window.NaesinV2Data?.loadWrongDetail?.(ctx.studentId,ctx.planId)||{items:[]};
    const items=(Array.isArray(data.items)?data.items:[]).filter(w=>matchesRow(w,row));
    if(items.length){
      panel.innerHTML=`<div class="na2-canonical-expand-head"><b>${esc(KO[key(row.target)]||human(row.target))}</b><span>현재 오답 ${items.length}문항</span></div>${items.map(wrongCard).join('')}`;
    }else{
      panel.innerHTML=n(row.current_wrong)>0
        ?`<div class="na2-detail-error"><b>오답 ${n(row.current_wrong)}개가 집계되어 있지만 문제 상세를 연결하지 못했습니다.</b><span>이 행의 원본 태그 연결을 확인해야 합니다.</span></div>`
        :'<div class="na2-grammar-no-wrong">현재 남아 있는 오답이 없습니다.</div>';
    }
  }catch(e){
    panel.innerHTML=`<div class="na2-detail-error"><span>${esc(e?.message||'오답 문제를 불러오지 못했습니다.')}</span></div>`;
  }
}

function installClickOverride(){
  if(window.__na2CanonicalGrammarClick)return;
  window.__na2CanonicalGrammarClick=true;
  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.na2-grammar-row[data-grammar-index]');
    if(!btn||!btn.closest('#na2DetailBody'))return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    void openCanonical(btn);
  },true);
}

function installStyles(){
  if($('#na2CanonicalGrammarStyles'))return;
  const st=document.createElement('style');st.id='na2CanonicalGrammarStyles';st.textContent=`
    .na2-grammar-copy{display:flex!important;flex-direction:column!important;align-items:flex-start!important;min-width:220px}
    .na2-grammar-copy .na2-grammar-ko{font-size:1.05rem!important;line-height:1.2!important;font-weight:800!important;color:#24323b!important;letter-spacing:-.02em}
    .na2-grammar-copy .na2-grammar-en{font-size:.72rem!important;line-height:1.25!important;color:#5f7380!important;margin-top:4px!important;font-weight:650!important}
    .na2-grammar-copy .na2-grammar-lesson{font-style:normal!important;font-size:.62rem!important;color:#9aa6ad!important;margin-top:3px!important}
    .na2-grammar-row.open{background:#f2fbfc!important}
    .na2-canonical-expand-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 4px 12px;color:#52636d;font-size:.72rem}
    .na2-canonical-expand-head b{font-size:.84rem;color:#26363f}
    #burger-menu-mount #burger-menu-template-inserted{display:flex!important;align-items:center!important}
    #burger-menu-mount .burger-menu{display:flex!important;flex-direction:row!important;align-items:center!important;position:relative!important;top:auto!important;right:auto!important;box-shadow:none!important}
    @media(max-width:760px){.na2-grammar-copy{min-width:150px}.na2-grammar-copy .na2-grammar-ko{font-size:.94rem!important}}
  `;document.head.appendChild(st);
}

function observe(){
  const root=document.body;
  const mo=new MutationObserver(()=>decorateRows());
  mo.observe(root,{subtree:true,childList:true});
  decorateRows();
}

function boot(){installStyles();installClickOverride();observe()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
