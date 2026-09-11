import {QuestionRenderer} from './question-renderer.js?v=2.20.6';
import {gradeQuestion} from '../shared/question-grader.js?v=2.1.2';
import {setTrackingContext,startSession,recordAttempt,completeSession} from './tracking-client.js?v=2.17a';
import {loadPerformanceAssessment,loadPerformanceProgress,savePerformanceProgress} from './performance-source.js?v=1.0.0';

const STAGES=[
  {key:'learn',label:'익히기',form:'learn'},
  {key:'blank',label:'빈칸',form:'blanks'},
  {key:'chunks',label:'청크 배열',form:'chunks'},
  {key:'order',label:'실전 배열',form:'order'},
  {key:'write',label:'직접쓰기',form:'write'},
  {key:'final',label:'완벽암기',form:'write'}
];

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[c]));
const shuffle=list=>{const a=[...(list||[])];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const words=text=>String(text||'').trim().split(/\s+/).filter(Boolean);
const hasContraction=text=>/[A-Za-z]+['’][A-Za-z]+/.test(String(text||''));

let active=null;

function stateFor(item){return active?.progress.get(String(item.id))||{stage:0,mastered:false}}
function stageFor(item){const p=stateFor(item);return p.mastered?5:Math.max(0,Math.min(5,Number(p.stage)||0))}
function masteredCount(){return active.data.items.filter(item=>stateFor(item).mastered).length}
function stageLabel(item){const p=stateFor(item);return p.mastered?'✓ 암기완료':STAGES[stageFor(item)].label}
function setBottom(html=''){if(!active?.bottom)return;active.bottom.innerHTML=html;active.bottom.hidden=!html}
function shellTitle(){return active.assignment.title||active.data.set.title||'수행평가'}

function makeQuestion(item,stageIndex){
  const stage=STAGES[stageIndex],target=String(item.target_en||'').trim(),chunks=Array.isArray(item.chunks)&&item.chunks.length?item.chunks.filter(Boolean):words(target),contraction=hasContraction(target);
  const base={
    id:`performance:${item.id}:${stage.key}`,
    masteryKey:`performance:${item.id}`,
    skill:'performance',
    form:stage.form,
    prompt:stageIndex===5?'우리말을 보고 영어 문장을 완벽하게 쓰세요.':stageIndex===4?'우리말을 보고 영어 문장을 직접 쓰세요.':'다음 문장을 연습하세요.',
    context:{korean:item.prompt_ko||'',target_en:target},
    choices:[],chips:[],answer:[target],input:{language:'en'},
    grading:{constraints:{contractionRequired:contraction,noContractions:!contraction}},
    tracking:{practiceType:'performance',questionId:`performance:${item.id}:${stage.key}`,questionType:`performance_${stage.key}`,targets:['performance_assessment','sentence_memorization']},
    metadata:{grading_policy_override:'exact',assessment_id:active.data.set.id,assignment_id:active.assignment.id,performance_item_id:item.id,item_number:item.item_number,performance_stage:stage.key}
  };
  if(stage.form==='learn')return base;
  if(stage.form==='blanks'){
    const missing=chunks[Math.max(0,(Number(item.item_number)||1)-1)%chunks.length]||target;
    const masked=target.includes(missing)?target.replace(missing,'_____'):'_____';
    return{...base,context:{...base.context,masked},chips:shuffle(chunks),answer:[missing]};
  }
  if(stage.form==='chunks')return{...base,chips:shuffle(chunks),answer:[target]};
  if(stage.form==='order')return{...base,chips:shuffle(words(target)),answer:[target]};
  return base;
}

async function persist(item,{stage,mastered=false,lastCorrect=null}){
  const row=await savePerformanceProgress({studentId:active.studentId,assignmentId:active.assignment.id,itemId:item.id,stage,mastered,lastCorrect});
  active.progress.set(String(item.id),row);
  return row;
}

function renderOverview(){
  if(!active)return;
  setBottom('');
  const {host,data}=active,done=masteredCount(),total=data.items.length;
  host.innerHTML=`<div class="pa-shell"><button class="back" data-pa-exit>← 시험 범위</button><div class="pa-hero"><div><span class="pa-kicker">수행평가</span><h2>${esc(shellTitle())}</h2><p>${esc(active.assignment.unit_key||'')} · ${done}/${total} 문장 완벽암기</p></div><div class="pa-progress-ring"><b>${total?Math.round(done/total*100):0}%</b><small>완료</small></div></div><div class="pa-overall"><i style="width:${total?Math.round(done/total*100):0}%"></i></div><div class="pa-items">${data.items.map(item=>{const p=stateFor(item);return `<button class="pa-item ${p.mastered?'done':''}" data-pa-item="${esc(item.id)}"><span class="pa-num">${item.item_number}</span><span class="pa-copy"><b>${esc(item.prompt_ko||`문장 ${item.item_number}`)}</b><small>${esc(stageLabel(item))}</small></span><span class="pa-go">→</span></button>`}).join('')}</div></div>`;
  host.querySelector('[data-pa-exit]').onclick=()=>active?.onExit?.();
  host.querySelectorAll('[data-pa-item]').forEach(btn=>btn.onclick=()=>renderItem(btn.dataset.paItem));
}

function renderItem(itemId,forcedStage=null){
  if(!active)return;
  const item=active.data.items.find(x=>String(x.id)===String(itemId));if(!item)return;
  const stageIndex=forcedStage==null?stageFor(item):Math.max(0,Math.min(5,Number(forcedStage)||0));
  const stage=STAGES[stageIndex],q=makeQuestion(item,stageIndex),host=active.host;
  active.current={item,stageIndex,question:q,startedAt:Date.now(),renderer:null,checked:false};
  host.innerHTML=`<div class="pa-shell"><button class="back" data-pa-back>← 수행평가</button><div class="pa-question-head"><div><span class="pa-kicker">문장 ${item.item_number}</span><h2>${esc(stage.label)}</h2></div><strong>${stageIndex+1} / ${STAGES.length}</strong></div><div class="pa-stagebar">${STAGES.map((s,i)=>`<span class="${i<stageIndex?'done':''} ${i===stageIndex?'on':''}">${esc(s.label)}</span>`).join('')}</div><div class="card pa-question-card"><div id="paRenderer"></div></div></div>`;
  host.querySelector('[data-pa-back]').onclick=renderOverview;
  const renderer=new QuestionRenderer(host.querySelector('#paRenderer')).render(q);
  active.current.renderer=renderer;
  if(stage.form==='learn'){
    setBottom('<button class="primary" id="paLearnNext">다음 단계 →</button>');
    active.bottom.querySelector('#paLearnNext').onclick=async()=>{
      const next=Math.min(5,stageIndex+1);await persist(item,{stage:next,mastered:false,lastCorrect:null});renderItem(item.id,next);
    };
    return;
  }
  setBottom('<button class="secondary" id="paSkipBack">목록</button><button class="primary" id="paCheck">확인</button>');
  active.bottom.querySelector('#paSkipBack').onclick=renderOverview;
  active.bottom.querySelector('#paCheck').onclick=()=>checkCurrent();
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
  await recordAttempt({question:cur.question,response,result:timed,practiceType:'performance',metadata:{assignment_id:active.assignment.id,assessment_id:active.data.set.id,performance_item_id:cur.item.id,performance_stage:STAGES[cur.stageIndex].key}});
  active.total++;
  if(result.correct)active.correct++;
  if(result.correct){
    const final=cur.stageIndex===STAGES.length-1,next=Math.min(5,cur.stageIndex+1);
    await persist(cur.item,{stage:next,mastered:final,lastCorrect:true});
    setBottom(`<button class="primary" id="paContinue">${final?'문장 목록으로 →':'다음 단계 →'}</button>`);
    active.bottom.querySelector('#paContinue').onclick=()=>final?renderOverview():renderItem(cur.item.id,next);
  }else{
    await persist(cur.item,{stage:cur.stageIndex,mastered:false,lastCorrect:false});
    setBottom('<button class="secondary" id="paOverview">목록</button><button class="primary" id="paRetry">다시 해보기</button>');
    active.bottom.querySelector('#paOverview').onclick=renderOverview;
    active.bottom.querySelector('#paRetry').onclick=()=>renderItem(cur.item.id,cur.stageIndex);
  }
}

export async function startPerformanceLearning({host,bottom,plan,assignment,studentId,onExit}){
  if(!host||!assignment||!studentId)throw new Error('수행평가를 시작할 수 없습니다.');
  await stopPerformanceLearning({silent:true});
  host.innerHTML='<div class="loading">수행평가를 준비하는 중...</div>';
  const [data,progress]=await Promise.all([loadPerformanceAssessment(assignment),loadPerformanceProgress(assignment.id)]);
  active={host,bottom,plan,assignment,studentId,onExit,data,progress,current:null,correct:0,total:0};
  setTrackingContext(plan,assignment.unit_key||data.set.title||'수행평가');
  await startSession('performance');
  renderOverview();
}

export async function stopPerformanceLearning({silent=false}={}){
  if(!active)return;
  const closing=active;active=null;
  try{await completeSession({correct:closing.correct,total:closing.total,wrongIds:[]})}catch(e){if(!silent)console.warn('[performance] session close failed',e)}
  if(closing.bottom){closing.bottom.innerHTML='';closing.bottom.hidden=true}
}

export function performanceLearningActive(){return!!active}
