import {QuestionRenderer} from './question-renderer.js?v=2.20.6';
import {gradeQuestion} from '../shared/question-grader.js?v=2.1.2';
import {setTrackingContext,startSession,recordAttempt,completeSession} from './tracking-client.js?v=2.17a';
import {navigate,replaceRoute,back,currentRoute} from './navigation.js?v=2.21.2';
import {loadPerformanceAssessment,loadPerformanceProgress,savePerformanceProgress} from './performance-source.js?v=1.0.0';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const shuffle=list=>{const a=[...(list||[])];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const words=text=>String(text||'').trim().split(/\s+/).filter(Boolean);
const hasContraction=text=>/[A-Za-z]+['’][A-Za-z]+/.test(String(text||''));
const top=()=>window.scrollTo({top:0,left:0,behavior:'auto'});

let active=null;

function progressFor(item){return active?.progress.get(String(item.id))||{stage:0,mastered:false}}
function levelFor(item){const p=progressFor(item);return Math.max(Number(p.stage)||0,p.mastered?1:0)}
function arrangedCount(){return active.data.items.filter(item=>levelFor(item)>=1).length}
function writtenCount(){return active.data.items.filter(item=>levelFor(item)>=2).length}
function setBottom(html=''){if(!active?.bottom)return;active.bottom.innerHTML=html;active.bottom.hidden=!html}
function title(){return active.assignment.title||active.data.set.title||'수행평가'}
function baseRoute(){return{view:'performance',planId:active.plan.id,assignmentId:active.assignment.id}}
function itemRoute(item,mode){return{...baseRoute(),performanceMode:mode,performanceItemId:item.id}}

function makeQuestion(item,mode){
  const target=String(item.target_en||'').trim(),contraction=hasContraction(target);
  const base={
    id:`performance:${item.id}:${mode}`,
    masteryKey:`performance:${item.id}`,
    skill:'performance',
    prompt:mode==='write'?'우리말을 보고 영어 문장을 쓰세요.':'단어를 올바른 순서로 배열하세요.',
    context:{korean:item.prompt_ko||''},
    choices:[],chips:[],answer:[target],input:{language:'en'},
    grading:{constraints:{contractionRequired:contraction,noContractions:!contraction}},
    tracking:{practiceType:'performance',questionId:`performance:${item.id}:${mode}`,questionType:`performance_${mode}`,targets:['performance_assessment']},
    metadata:{grading_policy_override:'exact',assessment_id:active.data.set.id,assignment_id:active.assignment.id,performance_item_id:item.id,item_number:item.item_number,performance_mode:mode}
  };
  if(mode==='write')return{...base,form:'write'};
  return{...base,form:'order',chips:shuffle(words(target))};
}

async function persist(item,newLevel,lastCorrect){
  const previous=levelFor(item),level=Math.max(previous,newLevel);
  const row=await savePerformanceProgress({studentId:active.studentId,assignmentId:active.assignment.id,itemId:item.id,stage:level,mastered:level>=1,lastCorrect});
  active.progress.set(String(item.id),row);
  return row;
}

function startWhole(mode){
  if(!active?.data?.items?.length)return;
  active.run={mode,index:0};
  navigate(itemRoute(active.data.items[0],mode));
}

function sentenceListHtml(data){
  return `<div class="pa-items">${data.items.map(item=>{const level=levelFor(item);return `<div class="pa-item ${level>=1?'done':''}"><span class="pa-num">${item.item_number}</span><span class="pa-copy"><b>${esc(item.prompt_ko||`문장 ${item.item_number}`)}</b><small>${level>=2?'✓ 배열 · 쓰기 완료':level>=1?'✓ 배열 완료':'연습 전'}</small></span><span class="pa-actions"><button type="button" data-pa-mode="order" data-pa-item="${esc(item.id)}">배열</button><button type="button" class="secondary" data-pa-mode="write" data-pa-item="${esc(item.id)}">쓰기 <em>선택</em></button></span></div>`}).join('')}</div>`;
}

function renderOverview(){
  if(!active)return;
  active.run=null;active.current=null;active.listOpen=false;
  setBottom('');
  const {host,data}=active,total=data.items.length,arranged=arrangedCount(),written=writtenCount();
  host.innerHTML=`<div class="pa-shell"><button class="back" data-pa-exit>← 시험 범위</button><div class="pa-heading"><span class="pa-kicker">수행평가</span><h2>${esc(title())}</h2><p>${esc(active.assignment.unit_key||'')} · 배열 ${arranged}/${total}${written?` · 쓰기 ${written}/${total}`:''}</p></div><div class="pa-master-actions"><button type="button" class="pa-master pa-master-order" data-pa-master="order"><span>전체 배열 시작</span><small>1번 문장부터 처음부터</small></button><button type="button" class="pa-master pa-master-write" data-pa-master="write"><span>전체 쓰기 시작</span><small>선택 · 1번 문장부터</small></button></div><button class="pa-list-toggle" type="button" aria-expanded="false" data-pa-toggle><span>문장 목록</span><span class="pa-chevron">⌄</span></button><div class="pa-list-wrap" data-pa-list hidden>${sentenceListHtml(data)}</div></div>`;
  host.querySelector('[data-pa-exit]').onclick=()=>active?.onExit?.();
  host.querySelectorAll('[data-pa-master]').forEach(btn=>btn.onclick=()=>startWhole(btn.dataset.paMaster));
  const toggle=host.querySelector('[data-pa-toggle]'),list=host.querySelector('[data-pa-list]');
  toggle.onclick=()=>{active.listOpen=!active.listOpen;toggle.setAttribute('aria-expanded',String(active.listOpen));list.hidden=!active.listOpen;toggle.querySelector('.pa-chevron').textContent=active.listOpen?'⌃':'⌄'};
  host.querySelectorAll('[data-pa-mode]').forEach(btn=>btn.onclick=()=>{active.run=null;const item=active.data.items.find(x=>String(x.id)===String(btn.dataset.paItem));if(item)navigate(itemRoute(item,btn.dataset.paMode))});
  top();
}

function itemIndex(item){return active.data.items.findIndex(x=>String(x.id)===String(item.id))}
function nextItem(item){const i=itemIndex(item);return i>=0?active.data.items[i+1]||null:null}

function renderItem(itemId,mode='order'){
  if(!active)return;
  const item=active.data.items.find(x=>String(x.id)===String(itemId));if(!item){replaceRoute(baseRoute());return}
  const q=makeQuestion(item,mode),host=active.host,index=itemIndex(item),whole=active.run?.mode===mode;
  if(whole)active.run.index=index;
  active.current={item,mode,question:q,startedAt:Date.now(),renderer:null,checked:false};
  host.innerHTML=`<div class="pa-shell ${mode==='write'?'pa-shell-write':''}"><button class="back" data-pa-back>← 수행평가</button><div class="pa-question-head"><div><span class="pa-kicker">${whole?`${index+1} / ${active.data.items.length}`:`문장 ${item.item_number}`}</span><h2>${mode==='write'?'문장 쓰기':'문장 배열'}</h2></div><strong>${mode==='write'?'선택 연습':'기본 연습'}</strong></div><div class="card pa-question-card"><div id="paRenderer"></div></div></div>`;
  host.querySelector('[data-pa-back]').onclick=back;
  active.current.renderer=new QuestionRenderer(host.querySelector('#paRenderer')).render(q);
  setBottom('<button class="secondary" id="paList">목록</button><button class="primary" id="paCheck">확인</button>');
  active.bottom.querySelector('#paList').onclick=back;
  active.bottom.querySelector('#paCheck').onclick=checkCurrent;
  top();
}

async function checkCurrent(){
  const cur=active?.current;if(!cur||cur.checked)return;
  const response=cur.renderer.getResponse();
  const empty=Array.isArray(response)?response.length===0||response.every(x=>!String(x||'').trim()):!String(response||'').trim();
  if(empty)return;
  cur.checked=true;cur.renderer.setDisabled(true);
  const result=await gradeQuestion(cur.question,response);
  cur.renderer.showFeedback(result);
  const timed={...result,responseTimeMs:Math.max(0,Date.now()-cur.startedAt)};
  await recordAttempt({question:cur.question,response,result:timed,practiceType:'performance',metadata:{assignment_id:active.assignment.id,assessment_id:active.data.set.id,performance_item_id:cur.item.id,performance_mode:cur.mode}});
  active.total++;
  if(result.correct)active.correct++;
  if(result.correct){
    await persist(cur.item,cur.mode==='write'?2:1,true);
    const next=nextItem(cur.item),whole=active.run?.mode===cur.mode;
    setBottom(`<button class="secondary" id="paOverview">목록</button>${next?`<button class="primary" id="paNext">다음 문장 →</button>`:'<button class="primary" id="paNext">완료 →</button>'}`);
    active.bottom.querySelector('#paOverview').onclick=back;
    active.bottom.querySelector('#paNext').onclick=()=>{
      if(next){if(whole)replaceRoute(itemRoute(next,cur.mode));else navigate(itemRoute(next,cur.mode))}
      else back();
    };
    if(!whole)active.run=null;
  }else{
    await persist(cur.item,levelFor(cur.item),false);
    setBottom('<button class="secondary" id="paOverview">목록</button><button class="primary" id="paRetry">다시 해보기</button>');
    active.bottom.querySelector('#paOverview').onclick=back;
    active.bottom.querySelector('#paRetry').onclick=()=>renderItem(cur.item.id,cur.mode);
  }
}

function renderFromRoute(){
  const route=currentRoute();
  if(route.view!=='performance'||String(route.assignmentId)!==String(active.assignment.id))return;
  if(route.performanceMode&&route.performanceItemId)renderItem(route.performanceItemId,route.performanceMode);else renderOverview();
}

export async function startPerformanceLearning({host,bottom,plan,assignment,studentId,onExit}){
  if(!host||!assignment||!studentId)throw new Error('수행평가를 시작할 수 없습니다.');
  if(active&&String(active.assignment?.id)===String(assignment.id)){
    active.host=host;active.bottom=bottom;active.onExit=onExit;active.plan=plan;
    renderFromRoute();return;
  }
  await stopPerformanceLearning({silent:true});
  host.innerHTML='<div class="loading">수행평가를 준비하는 중...</div>';
  const [data,progress]=await Promise.all([loadPerformanceAssessment(assignment),loadPerformanceProgress(assignment.id)]);
  active={host,bottom,plan,assignment,studentId,onExit,data,progress,current:null,run:null,listOpen:false,correct:0,total:0};
  setTrackingContext(plan,assignment.unit_key||data.set.title||'수행평가');
  await startSession('performance');
  renderFromRoute();
}

export async function stopPerformanceLearning({silent=false}={}){
  if(!active)return;
  const closing=active;active=null;
  try{await completeSession({correct:closing.correct,total:closing.total,wrongIds:[]})}catch(e){if(!silent)console.warn('[performance] session close failed',e)}
  if(closing.bottom){closing.bottom.innerHTML='';closing.bottom.hidden=true}
}

export function performanceLearningActive(){return!!active}
