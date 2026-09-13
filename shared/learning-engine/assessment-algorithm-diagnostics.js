(function(){
'use strict';
if(location.hostname!=='staging.willenaenglish.com')return;
var params=new URLSearchParams(location.search);
if(params.get('diag')!=='1')return;

var SECTIONS=[
 {key:'vocabulary',types:['vocabulary']},
 {key:'grammar',types:['grammar','grammar_error','question_response']},
 {key:'listening',types:['listening']},
 {key:'reading',types:['reading']},
 {key:'sentence_building',types:['sentence_unscramble']}
];
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function num(v){v=Number(v);return Number.isFinite(v)?v:null}
function fmt(v,d){return v==null?'—':Number(v).toFixed(d==null?2:d)}
function context(){return window.WillenaLevelTestContext||{mode:'unknown',setup:{}}}
function setup(){
 var ctx=context(),base=Object.assign({},ctx.setup||{}),store=window.WillenaAssessmentSessionStore;
 if(store&&typeof store.get==='function')try{var s=store.get();if(s&&s.setup)base=Object.assign(base,s.setup)}catch(_){}
 return base;
}
function answers(){
 var rec=window.WillenaLevelTestRecorder;
 if(!rec||typeof rec.getAnswers!=='function')return[];
 try{return rec.getAnswers().map(function(r){return{id:String(r.assessment_item_id||''),level:Number(r.question_level)||1,type:r.item_type||'',correct:r.is_correct===true}})}catch(_){return[]}
}
function startAbility(s){
 var ctx=context(),cfg=window.WillenaVisitorV2Config||{};
 if(ctx.mode==='visitor'&&cfg.enabled&&Number.isFinite(Number(cfg.teacherStartLevel)))return clamp(Number(cfg.teacherStartLevel),1,12);
 var matrix={1:{0:1,1:1.5,2:2,4:2.5,6:3},2:{0:1,1:2,2:3,4:4,6:5},4:{0:1.5,1:2.5,2:4,4:5.5,6:6.5},6:{0:2,1:3,2:4.5,4:6,6:7.5},8:{0:2.5,1:3.5,2:5,4:7,6:8.5},9:{0:3,1:4,2:5.5,4:7.5,6:9}};
 var stage=matrix[Number(s.grade)]||matrix[1],value=stage[Number(s.years)];
 return clamp(value==null?1:value,1,12);
}
function estimateAbility(rows,start){
 if(!rows.length)return clamp(start||2,1,12);
 var prior=clamp(start||2,1,12),best=prior,bestLL=-Infinity;
 for(var t=1;t<=12.001;t+=.05){
  var ll=-.055*Math.pow(t-prior,2);
  for(var i=0;i<rows.length;i++){
   var r=rows[i],lvl=clamp(Number(r.level)||1,1,12),p=1/(1+Math.exp((lvl-t)*1.25));
   p=clamp(p,.025,.975);ll+=r.correct?Math.log(p):Math.log(1-p);
  }
  if(ll>bestLL){bestLL=ll;best=t}
 }
 return clamp(best,1,12);
}
function liveAbility(rows,base){
 var ability=base;
 rows.forEach(function(r){var observed=clamp(Number(r.level)+(r.correct?.85:-.9),1,12);ability=clamp(ability*.35+observed*.65,1,12)});
 return ability;
}
function adaptiveTarget(rows,base,start,ability,visitorV2){
 var n=rows.length;if(!n)return base;
 var last=rows[n-1];
 if(n===1)return clamp(base+(last.correct?(visitorV2?.35:1):(visitorV2?-.35:-1)),1,12);
 if(n===2){var rr=rows[0].correct&&rows[1].correct,ww=!rows[0].correct&&!rows[1].correct;return clamp(base+(rr?(visitorV2?.9:2):ww?(visitorV2?-.9:-2):0),1,12)}
 var target=estimateAbility(rows,start),recent=rows.slice(-3),lastTwo=recent.slice(-2);
 if(lastTwo.every(function(x){return x.correct}))target=Math.max(target,(Number(last.level)||target)+(visitorV2?.75:1));
 if(recent.every(function(x){return x.correct}))target=Math.max(target,(Number(last.level)||target)+(visitorV2?1:1.5));
 if(lastTwo.every(function(x){return !x.correct}))target=Math.min(target,(Number(last.level)||target)-(visitorV2?.75:1));
 return clamp(target,1,12);
}
function finalEstimate(rows,start,full){
 if(!full)return estimateAbility(rows,start);
 var scores=[];SECTIONS.forEach(function(sec){var part=rows.filter(function(r){return sec.types.indexOf(r.type)>=0});if(part.length)scores.push(estimateAbility(part,start))});
 return scores.length?clamp(scores.reduce(function(a,b){return a+b},0)/scores.length,1,12):estimateAbility(rows,start);
}
function snapshot(){
 var s=setup(),rows=answers(),start=startAbility(s),full=Number(s.length)===50,sectionIndex=full?Math.min(SECTIONS.length-1,Math.floor(rows.length/10)):0;
 var sectionStart=full?sectionIndex*10:0,sectionRows=rows.slice(sectionStart),sectionBase=full&&sectionStart?estimateAbility(rows.slice(0,sectionStart),start):start;
 var ability=liveAbility(sectionRows,sectionBase),cfg=window.WillenaVisitorV2Config||{},visitorV2=context().mode==='visitor'&&cfg.enabled&&cfg.version==='adaptive-2026-09-v2';
 var target=adaptiveTarget(sectionRows,sectionBase,start,ability,visitorV2),card=document.querySelector('.question-card');
 var currentLevel=card?num(card.getAttribute('data-question-level')):null,currentId=card&&card.getAttribute('data-question-id')||null;
 return{mode:context().mode||'unknown',setup:s,rows:rows,start:start,full:full,section:full?SECTIONS[sectionIndex].key:'adaptive',sectionIndex:sectionIndex,sectionBase:sectionBase,ability:ability,target:target,nextLevel:Math.round(target),evidence:estimateAbility(sectionRows,start),finalEstimate:finalEstimate(rows,start,full),currentLevel:currentLevel,currentId:currentId,correct:rows.filter(function(r){return r.correct}).length,visitorV2:visitorV2};
}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function install(){
 var style=document.createElement('style');style.id='willenaAlgoDiagStyle';style.textContent='\
#willenaAlgoDiagButton{position:fixed;right:14px;bottom:14px;z-index:160000;border:0;border-radius:999px;background:#17243f;color:#fff;font:800 12px Poppins,system-ui,sans-serif;padding:10px 13px;box-shadow:0 8px 24px rgba(20,35,55,.28);cursor:pointer}#willenaAlgoDiag{position:fixed;right:14px;bottom:62px;z-index:160000;width:min(420px,calc(100vw - 28px));max-height:72vh;overflow:auto;background:rgba(17,28,45,.96);color:#f7fbff;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.35);font:500 12px/1.45 Poppins,system-ui,sans-serif;backdrop-filter:blur(12px)}#willenaAlgoDiag[hidden]{display:none}#willenaAlgoDiag h3{margin:0 0 10px;font-size:15px}#willenaAlgoDiag .diag-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px 12px}#willenaAlgoDiag .diag-cell{background:rgba(255,255,255,.07);border-radius:10px;padding:8px}#willenaAlgoDiag .diag-cell span{display:block;color:#9fb0c5;font-size:10px;text-transform:uppercase;letter-spacing:.04em}#willenaAlgoDiag .diag-cell strong{font-size:15px}#willenaAlgoDiag .diag-next strong{font-size:21px}#willenaAlgoDiag table{width:100%;border-collapse:collapse;margin-top:12px;font-size:11px}#willenaAlgoDiag th,#willenaAlgoDiag td{padding:5px 4px;border-top:1px solid rgba(255,255,255,.1);text-align:left}#willenaAlgoDiag .ok{color:#86e3b0}#willenaAlgoDiag .bad{color:#ff9b9b}#willenaAlgoDiag .diag-note{margin:10px 0 0;color:#9fb0c5;font-size:10px}';document.head.appendChild(style);
 var button=document.createElement('button');button.id='willenaAlgoDiagButton';button.type='button';button.textContent='ALG';document.body.appendChild(button);
 var panel=document.createElement('aside');panel.id='willenaAlgoDiag';panel.hidden=false;document.body.appendChild(panel);
 button.onclick=function(){panel.hidden=!panel.hidden};
 return panel;
}
var panel=install();
function render(){
 var x=snapshot(),recent=x.rows.slice(-10);
 panel.innerHTML='<h3>Adaptive algorithm · staging</h3><div class="diag-grid">'+
  '<div class="diag-cell"><span>Mode</span><strong>'+esc(x.mode)+(x.visitorV2?' v2':'')+'</strong></div>'+
  '<div class="diag-cell"><span>Section</span><strong>'+esc(x.section)+'</strong></div>'+
  '<div class="diag-cell"><span>Start ability</span><strong>'+fmt(x.start)+'</strong></div>'+
  '<div class="diag-cell"><span>Section base</span><strong>'+fmt(x.sectionBase)+'</strong></div>'+
  '<div class="diag-cell"><span>Live ability</span><strong>'+fmt(x.ability)+'</strong></div>'+
  '<div class="diag-cell"><span>Evidence estimate</span><strong>'+fmt(x.evidence)+'</strong></div>'+
  '<div class="diag-cell diag-next"><span>Adaptive target</span><strong>'+fmt(x.target)+'</strong></div>'+
  '<div class="diag-cell diag-next"><span>Next level picked</span><strong>'+x.nextLevel+'</strong></div>'+
  '<div class="diag-cell"><span>Current question</span><strong>L'+(x.currentLevel==null?'—':x.currentLevel)+'</strong></div>'+
  '<div class="diag-cell"><span>Provisional final</span><strong>'+fmt(x.finalEstimate)+'</strong></div>'+
  '<div class="diag-cell"><span>Answers</span><strong>'+x.rows.length+'</strong></div>'+
  '<div class="diag-cell"><span>Correct</span><strong>'+x.correct+'</strong></div></div>'+
  '<table><thead><tr><th>#</th><th>Lvl</th><th>Type</th><th>Result</th></tr></thead><tbody>'+recent.map(function(r,i){return'<tr><td>'+(x.rows.length-recent.length+i+1)+'</td><td>'+esc(r.level)+'</td><td>'+esc(r.type)+'</td><td class="'+(r.correct?'ok':'bad')+'">'+(r.correct?'✓':'✕')+'</td></tr>'}).join('')+'</tbody></table>'+
  '<p class="diag-note">Read-only diagnostic. It mirrors the active calibration formulas from recorded answers; it does not control question selection.</p>';
}
setInterval(render,250);render();
window.WillenaAlgorithmDiagnostics={snapshot:snapshot};
})();
