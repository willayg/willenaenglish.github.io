(function(global){
'use strict';
function text(v){return String(v==null?'':v).trim();}
function isKo(){var b=document.getElementById('languageBtn');return !b||text(b.textContent)==='English';}
function nextLabel(){return isKo()?'다음':'Next';}
function doneLabel(){return isKo()?'완료':'Done';}
function installProgressiveStyles(){
  if(document.getElementById('v3ProgressiveExplanationStyles'))return;
  var s=document.createElement('style');
  s.id='v3ProgressiveExplanationStyles';
  s.textContent='\
#v2ActivityRoot .activity-card,#aiCoachActivityRoot .activity-card{overflow-anchor:none}\
#v2ActivityRoot .activity-result-footer,#aiCoachActivityRoot .activity-result-footer{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;min-height:78px;margin-top:18px;padding-top:14px;border-top:1px solid #dcebed}\
#v2ActivityRoot .activity-result-footer .activity-feedback,#aiCoachActivityRoot .activity-result-footer .activity-feedback{display:flex;align-items:center;min-height:48px;margin:0!important;padding:11px 14px!important;border-radius:13px;line-height:1.4}\
#v2ActivityRoot .activity-result-footer .activity-feedback.is-empty,#aiCoachActivityRoot .activity-result-footer .activity-feedback.is-empty{background:transparent!important;color:transparent!important}\
#v2ActivityRoot .activity-result-footer .activity-actions,#aiCoachActivityRoot .activity-result-footer .activity-actions{display:flex;justify-content:flex-end;align-items:center;margin:0!important}\
#v2ActivityRoot .activity-result-footer .activity-check,#aiCoachActivityRoot .activity-result-footer .activity-check{min-width:108px;min-height:46px;margin:0!important}\
#v2ActivityRoot .activity-teaching,#aiCoachActivityRoot .activity-teaching{margin-top:12px;padding:15px 16px;border:1px solid #dcebed;border-radius:15px;background:#fbfefe;color:#315e64;line-height:1.58;overflow-anchor:none}\
#v2ActivityRoot .activity-teaching[hidden],#aiCoachActivityRoot .activity-teaching[hidden]{display:none!important}\
#v2ActivityRoot .activity-teaching-head,#aiCoachActivityRoot .activity-teaching-head{display:flex;align-items:center;margin-bottom:8px}\
#v2ActivityRoot .activity-teaching-level,#aiCoachActivityRoot .activity-teaching-level{display:inline-flex;padding:5px 9px;border-radius:999px;background:#eaf9fa;color:#328f98;font-size:.74rem;font-weight:900}\
#v2ActivityRoot .activity-teaching-copy,#aiCoachActivityRoot .activity-teaching-copy{font-size:.94rem;font-weight:650;white-space:pre-line}\
#v2ActivityRoot .activity-teaching-block,#aiCoachActivityRoot .activity-teaching-block{margin-top:12px;padding-top:12px;border-top:1px solid #e5eff0}\
#v2ActivityRoot .activity-teaching-block-label,#aiCoachActivityRoot .activity-teaching-block-label{display:block;margin-bottom:5px;color:#244f56;font-size:.82rem;font-weight:900}\
#v2ActivityRoot .activity-teaching-controls,#aiCoachActivityRoot .activity-teaching-controls{display:flex;gap:14px;flex-wrap:wrap;margin-top:11px}\
#v2ActivityRoot .activity-explain-more,#v2ActivityRoot .activity-explain-hide,#aiCoachActivityRoot .activity-explain-more,#aiCoachActivityRoot .activity-explain-hide{border:0;background:transparent;padding:5px 0;color:#25aab5;font-weight:900;cursor:pointer}\
@media(max-width:560px){#v2ActivityRoot .activity-result-footer,#aiCoachActivityRoot .activity-result-footer{grid-template-columns:minmax(0,1fr) auto;gap:9px;min-height:72px;margin-top:14px;padding-top:12px}#v2ActivityRoot .activity-result-footer .activity-feedback,#aiCoachActivityRoot .activity-result-footer .activity-feedback{min-height:44px;padding:9px 10px!important;font-size:.88rem}#v2ActivityRoot .activity-result-footer .activity-check,#aiCoachActivityRoot .activity-result-footer .activity-check{min-width:92px;min-height:44px;padding:0 15px!important}#v2ActivityRoot .activity-teaching,#aiCoachActivityRoot .activity-teaching{padding:13px 14px}#v2ActivityRoot .activity-teaching-copy,#aiCoachActivityRoot .activity-teaching-copy{font-size:.9rem}}';
  document.head.appendChild(s);
}
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
  var strong=document.createElement('strong');strong.textContent=isKo()?'정답 · ':'Answer · ';
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
installProgressiveStyles();

/* Daily saves the answer before enabling Next. Change the visible label at the
   original tap, before the network save begins, so the UI responds instantly. */
document.addEventListener('click',function(e){
  if(!document.body.classList.contains('study-v2-daily-mode'))return;
  var check=e.target&&e.target.closest&&e.target.closest('#v2ActivityRoot .activity-check');
  if(!check||check.disabled)return;
  var t=text(check.textContent);
  if(t==='Check'||t==='확인'){
    check.textContent=nextLabel();
    check.dataset.awaitingDailySave='1';
  }
},true);

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

  if(document.body.classList.contains('study-v2-daily-mode')){
    var dailyCheck=document.querySelector('#v2ActivityRoot .activity-check');
    if(dailyCheck){
      var t=text(dailyCheck.textContent);
      if(t==='Check'||t==='확인')replaceInline(dailyCheck,nextLabel(),true,null);
    }
  }
});

if(global.MutationObserver){
  new MutationObserver(normalizeDailyLabels).observe(document.body,{subtree:true,childList:true,characterData:true});
}
normalizeDailyLabels();
})(window);
