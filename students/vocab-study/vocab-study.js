(function(global){
'use strict';

var statusEl=document.getElementById('vocabStudyStatus');
var startBtn=document.getElementById('vocabStudyStart');

function setStatus(message){
  if(statusEl)statusEl.textContent=message;
}

async function boot(){
  try{
    if(global.WillenaVocabStudyAuthReady){
      var ok=await global.WillenaVocabStudyAuthReady;
      if(!ok)return;
    }

    var engineReady=typeof global.WillenaActivityEngine==='function';
    var schemaReady=!!global.WillenaActivitySchema;
    var scoringReady=!!global.WillenaActivityScoring;
    var bankReady=!!global.WillenaStudyQuestionBank;

    if(!engineReady||!schemaReady||!scoringReady||!bankReady){
      throw new Error('Shared Study components failed to load.');
    }

    setStatus('준비 완료');
    if(startBtn){
      startBtn.disabled=true;
      startBtn.title='Vocabulary session logic will be connected in P2.';
    }

    global.WillenaVocabStudy={
      version:'p1-shell-20260923',
      shared:{
        engine:engineReady,
        schema:schemaReady,
        scoring:scoringReady,
        questionBank:bankReady
      }
    };

    try{
      global.dispatchEvent(new CustomEvent('willena:vocab-study-ready',{
        detail:global.WillenaVocabStudy
      }));
    }catch(_){}
  }catch(error){
    console.error('[Vocab Study] boot',error);
    setStatus('불러오지 못했습니다. 새로고침해 주세요.');
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',boot,{once:true});
}else{
  boot();
}
})(window);