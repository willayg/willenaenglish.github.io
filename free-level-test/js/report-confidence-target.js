(function(){
'use strict';
var root=document.querySelector('#app');
if(!root)return;

function internalStage(level){
 var prefix=(level.querySelector('span')||{}).textContent||'';
 var value=Number(((level.querySelector('strong')||{}).textContent||'').trim());
 if(!Number.isFinite(value))return null;
 return /starter|스타터/i.test(prefix)?value:value+2;
}
function marker(stage){
 if(stage===1)return'S1';
 if(stage===2)return'S2';
 return String(stage-2);
}
function mark(stage,cls){
 if(stage<1||stage>12)return'';
 return '<div class="confidence-target__mark '+cls+'" aria-hidden="true">'+marker(stage)+'</div>';
}
function transform(){
 var level=root.querySelector('.report-screen .report-level');
 if(!level||level.dataset.confidenceTarget==='1')return;
 var stage=internalStage(level);
 if(!stage)return;
 var span=level.querySelector('span');
 var strong=level.querySelector('strong');
 var prefix=span?span.textContent:'';
 var value=strong?strong.textContent:'';
 level.dataset.confidenceTarget='1';
 level.classList.add('confidence-target');
 level.setAttribute('aria-label',prefix+' '+value);
 level.innerHTML='<div class="confidence-target__ring confidence-target__ring--outer"></div>'+
  '<div class="confidence-target__ring confidence-target__ring--middle"></div>'+
  '<div class="confidence-target__ring confidence-target__ring--inner"></div>'+
  '<div class="confidence-target__core"><span>'+prefix+'</span><strong>'+value+'</strong></div>'+
  mark(stage-2,'confidence-target__mark--low-far')+
  mark(stage-1,'confidence-target__mark--low-near')+
  mark(stage+1,'confidence-target__mark--high-near')+
  mark(stage+2,'confidence-target__mark--high-far');
}
var scheduled=false;
function schedule(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(function(){scheduled=false;transform()});
}
new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
schedule();
})();