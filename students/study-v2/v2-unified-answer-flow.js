(function(global){
'use strict';
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function nextLabel(){return isKo()?'다음':'Next';}
function doneLabel(){return isKo()?'완료':'Done';}
function rebuildLetterAnswer(activity,answer){
  var response=activity&&activity.response||{},lengths=Array.isArray(response.wordLengths)?response.wordLengths.map(Number).filter(function(n){return n>0;}):[];
  if(response.type!=='letter_order'||lengths.length<2)return text(Array.isArray(answer)?answer.join(' '):answer);
  var raw=text(Array.isArray(answer)?answer.join(''):answer).replace(/\s+/g,'');
  var total=lengths.reduce(function(a,b){return a+b;},0);
  if(!raw||raw.length!==total)return text(Array.isArray(answer)?answer.join(' '):answer);
  var cursor=0,parts=[];
  lengths.forEach(function(n){parts.push(raw.slice(cursor,cursor+n));cursor+=n;});
  return parts.join(' ');
}
function fixWrongAnswer(detail){
  var a=detail&&detail.activity||{},r=detail&&detail.result||{};
  if(!a.response||a.response.type!=='letter_order'||r.correct)return;
  var answer=rebuildLetterAnswer(a,r.answer);
  if(!answer)return;
  var card=document.querySelector('.activity-card[data-activity-id="'+CSS.escape(String(a.id||''))+'"]');
  var row=card&&card.querySelector('.activity-feedback-answer');
  if(!row)return;
  row.textContent='';
  var strong=document.createElement('strong');strong.textContent='정답 · ';
  row.appendChild(strong);row.appendChild(document.createTextNode(answer));
}
function replaceInline(check,label,disabled,handler){
  if(!check)return null;
  var b=check.cloneNode(true);
  b.disabled=!!disabled;
  b.textContent=label;
  check.replaceWith(b);
  if(handler)b.addEventListener('click',handler,{once:true});
  return b;
}
function normalizeDailyLabels(){
  if(!document.body.classList.contains('study-v2-daily-mode'))return;
  document.querySelectorAll('#v2ActivityRoot .activity-check').forEach(function(b){
    var t=text(b.textContent);
    if(t==='계속'||t==='Continue')b.textContent=nextLabel();
  });
}

/* Daily Study owns its own answer-button lifecycle in v2-daily.js. Do not
   replace or pre-mutate that button here: cloning it can discard the Done/Next
   handler installed by Daily Study, especially at the final-question handoff. */

global.addEventListener('willena:activity-answer',function(e){
  var detail=e.detail||{};
  fixWrongAnswer(detail);

  var ai=document.getElementById('aiCoachPracticeOverlay');
  if(ai){
    var aiRoot=ai.querySelector('#aiCoachActivityRoot');
    var check=aiRoot&&aiRoot.querySelector('.activity-check');
    var next=ai.querySelector('#aiCoachPracticeNext');
    if(check&&next){
      var label=text(next.textContent)||(next.disabled?nextLabel():nextLabel());
      if(label==='Finish')label=doneLabel();
      replaceInline(check,label,false,function(){next.click();});
      return;
    }
  }

  normalizeDailyLabels();
});

if(global.MutationObserver){
  new MutationObserver(normalizeDailyLabels).observe(document.body,{subtree:true,childList:true,characterData:true});
}
normalizeDailyLabels();
})(window);
