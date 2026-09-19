import {currentRoute} from './navigation.js?v=2.21.3';
import {trackingState} from './tracking-client.js?v=2.17a';
import {resolveContentIds} from './content-source.js?v=2.24.4';
import {contentDbGet} from '../shared/content-db.js?v=1.0.0';
import {resolveGuideKeys} from './grammar-guide.js?v=2.1.1';

const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const cache=new Map();

function contextMarkup(context){
  if(!context||typeof context!=='object')return '';
  const blocks=[];
  if(context.korean)blocks.push(`<div class="gg-q-context-ko">${esc(context.korean)}</div>`);
  if(context.sentence)blocks.push(`<div class="gg-q-context-sentence">${esc(context.sentence)}</div>`);
  if(Array.isArray(context.items))blocks.push(`<div class="gg-q-context-items">${context.items.map(item=>`<div>${esc(item)}</div>`).join('')}</div>`);
  if(context.passage)blocks.push(`<div class="gg-q-context-passage">${esc(context.passage)}</div>`);
  if(context.text)blocks.push(`<div class="gg-q-context-passage">${esc(context.text)}</div>`);
  if(Array.isArray(context.provided_words))blocks.push(`<div class="gg-q-words">${context.provided_words.map(word=>`<span>${esc(word)}</span>`).join('')}</div>`);
  return blocks.join('');
}

function answerText(question){
  const answers=Array.isArray(question.correct_answer)?question.correct_answer:[question.correct_answer].filter(Boolean);
  if(answers.length===1&&Array.isArray(question.choices)){
    const n=Number(answers[0]);
    if(Number.isInteger(n)&&n>=1&&n<=question.choices.length)return `${n}. ${question.choices[n-1]}`;
  }
  return answers.map(value=>typeof value==='string'?value:JSON.stringify(value)).join(' / ');
}

function questionMarkup(question,index,total){
  const choices=Array.isArray(question.choices)&&question.choices.length
    ?`<div class="gg-q-choices">${question.choices.map((choice,i)=>`<div><b>${i+1}</b><span>${esc(typeof choice==='string'?choice:JSON.stringify(choice))}</span></div>`).join('')}</div>`:'';
  return `<article class="gg-q-card" data-gg-q-index="${index}">
    <div class="gg-q-meta"><span>실제 Lesson 문제</span><b>${index+1} / ${total}</b></div>
    <h3>${esc(question.prompt_text||'문제를 확인하세요.')}</h3>
    ${contextMarkup(question.context)}
    ${choices}
    <details class="gg-q-answer"><summary>정답 보기</summary><div>${esc(answerText(question)||'정답 정보 없음')}</div></details>
  </article>`;
}

async function loadExamples(guideKey){
  const route=currentRoute?.()||{};
  if(route.view!=='lesson'||!route.planId||!route.lesson)return [];
  const plan=(trackingState().plans||[]).find(p=>String(p.id)===String(route.planId));
  if(!plan)return [];
  const ids=await resolveContentIds(plan,route.lesson);
  if(!ids?.unitId)return [];
  const cacheKey=`${ids.unitId}:${guideKey}`;
  if(cache.has(cacheKey))return cache.get(cacheKey);
  const rows=await contentDbGet(`/rest/v1/test_prep_questions?select=id,prompt_text,context,choices,correct_answer,targets,question_type,answer_mode,student_source_label&student_usable=eq.true&unit_id=eq.${encodeURIComponent(ids.unitId)}&section=eq.grammar&limit=500`);
  const matched=(Array.isArray(rows)?rows:[]).filter(row=>resolveGuideKeys(row.targets||[]).includes(guideKey));
  const unique=[];const seen=new Set();
  for(const row of matched){
    const sig=JSON.stringify([row.prompt_text,row.context,row.choices,row.correct_answer]);
    if(seen.has(sig))continue;seen.add(sig);unique.push(row);
    if(unique.length>=20)break;
  }
  cache.set(cacheKey,unique);
  return unique;
}

export async function attachQuestionExamples(guideKey){
  const sheet=document.querySelector('.grammar-guide-overlay .gg-sheet');
  if(!sheet)return;
  sheet.querySelector('.gg-question-examples')?.remove();
  const mount=document.createElement('section');
  mount.className='gg-question-examples';
  mount.innerHTML='<div class="gg-q-loading">실제 Lesson 문제 불러오는 중…</div>';
  const exam=sheet.querySelector('.gg-exam');
  if(exam)exam.insertAdjacentElement('afterend',mount);else sheet.querySelector('.gg-memory')?.insertAdjacentElement('beforebegin',mount);
  try{
    const questions=await loadExamples(guideKey);
    if(!mount.isConnected)return;
    if(!questions.length){mount.remove();return;}
    let index=0;
    const render=()=>{
      mount.innerHTML=`<div class="gg-q-head"><div><small>LESSON QUESTIONS</small><h2>실제 문제 예시</h2></div><div class="gg-q-nav"><button type="button" data-gg-q-prev aria-label="이전 문제">←</button><span>${index+1} / ${questions.length}</span><button type="button" data-gg-q-next aria-label="다음 문제">→</button></div></div>${questionMarkup(questions[index],index,questions.length)}`;
      mount.querySelector('[data-gg-q-prev]').disabled=index===0;
      mount.querySelector('[data-gg-q-next]').disabled=index===questions.length-1;
      mount.querySelector('[data-gg-q-prev]').onclick=()=>{if(index>0){index--;render()}};
      mount.querySelector('[data-gg-q-next]').onclick=()=>{if(index<questions.length-1){index++;render()}};
      let startX=null;
      const card=mount.querySelector('.gg-q-card');
      card?.addEventListener('touchstart',e=>{startX=e.touches?.[0]?.clientX??null},{passive:true});
      card?.addEventListener('touchend',e=>{if(startX==null)return;const end=e.changedTouches?.[0]?.clientX??startX;const dx=end-startX;startX=null;if(Math.abs(dx)<45)return;if(dx<0&&index<questions.length-1){index++;render()}else if(dx>0&&index>0){index--;render()}},{passive:true});
    };
    render();
  }catch(error){
    console.warn('[grammar-guide] real question examples failed',error);
    if(mount.isConnected)mount.remove();
  }
}
