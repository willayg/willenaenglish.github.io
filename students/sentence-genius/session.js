// One exercise session. QuestionRenderer, speech, stars and recording stay
// in their existing Word Genius / student-platform canonical modules.
import {QuestionRenderer} from '/shared/questions/question-renderer.js?v=20261111-speaking-preview4';
import {recordSentenceAttempt} from './tracking.js?v=sg-decisions-v4a';
import {recordSentenceHomeworkAnswer} from './homework.js?v=20261104-isolated2';
import {connectSpeechSupport,playModel,prefetchAudio,stopAudio,matchSentence} from './speech.js?v=20261104-determiner2';
import {rewardSession} from './rewards.js?v=sg-coach-gold-v3';
import {playStudentSfx} from '/students/shared/student-sfx.js';
import {renderStudentSessionFinish} from '/students/components/student-session-finish.js?v=1';
import {capturePointOrigin,showPointAward} from '/students/components/student-point-feedback.js';
import {checkOrder} from './scoring.js?v=sg-coach-gold-v3';
import {grammarClueFor} from './grammar-clues.js?v=sg-clues-v1b';
import {usableAlternatives} from './ai-grading.js?v=sg-phase3b';
import {gradeSpeaking} from '/students/shared/speaking-smart-grade.js?v=20261111-1';

const $=id=>document.getElementById(id);
const titles={coach:'코치',unscramble:'문장 배열',speaking:'말하기'};
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
    since=0,epoch=0,mode='coach',reward=null,saving=new Set(),listenUsed=false,grading=false,sessionRunId=null;
  function dispose(){
    ++epoch;
    speech?.dispose();speech=null;
    try{renderer?.speechRecognition?.stop()}catch{}
    renderer=null;stopAudio();
  }
  function current(){return queue[index]||null}
  function changeMode(next,{book,unit,items,store,preview=false,homework=null,sessionContext=null}){
    if(!['coach','unscramble','speaking'].includes(next)||!items.length)return false;
    dispose();
    ctx={book,unit,items,store,preview,homework,sessionContext};
    if(homework&&!homework.required_modes?.includes(next))return false;
    sessionRunId=window.crypto?.randomUUID?.()||null;
    if(homework&&!sessionRunId)throw Error('Secure homework session ID unavailable');
    mode=next;index=0;answered=false;
    const pending=store.pending(mode,items);
    const isReview=!pending.length;
    queue=shuffle((isReview?items:pending).map(row=>({...row,retry:0})));
    reward=preview||homework||isReview||store.gold(items)?null:rewardSession(book,unit,mode);
    $('sessionTitle').textContent=(homework?'숙제 · ':'')+titles[mode];
    $('sessionFooter').hidden=false;
    $('sessionContent').hidden=false;
    render();return true;
  }
  function render(){
    dispose();answered=false;listenUsed=false;grading=false;
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
    $('listenLabel').textContent='Listen · 발음 듣기';
    $('answerNote').hidden=true;
    $('action').textContent='Check Answer';$('action').disabled=true;$('action').classList.remove('is-next');
    $('skip').hidden=mode==='unscramble';
    const root=$('questionRoot');
    root.innerHTML='<div class="question-card" id="sentenceQuestionHost"></div>';
    const host=$('sentenceQuestionHost');
    renderer=new QuestionRenderer(host).render(questionFor(mode,item),{
      onChange:(_answer,has)=>{
        if(!answered&&!grading&&token===epoch)$('action').disabled=!has;
        if(mode!=='unscramble'&&has&&token===epoch&&renderer){
          const candidates=renderer.getSpeechAlternatives?.()||[];
          updateSpeakingPreview(candidates.length?candidates:[_answer]);
        }
      }
    });
    if(mode==='speaking'){
      const grammarClue=grammarClueFor(item);
      if(grammarClue){
        const hint=document.createElement('div');
        hint.className='sg-grammar-clue';
        hint.setAttribute('aria-label','Required English grammar');
        const title=document.createElement('span');
        title.className='sg-grammar-clue-label';
        title.textContent=grammarClue.label||'필수 문법 · Use';
        const word=document.createElement('strong');
        word.textContent=grammarClue.word;
        const detail=document.createElement('span');
        detail.className='sg-grammar-clue-detail';
        detail.textContent=grammarClue.detail;
        hint.append(title,word,detail);
        host.querySelector('.prompt')?.insertAdjacentElement('afterend',hint);
      }
    }
    if(mode!=='unscramble'){
      const instance=renderer;
      instance.onSpeechResult=alternatives=>updateSpeakingPreview(alternatives);
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
  function updateSpeakingPreview(alternatives){
    const item=current();if(!item||answered||mode==='unscramble')return;
    const grade=gradeSpeaking(item.en,alternatives,{mode:'sentence'});
    const node=renderer?.host?.querySelector('[data-speaking-transcript]');
    if(!node)return;
    const palette={green:['#168345','#77c99a'],lime:['#719D19','#B5DB70'],yellow:['#A87C07','#F1D079'],red:['#cf304c','#efa4ae']};
    const [color,border]=palette[grade.level];node.style.color=color;node.style.borderColor=border;
    node.dataset.accepted=grade.level==='green'?'true':grade.level;
  }
  function queueRetry(row){
    const retry={...row,retry:row.retry+1};
    // Retry later, not immediately: same as Word Genius's incorrect-only recovery.
    queue.push(retry);
  }
  async function submit(){
    const item=current();
    if(!item||!renderer||grading)return;
    if(answered){index++;render();return}
    const response=renderer.getResponse();
    if(!String(response??'').trim())return;
    const alternatives=renderer.getSpeechAlternatives?.();
    const candidates=alternatives?.length?alternatives:[response];
    const usable=mode==='unscramble'?candidates:usableAlternatives(candidates,item.en);
    if(mode!=='unscramble'&&!usable.length){
      onMessage('음성을 잘 인식하지 못했어요. 다시 말해 보세요.');
      renderer.state.speakingTranscript='';
      renderer.state.speakingAlternatives=[];
      renderer.emit();
      return;
    }
    const previous=mode==='unscramble'?{correct:checkOrder(response,item.en),matchedBy:'order'}:
      matchSentence(item.en,usable,item.gradingContext);
    const evaluation=mode==='unscramble'?null:gradeSpeaking(item.en,usable,{mode:'sentence'});
    // Preserve previously approved equivalent phrases, but never make an AI request.
    if(evaluation&&previous.correct){evaluation.points=4;evaluation.correct=true;evaluation.level='green';evaluation.matchedBy=previous.matchedBy||'approved_equivalent';}
    const result=mode==='unscramble'?previous:evaluation;
    const correct=!!result.correct;
    const assisted=mode==='speaking'&&listenUsed;
    const almostRight=correct&&result.points<4;
    const verdict=ctx.store.attempt(mode,item.id,{correct,assisted,almostRight,gradePoints:mode==='unscramble'?(correct?4:0):result.points});
    reward?.note(verdict.mastered,item.retry,verdict.points,mode==='unscramble'?(correct?4:0):result.points);
    if(verdict.repeat)queueRetry(item);
    answered=true;
    const rec=renderer;
    speech?.dispose();speech=null;
    rec.setDisabled(true);
    const acceptedAlternative=correct&&[
      'approved_alternative','equivalent_quantifier','equivalent_possession_question',
      'equivalent_permission','equivalent_request','ai','ai_cached'
    ].includes(result.matchedBy);
    rec.showFeedback({
      correct,correctAnswer:[item.en],
      message:correct&&assisted?'잘했어요! 듣기 사용 · +'+verdict.points+'점':
        result.points===3?'좋아요! 거의 맞았어요. +3점':
        result.points===2?'잘했어요! 조금 더 연습해요. +2점':
        acceptedAlternative?'다른 표현도 정답이에요!':
        correct?'잘했어요!':'다음에 한 번 더 연습해요.'
    });
    $('answerNote').textContent=correct&&assisted?
      'Listen used · +2 points. Try again independently for 4 points.':
      almostRight?'Speaking '+result.level+' · +'+verdict.points+' points. Model: '+item.en:
      acceptedAlternative?'Another correct way: '+item.en:
      correct?'Good job!':'Correct sentence: '+item.en;
    $('answerNote').hidden=false;
    $('action').textContent='Next →';$('action').disabled=false;$('action').classList.add('is-next');
    playStudentSfx(correct||almostRight?'correct':'wrong');
    if(verdict.points>0&&!ctx.preview&&!ctx.homework){
      try{Promise.resolve(showPointAward({amount:verdict.points,origin:capturePointOrigin($('action'))})).catch(()=>{})}catch{}
    }
    onProgress(ctx);
    if(!ctx.preview){
    const recorded=Promise.resolve().then(()=>ctx.homework?
     recordSentenceHomeworkAnswer({assignmentId:ctx.homework.id,sentenceId:item.id,mode,
      sessionId:sessionRunId,correct:verdict.mastered}):
     recordSentenceAttempt({
      book:ctx.book,unit:ctx.unit,item,mode,response,correct:verdict.mastered,
      assisted,almostRight,gradePoints:mode==='unscramble'?null:result.points,retryCount:item.retry,points:verdict.points,
      matchedBy:result.matchedBy||'unmatched',
      source:'browser',
      elapsedMs:Date.now()-since
     })).catch(e=>{console.warn('[Sentence Genius] progress queued or unavailable',e);onMessage('Progress could not be confirmed online.')});
    saving.add(recorded);recorded.finally(()=>saving.delete(recorded));
    }
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
    // Use the same canonical finish markup as Word Genius and Grammar Genius.
    // Keep Sentence Genius's stats, rewards and navigation behavior unchanged.
    $('questionRoot').innerHTML=renderStudentSessionFinish({
      title:ctx.homework?'Homework complete!':'Session complete!',
      description:ctx.preview?'Teacher preview · No scores or rewards were saved.':'다음 단계도 도전해 보세요.',
      stats:ctx.homework?[
        {label:'Homework progress',value:ctx.store.percent(mode,ctx.items)+'%'},
        {label:'Speaking score',value:mode==='unscramble'?'—':ctx.store.speakingQuality(mode,ctx.items).percent+'%'},
        {label:'Stars',value:mode==='unscramble'?'—':ctx.store.stars(mode,ctx.items)+'/5'},
        {label:'Lime / Yellow',value:mode==='unscramble'?'—':ctx.store.speakingQuality(mode,ctx.items).lime+' / '+ctx.store.speakingQuality(mode,ctx.items).yellow},
        {label:'Mode',value:titles[mode]}
      ]:[
        {label:'Unit mastery',value:ctx.store.percent(mode,ctx.items)+'%'},
        {label:'Stars',value:ctx.store.stars(mode,ctx.items)+'/5'},
        {label:'Speaking score',value:mode==='unscramble'?'—':ctx.store.speakingQuality(mode,ctx.items).percent+'%'},
        {label:'Lime / Yellow',value:mode==='unscramble'?'—':ctx.store.speakingQuality(mode,ctx.items).lime+' / '+ctx.store.speakingQuality(mode,ctx.items).yellow},
        {label:'Golden Unit',value:ctx.store.gold(ctx.items)?'Gold':'—'}
      ],
      rewardHtml:'<div id="sentenceFinishCelebration" aria-live="polite"></div>',
      actionsHtml:'<button id="sentenceFinishBack" class="vocab-done-btn" type="button">Back to unit</button>'+
        '<button id="sentenceFinishAgain" class="vocab-review-btn" type="button">Practice again</button>'
    });
    const celebration=$('sentenceFinishCelebration');
    $('sentenceFinishBack').addEventListener('click',onBack);
    $('sentenceFinishAgain').addEventListener('click',()=>{changeMode(mode,ctx);$('sessionFooter').hidden=false});
    playStudentSfx('complete');
    // Assignment progress uses the server's recorded attempts. Always wait
    // for this session's writes before refreshing homework completion, even
    // when the student is reviewing an already-golden unit (no reward write).
    await Promise.allSettled([...saving]);
    const endedReward=reward;
    if(endedReward){
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
    const item=current();if(!item||answered)return;
    const btn=$('listen'),token=epoch;btn.disabled=true;
    // Listening assistance is counted only on this question's current
    // attempt; a queued retry starts clean and can earn four points.
    if(mode==='speaking')listenUsed=true;
    try{
      renderer?.speechRecognition?.stop();
      const played=await playModel(item.en);
      if(token!==epoch||answered)return;
      if(!played){if(mode==='speaking')listenUsed=false;onMessage('Listening audio unavailable. No assistance counted.')}
      $('listenLabel').textContent=mode==='speaking'&&listenUsed?
        'Listened · +2 points':'Listen · 발음 듣기';
    }finally{btn.disabled=false}
  });
  $('sessionBack').addEventListener('click',onBack);
  $('sessionHome').addEventListener('click',onHome);
  window.addEventListener('pagehide',dispose);
  return{start:changeMode,dispose,currentContext:()=>ctx};
}
