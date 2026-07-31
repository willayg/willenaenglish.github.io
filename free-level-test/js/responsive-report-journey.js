(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;

var MAX_PUBLIC_LEVEL=12;
var narrowQuery=window.matchMedia('(max-width: 599px)');

function isKorean(){return document.documentElement.lang==='ko'}
function stageFromReport(){
 var level=root.querySelector('.report-screen .report-level');
 if(!level)return null;
 var prefix=(level.querySelector('span')||{}).textContent||'';
 var value=Number(((level.querySelector('strong')||{}).textContent||'').trim());
 if(!Number.isFinite(value))return null;
 return /starter|스타터/i.test(prefix)?value:value+2;
}
function stageShort(stage){
 if(stage===1)return'S1';
 if(stage===2)return'S2';
 return String(stage-2);
}
function stageLong(stage,ko){
 if(stage===1)return ko?'스타터 1':'Starter 1';
 if(stage===2)return ko?'스타터 2':'Starter 2';
 return (ko?'레벨 ':'Level ')+(stage-2);
}
function rangeMarker(first,last){
 return stageShort(first)+'–'+stageShort(last);
}
function rangeLabel(first,last,ko,isBefore){
 if(first===1&&last<=6)return ko?'기초 과정':'Foundation';
 return ko?(isBefore?'이전 레벨':'다음 레벨'):(isBefore?'Earlier levels':'Later levels');
}
function nodeMarkup(node,ko){
 var cls='level-node';
 if(node.kind==='current')cls+=' is-current';
 if(node.kind==='complete'||node.kind==='before')cls+=' is-complete';
 if(node.kind==='before'||node.kind==='after')cls+=' is-range';
 if(node.kind==='after')cls+=' is-future-range';
 var marker=node.kind==='before'||node.kind==='after'?rangeMarker(node.first,node.last):stageShort(node.stage);
 var label=node.kind==='before'||node.kind==='after'?rangeLabel(node.first,node.last,ko,node.kind==='before'):stageLong(node.stage,ko);
 var adjacent=node.kind==='complete'||node.kind==='future'?' is-adjacent':'';
 return '<div class="'+cls+adjacent+'"><div class="level-node__marker">'+marker+'</div><span class="level-node__label">'+label+'</span></div>';
}
function buildNodes(current,radius){
 var maxStage=MAX_PUBLIC_LEVEL+2;
 var first=Math.max(1,current-radius);
 var last=Math.min(maxStage,current+radius);
 var nodes=[];
 if(first>1)nodes.push({kind:'before',first:1,last:first-1});
 for(var stage=first;stage<=last;stage++){
  nodes.push({kind:stage<current?'complete':stage===current?'current':'future',stage:stage});
 }
 if(last<maxStage)nodes.push({kind:'after',first:last+1,last:maxStage});
 return nodes;
}
function renderJourney(){
 var journey=root.querySelector('.report-screen .level-journey');
 var current=stageFromReport();
 if(!journey||!current)return;
 var narrow=narrowQuery.matches;
 var nodes=buildNodes(current,narrow?1:2);
 var currentIndex=nodes.findIndex(function(node){return node.kind==='current'});
 var ko=isKorean();
 journey.classList.add('responsive-level-journey');
 journey.classList.toggle('is-narrow',narrow);
 journey.style.setProperty('--journey-count',String(nodes.length));
 journey.style.setProperty('--journey-current-index',String(currentIndex));
 journey.innerHTML=(narrow?'':'<div class="level-journey__here">'+(ko?'현재 레벨':'You are here')+'</div>')+
  '<div class="level-journey__track"><div class="level-journey__fill"></div></div>'+
  '<div class="level-journey__nodes">'+nodes.map(function(node){return nodeMarkup(node,ko)}).join('')+'</div>';
}

var scheduled=false;
function scheduleRender(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(function(){scheduled=false;renderJourney()});
}
new MutationObserver(scheduleRender).observe(root,{childList:true,subtree:true});
new MutationObserver(scheduleRender).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
if(narrowQuery.addEventListener)narrowQuery.addEventListener('change',scheduleRender);
else narrowQuery.addListener(scheduleRender);
window.addEventListener('resize',scheduleRender,{passive:true});
scheduleRender();
})();