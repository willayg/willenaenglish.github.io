import {resolveContentIds,loadStoredSkill,loadStoredWritten,shuffle} from '../test-prep-v2/content-source.js';

const BLUEPRINT={vocabulary:4,communication:5,grammar:6,reading:6,constructed_response:4};
const STORAGE_KEY='willena-real-mock-v2-manifest';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=v=>String(v||'').trim().toLowerCase();

function revBadge(){if(document.getElementById('tp-rev52a-badge'))return;const b=document.createElement('div');b.id='tp-rev52a-badge';b.textContent='REV 52a';b.style.cssText='position:fixed;right:10px;bottom:10px;z-index:2147483647;padding:4px 8px;border-radius:999px;background:#203039;color:#fff;font:800 10px/1.2 Poppins,sans-serif;letter-spacing:.04em;opacity:.82;pointer-events:none';document.body.appendChild(b)}
function plans(){return window.WillenaTestPrepAuth?.state?.plans||[]}
function planById(id){return plans().find(p=>String(p.id)===String(id))||null}
function scopeFor(plan){const rows=plan?.group?.scope?.lessons;return Array.isArray(rows)?rows.filter(x=>x?.lesson):[]}
function sectionAllowed(plan,row,section){
  const raw=(row?.sections||[]).map(norm),strict=plan?.group?.scope?.scope_controls_v2===true;
  if(!strict)return section==='vocabulary'||raw.includes(section)||section==='constructed_response';
  if(section==='vocabulary')return raw.includes('vocabulary')||raw.includes('vocab_test');
  return raw.includes(section);
}
function signature(q){return [q?.__lesson||'',q?.source?.code||'O',q?.tracking?.questionType||'other',q?.form||'other'].join('|')}
function idOf(q){return String(q?.id||q?.masteryKey||'')}
function decorate(q,lesson,unitId,section){return {...q,__lesson:String(lesson),__unitId:String(unitId),__realMockSection:section}}

function diversePick(rows,count){
  const unique=[],seen=new Set();
  for(const q of shuffle(rows||[])){const id=idOf(q);if(!id||seen.has(id))continue;seen.add(id);unique.push(q)}
  const out=[],used=new Set();
  const byLesson=new Map();
  for(const q of unique){const k=String(q.__lesson||'');if(!byLesson.has(k))byLesson.set(k,[]);byLesson.get(k).push(q)}
  const lessonKeys=shuffle([...byLesson.keys()]);
  for(const lesson of lessonKeys){if(out.length>=count)break;const pool=byLesson.get(lesson)||[];if(!pool.length)continue;const q=pool.shift();out.push(q);used.add(idOf(q))}
  const buckets=new Map();
  for(const q of unique){if(used.has(idOf(q)))continue;const k=signature(q);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(q)}
  for(const [k,v] of buckets)buckets.set(k,shuffle(v));
  let keys=shuffle([...buckets.keys()]),moved=true;
  while(out.length<count&&moved){moved=false;for(const k of keys){const b=buckets.get(k);if(b?.length&&out.length<count){const q=b.shift();if(used.has(idOf(q)))continue;used.add(idOf(q));out.push(q);moved=true}}}
  return out;
}

async function buildPool(plan){
  const pools={vocabulary:[],communication:[],grammar:[],reading:[],constructed_response:[]};
  const resolved=[];
  for(const row of scopeFor(plan)){
    const lesson=String(row.lesson),ids=await resolveContentIds(plan,lesson);resolved.push({lesson,unitId:String(ids.unitId)});
    if(sectionAllowed(plan,row,'vocabulary')){
      const [vocab,vocabTest]=await Promise.all([loadStoredSkill(ids.unitId,'vocabulary'),loadStoredSkill(ids.unitId,'vocab_test').catch(()=>[])]);
      pools.vocabulary.push(...vocab.map(q=>decorate(q,lesson,ids.unitId,'vocabulary')),...vocabTest.map(q=>decorate(q,lesson,ids.unitId,'vocabulary')));
    }
    for(const section of ['communication','grammar','reading'])if(sectionAllowed(plan,row,section)){
      const rows=await loadStoredSkill(ids.unitId,section);pools[section].push(...rows.map(q=>decorate(q,lesson,ids.unitId,section)));
    }
    if(sectionAllowed(plan,row,'constructed_response')){
      const rows=await loadStoredWritten(ids.unitId);pools.constructed_response.push(...rows.map(q=>decorate(q,lesson,ids.unitId,'constructed_response')));
    }
  }
  return {pools,resolved};
}

async function buildManifest(plan){
  const {pools,resolved}=await buildPool(plan),picked={},short=[];
  for(const [section,count] of Object.entries(BLUEPRINT)){
    picked[section]=diversePick(pools[section],count);
    if(picked[section].length<count)short.push(`${section}: ${picked[section].length}/${count}`);
  }
  if(short.length)throw new Error(`이 시험 범위에는 실전모의고사 구성을 만들 문제가 부족합니다.\n${short.join('\n')}`);
  const order=['vocabulary','communication','grammar','reading','constructed_response'];
  const questions=order.flatMap(section=>shuffle(picked[section]));
  return {
    id:`real-mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    version:'experiment-1',createdAt:new Date().toISOString(),planId:String(plan.id),bookLabel:plan.book_label||'',examName:plan.exam_name||'',blueprint:BLUEPRINT,resolved,
    questions
  };
}

function styles(){if($('#realMockV2Styles'))return;const s=document.createElement('style');s.id='realMockV2Styles';s.textContent=`
.tp-real-mock-v2{width:100%;box-sizing:border-box;display:flex;align-items:center;gap:14px;border:2px solid #07888d;background:#fff;border-radius:20px;padding:16px 18px;margin:10px 0 18px;cursor:pointer;text-align:left;box-shadow:0 7px 20px rgba(32,48,57,.10);font-family:Poppins,'Noto Sans KR',sans-serif;color:#203039}
.tp-real-mock-v2:hover{transform:translateY(-1px)}.tp-real-mock-v2:disabled{opacity:.55;cursor:wait;transform:none}.tp-real-mock-v2-icon{display:grid;place-items:center;flex:0 0 50px;width:50px;height:50px;border-radius:16px;background:#e8fafb;color:#07888d;font-weight:900;font-size:15px}.tp-real-mock-v2-copy{min-width:0;display:flex;flex-direction:column;gap:3px}.tp-real-mock-v2-copy b{font-size:16px}.tp-real-mock-v2-copy small{font-size:11px;color:#6b7e87;font-weight:600}.tp-real-mock-v2-go{margin-left:auto;font-size:11px;font-weight:900;color:#d54685}@media(max-width:560px){.tp-real-mock-v2{padding:14px}.tp-real-mock-v2-icon{width:44px;height:44px;flex-basis:44px}.tp-real-mock-v2-copy b{font-size:14px}.tp-real-mock-v2-go{display:none}}
`;document.head.appendChild(s)}
function button(planId){const b=document.createElement('button');b.type='button';b.className='tp-real-mock-v2';b.dataset.realMockPlan=planId;b.innerHTML=`<span class="tp-real-mock-v2-icon">25</span><span class="tp-real-mock-v2-copy"><b>실전모의고사</b><small>4 어휘 · 5 의사소통 · 6 문법 · 6 독해 · 4 서술형 · V2 renderer</small></span><span class="tp-real-mock-v2-go">EXPERIMENT →</span>`;return b}
async function launch(btn,planId){if(btn.disabled)return;const plan=planById(planId);if(!plan)return alert('시험 범위를 찾지 못했습니다.');btn.disabled=true;const go=$('.tp-real-mock-v2-go',btn),old=go?.textContent;if(go)go.textContent='BUILDING';try{const manifest=await buildManifest(plan);sessionStorage.setItem(STORAGE_KEY,JSON.stringify(manifest));location.href='./real-mock-v2.html'}catch(e){console.error('[real mock v2] build failed',e);alert(e?.message||'실전모의고사를 만들지 못했습니다.');btn.disabled=false;if(go)go.textContent=old||'EXPERIMENT →'}}
function inject(){styles();const home=$('#assignmentHome');if(!home)return;for(const current of $$('.tp-exam46-all',home)){if(current.nextElementSibling?.classList?.contains('tp-real-mock-v2'))continue;const section=current.closest('.tp-exam-section'),first=section?.querySelector('.tp-lesson-card[data-lesson-plan]'),planId=first?.dataset.lessonPlan;if(!planId||!planById(planId))continue;const b=button(planId);b.onclick=()=>launch(b,planId);current.insertAdjacentElement('afterend',b)}}
function boot(){revBadge();inject();const root=$('#assignmentHome')||document.body;new MutationObserver(()=>queueMicrotask(inject)).observe(root,{childList:true,subtree:true});window.addEventListener('testprep:student-state-refresh',()=>setTimeout(inject,0));window.addEventListener('popstate',()=>setTimeout(inject,0))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
console.log('[REV52a] REAL MOCK V2 EXPERIMENT staging-only launcher ready');
