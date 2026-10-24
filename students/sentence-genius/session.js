// One exercise session. QuestionRenderer, speech, stars and recording stay
// in their existing Word Genius / student-platform canonical modules.
import {QuestionRenderer} from '/shared/questions/question-renderer.js';
import {recordSentenceAttempt,getSentenceMastery} from './tracking.js';
import {connectSpeechSupport,playModel,prefetchAudio,stopAudio,matchSentence} from './speech.js';
import {rewardSession} from './rewards.js';
import {playStudentSfx} from '/students/shared/student-sfx.js';
import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js';
import {checkOrder} from './scoring.js';

const $=id=>document.getElementById(id);
const titles={coach:'Practice Coach · 연습',unscramble:'문장 배열',speaking:'말하기'};
const instructions={coach:'영어 문장을 듣고 따라 말하세요.',unscramble:'우리말을 보고 문장을 만드세요.',speaking:'우리말을 보고 영어로 말하세요.'};
function shuffle(input){
  const a=input.slice();
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}
  return a;
}
function wordTiles(sentence){
  const words=String(sentence).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?|[^\s]/gu)||[];
  if(words.length<2)return words;
  const options=shuffle(words);
  if(options.join(' ')==words.join(' '))options.push(options.shift());
  return options;
}
function questionFor(mode,item){
  if(mode==='unscramble')return {
    id:'sentence-words-'+item.id,form:'order',
    prompt:item.ko,context:{},answer:[item.en],chips:wordTiles(item.en),
    input:{language:'en'},grading:{constraints:{}}
  };
  return {
    id:'sentence-voice-'+item.id,form:'speaking',
    prompt:item.ko,context:{},answer:[item.en],
    input:{language:'en'},grading:{constraints:{}}
  };
}
export function createSession({onFinish,onProgress,onHome,onBack,onMessage}){
  let ctx=null,queue=[],index=0,renderer=null,speech=null,answered=false,
    since=0,epoch=0,mode='coach',reward=null,saving=new Set();
  function dispose(){
    ++epoch;
    speech?.dispose();speech=null;
    try{renderer?.speechRecognition?.stop()}catch{}
    renderer=null;stopAudio();
  }
  function current(){return queue[index]||null}
  function changeMode(next,{book,unit,items,store}){
    if(!['coach','unscramble','speaking'].includes(next)||!items.length)return false;
    dispose();
    ctx={book,unit,items,store};
    mode=next;index=0;answered=false;
    const pending=store.pending(mode,items);
    const isReview=!pending.length;
    queue=shuffle((isReview?items:pending).map(row=>({...row,retry:0})));
    reward=isReview||store.gold(items)?null:rewardSession(book,unit,mode);
    $('sessionTitle').textContent=titles[mode];
    $('sessionFooter').hidden=false;
    $('sessionContent').hidden=false;
    render();return true;
  }
  function render(){
    dispose();answered=false;
    const item=current();
    if(!item){void finish();return}
    const token=epoch;since=Date.now();
    $('sessionTitle').textContent=titles[mode];
    $('sessionIndex').textContent=(index+1)+' / '+queue.length;
    $('sessionBar').style.width=Math.round(100*index/Math.max(1,queue.length))+'%';
    $('instruction').textContent=instructions[mode];
    $('englishCoach').hidden=mode!=='coach';
    $('englishCoach').textContent=mode==='coach'?item.en:'';
    $('listenTools').hidden=mode!=='coach';
    $('answerNote').hidden=true;
    $('action').textContent='Check Answer';$('action').disabled=true;$('action').classList.remove('is-next');
    $('skip').hidden=mode==='unscramble';
    const root=$('questionRoot');
    root.innerHTML='<div class="question-card" id="sentenceQuestionHost"></div>';
    const host=$('sentenceQuestionHost');
    renderer=new QuestionRenderer(host).render(questionFor(mode,item),{
      onChange:(_answer,has)=>{if(!answered&&token===epoch)$('action').disabled=!has}
    });
    if(mode!=='unscramble'){
      const instance=renderer;
      speech=connectSpeechSupport({
        host,renderer:instance,item,
        isCurrent:()=>token===epoch&&renderer===instance&&!answered,
        onAccepted:()=>{if(token===epoch&&!answered)void submit()},
        onListeningAvailable:()=>{if(token===epoch&&mode==='speaking')$('listenTools').hidden=false}
      });
      prefetchAudio(queue.slice(index,index+3));
    }
    $('sessionMain').scrollTop=0;
  }
  function queueRetry(row){
    const retry={...row,retry:row.retry+1};
    // Retry later, not immediately: same as Word Genius's incorrect-only recovery.
    queue.push(retry);
  }
  async function submit(){
    const item=current();
    if(!item||!renderer)return;
    if(answered){index++;render();return}
    const response=renderer.getResponse();
    if(!String(response??'').trim())return;
    const alternatives=renderer.getSpeechAlternatives?.();
    const result=mode==='unscramble'
      ?{correct:checkOrder(response,item.en),matchedBy:'order'}
      :matchSentence(item.en,alternatives?.length?alternatives:[response]);
    const correct=!!result.correct;
    const verdict=ctx.store.attempt(mode,item.id,{correct});
    reward?.note(correct,item.retry,verdict.points);
    if(verdict.repeat)queueRetry(item);
    answered=true;
    const rec=renderer;
    speech?.dispose();speech=null;
    rec.setDisabled(true);
    rec.showFeedback({
      correct,correctAnswer:[item.en],
      message:correct?'잘했어요!':'다음에 한 번 더 연습해요.'
    });
    $('answerNote').textContent=correct?'Good job!':'Correct sentence: '+item.en;
    $('answerNote').hidden=false;
    $('action').textContent='Next →';$('action').disabled=false;$('action').classList.add('is-next');
    playStudentSfx(correct?'correct':'wrong');
    if(verdict.points>0){
      try{Promise.resolve(showPointAward({amount:verdict.points,origin:capturePointOrigin($('action'))})).catch(()=>{})}catch{}
    }
    onProgress(ctx);
    const recorded=Promise.resolve().then(()=>recordSentenceAttempt({
      book:ctx.book,unit:ctx.unit,item,mode,response,correct,
      retryCount:item.retry,points:verdict.points,
      source:result.matchedBy==='ai'?'ai':'browser',
      elapsedMs:Date.now()-since
    })).catch(e=>{console.warn('[Sentence Genius] progress queued or unavailable',e);onMessage('Progress could not be confirmed online.')});
    saving.add(recorded);recorded.finally(()=>saving.delete(recorded));
  }
  function skip(){
    if(answered||!current()||mode==='unscramble')return;
    // Skips never award points or gold, and are always revisited.
    if(mode==='speaking')queueRetry(current());
    index++;render();
  }
  async function finish(){
    dispose();$('sessionFooter').hidden=true;
    $('sessionTitle').textContent='완료 · Session complete';
    $('sessionIndex').textContent='Done';$('sessionBar').style.width='100%';
    $('instruction').textContent='잘했어요!';
    $('englishCoach').hidden=true;$('listenTools').hidden=true;
    $('questionRoot').replaceChildren();
    const panel=document.createElement('div');panel.className='vocab-finish';
    const h=document.createElement('h2');h.textContent='Session complete!';
    const p=document.createElement('p');p.textContent='다음 단계도 도전해 보세요.';
    const detail=document.createElement('div');detail.className='vocab-finish-stats';
    for(const [label,value] of [['Unit mastery',ctx.store.percent(mode,ctx.items)+'%'],
      ['Stars',ctx.store.stars(mode,ctx.items)+'/5'],['Golden Unit',ctx.store.gold(ctx.items)?'Gold':'—']]){
      const stat=document.createElement('div'),b=document.createElement('strong'),span=document.createElement('span');
      b.textContent=value;span.textContent=label;stat.append(b,span);detail.append(stat);
    }
    const celebration=document.createElement('div'),buttons=document.createElement('div');
    buttons.className='vocab-finish-actions';
    const back=document.createElement('button');back.className='vocab-done-btn';back.textContent='Back to unit';
    back.onclick=onBack;
    const again=document.createElement('button');again.className='vocab-review-btn';again.textContent='Practice again';
    again.onclick=()=>{changeMode(mode,ctx);$('sessionFooter').hidden=false};
    buttons.append(back,again);panel.append(h,p,detail,celebration,buttons);
    $('questionRoot').append(panel);
    playStudentSfx('complete');
    const endedReward=reward;
    if(endedReward){
      // Flush normal attempts first, then the reward summary, so server state
      // is consistent and a brief connection loss cannot duplicate a reward.
      await Promise.allSettled([...saving]);
      try{
        const outcome=await endedReward.finish();
        if(reward!==endedReward||!celebration.isConnected)return;
        const widget=document.createElement('student-reward-celebration');
        widget.setAttribute('percent',String(outcome.percent));
        widget.setAttribute('stars',String(outcome.stars));
        widget.setAttribute('star-max','5');
        widget.setAttribute('points',String(outcome.points));
        widget.setAttribute('label','SENTENCE GENIUS');
        celebration.append(widget);
      }catch(error){onMessage('Reward save could not be confirmed.');console.warn(error)}
    }
    onFinish(ctx);
  }
  $('action').addEventListener('click',()=>void submit());
  $('skip').addEventListener('click',skip);
  $('listen').addEventListener('click',async()=>{
    const item=current();if(!item)return;
    const btn=$('listen');btn.disabled=true;
    try{renderer?.speechRecognition?.stop();await playModel(item.en)}
    finally{btn.disabled=false}
  });
  $('sessionBack').addEventListener('click',onBack);
  $('sessionHome').addEventListener('click',onHome);
  window.addEventListener('pagehide',dispose);
  return{start:changeMode,dispose,currentContext:()=>ctx};
}
