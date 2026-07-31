(function(){
'use strict';
var root=document.querySelector('#app');
if(!root||typeof window.loadQuestionBank!=='function')return;

function cleanDisplay(value){
 return String(value==null?'':value)
  .toLowerCase()
  .trim()
  .replace(/^[“”"‘’.,!?;:()]+|[“”"‘’.,!?;:()]+$/g,'');
}
function withoutEdgeS(value){
 return value.replace(/^s|s$/g,'');
}

var bankPromise=window.loadQuestionBank().catch(function(error){
 console.warn('Could not load scramble tokens for display repair',error);
 return[];
});

function repair(){
 var card=root.querySelector('.question-card[data-question-id]');
 if(!card||!card.querySelector('.scramble-token'))return;
 var id=card.getAttribute('data-question-id');
 bankPromise.then(function(bank){
  var item=bank.find(function(question){return String(question.id)===String(id)});
  if(!item||item.type!=='sentence_unscramble'||!Array.isArray(item.tokens))return;
  var originals=item.tokens.map(cleanDisplay);
  var used=new Set();
  var buttons=[].slice.call(card.querySelectorAll('.scramble-token'));
  buttons.forEach(function(button){
   var shown=cleanDisplay(button.textContent);
   var match=-1;
   for(var i=0;i<originals.length;i++){
    if(!used.has(i)&&originals[i]===shown){match=i;break}
   }
   if(match<0){
    for(var j=0;j<originals.length;j++){
     if(!used.has(j)&&withoutEdgeS(originals[j])===shown){match=j;break}
    }
   }
   if(match>=0){
    used.add(match);
    if(button.textContent!==originals[match])button.textContent=originals[match];
   }
  });
 });
}

var scheduled=false;
function schedule(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(function(){scheduled=false;repair()});
}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
schedule();
})();
