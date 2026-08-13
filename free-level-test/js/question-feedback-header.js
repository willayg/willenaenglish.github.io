(function(){
'use strict';
if(location.hostname.indexOf('staging.')!==0)return;
var root=document.querySelector('#app');
var header=document.querySelector('.app-header');
if(!root||!header)return;
function moveTools(){
 var card=root.querySelector('.question-card[data-question-id]');
 if(!card)return;
 var tools=card.querySelector('.question-feedback-tools:not(.question-feedback-sentinel)');
 if(!tools)return;
 var old=header.querySelector('.question-feedback-tools');
 if(old&&old!==tools)old.remove();
 tools.classList.add('question-feedback-header-tools');
 header.insertBefore(tools,header.firstChild);
 var sentinel=document.createElement('span');
 sentinel.className='question-feedback-tools question-feedback-sentinel';
 sentinel.hidden=true;
 card.appendChild(sentinel);
}
function polishInternalReward(){
 if(location.pathname.indexOf('/students/level-test/')<0)return;
 var reward=root.querySelector('.reward-card');
 if(!reward)return;
 var target=reward.querySelector('.reward-target');
 var hit=Boolean(target&&/reached/i.test(target.textContent||''));
 var note=reward.querySelector('.reward-note');
 if(note)note.textContent=hit?'Wow, you did awesome!':'Nice job! Wanna try again?';
 if(!reward.querySelector('.reward-retry')){
  var home=reward.querySelector('.reward-home');
  var actions=document.createElement('div');
  actions.className='reward-actions';
  actions.style.cssText='display:flex;gap:12px;justify-content:center;flex-wrap:wrap';
  var retry=document.createElement('a');
  retry.className='reward-home reward-retry';
  retry.href='/students/level-test/';
  retry.textContent='Try again';
  retry.style.background='#20b9c5';
  if(home){home.parentNode.insertBefore(actions,home);actions.appendChild(retry);actions.appendChild(home)}
  else{actions.appendChild(retry);reward.appendChild(actions)}
 }
}
var pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;moveTools();polishInternalReward()})}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
schedule();
})();