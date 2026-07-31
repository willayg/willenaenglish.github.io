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
var pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;moveTools()})}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
schedule();
})();