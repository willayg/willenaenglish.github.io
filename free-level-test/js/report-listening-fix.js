(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;
var bankById=new Map();
var attempts=[];
var pending=[];

function clean(value){return String(value==null?'':value).replace(/\s+/g,' ').trim()}
function ko(){return document.documentElement.lang==='ko'}
function publicLabel(internal,plus){
 var value=Number(internal)||1;
 var label=value<=2?(ko()?'스타터 ':'Starter ')+value:(ko()?'레벨 ':'Level ')+(value-2);
 return label+(plus?'+':'');
}
function resolvePending(){
 if(!bankById.size||!pending.length)return;
 pending.splice(0).forEach(function(row){
  var q=bankById.get(row.id);
  if(!q||q.type!=='listening')return;
  attempts.push({id:row.id,level:Number(q.level)||1,correct:clean(row.selected)===clean(q.a)});
 });
 schedulePatch();
}
if(typeof window.loadQuestionBank==='function'){
 window.loadQuestionBank().then(function(items){
  items.forEach(function(q){bankById.set(String(q.id),q)});
  resolvePending();
 }).catch(function(error){console.warn('Could not load listening report evidence bank',error)});
}

document.addEventListener('click',function(event){
 if(event.target.closest('#retry,#home')){attempts.length=0;pending.length=0;return}
 if(!event.target.closest('#next'))return;
 var card=root.querySelector('.question-card[data-question-id]');
 if(!card||!card.querySelector('.listening-panel'))return;
 var selected=card.querySelector('.choice.selected');
 if(!selected)return;
 var row={id:card.getAttribute('data-question-id'),selected:selected.getAttribute('data-value')||selected.textContent};
 var q=bankById.get(String(row.id));
 if(q)attempts.push({id:row.id,level:Number(q.level)||1,correct:clean(row.selected)===clean(q.a)});
 else pending.push(row);
},true);

function estimate(){
 if(!attempts.length)return null;
 var highest=Math.max.apply(null,attempts.map(function(x){return x.level}));
 var scores=[];
 for(var level=1;level<=Math.min(12,highest);level++){
  var log=0;
  attempts.forEach(function(row){
   var p=1/(1+Math.exp((row.level-level)*1.12));
   log+=Math.log(Math.max(.025,Math.min(.975,row.correct?p:1-p)));
  });
  scores.push({level:level,log:log});
 }
 scores.sort(function(a,b){return b.log-a.log});
 var best=scores[0]?scores[0].level:1;
 var accuracy=attempts.filter(function(x){return x.correct}).length/attempts.length;
 if(accuracy<.5)best=Math.min(best,Math.max(1,highest-1));
 var top=attempts.filter(function(x){return x.level===highest});
 var plus=attempts.length>=5&&top.length>=3&&top.every(function(x){return x.correct})&&best===highest;
 return{level:best,plus:plus,accuracy:accuracy,count:attempts.length};
}
function listeningRow(){
 return Array.prototype.find.call(root.querySelectorAll('.report-screen .report-skill'),function(row){
  var title=row.querySelector('.report-skill__head strong');
  return title&&/^(Listening|듣기)$/.test(clean(title.textContent));
 });
}
function patch(){
 var result=estimate(),row=listeningRow();
 if(!result||!row)return;
 row.classList.remove('is-unassessed');
 var level=row.querySelector('.report-skill__level');
 if(level)level.textContent=publicLabel(result.level,result.plus);
 var track=row.querySelector('.report-skill__track');
 if(!track){
  track=document.createElement('div');track.className='report-skill__track';track.innerHTML='<i></i>';
  var head=row.querySelector('.report-skill__head');if(head)head.insertAdjacentElement('afterend',track);
 }
 var bar=track.querySelector('i');if(bar)bar.style.width=Math.min(92,42+result.count*9)+'%';
 var note=row.querySelector('.report-skill__note');
 if(note){
  if(result.count<3)note.textContent=ko()?'듣기 문항 '+result.count+'개를 바탕으로 한 임시 추정입니다.':'Provisional estimate based on '+result.count+' listening question'+(result.count===1?'':'s')+'.';
  else note.textContent=ko()?'듣기 문항 '+result.count+'개의 결과를 반영한 예상 레벨입니다.':'Estimated level based on '+result.count+' listening questions.';
 }
}
var scheduled=false;
function schedulePatch(){if(scheduled)return;scheduled=true;requestAnimationFrame(function(){scheduled=false;patch()})}
new MutationObserver(schedulePatch).observe(root,{childList:true,subtree:true});
new MutationObserver(schedulePatch).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
schedulePatch();
})();