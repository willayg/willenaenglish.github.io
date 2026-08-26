(function(){
  'use strict';

  let questionShownAt=performance.now();
  let currentQuestion=null;
  let patchedCheck=false;
  let patchedRecord=false;

  function resetQuestionTimer(){ questionShownAt=performance.now(); }

  function patchRecordAttempt(){
    const auth=window.WillenaTestPrepAuth;
    if(!auth||patchedRecord||typeof auth.recordAttempt!=='function') return false;
    const original=auth.recordAttempt.bind(auth);
    auth.recordAttempt=function(payload){
      const q=currentQuestion;
      const elapsed=Math.max(0,Math.round(performance.now()-questionShownAt));
      const enriched={
        ...(payload||{}),
        targets:Array.isArray(q?.targets)?q.targets:[],
        question_type:payload?.question_type||q?.question_type||null,
        response_time_ms:elapsed
      };
      return original(enriched);
    };
    patchedRecord=true;
    return true;
  }

  function patchCheck(){
    if(patchedCheck||typeof window.check!=='function') return false;
    const original=window.check;
    window.check=function(q){
      currentQuestion=q||currentQuestion;
      return original.apply(this,arguments);
    };
    patchedCheck=true;
    return true;
  }

  function watchQuestionCard(){
    const card=document.getElementById('card');
    if(!card) return;
    const observer=new MutationObserver(()=>{
      if(card.querySelector('.prompt')&&card.querySelector('.qnum')) resetQuestionTimer();
    });
    observer.observe(card,{childList:true,subtree:true});
  }

  function bootstrap(){
    patchRecordAttempt();
    patchCheck();
    watchQuestionCard();
    let tries=0;
    const timer=setInterval(()=>{
      patchRecordAttempt();
      patchCheck();
      if((patchedRecord&&patchedCheck)||++tries>80) clearInterval(timer);
    },50);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bootstrap,{once:true});
  else bootstrap();
})();
