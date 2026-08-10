(function(){
'use strict';
/* Study-only first-paint skeletons. The Study markup already exists when this file runs. */
try{
 if(!/^\/students\/study\/?(?:index\.html)?$/i.test(location.pathname))return;
 var uid=String(localStorage.getItem('user_id')||sessionStorage.getItem('user_id')||localStorage.getItem('userId')||sessionStorage.getItem('userId')||'').trim();
 var prefix=uid?'willena-study-cache:v1:'+uid+':':'',maxAge=7*24*60*60*1000;
 function read(k){if(!prefix)return null;var raw=localStorage.getItem(prefix+k);if(!raw)return null;var o=JSON.parse(raw);if(!o||!o.t||Date.now()-o.t>maxAge)return null;return o.v||null;}
 function by(id){return document.getElementById(id);}
 function txt(id,v){var e=by(id);if(e&&v!=null&&v!=='')e.textContent=v;}
 var style=document.createElement('style');style.id='studySkeletonStyle';style.textContent='@keyframes studySk{0%{background-position:200% 0}100%{background-position:-200% 0}}.study-sk{position:relative;overflow:hidden;background:linear-gradient(90deg,#edf3f4 25%,#f7fafb 40%,#edf3f4 60%);background-size:300% 100%;animation:studySk 1.15s ease-in-out infinite;border-radius:12px}.study-sk-card{min-height:92px;border:1px solid rgba(23,63,70,.07);border-radius:18px;padding:16px;background:#fff;display:flex;gap:13px;align-items:center}.study-sk-icon{width:46px;height:46px;flex:0 0 46px;border-radius:14px}.study-sk-lines{display:grid;gap:9px;flex:1}.study-sk-line{height:13px}.study-sk-line.short{width:48%}.study-sk-line.med{width:72%}.study-sk-unit{min-height:108px;border:1px solid rgba(23,63,70,.07);border-radius:18px;padding:17px;background:#fff;display:grid;gap:11px}.study-sk-vrow{display:flex;gap:12px;align-items:center;padding:10px 0}.study-sk-vicon{width:38px;height:38px;border-radius:10px;flex:0 0 38px}@media(prefers-reduced-motion:reduce){.study-sk{animation:none}}';document.head.appendChild(style);
 var summary=read('summary');if(summary){txt('bookTitle',summary.bookTitle);txt('unitTitle',summary.unitText);}
 var map=by('learningMap');if(map)map.innerHTML='<div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div><div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div><div class="study-sk-unit"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line"></div><div class="study-sk study-sk-line short"></div></div>';
 var grid=by('skillGrid');if(grid){var cards='';for(var i=0;i<6;i++)cards+='<div class="study-sk-card" aria-hidden="true"><div class="study-sk study-sk-icon"></div><div class="study-sk-lines"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line short"></div></div></div>';grid.innerHTML=cards;}
 var vocab=by('vocabPreview');if(vocab){var rows='';for(var j=0;j<5;j++)rows+='<div class="study-sk-vrow" aria-hidden="true"><div class="study-sk study-sk-vicon"></div><div class="study-sk-lines"><div class="study-sk study-sk-line med"></div><div class="study-sk study-sk-line short"></div></div></div>';vocab.innerHTML=rows;}
 var status=by('contentStatus');if(status)status.textContent='';
 document.documentElement.dataset.studySkeleton='1';
 window.addEventListener('willena:study-unit-changed',function(){delete document.documentElement.dataset.studySkeleton;},{once:true});
}catch(_){ }
})();
(function(global){
'use strict';
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function arr(value){return Array.isArray(value)?value:[];}
function text(value){return String(value==null?'':value).trim();}
function usage(value){var items=arr(value).map(text).filter(Boolean);return items.length?items:['practice'];}
function normalize(raw){
 raw=raw||{};
 var stimulus=raw.stimulus||{};
 var response=raw.response||{};
 var type=text(raw.type||response.type||'multiple_choice');
 var prompt=text(raw.prompt||raw.q||stimulus.prompt||stimulus.text);
 var context=text(raw.context||raw.meaning||stimulus.context);
 var choices=arr(response.choices&&response.choices.length?response.choices:raw.choices).slice();
 var tokens=arr(response.tokens&&response.tokens.length?response.tokens:raw.tokens).slice();
 var wordLengths=arr(response.wordLengths&&response.wordLengths.length?response.wordLengths:raw.wordLengths).map(function(n){return Number(n)||0;}).filter(Boolean);
 var answer=raw.answer!==undefined?raw.answer:raw.a;
 var activity={
  id:text(raw.id||raw.sourceId||raw.source_id),
  sourceType:text(raw.sourceType||raw.source_type||raw.sourceTable||'activity'),
  sourceId:text(raw.sourceId||raw.source_id||raw.id),
  bookId:raw.bookId||raw.book_id||null,
  unitId:raw.unitId||raw.unit_id||null,
  sectionId:raw.sectionId||raw.section_id||null,
  skill:text(raw.skill||raw.metadata&&raw.metadata.skill||''),
  usage:usage(raw.usage),
  stimulus:{
   type:text(stimulus.type||((raw.metadata&&raw.metadata.transcript)?'audio':'text')),
   prompt:prompt,
   context:context,
   text:text(stimulus.text||raw.metadata&&raw.metadata.transcript||''),
   audio:clone(stimulus.audio||raw.audio||null),
   image:clone(stimulus.image||raw.image||null),
   lines:clone(stimulus.lines||raw.dialogue_lines||[]),
   targetIndex:Number.isInteger(stimulus.targetIndex)?stimulus.targetIndex:(Number.isInteger(raw.targetIndex)?raw.targetIndex:null)
  },
  response:{
   type:type,
   choices:choices,
   tokens:tokens,
   wordLengths:wordLengths,
   inputMode:text(response.inputMode||response.input_mode||'')
  },
  answer:clone(answer),
  acceptedAnswers:arr(raw.acceptedAnswers||raw.accepted_answers).slice(),
  feedback:clone(raw.feedback||null),
  level:Number(raw.level||raw.level_id)||null,
  difficulty:Number(raw.difficulty||raw.difficulty_rating)||null,
  metadata:clone(raw.metadata||{})||{}
 };
 activity.type=activity.response.type;
 activity.q=activity.stimulus.prompt;
 activity.meaning=activity.stimulus.context;
 activity.choices=activity.response.choices;
 activity.tokens=activity.response.tokens;
 activity.wordLengths=activity.response.wordLengths;
 activity.a=clone(activity.answer);
 activity.sourceTable=activity.sourceType;
 activity.translation=Boolean(raw.translation);
 return activity;
}
function validate(activity){
 var errors=[];
 if(!activity||typeof activity!=='object')return['activity must be an object'];
 if(!text(activity.id))errors.push('id is required');
 if(!text(activity.response&&activity.response.type||activity.type))errors.push('response type is required');
 if(!text(activity.stimulus&&activity.stimulus.prompt||activity.q))errors.push('prompt is required');
 if(activity.answer===undefined&&activity.a===undefined)errors.push('answer is required');
 return errors;
}
global.WillenaActivitySchema={normalize:normalize,validate:validate};
})(window);